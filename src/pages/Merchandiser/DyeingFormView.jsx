import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Loader, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function DyeingFormView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [form, setForm] = useState(null);
  const [orders, setOrders] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const basePath = profile?.role === 'admin' ? '/admin' : '/merchandiser';

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [formRes, countsRes] = await Promise.all([
        supabase
          .from('dyeing_order_forms')
          .select(`
            *,
            dyeing_unit:master_partners(partner_name),
            creator:profiles!dyeing_order_forms_created_by_fkey(full_name),
            approver:profiles!dyeing_order_forms_approved_by_fkey(full_name)
          `)
          .eq('id', id)
          .single(),
        supabase.from('master_yarn_counts').select('*'),
      ]);

      if (formRes.error) throw formRes.error;
      setForm(formRes.data);
      setYarnCounts(countsRes.data || []);

      // Fetch linked orders
      if (formRes.data?.order_ids?.length) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('id, order_number, design_no, design_name, technical_specs, master_brands(brand_name)')
          .in('id', formRes.data.order_ids);
        setOrders(ordersData || []);
      }
    } catch (err) {
      console.error(err);
      alert('Error loading DOF: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatYarn = (countId) => {
    const yarn = yarnCounts.find(y => y.id === countId);
    if (!yarn) return countId || '-';
    return `${yarn.count_value} - ${yarn.material} - ${yarn.product_type}`;
  };

  const handlePrint = () => window.print();

  const getTotalKg = () =>
    (form?.yarn_allocations || []).reduce((s, a) => s + parseFloat(a.total_kg || 0), 0).toFixed(2);

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':  return { color: '#92400e', bg: '#fef3c7', border: '#fcd34d', icon: <Clock size={16}/>, text: 'APPROVAL PENDING' };
      case 'approved': return { color: '#166534', bg: '#dcfce7', border: '#86efac', icon: <CheckCircle size={16}/>, text: 'APPROVED' };
      case 'rejected': return { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', icon: <XCircle size={16}/>, text: 'REJECTED' };
      default:         return { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', icon: null, text: status?.toUpperCase() };
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <Loader size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'var(--text-muted-current)' }}>Loading Dyeing Order Form...</p>
    </div>
  );

  if (!form) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }}>
      <p>DOF not found.</p>
      <button onClick={() => navigate(`${basePath}/dyeing-forms`)} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
        ← Back to DOF List
      </button>
    </div>
  );

  const statusConfig = getStatusConfig(form.status);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem' }}>

      {/* Screen-only action bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate(`${basePath}/dyeing-forms`)}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ArrowLeft size={16} /> Back to DOF List
        </button>
        <button
          onClick={handlePrint}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Printer size={16} /> Print DOF
        </button>
      </div>

      {/* ─── PRINTABLE INVOICE ─── */}
      <div
        className="print-container"
        style={{
          backgroundColor: '#fff',
          color: '#000',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          padding: '2.5rem 3rem',
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          fontSize: '13px',
        }}
      >

        {/* ── Company Header ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '3px solid #7f1d1d', paddingBottom: '1.25rem', marginBottom: '1.5rem'
        }}>
          <div>
            <img
              src="/logo.png"
              alt="Company Logo"
              style={{ maxHeight: '70px', maxWidth: '220px', objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
            />
            <div style={{ display: 'none' }}>
              <h2 style={{ margin: 0, color: '#7f1d1d', fontSize: '1.5rem', fontWeight: '900', letterSpacing: '1px' }}>ASHOK TEXTILES</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#555' }}>Fabric Manufacturing ERP</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: '#7f1d1d', letterSpacing: '1px' }}>
              DYEING ORDER FORM
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '1.1rem', fontWeight: '700', color: '#111' }}>{form.dof_number}</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#666' }}>
              Date: {new Date(form.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* ── Meta Info Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>Dyeing Unit Details</p>
            {[
              ['Dyeing Unit Name', form.dyeing_unit?.partner_name || '-'],
              ['Expected Delivery', form.expected_delivery_date ? new Date(form.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Not set'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#555', minWidth: '140px', flexShrink: 0 }}>{label}:</span>
                <span style={{ fontWeight: '600' }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem' }}>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>Document Details</p>
            {[
              ['Prepared By', form.creator?.full_name || '-'],
              ['Prepared On', new Date(form.created_at).toLocaleString('en-IN')],
              ['Linked Orders', orders.map(o => o.order_number).join(', ') || '-'],
              ['Status', form.status?.toUpperCase()],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ color: '#555', minWidth: '120px', flexShrink: 0 }}>{label}:</span>
                <span style={{ fontWeight: '600' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Linked Orders Summary ── */}
        {orders.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
              Linked Orders
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Order No.</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Design No.</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Design Name</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Buyer</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '6px 10px', fontWeight: '600' }}>{o.order_number}</td>
                    <td style={{ padding: '6px 10px' }}>{o.design_no}</td>
                    <td style={{ padding: '6px 10px' }}>{o.design_name}</td>
                    <td style={{ padding: '6px 10px' }}>{o.master_brands?.brand_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Yarn Allocations ── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
            Yarn Allocation Details
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Order No.</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Type</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Colour</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Base Qty (kg)</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontSize: '11px', fontWeight: '700' }}>Excess %</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Total Qty (kg)</th>
              </tr>
            </thead>
            <tbody>
              {(form.yarn_allocations || []).map((a, i) => {
                const ord = orders.find(o => o.id === a.orderId);
                return (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '6px 10px', fontWeight: '600' }}>{ord?.order_number || '-'}</td>
                    <td style={{ padding: '6px 10px', textTransform: 'capitalize' }}>{a.type}</td>
                    <td style={{ padding: '6px 10px' }}>{formatYarn(a.countId)}</td>
                    <td style={{ padding: '6px 10px' }}>{a.colour}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>{parseFloat(a.base_kg || 0).toFixed(2)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>{a.excess_pct}%</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700' }}>{parseFloat(a.total_kg || 0).toFixed(2)}</td>
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #7f1d1d' }}>
                <td colSpan={6} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', fontSize: '12px' }}>GRAND TOTAL:</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d', fontSize: '13px' }}>{getTotalKg()} kg</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Count & Colour Summary + Count Summary side by side ── */}
        {(form.summary || []).length > 0 && (() => {
          // Build count-only summary (aggregate across colours)
          const countMap = {};
          form.summary.forEach(s => {
            const label = s.yarnLabel || formatYarn(s.countId);
            if (!countMap[label]) countMap[label] = 0;
            countMap[label] += parseFloat(s.total_kg || 0);
          });
          const countSummary = Object.entries(countMap).map(([label, total_kg]) => ({ label, total_kg }));

          return (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem', marginBottom: '2rem', alignItems: 'start' }}>
              {/* Count & Colour Wise Summary */}
              <div>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
                  Count & Colour Wise Summary
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Colour</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Total (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.summary.map((s, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '6px 10px', fontWeight: '500', fontSize: '11px' }}>{s.yarnLabel || formatYarn(s.countId)}</td>
                        <td style={{ padding: '6px 10px', fontSize: '11px' }}>{s.colour}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', fontSize: '11px' }}>{parseFloat(s.total_kg || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: '#f3f4f6', borderTop: '1px solid #7f1d1d' }}>
                      <td colSpan={2} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', fontSize: '11px' }}>Total:</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d', fontSize: '11px' }}>
                        {form.summary.reduce((s, r) => s + parseFloat(r.total_kg || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Count-wise Summary (aggregated, no colour breakdown) */}
              <div>
                <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7f1d1d', borderBottom: '1px solid #7f1d1d', paddingBottom: '4px', marginBottom: '0.75rem' }}>
                  Count Wise Summary
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '700' }}>Yarn Count</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '700' }}>Total (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {countSummary.map((c, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '6px 10px', fontWeight: '600', fontSize: '11px' }}>{c.label}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', fontSize: '11px' }}>{c.total_kg.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: '#f3f4f6', borderTop: '1px solid #7f1d1d' }}>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', fontSize: '11px' }}>Grand Total:</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d', fontSize: '11px' }}>
                        {countSummary.reduce((s, c) => s + c.total_kg, 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ── Signature / Approval Section ── */}
        <div style={{ borderTop: '2px solid #7f1d1d', paddingTop: '1.5rem', marginTop: '1rem' }}>

          {form.status === 'pending' && (
            <div style={{
              border: '2px dashed #fcd34d', borderRadius: '8px',
              padding: '1.25rem 1.5rem',
              backgroundColor: '#fffbeb',
              display: 'flex', alignItems: 'center', gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <Clock size={24} color="#d97706" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontWeight: '800', color: '#92400e', fontSize: '14px' }}>APPROVAL PENDING</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#78350f' }}>
                  This Dyeing Order Form has been submitted and is awaiting approval from the Managing Partner.
                </p>
              </div>
            </div>
          )}

          {form.status === 'rejected' && (
            <div style={{
              border: '2px solid #fca5a5', borderRadius: '8px',
              padding: '1.25rem 1.5rem',
              backgroundColor: '#fee2e2',
              display: 'flex', alignItems: 'center', gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              <XCircle size={24} color="#dc2626" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontWeight: '800', color: '#991b1b', fontSize: '14px' }}>REJECTED</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#7f1d1d' }}>
                  This Dyeing Order Form was not approved.{form.approval_notes ? ` Reason: ${form.approval_notes}` : ''}
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
            {/* Prepared by */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '200px', borderTop: '1px solid #000', paddingTop: '8px', marginTop: '50px' }}>
                <p style={{ margin: 0, fontWeight: '600', fontSize: '12px' }}>{form.creator?.full_name || 'Merchandiser'}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#666' }}>Prepared By</p>
              </div>
            </div>

            {/* Approved By */}
            <div style={{ textAlign: 'center' }}>
              {form.status === 'approved' ? (
                <div style={{ width: '240px', paddingTop: '8px' }}>
                  <div style={{
                    backgroundColor: '#dcfce7', border: '1px solid #86efac',
                    borderRadius: '6px', padding: '0.6rem 1rem', marginBottom: '8px',
                    display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center'
                  }}>
                    <CheckCircle size={14} color="#166534" />
                    <span style={{ fontWeight: '700', color: '#166534', fontSize: '12px' }}>APPROVED</span>
                  </div>
                  <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '13px' }}>T. Vijayakumar</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#444' }}>Managing Partner</p>
                    {form.updated_at && (
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>
                        {new Date(form.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ width: '220px', borderTop: '1px dashed #999', paddingTop: '8px', marginTop: '50px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>T. Vijayakumar</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#888' }}>Managing Partner</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#aaa', fontStyle: 'italic' }}>Approval Signature</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            padding: 1.5rem 2rem;
            box-shadow: none;
            border: none;
            border-radius: 0;
            font-size: 12px;
          }
          .no-print { display: none !important; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </div>
  );
}
