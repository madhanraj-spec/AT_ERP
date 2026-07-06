import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Loader, Eye, Send, ChevronDown, ChevronUp, X, ChevronRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ReceiptPrintModal from '../GreigeYarn/ReceiptPrintModal';

export default function AdminApprovals() {
  const [activeTab, setActiveTab] = useState('dyeing');
  const { profile } = useAuth();

  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: '0', padding: '0 0.25rem' }}>
      <style>{`
        /* Desktop vs Mobile display utilities */
        @media (min-width: 769px) {
          .mobile-view { display: none !important; }
        }
        @media (max-width: 768px) {
          .desktop-view { display: none !important; }
        }

        /* Scrollable Tab bar styling */
        .scrollable-tabs-container {
          display: flex;
          gap: 0.25rem;
          margin-bottom: 1.5rem;
          background-color: var(--bg-current);
          border-radius: 10px;
          padding: 4px;
          border: 1px solid var(--border-current);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .scrollable-tabs-container::-webkit-scrollbar {
          display: none;
        }
        .scrollable-tab-btn {
          flex: 1;
          padding: 0.6rem 0.75rem;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        @media (max-width: 768px) {
          .scrollable-tab-btn {
            flex: 0 0 auto;
            padding: 0.5rem 1rem;
          }
        }

        /* Main tabs scrollable */
        .main-tabs-container {
          display: flex;
          gap: 0;
          border-bottom: 2px solid var(--border-current);
          margin-bottom: 1.5rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .main-tabs-container::-webkit-scrollbar {
          display: none;
        }
        .main-tab-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          background-color: transparent;
          font-size: 0.9rem;
          cursor: pointer;
          margin-bottom: -2px;
          transition: all 0.2s;
          white-space: nowrap;
        }
        @media (max-width: 768px) {
          .main-tab-btn {
            padding: 0.6rem 1rem;
          }
        }

        /* Mobile list and cards styling */
        .mobile-view {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
        }
        .mobile-card {
          background-color: var(--surface-current);
          border: 1px solid var(--border-current);
          border-radius: 8px;
          padding: 1rem;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .mobile-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid var(--border-current);
          padding-bottom: 0.5rem;
        }
        .mobile-card-body {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.8rem;
        }
        .mobile-card-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .mobile-card-label {
          font-weight: 600;
          color: var(--text-muted-current);
        }
        .mobile-card-value {
          font-weight: 500;
          color: var(--text-current);
        }
        .mobile-card-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
          border-top: 1px solid var(--border-current);
          padding-top: 0.75rem;
          margin-top: 0.25rem;
        }
        .mobile-sub-list {
          background-color: var(--bg-current);
          border-radius: 6px;
          padding: 0.5rem;
          margin-top: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .mobile-sub-item {
          border-bottom: 1px dashed var(--border-current);
          padding-bottom: 0.4rem;
        }
        .mobile-sub-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
      `}</style>
      <h1 style={{ marginBottom: '0.25rem' }}>Approvals</h1>
      <p style={{ color: 'var(--text-muted-current)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Review and approve production forms submitted by Merchandisers.
      </p>

      {/* Tab Bar */}
      <div className="main-tabs-container">
        {[
          { key: 'dyeing', label: '🎨 Dyeing Order Forms' },
          { key: 'production', label: '🏭 Production Forms' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="main-tab-btn"
            style={{
              borderBottom: activeTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--text-muted-current)',
              fontWeight: activeTab === tab.key ? '700' : '500',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dyeing' && <DyeingFormApprovals adminProfile={profile} />}
      {activeTab === 'production' && <ProductionFormApprovals adminProfile={profile} />}
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

  const getApprovalStatus = (status) => {
    if (status === 'pending') return 'pending';
    if (status === 'rejected') return 'rejected';
    return 'approved';
  };

  const getApprovalStatusBadge = (status) => {
    const approval = getApprovalStatus(status);
    switch (approval) {
      case 'pending': return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={12} />, label: 'PENDING' };
      case 'approved': return { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={12} />, label: 'APPROVED' };
      case 'rejected': return { bg: '#fee2e2', text: '#991b1b', icon: <XCircle size={12} />, label: 'REJECTED' };
      default: return { bg: '#f1f5f9', text: '#475569', icon: null, label: approval.toUpperCase() };
    }
  };

  const getYarnStatus = (status) => {
    switch (status) {
      case 'pending':
      case 'rejected':
      case 'approved': return 'greige_not_sent';
      case 'partially_sent': return 'greige_partially_sent';
      case 'fully_sent': return 'greige_sent';
      case 'partially_received': return 'partially_received';
      case 'received': return 'fully_received';
      default: return status || 'greige_not_sent';
    }
  };

  const getYarnStatusBadge = (status) => {
    const yarn = getYarnStatus(status);
    switch (yarn) {
      case 'greige_not_sent': return { bg: '#f1f5f9', text: '#475569', icon: null, label: 'GREIGE NOT SENT' };
      case 'greige_partially_sent': return { bg: '#fef3c7', text: '#92400e', icon: <Clock size={12} />, label: 'GREIGE PARTIALLY SENT' };
      case 'greige_sent': return { bg: '#dbeafe', text: '#1e40af', icon: <Send size={12} />, label: 'GREIGE SENT' };
      case 'partially_received': return { bg: '#e0f2fe', text: '#0369a1', icon: <Clock size={12} />, label: 'PARTIALLY RECEIVED' };
      case 'fully_received': return { bg: '#dcfce7', text: '#166534', icon: <CheckCircle size={12} />, label: 'FULLY RECEIVED' };
      default: return { bg: '#f1f5f9', text: '#475569', icon: null, label: yarn.toUpperCase().replace(/_/g, ' ') };
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
          { key: 'pending', label: 'Pending', count: forms.filter(f => getApprovalStatus(f.status) === 'pending').length },
          { key: 'approved', label: 'Approved', count: forms.filter(f => getApprovalStatus(f.status) === 'approved').length },
          { key: 'rejected', label: 'Rejected', count: forms.filter(f => getApprovalStatus(f.status) === 'rejected').length },
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
      <div className="desktop-view">
        <div className="glass-panel" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>DOF Number</th>
                  <th>Created By</th>
                  <th>Dyeing Unit</th>
                  <th>Delivery Date</th>
                  <th>Orders</th>
                  <th style={{ textAlign: 'right' }}>Total Qty (kg)</th>
                  <th>Approval Status</th>
                  <th>Yarn Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = forms.filter(f => statusFilter === 'all' || getApprovalStatus(f.status) === statusFilter);
                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                          No {statusFilter !== 'all' ? statusFilter : ''} Dyeing Order Forms found.
                        </td>
                      </tr>
                    );
                  }
                  return filtered.map(form => {
                    const approvalBadge = getApprovalStatusBadge(form.status);
                    const yarnBadge = getYarnStatusBadge(form.status);
                    return (
                      <tr key={form.id} className="fade-in">
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{form.dof_number}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                              Created: {new Date(form.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>{form.creator?.full_name || '-'}</td>
                        <td style={{ fontWeight: '500', fontSize: '0.8125rem' }}>{form.dyeing_unit?.partner_name || '-'}</td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          {form.expected_delivery_date ? new Date(form.expected_delivery_date).toLocaleDateString() : '-'}
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          {form.orders?.map(o => o.order_number).join(', ') || '-'}
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              backgroundColor: approvalBadge.bg, color: approvalBadge.text,
                              padding: '3px 8px', borderRadius: '4px',
                              fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap'
                            }}>
                              {approvalBadge.icon} {approvalBadge.label}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              backgroundColor: yarnBadge.bg, color: yarnBadge.text,
                              padding: '3px 8px', borderRadius: '4px',
                              fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap'
                            }}>
                              {yarnBadge.icon} {yarnBadge.label}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button
                              onClick={() => navigate(`/admin/dyeing-forms/${form.id}`, { state: { from: '/admin/approvals' } })}
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

      <div className="mobile-view">
        {(() => {
          const filtered = forms.filter(f => statusFilter === 'all' || getApprovalStatus(f.status) === statusFilter);
          if (filtered.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)', backgroundColor: 'var(--surface-current)', borderRadius: '8px', border: '1px solid var(--border-current)', fontSize: '0.8rem' }}>
                No {statusFilter !== 'all' ? statusFilter : ''} Dyeing Order Forms found.
              </div>
            );
          }
          return filtered.map(form => {
            const approvalBadge = getApprovalStatusBadge(form.status);
            const yarnBadge = getYarnStatusBadge(form.status);
            return (
              <div key={form.id} className="mobile-card">
                <div className="mobile-card-header">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{form.dof_number}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                      Created: {new Date(form.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      backgroundColor: approvalBadge.bg, color: approvalBadge.text,
                      padding: '2px 6px', borderRadius: '4px',
                      fontSize: '0.65rem', fontWeight: '700'
                    }}>
                      {approvalBadge.icon} {approvalBadge.label}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      backgroundColor: yarnBadge.bg, color: yarnBadge.text,
                      padding: '2px 6px', borderRadius: '4px',
                      fontSize: '0.65rem', fontWeight: '700'
                    }}>
                      {yarnBadge.icon} {yarnBadge.label}
                    </span>
                  </div>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Created By</span>
                    <span className="mobile-card-value">{form.creator?.full_name || '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Dyeing Unit</span>
                    <span className="mobile-card-value">{form.dyeing_unit?.partner_name || '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Delivery Date</span>
                    <span className="mobile-card-value">
                      {form.expected_delivery_date ? new Date(form.expected_delivery_date).toLocaleDateString() : '-'}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Orders</span>
                    <span className="mobile-card-value" style={{ maxWidth: '60%', textAlign: 'right' }}>
                      {form.orders?.map(o => o.order_number).join(', ') || '-'}
                    </span>
                  </div>
                  <div className="mobile-card-row" style={{ borderTop: '1px dashed var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                    <span className="mobile-card-label">Total Qty</span>
                    <span className="mobile-card-value" style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      {getTotalKg(form.yarn_allocations)} kg
                    </span>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <button
                    onClick={() => navigate(`/admin/dyeing-forms/${form.id}`, { state: { from: '/admin/approvals' } })}
                    style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Eye size={12} /> View
                  </button>
                  {form.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAction(form, 'approved')}
                        style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                      >✓ Approve</button>
                      <button
                        onClick={() => handleAction(form, 'rejected')}
                        style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                      >✗ Reject</button>
                    </>
                  )}
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

// ── Production Form Approvals with 6 sub-tabs ──────────────────
function ProductionFormApprovals({ adminProfile }) {
  const [subTab, setSubTab] = useState('greige');

  const subTabs = [
    { key: 'greige', label: '🧶 Greige', icon: '🧶' },
    { key: 'dyeing', label: '🎨 Dyeing', icon: '🎨' },
    { key: 'warping', label: '🔧 Warping', icon: '🔧' },
    { key: 'sizing', label: '📏 Sizing', icon: '📏' },
    { key: 'weaving', label: '🏭 Weaving', icon: '🏭' },
    { key: 'processing', label: '⚙️ Processing', icon: '⚙️' },
  ];

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="scrollable-tabs-container">
        {subTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className="scrollable-tab-btn"
            style={{
              backgroundColor: subTab === tab.key ? 'var(--color-primary)' : 'transparent',
              color: subTab === tab.key ? 'white' : 'var(--text-muted-current)',
              fontWeight: subTab === tab.key ? '700' : '500',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'greige' && <GreigeApprovals />}
      {subTab === 'dyeing' && <DyeingFinanceApprovals />}
      {subTab === 'warping' && <WarpingBillApprovals adminProfile={adminProfile} />}
      {subTab === 'sizing' && <SizingBillApprovals adminProfile={adminProfile} />}
      {subTab === 'weaving' && <WeavingBillApprovals adminProfile={adminProfile} />}
      {subTab === 'processing' && <ProcessingBillApprovals adminProfile={adminProfile} />}
    </div>
  );
}

// ── Placeholder for future sub-tabs ──────────────────────────────
function ProductionSubTabPlaceholder({ name, icon }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>
      <h3>{name} Approvals</h3>
      <p>{name} form approvals will appear here.</p>
    </div>
  );
}

// ── Greige Receipt Approvals ─────────────────────────────────────
function GreigeApprovals() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const { profile } = useAuth();

  useEffect(() => { fetchReceipts(); }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('greige_yarn_receipts')
        .select(`
          *,
          master_partners (partner_name),
          master_yarn_counts (count_value, material, product_type),
          master_locations!location_id (location_name)
        `)
        .eq('receipt_type', 'spinning_mill')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by receipt_no so multi-count receipts appear as one row
      const grouped = [];
      const map = new Map();
      (data || []).forEach(row => {
        if (!map.has(row.receipt_no)) {
          const group = {
            ...row,
            items: [],
          };
          map.set(row.receipt_no, group);
          grouped.push(group);
        }
        map.get(row.receipt_no).items.push(row);
      });

      setReceipts(grouped);
    } catch (err) {
      console.error('Error fetching greige receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (group) => {
    if (!window.confirm(`Approve GYRR ${group.receipt_no} for Finance?`)) return;
    setApprovingId(group.receipt_no);
    try {
      // Update all rows with this receipt_no
      const receiptIds = group.items.map(i => i.id);
      const { error } = await supabase
        .from('greige_yarn_receipts')
        .update({
          finance_approval_status: 'approved',
          finance_approved_by: profile?.id,
          finance_approved_at: new Date().toISOString(),
        })
        .in('id', receiptIds);

      if (error) throw error;
      fetchReceipts();
    } catch (err) {
      alert('Error approving: ' + err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'approved') {
      return { bg: '#dcfce7', text: '#166534', label: 'APPROVED', icon: <CheckCircle size={12} /> };
    }
    return { bg: '#fef3c7', text: '#92400e', label: 'APPROVAL PENDING', icon: <Clock size={12} /> };
  };

  const getCountLabel = (item) => {
    if (!item.master_yarn_counts) return '-';
    const { count_value, material, product_type } = item.master_yarn_counts;
    return `${count_value} ${material} ${product_type || ''}`.trim();
  };

  // Filter logic
  const filtered = receipts.filter(g => {
    if (statusFilter === 'all') return true;
    const status = g.finance_approval_status || 'pending';
    return status === statusFilter;
  });

  const pendingCount = receipts.filter(g => (g.finance_approval_status || 'pending') === 'pending').length;
  const approvedCount = receipts.filter(g => (g.finance_approval_status || 'pending') === 'approved').length;

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div>
      {/* Status Filter Pills */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {[
          { key: 'all', label: 'All Receipts', count: receipts.length },
          { key: 'pending', label: 'Approval Pending', count: pendingCount },
          { key: 'approved', label: 'Approved', count: approvedCount },
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

      {/* Greige Receipts Table */}
      <div className="desktop-view">
        <div className="glass-panel" style={{ padding: 0, width: '100%' }}>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Date & Time</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>GYRR</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Inv No</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Inv Date</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Mill Name</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Count</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Bags</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Cones</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Wt/Bag</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Wt/Cone</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Total Wt</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Rate/Kg</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Inv Value</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Location</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={16} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>
                      No {statusFilter !== 'all' ? (statusFilter === 'pending' ? 'pending' : 'approved') : ''} greige receipts found.
                    </td>
                  </tr>
                ) : (
                  filtered.map(group => {
                    const status = group.finance_approval_status || 'pending';
                    const badge = getStatusBadge(status);
                    const rowSpan = group.items.length;

                    return (
                      <React.Fragment key={group.receipt_no}>
                        {group.items.map((item, idx) => {
                          const isFirst = idx === 0;
                          const isLast = idx === group.items.length - 1;
                          const trStyle = {
                            backgroundColor: 'transparent',
                            transition: 'background-color 0.15s ease'
                          };
                          const tdPad = { padding: '0.35rem 0.25rem', fontSize: '0.72rem', verticalAlign: 'middle' };
                          const groupBorder = '2px solid var(--color-primary)';
                          const itemBorder = isLast ? groupBorder : '1px dashed var(--border-current)';

                          return (
                            <tr key={item.id} style={trStyle}>
                              {isFirst && (
                                <>
                                  <td rowSpan={rowSpan} style={{ ...tdPad, whiteSpace: 'nowrap', borderBottom: groupBorder }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: '600' }}>
                                        {new Date(group.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                      </span>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>
                                        {new Date(group.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </td>
                                  <td rowSpan={rowSpan} style={{ ...tdPad, whiteSpace: 'nowrap', borderBottom: groupBorder }}>
                                    <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>
                                      {group.receipt_no}
                                    </span>
                                  </td>
                                  <td rowSpan={rowSpan} style={{ ...tdPad, whiteSpace: 'nowrap', borderBottom: groupBorder }}>{group.invoice_no || '-'}</td>
                                  <td rowSpan={rowSpan} style={{ ...tdPad, whiteSpace: 'nowrap', borderBottom: groupBorder }}>
                                    {group.invoice_date ? new Date(group.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                  </td>
                                  <td rowSpan={rowSpan} style={{ ...tdPad, fontWeight: '500', minWidth: '120px', whiteSpace: 'normal', borderBottom: groupBorder }}>
                                    {group.master_partners?.partner_name || '-'}
                                  </td>
                                </>
                              )}

                              {/* Per-item columns (count, bags, cones, weights) */}
                              <td style={{ ...tdPad, minWidth: '100px', whiteSpace: 'normal', borderBottom: itemBorder }}>{getCountLabel(item)}</td>
                              <td style={{ ...tdPad, textAlign: 'right', borderBottom: itemBorder }}>{item.bag_count || 0}</td>
                              <td style={{ ...tdPad, textAlign: 'right', borderBottom: itemBorder }}>{item.cone_count || 0}</td>
                              <td style={{ ...tdPad, textAlign: 'right', borderBottom: itemBorder }}>{Number(item.bag_weight || 0).toFixed(1)}</td>
                              <td style={{ ...tdPad, textAlign: 'right', borderBottom: itemBorder }}>{Number(item.cone_weight || 0).toFixed(2)}</td>
                              <td style={{ ...tdPad, textAlign: 'right', fontWeight: '600', borderBottom: itemBorder }}>{Number(item.total_weight || 0).toFixed(1)}</td>
                              <td style={{ ...tdPad, textAlign: 'right', whiteSpace: 'nowrap', borderBottom: itemBorder }}>₹{Number(item.rate_per_kg || 0).toFixed(0)}</td>

                              {isFirst && (
                                <>
                                  <td rowSpan={rowSpan} style={{ ...tdPad, textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', borderBottom: groupBorder }}>
                                    ₹{Number(group.invoice_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                  </td>
                                  <td rowSpan={rowSpan} style={{ ...tdPad, minWidth: '85px', whiteSpace: 'normal', borderBottom: groupBorder }}>
                                    {item.master_locations?.location_name || '-'}
                                  </td>
                                  <td rowSpan={rowSpan} style={{ ...tdPad, borderBottom: groupBorder }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      backgroundColor: badge.bg,
                                      color: badge.text,
                                      padding: '2px 6px',
                                      borderRadius: '3px',
                                      fontSize: '0.65rem',
                                      fontWeight: '700',
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {badge.icon} {badge.label}
                                    </span>
                                  </td>
                                  <td rowSpan={rowSpan} style={{ ...tdPad, textAlign: 'center', borderBottom: groupBorder }}>
                                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', alignItems: 'center' }}>
                                      <button
                                        onClick={() => setSelectedReceipt(group)}
                                        style={{
                                          backgroundColor: '#e0f2fe',
                                          color: '#0369a1',
                                          border: '1px solid #bae6fd',
                                          padding: '3px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.7rem',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '2px',
                                        }}
                                      >
                                        <Eye size={10} /> View
                                      </button>
                                      {status === 'pending' && (
                                        <button
                                          onClick={() => handleApprove(group)}
                                          disabled={approvingId === group.receipt_no}
                                          style={{
                                            backgroundColor: '#dcfce7',
                                            color: '#166534',
                                            border: '1px solid #86efac',
                                            padding: '3px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: '700',
                                            cursor: approvingId === group.receipt_no ? 'wait' : 'pointer',
                                            opacity: approvingId === group.receipt_no ? 0.6 : 1,
                                          }}
                                        >
                                          {approvingId === group.receipt_no ? '...' : '✓ Approve'}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mobile-view">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)', backgroundColor: 'var(--surface-current)', borderRadius: '8px', border: '1px solid var(--border-current)', fontSize: '0.8rem' }}>
            No {statusFilter !== 'all' ? (statusFilter === 'pending' ? 'pending' : 'approved') : ''} greige receipts found.
          </div>
        ) : (
          filtered.map(group => {
            const status = group.finance_approval_status || 'pending';
            const badge = getStatusBadge(status);
            return (
              <div key={group.receipt_no} className="mobile-card">
                <div className="mobile-card-header">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{group.receipt_no}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                      {new Date(group.created_at).toLocaleDateString()} {new Date(group.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    backgroundColor: badge.bg,
                    color: badge.text,
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    whiteSpace: 'nowrap',
                  }}>
                    {badge.icon} {badge.label}
                  </span>
                </div>
                <div className="mobile-card-body">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Inv No & Date</span>
                    <span className="mobile-card-value">
                      {group.invoice_no || '-'} ({group.invoice_date ? new Date(group.invoice_date).toLocaleDateString('en-GB') : '-'})
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Mill Name</span>
                    <span className="mobile-card-value">{group.master_partners?.partner_name || '-'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Location</span>
                    <span className="mobile-card-value">{group.items[0]?.master_locations?.location_name || '-'}</span>
                  </div>
                  <div className="mobile-card-row" style={{ borderTop: '1px dashed var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                    <span className="mobile-card-label">Invoice Amount</span>
                    <span className="mobile-card-value" style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                      ₹{Number(group.invoice_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    <span className="mobile-card-label" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Items</span>
                    <div className="mobile-sub-list">
                      {group.items.map(item => (
                        <div key={item.id} className="mobile-sub-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-current)' }}>{getCountLabel(item)}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>
                            <div>Bags: <strong>{item.bag_count || 0}</strong></div>
                            <div>Cones: <strong>{item.cone_count || 0}</strong></div>
                            <div>Wt/Bag: <strong>{Number(item.bag_weight || 0).toFixed(1)}</strong></div>
                            <div>Wt/Cone: <strong>{Number(item.cone_weight || 0).toFixed(2)}</strong></div>
                            <div style={{ gridColumn: 'span 2' }}>Total Wt: <strong style={{ color: 'var(--color-primary)' }}>{Number(item.total_weight || 0).toFixed(1)} kg</strong></div>
                            <div>Rate/Kg: <strong>₹{Number(item.rate_per_kg || 0).toFixed(0)}</strong></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <button
                    onClick={() => setSelectedReceipt(group)}
                    style={{
                      backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd',
                      padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                      display: 'inline-flex', alignItems: 'center', gap: '2px'
                    }}
                  >
                    <Eye size={12} /> View
                  </button>
                  {status === 'pending' && (
                    <button
                      onClick={() => handleApprove(group)}
                      disabled={approvingId === group.receipt_no}
                      style={{
                        backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac',
                        padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700',
                        opacity: approvingId === group.receipt_no ? 0.6 : 1
                      }}
                    >
                      {approvingId === group.receipt_no ? '...' : '✓ Approve'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Receipt Print Modal */}
      {selectedReceipt && (
        <ReceiptPrintModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

// ── Dyeing Finance Approvals (Admin module) ──────────────────
function ApprovalsModalWrapper({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
        <div style={{ position: 'sticky', top: 0, backgroundColor: '#fff', borderBottom: '1px solid #eee', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--color-primary)' }}>{title}</h3>
          <X size={24} style={{ cursor: 'pointer', color: '#666' }} onClick={onClose} />
        </div>
        <div style={{ padding: '1.5rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ApprovalsGYDRDetailModal({ data, yarnCounts, onClose }) {
  const { receipt, items } = data;
  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    return y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : 'Unknown';
  };

  return (
    <ApprovalsModalWrapper title={`Greige Yarn Delivery Receipt: ${receipt.gydr_number}`} onClose={onClose}>
      <div style={{ border: '2px solid var(--color-primary)', padding: '1.5rem', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--color-primary)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--color-primary)', fontWeight: '900', fontSize: '1.25rem' }}>GREIGE DELIVERY RECEIPT</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>Ashok Textiles · Greige Yarn Deliveries</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>#{receipt.gydr_number}</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>Date: {new Date(receipt.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
          <div>
            <p style={{ margin: '0.2rem 0' }}><strong>Delivered By:</strong> {receipt.delivered_by}</p>
            <p style={{ margin: '0.2rem 0' }}><strong>Vehicle No:</strong> {receipt.vehicle_no || '-'}</p>
          </div>
          <div>
            <p style={{ margin: '0.2rem 0' }}><strong>Remarks:</strong> {receipt.remarks || '-'}</p>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Yarn Count</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Colour</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', fontWeight: '600' }}>{formatYarn(item.yarn_count_id)}</td>
                <td style={{ padding: '0.5rem' }}>{item.colour}</td>
                <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{item.yarn_type || 'warp'}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ApprovalsModalWrapper>
  );
}

function ApprovalsDYRRDetailModal({ data, yarnCounts, onClose }) {
  const { receipt, items } = data;
  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    return y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : 'Unknown';
  };

  return (
    <ApprovalsModalWrapper title={`Dyed Yarn Receipt: ${receipt.dyrr_number}`} onClose={onClose}>
      <div style={{ border: '2px solid #16a34a', padding: '1.5rem', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #16a34a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#16a34a', fontWeight: '900', fontSize: '1.25rem' }}>DYED RECEIPT</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>Dyed Yarn Receipt</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>#{receipt.dyrr_number}</div>
            <div style={{ fontSize: '0.75rem', color: '#666' }}>Date: {new Date(receipt.created_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
          <div>
            <p style={{ margin: '0.2rem 0' }}><strong>DC Number:</strong> {receipt.dc_number || '-'}</p>
            <p style={{ margin: '0.2rem 0' }}><strong>Received By:</strong> {receipt.received_by}</p>
          </div>
          <div>
            <p style={{ margin: '0.2rem 0' }}><strong>Vehicle No:</strong> {receipt.vehicle_no || '-'}</p>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#16a34a', color: '#fff' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Yarn Count</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Colour</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem', fontWeight: '600' }}>{formatYarn(item.yarn_count_id)}</td>
                <td style={{ padding: '0.5rem' }}>{item.colour}</td>
                <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{item.yarn_type || 'warp'}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ApprovalsModalWrapper>
  );
}

function DyeingFinanceApprovals() {
  const { profile } = useAuth();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('submitted');

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dof_bills')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error('Error fetching dyeing bills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveBill = async (bill) => {
    if (!window.confirm(`Are you sure you want to APPROVE Bill ${bill.bill_number}?`)) return;
    setSubmitting(true);
    try {
      const { error: billErr } = await supabase
        .from('dof_bills')
        .update({
          status: 'approved',
          approved_by: profile.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', bill.id);
      if (billErr) throw billErr;

      const { error: dofErr } = await supabase
        .from('dyeing_order_forms')
        .update({ bill_status: 'approved' })
        .in('id', bill.selected_dof_ids || []);
      if (dofErr) throw dofErr;

      alert(`✅ Bill ${bill.bill_number} has been approved.`);
      setExpandedBillId(null);
      fetchBills();
    } catch (err) {
      console.error(err);
      alert('Error approving bill: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectBill = async (bill) => {
    if (!window.confirm(`Are you sure you want to REJECT Bill ${bill.bill_number}?`)) return;
    setSubmitting(true);
    try {
      const { error: billErr } = await supabase
        .from('dof_bills')
        .update({
          status: 'rejected',
          rejected_by: profile.id,
          rejected_at: new Date().toISOString()
        })
        .eq('id', bill.id);
      if (billErr) throw billErr;

      const { error: dofErr } = await supabase
        .from('dyeing_order_forms')
        .update({ bill_status: 'pending' })
        .in('id', bill.selected_dof_ids || []);
      if (dofErr) throw dofErr;

      alert(`❌ Bill ${bill.bill_number} has been rejected.`);
      setExpandedBillId(null);
      fetchBills();
    } catch (err) {
      console.error(err);
      alert('Error rejecting bill: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getBillStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
        return { bg: '#fef3c7', text: '#92400e', label: 'AWAITING APPROVAL', icon: <Clock size={11} /> };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', label: 'APPROVED', icon: <CheckCircle size={11} /> };
      case 'settled':
        return { bg: '#dbeafe', text: '#1e40af', label: 'SETTLED', icon: <CheckCircle size={11} /> };
      case 'rejected':
        return { bg: '#fee2e2', text: '#b91c1c', label: 'REJECTED', icon: <XCircle size={11} /> };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: (status || '').toUpperCase(), icon: null };
    }
  };

  const filteredBills = bills.filter(bill => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'submitted') return bill.status === 'submitted';
    if (statusFilter === 'approved') return bill.status === 'approved' || bill.status === 'settled';
    if (statusFilter === 'rejected') return bill.status === 'rejected';
    return true;
  });

  const awaitingCount = bills.filter(b => b.status === 'submitted').length;
  const approvedCount = bills.filter(b => b.status === 'approved' || b.status === 'settled').length;
  const rejectedCount = bills.filter(b => b.status === 'rejected').length;

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div>
      {/* Status Filter Pills */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {[
          { key: 'submitted', label: 'Awaiting Approvals', count: awaitingCount },
          { key: 'approved', label: 'Approved', count: approvedCount },
          { key: 'rejected', label: 'Rejected', count: rejectedCount },
          { key: 'all', label: 'All Bills', count: bills.length },
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

      <div className="glass-panel" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Bill Number</th>
                <th>Invoice Details</th>
                <th>Dyeing Unit</th>
                <th style={{ textAlign: 'right' }}>Calculated Pre-Tax</th>
                <th style={{ textAlign: 'right' }}>Tax</th>
                <th style={{ textAlign: 'right' }}>Total Bill Value</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                    No Dyeing Bills found.
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => {
                  const isExpanded = expandedBillId === bill.id;
                  const statusBadge = getBillStatusBadge(bill.status);
                  
                  return (
                    <React.Fragment key={bill.id}>
                      <tr className="fade-in" style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)' }}>
                        <td>
                          <button
                            onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                          >
                            <ChevronDown size={18} style={{ 
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                              transition: 'transform 0.2s',
                              color: 'var(--color-primary)'
                            }} />
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '0.9rem' }}>
                              {bill.bill_number}
                            </span>
                            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                              Raised: {new Date(bill.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600' }}>No: {bill.invoice_number}</span>
                            <span style={{ fontSize: '0.725rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                              Date: {new Date(bill.invoice_date).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {bill.partner_name}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '500' }}>
                          ₹{bill.calculated_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                          ₹{bill.tax_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({bill.tax_percent}%)
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                          ₹{bill.bill_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            backgroundColor: statusBadge.bg, color: statusBadge.text,
                            padding: '3px 8px', borderRadius: '4px',
                            fontSize: '0.725rem', fontWeight: '700', whiteSpace: 'nowrap'
                          }}>
                            {statusBadge.icon} {statusBadge.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
                            {bill.status === 'submitted' && (
                              <>
                                <button
                                  onClick={() => handleApproveBill(bill)}
                                  disabled={submitting}
                                  className="btn btn-primary"
                                  style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: '700' }}
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  onClick={() => handleRejectBill(bill)}
                                  disabled={submitting}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
                                >
                                  ✗ Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} style={{ backgroundColor: '#fcfcfd', padding: '1.5rem', borderBottom: '2px solid var(--border-current)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '700', borderBottom: '1px solid #eee', paddingBottom: '0.5rem', color: '#475569' }}>
                                Linked Dyeing Order Forms ({bill.selected_dof_ids?.length || 0})
                              </h4>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                                {(bill.bill_items || []).map((item, idx) => (
                                  <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#fff', padding: '0.85rem', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.875rem', color: 'var(--color-primary)', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.4rem', marginBottom: '0.5rem' }}>
                                      <span>DOF: {item.dof_number}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '0.6rem' }}>
                                      <span><strong>Orders:</strong> {(item.order_numbers || []).join(', ')}</span>
                                      <span><strong>Designs:</strong> {(item.design_nos || []).map((n, i) => `${n} (${item.design_names[i] || 'N/A'})`).join(', ')}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.4rem' }}>
                                      {(item.yarn_details || []).map((yd, yidx) => (
                                        <div key={yidx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', padding: '0.25rem 0', borderBottom: yidx < item.yarn_details.length - 1 ? '1px dotted #f1f5f9' : 'none' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: '600', color: '#334155' }}>{yd.count_label}</span>
                                            <span style={{ fontSize: '0.675rem', color: '#64748b' }}>Color: <strong style={{ color: 'var(--color-primary)' }}>{yd.colour}</strong></span>
                                          </div>
                                          <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.725rem', color: '#475569' }}>{yd.quantity_kg?.toFixed(2)} kg @ ₹{yd.price_per_kg?.toFixed(2)}/kg</div>
                                            <div style={{ fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.8rem', marginTop: '1px' }}>₹{yd.total_price?.toFixed(2)}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
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
    </div>
  );
}

// ── Warping Bill Approvals ───────────────────────────────────────
function WarpingBillApprovals({ adminProfile }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('awaiting_approval');
  const [expandedId, setExpandedId] = useState(null);

  // Rate edits state: { [billId]: { [formId]: newRateString } }
  const [editedRates, setEditedRates] = useState({});
  const [adminNotes, setAdminNotes] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  // Tabs and WOF expanded details state
  const [expandedWofsData, setExpandedWofsData] = useState({});
  const [loadingWofs, setLoadingWofs] = useState({});
  const [activeTabs, setActiveTabs] = useState({});
  const [expandedWofIdMap, setExpandedWofIdMap] = useState({});
  const [yarnCounts, setYarnCounts] = useState([]);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_finance_bills')
        .select('*')
        .eq('form_type', 'warping')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchYarnCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('master_yarn_counts')
        .select('*');
      if (!error) setYarnCounts(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBills();
    fetchYarnCounts();
  }, []);

  const loadWofDetailsForBill = async (bill) => {
    if (expandedWofsData[bill.id]) return;
    setLoadingWofs(prev => ({ ...prev, [bill.id]: true }));
    try {
      const selectedFormIds = bill.selected_form_ids || [];
      if (selectedFormIds.length === 0) {
        setExpandedWofsData(prev => ({ ...prev, [bill.id]: [] }));
        return;
      }

      // Fetch WOFs
      const { data: wofs, error: wofError } = await supabase
        .from('warping_order_forms')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name)
        `)
        .in('id', selectedFormIds);

      if (wofError) throw wofError;

      // Fetch DYDR items for all these WOFs
      const { data: dydrItems, error: dydrError } = await supabase
        .from('dyed_yarn_delivery_items')
        .select(`
          id,
          production_form_id,
          yarn_count_id,
          quantity_kg,
          no_of_bags,
          cone_weight,
          colour,
          lot_number,
          yarn_count:master_yarn_counts(count_value, material, product_type),
          delivery:dyed_yarn_deliveries(
            id,
            dydr_number,
            delivered_date,
            delivered_by,
            vehicle_no,
            remarks
          )
        `)
        .in('production_form_id', selectedFormIds);

      if (dydrError) throw dydrError;

      // Group DYDRs by WOF
      const groupedDydrs = {};
      selectedFormIds.forEach(id => { groupedDydrs[id] = []; });
      dydrItems?.forEach(item => {
        if (groupedDydrs[item.production_form_id]) {
          groupedDydrs[item.production_form_id].push(item);
        }
      });

      // Enrich WOFs with their associated DYDRs
      const enrichedWofs = (wofs || []).map(w => ({
        ...w,
        associatedDydrs: groupedDydrs[w.id] || []
      }));

      setExpandedWofsData(prev => ({ ...prev, [bill.id]: enrichedWofs }));
    } catch (err) {
      console.error('Error fetching WOF details for bill:', err);
    } finally {
      setLoadingWofs(prev => ({ ...prev, [bill.id]: false }));
    }
  };

  const toggleExpandBill = (bill) => {
    const isExpanding = expandedId !== bill.id;
    setExpandedId(isExpanding ? bill.id : null);
    if (isExpanding) {
      loadWofDetailsForBill(bill);
    }
  };

  const handleRateChange = (billId, formId, val) => {
    setEditedRates(prev => ({
      ...prev,
      [billId]: {
        ...(prev[billId] || {}),
        [formId]: val
      }
    }));
  };

  const handleNotesChange = (billId, val) => {
    setAdminNotes(prev => ({
      ...prev,
      [billId]: val
    }));
  };

  const getBillData = (bill) => {
    // Get live edited items and totals
    const billEdits = editedRates[bill.id] || {};
    let calculatedTotal = 0;
    const updatedItems = (bill.bill_items || []).map(item => {
      const editedRate = billEdits[item.form_id];
      const rate = editedRate !== undefined ? parseFloat(editedRate) || 0 : item.rate_per_meter || 0;
      const total = item.actual_qty * rate;
      calculatedTotal += total;
      return {
        ...item,
        rate_per_meter: rate,
        calculated_total: total
      };
    });

    const isInvalid = calculatedTotal < bill.invoice_subtotal;
    return { updatedItems, calculatedTotal, isInvalid };
  };

  const handleApprove = async (bill) => {
    const { updatedItems, calculatedTotal, isInvalid } = getBillData(bill);
    if (isInvalid) {
      alert("Cannot approve: The updated calculated total is less than the partner's invoice subtotal.");
      return;
    }

    if (!window.confirm(`Approve warping bill ${bill.bill_number}?`)) return;

    setSubmittingId(bill.id);
    try {
      const { error } = await supabase
        .from('production_finance_bills')
        .update({
          status: 'approved',
          bill_items: updatedItems,
          calculated_total: calculatedTotal,
          admin_notes: adminNotes[bill.id] || bill.admin_notes,
          approved_by: adminProfile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (error) throw error;
      alert('Bill approved successfully!');
      fetchBills();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReject = async (bill) => {
    const notes = adminNotes[bill.id]?.trim() || bill.admin_notes;
    if (!notes) {
      alert('Please enter a note/remarks explaining why the bill is rejected.');
      return;
    }

    if (!window.confirm(`Reject warping bill ${bill.bill_number}?`)) return;

    setSubmittingId(bill.id);
    try {
      const { error } = await supabase
        .from('production_finance_bills')
        .update({
          status: 'rejected',
          admin_notes: notes,
          approved_by: adminProfile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (error) throw error;
      alert('Bill rejected.');
      fetchBills();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'awaiting_approval':
        return { bg: '#fef3c7', text: '#92400e', label: 'AWAITING APPROVAL', icon: <Clock size={12} /> };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', label: 'APPROVED', icon: <CheckCircle size={12} /> };
      case 'settled':
        return { bg: '#dbeafe', text: '#1e40af', label: 'SETTLED', icon: <CheckCircle size={12} /> };
      case 'rejected':
        return { bg: '#fee2e2', text: '#991b1b', label: 'REJECTED', icon: <XCircle size={12} /> };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: (status || '').toUpperCase() };
    }
  };

  const filteredBills = bills.filter(b => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

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
          { key: 'all', label: 'All Bills', count: bills.length },
          { key: 'awaiting_approval', label: 'Awaiting Approval', count: bills.filter(b => b.status === 'awaiting_approval').length },
          { key: 'approved', label: 'Approved / Settled', count: bills.filter(b => b.status === 'approved' || b.status === 'settled').length },
          { key: 'rejected', label: 'Rejected', count: bills.filter(b => b.status === 'rejected').length }
        ].map(pill => (
          <button
            key={pill.key}
            onClick={() => setStatusFilter(pill.key)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              border: '1px solid ' + (statusFilter === pill.key ? 'var(--color-primary)' : 'var(--border-current)'),
              backgroundColor: statusFilter === pill.key ? 'var(--color-primary)' : 'white',
              color: statusFilter === pill.key ? 'white' : 'var(--text-main-current)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {pill.label}
            <span style={{
              backgroundColor: statusFilter === pill.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-current)',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.7rem'
            }}>
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      {/* Bills Table */}
      <div className="desktop-view">
        <div className="glass-panel" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table" style={{ tableLayout: 'auto', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }} />
                  <th>Date</th>
                  <th>Bill Number</th>
                  <th>Partner</th>
                  <th>WOF Numbers</th>
                  <th>Order Numbers</th>
                  <th>Designs</th>
                  <th style={{ textAlign: 'right' }}>Calculated Subtotal</th>
                  <th style={{ textAlign: 'right' }}>Invoice Subtotal</th>
                  <th style={{ textAlign: 'right' }}>Tax Amount</th>
                  <th style={{ textAlign: 'right' }}>Invoice Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                      No bills found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map(bill => {
                    const isExpanded = expandedId === bill.id;
                    const badge = getStatusBadge(bill.status);
                    const { updatedItems, calculatedTotal, isInvalid } = getBillData(bill);
                    const wofNumbers = (bill.bill_items || []).map(item => item.form_number || item.wof_number).filter(Boolean).join(', ');
                    const orderNumbers = Array.from(new Set((bill.bill_items || []).map(item => item.order_number).filter(Boolean))).join(', ');
                    const designs = Array.from(new Set((bill.bill_items || []).map(item => `${item.design_no || ''} ${item.design_name || ''}`.trim()).filter(Boolean))).join(', ');

                    return (
                      <React.Fragment key={bill.id}>
                        <tr onClick={() => toggleExpandBill(bill)} style={{ cursor: 'pointer' }}>
                          <td style={{ textAlign: 'center' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td style={{ fontWeight: '500', fontSize: '0.75rem' }}>{bill.invoice_date || new Date(bill.created_at).toLocaleDateString('en-IN')}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{bill.bill_number}</td>
                          <td style={{ fontWeight: '500', fontSize: '0.75rem' }}>{bill.partner_name}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{wofNumbers || '—'}</td>
                          <td style={{ fontSize: '0.72rem' }}>{orderNumbers || '—'}</td>
                          <td style={{ fontSize: '0.72rem' }}>{designs || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.75rem' }}>₹{Number(calculatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.75rem' }}>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-muted-current)', fontSize: '0.75rem' }}>₹{Number(bill.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '0.75rem' }}>
                            ₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              backgroundColor: badge.bg, color: badge.text,
                              padding: '2px 6px', borderRadius: '4px',
                              fontSize: '0.7rem', fontWeight: '700'
                            }}>
                              {badge.icon} {badge.label}
                            </span>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                              <button
                                onClick={() => toggleExpandBill(bill)}
                                className="btn btn-secondary"
                                style={{ padding: '3px 6px', fontSize: '0.7rem' }}
                              >
                                <Eye size={11} /> {isExpanded ? 'Hide' : 'Review'}
                              </button>
                              {bill.status === 'awaiting_approval' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(bill)}
                                    disabled={submittingId === bill.id || isInvalid}
                                    style={{
                                      backgroundColor: isInvalid ? '#cbd5e1' : '#dcfce7',
                                      color: isInvalid ? '#64748b' : '#166534',
                                      border: '1px solid ' + (isInvalid ? '#cbd5e1' : '#86efac'),
                                      padding: '3px 6px', borderRadius: '4px',
                                      fontSize: '0.7rem', fontWeight: '700',
                                      cursor: isInvalid ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReject(bill)}
                                    disabled={submittingId === bill.id}
                                    style={{
                                      backgroundColor: '#fee2e2', color: '#991b1b',
                                      border: '1px solid #fca5a5',
                                      padding: '3px 6px', borderRadius: '4px',
                                      fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer'
                                    }}
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={13} style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderLeft: '3px solid var(--color-primary)' }}>

                              {/* Expandable Tabs */}
                              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-current)', marginBottom: '1.25rem' }}>
                                {[
                                  { key: 'rates', label: '📊 Rates & Invoicing' },
                                  { key: 'wof', label: '📄 Warping Order Forms (WOF)' }
                                ].map(tab => {
                                  const isActive = (activeTabs[bill.id] || 'rates') === tab.key;
                                  return (
                                    <button
                                      key={tab.key}
                                      type="button"
                                      onClick={() => setActiveTabs(prev => ({ ...prev, [bill.id]: tab.key }))}
                                      style={{
                                        padding: '0.6rem 1.25rem',
                                        border: 'none',
                                        borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                                        backgroundColor: 'transparent',
                                        color: isActive ? 'var(--color-primary)' : 'var(--text-muted-current)',
                                        fontWeight: isActive ? '800' : '600',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        marginBottom: '-1px',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      {tab.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Tab 1: Rates & Invoicing */}
                              {(activeTabs[bill.id] || 'rates') === 'rates' && (
                                <>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', backgroundColor: '#fff', border: '1px solid var(--border-current)', marginBottom: '1rem' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700' }}>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>WOF Number</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Order Number</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Design Name</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>WOF Status</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Actual Dates</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Timeliness</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Qty (m)</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center', width: '160px' }}>Rate / Meter (₹)</th>
                                        <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right', width: '120px' }}>Total Price</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(bill.bill_items || []).map((item, idx) => {
                                        const editedRatesForBill = editedRates[bill.id] || {};
                                        const currentRate = editedRatesForBill[item.form_id] !== undefined ? editedRatesForBill[item.form_id] : (item.rate_per_meter || '');
                                        const rateFloat = parseFloat(currentRate) || 0;
                                        const rowTotal = item.actual_qty * rateFloat;

                                        return (
                                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                            <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace' }}>{item.form_number}</td>
                                            <td style={{ padding: '0.5rem' }}>{item.order_number}</td>
                                            <td style={{ padding: '0.5rem' }}>{item.design_name}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                              <span style={{
                                                backgroundColor: '#dcfce7',
                                                color: '#166534',
                                                padding: '2px 6px',
                                                borderRadius: '10px',
                                                fontSize: '0.65rem',
                                                fontWeight: '700',
                                                textTransform: 'uppercase'
                                              }}>
                                                {item.status || 'completed'}
                                              </span>
                                            </td>
                                            <td style={{ padding: '0.5rem', fontSize: '0.7rem' }}>
                                              {item.actual_start_date ? new Date(item.actual_start_date).toLocaleDateString('en-GB') : '—'} to {item.actual_end_date ? new Date(item.actual_end_date).toLocaleDateString('en-GB') : '—'}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                              <span style={{
                                                backgroundColor: item.timeliness_status === 'late' ? '#fee2e2' : '#dcfce7',
                                                color: item.timeliness_status === 'late' ? '#991b1b' : '#166534',
                                                padding: '1px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '700'
                                              }}>
                                                {item.timeliness_status === 'late' ? 'LATE' : 'ON TIME'}
                                              </span>
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(item.actual_qty).toLocaleString()}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                              {bill.status === 'awaiting_approval' ? (
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  value={currentRate}
                                                  onChange={e => handleRateChange(bill.id, item.form_id, e.target.value)}
                                                  style={{
                                                    width: '100%', padding: '0.25rem 0.5rem',
                                                    border: '1px solid var(--border-current)', borderRadius: '4px',
                                                    fontSize: '0.75rem', textAlign: 'center'
                                                  }}
                                                />
                                              ) : (
                                                `₹${parseFloat(item.rate_per_meter || 0).toFixed(2)}`
                                              )}
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                          </tr>
                                        );
                                      })}
                                      <tr style={{ backgroundColor: 'rgba(0,0,0,0.01)', fontWeight: '800' }}>
                                        <td colSpan={6} style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Calculated Subtotal:</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                                          {(bill.bill_items || []).reduce((sum, item) => sum + (parseFloat(item.actual_qty) || 0), 0).toLocaleString()}
                                        </td>
                                        <td />
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: 'var(--color-primary)' }}>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      </tr>
                                    </tbody>
                                  </table>

                                  {/* Remarks & Warnings */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#475569' }}>Admin Approval Notes / Remarks</label>
                                      <textarea
                                        placeholder={bill.status === 'awaiting_approval' ? "Explain approval rates adjustment or rejection reason..." : "No notes."}
                                        value={adminNotes[bill.id] !== undefined ? adminNotes[bill.id] : (bill.admin_notes || '')}
                                        onChange={e => handleNotesChange(bill.id, e.target.value)}
                                        disabled={bill.status !== 'awaiting_approval'}
                                        style={{
                                          width: '100%', height: '60px', padding: '0.5rem',
                                          border: '1px solid var(--border-current)', borderRadius: '6px',
                                          fontSize: '0.75rem', resize: 'none'
                                        }}
                                      />
                                    </div>

                                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <div>Invoice Subtotal: <strong>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                      <div>Tax Amount: <strong>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                      <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: '800' }}>Invoice Total: ₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                    </div>
                                  </div>

                                  {isInvalid && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.6rem 0.8rem', borderRadius: '6px', color: '#991b1b', fontSize: '0.72rem', fontWeight: '600', marginTop: '0.75rem' }}>
                                      <AlertCircle size={14} /> Warning: The updated calculated total (₹{calculatedTotal.toFixed(2)}) is less than the partner's invoice subtotal (₹{Number(bill.invoice_subtotal).toFixed(2)}). Approval is disabled.
                                    </div>
                                  )}
                                </>
                              )}

                              {/* Tab 2: Warping Order Forms (WOF) */}
                              {(activeTabs[bill.id] || 'rates') === 'wof' && (
                                loadingWofs[bill.id] ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.5rem' }}>
                                    <Loader size={22} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>Loading Warping Order Forms data...</span>
                                  </div>
                                ) : !expandedWofsData[bill.id] || expandedWofsData[bill.id].length === 0 ? (
                                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic', backgroundColor: 'white', border: '1px dashed var(--border-current)', borderRadius: '8px' }}>
                                    No Warping Order Forms associated with this bill.
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {expandedWofsData[bill.id].map(wof => {
                                      const isWofExpanded = expandedWofIdMap[bill.id] === wof.id;
                                      return (
                                        <div key={wof.id} style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                          {/* WOF Expandable Header */}
                                          <div
                                            onClick={() => setExpandedWofIdMap(prev => ({ ...prev, [bill.id]: isWofExpanded ? null : wof.id }))}
                                            style={{
                                              padding: '0.75rem 1rem',
                                              backgroundColor: '#f8fafc',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              cursor: 'pointer',
                                              borderBottom: isWofExpanded ? '1px solid var(--border-current)' : 'none',
                                              transition: 'background-color 0.15s ease'
                                            }}
                                          >
                                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                              <div style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                {isWofExpanded ? '▼' : '▶'} {wof.wof_number}
                                              </div>
                                              <div style={{ fontSize: '0.8rem', color: 'var(--text-main-current)' }}>
                                                Order No: <strong style={{ color: 'var(--color-primary)' }}>{wof.order?.order_number || '—'}</strong>
                                              </div>
                                              <div style={{ fontSize: '0.8rem', color: 'var(--text-main-current)' }}>
                                                Design: <strong>{wof.order?.design_name || '—'}</strong> ({wof.order?.design_no || '—'})
                                              </div>
                                              <div style={{ fontSize: '0.8rem', color: 'var(--text-main-current)' }}>
                                                Qty: <strong>{Number(wof.qty).toLocaleString()} Mtrs</strong>
                                              </div>
                                              <div>
                                                <span style={{
                                                  backgroundColor: wof.status === 'completed' ? '#dcfce7' : '#fef3c7',
                                                  color: wof.status === 'completed' ? '#166534' : '#92400e',
                                                  padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase'
                                                }}>
                                                  {wof.status}
                                                </span>
                                              </div>
                                            </div>
                                            {wof.wofdc_number && (
                                              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#800000', backgroundColor: '#fff5f5', border: '1px solid #fed7d7', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span>📄 WOFDC:</span>
                                                <span style={{ fontFamily: 'monospace' }}>{wof.wofdc_number}</span>
                                              </div>
                                            )}
                                          </div>

                                          {/* WOF Expandable Content */}
                                          {isWofExpanded && (
                                            <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                                              {/* Yarn Details Table */}
                                              <div>
                                                <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-main-current)', letterSpacing: '0.5px' }}>
                                                  Yarn Allocations & Consumption
                                                </h5>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '6px', overflow: 'hidden' }}>
                                                  <thead>
                                                    <tr style={{ backgroundColor: '#f8fafc', fontWeight: '700', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                                      <th style={{ padding: '0.5rem 0.75rem' }}>Colour</th>
                                                      <th style={{ padding: '0.5rem 0.75rem' }}>Yarn Count</th>
                                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Yarn Sent (kg)</th>
                                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Yarn Returned (kg)</th>
                                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Planned Allocation (kg)</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {(!wof.yarn_returns || wof.yarn_returns.length === 0) ? (
                                                      (!wof.colour_allotments || wof.colour_allotments.length === 0) ? (
                                                        <tr>
                                                          <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                                            No yarn allocations recorded.
                                                          </td>
                                                        </tr>
                                                      ) : (
                                                        wof.colour_allotments.map((a, idx) => {
                                                          const matchingDydr = wof.associatedDydrs?.filter(dItem => dItem.colour === a.colour);
                                                          const deliveredQty = matchingDydr?.reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0) || 0;
                                                          const yc = yarnCounts.find(y => y.id === a.countId);
                                                          const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type || ''}`.trim() : (a.countValue || '—');
                                                          return (
                                                            <tr key={idx} style={{ borderBottom: idx < wof.colour_allotments.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                                                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{a.colour || '—'}</td>
                                                              <td style={{ padding: '0.5rem 0.75rem' }}>{countDisplay}</td>
                                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{Number(deliveredQty).toFixed(2)}</td>
                                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--text-muted-current)' }}>0.00</td>
                                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#800000' }}>{Number(a.allotted_qty || 0).toFixed(2)}</td>
                                                            </tr>
                                                          );
                                                        })
                                                      )
                                                    ) : (
                                                      wof.yarn_returns.map((ret, idx) => {
                                                        const allot = wof.colour_allotments?.find(a => a.colour === ret.colour);
                                                        return (
                                                          <tr key={idx} style={{ borderBottom: idx < wof.yarn_returns.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{ret.colour || '—'}</td>
                                                            <td style={{ padding: '0.5rem 0.75rem' }}>{ret.count_display || '—'}</td>
                                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{Number(ret.quantity_received).toFixed(2)}</td>
                                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#b91c1c' }}>{Number(ret.quantity_returned).toFixed(2)}</td>
                                                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700', color: '#800000' }}>
                                                              {allot ? Number(allot.allotted_qty || 0).toFixed(2) : '—'}
                                                            </td>
                                                          </tr>
                                                        );
                                                      })
                                                    )}
                                                  </tbody>
                                                </table>
                                              </div>

                                              {/* Associated DYDRs */}
                                              <div>
                                                <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-main-current)', letterSpacing: '0.5px' }}>
                                                  Associated Dyed Yarn Delivery Receipts (DYDR)
                                                </h5>
                                                {(!wof.associatedDydrs || wof.associatedDydrs.length === 0) ? (
                                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', backgroundColor: '#f8fafc', border: '1px dashed var(--border-current)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', fontStyle: 'italic' }}>
                                                    No dyed yarn delivery receipts found for this warping order.
                                                  </div>
                                                ) : (
                                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
                                                    {Array.from(new Set(wof.associatedDydrs.map(d => d.delivery?.dydr_number))).map(dydrNo => {
                                                      const matchingItems = wof.associatedDydrs.filter(d => d.delivery?.dydr_number === dydrNo);
                                                      const firstItem = matchingItems[0];
                                                      if (!firstItem) return null;
                                                      const totalDelivered = matchingItems.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);
                                                      return (
                                                        <div key={dydrNo} style={{ padding: '0.6rem 0.8rem', backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.01)' }}>
                                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                                            <span style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace' }}>{dydrNo}</span>
                                                            <span style={{ fontWeight: '700', color: '#047857' }}>{totalDelivered.toFixed(2)} kg</span>
                                                          </div>
                                                          <div style={{ color: 'var(--text-muted-current)', fontSize: '0.68rem', display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>Date: {firstItem.delivery?.delivered_date ? new Date(firstItem.delivery.delivered_date).toLocaleDateString() : '—'}</span>
                                                            <span>DC: {firstItem.delivery?.remarks || '—'}</span>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>

                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )
                              )}

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
      </div>

      {/* Mobile view */}
      <div className="mobile-view">
        {filteredBills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)', backgroundColor: 'var(--surface-current)', borderRadius: '8px', border: '1px solid var(--border-current)', fontSize: '0.8rem' }}>
            No bills found for the selected filter.
          </div>
        ) : (
          filteredBills.map(bill => {
            const isExpanded = expandedId === bill.id;
            const badge = getStatusBadge(bill.status);
            const { updatedItems, calculatedTotal, isInvalid } = getBillData(bill);
            const wofNumbers = (bill.bill_items || []).map(item => item.form_number || item.wof_number).filter(Boolean).join(', ');
            const orderNumbers = Array.from(new Set((bill.bill_items || []).map(item => item.order_number).filter(Boolean))).join(', ');
            const designs = Array.from(new Set((bill.bill_items || []).map(item => `${item.design_no || ''} ${item.design_name || ''}`.trim()).filter(Boolean))).join(', ');

            return (
              <div key={bill.id} className="mobile-card" style={{ borderLeft: isExpanded ? '3px solid var(--color-primary)' : '1px solid var(--border-current)', padding: '0.85rem' }}>
                <div className="mobile-card-header" onClick={() => toggleExpandBill(bill)} style={{ cursor: 'pointer', borderBottom: 'none', paddingBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{bill.bill_number}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                      {bill.invoice_date || new Date(bill.created_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    backgroundColor: badge.bg, color: badge.text,
                    padding: '2px 6px', borderRadius: '4px',
                    fontSize: '0.65rem', fontWeight: '700'
                  }}>
                    {badge.icon} {badge.label}
                  </span>
                </div>

                <div className="mobile-card-body" onClick={() => toggleExpandBill(bill)} style={{ cursor: 'pointer', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Partner:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem', fontWeight: '600' }}>{bill.partner_name}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>WOF Numbers:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{wofNumbers || '—'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Order Numbers:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem' }}>{orderNumbers || '—'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Designs:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem' }}>{designs || '—'}</span>
                  </div>
                  <div className="mobile-card-row" style={{ borderTop: '1px dashed var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Calculated Subtotal:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.75rem', fontWeight: '800' }}>₹{Number(calculatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Invoice Total:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--color-primary)' }}>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="mobile-card-actions" style={{ marginTop: '0.6rem', paddingTop: '0.6rem' }}>
                  <button
                    onClick={() => toggleExpandBill(bill)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Eye size={12} /> {isExpanded ? 'Hide' : 'Review'}
                  </button>
                  {bill.status === 'awaiting_approval' && (
                    <>
                      <button
                        onClick={() => handleApprove(bill)}
                        disabled={submittingId === bill.id || isInvalid}
                        style={{
                          backgroundColor: isInvalid ? '#cbd5e1' : '#dcfce7',
                          color: isInvalid ? '#64748b' : '#166534',
                          border: '1px solid ' + (isInvalid ? '#cbd5e1' : '#86efac'),
                          padding: '4px 8px', borderRadius: '4px',
                          fontSize: '0.7rem', fontWeight: '700',
                          cursor: isInvalid ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(bill)}
                        disabled={submittingId === bill.id}
                        style={{
                          backgroundColor: '#fee2e2', color: '#991b1b',
                          border: '1px solid #fca5a5',
                          padding: '4px 8px', borderRadius: '4px',
                          fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer'
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-current)', paddingTop: '0.75rem' }}>
                    {/* Expandable Tabs */}
                    <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-current)', marginBottom: '0.75rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      {[
                        { key: 'rates', label: '📊 Rates & Invoicing' },
                        { key: 'wof', label: '📄 WOF Details' }
                      ].map(tab => {
                        const isActive = (activeTabs[bill.id] || 'rates') === tab.key;
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTabs(prev => ({ ...prev, [bill.id]: tab.key }))}
                            style={{
                              padding: '0.5rem 0.75rem',
                              border: 'none',
                              borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                              backgroundColor: 'transparent',
                              color: isActive ? 'var(--color-primary)' : 'var(--text-muted-current)',
                              fontWeight: isActive ? '800' : '600',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              marginBottom: '-1px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Tab 1: Rates */}
                    {(activeTabs[bill.id] || 'rates') === 'rates' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div className="mobile-sub-list" style={{ margin: 0, padding: '0.5rem', gap: '0.6rem' }}>
                          {(bill.bill_items || []).map((item, idx) => {
                            const editedRatesForBill = editedRates[bill.id] || {};
                            const currentRate = editedRatesForBill[item.form_id] !== undefined ? editedRatesForBill[item.form_id] : (item.rate_per_meter || '');
                            const rateFloat = parseFloat(currentRate) || 0;
                            const rowTotal = item.actual_qty * rateFloat;

                            return (
                              <div key={idx} className="mobile-sub-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                  <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{item.form_number}</span>
                                  <span style={{
                                    backgroundColor: '#dcfce7', color: '#166534',
                                    padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '700'
                                  }}>{item.status || 'completed'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>
                                  <span>Order: {item.order_number}</span>
                                  <span>Design: {item.design_name}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                  <span>Qty: {Number(item.actual_qty).toLocaleString()} m</span>
                                  <span>Timeliness: <strong style={{ color: item.timeliness_status === 'late' ? '#b91c1c' : '#047857' }}>{item.timeliness_status === 'late' ? 'LATE' : 'ON TIME'}</strong></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: '600' }}>Rate/Meter:</span>
                                  {bill.status === 'awaiting_approval' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <span>₹</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={currentRate}
                                        onChange={e => handleRateChange(bill.id, item.form_id, e.target.value)}
                                        style={{
                                          width: '80px', padding: '0.3rem 0.5rem',
                                          border: '1px solid var(--border-current)', borderRadius: '4px',
                                          fontSize: '0.78rem', textAlign: 'right', fontWeight: '700',
                                          height: '32px'
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <strong>₹{parseFloat(item.rate_per_meter || 0).toFixed(2)}</strong>
                                  )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', borderTop: '1px dashed var(--border-current)', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                                  <span>Row Total:</span>
                                  <span style={{ color: 'var(--color-primary)' }}>₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Remarks & Warnings */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>Admin Approval Notes / Remarks</label>
                          <textarea
                            placeholder={bill.status === 'awaiting_approval' ? "Explain approval rates adjustment or rejection reason..." : "No notes."}
                            value={adminNotes[bill.id] !== undefined ? adminNotes[bill.id] : (bill.admin_notes || '')}
                            onChange={e => handleNotesChange(bill.id, e.target.value)}
                            disabled={bill.status !== 'awaiting_approval'}
                            style={{
                              width: '100%', height: '55px', padding: '0.5rem',
                              border: '1px solid var(--border-current)', borderRadius: '6px',
                              fontSize: '0.75rem', resize: 'none'
                            }}
                          />
                        </div>

                        {/* Total Summary */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', border: '1px solid var(--border-current)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Calculated Subtotal:</span><strong>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice Subtotal:</span><strong>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax Amount:</span><strong>₹{Number(bill.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem', color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: '800' }}>
                            <span>Invoice Total:</span>
                            <span>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {isInvalid && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.5rem 0.75rem', borderRadius: '6px', color: '#991b1b', fontSize: '0.7rem', fontWeight: '600' }}>
                            <AlertCircle size={13} style={{ flexShrink: 0 }} />
                            <span>Calculated subtotal (₹{calculatedTotal.toFixed(2)}) is less than invoice subtotal (₹{Number(bill.invoice_subtotal).toFixed(2)}). Approval disabled.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: WOF */}
                    {(activeTabs[bill.id] || 'rates') === 'wof' && (
                      loadingWofs[bill.id] ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '0.4rem' }}>
                          <Loader size={18} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>Loading WOF data...</span>
                        </div>
                      ) : !expandedWofsData[bill.id] || expandedWofsData[bill.id].length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                          No Warping Order Forms associated.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {expandedWofsData[bill.id].map(wof => {
                            const isWofExpanded = expandedWofIdMap[bill.id] === wof.id;
                            return (
                              <div key={wof.id} style={{ border: '1px solid var(--border-current)', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'white' }}>
                                <div
                                  onClick={() => setExpandedWofIdMap(prev => ({ ...prev, [bill.id]: isWofExpanded ? null : wof.id }))}
                                  style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  <span style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                                    {isWofExpanded ? '▼' : '▶'} {wof.wof_number}
                                  </span>
                                  <span style={{ fontWeight: '700' }}>{Number(wof.qty).toLocaleString()} m</span>
                                </div>
                                {isWofExpanded && (
                                  <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.72rem' }}>
                                    <div>Order No: <strong style={{ color: 'var(--color-primary)' }}>{wof.order?.order_number || '—'}</strong></div>
                                    <div>Design: <strong>{wof.order?.design_name || '—'}</strong> ({wof.order?.design_no || '—'})</div>
                                    <div>Status: <span style={{ backgroundColor: wof.status === 'completed' ? '#dcfce7' : '#fef3c7', color: wof.status === 'completed' ? '#166534' : '#92400e', padding: '1px 6px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: '800' }}>{wof.status}</span></div>
                                    {wof.wofdc_number && <div>WOFDC: <strong style={{ fontFamily: 'monospace' }}>{wof.wofdc_number}</strong></div>}

                                    {/* Yarn Allocations */}
                                    <div style={{ borderTop: '1px solid var(--border-current)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                      <div style={{ fontWeight: '800', marginBottom: '0.3rem', textTransform: 'uppercase', fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>Yarn Allocations</div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '4px' }}>
                                        {(!wof.yarn_returns || wof.yarn_returns.length === 0) ? (
                                          (!wof.colour_allotments || wof.colour_allotments.length === 0) ? (
                                            <div style={{ fontStyle: 'italic', color: 'var(--text-muted-current)' }}>No allocations recorded.</div>
                                          ) : (
                                            wof.colour_allotments.map((a, idx) => {
                                              const matchingDydr = wof.associatedDydrs?.filter(dItem => dItem.colour === a.colour);
                                              const deliveredQty = matchingDydr?.reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0) || 0;
                                              const yc = yarnCounts.find(y => y.id === a.countId);
                                              const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type || ''}`.trim() : (a.countValue || '—');
                                              return (
                                                <div key={idx} style={{ borderBottom: idx < wof.colour_allotments.length - 1 ? '1px dashed var(--border-current)' : 'none', paddingBottom: idx < wof.colour_allotments.length - 1 ? '0.3rem' : 0 }}>
                                                  <div style={{ fontWeight: '600' }}>{a.colour || '—'} ({countDisplay})</div>
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                                    <span>Delivered: <strong>{Number(deliveredQty).toFixed(2)} kg</strong></span>
                                                    <span>Planned: <strong>{Number(a.allotted_qty || 0).toFixed(2)} kg</strong></span>
                                                  </div>
                                                </div>
                                              );
                                            })
                                          )
                                        ) : (
                                          wof.yarn_returns.map((ret, idx) => {
                                            const allot = wof.colour_allotments?.find(a => a.colour === ret.colour);
                                            return (
                                              <div key={idx} style={{ borderBottom: idx < wof.yarn_returns.length - 1 ? '1px dashed var(--border-current)' : 'none', paddingBottom: idx < wof.yarn_returns.length - 1 ? '0.3rem' : 0 }}>
                                                <div style={{ fontWeight: '600' }}>{ret.colour || '—'} ({ret.count_display || '—'})</div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                                  <span>Delivered: <strong style={{ color: '#047857' }}>{Number(ret.quantity_received).toFixed(2)} kg</strong></span>
                                                  <span>Returned: <strong style={{ color: '#b91c1c' }}>{Number(ret.quantity_returned).toFixed(2)} kg</strong></span>
                                                  <span>Planned: <strong>{allot ? Number(allot.allotted_qty || 0).toFixed(2) : '—'} kg</strong></span>
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>

                                    {/* Associated DYDRs */}
                                    <div style={{ borderTop: '1px solid var(--border-current)', paddingTop: '0.5rem' }}>
                                      <div style={{ fontWeight: '800', marginBottom: '0.3rem', textTransform: 'uppercase', fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>Associated DYDR Receipts</div>
                                      {(!wof.associatedDydrs || wof.associatedDydrs.length === 0) ? (
                                        <div style={{ fontStyle: 'italic', color: 'var(--text-muted-current)' }}>No dyed yarn delivery receipts found.</div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                          {Array.from(new Set(wof.associatedDydrs.map(d => d.delivery?.dydr_number))).map(dydrNo => {
                                            const matchingItems = wof.associatedDydrs.filter(d => d.delivery?.dydr_number === dydrNo);
                                            const firstItem = matchingItems[0];
                                            if (!firstItem) return null;
                                            const totalDelivered = matchingItems.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);
                                            return (
                                              <div key={dydrNo} style={{ padding: '0.4rem 0.5rem', backgroundColor: '#f8fafc', border: '1px solid var(--border-current)', borderRadius: '4px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                                                  <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{dydrNo}</span>
                                                  <span style={{ color: '#047857' }}>{totalDelivered.toFixed(2)} kg</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                                  <span>Date: {firstItem.delivery?.delivered_date ? new Date(firstItem.delivery.delivered_date).toLocaleDateString() : '—'}</span>
                                                  <span>DC: {firstItem.delivery?.remarks || '—'}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Sizing Bill Approvals ─────────────────────────────────────────
function SizingBillApprovals({ adminProfile }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('awaiting_approval');
  const [expandedId, setExpandedId] = useState(null);

  // Rate edits state: { [billId]: { [formId]: newRateString } }
  const [editedRates, setEditedRates] = useState({});
  const [adminNotes, setAdminNotes] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  // Tabs and SOF expanded details state
  const [expandedSofsData, setExpandedSofsData] = useState({});
  const [loadingSofs, setLoadingSofs] = useState({});
  const [activeTabs, setActiveTabs] = useState({});
  const [expandedSofIdMap, setExpandedSofIdMap] = useState({});

  const fetchBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_finance_bills')
        .select('*')
        .eq('form_type', 'sizing')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const loadSofDetailsForBill = async (bill) => {
    if (expandedSofsData[bill.id]) return;
    setLoadingSofs(prev => ({ ...prev, [bill.id]: true }));
    try {
      const selectedFormIds = bill.selected_form_ids || [];
      if (selectedFormIds.length === 0) {
        setExpandedSofsData(prev => ({ ...prev, [bill.id]: [] }));
        return;
      }

      // Fetch SOFs
      const { data: sofs, error: sofError } = await supabase
        .from('sizing_order_forms')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name)
        `)
        .in('id', selectedFormIds);

      if (sofError) throw sofError;

      setExpandedSofsData(prev => ({ ...prev, [bill.id]: sofs || [] }));
    } catch (err) {
      console.error('Error fetching SOF details for bill:', err);
    } finally {
      setLoadingSofs(prev => ({ ...prev, [bill.id]: false }));
    }
  };

  const toggleExpandBill = (bill) => {
    const isExpanding = expandedId !== bill.id;
    setExpandedId(isExpanding ? bill.id : null);
    if (isExpanding) {
      loadSofDetailsForBill(bill);
    }
  };

  const handleRateChange = (billId, formId, val) => {
    setEditedRates(prev => ({
      ...prev,
      [billId]: {
        ...(prev[billId] || {}),
        [formId]: val
      }
    }));
  };

  const handleNotesChange = (billId, val) => {
    setAdminNotes(prev => ({
      ...prev,
      [billId]: val
    }));
  };

  const getBillData = (bill) => {
    // Get live edited items and totals
    const billEdits = editedRates[bill.id] || {};
    let calculatedTotal = 0;
    const updatedItems = (bill.bill_items || []).map(item => {
      const editedRate = billEdits[item.form_id];
      const rate = editedRate !== undefined ? parseFloat(editedRate) || 0 : item.rate_per_meter || 0;
      const total = item.actual_qty * rate;
      calculatedTotal += total;
      return {
        ...item,
        rate_per_meter: rate,
        calculated_total: total
      };
    });

    const isInvalid = calculatedTotal < bill.invoice_subtotal;
    return { updatedItems, calculatedTotal, isInvalid };
  };

  const handleApprove = async (bill) => {
    const { updatedItems, calculatedTotal, isInvalid } = getBillData(bill);
    if (isInvalid) {
      alert("Cannot approve: The updated calculated total is less than the partner's invoice subtotal.");
      return;
    }

    if (!window.confirm(`Approve sizing bill ${bill.bill_number}?`)) return;

    setSubmittingId(bill.id);
    try {
      const { error } = await supabase
        .from('production_finance_bills')
        .update({
          status: 'approved',
          bill_items: updatedItems,
          calculated_total: calculatedTotal,
          admin_notes: adminNotes[bill.id] || bill.admin_notes,
          approved_by: adminProfile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (error) throw error;
      alert('Bill approved successfully!');
      fetchBills();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReject = async (bill) => {
    const notes = adminNotes[bill.id]?.trim() || bill.admin_notes;
    if (!notes) {
      alert('Please enter a note/remarks explaining why the bill is rejected.');
      return;
    }

    if (!window.confirm(`Reject sizing bill ${bill.bill_number}?`)) return;

    setSubmittingId(bill.id);
    try {
      const { error } = await supabase
        .from('production_finance_bills')
        .update({
          status: 'rejected',
          admin_notes: notes,
          approved_by: adminProfile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (error) throw error;
      alert('Bill rejected.');
      fetchBills();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'awaiting_approval':
        return { bg: '#fef3c7', text: '#92400e', label: 'AWAITING APPROVAL', icon: <Clock size={12} /> };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', label: 'APPROVED', icon: <CheckCircle size={12} /> };
      case 'settled':
        return { bg: '#dbeafe', text: '#1e40af', label: 'SETTLED', icon: <CheckCircle size={12} /> };
      case 'rejected':
        return { bg: '#fee2e2', text: '#991b1b', label: 'REJECTED', icon: <XCircle size={12} /> };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: (status || '').toUpperCase() };
    }
  };

  const filteredBills = bills.filter(b => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

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
          { key: 'all', label: 'All Bills', count: bills.length },
          { key: 'awaiting_approval', label: 'Awaiting Approval', count: bills.filter(b => b.status === 'awaiting_approval').length },
          { key: 'approved', label: 'Approved / Settled', count: bills.filter(b => b.status === 'approved' || b.status === 'settled').length },
          { key: 'rejected', label: 'Rejected', count: bills.filter(b => b.status === 'rejected').length }
        ].map(pill => (
          <button
            key={pill.key}
            onClick={() => setStatusFilter(pill.key)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              border: '1px solid ' + (statusFilter === pill.key ? 'var(--color-primary)' : 'var(--border-current)'),
              backgroundColor: statusFilter === pill.key ? 'var(--color-primary)' : 'white',
              color: statusFilter === pill.key ? 'white' : 'var(--text-main-current)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {pill.label}
            <span style={{
              backgroundColor: statusFilter === pill.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-current)',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.7rem'
            }}>
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      {/* Bills Table */}
      <div className="desktop-view">
        <div className="glass-panel" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table" style={{ tableLayout: 'auto', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }} />
                <th>Date</th>
                <th>Bill Number</th>
                <th>Partner</th>
                <th>SOF Numbers</th>
                <th>Order Numbers</th>
                <th>Designs</th>
                <th style={{ textAlign: 'right' }}>Calculated Subtotal</th>
                <th style={{ textAlign: 'right' }}>Invoice Subtotal</th>
                <th style={{ textAlign: 'right' }}>Tax Amount</th>
                <th style={{ textAlign: 'right' }}>Invoice Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                    No bills found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => {
                  const isExpanded = expandedId === bill.id;
                  const badge = getStatusBadge(bill.status);
                  const { calculatedTotal, isInvalid } = getBillData(bill);
                  const sofNumbers = (bill.bill_items || []).map(item => item.form_number || item.sof_number).filter(Boolean).join(', ');
                  const orderNumbers = Array.from(new Set((bill.bill_items || []).map(item => item.order_number).filter(Boolean))).join(', ');
                  const designs = Array.from(new Set((bill.bill_items || []).map(item => `${item.design_no || ''} ${item.design_name || ''}`.trim()).filter(Boolean))).join(', ');

                  return (
                    <React.Fragment key={bill.id}>
                      <tr onClick={() => toggleExpandBill(bill)} style={{ cursor: 'pointer' }}>
                        <td style={{ textAlign: 'center' }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td style={{ fontWeight: '500', fontSize: '0.75rem' }}>{bill.invoice_date || new Date(bill.created_at).toLocaleDateString('en-IN')}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{bill.bill_number}</td>
                        <td style={{ fontWeight: '500', fontSize: '0.75rem' }}>{bill.partner_name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{sofNumbers || '—'}</td>
                        <td style={{ fontSize: '0.72rem' }}>{orderNumbers || '—'}</td>
                        <td style={{ fontSize: '0.72rem' }}>{designs || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.75rem' }}>₹{Number(calculatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.75rem' }}>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted-current)', fontSize: '0.75rem' }}>₹{Number(bill.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '0.75rem' }}>
                          ₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            backgroundColor: badge.bg, color: badge.text,
                            padding: '2px 6px', borderRadius: '4px',
                            fontSize: '0.7rem', fontWeight: '700'
                          }}>
                            {badge.icon} {badge.label}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => toggleExpandBill(bill)}
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', fontSize: '0.7rem' }}
                            >
                              <Eye size={11} /> {isExpanded ? 'Hide' : 'Review'}
                            </button>
                            {bill.status === 'awaiting_approval' && (
                              <>
                                <button
                                  onClick={() => handleApprove(bill)}
                                  disabled={submittingId === bill.id || isInvalid}
                                  style={{
                                    backgroundColor: isInvalid ? '#cbd5e1' : '#dcfce7',
                                    color: isInvalid ? '#64748b' : '#166534',
                                    border: '1px solid ' + (isInvalid ? '#cbd5e1' : '#86efac'),
                                    padding: '3px 6px', borderRadius: '4px',
                                    fontSize: '0.7rem', fontWeight: '700',
                                    cursor: isInvalid ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(bill)}
                                  disabled={submittingId === bill.id}
                                  style={{
                                    backgroundColor: '#fee2e2', color: '#991b1b',
                                    border: '1px solid #fca5a5',
                                    padding: '3px 6px', borderRadius: '4px',
                                    fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={13} style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderLeft: '3px solid var(--color-primary)' }}>

                            {/* Expandable Tabs */}
                            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-current)', marginBottom: '1.25rem' }}>
                              {[
                                { key: 'rates', label: '📊 Rates & Invoicing' },
                                { key: 'sof', label: '📄 Sizing Order Forms (SOF)' }
                              ].map(tab => {
                                const isActive = (activeTabs[bill.id] || 'rates') === tab.key;
                                return (
                                  <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTabs(prev => ({ ...prev, [bill.id]: tab.key }))}
                                    style={{
                                      padding: '0.6rem 1.25rem',
                                      border: 'none',
                                      borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                                      backgroundColor: 'transparent',
                                      color: isActive ? 'var(--color-primary)' : 'var(--text-muted-current)',
                                      fontWeight: isActive ? '800' : '600',
                                      fontSize: '0.8rem',
                                      cursor: 'pointer',
                                      marginBottom: '-1px',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {tab.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Tab 1: Rates & Invoicing */}
                            {(activeTabs[bill.id] || 'rates') === 'rates' && (
                              <>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', backgroundColor: '#fff', border: '1px solid var(--border-current)', marginBottom: '1rem' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700' }}>
                                      <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>SOF Number</th>
                                      <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Order Number</th>
                                      <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Design Name</th>
                                      <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>SOF Status</th>
                                      <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Actual Dates</th>
                                      <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Timeliness</th>
                                      <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Qty (m)</th>
                                      <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center', width: '160px' }}>Rate / Meter (₹)</th>
                                      <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right', width: '120px' }}>Total Price</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(bill.bill_items || []).map((item, idx) => {
                                      const editedRatesForBill = editedRates[bill.id] || {};
                                      const currentRate = editedRatesForBill[item.form_id] !== undefined ? editedRatesForBill[item.form_id] : (item.rate_per_meter || '');
                                      const rateFloat = parseFloat(currentRate) || 0;
                                      const rowTotal = item.actual_qty * rateFloat;

                                      return (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                          <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace' }}>{item.form_number}</td>
                                          <td style={{ padding: '0.5rem' }}>{item.order_number}</td>
                                          <td style={{ padding: '0.5rem' }}>{item.design_name}</td>
                                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                            <span style={{
                                              backgroundColor: '#dcfce7',
                                              color: '#166534',
                                              padding: '2px 6px',
                                              borderRadius: '10px',
                                              fontSize: '0.65rem',
                                              fontWeight: '700',
                                              textTransform: 'uppercase'
                                            }}>
                                              {item.status || 'completed'}
                                            </span>
                                          </td>
                                          <td style={{ padding: '0.5rem', fontSize: '0.7rem' }}>
                                            {item.actual_start_date ? new Date(item.actual_start_date).toLocaleDateString('en-GB') : '—'} to {item.actual_end_date ? new Date(item.actual_end_date).toLocaleDateString('en-GB') : '—'}
                                          </td>
                                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                            <span style={{
                                              backgroundColor: item.timeliness_status === 'late' ? '#fee2e2' : '#dcfce7',
                                              color: item.timeliness_status === 'late' ? '#991b1b' : '#166534',
                                              padding: '1px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '700'
                                            }}>
                                              {item.timeliness_status === 'late' ? 'LATE' : 'ON TIME'}
                                            </span>
                                          </td>
                                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(item.actual_qty).toLocaleString()}</td>
                                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                            {bill.status === 'awaiting_approval' ? (
                                              <input
                                                type="number"
                                                step="0.01"
                                                value={currentRate}
                                                onChange={e => handleRateChange(bill.id, item.form_id, e.target.value)}
                                                style={{
                                                  width: '100%', padding: '0.25rem 0.5rem',
                                                  border: '1px solid var(--border-current)', borderRadius: '4px',
                                                  fontSize: '0.75rem', textAlign: 'center'
                                                }}
                                              />
                                            ) : (
                                              `₹${parseFloat(item.rate_per_meter || 0).toFixed(2)}`
                                            )}
                                          </td>
                                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                      );
                                    })}
                                    <tr style={{ backgroundColor: 'rgba(0,0,0,0.01)', fontWeight: '800' }}>
                                      <td colSpan={6} style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Calculated Subtotal:</td>
                                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                                        {(bill.bill_items || []).reduce((sum, item) => sum + (parseFloat(item.actual_qty) || 0), 0).toLocaleString()}
                                      </td>
                                      <td />
                                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: 'var(--color-primary)' }}>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                  </tbody>
                                </table>

                                {/* Remarks & Warnings */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'start' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: '700', color: '#475569' }}>Admin Approval Notes / Remarks</label>
                                    <textarea
                                      placeholder={bill.status === 'awaiting_approval' ? "Explain approval rates adjustment or rejection reason..." : "No notes."}
                                      value={adminNotes[bill.id] !== undefined ? adminNotes[bill.id] : (bill.admin_notes || '')}
                                      onChange={e => handleNotesChange(bill.id, e.target.value)}
                                      disabled={bill.status !== 'awaiting_approval'}
                                      style={{
                                        width: '100%', height: '60px', padding: '0.5rem',
                                        border: '1px solid var(--border-current)', borderRadius: '6px',
                                        fontSize: '0.75rem', resize: 'none'
                                      }}
                                    />
                                  </div>

                                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div>Invoice Subtotal: <strong>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                    <div>Tax Amount: <strong>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: '800' }}>Invoice Total: ₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                  </div>
                                </div>

                                {isInvalid && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.6rem 0.8rem', borderRadius: '6px', color: '#991b1b', fontSize: '0.72rem', fontWeight: '600', marginTop: '0.75rem' }}>
                                    <AlertCircle size={14} /> Warning: The updated calculated total (₹{calculatedTotal.toFixed(2)}) is less than the partner's invoice subtotal (₹{Number(bill.invoice_subtotal).toFixed(2)}). Approval is disabled.
                                  </div>
                                )}
                              </>
                            )}

                            {/* Tab 2: Sizing Order Forms (SOF) */}
                            {(activeTabs[bill.id] || 'rates') === 'sof' && (
                              loadingSofs[bill.id] ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.5rem' }}>
                                  <Loader size={22} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>Loading Sizing Order Forms data...</span>
                                </div>
                              ) : !expandedSofsData[bill.id] || expandedSofsData[bill.id].length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic', backgroundColor: 'white', border: '1px dashed var(--border-current)', borderRadius: '8px' }}>
                                  No Sizing Order Forms associated with this bill.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  {expandedSofsData[bill.id].map(sof => {
                                    const isSofExpanded = expandedSofIdMap[bill.id] === sof.id;
                                    const typeLabel = sof.sizing_type === 'in_house' ? 'In-House' : 'Job Work';
                                    const timeDiffStr = (started, ended) => {
                                      if (!started || !ended) return '—';
                                      return `${new Date(started).toLocaleDateString('en-GB')} to ${new Date(ended).toLocaleDateString('en-GB')}`;
                                    };

                                    return (
                                      <div key={sof.id} style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                                        {/* SOF Expandable Header */}
                                        <div
                                          onClick={() => setExpandedSofIdMap(prev => ({ ...prev, [bill.id]: isSofExpanded ? null : sof.id }))}
                                          style={{
                                            padding: '0.75rem 1rem',
                                            backgroundColor: '#f8fafc',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            borderBottom: isSofExpanded ? '1px solid var(--border-current)' : 'none',
                                            transition: 'background-color 0.15s ease'
                                          }}
                                        >
                                          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <div style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                              {isSofExpanded ? '▼' : '▶'} {sof.sof_number}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-main-current)' }}>
                                              Order No: <strong style={{ color: 'var(--color-primary)' }}>{sof.order?.order_number || '—'}</strong>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-main-current)' }}>
                                              Design: <strong>{sof.order?.design_name || '—'}</strong> ({sof.order?.design_no || '—'})
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-main-current)' }}>
                                              Qty: <strong>{Number(sof.qty).toLocaleString()} Mtrs</strong>
                                            </div>
                                            <div>
                                              <span style={{
                                                backgroundColor: sof.status === 'completed' ? '#dcfce7' : '#fef3c7',
                                                color: sof.status === 'completed' ? '#166534' : '#92400e',
                                                padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase'
                                              }}>
                                                {sof.status}
                                              </span>
                                            </div>
                                          </div>
                                          {sof.sofdc_number && (
                                            <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0284c7', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                              <span>📄 SOFDC:</span>
                                              <span style={{ fontFamily: 'monospace' }}>{sof.sofdc_number}</span>
                                            </div>
                                          )}
                                        </div>

                                        {/* SOF Expandable Content */}
                                        {isSofExpanded && (
                                          <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                                            {/* Sizing Details Grid */}
                                            <div>
                                              <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-main-current)', letterSpacing: '0.5px' }}>
                                                Sizing Order Details
                                              </h5>
                                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.75rem', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid var(--border-current)' }}>
                                                <div>Sizing Type: <strong>{typeLabel}</strong></div>
                                                <div>Sizing Quantity: <strong>{Number(sof.qty).toLocaleString()} Mtrs</strong></div>
                                                <div>Sizing Machine / Partner: <strong>{sof.sizing_type === 'in_house' ? (sof.machine_name || 'In-House Sizing Machine') : `${sof.partner_name || '—'} (${sof.machine_name || '—'})`}</strong></div>
                                                <div>Beam Number: <strong>{sof.beam_name || '—'}</strong></div>
                                                <div>Sizer Name: <strong>{sof.sizer_name || '—'}</strong></div>
                                                <div>Planned Dates: <strong>{timeDiffStr(sof.start_date, sof.end_date)}</strong></div>
                                                <div>Actual Dates: <strong>{timeDiffStr(sof.process_started_at, sof.process_completed_at)}</strong></div>
                                                <div>Status: <strong style={{ textTransform: 'uppercase', color: sof.status === 'completed' ? '#166534' : 'inherit' }}>{sof.status}</strong></div>
                                              </div>
                                            </div>

                                            {/* Weaving Splits Configuration */}
                                            <div>
                                              <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-main-current)', letterSpacing: '0.5px' }}>
                                                Weaving / Warp Split Details
                                              </h5>
                                              {(!sof.weaving_splits || sof.weaving_splits.length === 0) ? (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', backgroundColor: '#f8fafc', border: '1px dashed var(--border-current)', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', fontStyle: 'italic' }}>
                                                  No weaving splits configured for this sizing order.
                                                </div>
                                              ) : (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '6px', overflow: 'hidden' }}>
                                                  <thead>
                                                    <tr style={{ backgroundColor: '#f8fafc', fontWeight: '700', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                                      <th style={{ padding: '0.5rem 0.75rem' }}>Weaving Split Ref</th>
                                                      <th style={{ padding: '0.5rem 0.75rem' }}>Beam Number</th>
                                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Quantity (Mtrs)</th>
                                                      <th style={{ padding: '0.5rem 0.75rem', paddingLeft: '20px' }}>Planned Timeline</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {sof.weaving_splits.map((split, idx) => (
                                                      <tr key={idx} style={{ borderBottom: idx < sof.weaving_splits.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', fontFamily: 'monospace' }}>{split.split_no}</td>
                                                        <td style={{ padding: '0.5rem 0.75rem' }}>{sof.beam_name || '—'}</td>
                                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{Number(split.qty).toLocaleString()} m</td>
                                                        <td style={{ padding: '0.5rem 0.75rem', paddingLeft: '20px', color: 'var(--text-muted-current)' }}>{split.start_date || '—'} to {split.end_date || '—'}</td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              )}
                                            </div>

                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )
                            )}

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
      </div>

      {/* Mobile view */}
      <div className="mobile-view">
        {filteredBills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)', backgroundColor: 'var(--surface-current)', borderRadius: '8px', border: '1px solid var(--border-current)', fontSize: '0.8rem' }}>
            No bills found for the selected filter.
          </div>
        ) : (
          filteredBills.map(bill => {
            const isExpanded = expandedId === bill.id;
            const badge = getStatusBadge(bill.status);
            const { calculatedTotal, isInvalid } = getBillData(bill);
            const sofNumbers = (bill.bill_items || []).map(item => item.form_number || item.sof_number).filter(Boolean).join(', ');
            const orderNumbers = Array.from(new Set((bill.bill_items || []).map(item => item.order_number).filter(Boolean))).join(', ');
            const designs = Array.from(new Set((bill.bill_items || []).map(item => `${item.design_no || ''} ${item.design_name || ''}`.trim()).filter(Boolean))).join(', ');

            return (
              <div key={bill.id} className="mobile-card" style={{ borderLeft: isExpanded ? '3px solid var(--color-primary)' : '1px solid var(--border-current)', padding: '0.85rem' }}>
                <div className="mobile-card-header" onClick={() => toggleExpandBill(bill)} style={{ cursor: 'pointer', borderBottom: 'none', paddingBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{bill.bill_number}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                      {bill.invoice_date || new Date(bill.created_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    backgroundColor: badge.bg, color: badge.text,
                    padding: '2px 6px', borderRadius: '4px',
                    fontSize: '0.65rem', fontWeight: '700'
                  }}>
                    {badge.icon} {badge.label}
                  </span>
                </div>

                <div className="mobile-card-body" onClick={() => toggleExpandBill(bill)} style={{ cursor: 'pointer', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Partner:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem', fontWeight: '600' }}>{bill.partner_name}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>SOF Numbers:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{sofNumbers || '—'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Order Numbers:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem' }}>{orderNumbers || '—'}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Designs:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem' }}>{designs || '—'}</span>
                  </div>
                  <div className="mobile-card-row" style={{ borderTop: '1px dashed var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Calculated Subtotal:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.75rem', fontWeight: '800' }}>₹{Number(calculatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Invoice Total:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--color-primary)' }}>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="mobile-card-actions" style={{ marginTop: '0.6rem', paddingTop: '0.6rem' }}>
                  <button
                    onClick={() => toggleExpandBill(bill)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Eye size={12} /> {isExpanded ? 'Hide' : 'Review'}
                  </button>
                  {bill.status === 'awaiting_approval' && (
                    <>
                      <button
                        onClick={() => handleApprove(bill)}
                        disabled={submittingId === bill.id || isInvalid}
                        style={{
                          backgroundColor: isInvalid ? '#cbd5e1' : '#dcfce7',
                          color: isInvalid ? '#64748b' : '#166534',
                          border: '1px solid ' + (isInvalid ? '#cbd5e1' : '#86efac'),
                          padding: '4px 8px', borderRadius: '4px',
                          fontSize: '0.7rem', fontWeight: '700',
                          cursor: isInvalid ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(bill)}
                        disabled={submittingId === bill.id}
                        style={{
                          backgroundColor: '#fee2e2', color: '#991b1b',
                          border: '1px solid #fca5a5',
                          padding: '4px 8px', borderRadius: '4px',
                          fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer'
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-current)', paddingTop: '0.75rem' }}>
                    {/* Expandable Tabs */}
                    <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border-current)', marginBottom: '0.75rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      {[
                        { key: 'rates', label: '📊 Rates & Invoicing' },
                        { key: 'sof', label: '📄 SOF Details' }
                      ].map(tab => {
                        const isActive = (activeTabs[bill.id] || 'rates') === tab.key;
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTabs(prev => ({ ...prev, [bill.id]: tab.key }))}
                            style={{
                              padding: '0.5rem 0.75rem',
                              border: 'none',
                              borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                              backgroundColor: 'transparent',
                              color: isActive ? 'var(--color-primary)' : 'var(--text-muted-current)',
                              fontWeight: isActive ? '800' : '600',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              marginBottom: '-1px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Tab 1: Rates */}
                    {(activeTabs[bill.id] || 'rates') === 'rates' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div className="mobile-sub-list" style={{ margin: 0, padding: '0.5rem', gap: '0.6rem' }}>
                          {(bill.bill_items || []).map((item, idx) => {
                            const editedRatesForBill = editedRates[bill.id] || {};
                            const currentRate = editedRatesForBill[item.form_id] !== undefined ? editedRatesForBill[item.form_id] : (item.rate_per_meter || '');
                            const rateFloat = parseFloat(currentRate) || 0;
                            const rowTotal = item.actual_qty * rateFloat;

                            return (
                              <div key={idx} className="mobile-sub-item" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                  <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{item.form_number}</span>
                                  <span style={{
                                    backgroundColor: '#dcfce7', color: '#166534',
                                    padding: '1px 5px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: '700'
                                  }}>{item.status || 'completed'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>
                                  <span>Order: {item.order_number}</span>
                                  <span>Design: {item.design_name}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                  <span>Qty: {Number(item.actual_qty).toLocaleString()} m</span>
                                  <span>Timeliness: <strong style={{ color: item.timeliness_status === 'late' ? '#b91c1c' : '#047857' }}>{item.timeliness_status === 'late' ? 'LATE' : 'ON TIME'}</strong></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                                  <span style={{ fontSize: '0.72rem', fontWeight: '600' }}>Rate/Meter:</span>
                                  {bill.status === 'awaiting_approval' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <span>₹</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={currentRate}
                                        onChange={e => handleRateChange(bill.id, item.form_id, e.target.value)}
                                        style={{
                                          width: '80px', padding: '0.3rem 0.5rem',
                                          border: '1px solid var(--border-current)', borderRadius: '4px',
                                          fontSize: '0.78rem', textAlign: 'right', fontWeight: '700',
                                          height: '32px'
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <strong>₹{parseFloat(item.rate_per_meter || 0).toFixed(2)}</strong>
                                  )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '700', borderTop: '1px dashed var(--border-current)', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                                  <span>Row Total:</span>
                                  <span style={{ color: 'var(--color-primary)' }}>₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Remarks & Warnings */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>Admin Approval Notes / Remarks</label>
                          <textarea
                            placeholder={bill.status === 'awaiting_approval' ? "Explain approval rates adjustment or rejection reason..." : "No notes."}
                            value={adminNotes[bill.id] !== undefined ? adminNotes[bill.id] : (bill.admin_notes || '')}
                            onChange={e => handleNotesChange(bill.id, e.target.value)}
                            disabled={bill.status !== 'awaiting_approval'}
                            style={{
                              width: '100%', height: '55px', padding: '0.5rem',
                              border: '1px solid var(--border-current)', borderRadius: '6px',
                              fontSize: '0.75rem', resize: 'none'
                            }}
                          />
                        </div>

                        {/* Total Summary */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', border: '1px solid var(--border-current)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Calculated Subtotal:</span><strong>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice Subtotal:</span><strong>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax Amount:</span><strong>₹{Number(bill.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem', color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: '800' }}>
                            <span>Invoice Total:</span>
                            <span>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {isInvalid && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.5rem 0.75rem', borderRadius: '6px', color: '#991b1b', fontSize: '0.7rem', fontWeight: '600' }}>
                            <AlertCircle size={13} style={{ flexShrink: 0 }} />
                            <span>Calculated subtotal (₹{calculatedTotal.toFixed(2)}) is less than invoice subtotal (₹{Number(bill.invoice_subtotal).toFixed(2)}). Approval disabled.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: SOF Details */}
                    {(activeTabs[bill.id] || 'rates') === 'sof' && (
                      loadingSofs[bill.id] ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '0.4rem' }}>
                          <Loader size={18} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>Loading SOF data...</span>
                        </div>
                      ) : !expandedSofsData[bill.id] || expandedSofsData[bill.id].length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                          No Sizing Order Forms associated.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {expandedSofsData[bill.id].map(sof => {
                            const isSofExpanded = expandedSofIdMap[bill.id] === sof.id;
                            const typeLabel = sof.sizing_type === 'in_house' ? 'In-House' : 'Job Work';
                            const timeDiffStr = (started, ended) => {
                              if (!started || !ended) return '—';
                              return `${new Date(started).toLocaleDateString('en-GB')} to ${new Date(ended).toLocaleDateString('en-GB')}`;
                            };
                            return (
                              <div key={sof.id} style={{ border: '1px solid var(--border-current)', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'white' }}>
                                <div
                                  onClick={() => setExpandedSofIdMap(prev => ({ ...prev, [bill.id]: isSofExpanded ? null : sof.id }))}
                                  style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  <span style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                                    {isSofExpanded ? '▼' : '▶'} {sof.sof_number}
                                  </span>
                                  <span style={{ fontWeight: '700' }}>{Number(sof.qty).toLocaleString()} m</span>
                                </div>
                                {isSofExpanded && (
                                  <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.72rem' }}>
                                    <div>Order No: <strong style={{ color: 'var(--color-primary)' }}>{sof.order?.order_number || '—'}</strong></div>
                                    <div>Design: <strong>{sof.order?.design_name || '—'}</strong> ({sof.order?.design_no || '—'})</div>
                                    <div>Sizing Type: <strong>{typeLabel}</strong></div>
                                    <div>Sizing Machine / Partner: <strong>{sof.sizing_type === 'in_house' ? (sof.machine_name || 'In-House Sizing Machine') : `${sof.partner_name || '—'} (${sof.machine_name || '—'})`}</strong></div>
                                    <div>Beam Number: <strong>{sof.beam_name || '—'}</strong></div>
                                    <div>Sizer Name: <strong>{sof.sizer_name || '—'}</strong></div>
                                    <div>Planned Dates: <strong>{timeDiffStr(sof.start_date, sof.end_date)}</strong></div>
                                    <div>Actual Dates: <strong>{timeDiffStr(sof.process_started_at, sof.process_completed_at)}</strong></div>
                                    <div>Status: <span style={{ backgroundColor: sof.status === 'completed' ? '#dcfce7' : '#fef3c7', color: sof.status === 'completed' ? '#166534' : '#92400e', padding: '1px 6px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: '800' }}>{sof.status}</span></div>
                                    {sof.sofdc_number && <div>SOFDC: <strong style={{ fontFamily: 'monospace' }}>{sof.sofdc_number}</strong></div>}

                                    {/* Weaving Split Details */}
                                    <div style={{ borderTop: '1px solid var(--border-current)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                      <div style={{ fontWeight: '800', marginBottom: '0.3rem', textTransform: 'uppercase', fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>Weaving Split Details</div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                        {(!sof.weaving_splits || sof.weaving_splits.length === 0) ? (
                                          <div style={{ fontStyle: 'italic', color: 'var(--text-muted-current)' }}>No weaving splits configured.</div>
                                        ) : (
                                          sof.weaving_splits.map((split, idx) => (
                                            <div key={idx} style={{ padding: '0.4rem 0.5rem', backgroundColor: '#f8fafc', border: '1px solid var(--border-current)', borderRadius: '4px' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                                                <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{split.split_no}</span>
                                                <span>{Number(split.qty).toLocaleString()} m</span>
                                              </div>
                                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                                Timeline: {split.start_date || '—'} to {split.end_date || '—'}
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Weaving Bill Approvals ────────────────────────────────────────
function WeavingBillApprovals({ adminProfile }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('awaiting_approval');
  const [expandedId, setExpandedId] = useState(null);

  // Edit states: { [billId]: { [formId]: newValue } }
  const [editedPickRates, setEditedPickRates] = useState({});
  const [editedOkQtys, setEditedOkQtys] = useState({});
  const [editedShortageAllowance, setEditedShortageAllowance] = useState({});
  const [editedMistakeAllowance, setEditedMistakeAllowance] = useState({});
  const [adminNotes, setAdminNotes] = useState({});
  const [submittingId, setSubmittingId] = useState(null);

  // Expanded details state
  const [expandedWvofData, setExpandedWvofData] = useState({});
  const [loadingWvofs, setLoadingWvofs] = useState({});
  const [activeTabs, setActiveTabs] = useState({});
  const [expandedDates, setExpandedDates] = useState({});

  const fetchBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_finance_bills')
        .select('*')
        .eq('form_type', 'weaving')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error('Error fetching weaving bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const loadWvofDetailsForBill = async (bill) => {
    if (expandedWvofData[bill.id]) return;
    setLoadingWvofs(prev => ({ ...prev, [bill.id]: true }));
    try {
      const selectedFormIds = bill.selected_form_ids || [];
      if (selectedFormIds.length === 0) {
        setExpandedWvofData(prev => ({ ...prev, [bill.id]: [] }));
        return;
      }

      // Fetch weaving order details including order requirements
      const { data: wvofs, error: wvofErr } = await supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements, technical_specs)
        `)
        .in('id', selectedFormIds);

      if (wvofErr) throw wvofErr;
      setExpandedWvofData(prev => ({ ...prev, [bill.id]: wvofs || [] }));
    } catch (err) {
      console.error('Error fetching WVOF details for bill:', err);
    } finally {
      setLoadingWvofs(prev => ({ ...prev, [bill.id]: false }));
    }
  };

  const toggleExpandBill = (bill) => {
    const isExpanding = expandedId !== bill.id;
    setExpandedId(isExpanding ? bill.id : null);
    if (isExpanding) {
      loadWvofDetailsForBill(bill);
    }
  };

  const handlePickRateChange = (billId, formId, val) => {
    setEditedPickRates(prev => ({
      ...prev,
      [billId]: {
        ...(prev[billId] || {}),
        [formId]: val
      }
    }));
  };

  const handleShortageChange = (billId, formId, val) => {
    setEditedShortageAllowance(prev => ({
      ...prev,
      [billId]: {
        ...(prev[billId] || {}),
        [formId]: val
      }
    }));
  };

  const handleMistakeChange = (billId, formId, val) => {
    setEditedMistakeAllowance(prev => ({
      ...prev,
      [billId]: {
        ...(prev[billId] || {}),
        [formId]: val
      }
    }));
  };

  const handleOkQtyChange = (billId, formId, val) => {
    setEditedOkQtys(prev => ({
      ...prev,
      [billId]: {
        ...(prev[billId] || {}),
        [formId]: val
      }
    }));
  };

  const handleNotesChange = (billId, val) => {
    setAdminNotes(prev => ({
      ...prev,
      [billId]: val
    }));
  };

  const getBillData = (bill) => {
    const rateEdits = editedPickRates[bill.id] || {};
    const shortageEdits = editedShortageAllowance[bill.id] || {};
    const mistakeEdits = editedMistakeAllowance[bill.id] || {};
    let calculatedTotal = 0;

    const updatedItems = (bill.bill_items || []).map(item => {
      const editedPickRate = rateEdits[item.form_id];
      const pickRate = editedPickRate !== undefined ? parseFloat(editedPickRate) || 0 : item.pick_rate || 0;

      const editedShortage = shortageEdits[item.form_id];
      const shortage = editedShortage !== undefined ? parseFloat(editedShortage) || 0 : (item.totals?.shortage || 0);

      const editedMistake = mistakeEdits[item.form_id];
      const mistake = editedMistake !== undefined ? parseFloat(editedMistake) || 0 : (item.totals?.mistakes || 0);

      const plannedQtySum = item.totals?.planned_qty !== undefined 
        ? parseFloat(item.totals.planned_qty) 
        : (item.fabric_rolls || []).reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);

      const okQty = Math.max(0, plannedQtySum - shortage - mistake);
      const ratePerMeter = (item.pick || 0) * pickRate;
      const total = okQty * ratePerMeter;
      calculatedTotal += total;

      return {
        ...item,
        pick_rate: pickRate,
        actual_qty: okQty,
        rate_per_meter: ratePerMeter,
        calculated_total: total,
        totals: {
          ...item.totals,
          shortage,
          mistakes: mistake,
          ok_qty: okQty
        }
      };
    });

    const isInvalid = calculatedTotal < bill.invoice_subtotal;
    return { updatedItems, calculatedTotal, isInvalid };
  };

  const handleApprove = async (bill) => {
    const { updatedItems, calculatedTotal, isInvalid } = getBillData(bill);
    if (isInvalid) {
      alert("Cannot approve: The updated calculated total is less than the partner's invoice subtotal.");
      return;
    }

    if (!window.confirm(`Approve weaving bill ${bill.bill_number}?`)) return;

    setSubmittingId(bill.id);
    try {
      const { error } = await supabase
        .from('production_finance_bills')
        .update({
          status: 'approved',
          bill_items: updatedItems,
          calculated_total: calculatedTotal,
          admin_notes: adminNotes[bill.id] || bill.admin_notes,
          approved_by: adminProfile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (error) throw error;
      alert('Weaving bill approved successfully!');
      fetchBills();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReject = async (bill) => {
    const notes = adminNotes[bill.id]?.trim() || bill.admin_notes;
    if (!notes) {
      alert('Please enter a note/remarks explaining why the bill is rejected.');
      return;
    }

    if (!window.confirm(`Reject weaving bill ${bill.bill_number}?`)) return;

    setSubmittingId(bill.id);
    try {
      const { error } = await supabase
        .from('production_finance_bills')
        .update({
          status: 'rejected',
          admin_notes: notes,
          approved_by: adminProfile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (error) throw error;
      alert('Bill rejected.');
      fetchBills();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'awaiting_approval':
        return { bg: '#fef3c7', text: '#92400e', label: 'AWAITING APPROVAL', icon: <Clock size={12} /> };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', label: 'APPROVED', icon: <CheckCircle size={12} /> };
      case 'settled':
        return { bg: '#dbeafe', text: '#1e40af', label: 'SETTLED', icon: <CheckCircle size={12} /> };
      case 'rejected':
        return { bg: '#fee2e2', text: '#991b1b', label: 'REJECTED', icon: <XCircle size={12} /> };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: (status || '').toUpperCase() };
    }
  };

  const filteredBills = bills.filter(b => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  // Date helper inside Approvals
  const getLocalDateOnly = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getUnifiedProductionDates = (wvof) => {
    const datesSet = new Set();
    if (wvof.planned_daily_production && Array.isArray(wvof.planned_daily_production)) {
      wvof.planned_daily_production.forEach(p => {
        if (p.date) datesSet.add(p.date);
      });
    }
    if (wvof.production_logs && Array.isArray(wvof.production_logs)) {
      wvof.production_logs.forEach(log => {
        const dStr = getLocalDateOnly(log.timestamp);
        if (dStr) datesSet.add(dStr);
      });
    }
    return Array.from(datesSet).sort();
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div>
      <style>{`
        .qc-tooltip-trigger {
          position: relative;
        }
        .qc-tooltip-trigger:hover .qc-tooltip-content {
          display: block !important;
        }
      `}</style>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {[
          { key: 'all', label: 'All Bills', count: bills.length },
          { key: 'awaiting_approval', label: 'Awaiting Approval', count: bills.filter(b => b.status === 'awaiting_approval').length },
          { key: 'approved', label: 'Approved / Settled', count: bills.filter(b => b.status === 'approved' || b.status === 'settled').length },
          { key: 'rejected', label: 'Rejected', count: bills.filter(b => b.status === 'rejected').length }
        ].map(pill => (
          <button
            key={pill.key}
            onClick={() => setStatusFilter(pill.key)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              border: '1px solid ' + (statusFilter === pill.key ? 'var(--color-primary)' : 'var(--border-current)'),
              backgroundColor: statusFilter === pill.key ? 'var(--color-primary)' : 'white',
              color: statusFilter === pill.key ? 'white' : 'var(--text-main-current)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {pill.label}
            <span style={{
              backgroundColor: statusFilter === pill.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-current)',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.7rem'
            }}>
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      {/* Bills Table */}
      <div className="desktop-view">
        <div className="glass-panel" style={{ padding: 0 }}>
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '40px' }} />
                <th>WVOF No</th>
                <th>Order No</th>
                <th>Design</th>
                <th>Partner</th>
                <th style={{ textAlign: 'right' }}>Qty (m)</th>
                <th style={{ textAlign: 'right' }}>Calc. Total</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                    No bills found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => {
                  const isExpanded = expandedId === bill.id;
                  const badge = getStatusBadge(bill.status);
                  const { updatedItems, calculatedTotal, isInvalid } = getBillData(bill);

                  return (
                    <React.Fragment key={bill.id}>
                      <tr onClick={() => toggleExpandBill(bill)} style={{ cursor: 'pointer' }}>
                        <td style={{ textAlign: 'center' }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {(bill.bill_items || [])[0]?.form_number || '—'}
                          {(bill.bill_items || []).length > 1 && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: '500', fontFamily: 'inherit' }}>
                              {' '}+{(bill.bill_items || []).length - 1}
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: '600', fontSize: '0.78rem' }}>
                          {(bill.bill_items || [])[0]?.order_number || '—'}
                        </td>
                        <td>
                          <div style={{ fontWeight: '600', fontSize: '0.78rem' }}>{(bill.bill_items || [])[0]?.design_name || '—'}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>{(bill.bill_items || [])[0]?.design_no || ''}</div>
                        </td>
                        <td style={{ fontWeight: '500', fontSize: '0.78rem' }}>{bill.partner_name}</td>
                        <td style={{ textAlign: 'right', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          <div>P: <strong>{Number((bill.bill_items || []).reduce((sum, i) => sum + (parseFloat(i.planned_qty) || 0), 0)).toLocaleString()} m</strong></div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                            Pr: {Number((bill.bill_items || []).reduce((sum, i) => sum + (parseFloat(i.totals?.planned_qty) || 0), 0)).toLocaleString()} m
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>
                            A: {Number((bill.bill_items || []).reduce((sum, i) => sum + (parseFloat(i.totals?.actual_qty || i.actual_qty) || 0), 0)).toLocaleString()} m
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>
                            OK: {Number((bill.bill_items || []).reduce((sum, i) => sum + (parseFloat(i.totals?.ok_qty || i.actual_qty) || 0), 0)).toLocaleString()} m
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.78rem' }}>₹{Number(calculatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => toggleExpandBill(bill)}
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            >
                              <Eye size={11} /> {isExpanded ? 'Hide' : 'Review'}
                            </button>
                            {bill.status === 'awaiting_approval' && (
                              <>
                                <button
                                  onClick={() => handleApprove(bill)}
                                  disabled={submittingId === bill.id || isInvalid}
                                  style={{
                                    backgroundColor: isInvalid ? '#cbd5e1' : '#dcfce7',
                                    color: isInvalid ? '#64748b' : '#166534',
                                    border: '1px solid ' + (isInvalid ? '#cbd5e1' : '#86efac'),
                                    padding: '3px 8px', borderRadius: '4px',
                                    fontSize: '0.75rem', fontWeight: '700',
                                    cursor: isInvalid ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(bill)}
                                  disabled={submittingId === bill.id}
                                  style={{
                                    backgroundColor: '#fee2e2', color: '#991b1b',
                                    border: '1px solid #fca5a5',
                                    padding: '3px 8px', borderRadius: '4px',
                                    fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                                  }}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={9} style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderLeft: '4px solid var(--color-primary)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                              
                              {updatedItems.map((item, idx) => {
                                const pickRateEdits = editedPickRates[bill.id] || {};
                                const shortageEdits = editedShortageAllowance[bill.id] || {};
                                const mistakeEdits = editedMistakeAllowance[bill.id] || {};

                                const rolls = (item.fabric_rolls || []).filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');

                                const currentPickRate = pickRateEdits[item.form_id] !== undefined ? pickRateEdits[item.form_id] : (item.pick_rate ?? '');
                                const shortageVal = shortageEdits[item.form_id] !== undefined ? shortageEdits[item.form_id] : (item.totals?.shortage ?? 0);
                                const mistakeVal = mistakeEdits[item.form_id] !== undefined ? mistakeEdits[item.form_id] : (item.totals?.mistakes ?? 0);

                                const pVal = parseFloat(item.pick) || 0;
                                const prFloat = parseFloat(currentPickRate) || 0;
                                const ratePerMeter = pVal * prFloat;

                                return (
                                  <div key={item.form_id || idx} style={{
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-current)',
                                    padding: '1.25rem',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                  }}>
                                    {/* Item Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem' }}>
                                      <div>
                                        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                                          {item.form_number} (Weaving Order)
                                        </h4>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                          Order: <strong>{item.order_number}</strong> | Design: <strong>{item.design_name} ({item.design_no})</strong>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.75rem' }}>
                                        <div>Construction: <strong>{item.construction || '—'}</strong></div>
                                        {item.status && (
                                          <span style={{
                                            backgroundColor: '#ecfdf5',
                                            color: '#047857',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontWeight: '700',
                                            fontSize: '0.65rem',
                                            textTransform: 'uppercase'
                                          }}>
                                            {item.status}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Rolls Table */}
                                    <div style={{ border: '1px solid var(--border-current)', borderRadius: '6px', overflow: 'visible', marginBottom: '1.25rem' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left', tableLayout: 'fixed' }}>
                                        <colgroup>
                                          <col style={{ width: '15%' }} />
                                          <col style={{ width: '12%' }} />
                                          <col style={{ width: '10%' }} />
                                          <col style={{ width: '11%' }} />
                                          <col style={{ width: '11%' }} />
                                          <col style={{ width: '10%' }} />
                                          <col style={{ width: '10%' }} />
                                          <col style={{ width: '10%' }} />
                                          <col style={{ width: '11%' }} />
                                        </colgroup>
                                        <thead>
                                          <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                                            <th style={{ padding: '0.5rem 0.75rem' }}>Roll ID</th>
                                            <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
                                            <th style={{ padding: '0.5rem 0.75rem' }}>Time</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Greige (m)</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Actual (m)</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Shortage (m)</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Mistakes (m)</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>OK Qty (m)</th>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>QC Status</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rolls.length === 0 ? (
                                            <tr>
                                              <td colSpan={9} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)' }}>No rolls processed for this item.</td>
                                            </tr>
                                          ) : (
                                            rolls.map(roll => {
                                              const isInspected = roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing';
                                              const rollDate = roll.received_at ? new Date(roll.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                                              const rollTime = roll.received_at ? new Date(roll.received_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                                              return (
                                                <tr key={roll.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                  <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roll.id}</td>
                                                  <td style={{ padding: '0.5rem 0.75rem' }}>{rollDate}</td>
                                                  <td style={{ padding: '0.5rem 0.75rem' }}>{rollTime}</td>
                                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{Number(roll.qty || 0).toLocaleString()}</td>
                                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{roll.actual_qty !== undefined ? Number(roll.actual_qty).toLocaleString() : '—'}</td>
                                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{roll.shortage || 0}</td>
                                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{roll.mistake || 0}</td>
                                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{roll.approved_qty !== undefined ? Number(roll.approved_qty).toLocaleString() : '—'}</td>
                                                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', overflow: 'visible' }}>
                                                    {isInspected ? (
                                                      <div className="qc-tooltip-trigger" style={{ display: 'inline-block', position: 'relative' }}>
                                                        <span style={{
                                                          backgroundColor: '#ecfdf5', color: '#047857',
                                                          padding: '2px 8px', borderRadius: '4px',
                                                          fontSize: '0.68rem', fontWeight: '800', cursor: 'help'
                                                        }}>
                                                          ✔️ Inspected
                                                        </span>
                                                        <div className="qc-tooltip-content" style={{
                                                          display: 'none', position: 'absolute', right: '105%', top: '50%', transform: 'translateY(-50%)',
                                                          backgroundColor: '#1e293b', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px',
                                                          width: '260px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                                          zIndex: 1000, fontSize: '0.7rem', textAlign: 'left', lineHeight: '1.4'
                                                        }}>
                                                          <div style={{ borderBottom: '1px solid #334155', paddingBottom: '3px', marginBottom: '5px', fontWeight: '800', color: '#38bdf8' }}>QC Match Details</div>
                                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                            <div>Greige Qty: <strong>{roll.qty} m</strong></div>
                                                            <div>Actual Qty: <strong>{roll.actual_qty || '—'} m</strong></div>
                                                            <div>Shortage: <strong>{roll.shortage || 0} m</strong></div>
                                                            <div>Mistakes: <strong>{roll.mistake || 0} m</strong></div>
                                                            <div>OK Qty: <strong>{roll.approved_qty || 0} m</strong></div>
                                                            <div>Inspectors: <strong>{roll.inspector_1 || '—'} {roll.inspector_2 ? `& ${roll.inspector_2}` : ''}</strong></div>
                                                            <div>Fitter: <strong>{roll.attended_fitter || '—'}</strong></div>
                                                            <div>Result: <strong>{roll.roll_ok ? '🟢 OK' : '🔴 Defects'}</strong></div>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '800' }}>Pending QC</span>
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })
                                          )}
                                          {/* Roll Totals Row */}
                                          {rolls.length > 0 && (
                                            <tr style={{ backgroundColor: 'rgba(0,0,0,0.01)', fontWeight: '800', borderTop: '2px solid var(--border-current)' }}>
                                              <td colSpan={3} style={{ padding: '0.5rem 0.75rem' }}>Roll Totals:</td>
                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                                {rolls.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0).toLocaleString()} m
                                              </td>
                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                                {rolls.reduce((sum, r) => sum + (parseFloat(r.actual_qty || r.actual_length) || 0), 0).toLocaleString()} m
                                              </td>
                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                                {rolls.reduce((sum, r) => sum + (parseFloat(r.shortage) || 0), 0).toLocaleString()} m
                                              </td>
                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                                                {rolls.reduce((sum, r) => sum + (parseFloat(r.mistake) || 0), 0).toLocaleString()} m
                                              </td>
                                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--color-primary)' }}>
                                                {rolls.reduce((sum, r) => sum + (parseFloat(r.approved_qty) || 0), 0).toLocaleString()} m
                                              </td>
                                              <td style={{ padding: '0.5rem 0.75rem' }}></td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Calculations & Adjustments Box */}
                                    <div style={{
                                      backgroundColor: 'var(--bg-current)',
                                      border: '1px solid var(--border-current)',
                                      borderRadius: '6px',
                                      padding: '1rem'
                                    }}>
                                      <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: '#475569' }}>
                                        Rates & Allowances Adjustments
                                      </h5>
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                        gap: '1rem',
                                        alignItems: 'end'
                                      }}>
                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted-current)', marginBottom: '4px', fontWeight: '700' }}>
                                            Pick
                                          </label>
                                          <input
                                            type="text"
                                            value={item.pick || '0'}
                                            disabled
                                            style={{
                                              width: '100%', padding: '0.4rem 0.6rem',
                                              border: '1px solid var(--border-current)', borderRadius: '4px',
                                              fontSize: '0.75rem', backgroundColor: '#e2e8f0', cursor: 'not-allowed', fontWeight: '600'
                                            }}
                                          />
                                        </div>

                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted-current)', marginBottom: '4px', fontWeight: '700' }}>
                                            Rate per Pick (₹)
                                          </label>
                                          {bill.status === 'awaiting_approval' ? (
                                            <input
                                              type="number"
                                              step="0.0001"
                                              value={currentPickRate}
                                              onChange={e => handlePickRateChange(bill.id, item.form_id, e.target.value)}
                                              style={{
                                                width: '100%', padding: '0.4rem 0.6rem',
                                                border: '1px solid var(--border-current)', borderRadius: '4px',
                                                fontSize: '0.75rem', fontWeight: '700'
                                              }}
                                            />
                                          ) : (
                                            <div style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#f1f5f9' }}>
                                              ₹{parseFloat(item.pick_rate || 0).toFixed(4)}
                                            </div>
                                          )}
                                        </div>

                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted-current)', marginBottom: '4px', fontWeight: '700' }}>
                                            Shortage Allowance (m)
                                          </label>
                                          {bill.status === 'awaiting_approval' ? (
                                            <input
                                              type="number"
                                              step="0.1"
                                              value={shortageVal}
                                              onChange={e => handleShortageChange(bill.id, item.form_id, e.target.value)}
                                              style={{
                                                width: '100%', padding: '0.4rem 0.6rem',
                                                border: '1px solid var(--border-current)', borderRadius: '4px',
                                                fontSize: '0.75rem', fontWeight: '700'
                                              }}
                                            />
                                          ) : (
                                            <div style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#f1f5f9' }}>
                                              {parseFloat(item.totals?.shortage || 0).toLocaleString()} m
                                            </div>
                                          )}
                                        </div>

                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted-current)', marginBottom: '4px', fontWeight: '700' }}>
                                            Mistake Allowance (m)
                                          </label>
                                          {bill.status === 'awaiting_approval' ? (
                                            <input
                                              type="number"
                                              step="0.1"
                                              value={mistakeVal}
                                              onChange={e => handleMistakeChange(bill.id, item.form_id, e.target.value)}
                                              style={{
                                                width: '100%', padding: '0.4rem 0.6rem',
                                                border: '1px solid var(--border-current)', borderRadius: '4px',
                                                fontSize: '0.75rem', fontWeight: '700'
                                              }}
                                            />
                                          ) : (
                                            <div style={{ padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#f1f5f9' }}>
                                              {parseFloat(item.totals?.mistakes || 0).toLocaleString()} m
                                            </div>
                                          )}
                                        </div>

                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted-current)', marginBottom: '4px', fontWeight: '700' }}>
                                            Rate / Meter
                                          </label>
                                          <div style={{
                                            padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '4px',
                                            fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#f1f5f9'
                                          }}>
                                            ₹{ratePerMeter.toFixed(4)}
                                          </div>
                                        </div>

                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted-current)', marginBottom: '4px', fontWeight: '700' }}>
                                            Adjusted OK Qty
                                          </label>
                                          <div style={{
                                            padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '4px',
                                            fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#f1f5f9', color: 'var(--color-primary)'
                                          }}>
                                            {item.actual_qty.toLocaleString()} m
                                          </div>
                                        </div>

                                        <div>
                                          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted-current)', marginBottom: '4px', fontWeight: '700' }}>
                                            Total Price
                                          </label>
                                          <div style={{
                                            padding: '0.4rem 0.6rem', border: '1px solid var(--color-primary)', borderRadius: '4px',
                                            fontSize: '0.75rem', fontWeight: '800', backgroundColor: 'var(--bg-current)', color: 'var(--color-primary)'
                                          }}>
                                            ₹{item.calculated_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Summary & Notes Section */}
                              <div style={{ marginTop: '1rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-current)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'start' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#475569' }}>Admin Approval Notes / Remarks</label>
                                    <textarea
                                      placeholder={bill.status === 'awaiting_approval' ? "Explain approval rates adjustment or rejection reason..." : "No notes."}
                                      value={adminNotes[bill.id] !== undefined ? adminNotes[bill.id] : (bill.admin_notes || '')}
                                      onChange={e => handleNotesChange(bill.id, e.target.value)}
                                      disabled={bill.status !== 'awaiting_approval'}
                                      style={{
                                        width: '100%', height: '60px', padding: '0.5rem',
                                        border: '1px solid var(--border-current)', borderRadius: '6px',
                                        fontSize: '0.75rem', resize: 'none'
                                      }}
                                    />
                                  </div>

                                  <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <div>Calculated Total: <strong>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                    <div>Invoice Subtotal: <strong>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                    <div>Tax Amount: <strong>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: '800' }}>Invoice Total: ₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                  </div>
                                </div>

                                {isInvalid && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.6rem 0.8rem', borderRadius: '6px', color: '#991b1b', fontSize: '0.72rem', fontWeight: '600', marginTop: '0.75rem' }}>
                                    <AlertCircle size={14} /> Warning: The updated calculated total (₹{calculatedTotal.toFixed(2)}) is less than the partner's invoice subtotal (₹{Number(bill.invoice_subtotal).toFixed(2)}). Approval is disabled.
                                  </div>
                                )}
                              </div>

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
      </div>

      {/* Mobile view */}
      <div className="mobile-view">
        {filteredBills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)', backgroundColor: 'var(--surface-current)', borderRadius: '8px', border: '1px solid var(--border-current)', fontSize: '0.8rem' }}>
            No bills found for the selected filter.
          </div>
        ) : (
          filteredBills.map(bill => {
            const isExpanded = expandedId === bill.id;
            const badge = getStatusBadge(bill.status);
            const { updatedItems, calculatedTotal, isInvalid } = getBillData(bill);

            return (
              <div key={bill.id} className="mobile-card" style={{ borderLeft: isExpanded ? '3px solid var(--color-primary)' : '1px solid var(--border-current)', padding: '0.85rem' }}>
                <div className="mobile-card-header" onClick={() => toggleExpandBill(bill)} style={{ cursor: 'pointer', borderBottom: 'none', paddingBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {(bill.bill_items || [])[0]?.form_number || '—'}
                      {(bill.bill_items || []).length > 1 && ` (+${(bill.bill_items || []).length - 1})`}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                      Order: {(bill.bill_items || [])[0]?.order_number || '—'}
                    </span>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    backgroundColor: badge.bg, color: badge.text,
                    padding: '2px 6px', borderRadius: '4px',
                    fontSize: '0.65rem', fontWeight: '700'
                  }}>
                    {badge.icon} {badge.label}
                  </span>
                </div>

                <div className="mobile-card-body" onClick={() => toggleExpandBill(bill)} style={{ cursor: 'pointer', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Design:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem' }}>
                      {(bill.bill_items || [])[0]?.design_name || '—'} ({(bill.bill_items || [])[0]?.design_no || ''})
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Partner:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem', fontWeight: '600' }}>{bill.partner_name}</span>
                  </div>
                  <div className="mobile-card-row" style={{ alignItems: 'flex-start' }}>
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Quantities:</span>
                    <div style={{ textAlign: 'right', fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>
                      <div>Planned: <strong>{Number((bill.bill_items || []).reduce((sum, i) => sum + (parseFloat(i.planned_qty) || 0), 0)).toLocaleString()} m</strong></div>
                      <div>Actual: <strong>{Number((bill.bill_items || []).reduce((sum, i) => sum + (parseFloat(i.totals?.actual_qty || i.actual_qty) || 0), 0)).toLocaleString()} m</strong></div>
                      <div>OK Qty: <strong style={{ color: 'var(--color-primary)' }}>{Number((bill.bill_items || []).reduce((sum, i) => sum + (parseFloat(i.totals?.ok_qty || i.actual_qty) || 0), 0)).toLocaleString()} m</strong></div>
                    </div>
                  </div>
                  <div className="mobile-card-row" style={{ borderTop: '1px dashed var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Calculated Subtotal:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--color-primary)' }}>₹{Number(calculatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Invoice Total:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.75rem', fontWeight: '800' }}>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="mobile-card-actions" style={{ marginTop: '0.6rem', paddingTop: '0.6rem' }}>
                  <button
                    onClick={() => toggleExpandBill(bill)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Eye size={12} /> {isExpanded ? 'Hide' : 'Review'}
                  </button>
                  {bill.status === 'awaiting_approval' && (
                    <>
                      <button
                        onClick={() => handleApprove(bill)}
                        disabled={submittingId === bill.id || isInvalid}
                        style={{
                          backgroundColor: isInvalid ? '#cbd5e1' : '#dcfce7',
                          color: isInvalid ? '#64748b' : '#166534',
                          border: '1px solid ' + (isInvalid ? '#cbd5e1' : '#86efac'),
                          padding: '4px 8px', borderRadius: '4px',
                          fontSize: '0.7rem', fontWeight: '700',
                          cursor: isInvalid ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(bill)}
                        disabled={submittingId === bill.id}
                        style={{
                          backgroundColor: '#fee2e2', color: '#991b1b',
                          border: '1px solid #fca5a5',
                          padding: '4px 8px', borderRadius: '4px',
                          fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer'
                        }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-current)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {updatedItems.map((item, idx) => {
                      const pickRateEdits = editedPickRates[bill.id] || {};
                      const shortageEdits = editedShortageAllowance[bill.id] || {};
                      const mistakeEdits = editedMistakeAllowance[bill.id] || {};

                      const rolls = (item.fabric_rolls || []).filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
                      const currentPickRate = pickRateEdits[item.form_id] !== undefined ? pickRateEdits[item.form_id] : (item.pick_rate ?? '');
                      const shortageVal = shortageEdits[item.form_id] !== undefined ? shortageEdits[item.form_id] : (item.totals?.shortage ?? 0);
                      const mistakeVal = mistakeEdits[item.form_id] !== undefined ? mistakeEdits[item.form_id] : (item.totals?.mistakes ?? 0);

                      const pVal = parseFloat(item.pick) || 0;
                      const prFloat = parseFloat(currentPickRate) || 0;
                      const ratePerMeter = pVal * prFloat;

                      return (
                        <div key={item.form_id || idx} style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-current)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div>
                            <span style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{item.form_number}</span>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                              Construction: <strong>{item.construction || '—'}</strong> | Status: <strong style={{ color: '#047857' }}>{item.status || 'completed'}</strong>
                            </div>
                          </div>

                          {/* Mobile Rolls List */}
                          <div>
                            <div style={{ fontWeight: '800', marginBottom: '0.35rem', textTransform: 'uppercase', fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>Fabric Rolls ({rolls.length})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {rolls.length === 0 ? (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontStyle: 'italic', padding: '0.5rem', backgroundColor: 'white', borderRadius: '4px', border: '1px dashed var(--border-current)' }}>
                                  No rolls processed.
                                </div>
                              ) : (
                                rolls.map(roll => {
                                  const rollDate = roll.received_at ? new Date(roll.received_at).toLocaleDateString('en-IN') : '—';
                                  return (
                                    <div key={roll.id} style={{ backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.5rem', fontSize: '0.7rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                        <span style={{ fontFamily: 'monospace', color: 'var(--text-current)' }}>{roll.id}</span>
                                        <span style={{ color: 'var(--text-muted-current)' }}>{rollDate}</span>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '4px', color: 'var(--text-muted-current)' }}>
                                        <div>Greige: <strong>{Number(roll.qty || 0).toFixed(1)}m</strong></div>
                                        <div>Actual: <strong>{roll.actual_qty !== undefined ? Number(roll.actual_qty).toFixed(1) : '—'}m</strong></div>
                                        <div>OK: <strong>{roll.approved_qty !== undefined ? Number(roll.approved_qty).toFixed(1) : '—'}m</strong></div>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-current)', paddingTop: '4px', marginTop: '4px' }}>
                                        <span>QC: <span style={{ fontWeight: '800', color: roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing' ? '#047857' : '#b91c1c' }}>{roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing' ? '🟢 QC OK' : '🔴 Pending'}</span></span>
                                        {(roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing') && (
                                          <span>Fitter: <strong>{roll.attended_fitter || '—'}</strong></span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Calculations / Rates Box */}
                          <div style={{ backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', marginBottom: '2px' }}>Pick</label>
                                <div style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '4px', backgroundColor: '#e2e8f0', fontSize: '0.75rem', fontWeight: '700', height: '32px', display: 'flex', alignItems: 'center' }}>
                                  {item.pick || '0'}
                                </div>
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', marginBottom: '2px' }}>Rate per Pick (₹)</label>
                                {bill.status === 'awaiting_approval' ? (
                                  <input
                                    type="number"
                                    step="0.0001"
                                    value={currentPickRate}
                                    onChange={e => handlePickRateChange(bill.id, item.form_id, e.target.value)}
                                    style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', height: '32px' }}
                                  />
                                ) : (
                                  <div style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '4px', backgroundColor: '#f1f5f9', fontSize: '0.75rem', fontWeight: '700', height: '32px', display: 'flex', alignItems: 'center' }}>
                                    ₹{parseFloat(item.pick_rate || 0).toFixed(4)}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', marginBottom: '2px' }}>Shortage Allow. (m)</label>
                                {bill.status === 'awaiting_approval' ? (
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={shortageVal}
                                    onChange={e => handleShortageChange(bill.id, item.form_id, e.target.value)}
                                    style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', height: '32px' }}
                                  />
                                ) : (
                                  <div style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '4px', backgroundColor: '#f1f5f9', fontSize: '0.75rem', fontWeight: '700', height: '32px', display: 'flex', alignItems: 'center' }}>
                                    {parseFloat(item.totals?.shortage || 0).toFixed(1)} m
                                  </div>
                                )}
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', marginBottom: '2px' }}>Mistake Allow. (m)</label>
                                {bill.status === 'awaiting_approval' ? (
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={mistakeVal}
                                    onChange={e => handleMistakeChange(bill.id, item.form_id, e.target.value)}
                                    style={{ width: '100%', padding: '0.3rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', height: '32px' }}
                                  />
                                ) : (
                                  <div style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border-current)', borderRadius: '4px', backgroundColor: '#f1f5f9', fontSize: '0.75rem', fontWeight: '700', height: '32px', display: 'flex', alignItems: 'center' }}>
                                    {parseFloat(item.totals?.mistakes || 0).toFixed(1)} m
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', borderTop: '1px dashed var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                              <div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>Rate / Meter:</div>
                                <div style={{ fontWeight: '700', fontSize: '0.75rem', marginTop: '2px' }}>₹{ratePerMeter.toFixed(4)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>Adjusted OK Qty:</div>
                                <div style={{ fontWeight: '750', fontSize: '0.75rem', marginTop: '2px' }}>{item.actual_qty.toLocaleString()} m</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: '800' }}>Price:</span>
                              <strong style={{ color: 'var(--color-primary)', fontSize: '0.78rem' }}>₹{item.calculated_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Remarks & Notes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#475569' }}>Admin Approval Notes / Remarks</label>
                      <textarea
                        placeholder={bill.status === 'awaiting_approval' ? "Explain approval rates adjustment or rejection reason..." : "No notes."}
                        value={adminNotes[bill.id] !== undefined ? adminNotes[bill.id] : (bill.admin_notes || '')}
                        onChange={e => handleNotesChange(bill.id, e.target.value)}
                        disabled={bill.status !== 'awaiting_approval'}
                        style={{
                          width: '100%', height: '55px', padding: '0.5rem',
                          border: '1px solid var(--border-current)', borderRadius: '6px',
                          fontSize: '0.75rem', resize: 'none'
                        }}
                      />
                    </div>

                    {/* Totals Summary */}
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', border: '1px solid var(--border-current)', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Calculated Subtotal:</span><strong>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invoice Subtotal:</span><strong>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax Amount:</span><strong>₹{Number(bill.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem', color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: '800' }}>
                        <span>Invoice Total:</span>
                        <span>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    {isInvalid && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.5rem 0.75rem', borderRadius: '6px', color: '#991b1b', fontSize: '0.7rem', fontWeight: '600', marginTop: '0.5rem' }}>
                        <AlertCircle size={13} style={{ flexShrink: 0 }} />
                        <span>Calculated total (₹{calculatedTotal.toFixed(2)}) is less than invoice subtotal (₹{Number(bill.invoice_subtotal).toFixed(2)}). Approval disabled.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Processing Bill Approvals ────────────────────────────────────
function ProcessingBillApprovals({ adminProfile }) {
  const [bills, setBills] = useState([]);
  const [pofs, setPofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('submitted_for_approval');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedPofId, setExpandedPofId] = useState(null);
  const [expandedItemKey, setExpandedItemKey] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);
  const [editedRates, setEditedRates] = useState({});

  const fetchBills = async () => {
    setLoading(true);
    try {
      const [billsRes, pofsRes] = await Promise.all([
        supabase
          .from('processing_finance_bills')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('processing_orders')
          .select('id, pof_number, fabric_rolls, received_rolls')
      ]);

      if (billsRes.error) throw billsRes.error;
      if (pofsRes.error) throw pofsRes.error;

      setBills(billsRes.data || []);
      setPofs(pofsRes.data || []);
    } catch (err) {
      console.error('Error fetching processing bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handleApprove = async (bill) => {
    // Dynamically compute the updated calculations from admin edits
    const billRates = editedRates[bill.id] || {};
    const rates = Array.isArray(bill.process_rates) ? bill.process_rates : [];
    const items = Array.isArray(bill.bill_items) ? bill.bill_items : [];
    const uniquePofGreige = {};
    items.forEach(item => {
      if (item.pof_id) {
        uniquePofGreige[item.pof_id] = parseFloat(item.greige_sent_qty) || 0;
      }
    });
    const totalGreigeQty = Object.values(uniquePofGreige).reduce((sum, val) => sum + val, 0);

    const updatedProcessRates = rates.map(r => {
      const rateKey = r.pof_id ? `${r.pof_id}_${r.process}` : r.process;
      const currentRateInput = billRates[rateKey];
      const rateVal = currentRateInput !== undefined ? parseFloat(currentRateInput) : parseFloat(r.rate_per_meter);
      const rate = isNaN(rateVal) ? 0 : rateVal;
      const greigeQty = r.greige_qty !== undefined ? (parseFloat(r.greige_qty) || 0) : totalGreigeQty;
      return {
        ...r,
        rate_per_meter: rate,
        calculated_total: greigeQty * rate
      };
    });

    const updatedCalculatedTotal = updatedProcessRates.reduce((sum, r) => sum + r.calculated_total, 0);
    const updatedInvoiceTotal = updatedCalculatedTotal + parseFloat(bill.tax_amount || 0);

    if (!window.confirm(`Approve processing bill ${bill.bill_number} with total ₹${updatedInvoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}?`)) return;

    setSubmittingId(bill.id);
    try {
      const { error: billErr } = await supabase
        .from('processing_finance_bills')
        .update({
          status: 'approved',
          approved_by: adminProfile?.id,
          approved_at: new Date().toISOString(),
          process_rates: updatedProcessRates,
          calculated_total: updatedCalculatedTotal,
          invoice_total: updatedInvoiceTotal
        })
        .eq('id', bill.id);

      if (billErr) throw billErr;

      const { error: orderErr } = await supabase
        .from('processing_orders')
        .update({
          payment_status: 'approved'
        })
        .in('id', bill.selected_pof_ids || []);

      if (orderErr) throw orderErr;

      alert('Bill approved successfully!');
      fetchBills();
    } catch (err) {
      alert('Error approving bill: ' + err.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted_for_approval':
        return { bg: '#fef3c7', text: '#92400e', label: 'AWAITING APPROVAL', icon: <Clock size={12} /> };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', label: 'APPROVED', icon: <CheckCircle size={12} /> };
      case 'settled':
        return { bg: '#dbeafe', text: '#1e40af', label: 'SETTLED', icon: <CheckCircle size={12} /> };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: (status || '').toUpperCase() };
    }
  };

  const filteredBills = bills.filter(b => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'submitted_for_approval') return b.status === 'submitted_for_approval';
    if (statusFilter === 'approved') return b.status === 'approved' || b.status === 'settled';
    return true;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>Loading processing bills...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {[
          { key: 'all', label: 'All Bills', count: bills.length },
          { key: 'submitted_for_approval', label: 'Awaiting Approval', count: bills.filter(b => b.status === 'submitted_for_approval').length },
          { key: 'approved', label: 'Approved / Settled', count: bills.filter(b => b.status === 'approved' || b.status === 'settled').length }
        ].map(pill => (
          <button
            key={pill.key}
            onClick={() => setStatusFilter(pill.key)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              border: '1px solid ' + (statusFilter === pill.key ? 'var(--color-primary)' : 'var(--border-current)'),
              backgroundColor: statusFilter === pill.key ? 'var(--color-primary)' : 'white',
              color: statusFilter === pill.key ? 'white' : 'var(--text-main-current)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {pill.label}
            <span style={{
              backgroundColor: statusFilter === pill.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-current)',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '0.7rem'
            }}>
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      {/* Bills Table */}
      <div className="desktop-view">
        <div className="glass-panel" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }} />
                  <th>Bill Number</th>
                  <th>Partner</th>
                  <th>Processes</th>
                  <th style={{ textAlign: 'center' }}>Sent Date</th>
                  <th style={{ textAlign: 'right' }}>Greige Sent</th>
                  <th style={{ textAlign: 'right' }}>Processed Recd</th>
                  <th style={{ textAlign: 'right' }}>Avg Shrinkage</th>
                  <th style={{ textAlign: 'right' }}>Invoice Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                      No processing bills found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredBills.map(bill => {
                    const isExpanded = expandedId === bill.id;
                    const badge = getStatusBadge(bill.status);
                    
                    // Compute totals from bill items
                    const items = Array.isArray(bill.bill_items) ? bill.bill_items : [];
                    const uniquePofGreige = {};
                    const uniquePofRolls = {};
                    items.forEach(item => {
                      if (item.pof_id) {
                        uniquePofGreige[item.pof_id] = parseFloat(item.greige_sent_qty) || 0;
                        uniquePofRolls[item.pof_id] = parseInt(item.greige_sent_rolls) || 0;
                      }
                    });
                    const totalGreigeQty = Object.values(uniquePofGreige).reduce((sum, val) => sum + val, 0);
                    const totalGreigeRolls = Object.values(uniquePofRolls).reduce((sum, val) => sum + val, 0);
                    const totalProcessedQty = items.reduce((sum, item) => sum + (parseFloat(item.processed_qty_recd) || 0), 0);
                    const totalProcessedRolls = items.reduce((sum, item) => sum + (parseInt(item.processed_rolls_recd) || 0), 0);
                    const avgShrinkage = totalGreigeQty > 0 ? ((totalGreigeQty - totalProcessedQty) / totalGreigeQty) * 100 : 0;

                    // Extract unique processes list
                    const allProcesses = Array.from(new Set(items.flatMap(item => item.processes || [])));
                    const processesStr = allProcesses.join(', ') || '—';

                    // Extract earliest sent date
                    const allSentDates = items.map(item => item.sent_date).filter(Boolean);
                    const earliestSentDateStr = allSentDates.length > 0 
                      ? new Date(allSentDates.reduce((oldest, current) => current < oldest ? current : oldest)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—';

                    // Dynamically calculate bill subtotal and invoice total based on local edited values
                    const billRates = editedRates[bill.id] || {};
                    const rates = Array.isArray(bill.process_rates) ? bill.process_rates : [];
                    const currentCalculatedTotal = rates.reduce((sum, r) => {
                      const rateKey = r.pof_id ? `${r.pof_id}_${r.process}` : r.process;
                      const currentRateInput = billRates[rateKey];
                      const rateVal = currentRateInput !== undefined ? parseFloat(currentRateInput) : parseFloat(r.rate_per_meter);
                      const rate = isNaN(rateVal) ? 0 : rateVal;
                      const greigeQty = r.greige_qty !== undefined ? (parseFloat(r.greige_qty) || 0) : totalGreigeQty;
                      return sum + (greigeQty * rate);
                    }, 0);
                    const currentInvoiceTotal = currentCalculatedTotal + parseFloat(bill.tax_amount || 0);

                    return (
                      <React.Fragment key={bill.id}>
                        <tr onClick={() => setExpandedId(isExpanded ? null : bill.id)} style={{ cursor: 'pointer' }}>
                          <td style={{ textAlign: 'center' }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                              {bill.bill_number}
                            </div>
                            {bill.partner_invoice_no && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '2px', fontWeight: '500' }}>
                                Inv: <span style={{ fontWeight: '700', color: 'var(--text-current)' }}>{bill.partner_invoice_no}</span>
                              </div>
                            )}
                            {bill.partner_invoice_date && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '500' }}>
                                Date: <span style={{ fontWeight: '700', color: 'var(--text-current)' }}>{new Date(bill.partner_invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: '500', fontSize: '0.78rem' }}>{bill.partner_name}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>{processesStr}</td>
                          <td style={{ textAlign: 'center', fontSize: '0.78rem' }}>{earliestSentDateStr}</td>
                          <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: '600' }}>
                            {totalGreigeRolls} rolls ({totalGreigeQty.toFixed(2)} m)
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: '600', color: '#047857' }}>
                            {totalProcessedRolls} rolls ({totalProcessedQty.toFixed(2)} m)
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: '700', color: avgShrinkage > 0 ? '#b45309' : '#047857' }}>
                            {avgShrinkage.toFixed(2)}%
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.78rem' }}>
                            ₹{Number(currentInvoiceTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : bill.id)}
                                className="btn btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              >
                                <Eye size={11} /> {isExpanded ? 'Hide' : 'Review'}
                              </button>
                              {bill.status === 'submitted_for_approval' && (
                                <button
                                  onClick={() => handleApprove(bill)}
                                  disabled={submittingId === bill.id}
                                  style={{
                                    backgroundColor: '#dcfce7',
                                    color: '#166534',
                                    border: '1px solid #86efac',
                                    padding: '3px 8px', borderRadius: '4px',
                                    fontSize: '0.75rem', fontWeight: '700',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Approve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (() => {
                          const billPofIds = Array.from(new Set(items.map(item => item.pof_id))).filter(Boolean);
                          const billPofs = pofs.filter(p => billPofIds.includes(p.id));

                          const allFabricRolls = billPofs.flatMap(pof => pof.fabric_rolls || []);
                          const billDcNumbers = items.map(item => item.processing_dc_no).filter(Boolean);
                          const allReceivedRolls = billPofs.flatMap(pof => (pof.received_rolls || []).filter(r => billDcNumbers.includes(r.processing_dc_no)));

                          // Outbound metadata
                          const dispatchedByList = Array.from(new Set(billPofs.map(p => p.delivered_by).filter(Boolean)));
                          const vehiclesList = Array.from(new Set(billPofs.map(p => p.vehicle_details).filter(Boolean)));

                          // Inbound metadata
                          const receiptsMap = {};
                          allReceivedRolls.forEach(roll => {
                            const key = roll.pofrr_number || 'N/A';
                            if (!receiptsMap[key]) {
                              receiptsMap[key] = {
                                pofrr_number: key,
                                dc_number: roll.processing_dc_no || '—',
                                received_place: roll.received_place || '—',
                                received_by: roll.received_by || '—',
                                received_at: roll.received_at || null,
                              };
                            }
                          });
                          const receiptsList = Object.values(receiptsMap);

                          const dcNumbersList = Array.from(new Set(receiptsList.map(r => r.dc_number)));
                          const pofrrList = Array.from(new Set(receiptsList.map(r => r.pofrr_number)));
                          const placesList = Array.from(new Set(receiptsList.map(r => r.received_place)));
                          const receivedByList = Array.from(new Set(receiptsList.map(r => r.received_by)));
                          const receivedDatesList = Array.from(new Set(receiptsList.map(r => r.received_at ? new Date(r.received_at).toLocaleDateString('en-IN') : null).filter(Boolean)));

                          const totalOriginalGreigeQty = allFabricRolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
                          const totalActualSentQty = allFabricRolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);

                          return (
                            <tr>
                              <td colSpan={11} style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderLeft: '4px solid var(--color-primary)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                  
                                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', borderBottom: '1px dashed var(--border-current)', paddingBottom: '0.75rem' }}>
                                    {bill.partner_invoice_no && (
                                      <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', marginRight: '6px' }}>Partner Invoice No:</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: '800', fontFamily: 'monospace' }}>{bill.partner_invoice_no}</span>
                                      </div>
                                    )}
                                    {bill.partner_invoice_date && (
                                      <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', marginRight: '6px' }}>Partner Invoice Date:</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: '800' }}>
                                          {new Date(bill.partner_invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* POF Items list - expandable per-POF cards */}
                                  <div>
                                    <h4 style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 0.75rem 0', textTransform: 'uppercase' }}>
                                      POF Line Items
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                      {billPofs.map(pof => {
                                        const pofItem = items.find(it => it.pof_id === pof.id) || {};
                                        const fabricRolls = pof.fabric_rolls || [];
                                        const totalSentRolls = fabricRolls.length;
                                        const totalSentQty = fabricRolls.reduce((s, r) => s + parseFloat(r.actual_qty || r.qty || 0), 0);

                                        const pofDcNumbers = items.filter(it => it.pof_id === pof.id).map(it => it.processing_dc_no).filter(Boolean);
                                        const pofReceivedRolls = (pof.received_rolls || []).filter(r => pofDcNumbers.includes(r.processing_dc_no));

                                        // Group received rolls by POFRR/DC
                                        const dcGroupMap = {};
                                        pofReceivedRolls.forEach(r => {
                                          const key = r.processing_dc_no || '—';
                                          if (!dcGroupMap[key]) {
                                            dcGroupMap[key] = {
                                              dc_number: key,
                                              pofrr_number: r.pofrr_number || '—',
                                              received_at: r.received_at,
                                              received_place: r.received_place || '—',
                                              rolls: []
                                            };
                                          }
                                          dcGroupMap[key].rolls.push(r);
                                        });
                                        const dcGroups = Object.values(dcGroupMap);

                                        const totalRecdRolls = pofReceivedRolls.length;
                                        const totalRecdQty = pofReceivedRolls.reduce((s, r) => s + parseFloat(r.qty || 0), 0);
                                        const shrPct = totalSentQty > 0 ? ((totalSentQty - totalRecdQty) / totalSentQty) * 100 : 0;

                                        const pofExpandKey = `pofExpand_${pof.id}_${bill.id}`;
                                        const isPofExpanded = expandedPofId === pofExpandKey;

                                        return (
                                          <div key={pof.id} style={{ border: '1px solid var(--border-current)', borderRadius: '10px', overflow: 'hidden', backgroundColor: 'white' }}>
                                            {/* Clickable Header Row */}
                                            <div
                                              onClick={() => setExpandedPofId(isPofExpanded ? null : pofExpandKey)}
                                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', backgroundColor: '#f8fafc', cursor: 'pointer', borderBottom: isPofExpanded ? '1px solid var(--border-current)' : 'none', gap: '1rem', flexWrap: 'wrap' }}
                                            >
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', transform: isPofExpanded ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
                                                <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)', fontSize: '0.82rem' }}>{pof.pof_number}</strong>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>Sent: {new Date(pofItem.sent_date || pof.created_at).toLocaleDateString('en-IN')}</span>
                                              </div>
                                              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.72rem', flexWrap: 'wrap' }}>
                                                <span>📤 <strong>{totalSentRolls} rolls</strong> / <strong>{totalSentQty.toFixed(2)} m</strong> sent</span>
                                                <span>📥 <strong>{totalRecdRolls} rolls</strong> / <strong style={{ color: '#047857' }}>{totalRecdQty.toFixed(2)} m</strong> recd</span>
                                                <span style={{ fontWeight: '700', color: shrPct > 0 ? '#b45309' : '#047857' }}>Shrinkage: {shrPct.toFixed(2)}%</span>
                                              </div>
                                            </div>

                                            {/* Expanded Detail: Side-by-Side */}
                                            {isPofExpanded && (
                                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '1rem', padding: '0.85rem' }}>
                                                {/* Left: Greige Rolls Sent */}
                                                <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
                                                  <div style={{ padding: '0.45rem 0.6rem', backgroundColor: '#fefcf0', fontWeight: '800', fontSize: '0.7rem', color: '#854d0e', textTransform: 'uppercase', borderBottom: '1px solid var(--border-current)' }}>
                                                    📤 Greige Rolls Sent
                                                  </div>
                                                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                                                      <thead>
                                                        <tr style={{ backgroundColor: '#fefcf0', borderBottom: '1px solid var(--border-current)', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                                                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'left' }}>Greige Roll ID</th>
                                                          <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right' }}>Sent Qty</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {fabricRolls.map((r, ri) => (
                                                          <tr key={ri} style={{ borderBottom: '1px solid #fefbef' }}>
                                                            <td style={{ padding: '0.3rem 0.4rem', fontFamily: 'monospace', color: '#854d0e', fontWeight: '600' }}>{r.id}</td>
                                                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(r.actual_qty || r.qty || 0).toFixed(2)} m</td>
                                                          </tr>
                                                        ))}
                                                      </tbody>
                                                      <tfoot>
                                                        <tr style={{ backgroundColor: '#fefcf0', borderTop: '2px solid #fef08a', fontWeight: '800' }}>
                                                          <td style={{ padding: '0.3rem 0.4rem' }}>Total Sent</td>
                                                          <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', color: '#854d0e' }}>{totalSentQty.toFixed(2)} m</td>
                                                        </tr>
                                                      </tfoot>
                                                    </table>
                                                  </div>
                                                </div>

                                                {/* Right: Processed Rolls Received grouped by DC/POFRR */}
                                                <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
                                                  <div style={{ padding: '0.45rem 0.6rem', backgroundColor: '#f0fdf4', fontWeight: '800', fontSize: '0.7rem', color: '#047857', textTransform: 'uppercase', borderBottom: '1px solid var(--border-current)' }}>
                                                    📥 Processed Rolls Received
                                                  </div>
                                                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem' }}>
                                                    {dcGroups.length === 0 ? (
                                                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.7rem' }}>No received rolls found.</div>
                                                    ) : (
                                                      dcGroups.map(dcg => (
                                                        <div key={dcg.dc_number} style={{ border: '1px solid var(--border-current)', borderRadius: '6px', overflow: 'hidden' }}>
                                                          {/* DC/POFRR Header */}
                                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', padding: '0.35rem 0.5rem', backgroundColor: '#f0fdf4', fontSize: '0.68rem', fontWeight: '700', borderBottom: '1px solid var(--border-current)' }}>
                                                            <span>DC: <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{dcg.dc_number}</strong></span>
                                                            <span>POFRR: <strong style={{ fontFamily: 'monospace' }}>{dcg.pofrr_number}</strong></span>
                                                            <span>Place: <strong>{dcg.received_place}</strong></span>
                                                            <span>Date: <strong>{dcg.received_at ? new Date(dcg.received_at).toLocaleDateString('en-IN') : '—'}</strong></span>
                                                          </div>
                                                          {/* DC Rolls Table */}
                                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem' }}>
                                                            <thead>
                                                              <tr style={{ borderBottom: '1px solid #e2e8f0', color: 'var(--text-muted-current)', fontWeight: '700' }}>
                                                                <th style={{ padding: '0.25rem 0.4rem', textAlign: 'left' }}>Processed Roll ID</th>
                                                                <th style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}>Recd Qty</th>
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {dcg.rolls.map((roll, ri) => (
                                                                <tr key={ri} style={{ borderBottom: '1px dotted #e6fcf0' }}>
                                                                  <td style={{ padding: '0.25rem 0.4rem', fontFamily: 'monospace', color: '#047857', fontWeight: '600' }}>{roll.id}</td>
                                                                  <td style={{ padding: '0.25rem 0.4rem', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{parseFloat(roll.qty || 0).toFixed(2)} m</td>
                                                                </tr>
                                                              ))}
                                                            </tbody>
                                                          </table>
                                                        </div>
                                                      ))
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Rates and Invoice calculations */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>
                                    <div>
                                      <h4 style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>
                                        Process Rates {bill.status === 'submitted_for_approval' && <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 'normal', textTransform: 'none', marginLeft: '0.5rem' }}>(Editable)</span>}
                                      </h4>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', backgroundColor: 'white', border: '1px solid var(--border-current)' }}>
                                        <thead>
                                          <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left' }}>Process</th>
                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Rate / Meter</th>
                                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Calculated Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rates.map((rate, rIdx) => {
                                            const rateKey = rate.pof_id ? `${rate.pof_id}_${rate.process}` : rate.process;
                                            const currentRate = billRates[rateKey] !== undefined ? billRates[rateKey] : rate.rate_per_meter;
                                            const rateVal = parseFloat(currentRate) || 0;
                                            const greigeQty = rate.greige_qty !== undefined ? (parseFloat(rate.greige_qty) || 0) : totalGreigeQty;
                                            const calculatedRowTotal = greigeQty * rateVal;
                                            const isPending = bill.status === 'submitted_for_approval';

                                            return (
                                              <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                <td style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>
                                                  {rate.process} {rate.pof_number ? `(${rate.pof_number})` : ''}
                                                </td>
                                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                                                  {isPending ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                                      <span>₹</span>
                                                      <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={currentRate}
                                                        onChange={e => {
                                                          const val = e.target.value;
                                                          setEditedRates(prev => ({
                                                            ...prev,
                                                            [bill.id]: {
                                                              ...(prev[bill.id] || {}),
                                                              [rateKey]: val
                                                            }
                                                          }));
                                                        }}
                                                        style={{
                                                          width: '90px',
                                                          padding: '2px 6px',
                                                          fontSize: '0.75rem',
                                                          fontWeight: '700',
                                                          border: '1px solid var(--border-current)',
                                                          borderRadius: '4px',
                                                          textAlign: 'right'
                                                        }}
                                                      />
                                                    </div>
                                                  ) : (
                                                    <span style={{ fontFamily: 'monospace' }}>₹{Number(rate.rate_per_meter).toFixed(4)}</span>
                                                  )}
                                                </td>
                                                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: '600' }}>
                                                  ₹{Number(calculatedRowTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem', border: '1px solid var(--border-current)', borderRadius: '8px', backgroundColor: 'white', textAlign: 'right', fontSize: '0.78rem' }}>
                                      <div>Calculated Total: <strong>₹{Number(currentCalculatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                      <div>Tax Amount: <strong>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                      <div style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: '800', borderTop: '1px solid var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                                        Invoice Total: ₹{Number(currentInvoiceTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              </td>
                            </tr>
                          );
                        })()}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mobile view */}
      <div className="mobile-view">
        {filteredBills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)', backgroundColor: 'var(--surface-current)', borderRadius: '8px', border: '1px solid var(--border-current)', fontSize: '0.8rem' }}>
            No processing bills found for the selected filter.
          </div>
        ) : (
          filteredBills.map(bill => {
            const isExpanded = expandedId === bill.id;
            const badge = getStatusBadge(bill.status);
            
            // Compute totals from bill items
            const items = Array.isArray(bill.bill_items) ? bill.bill_items : [];
            const totalGreigeQty = items.reduce((sum, item) => sum + (parseFloat(item.greige_sent_qty) || 0), 0);
            const totalProcessedQty = items.reduce((sum, item) => sum + (parseFloat(item.processed_qty_recd) || 0), 0);
            const avgShrinkage = totalGreigeQty > 0 ? ((totalGreigeQty - totalProcessedQty) / totalGreigeQty) * 100 : 0;

            // Dynamically calculate bill subtotal and invoice total based on local edited values
            const billRates = editedRates[bill.id] || {};
            const rates = Array.isArray(bill.process_rates) ? bill.process_rates : [];
            const currentCalculatedTotal = rates.reduce((sum, r) => {
              const rateKey = r.pof_id ? `${r.pof_id}_${r.process}` : r.process;
              const currentRateInput = billRates[rateKey];
              const rateVal = currentRateInput !== undefined ? parseFloat(currentRateInput) : parseFloat(r.rate_per_meter);
              const rate = isNaN(rateVal) ? 0 : rateVal;
              const greigeQty = r.greige_qty !== undefined ? (parseFloat(r.greige_qty) || 0) : totalGreigeQty;
              return sum + (greigeQty * rate);
            }, 0);
            const currentInvoiceTotal = currentCalculatedTotal + parseFloat(bill.tax_amount || 0);

            return (
              <div key={bill.id} className="mobile-card" style={{ borderLeft: isExpanded ? '3px solid var(--color-primary)' : '1px solid var(--border-current)', padding: '0.85rem' }}>
                <div className="mobile-card-header" onClick={() => setExpandedId(isExpanded ? null : bill.id)} style={{ cursor: 'pointer', borderBottom: 'none', paddingBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {bill.bill_number}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                      {bill.created_at ? new Date(bill.created_at).toLocaleDateString('en-IN') : '—'}
                    </span>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    backgroundColor: badge.bg, color: badge.text,
                    padding: '2px 6px', borderRadius: '4px',
                    fontSize: '0.65rem', fontWeight: '700'
                  }}>
                    {badge.icon} {badge.label}
                  </span>
                </div>

                <div className="mobile-card-body" onClick={() => setExpandedId(isExpanded ? null : bill.id)} style={{ cursor: 'pointer', gap: '0.4rem', marginTop: '0.25rem' }}>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Partner:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem', fontWeight: '600' }}>{bill.partner_name}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Greige Sent:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem' }}>{totalGreigeQty.toFixed(2)} m</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Processed Recd:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem', color: '#047857', fontWeight: '600' }}>{totalProcessedQty.toFixed(2)} m</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Avg Shrinkage:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.72rem', fontWeight: '700', color: avgShrinkage > 0 ? '#b45309' : '#047857' }}>{avgShrinkage.toFixed(2)}%</span>
                  </div>
                  <div className="mobile-card-row" style={{ borderTop: '1px dashed var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Calculated Total:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--color-primary)' }}>₹{Number(currentCalculatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label" style={{ fontSize: '0.72rem' }}>Invoice Total:</span>
                    <span className="mobile-card-value" style={{ fontSize: '0.78rem', fontWeight: '800' }}>₹{Number(currentInvoiceTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="mobile-card-actions" style={{ marginTop: '0.6rem', paddingTop: '0.6rem' }}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : bill.id)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                  >
                    <Eye size={12} /> {isExpanded ? 'Hide' : 'Review'}
                  </button>
                  {bill.status === 'submitted_for_approval' && (
                    <button
                      onClick={() => handleApprove(bill)}
                      disabled={submittingId === bill.id}
                      style={{
                        backgroundColor: '#dcfce7',
                        color: '#166534',
                        border: '1px solid #86efac',
                        padding: '4px 8px', borderRadius: '4px',
                        fontSize: '0.7rem', fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Approve
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-current)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    {/* POF Items Section */}
                    <div>
                      <div style={{ fontWeight: '800', marginBottom: '0.4rem', textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>POF Line Items</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {items.map(item => (
                          <div key={item.pof_id} style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.6rem', fontSize: '0.72rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
                              <span style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{item.pof_number}</span>
                              <span style={{ color: 'var(--text-muted-current)', fontWeight: 'normal' }}>
                                Sent: {new Date(item.sent_date).toLocaleDateString('en-IN')}
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', color: 'var(--text-muted-current)', marginBottom: '4px' }}>
                              <div>Greige Sent: <strong>{item.greige_sent_rolls} rolls</strong> / <strong>{Number(item.greige_sent_qty).toFixed(1)}m</strong></div>
                              <div>Processed Recd: <strong>{item.processed_rolls_recd} rolls</strong> / <strong>{Number(item.processed_qty_recd).toFixed(1)}m</strong></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-current)', paddingTop: '4px', marginTop: '4px' }}>
                              <span>Shrinkage: <strong style={{ color: parseFloat(item.shrinkage) > 0 ? '#b45309' : '#047857' }}>{Number(item.shrinkage).toFixed(2)}%</strong></span>
                              <span>Recd: <strong>{item.received_date ? new Date(item.received_date).toLocaleDateString('en-IN') : '—'}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Process Rates Section */}
                    <div>
                      <div style={{ fontWeight: '800', marginBottom: '0.4rem', textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>
                        Process Rates {bill.status === 'submitted_for_approval' && <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 'normal', textTransform: 'none', marginLeft: '0.4rem' }}>(Editable)</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {rates.map((rate, rIdx) => {
                          const rateKey = rate.pof_id ? `${rate.pof_id}_${rate.process}` : rate.process;
                          const currentRate = billRates[rateKey] !== undefined ? billRates[rateKey] : rate.rate_per_meter;
                          const rateVal = parseFloat(currentRate) || 0;
                          const greigeQty = rate.greige_qty !== undefined ? (parseFloat(rate.greige_qty) || 0) : totalGreigeQty;
                          const calculatedRowTotal = greigeQty * rateVal;
                          const isPending = bill.status === 'submitted_for_approval';

                          return (
                            <div key={rIdx} style={{ backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.6rem', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              <div style={{ fontWeight: '600', color: 'var(--text-main-current)' }}>
                                {rate.process} {rate.pof_number ? `(${rate.pof_number})` : ''}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span style={{ color: 'var(--text-muted-current)' }}>Rate:</span>
                                  {isPending ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>₹</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={currentRate}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setEditedRates(prev => ({
                                            ...prev,
                                            [bill.id]: {
                                              ...(prev[bill.id] || {}),
                                              [rateKey]: val
                                            }
                                          }));
                                        }}
                                        style={{
                                          width: '110px',
                                          height: '40px',
                                          padding: '0.3rem 0.5rem',
                                          fontSize: '16px',
                                          fontWeight: '700',
                                          border: '1px solid var(--border-current)',
                                          borderRadius: '4px',
                                          textAlign: 'right'
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <strong style={{ fontFamily: 'monospace' }}>₹{Number(rate.rate_per_meter).toFixed(4)}</strong>
                                  )}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ color: 'var(--text-muted-current)' }}>Row Total: </span>
                                  <strong>₹{Number(calculatedRowTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Totals Summary */}
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', border: '1px solid var(--border-current)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Calculated Total:</span><strong>₹{Number(currentCalculatedTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tax Amount:</span><strong>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-current)', paddingTop: '0.4rem', marginTop: '0.2rem', color: 'var(--color-primary)', fontSize: '0.78rem', fontWeight: '800' }}>
                        <span>Invoice Total:</span>
                        <span>₹{Number(currentInvoiceTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


