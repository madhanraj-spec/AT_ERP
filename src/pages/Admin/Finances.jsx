import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Clock, Loader, Eye, ChevronDown, ChevronUp, Check, X, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ReceiptPrintModal from '../GreigeYarn/ReceiptPrintModal';

export default function AdminFinances() {
  const [activeTab, setActiveTab] = useState('greige');
  const { profile } = useAuth();

  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: '0', padding: '0 0.25rem' }} className="fade-in">
      <h1 style={{ marginBottom: '0.25rem' }}>Finances</h1>
      <p style={{ color: 'var(--text-muted-current)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Track, manage, and settle invoices and logs across production steps.
      </p>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--border-current)', marginBottom: '1.5rem' }}>
        {[
          { key: 'greige', label: '🧶 Greige' },
          { key: 'dyeing', label: '🎨 Dyeing' },
          { key: 'warping', label: '🔧 Warping' },
          { key: 'sizing', label: '📏 Sizing' },
          { key: 'weaving', label: '🏭 Weaving' },
          { key: 'processing', label: '⚙️ Processing' },
          { key: 'all_bills', label: '🧾 All Bills' }
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
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'greige' && <GreigeFinances profile={profile} />}
      {activeTab === 'dyeing' && <DyeingFinances profile={profile} />}
      {activeTab === 'warping' && <ProductionFinanceSettlement profile={profile} formType="warping" />}
      {activeTab === 'sizing' && <ProductionFinanceSettlement profile={profile} formType="sizing" />}
      {activeTab === 'weaving' && <ProductionFinanceSettlement profile={profile} formType="weaving" />}
      {activeTab === 'processing' && <ProcessingFinances profile={profile} />}
      {activeTab === 'all_bills' && <AllSettledBills profile={profile} />}
    </div>
  );
}

// ── Placeholder Component ──────────────────────────────
function FinanceSubTabPlaceholder({ name, icon }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }} className="fade-in">
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{icon}</div>
      <h3>{name} Finance Management</h3>
      <p>{name} invoices and settlement actions will appear here.</p>
    </div>
  );
}

