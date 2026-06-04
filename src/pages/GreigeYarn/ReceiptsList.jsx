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

  useEffect(() => {
    fetchReceipts();
  }, [activeTab]);

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

  const getSpinningCount = () => receipts.length; // Approximate, would normally do distinct query but for now current array size works if we don't paginate

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
                receipts.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td style={{ fontWeight: 'bold' }}>{row.receipt_no}</td>
                    
                    {activeTab === 'spinning' ? (
                      <>
                        <td>{row.invoice_no || '-'}</td>
                        <td>{row.master_partners?.partner_name || '-'}</td>
                        <td>{row.master_yarn_counts ? `${row.master_yarn_counts.count_value} ${row.master_yarn_counts.material} ${row.master_yarn_counts.product_type || ''}` : '-'}</td>
                        <td>{row.master_locations?.location_name || '-'}</td>
                      </>
                    ) : (
                      <>
                        <td>{row.order_form_no || '-'}</td>
                        <td>
                          {row.master_yarn_counts ? `${row.master_yarn_counts.count_value} ${row.master_yarn_counts.material} ${row.master_yarn_counts.product_type || ''}` : '-'}
                          {(row.yarn_type || row.colour || row.orders?.order_number) && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                              {[row.yarn_type, row.colour, row.orders?.order_number].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </td>
                        <td>{row.master_locations?.location_name || '-'}</td>
                      </>
                    )}

                    <td>{row.bag_count || 0}</td>
                    <td>{row.cone_count || 0}</td>
                    <td>{Number(row.bag_weight || 0).toFixed(2)}</td>
                    <td>{Number(row.cone_weight || 0).toFixed(2)}</td>
                    <td style={{ fontWeight: 'bold' }}>{Number(row.total_weight).toFixed(2)}</td>
                    
                    <td>₹{Number(row.rate_per_kg || 0).toFixed(2)}</td>
                    
                    {activeTab === 'spinning' && (
                      <td>₹{Number(row.invoice_amount || 0).toFixed(2)}</td>
                    )}
                    
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => setSelectedReceipt(row)}
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
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
