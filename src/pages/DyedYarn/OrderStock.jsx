import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Filter, Package, 
  BarChart2, PieChart, TrendingUp,
  Loader, PackageOpen, ChevronRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function DyedYarnOrders() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orderStock, setOrderStock] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchStockData();
  }, []);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const [orderRes, receiptRes, deliveryRes, yarnRes] = await Promise.all([
        supabase.from('orders').select('*, master_brands(brand_name)').order('created_at', { ascending: false }),
        supabase.from('dyed_yarn_receipt_items').select('*'),
        supabase.from('dyed_yarn_delivery_items').select('*'),
        supabase.from('master_yarn_counts').select('*')
      ]);

      setYarnCounts(yarnRes.data || []);
      
      const orders = orderRes.data || [];
      const receipts = receiptRes.data || [];
      const deliveries = deliveryRes.data || [];

      const processed = orders.map(order => {
        const orderReceipts = receipts.filter(r => r.order_id === order.id);
        const orderDeliveries = deliveries.filter(d => d.order_id === order.id);

        // Group by count + color
        const stockItems = {};
        
        orderReceipts.forEach(r => {
          const key = `${r.yarn_count_id}-${r.colour}`;
          if (!stockItems[key]) stockItems[key] = { countId: r.yarn_count_id, colour: r.colour, received: 0, delivered: 0 };
          stockItems[key].received += parseFloat(r.quantity_kg);
        });

        orderDeliveries.forEach(d => {
          const key = `${d.yarn_count_id}-${d.colour}`;
          if (!stockItems[key]) stockItems[key] = { countId: d.yarn_count_id, colour: d.colour, received: 0, delivered: 0 };
          stockItems[key].delivered += parseFloat(d.quantity_kg);
        });

        const totalReceived = Object.values(stockItems).reduce((sum, i) => sum + i.received, 0);
        const totalDelivered = Object.values(stockItems).reduce((sum, i) => sum + i.delivered, 0);

        return {
          ...order,
          stockItems: Object.values(stockItems).filter(i => i.received > 0 || i.delivered > 0),
          totalReceived,
          totalDelivered,
          currentStock: totalReceived - totalDelivered
        };
      }).filter(o => o.totalReceived > 0); // Only show orders with transactions

      setOrderStock(processed);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orderStock.filter(o => 
    o.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.design_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.master_brands?.brand_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    return y ? `${y.count_value}` : '-';
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/dyed-yarn')} className="btn-icon">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Order Stock Analysis</h1>
          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Current dyed yarn inventory levels grouped by order</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard title="Total Received" value={orderStock.reduce((s,o) => s+o.totalReceived, 0).toFixed(0)} unit="kg" color="#0369a1" />
        <StatCard title="Total Issued" value={orderStock.reduce((s,o) => s+o.totalDelivered, 0).toFixed(0)} unit="kg" color="#450a0a" />
        <StatCard title="Available Stock" value={orderStock.reduce((s,o) => s+o.currentStock, 0).toFixed(0)} unit="kg" color="#0d9488" />
        <StatCard title="Active Orders" value={orderStock.length} unit="Orders" color="#92400e" />
      </div>

      {/* Filter / Search */}
      <div style={{ marginBottom: '1.5rem', position: 'relative', maxWidth: '500px' }}>
        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input 
          type="text" 
          placeholder="Search design, order #, or brand..." 
          className="form-input"
          style={{ paddingLeft: '2.5rem' }}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Grid of Order Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}>
          <Loader size={32} className="spin" color="var(--color-primary)" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          {filteredOrders.map(order => (
            <div key={order.id} style={{ 
              backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '16px', 
              padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', transition: 'transform 0.2s'
            }} className="hover-lift">
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#999', letterSpacing: '0.05em' }}>{order.master_brands?.brand_name}</div>
                  <h2 style={{ margin: '0.25rem 0 0 0', fontWeight: '900', fontSize: '1.25rem' }}>{order.order_number}</h2>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{order.design_no} / {order.design_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--color-primary)' }}>{order.currentStock.toFixed(1)} <span style={{ fontSize: '0.75rem' }}>kg</span></div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#10b981', textTransform: 'uppercase' }}>Available Stock</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {order.stockItems.map((item, idx) => {
                    const perc = (item.delivered / item.received) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ fontWeight: '700' }}>{formatYarn(item.countId)} - <span style={{color:'var(--color-primary)'}}>{item.colour}</span></span>
                          <span style={{ fontWeight: '800' }}>{(item.received - item.delivered).toFixed(1)} kg left</span>
                        </div>
                        {/* Progress Bar */}
                        <div style={{ height: '6px', backgroundColor: '#f3f4f6', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${perc}%`, backgroundColor: '#450a0a' }}></div>
                          <div style={{ width: `${100-perc}%`, backgroundColor: '#0d9488' }}></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#999' }}>
                          <span>Shared: {item.received.toFixed(0)}kg</span>
                          <span>Delivered: {item.delivered.toFixed(0)}kg</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

function StatCard({ title, value, unit, color }) {
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#999', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: '900', color }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: '#666', fontWeight: '600' }}>{unit}</div>
      </div>
    </div>
  );
}