// ── Greige Finance Management ──────────────────────────────
function GreigeFinances({ profile }) {
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [expandedMills, setExpandedMills] = useState({});
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [settlingReceiptNo, setSettlingReceiptNo] = useState(null);

  useEffect(() => {
    fetchReceipts();
  }, []);

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
        .eq('finance_approval_status', 'approved') // Only Approved GYRR
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (err) {
      console.error('Error fetching greige receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (group) => {
    if (!window.confirm(`Mark GYRR ${group.receipt_no} as Settled?`)) return;
    setSettlingReceiptNo(group.receipt_no);
    try {
      const receiptIds = group.items.map(i => i.id);
      const { error } = await supabase
        .from('greige_yarn_receipts')
        .update({
          finance_settlement_status: 'settled',
          finance_settled_by: profile?.id,
          finance_settled_at: new Date().toISOString(),
        })
        .in('id', receiptIds);

      if (error) throw error;
      fetchReceipts();
    } catch (err) {
      alert('Error settling receipt: ' + err.message);
    } finally {
      setSettlingReceiptNo(null);
    }
  };

  const toggleMillExpand = (millName) => {
    setExpandedMills(prev => ({
      ...prev,
      [millName]: !prev[millName]
    }));
  };

  // Grouping logic: Query results -> unique receipt_no -> grouped by Mill Name
  const millsList = React.useMemo(() => {
    // 1. Group rows by receipt_no
    const groupedByReceipt = {};
    receipts.forEach(row => {
      const key = row.receipt_no;
      if (!groupedByReceipt[key]) {
        groupedByReceipt[key] = {
          ...row,
          items: []
        };
      }
      groupedByReceipt[key].items.push(row);
    });

    // 2. Group receipts by mill name & aggregate metrics
    const groupedByMill = {};
    Object.values(groupedByReceipt).forEach(receipt => {
      const millName = receipt.master_partners?.partner_name || 'Unknown Spinning Mill';
      if (!groupedByMill[millName]) {
        groupedByMill[millName] = {
          millName,
          receipts: [],
          totalReceipts: 0,
          needSettling: 0,
          totalValue: 0,
          yetToSettle: 0
        };
      }
      const millGroup = groupedByMill[millName];
      millGroup.receipts.push(receipt);
      millGroup.totalReceipts += 1;

      const isSettled = receipt.finance_settlement_status === 'settled';
      if (!isSettled) {
        millGroup.needSettling += 1;
        millGroup.yetToSettle += Number(receipt.invoice_amount || 0);
      }
      millGroup.totalValue += Number(receipt.invoice_amount || 0);
    });

    return Object.values(groupedByMill).sort((a, b) => a.millName.localeCompare(b.millName));
  }, [receipts]);

  const getSettlementBadge = (status) => {
    if (status === 'settled') {
      return { bg: '#dcfce7', text: '#166534', label: 'SETTLED', icon: <CheckCircle size={11} /> };
    }
    return { bg: '#fef3c7', text: '#92400e', label: 'PENDING', icon: <Clock size={11} /> };
  };

  const getCountLabel = (item) => {
    if (!item.master_yarn_counts) return '-';
    const { count_value, material, product_type } = item.master_yarn_counts;
    return `${count_value} ${material} ${product_type || ''}`.trim();
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (millsList.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }} className="glass-panel">
        <h3 style={{ margin: 0 }}>No Approved Receipts</h3>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Approved GYRRs from spinning mills will appear here for payment settlement.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="fade-in">
      {millsList.map(mill => {
        const isExpanded = !!expandedMills[mill.millName];
        return (
          <div key={mill.millName} className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-current)' }}>
            
            {/* Header Accordion Bar */}
            <div 
              onClick={() => toggleMillExpand(mill.millName)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                cursor: 'pointer',
                backgroundColor: isExpanded ? 'rgba(0,0,0,0.01)' : 'transparent',
                transition: 'background-color 0.2s',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {mill.millName}
                </h3>
              </div>

              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Receipts</span>
                  <span style={{ fontSize: '1rem', fontWeight: '700' }}>{mill.totalReceipts}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#b45309', textTransform: 'uppercase', fontWeight: 'bold' }}>Need Settling</span>
                  <span style={{ fontSize: '1rem', fontWeight: '700', color: '#d97706' }}>{mill.needSettling}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Value</span>
                  <span style={{ fontSize: '1rem', fontWeight: '700' }}>₹{mill.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-primary-light)', textTransform: 'uppercase', fontWeight: 'bold' }}>To Be Settled</span>
                  <span style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--color-primary)' }}>₹{mill.yetToSettle.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div style={{ color: 'var(--text-muted-current)', marginLeft: '0.5rem' }}>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
            </div>

            {/* Expanded Content Table */}
            {isExpanded && (
              <div style={{ width: '100%', overflowX: 'hidden', borderTop: '1px solid var(--border-current)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(0,0,0,0.015)' }}>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Date & Time</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>GYRR</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Inv No</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Inv Date</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Count</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Bags</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Cones</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Wt/Bag</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Wt/Cone</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Total Wt</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Rate/Kg</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Inv Value</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '0.4rem 0.25rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mill.receipts.map(receipt => {
                      const rowSpan = receipt.items.length;
                      return (
                        <React.Fragment key={receipt.receipt_no}>
                          {receipt.items.map((item, idx) => {
                            const isFirst = idx === 0;
                            const isLast = idx === receipt.items.length - 1;
                            const tdPad = { padding: '0.35rem 0.25rem', fontSize: '0.72rem', verticalAlign: 'middle' };
                            const groupBorder = '2px solid var(--color-primary)';
                            const itemBorder = isLast ? groupBorder : '1px dashed var(--border-current)';
                            const statusVal = receipt.finance_settlement_status || 'pending';
                            const isSettled = statusVal === 'settled';
                            const badge = getSettlementBadge(statusVal);

                            return (
                              <tr key={item.id} style={{ backgroundColor: 'transparent' }}>
                                {isFirst && (
                                  <>
                                    <td rowSpan={rowSpan} style={{ ...tdPad, whiteSpace: 'nowrap', borderBottom: groupBorder }}>
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '600' }}>
                                          {new Date(receipt.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                        </span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>
                                          {new Date(receipt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                    </td>
                                    <td rowSpan={rowSpan} style={{ ...tdPad, whiteSpace: 'nowrap', fontWeight: 'bold', borderBottom: groupBorder }}>
                                      <span style={{ color: 'var(--color-primary)' }}>{receipt.receipt_no}</span>
                                    </td>
                                    <td rowSpan={rowSpan} style={{ ...tdPad, whiteSpace: 'nowrap', borderBottom: groupBorder }}>{receipt.invoice_no || '-'}</td>
                                    <td rowSpan={rowSpan} style={{ ...tdPad, whiteSpace: 'nowrap', borderBottom: groupBorder }}>
                                      {receipt.invoice_date ? new Date(receipt.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                    </td>
                                  </>
                                )}

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
                                      ₹{Number(receipt.invoice_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
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
                                          onClick={() => setSelectedReceipt(receipt)}
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
                                            gap: '2px'
                                          }}
                                        >
                                          <Eye size={10} /> View
                                        </button>
                                        {!isSettled && (
                                          <button
                                            onClick={() => handleSettle(receipt)}
                                            disabled={settlingReceiptNo === receipt.receipt_no}
                                            style={{
                                              backgroundColor: '#dcfce7',
                                              color: '#166534',
                                              border: '1px solid #86efac',
                                              padding: '3px 6px',
                                              borderRadius: '4px',
                                              fontSize: '0.7rem',
                                              fontWeight: '700',
                                              cursor: settlingReceiptNo === receipt.receipt_no ? 'wait' : 'pointer',
                                              opacity: settlingReceiptNo === receipt.receipt_no ? 0.6 : 1,
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '2px'
                                            }}
                                          >
                                            <Check size={10} /> Settle
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
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Printable Receipt Modal */}
      {selectedReceipt && (
        <ReceiptPrintModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

// ── Dyeing Finance Management (Admin module) ──────────────────
function FinancesModalWrapper({ title, onClose, children }) {
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

function FinancesGYDRDetailModal({ data, yarnCounts, onClose }) {
  const { receipt, items } = data;
  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    return y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : 'Unknown';
  };

  return (
    <FinancesModalWrapper title={`Greige Yarn Delivery Receipt: ${receipt.gydr_number}`} onClose={onClose}>
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
    </FinancesModalWrapper>
  );
}

function FinancesDYRRDetailModal({ data, yarnCounts, onClose }) {
  const { receipt, items } = data;
  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    return y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : 'Unknown';
  };

  return (
    <FinancesModalWrapper title={`Dyed Yarn Receipt: ${receipt.dyrr_number}`} onClose={onClose}>
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
    </FinancesModalWrapper>
  );
}

function DyeingFinances({ profile }) {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [expandedPartners, setExpandedPartners] = useState({});
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [settlingBillId, setSettlingBillId] = useState(null);

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dof_bills')
        .select('*')
        .in('status', ['approved', 'settled'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error('Error fetching dyeing bills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (bill) => {
    if (!window.confirm(`Are you sure you want to mark Bill ${bill.bill_number} as Settled?`)) return;
    setSettlingBillId(bill.id);
    try {
      const { error: billErr } = await supabase
        .from('dof_bills')
        .update({
          status: 'settled',
          settled_at: new Date().toISOString(),
          settled_by: profile?.id
        })
        .eq('id', bill.id);
      if (billErr) throw billErr;

      const { error: dofErr } = await supabase
        .from('dyeing_order_forms')
        .update({ bill_status: 'settled' })
        .in('id', bill.selected_dof_ids || []);
      if (dofErr) throw dofErr;

      alert(`✅ Bill ${bill.bill_number} marked as settled successfully.`);
      fetchBills();
    } catch (err) {
      console.error(err);
      alert('Error settling bill: ' + err.message);
    } finally {
      setSettlingBillId(null);
    }
  };

  const togglePartnerExpand = (partnerName) => {
    setExpandedPartners(prev => ({
      ...prev,
      [partnerName]: !prev[partnerName]
    }));
  };

  const partnerGroupsList = React.useMemo(() => {
    const grouped = {};
    bills.forEach(bill => {
      const name = bill.partner_name || 'Unknown Dyeing Unit';
      if (!grouped[name]) {
        grouped[name] = {
          partnerName: name,
          bills: [],
          totalBillsCount: 0,
          needSettlingCount: 0,
          totalValue: 0,
          valueSettled: 0
        };
      }
      const g = grouped[name];
      g.bills.push(bill);
      g.totalBillsCount += 1;
      
      const isSettled = bill.status === 'settled';
      if (!isSettled) {
        g.needSettlingCount += 1;
      }
      const val = parseFloat(bill.bill_total) || 0;
      g.totalValue += val;
      if (isSettled) {
        g.valueSettled += val;
      }
    });
    return Object.values(grouped).sort((a, b) => a.partnerName.localeCompare(b.partnerName));
  }, [bills]);

  const getBillStatusBadge = (status) => {
    if (status === 'settled') {
      return { bg: '#dcfce7', text: '#166534', label: 'SETTLED', icon: <CheckCircle size={11} /> };
    }
    return { bg: '#fef3c7', text: '#92400e', label: 'APPROVED', icon: <Clock size={11} /> };
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (partnerGroupsList.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }} className="glass-panel">
        <h3 style={{ margin: 0 }}>No Approved Dyeing Bills</h3>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Approved dyeing bills will appear here for payment settlement.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="fade-in">
      {partnerGroupsList.map(group => {
        const isExpanded = !!expandedPartners[group.partnerName];
        return (
          <div key={group.partnerName} className="glass-panel" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-current)' }}>
            
            {/* Header Accordion Bar */}
            <div 
              onClick={() => togglePartnerExpand(group.partnerName)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                cursor: 'pointer',
                backgroundColor: isExpanded ? 'rgba(0,0,0,0.01)' : 'transparent',
                transition: 'background-color 0.2s',
                flexWrap: 'wrap',
                gap: '1rem'
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  {group.partnerName}
                </h3>
              </div>

              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Bills</span>
                  <span style={{ fontSize: '1rem', fontWeight: '700' }}>{group.totalBillsCount}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#b45309', textTransform: 'uppercase', fontWeight: 'bold' }}>Need Settling</span>
                  <span style={{ fontSize: '1rem', fontWeight: '700', color: '#d97706' }}>{group.needSettlingCount}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Value</span>
                  <span style={{ fontSize: '1rem', fontWeight: '700' }}>₹{group.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-primary-light)', textTransform: 'uppercase', fontWeight: 'bold' }}>Value Settled</span>
                  <span style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--color-primary)' }}>₹{group.valueSettled.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div style={{ color: 'var(--text-muted-current)', marginLeft: '0.5rem' }}>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
            </div>

            {/* Expanded Content Table */}
            {isExpanded && (
              <div style={{ width: '100%', overflowX: 'hidden', borderTop: '1px solid var(--border-current)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(0,0,0,0.015)' }}>
                      <th style={{ width: '40px' }}></th>
                      <th style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Bill Number</th>
                      <th style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Invoice Number</th>
                      <th style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Invoice Date</th>
                      <th style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Pre-Tax (₹)</th>
                      <th style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Tax (₹)</th>
                      <th style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Bill Total (₹)</th>
                      <th style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '0.5rem', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted-current)', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.bills.map(bill => {
                      const isBillExpanded = expandedBillId === bill.id;
                      const badge = getBillStatusBadge(bill.status);

                      return (
                        <React.Fragment key={bill.id}>
                          <tr style={{ backgroundColor: 'transparent', borderBottom: isBillExpanded ? 'none' : '1px solid var(--border-current)' }}>
                            <td>
                              <button
                                onClick={() => setExpandedBillId(isBillExpanded ? null : bill.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                              >
                                <ChevronDown size={16} style={{ 
                                  transform: isBillExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                                  transition: 'transform 0.2s',
                                  color: 'var(--color-primary)'
                                }} />
                              </button>
                            </td>
                            <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{bill.bill_number}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>
                                  Raised: {new Date(bill.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '0.5rem', fontSize: '0.8rem', fontWeight: 'bold' }}>{bill.invoice_number}</td>
                            <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>{new Date(bill.invoice_date).toLocaleDateString()}</td>
                            <td style={{ padding: '0.5rem', fontSize: '0.8rem', textAlign: 'right', fontWeight: '600' }}>
                              ₹{bill.calculated_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.5rem', fontSize: '0.75rem', textAlign: 'right', color: 'var(--text-muted-current)' }}>
                              ₹{bill.tax_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({bill.tax_percent}%)
                            </td>
                            <td style={{ padding: '0.5rem', fontSize: '0.8rem', textAlign: 'right', fontWeight: '700', color: 'var(--color-primary)' }}>
                              ₹{bill.bill_total?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.5rem' }}>
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
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              {bill.status === 'approved' && (
                                <button
                                  onClick={() => handleSettle(bill)}
                                  disabled={settlingBillId === bill.id}
                                  style={{
                                    backgroundColor: '#dcfce7',
                                    color: '#166534',
                                    border: '1px solid #86efac',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: '700',
                                    cursor: settlingBillId === bill.id ? 'wait' : 'pointer',
                                    opacity: settlingBillId === bill.id ? 0.6 : 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                  }}
                                >
                                  <Check size={10} /> Settle
                                </button>
                              )}
                            </td>
                          </tr>

                          {isBillExpanded && (
                            <tr>
                              <td colSpan={9} style={{ backgroundColor: '#fcfcfd', padding: '1.25rem', borderBottom: '1px solid var(--border-current)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                  <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: '#475569' }}>
                                    Linked Dyeing Order Forms Breakdown
                                  </h4>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                    {(bill.bill_items || []).map((item, idx) => (
                                      <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', padding: '0.75rem' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--color-primary)', marginBottom: '0.4rem' }}>
                                          DOF: {item.dof_number}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '0.4rem' }}>
                                          <span>Orders: {(item.order_numbers || []).join(', ')}</span>
                                          <span>Designs: {(item.design_nos || []).map((n, i) => `${n} (${item.design_names[i] || 'N/A'})`).join(', ')}</span>
                                        </div>
                                        <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                                          <thead>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                                              <th style={{ textAlign: 'left', padding: '2px 0' }}>Yarn Count & Color</th>
                                              <th style={{ textAlign: 'right', padding: '2px 0' }}>Weight</th>
                                              <th style={{ textAlign: 'right', padding: '2px 0' }}>Rate</th>
                                              <th style={{ textAlign: 'right', padding: '2px 0' }}>Total</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(item.yarn_details || []).map((yd, yidx) => (
                                              <tr key={yidx} style={{ borderBottom: '1px dotted #f1f5f9' }}>
                                                <td style={{ padding: '3px 0' }}>{yd.count_label} - <span style={{ fontWeight: '600' }}>{yd.colour}</span></td>
                                                <td style={{ textAlign: 'right', padding: '3px 0' }}>{yd.quantity_kg?.toFixed(2)} kg</td>
                                                <td style={{ textAlign: 'right', padding: '3px 0' }}>₹{yd.price_per_kg?.toFixed(2)}</td>
                                                <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: '600', color: 'var(--color-primary)' }}>₹{yd.total_price?.toFixed(2)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ))}
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
        );
      })}
    </div>
  );
}

// ── Production Finance Settlement ──────────────────────────────
function ProductionFinanceSettlement({ profile, formType }) {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [expandedPartners, setExpandedPartners] = useState({});
  const [settlingBillId, setSettlingBillId] = useState(null);
  const [expandedBillId, setExpandedBillId] = useState(null);

  const config = React.useMemo(() => {
    const cfgs = {
      warping: { name: 'Warping', formAcronym: 'WOF', icon: '🔧' },
      sizing: { name: 'Sizing', formAcronym: 'SOF', icon: '📏' },
      weaving: { name: 'Weaving', formAcronym: 'WVOF', icon: '🏭' }
    };
    return cfgs[formType] || { name: 'Production', formAcronym: 'Form', icon: '⚙️' };
  }, [formType]);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_finance_bills')
        .select('*')
        .eq('form_type', formType)
        .in('status', ['approved', 'settled'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error(`Error fetching ${formType} bills:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [formType]);

  const handleSettle = async (bill) => {
    if (!window.confirm(`Mark invoice #${bill.invoice_number} of ${bill.partner_name} as Settled?`)) return;
    setSettlingBillId(bill.id);
    try {
      const { error } = await supabase
        .from('production_finance_bills')
        .update({
          status: 'settled',
          settled_by: profile?.id,
          settled_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (error) throw error;
      alert('Invoice marked as settled successfully!');
      fetchBills();
    } catch (err) {
      alert('Error settling invoice: ' + err.message);
    } finally {
      setSettlingBillId(null);
    }
  };

  const togglePartnerExpand = (partnerName) => {
    setExpandedPartners(prev => ({
      ...prev,
      [partnerName]: !prev[partnerName]
    }));
  };

  const partnersList = React.useMemo(() => {
    const grouped = {};
    bills.forEach(bill => {
      const pName = bill.partner_name || `Unknown ${config.name} Partner`;
      if (!grouped[pName]) {
        grouped[pName] = {
          partnerName: pName,
          bills: [],
          totalBills: 0,
          needSettling: 0,
          totalValue: 0,
          valueSettled: 0,
          yetToSettle: 0
        };
      }
      const g = grouped[pName];
      g.bills.push(bill);
      g.totalBills += 1;

      const isSettled = bill.status === 'settled';
      if (!isSettled) {
        g.needSettling += 1;
        g.yetToSettle += parseFloat(bill.invoice_total) || 0;
      }
      const val = parseFloat(bill.invoice_total) || 0;
      g.totalValue += val;
      if (isSettled) {
        g.valueSettled += val;
      }
    });
    return Object.values(grouped).sort((a, b) => a.partnerName.localeCompare(b.partnerName));
  }, [bills, config]);

  const getSettlementBadge = (status) => {
    if (status === 'settled') {
      return { bg: '#dcfce7', text: '#166534', label: 'SETTLED', icon: <CheckCircle size={11} /> };
    }
    return { bg: '#fef3c7', text: '#92400e', label: 'APPROVED (PENDING)', icon: <Clock size={11} /> };
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (partnersList.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }} className="glass-panel">
        <h3 style={{ margin: 0 }}>No Approved {config.name} Bills</h3>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Approved {config.name.toLowerCase()} bills will appear here for payment settlement.</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {partnersList.map(p => {
        const isExpanded = expandedPartners[p.partnerName];
        return (
          <div key={p.partnerName} className="glass-panel" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
            {/* Partner Header Summary Card */}
            <div 
              onClick={() => togglePartnerExpand(p.partnerName)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: '1rem' }}
            >
              <div>
                <h3 style={{ margin: 0, color: 'var(--color-primary)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {config.icon} {p.partnerName}
                  <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                    {p.totalBills} bill{p.totalBills > 1 ? 's' : ''} ({p.needSettling} pending)
                  </span>
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#475569', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '700' }}>Total Invoice Value</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800' }}>₹{p.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#16a34a', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '700' }}>Settled Value</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#16a34a' }}>₹{p.valueSettled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#ea580c', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '700' }}>Need Settlement</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ea580c' }}>₹{p.yetToSettle.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.5rem' }}>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
            </div>

            {/* List of Partner's individual bills */}
            {isExpanded && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem' }}>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Date</th>
                        <th>Bill Number</th>
                        <th>{config.formAcronym} Number, Order & Design</th>
                        <th style={{ textAlign: 'right' }}>Calculated Total</th>
                        <th style={{ textAlign: 'right' }}>Invoice Subtotal</th>
                        <th style={{ textAlign: 'right' }}>Tax Amount</th>
                        <th style={{ textAlign: 'right' }}>Invoice Total</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Settlement Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.bills.map(bill => {
                        const badge = getSettlementBadge(bill.status);
                        const isBillExpanded = expandedBillId === bill.id;
                        return (
                          <React.Fragment key={bill.id}>
                            <tr 
                              onClick={() => setExpandedBillId(isBillExpanded ? null : bill.id)}
                              style={{ 
                                backgroundColor: 'transparent',
                                cursor: 'pointer',
                                transition: 'background-color 0.15s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.01)'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <td 
                                style={{ textAlign: 'center' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => setExpandedBillId(isBillExpanded ? null : bill.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                                >
                                  <ChevronDown size={16} style={{ 
                                    transform: isBillExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                                    transition: 'transform 0.2s',
                                    color: 'var(--color-primary)'
                                  }} />
                                </button>
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                {bill.invoice_date ? new Date(bill.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                              </td>
                              <td style={{ fontWeight: '700', fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                                <div>{bill.bill_number}</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'normal' }}>Inv: #{bill.invoice_number}</div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {(bill.bill_items || []).map((item, idx) => (
                                    <div key={idx} style={{ fontSize: '0.75rem', paddingBottom: idx < bill.bill_items.length - 1 ? '0.25rem' : '0', borderBottom: idx < bill.bill_items.length - 1 ? '1px dashed var(--border-current)' : 'none' }}>
                                      <div style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{item.form_number}</div>
                                      <div style={{ color: 'var(--text-muted-current)', fontSize: '0.7rem' }}>
                                        Ord: <strong>{item.order_number}</strong> | Design: <strong>{item.design_name || item.design_no || '-'}</strong>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>₹{Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', fontWeight: '500' }}>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', color: '#64748b' }}>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-primary)' }}>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  backgroundColor: badge.bg, color: badge.text,
                                  padding: '2px 6px', borderRadius: '3px',
                                  fontSize: '0.65rem', fontWeight: '700'
                                }}>
                                  {badge.icon} {badge.label}
                                </span>
                              </td>
                              <td 
                                style={{ textAlign: 'center' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {bill.status === 'approved' ? (
                                  <button
                                    onClick={() => handleSettle(bill)}
                                    disabled={settlingBillId === bill.id}
                                    style={{
                                      backgroundColor: '#dcfce7', color: '#166534',
                                      border: '1px solid #86efac',
                                      padding: '3px 8px', borderRadius: '4px',
                                      fontSize: '0.7rem', fontWeight: '700',
                                      cursor: settlingBillId === bill.id ? 'wait' : 'pointer'
                                    }}
                                  >
                                    {settlingBillId === bill.id ? 'Settle...' : '✓ Settle Bill'}
                                  </button>
                                ) : (
                                  <span style={{ color: '#16a34a', fontSize: '0.72rem', fontWeight: '600' }}>Paid</span>
                                )}
                              </td>
                            </tr>
                            {isBillExpanded && (
                              <tr>
                                <td colSpan={10} style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderLeft: '3px solid var(--color-primary)' }}>
                                  <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.85rem', color: 'var(--text-main-current)' }}>
                                    Invoice Details & {config.formAcronym} Items
                                  </h4>
                                  
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', backgroundColor: '#fff', border: '1px solid var(--border-current)', marginBottom: '1rem', borderRadius: '6px', overflow: 'hidden' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700', borderBottom: '1px solid var(--border-current)' }}>
                                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>{config.formAcronym} Number</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Order Number</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Design Name</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Planned Qty</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actual Qty</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Approved Rate / m</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total Price</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(bill.bill_items || []).map((item, idx) => {
                                        const rate = parseFloat(item.rate_per_meter || 0);
                                        const rowTotal = (parseFloat(item.actual_qty || 0) * rate);
                                        return (
                                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                            <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{item.form_number}</td>
                                            <td style={{ padding: '0.5rem' }}>{item.order_number}</td>
                                            <td style={{ padding: '0.5rem' }}>{item.design_name} ({item.design_no})</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(item.planned_qty || 0).toLocaleString()} m</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.actual_qty || 0).toLocaleString()} m</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{rate.toFixed(2)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          </tr>
                                        );
                                      })}
                                      <tr style={{ backgroundColor: 'rgba(0,0,0,0.01)', fontWeight: '800' }}>
                                        <td colSpan={4} style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Total Actual Qty:</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                                          {(bill.bill_items || []).reduce((sum, item) => sum + (parseFloat(item.actual_qty) || 0), 0).toLocaleString()} m
                                        </td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Calculated Total:</td>
                                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: 'var(--color-primary)' }}>
                                          ₹{Number(bill.calculated_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'start', marginTop: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.78rem' }}>
                                      {bill.admin_notes && (
                                        <div>
                                          <strong>Admin Notes / Remarks:</strong>
                                          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>{bill.admin_notes}</p>
                                        </div>
                                      )}
                                    </div>

                                    <div style={{ 
                                      textAlign: 'left', 
                                      fontSize: '0.8rem', 
                                      color: 'var(--text-main-current)', 
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      gap: '0.5rem', 
                                      border: '1px solid var(--border-current)', 
                                      padding: '1rem', 
                                      borderRadius: '8px', 
                                      backgroundColor: '#fff', 
                                      minWidth: '300px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                    }}>
                                      <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary)', fontWeight: '800', fontSize: '0.8rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>
                                        Invoice & Tax Breakdown
                                      </h5>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted-current)' }}>Invoice Number:</span>
                                        <strong>#{bill.invoice_number}</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted-current)' }}>Invoice Date:</span>
                                        <strong>{bill.invoice_date}</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                        <span style={{ color: 'var(--text-muted-current)' }}>Calculated Total ({config.formAcronym}s):</span>
                                        <span>₹{Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted-current)' }}>Invoice Subtotal:</span>
                                        <strong>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted-current)' }}>Tax Amount:</span>
                                        <span>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                      <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        fontSize: '0.9rem', 
                                        color: 'var(--color-primary)', 
                                        fontWeight: '800', 
                                        borderTop: '2px solid var(--border-current)', 
                                        paddingTop: '0.5rem', 
                                        marginTop: '0.25rem' 
                                      }}>
                                        <span>Invoice Total (Settlement Amount):</span>
                                        <span>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {bill.status === 'approved' && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                                      <button
                                        onClick={() => handleSettle(bill)}
                                        disabled={settlingBillId === bill.id}
                                        style={{
                                          backgroundColor: '#dcfce7', color: '#166534',
                                          border: '1px solid #86efac',
                                          padding: '6px 16px', borderRadius: '6px',
                                          fontSize: '0.8rem', fontWeight: '800',
                                          cursor: settlingBillId === bill.id ? 'wait' : 'pointer',
                                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                        }}
                                      >
                                        {settlingBillId === bill.id ? (
                                          <>
                                            <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                            Settling Bill...
                                          </>
                                        ) : (
                                          <>
                                            <Check size={14} /> Settle Bill & Make Payment
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}

                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ── Processing Finance Management ──────────────────────────────
function ProcessingFinances({ profile }) {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [pofs, setPofs] = useState([]);
  const [expandedPartners, setExpandedPartners] = useState({});
  const [settlingBillId, setSettlingBillId] = useState(null);
  const [expandedBillId, setExpandedBillId] = useState(null);

  const fetchBillsAndPofs = async () => {
    setLoading(true);
    try {
      const [billsRes, pofsRes] = await Promise.all([
        supabase
          .from('processing_finance_bills')
          .select('*')
          .in('status', ['approved', 'settled'])
          .order('created_at', { ascending: false }),
        supabase
          .from('processing_orders')
          .select('id, pof_number, fabric_rolls')
      ]);

      if (billsRes.error) throw billsRes.error;
      if (pofsRes.error) throw pofsRes.error;

      setBills(billsRes.data || []);
      setPofs(pofsRes.data || []);
    } catch (err) {
      console.error('Error fetching processing finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillsAndPofs();
  }, []);

  const handleSettle = async (bill) => {
    if (!window.confirm(`Mark processing bill #${bill.bill_number} of ${bill.partner_name} as Settled?`)) return;
    setSettlingBillId(bill.id);
    try {
      const { error: billErr } = await supabase
        .from('processing_finance_bills')
        .update({
          status: 'settled',
          settled_by: profile?.id,
          settled_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (billErr) throw billErr;

      const { error: orderErr } = await supabase
        .from('processing_orders')
        .update({
          payment_status: 'settled'
        })
        .in('id', bill.selected_pof_ids || []);

      if (orderErr) throw orderErr;

      alert('Bill settled successfully!');
      fetchBillsAndPofs();
    } catch (err) {
      alert('Error settling bill: ' + err.message);
    } finally {
      setSettlingBillId(null);
    }
  };

  const togglePartnerExpand = (partnerName) => {
    setExpandedPartners(prev => ({
      ...prev,
      [partnerName]: !prev[partnerName]
    }));
  };

  // Construct POF design maps for lookup
  const pofMap = React.useMemo(() => {
    const map = {};
    pofs.forEach(pof => {
      const firstRoll = pof.fabric_rolls?.[0] || {};
      map[pof.id] = {
        design_name: firstRoll.design_name || '—',
        design_no: firstRoll.design_no || '—'
      };
    });
    return map;
  }, [pofs]);

  // Group bills by partner
  const partnersList = React.useMemo(() => {
    const grouped = {};
    bills.forEach(bill => {
      const pName = bill.partner_name || 'Unknown Partner';
      if (!grouped[pName]) {
        grouped[pName] = {
          partnerName: pName,
          bills: [],
          totalBills: 0,
          billsSettled: 0,
          totalValueSettled: 0,
          yetToSettle: 0,
          totalValue: 0
        };
      }
      const g = grouped[pName];
      g.bills.push(bill);
      g.totalBills += 1;

      const isSettled = bill.status === 'settled';
      if (isSettled) {
        g.billsSettled += 1;
        g.totalValueSettled += parseFloat(bill.invoice_total) || 0;
      } else {
        g.yetToSettle += parseFloat(bill.invoice_total) || 0;
      }
      g.totalValue += parseFloat(bill.invoice_total) || 0;
    });

    return Object.values(grouped).sort((a, b) => a.partnerName.localeCompare(b.partnerName));
  }, [bills]);

  const getSettlementBadge = (status) => {
    if (status === 'settled') {
      return { bg: '#dcfce7', text: '#166534', label: 'SETTLED', icon: <CheckCircle size={11} /> };
    }
    return { bg: '#fef3c7', text: '#92400e', label: 'APPROVED (PENDING)', icon: <Clock size={11} /> };
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (partnersList.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted-current)' }} className="glass-panel">
        <h3 style={{ margin: 0 }}>No Approved Processing Bills</h3>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Approved processing bills will appear here for payment settlement.</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {partnersList.map(p => {
        const isExpanded = expandedPartners[p.partnerName];
        return (
          <div key={p.partnerName} className="glass-panel" style={{ marginBottom: '1.25rem', padding: '1.25rem' }}>
            {/* Partner Header Summary Card */}
            <div 
              onClick={() => togglePartnerExpand(p.partnerName)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap', gap: '1rem' }}
            >
              <div>
                <h3 style={{ margin: 0, color: 'var(--color-primary)', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ⚙️ {p.partnerName}
                  <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                    {p.totalBills} bill{p.totalBills > 1 ? 's' : ''} ({p.totalBills - p.billsSettled} pending)
                  </span>
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#475569', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '700' }}>Bills Settled</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', textAlign: 'center' }}>{p.billsSettled}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#16a34a', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '700' }}>Total Value Settled</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#16a34a' }}>₹{p.totalValueSettled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#ea580c', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '700' }}>Yet to Settle</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ea580c' }}>₹{p.yetToSettle.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.5rem' }}>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
            </div>

            {/* List of Partner's individual bills */}
            {isExpanded && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem' }}>
                <div className="table-container" style={{ border: 'none' }}>
                  <table className="table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Bill Date</th>
                        <th>Bill Number</th>
                        <th>POF Number</th>
                        <th>Design Name & Number</th>
                        <th style={{ textAlign: 'right' }}>Calculated Total</th>
                        <th style={{ textAlign: 'right' }}>Tax Amount</th>
                        <th style={{ textAlign: 'right' }}>Invoice Total</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Settlement Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.bills.map(bill => {
                        const badge = getSettlementBadge(bill.status);
                        const isBillExpanded = expandedBillId === bill.id;

                        // Get the details of POFs for this bill to show in row
                        const pofNumbers = (bill.bill_items || []).map(item => item.pof_number).join(', ');
                        
                        // Extract designs from bill's POFs via pofMap lookup
                        const designsList = Array.from(new Set(
                          (bill.bill_items || []).map(item => {
                            const designInfo = pofMap[item.pof_id];
                            if (!designInfo) return null;
                            return `${designInfo.design_name} (${designInfo.design_no})`;
                          }).filter(Boolean)
                        ));
                        const designsStr = designsList.length > 0 ? designsList.join(', ') : '—';

                        return (
                          <React.Fragment key={bill.id}>
                            <tr 
                              onClick={() => setExpandedBillId(isBillExpanded ? null : bill.id)}
                              style={{ 
                                backgroundColor: 'transparent',
                                cursor: 'pointer',
                                transition: 'background-color 0.15s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.01)'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <td 
                                style={{ textAlign: 'center' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => setExpandedBillId(isBillExpanded ? null : bill.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                                >
                                  <ChevronDown size={16} style={{ 
                                    transform: isBillExpanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                                    transition: 'transform 0.2s',
                                    color: 'var(--color-primary)'
                                  }} />
                                </button>
                              </td>
                              <td style={{ fontSize: '0.8rem' }}>
                                {new Date(bill.created_at).toLocaleDateString('en-GB')}
                              </td>
                              <td style={{ padding: '0.75rem 0.5rem' }}>
                                <div style={{ fontWeight: '700', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{bill.bill_number}</div>
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
                              <td style={{ fontSize: '0.8rem', fontWeight: '500' }}>{pofNumbers || '—'}</td>
                              <td style={{ fontSize: '0.8rem' }}>{designsStr}</td>
                              <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>₹{Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', color: '#64748b', fontSize: '0.8rem' }}>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.8rem' }}>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  backgroundColor: badge.bg, color: badge.text,
                                  padding: '2px 6px', borderRadius: '3px',
                                  fontSize: '0.65rem', fontWeight: '700'
                                }}>
                                  {badge.icon} {badge.label}
                                </span>
                              </td>
                              <td 
                                style={{ textAlign: 'center' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {bill.status === 'approved' ? (
                                  <button
                                    onClick={() => handleSettle(bill)}
                                    disabled={settlingBillId === bill.id}
                                    style={{
                                      backgroundColor: '#dcfce7', color: '#166534',
                                      border: '1px solid #86efac',
                                      padding: '3px 8px', borderRadius: '4px',
                                      fontSize: '0.7rem', fontWeight: '700',
                                      cursor: settlingBillId === bill.id ? 'wait' : 'pointer'
                                    }}
                                  >
                                    {settlingBillId === bill.id ? 'Settle...' : '✓ Settle Bill'}
                                  </button>
                                ) : (
                                  <span style={{ color: '#16a34a', fontSize: '0.72rem', fontWeight: '600' }}>Paid</span>
                                )}
                              </td>
                            </tr>
                            
                            {isBillExpanded && (
                              <tr onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
                                <td colSpan={10} style={{ padding: '1.25rem 1.5rem', backgroundColor: '#f8fafc', borderLeft: '3px solid var(--color-primary)' }}>
                                  <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', borderBottom: '1px dashed var(--border-current)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
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

                                  <h4 style={{ margin: '0 0 0.75rem 0', fontWeight: '800', fontSize: '0.85rem', color: 'var(--text-main-current)' }}>
                                    POF Details & Process Rates
                                  </h4>
                                  
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', backgroundColor: '#fff', border: '1px solid var(--border-current)', marginBottom: '1.25rem', borderRadius: '6px', overflow: 'hidden' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700', borderBottom: '1px solid var(--border-current)' }}>
                                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>POF Number</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Greige Sent</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Processed Recd</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Shrinkage (%)</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Sent Date</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Received Date</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(bill.bill_items || []).map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                          <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{item.pof_number}</td>
                                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                            {item.greige_sent_rolls} rolls ({Number(item.greige_sent_qty).toFixed(2)} m)
                                          </td>
                                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>
                                            {item.processed_rolls_recd} rolls ({Number(item.processed_qty_recd).toFixed(2)} m)
                                          </td>
                                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(item.shrinkage).toFixed(2)}%</td>
                                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>{new Date(item.sent_date).toLocaleDateString('en-GB')}</td>
                                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.received_date ? new Date(item.received_date).toLocaleDateString('en-GB') : '—'}</td>
                                          <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{(item.status || '').replace(/_/g, ' ')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  {/* Process Rates Table */}
                                  <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-main-current)' }}>
                                    Process Rates & Calculated Prices
                                  </h5>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', backgroundColor: '#fff', border: '1px solid var(--border-current)', marginBottom: '1.25rem', borderRadius: '6px', overflow: 'hidden' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700', borderBottom: '1px solid var(--border-current)' }}>
                                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Process Name</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Price / Meter</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total Price (Based on Greige Sent Qty)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(bill.process_rates || []).map((r, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                          <td style={{ padding: '0.5rem' }}>{r.process}</td>
                                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{Number(r.rate_per_meter).toFixed(2)}</td>
                                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>₹{Number(r.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'start' }}>
                                    <div></div>
                                    <div style={{ 
                                      textAlign: 'left', 
                                      fontSize: '0.8rem', 
                                      color: 'var(--text-main-current)', 
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      gap: '0.5rem', 
                                      border: '1px solid var(--border-current)', 
                                      padding: '1rem', 
                                      borderRadius: '8px', 
                                      backgroundColor: '#fff', 
                                      minWidth: '320px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                    }}>
                                      <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary)', fontWeight: '800', fontSize: '0.8rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>
                                        Bill Summary Breakdown
                                      </h5>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted-current)' }}>Calculated Total:</span>
                                        <strong>₹{Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted-current)' }}>Tax Amount:</span>
                                        <span>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        fontSize: '0.9rem', 
                                        color: 'var(--color-primary)', 
                                        fontWeight: '800', 
                                        borderTop: '2px solid var(--border-current)', 
                                        paddingTop: '0.5rem', 
                                        marginTop: '0.25rem' 
                                      }}>
                                        <span>Grand Value (Total Value):</span>
                                        <span>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {bill.status === 'approved' && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                                      <button
                                        onClick={() => handleSettle(bill)}
                                        disabled={settlingBillId === bill.id}
                                        style={{
                                          backgroundColor: '#dcfce7', color: '#166534',
                                          border: '1px solid #86efac',
                                          padding: '6px 16px', borderRadius: '6px',
                                          fontSize: '0.8rem', fontWeight: '800',
                                          cursor: settlingBillId === bill.id ? 'wait' : 'pointer',
                                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                        }}
                                      >
                                        {settlingBillId === bill.id ? (
                                          <>
                                            <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                            Settling Bill...
                                          </>
                                        ) : (
                                          <>
                                            <Check size={14} /> Settle Bill & Make Payment
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── MultiSelectDropdown Helper Component ──────────────────────────────────────
function MultiSelectDropdown({ label, options, selectedValues, onChange, placeholder = "Search..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = React.useMemo(() => {
    return options.filter(opt =>
      String(opt || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const toggleOption = (opt) => {
    if (selectedValues.includes(opt)) {
      onChange(selectedValues.filter(val => val !== opt));
    } else {
      onChange([...selectedValues, opt]);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', minWidth: '160px' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          border: '1px solid var(--border-current)',
          borderRadius: '8px',
          backgroundColor: 'white',
          color: 'var(--text-main-current)',
          fontSize: '0.825rem',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          height: '38px',
          transition: 'all 0.15s'
        }}
      >
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '85%' }}>
          {selectedValues.length === 0 ? `All ${label}s` : `${selectedValues.length} Selected`}
        </span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted-current)' }} />
      </button>

      {isOpen && (
        <>
          <div 
            onClick={() => setIsOpen(false)} 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, cursor: 'default' }} 
          />
          <div style={{
            position: 'absolute',
            top: '105%',
            left: 0,
            right: 0,
            backgroundColor: '#fff',
            border: '1px solid var(--border-current)',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
            padding: '0.5rem',
            zIndex: 1000,
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            animation: 'fadeIn 0.15s ease-out'
          }}>
            <input
              type="text"
              placeholder={placeholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem',
                border: '1px solid var(--border-current)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                outline: 'none',
                background: 'rgba(0,0,0,0.02)',
                color: 'var(--text-main-current)',
                boxSizing: 'border-box'
              }}
            />
            
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.4rem' }}>
              <button
                type="button"
                onClick={() => onChange(options)}
                style={{
                  flex: 1, padding: '3px 0', fontSize: '0.68rem', fontWeight: '750',
                  border: 'none', background: 'rgba(128,0,0,0.05)', color: '#800000', borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                style={{
                  flex: 1, padding: '3px 0', fontSize: '0.68rem', fontWeight: '750',
                  border: 'none', background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted-current)', borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Clear
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingRight: '2px' }} className="custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', textAlign: 'center', padding: '0.5rem 0' }}>
                  No options found
                </span>
              ) : (
                filteredOptions.map(opt => {
                  const isChecked = selectedValues.includes(opt);
                  return (
                    <label
                      key={opt}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        backgroundColor: isChecked ? 'rgba(128,0,0,0.04)' : 'transparent',
                        transition: 'background-color 0.15s',
                        color: isChecked ? '#800000' : 'var(--text-main-current)',
                        fontWeight: isChecked ? '700' : '500'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOption(opt)}
                        style={{ accentColor: '#800000', cursor: 'pointer' }}
                      />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {opt}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── AllSettledBills Component ────────────────────────────────────────────────
function AllSettledBills({ profile }) {
  const [loading, setLoading] = useState(true);
  const [allBills, setAllBills] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedBillId, setExpandedBillId] = useState(null);

  // Filters State
  const [fromDateBill, setFromDateBill] = useState('');
  const [toDateBill, setToDateBill] = useState('');
  const [fromDateSettle, setFromDateSettle] = useState('');
  const [toDateSettle, setToDateSettle] = useState('');
  const [selectedPartners, setSelectedPartners] = useState([]);
  const [selectedOrderNumbers, setSelectedOrderNumbers] = useState([]);
  const [selectedDesigns, setSelectedDesigns] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);

  const fetchAllSettledBills = async () => {
    setLoading(true);
    try {
      const [prodRes, procRes, dyeRes, greigeRes, ordersRes, procOrdersRes, ycRes] = await Promise.all([
        supabase
          .from('production_finance_bills')
          .select('*')
          .eq('status', 'settled'),
        supabase
          .from('processing_finance_bills')
          .select('*')
          .eq('status', 'settled'),
        supabase
          .from('dof_bills')
          .select('*')
          .eq('status', 'settled'),
        supabase
          .from('greige_yarn_receipts')
          .select(`
            *,
            master_partners(partner_name)
          `)
          .eq('receipt_type', 'spinning_mill')
          .eq('finance_settlement_status', 'settled'),
        supabase
          .from('orders')
          .select('id, order_number, design_no, design_name'),
        supabase
          .from('processing_orders')
          .select('id, pof_number, fabric_rolls'),
        supabase
          .from('master_yarn_counts')
          .select('*')
      ]);

      if (prodRes.error) throw prodRes.error;
      if (procRes.error) throw procRes.error;
      if (dyeRes.error) throw dyeRes.error;
      if (greigeRes.error) throw greigeRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (procOrdersRes.error) throw procOrdersRes.error;
      if (ycRes.error) throw ycRes.error;

      setYarnCounts(ycRes.data || []);

      const ordersMap = {};
      (ordersRes.data || []).forEach(o => {
        ordersMap[o.id] = o;
      });

      const procOrdersMap = {};
      (procOrdersRes.data || []).forEach(po => {
        const orderNos = Array.from(new Set((po.fabric_rolls || []).map(r => r.order_number).filter(Boolean)));
        const designs = Array.from(new Set((po.fabric_rolls || []).map(r => r.design_name ? `${r.design_name} (${r.design_no})` : r.design_no).filter(Boolean)));
        procOrdersMap[po.id] = { orderNos, designs };
      });

      const unified = [];

      // Map production bills
      (prodRes.data || []).forEach(b => {
        const formNumbers = Array.from(new Set((b.bill_items || []).map(item => item.form_number || item.wof_number || item.sof_number || item.weaving_number).filter(Boolean)));
        const orderNumbers = Array.from(new Set((b.bill_items || []).map(item => item.order_number).filter(Boolean)));
        const designs = Array.from(new Set((b.bill_items || []).map(item => {
          const name = item.design_name || '';
          const no = item.design_no || '';
          return name && no ? `${name} (${no})` : (name || no || '');
        }).filter(Boolean)));

        unified.push({
          id: `production-${b.id}`,
          billDate: b.invoice_date,
          settlingDate: b.settled_at ? b.settled_at.split('T')[0] : '',
          billNumber: b.bill_number,
          partnerName: b.partner_name,
          orderFormNumbers: formNumbers,
          orderNumbers: orderNumbers,
          designs: designs,
          calcTotal: parseFloat(b.calculated_total || 0),
          tax: parseFloat(b.tax_amount || 0),
          invoiceTotal: parseFloat(b.invoice_total || 0),
          status: b.status,
          billType: b.form_type ? b.form_type.charAt(0).toUpperCase() + b.form_type.slice(1) : 'Production',
          rawRecord: b
        });
      });

      // Map processing bills
      (procRes.data || []).forEach(b => {
        const formNumbers = Array.from(new Set((b.bill_items || []).map(item => item.pof_number).filter(Boolean)));
        const orderNumbersSet = new Set();
        const designsSet = new Set();

        (b.bill_items || []).forEach(item => {
          const poData = procOrdersMap[item.pof_id];
          if (poData) {
            poData.orderNos.forEach(on => orderNumbersSet.add(on));
            poData.designs.forEach(d => designsSet.add(d));
          }
        });

        unified.push({
          id: `processing-${b.id}`,
          billDate: b.created_at ? b.created_at.split('T')[0] : '',
          settlingDate: b.settled_at ? b.settled_at.split('T')[0] : '',
          billNumber: b.bill_number,
          partnerName: b.partner_name,
          orderFormNumbers: formNumbers,
          orderNumbers: Array.from(orderNumbersSet),
          designs: Array.from(designsSet),
          calcTotal: parseFloat(b.calculated_total || 0),
          tax: parseFloat(b.tax_amount || 0),
          invoiceTotal: parseFloat(b.invoice_total || 0),
          status: b.status,
          billType: 'Processing',
          rawRecord: b
        });
      });

      // Map dyeing bills
      (dyeRes.data || []).forEach(b => {
        const dofNumbers = Array.from(new Set((b.bill_items || []).map(item => item.dof_number).filter(Boolean)));
        const orderNumbersSet = new Set();
        const designsSet = new Set();

        (b.bill_items || []).forEach(item => {
          (item.order_numbers || []).forEach(on => orderNumbersSet.add(on));
          (item.design_nos || []).forEach((n, i) => {
            const name = item.design_names[i] || '';
            const desc = name && n ? `${name} (${n})` : (name || n);
            if (desc) designsSet.add(desc);
          });
        });

        unified.push({
          id: `dyeing-${b.id}`,
          billDate: b.invoice_date,
          settlingDate: b.settled_at ? b.settled_at.split('T')[0] : '',
          billNumber: b.bill_number,
          partnerName: b.partner_name,
          orderFormNumbers: dofNumbers,
          orderNumbers: Array.from(orderNumbersSet),
          designs: Array.from(designsSet),
          calcTotal: parseFloat(b.calculated_total || 0),
          tax: parseFloat(b.tax_amount || 0),
          invoiceTotal: parseFloat(b.bill_total || 0),
          status: b.status,
          billType: 'Dyeing',
          rawRecord: b
        });
      });

      // Map greige receipts (group by receipt_no)
      const groupedGreige = {};
      (greigeRes.data || []).forEach(r => {
        const key = r.receipt_no;
        if (!groupedGreige[key]) {
          groupedGreige[key] = {
            ...r,
            items: []
          };
        }
        groupedGreige[key].items.push(r);
      });

      Object.values(groupedGreige).forEach(receipt => {
        unified.push({
          id: `greige-${receipt.id}`,
          billDate: receipt.invoice_date || (receipt.created_at ? receipt.created_at.split('T')[0] : ''),
          settlingDate: receipt.finance_settled_at ? receipt.finance_settled_at.split('T')[0] : '',
          billNumber: receipt.invoice_no || receipt.receipt_no,
          partnerName: receipt.master_partners?.partner_name || 'Unknown Spinning Mill',
          orderFormNumbers: [],
          orderNumbers: [],
          designs: [],
          calcTotal: parseFloat(receipt.invoice_amount || 0),
          tax: 0,
          invoiceTotal: parseFloat(receipt.invoice_amount || 0),
          status: receipt.finance_settlement_status,
          billType: 'Greige Yarn',
          rawRecord: receipt
        });
      });

      // Sort by settling date DESC, then bill date DESC
      unified.sort((a, b) => {
        const dateA = new Date(a.settlingDate || a.billDate).getTime();
        const dateB = new Date(b.settlingDate || b.billDate).getTime();
        return dateB - dateA;
      });

      setAllBills(unified);
    } catch (err) {
      console.error('Error fetching settled bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllSettledBills();
  }, []);

  const handleResetFilters = () => {
    setFromDateBill('');
    setToDateBill('');
    setFromDateSettle('');
    setToDateSettle('');
    setSelectedPartners([]);
    setSelectedOrderNumbers([]);
    setSelectedDesigns([]);
    setSelectedTypes([]);
  };

  // Interdependent filters matching
  const filteredBills = React.useMemo(() => {
    return allBills.filter(b => {
      // 1. Bill Date Range
      if (fromDateBill && b.billDate && b.billDate < fromDateBill) return false;
      if (toDateBill && b.billDate && b.billDate > toDateBill) return false;

      // 2. Settling Date Range
      if (fromDateSettle && b.settlingDate && b.settlingDate < fromDateSettle) return false;
      if (toDateSettle && b.settlingDate && b.settlingDate > toDateSettle) return false;

      // 3. Partner Name
      if (selectedPartners.length > 0 && !selectedPartners.includes(b.partnerName)) return false;

      // 4. Order Number
      if (selectedOrderNumbers.length > 0) {
        if (!b.orderNumbers || b.orderNumbers.length === 0) return false;
        if (!b.orderNumbers.some(on => selectedOrderNumbers.includes(on))) return false;
      }

      // 5. Design Name & Number
      if (selectedDesigns.length > 0) {
        if (!b.designs || b.designs.length === 0) return false;
        if (!b.designs.some(d => selectedDesigns.includes(d))) return false;
      }

      // 6. Bill Type
      if (selectedTypes.length > 0 && !selectedTypes.includes(b.billType)) return false;

      return true;
    });
  }, [allBills, fromDateBill, toDateBill, fromDateSettle, toDateSettle, selectedPartners, selectedOrderNumbers, selectedDesigns, selectedTypes]);

  // Interdependent Option generation
  const partnerOptions = React.useMemo(() => {
    const matched = allBills.filter(b => {
      if (fromDateBill && b.billDate && b.billDate < fromDateBill) return false;
      if (toDateBill && b.billDate && b.billDate > toDateBill) return false;
      if (fromDateSettle && b.settlingDate && b.settlingDate < fromDateSettle) return false;
      if (toDateSettle && b.settlingDate && b.settlingDate > toDateSettle) return false;
      if (selectedOrderNumbers.length > 0) {
        if (!b.orderNumbers || b.orderNumbers.length === 0) return false;
        if (!b.orderNumbers.some(on => selectedOrderNumbers.includes(on))) return false;
      }
      if (selectedDesigns.length > 0) {
        if (!b.designs || b.designs.length === 0) return false;
        if (!b.designs.some(d => selectedDesigns.includes(d))) return false;
      }
      if (selectedTypes.length > 0 && !selectedTypes.includes(b.billType)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(b => b.partnerName).filter(Boolean))).sort();
  }, [allBills, fromDateBill, toDateBill, fromDateSettle, toDateSettle, selectedOrderNumbers, selectedDesigns, selectedTypes]);

  const orderNumberOptions = React.useMemo(() => {
    const matched = allBills.filter(b => {
      if (fromDateBill && b.billDate && b.billDate < fromDateBill) return false;
      if (toDateBill && b.billDate && b.billDate > toDateBill) return false;
      if (fromDateSettle && b.settlingDate && b.settlingDate < fromDateSettle) return false;
      if (toDateSettle && b.settlingDate && b.settlingDate > toDateSettle) return false;
      if (selectedPartners.length > 0 && !selectedPartners.includes(b.partnerName)) return false;
      if (selectedDesigns.length > 0) {
        if (!b.designs || b.designs.length === 0) return false;
        if (!b.designs.some(d => selectedDesigns.includes(d))) return false;
      }
      if (selectedTypes.length > 0 && !selectedTypes.includes(b.billType)) return false;
      return true;
    });
    const set = new Set();
    matched.forEach(b => {
      if (b.orderNumbers) {
        b.orderNumbers.forEach(on => set.add(on));
      }
    });
    return Array.from(set).sort();
  }, [allBills, fromDateBill, toDateBill, fromDateSettle, toDateSettle, selectedPartners, selectedDesigns, selectedTypes]);

  const designOptions = React.useMemo(() => {
    const matched = allBills.filter(b => {
      if (fromDateBill && b.billDate && b.billDate < fromDateBill) return false;
      if (toDateBill && b.billDate && b.billDate > toDateBill) return false;
      if (fromDateSettle && b.settlingDate && b.settlingDate < fromDateSettle) return false;
      if (toDateSettle && b.settlingDate && b.settlingDate > toDateSettle) return false;
      if (selectedPartners.length > 0 && !selectedPartners.includes(b.partnerName)) return false;
      if (selectedOrderNumbers.length > 0) {
        if (!b.orderNumbers || b.orderNumbers.length === 0) return false;
        if (!b.orderNumbers.some(on => selectedOrderNumbers.includes(on))) return false;
      }
      if (selectedTypes.length > 0 && !selectedTypes.includes(b.billType)) return false;
      return true;
    });
    const set = new Set();
    matched.forEach(b => {
      if (b.designs) {
        b.designs.forEach(d => set.add(d));
      }
    });
    return Array.from(set).sort();
  }, [allBills, fromDateBill, toDateBill, fromDateSettle, toDateSettle, selectedPartners, selectedOrderNumbers, selectedTypes]);

  const typeOptions = React.useMemo(() => {
    const matched = allBills.filter(b => {
      if (fromDateBill && b.billDate && b.billDate < fromDateBill) return false;
      if (toDateBill && b.billDate && b.billDate > toDateBill) return false;
      if (fromDateSettle && b.settlingDate && b.settlingDate < fromDateSettle) return false;
      if (toDateSettle && b.settlingDate && b.settlingDate > toDateSettle) return false;
      if (selectedPartners.length > 0 && !selectedPartners.includes(b.partnerName)) return false;
      if (selectedOrderNumbers.length > 0) {
        if (!b.orderNumbers || b.orderNumbers.length === 0) return false;
        if (!b.orderNumbers.some(on => selectedOrderNumbers.includes(on))) return false;
      }
      if (selectedDesigns.length > 0) {
        if (!b.designs || b.designs.length === 0) return false;
        if (!b.designs.some(d => selectedDesigns.includes(d))) return false;
      }
      return true;
    });
    return Array.from(new Set(matched.map(b => b.billType).filter(Boolean))).sort();
  }, [allBills, fromDateBill, toDateBill, fromDateSettle, toDateSettle, selectedPartners, selectedOrderNumbers, selectedDesigns]);

  const renderBillDetails = (bill) => {
    if (bill.billType === 'Warping' || bill.billType === 'Sizing' || bill.billType === 'Weaving') {
      return (
        <div style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)', backgroundColor: 'rgba(128,0,0,0.005)' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase' }}>
            Billed {bill.billType} Details
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid var(--border-current)', backgroundColor: 'white' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Form Number</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Order Number</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Design Name & No</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Planned Qty</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Actual Qty</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Rate / Meter</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Total Price</th>
              </tr>
            </thead>
            <tbody>
              {(bill.rawRecord.bill_items || []).map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace' }}>{item.form_number}</td>
                  <td style={{ padding: '0.5rem' }}>{item.order_number}</td>
                  <td style={{ padding: '0.5rem' }}>{item.design_name} ({item.design_no})</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(item.planned_qty || item.total_meters || 0).toLocaleString()} m</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.actual_qty || 0).toLocaleString()} m</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{Number(item.rate_per_meter || item.warping_rate || item.sizing_rate || 0).toFixed(2)}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{Number(item.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (bill.billType === 'Processing') {
      return (
        <div style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)', backgroundColor: 'rgba(128,0,0,0.005)' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase' }}>
            Processing Bill Items
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid var(--border-current)', backgroundColor: 'white', marginBottom: '1rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>POF Number</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Greige Sent</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Processed Recd</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Shrinkage</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Sent Date</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Received Date</th>
              </tr>
            </thead>
            <tbody>
              {(bill.rawRecord.bill_items || []).map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace' }}>{item.pof_number}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.greige_sent_rolls} rolls ({Number(item.greige_sent_qty).toFixed(2)} m)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{item.processed_rolls_recd} rolls ({Number(item.processed_qty_recd).toFixed(2)} m)</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(item.shrinkage).toFixed(2)}%</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{new Date(item.sent_date).toLocaleDateString('en-GB')}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.received_date ? new Date(item.received_date).toLocaleDateString('en-GB') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '0.8rem' }}>Process Rates</h5>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid var(--border-current)', backgroundColor: 'white' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Process</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Rate / Meter</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Calculated Total</th>
              </tr>
            </thead>
            <tbody>
              {(bill.rawRecord.process_rates || []).map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                  <td style={{ padding: '0.5rem' }}>{item.process}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{Number(item.rate_per_meter).toFixed(2)}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{Number(item.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (bill.billType === 'Dyeing') {
      return (
        <div style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)', backgroundColor: 'rgba(128,0,0,0.005)' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase' }}>
            Dyeing Bill Breakdown
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(bill.rawRecord.bill_items || []).map((item, idx) => (
              <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#fff', padding: '0.75rem' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--color-primary)', marginBottom: '0.4rem' }}>
                  DOF: {item.dof_number}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '0.4rem' }}>
                  <span>Orders: {(item.order_numbers || []).join(', ')}</span>
                  <span>Designs: {(item.design_nos || []).map((n, i) => `${n} (${item.design_names[i] || 'N/A'})`).join(', ')}</span>
                </div>
                <table style={{ width: '100%', fontSize: '0.72rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                      <th style={{ textAlign: 'left', padding: '2px 0' }}>Yarn Count & Color</th>
                      <th style={{ textAlign: 'right', padding: '2px 0' }}>Weight</th>
                      <th style={{ textAlign: 'right', padding: '2px 0' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '2px 0' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(item.yarn_details || []).map((yd, yidx) => (
                      <tr key={yidx} style={{ borderBottom: '1px dotted #f1f5f9' }}>
                        <td style={{ padding: '3px 0' }}>{yd.count_label} - <span style={{ fontWeight: '600' }}>{yd.colour}</span></td>
                        <td style={{ textAlign: 'right', padding: '3px 0' }}>{yd.quantity_kg?.toFixed(2)} kg</td>
                        <td style={{ textAlign: 'right', padding: '3px 0' }}>₹{yd.price_per_kg?.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '3px 0', fontWeight: '600', color: 'var(--color-primary)' }}>₹{yd.total_price?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (bill.billType === 'Greige Yarn') {
      return (
        <div style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)', backgroundColor: 'rgba(128,0,0,0.005)' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase' }}>
            Greige Yarn Items Group
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid var(--border-current)', backgroundColor: 'white' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Yarn Count</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Bags</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Cones</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Wt / Bag</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Total Wt</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Rate / kg</th>
              </tr>
            </thead>
            <tbody>
              {(bill.rawRecord.items || []).map((item, idx) => {
                const countVal = item.master_yarn_counts ? `${item.master_yarn_counts.count_value} ${item.master_yarn_counts.material}` : 'Unknown';
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                    <td style={{ padding: '0.5rem', fontWeight: '700' }}>{countVal}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.bag_count || 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.cone_count || 0}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(item.bag_weight || 0).toFixed(1)} kg</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.total_weight || 0).toFixed(1)} kg</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{Number(item.rate_per_kg || 0).toFixed(0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="fade-in">
      {/* Search & Filter Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, color: 'var(--text-current)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          Settled Bills ({filteredBills.length})
        </h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            border: '1px solid ' + (showFilters ? 'var(--color-primary)' : 'var(--border-current)'),
            backgroundColor: showFilters ? 'rgba(128, 0, 0, 0.05)' : 'white',
            color: showFilters ? 'var(--color-primary)' : 'var(--text-main-current)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <SlidersHorizontal size={16} />
          {showFilters ? 'Hide Filters' : 'Filters'}
        </button>
      </div>

      {/* Expandable/Collapsible Filters panel */}
      {showFilters && (
        <div style={{
          backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1.25rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }} className="fade-in">
          {/* Row 1: Date Ranges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                Bill Date Range
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="date"
                  value={fromDateBill}
                  onChange={(e) => setFromDateBill(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'white' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>to</span>
                <input
                  type="date"
                  value={toDateBill}
                  onChange={(e) => setToDateBill(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'white' }}
                />
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', display: 'block', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                Settling Date Range
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="date"
                  value={fromDateSettle}
                  onChange={(e) => setFromDateSettle(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'white' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>to</span>
                <input
                  type="date"
                  value={toDateSettle}
                  onChange={(e) => setToDateSettle(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'white' }}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Searchable Interdependent Multi-select Dropdowns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <MultiSelectDropdown
              label="Partner Name"
              options={partnerOptions}
              selectedValues={selectedPartners}
              onChange={setSelectedPartners}
              placeholder="Search Partner..."
            />
            <MultiSelectDropdown
              label="Bill Type"
              options={typeOptions}
              selectedValues={selectedTypes}
              onChange={setSelectedTypes}
              placeholder="Search Type..."
            />
            <MultiSelectDropdown
              label="Order Number"
              options={orderNumberOptions}
              selectedValues={selectedOrderNumbers}
              onChange={setSelectedOrderNumbers}
              placeholder="Search Order Number..."
            />
            <MultiSelectDropdown
              label="Design Name & Number"
              options={designOptions}
              selectedValues={selectedDesigns}
              onChange={setSelectedDesigns}
              placeholder="Search Design..."
            />
          </div>

          {/* Reset Filters */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px dashed var(--border-current)', paddingTop: '0.75rem' }}>
            <button
              onClick={handleResetFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Reset All Filters
            </button>
          </div>
        </div>
      )}

      {/* Main Bills Table */}
      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border-current)', borderRadius: '12px' }}>
        <table className="table" style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.015)', textAlign: 'left' }}>
              <th style={{ width: '40px', padding: '0.75rem 0.5rem' }}></th>
              <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>Bill Date</th>
              <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>Settling Date</th>
              <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>Bill Number</th>
              <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>Type</th>
              <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>Partner Name</th>
              <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>Form Numbers</th>
              <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>Order Numbers</th>
              <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>Design Name & No</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontSize: '0.78rem' }}>Calc Total</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontSize: '0.78rem' }}>Tax</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontSize: '0.78rem' }}>Invoice Total</th>
              <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                  No settled bills found matching the selected filters.
                </td>
              </tr>
            ) : (
              filteredBills.map(bill => {
                const isExpanded = expandedBillId === bill.id;
                return (
                  <React.Fragment key={bill.id}>
                    <tr
                      onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.01)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                        {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--color-primary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted-current)' }} />}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>{bill.billDate ? new Date(bill.billDate).toLocaleDateString('en-GB') : '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>{bill.settlingDate ? new Date(bill.settlingDate).toLocaleDateString('en-GB') : '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {bill.billNumber}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{
                          backgroundColor:
                            bill.billType === 'Greige Yarn' ? 'rgba(245, 158, 11, 0.1)' :
                            bill.billType === 'Dyeing' ? 'rgba(139, 92, 246, 0.1)' :
                            bill.billType === 'Warping' ? 'rgba(20, 184, 166, 0.1)' :
                            bill.billType === 'Sizing' ? 'rgba(59, 130, 246, 0.1)' :
                            bill.billType === 'Weaving' ? 'rgba(16, 185, 129, 0.1)' :
                            bill.billType === 'Processing' ? 'rgba(244, 63, 94, 0.1)' :
                            'rgba(107, 114, 128, 0.1)',
                          color:
                            bill.billType === 'Greige Yarn' ? 'rgb(217, 119, 6)' :
                            bill.billType === 'Dyeing' ? 'rgb(109, 40, 217)' :
                            bill.billType === 'Warping' ? 'rgb(13, 148, 136)' :
                            bill.billType === 'Sizing' ? 'rgb(37, 99, 235)' :
                            bill.billType === 'Weaving' ? 'rgb(5, 150, 105)' :
                            bill.billType === 'Processing' ? 'rgb(225, 29, 72)' :
                            'rgb(55, 65, 81)',
                          border:
                            bill.billType === 'Greige Yarn' ? '1px solid rgba(245, 158, 11, 0.2)' :
                            bill.billType === 'Dyeing' ? '1px solid rgba(139, 92, 246, 0.2)' :
                            bill.billType === 'Warping' ? '1px solid rgba(20, 184, 166, 0.2)' :
                            bill.billType === 'Sizing' ? '1px solid rgba(59, 130, 246, 0.2)' :
                            bill.billType === 'Weaving' ? '1px solid rgba(16, 185, 129, 0.2)' :
                            bill.billType === 'Processing' ? '1px solid rgba(244, 63, 94, 0.2)' :
                            '1px solid rgba(107, 114, 128, 0.2)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap'
                        }}>
                          {bill.billType === 'Greige Yarn' ? 'Greige' : bill.billType}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600', fontSize: '0.78rem' }}>{bill.partnerName}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        {bill.orderFormNumbers.length > 0 ? bill.orderFormNumbers.join(', ') : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>
                        {bill.orderNumbers.length > 0 ? bill.orderNumbers.join(', ') : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.78rem' }}>
                        {bill.designs.length > 0 ? bill.designs.join(', ') : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '500', fontSize: '0.78rem' }}>
                        ₹{bill.calcTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--text-muted-current)', fontSize: '0.78rem' }}>
                        ₹{bill.tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '800', color: 'var(--color-primary)', fontSize: '0.78rem' }}>
                        ₹{bill.invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{
                          backgroundColor: '#dbeafe',
                          color: '#1e40af',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: '800',
                          textTransform: 'uppercase'
                        }}>
                          Settled
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr onClick={e => e.stopPropagation()} style={{ cursor: 'default' }}>
                        <td colSpan={13} style={{ padding: 0 }}>
                          {renderBillDetails(bill)}
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
  );
}



