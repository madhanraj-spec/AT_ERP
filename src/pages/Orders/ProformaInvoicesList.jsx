import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Printer,
  Calendar,
  Building,
  Hash,
  Loader,
  AlertCircle,
  X
} from 'lucide-react';
import CreateProformaInvoiceModal from './CreateProformaInvoiceModal';
import ViewPiModal from '../../components/ViewPiModal';

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtNum = (n, dec = 2) =>
  isNaN(parseFloat(n)) ? '0.00' : parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export default function ProformaInvoicesList() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [proformaInvoices, setProformaInvoices] = useState([]);
  const [ordersMap, setOrdersMap] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPi, setEditingPi] = useState(null);
  const [viewingPi, setViewingPi] = useState(null);

  useEffect(() => {
    fetchProformaInvoices();
  }, [profile?.id, profile?.role]);

  const fetchProformaInvoices = async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders for lookup
      const { data: ords } = await supabase.from('orders').select('id, order_number, design_no, design_name, merchandiser_id, merchandiser_name');
      const oMap = {};
      (ords || []).forEach(o => { oMap[o.id] = o; });
      setOrdersMap(oMap);

      // 2. Query PIs
      let query = supabase.from('proforma_invoices').select('*').order('created_at', { ascending: false });

      // Role filter: Merchandiser sees only PIs created by them or linked to their orders
      if (profile?.role === 'merchandiser') {
        const myOrderIds = (ords || []).filter(o => o.merchandiser_id === profile.id).map(o => o.id);
        if (myOrderIds.length > 0) {
          query = query.or(`created_by.eq.${profile.id},order_id.in.(${myOrderIds.join(',')})`);
        } else {
          query = query.eq('created_by', profile.id);
        }
      }

      const { data: piData, error: piErr } = await query;
      if (piErr) throw piErr;

      setProformaInvoices(piData || []);
    } catch (err) {
      console.error('Error fetching Proforma Invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePi = async (piId, invNo) => {
    if (!window.confirm(`Are you sure you want to delete Proforma Invoice ${invNo}?`)) return;
    try {
      const { error } = await supabase.from('proforma_invoices').delete().eq('id', piId);
      if (error) throw error;
      alert('Proforma Invoice deleted successfully.');
      fetchProformaInvoices();
    } catch (err) {
      console.error(err);
      alert('Error deleting PI: ' + err.message);
    }
  };

  const filteredPis = proformaInvoices.filter(pi => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();

    // Check linked orders numbers
    const linkedOrderNos = (pi.order_ids || (pi.order_id ? [pi.order_id] : []))
      .map(id => ordersMap[id]?.order_number)
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const linkedDesignNos = (pi.order_ids || (pi.order_id ? [pi.order_id] : []))
      .map(id => ordersMap[id]?.design_no)
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const linkedDesignNames = (pi.order_ids || (pi.order_id ? [pi.order_id] : []))
      .map(id => ordersMap[id]?.design_name)
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const itemsDesignSearch = (pi.items || []).map(it => `${it.design_no || ''} ${it.design_name || ''}`).join(' ').toLowerCase();

    return (
      pi.invoice_number?.toLowerCase().includes(term) ||
      pi.billed_to_name?.toLowerCase().includes(term) ||
      pi.buyer_po_number?.toLowerCase().includes(term) ||
      linkedOrderNos.includes(term) ||
      linkedDesignNos.includes(term) ||
      linkedDesignNames.includes(term) ||
      itemsDesignSearch.includes(term)
    );
  });

  return (
    <div className="fade-in" style={{ padding: '1.5rem', width: '100%', maxWidth: '100%', margin: 0 }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={28} color="var(--color-primary)" />
            <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--color-primary)', margin: 0 }}>
              Proforma Invoices
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0 0' }}>
            {profile?.role === 'merchandiser'
              ? 'Showing Proforma Invoices created by you.'
              : 'Showing all Proforma Invoices across all merchandisers.'}
          </p>
        </div>

        <button
          onClick={() => {
            setEditingPi(null);
            setShowCreateModal(true);
          }}
          className="btn hover-lift"
          style={{
            background: 'var(--color-primary)', color: 'white', border: 'none',
            padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: '700',
            display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(128,0,0,0.18)', fontSize: '0.9rem'
          }}
        >
          <Plus size={18} /> Create Proforma Invoice
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div style={{
        background: 'white', padding: '1rem', borderRadius: '12px',
        border: '1px solid var(--border-current)', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by PI number, Buyer / Billed To, PO Number, Order Number, Design Name, Design No..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '0.55rem 0.75rem 0.55rem 2.4rem', borderRadius: '8px',
              border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Main Table View */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flexDirection: 'column', gap: '1rem' }}>
          <Loader size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: '#64748b' }}>Loading Proforma Invoices...</p>
        </div>
      ) : filteredPis.length === 0 ? (
        <div style={{
          background: 'white', padding: '3rem', borderRadius: '16px', border: '1px solid var(--border-current)',
          textAlign: 'center', color: '#64748b', boxShadow: 'var(--shadow-sm)'
        }}>
          <FileText size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#334155', margin: '0 0 0.5rem 0' }}>
            No Proforma Invoices Found
          </h3>
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            {searchTerm ? 'No invoices match your search query.' : 'Click "+ Create Proforma Invoice" above to generate your first invoice.'}
          </p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border-current)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: '700' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Invoice Details</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Billed To / Party</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Linked Orders</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Design Name & No</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Qty</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Taxable Amt (₹)</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Value (₹)</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPis.map(pi => {
                  const linkedIds = pi.order_ids || (pi.order_id ? [pi.order_id] : []);
                  const linkedOrderObjs = linkedIds.map(id => ordersMap[id]).filter(Boolean);

                  return (
                    <tr key={pi.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover-highlight">
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                          {pi.invoice_number}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '2px' }}>
                          <Calendar size={12} /> {formatDate(pi.invoice_date)}
                          {pi.buyer_po_number && <span style={{ marginLeft: '6px', background: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>PO: {pi.buyer_po_number}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: '700', color: '#1e293b' }}>{pi.billed_to_name || '—'}</div>
                        <div style={{ fontSize: '0.73rem', color: '#64748b' }}>GSTIN: {pi.billed_to_gstin || '—'}</div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {linkedOrderObjs.length > 0 ? (
                            linkedOrderObjs.map(o => (
                              <span
                                key={o.id}
                                style={{
                                  background: 'rgba(128, 0, 0, 0.08)', color: 'var(--color-primary)',
                                  padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700'
                                }}
                              >
                                {o.order_number}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {linkedOrderObjs.length > 0 ? (
                            linkedOrderObjs.map(o => (
                              <div key={o.id} style={{ fontSize: '0.8rem' }}>
                                <span style={{ fontWeight: '700', color: '#1e293b' }}>{o.design_no || '—'}</span>
                                {o.design_name ? (
                                  <span style={{ color: '#64748b', marginLeft: '6px' }}>({o.design_name})</span>
                                ) : null}
                              </div>
                            ))
                          ) : Array.isArray(pi.items) && pi.items.length > 0 ? (
                            pi.items.map((it, idx) => (
                              <div key={idx} style={{ fontSize: '0.8rem' }}>
                                <span style={{ fontWeight: '700', color: '#1e293b' }}>{it.design_no || '—'}</span>
                                {it.design_name ? (
                                  <span style={{ color: '#64748b', marginLeft: '6px' }}>({it.design_name})</span>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '600' }}>
                        {fmtNum(pi.qty, 0)} {pi.uom || 'Mtr'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '600' }}>
                        ₹{fmtNum(pi.taxable_value || pi.amount)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                        ₹{fmtNum(pi.total_invoice_price || pi.amount)}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                          <button
                            onClick={() => setViewingPi(pi)}
                            title="View / Print PI"
                            style={{ background: '#f1f5f9', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#3b82f6' }}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingPi(pi);
                              setShowCreateModal(true);
                            }}
                            title="Edit PI"
                            style={{ background: '#f1f5f9', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#d97706' }}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeletePi(pi.id, pi.invoice_number)}
                            title="Delete PI"
                            style={{ background: '#fef2f2', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', color: '#dc2626' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <CreateProformaInvoiceModal
          initialPi={editingPi}
          onClose={() => {
            setShowCreateModal(false);
            setEditingPi(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingPi(null);
            fetchProformaInvoices();
          }}
        />
      )}

      {/* View / Print Detail Modal */}
      {viewingPi && (
        <ViewPiModal
          pi={viewingPi}
          ordersMap={ordersMap}
          onClose={() => setViewingPi(null)}
        />
      )}
    </div>
  );
}


