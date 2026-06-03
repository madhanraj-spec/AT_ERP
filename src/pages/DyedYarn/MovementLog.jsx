import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Filter, Calendar, 
  Download, Truck, ArrowRight, Package,
  History, Loader, ChevronDown, Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import DyedReceiptPrintModal from './DyedReceiptPrintModal';

export default function DyedYarnMovement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('receipts'); // 'receipts' or 'deliveries'
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    fetchMastersAndData();
  }, [activeTab]);

  const fetchMastersAndData = async () => {
    setLoading(true);
    try {
      const { data: yarnData } = await supabase.from('master_yarn_counts').select('*');
      setYarnCounts(yarnData || []);

      if (activeTab === 'receipts') {
        const { data, error } = await supabase
          .from('dyed_yarn_receipts')
          .select('*, dyeing_unit:master_partners(partner_name), items:dyed_yarn_receipt_items(*, orders(*), master_yarn_counts(*), master_locations(*))')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRecords(data || []);
      } else {
        const { data, error } = await supabase
          .from('dyed_yarn_deliveries')
          .select('*, items:dyed_yarn_delivery_items(*)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRecords(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = (activeTab === 'receipts' ? r.dyrr_number : r.dydr_number).toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.vehicle_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (r.items || []).some(i => i.colour.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDate = !dateFilter || r.created_at.startsWith(dateFilter);
    return matchesSearch && matchesDate;
  });

  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    return y ? `${y.count_value}-${y.material}` : '-';
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
      {selectedReceipt && (
        <DyedReceiptPrintModal 
          receipt={selectedReceipt} 
          onClose={() => setSelectedReceipt(null)} 
        />
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/dyed-yarn')} className="btn-icon">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Yarn Movement Log</h1>
          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Complete history of dyed yarn transactions</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #eee', marginBottom: '2rem', gap: '2rem' }}>
        <button 
          onClick={() => setActiveTab('receipts')}
          style={{
            padding: '1rem 0', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1rem', fontWeight: '700',
            color: activeTab === 'receipts' ? 'var(--color-primary)' : '#666',
            borderBottom: activeTab === 'receipts' ? '3px solid var(--color-primary)' : '3px solid transparent'
          }}
        >
          Incoming Receipts (DYRR)
        </button>
        <button 
          onClick={() => setActiveTab('deliveries')}
          style={{
            padding: '1rem 0', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '1rem', fontWeight: '700',
            color: activeTab === 'deliveries' ? 'var(--color-primary)' : '#666',
            borderBottom: activeTab === 'deliveries' ? '3px solid var(--color-primary)' : '3px solid transparent'
          }}
        >
          Outgoing Deliveries (DYDR)
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input 
            type="text" 
            placeholder="Search by receipt #, color, or vehicle..." 
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ position: 'relative', width: '200px' }}>
          <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input 
            type="date" 
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Data Table */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem' }}>
            <Loader size={32} className="spin" color="var(--color-primary)" />
            <p style={{ marginTop: '1rem', color: '#666' }}>Fetching logs...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem' }}>
            <History size={48} color="#ddd" style={{ marginBottom: '1rem' }} />
            <p style={{ color: '#999' }}>No movement records found.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: '#f9fafb', borderBottom: '2px solid #eee' }}>
                <th style={{ padding: '1rem' }}>Receipt #</th>
                <th style={{ padding: '1rem' }}>Date</th>
                <th style={{ padding: '1rem' }}>Source / Unit</th>
                <th style={{ padding: '1rem' }}>Orders & Designs</th>
                <th style={{ padding: '1rem' }}>Items Breakdown</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Total Qty (kg)</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r, idx) => {
                const items = r.items || r.dyed_yarn_receipt_items || [];
                const totalQty = items.reduce((acc, curr) => acc + (parseFloat(curr.quantity_kg) || 0), 0);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                      {activeTab === 'receipts' ? r.dyrr_number : r.dydr_number}
                    </td>
                    <td style={{ padding: '1rem', color: '#666' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {activeTab === 'receipts' ? (
                        <>
                          <div style={{ fontWeight: '700', color: r.source_type === 'production' ? '#64748b' : 'inherit' }}>
                            {r.source_type === 'production' ? 'Production Return' : (r.dyeing_unit?.partner_name || 'Partner Receipt')}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>
                             {r.dof_number && r.dof_number !== 'PRODUCTION_RETURN' ? `DOF: ${r.dof_number}` : ''}
                             {r.dc_number ? ` (DC: ${r.dc_number})` : ''}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: '700' }}>{r.items?.[0]?.process_type || '-'} Process</div>
                          <div style={{ fontSize: '0.75rem', color: '#999' }}>Delivered by: {r.delivered_by || '-'}</div>
                        </>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {Array.from(new Set(items.map(i => i.orders?.order_number).filter(Boolean))).map((on, i) => {
                          const item = items.find(it => it.orders?.order_number === on);
                          return (
                            <div key={i} style={{ fontSize: '0.75rem' }}>
                              <div style={{ fontWeight: '800' }}>{on}</div>
                              <div style={{ color: '#666', fontSize: '0.7rem' }}>
                                {item.orders?.design_no} / {item.orders?.design_name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {(r.items || []).slice(0, 2).map((item, i) => (
                          <div key={i} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                            <span>{formatYarn(item.yarn_count_id)} - <strong>{item.colour}</strong></span>
                            <span style={{ color: '#666' }}>{item.quantity_kg}kg</span>
                          </div>
                        ))}
                        {r.items?.length > 2 && <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>+{r.items.length - 2} more items</div>}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800' }}>
                      {totalQty.toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button 
                        onClick={() => setSelectedReceipt(r)}
                        className="btn-icon"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
