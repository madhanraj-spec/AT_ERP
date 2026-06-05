import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ReceiptPrintModal from './ReceiptPrintModal';

export default function ReceiptsList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('spinning'); // 'spinning' | 'production'
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // For Printable view
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Group receipts by receipt_no to display multi-count receipts on the same line (using rowspan)
  const groupedReceipts = React.useMemo(() => {
    const groups = [];
    const map = new Map();
    receipts.forEach((row) => {
      if (!map.has(row.receipt_no)) {
        const group = {
          id: row.id,
          receipt_no: row.receipt_no,
          created_at: row.created_at,
          invoice_no: row.invoice_no,
          order_form_no: row.order_form_no,
          master_partners: row.master_partners,
          invoice_amount: row.invoice_amount,
          row, // Keep reference to original row object for actions or detail modal
          items: []
        };
        map.set(row.receipt_no, group);
        groups.push(group);
      }
      map.get(row.receipt_no).items.push(row);
    });
    return groups;
  }, [receipts]);

  const fetchReceipts = async () => {
    setLoading(true);
    const typeQuery = activeTab === 'spinning' ? 'spinning_mill' : 'production';
    
    const { data, error } = await supabase
      .from('greige_yarn_receipts')
      .select(`
        *,
        master_partners (partner_name),
        master_yarn_counts (count_value, material, product_type),
        master_locations!location_id (location_name),
        orders (order_number)
      `)
      .eq('receipt_type', typeQuery)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReceipts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }} className="fade-in">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <button 
            onClick={() => navigate('/greige-yarn')} 
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.5rem' }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <h1 style={{ fontSize: '1.75rem', margin: '0', color: 'var(--text-current)', fontWeight: 'bold' }}>
            Greige Yarn Receipts
          </h1>
        </div>
        
        <button 
          onClick={() => navigate('/greige-yarn/receipt')} 
          className="btn btn-primary" 
          style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: 'bold', padding: '0.625rem 1.25rem' }}
        >
          <Plus size={18} />
          New Receipt
        </button>
      </div>

      <div className="glass-panel" style={{ padding: 0 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', padding: '0 1rem', gap: '2rem' }}>
          <button 
            onClick={() => setActiveTab('spinning')}
            style={{
              background: 'none',
              border: 'none',
              padding: '1rem 0',
              fontWeight: '600',
              color: activeTab === 'spinning' ? 'var(--color-primary)' : 'var(--text-muted-current)',
              borderBottom: activeTab === 'spinning' ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Spinning Mill
          </button>
          <button 
            onClick={() => setActiveTab('production')}
            style={{
              background: 'none',
              border: 'none',
              padding: '1rem 0',
              fontWeight: '600',
              color: activeTab === 'production' ? 'var(--color-primary)' : 'var(--text-muted-current)',
              borderBottom: activeTab === 'production' ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Production Returns
          </button>
        </div>

        {/* Table */}
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          <table className="table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Receipt No</th>
                {activeTab === 'spinning' ? (
                  <>
                    <th>Invoice No</th>
                    <th>Mill Name</th>
                    <th>Count</th>
                    <th>Location</th>
                  </>
                ) : (
                  <>
                    <th>Order Form No</th>
                    <th>Count</th>
                    <th>Location</th>
                  </>
                )}
                <th>Bags</th>
                <th>Cones</th>
                <th>Wt/Bag (kg)</th>
                <th>Wt/Cone (kg)</th>
                <th>Total Weight (kg)</th>
                <th>Rate/KG (₹)</th>
                {activeTab === 'spinning' && <th>Invoice Value</th>}
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="12" style={{ textAlign: 'center', padding: '2rem' }}>Loading receipts...</td></tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                    No receipts found for this category.
                  </td>
                </tr>
              ) : (
                groupedReceipts.map((group) => {
                  const rowSpan = group.items.length;
                  return (
                    <React.Fragment key={group.receipt_no}>
                      {group.items.map((item, index) => {
                        const isFirst = index === 0;
                        return (
                          <tr key={item.id}>
                            {isFirst && (
                              <>
                                <td rowSpan={rowSpan}>{new Date(group.created_at).toLocaleString()}</td>
                                <td rowSpan={rowSpan} style={{ fontWeight: 'bold' }}>{group.receipt_no}</td>
                                
                                {activeTab === 'spinning' ? (
                                  <>
                                    <td rowSpan={rowSpan}>{group.invoice_no || '-'}</td>
                                    <td rowSpan={rowSpan}>{group.master_partners?.partner_name || '-'}</td>
                                  </>
                                ) : (
                                  <td rowSpan={rowSpan}>{group.order_form_no || '-'}</td>
                                )}
                              </>
                            )}
                            
                            {activeTab === 'spinning' ? (
                              <>
                                <td>{item.master_yarn_counts ? `${item.master_yarn_counts.count_value} ${item.master_yarn_counts.material} ${item.master_yarn_counts.product_type || ''}` : '-'}</td>
                                <td>{item.master_locations?.location_name || '-'}</td>
                              </>
                            ) : (
                              <>
                                <td>
                                  {item.master_yarn_counts ? `${item.master_yarn_counts.count_value} ${item.master_yarn_counts.material} ${item.master_yarn_counts.product_type || ''}` : '-'}
                                  {(item.yarn_type || item.colour || item.orders?.order_number) && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                      {[item.yarn_type, item.colour, item.orders?.order_number].filter(Boolean).join(' • ')}
                                    </div>
                                  )}
                                </td>
                                <td>{item.master_locations?.location_name || '-'}</td>
                              </>
                            )}

                            <td>{item.bag_count || 0}</td>
                            <td>{item.cone_count || 0}</td>
                            <td>{Number(item.bag_weight || 0).toFixed(2)}</td>
                            <td>{Number(item.cone_weight || 0).toFixed(2)}</td>
                            <td style={{ fontWeight: 'bold' }}>{Number(item.total_weight).toFixed(2)}</td>
                            
                            <td>₹{Number(item.rate_per_kg || 0).toFixed(2)}</td>
                            
                            {isFirst && (
                              <>
                                {activeTab === 'spinning' && (
                                  <td rowSpan={rowSpan}>₹{Number(group.invoice_amount || 0).toFixed(2)}</td>
                                )}
                                
                                <td rowSpan={rowSpan} style={{ textAlign: 'right' }}>
                                  <button 
                                    onClick={() => setSelectedReceipt(group.row)}
                                    style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                                  >
                                    View
                                  </button>
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

      {selectedReceipt && (
        <ReceiptPrintModal 
          receipt={selectedReceipt} 
          onClose={() => setSelectedReceipt(null)} 
        />
      )}
    </div>
  );
}
