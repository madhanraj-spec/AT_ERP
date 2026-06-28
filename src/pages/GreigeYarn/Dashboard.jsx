import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  BarChart2, 
  TrendingUp, 
  Plus, 
  ArrowRight,
  HelpCircle,
  Database,
  Activity,
  Layers
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function GreigeYarnDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [receipts, setReceipts] = useState([]);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Base path based on role so back button works correctly
  const basePath = profile?.role === 'admin' ? '/admin' : '/dashboard';

  useEffect(() => {
    async function fetchStockData() {
      try {
        setLoading(true);
        const { data: recData } = await supabase
          .from('greige_yarn_receipts')
          .select(`
            *,
            master_yarn_counts (*),
            master_partners (*)
          `)
          .order('created_at', { ascending: false });

        const { data: gydrItems } = await supabase
          .from('greige_yarn_delivery_items')
          .select('yarn_count_id, quantity_kg, spinning_mill_id, location_id');

        if (recData) setReceipts(recData);
        if (gydrItems) setDeliveryItems(gydrItems);
      } catch (err) {
        console.error('Error fetching stock data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStockData();
  }, []);

  const stockByCount = useMemo(() => {
    // 1) Clone receipts and initialize available_weight
    const receiptsClone = receipts.map(r => ({
      ...r,
      available_weight: parseFloat(r.total_weight || 0)
    }));

    // 2) Run FIFO stock deduction per combination of count + mill + location
    const comboKeys = {};
    receiptsClone.forEach(r => {
      const key = `${r.yarn_count_id}_${r.spinning_mill_id || 'null'}_${r.location_id}`;
      comboKeys[key] = {
        yarn_count_id: r.yarn_count_id,
        spinning_mill_id: r.spinning_mill_id,
        location_id: r.location_id
      };
    });

    Object.values(comboKeys).forEach(({ yarn_count_id, spinning_mill_id, location_id }) => {
      // Get all receipts for this combo, sorted oldest first (FIFO)
      const comboReceipts = receiptsClone
        .filter(r => r.yarn_count_id === yarn_count_id && r.spinning_mill_id === spinning_mill_id && r.location_id === location_id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      // Get total delivered for this combo
      let totalDeliveredForCombo = deliveryItems
        .filter(d => d.yarn_count_id === yarn_count_id && d.spinning_mill_id === spinning_mill_id && d.location_id === location_id)
        .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

      // Deduct from oldest first
      for (const rec of comboReceipts) {
        if (totalDeliveredForCombo <= 0) break;
        const deduct = Math.min(rec.available_weight, totalDeliveredForCombo);
        rec.available_weight -= deduct;
        totalDeliveredForCombo -= deduct;
      }
    });

    // 3) Group by count ID
    const groups = {};
    receiptsClone.forEach(r => {
      const cid = r.yarn_count_id || 'unknown';
      if (!groups[cid]) {
        groups[cid] = {
          id: cid,
          yarn_count: r.master_yarn_counts
            ? `${r.master_yarn_counts.count_value} ${r.master_yarn_counts.material}`
            : 'Unknown Count',
          count_value: r.master_yarn_counts?.count_value || '',
          material: r.master_yarn_counts?.material || '',
          product_type: r.master_yarn_counts?.product_type || '',
          available_weight: 0,
          mill_weights: {}
        };
      }

      groups[cid].available_weight += r.available_weight;

      // Group by mill for tooltip
      const millName = r.spinning_mill_id ? (r.master_partners?.partner_name || 'Unknown Mill') : 'Production Returns';
      if (r.available_weight > 0) {
        if (!groups[cid].mill_weights[millName]) {
          groups[cid].mill_weights[millName] = 0;
        }
        groups[cid].mill_weights[millName] += r.available_weight;
      }
    });

    return Object.values(groups)
      .map(group => {
        const mills = Object.entries(group.mill_weights)
          .map(([name, weight]) => ({ name, weight }))
          .filter(m => m.weight > 0)
          .sort((a, b) => b.weight - a.weight);

        return {
          ...group,
          mills
        };
      })
      .filter(g => g.available_weight > 0)
      .sort((a, b) => b.available_weight - a.available_weight);
  }, [receipts, deliveryItems]);

  const totalStockKg = useMemo(() => {
    return stockByCount.reduce((sum, item) => sum + item.available_weight, 0);
  }, [stockByCount]);

  const cards = [
    {
      title: 'Greige Yarn Receipts',
      icon: <Package size={24} color="#854d0e" />, // Brownish icon color
      iconBg: '#fefce8',
      description: 'View all greige yarn receipts from spinning mills. Track incoming yarn with invoice details, weights, and storage locations.',
      linkText: 'View Receipts',
      path: '/greige-yarn/receipts'
    },
    {
      title: 'Greige Yarn Deliveries',
      icon: <Truck size={24} color="#ea580c" />, // Orangeish icon color
      iconBg: '#fff7ed',
      description: 'Track all greige yarn deliveries to dyeing, warping, weaving, or twisting units. Manage outgoing yarn inventory.',
      linkText: 'View Deliveries',
      path: '/greige-yarn/deliveries'
    },
    {
      title: 'Stock Management',
      icon: <BarChart2 size={24} color="#0284c7" />, // Blueish icon color
      iconBg: '#f0f9ff',
      description: 'Complete inventory dashboard showing current stock levels by count, location-wise stock, and delivery summaries.',
      linkText: 'View Dashboard',
      path: '/greige-yarn/stock'
    },
    {
      title: 'Track Yarn Movement',
      icon: <TrendingUp size={24} color="#e11d48" />, // Redish icon color
      iconBg: '#fff1f2',
      description: 'View comprehensive logs of all greige yarn inputs and outputs. Track every receipt and delivery with complete details.',
      linkText: 'View Tracking',
      path: '/greige-yarn/movement'
    }
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }}>
      
      {/* Top Header Section */}
      <div style={{ marginBottom: '2rem' }}>
        <button 
          onClick={() => navigate(basePath)} 
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--color-primary)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            fontSize: '0.875rem', 
            fontWeight: '600', 
            cursor: 'pointer',
            padding: '0',
            marginBottom: '0.75rem'
          }}
        >
          <ArrowLeft size={16} />
          Back to Main Dashboard
        </button>
        <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0', color: 'var(--text-current)', fontWeight: 'bold' }}>
          Greige Yarn Management
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
          Manage yarn receipts, deliveries, stock, and track movements
        </p>
      </div>

      {/* Grid Cards Section */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '1.25rem', 
        marginBottom: '2rem' 
      }}>
        {cards.map((card, index) => (
          <div 
            key={index} 
            className="hover-lift"
            onClick={() => navigate(card.path)}
            style={{ 
              backgroundColor: 'var(--surface-current)', 
              border: '1px solid var(--border-current)', 
              borderRadius: 'var(--radius-md)', 
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                backgroundColor: card.iconBg, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                {card.icon}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--text-current)' }}>
                {card.title}
              </h3>
            </div>
            
            <p style={{ 
              color: 'var(--text-muted-current)', 
              fontSize: '0.875rem', 
              lineHeight: '1.5',
              flex: 1,
              marginBottom: '1.5rem'
            }}>
              {card.description}
            </p>
            
            <div style={{ 
              color: 'var(--color-primary)', 
              fontWeight: '600', 
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              {card.linkText} <ArrowRight size={16} />
            </div>
          </div>
        ))}
      </div>

      {/* CSS Styles for Tooltips and Cards */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        .stock-section {
          background: var(--surface-current);
          border: 1px solid var(--border-current);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: var(--shadow-sm);
          position: relative;
          overflow: visible;
        }
        .stock-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-current);
          padding-bottom: 1rem;
        }
        .stock-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-current);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .stock-subtitle {
          font-size: 0.875rem;
          color: var(--text-muted-current);
          margin-top: 0.25rem;
        }
        .stock-summary-card {
          background: linear-gradient(135deg, rgba(128, 0, 0, 0.06) 0%, rgba(128, 0, 0, 0.01) 100%);
          border: 1px solid rgba(128, 0, 0, 0.15);
          border-radius: var(--radius-md);
          padding: 1rem 1.5rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .stock-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }
        .stock-item-card {
          background: rgba(255, 255, 255, 0.6);
          border: 1px solid var(--border-current);
          border-radius: var(--radius-md);
          padding: 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          transition: all var(--transition-fast);
          cursor: default;
        }
        .stock-item-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
          border-color: var(--color-primary);
          background: rgba(255, 255, 255, 0.9);
        }
        .stock-item-info {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .stock-item-count {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--text-current);
        }
        .stock-item-badges {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .stock-badge {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .stock-badge-material {
          background-color: rgba(128, 0, 0, 0.08);
          color: var(--color-primary);
          border: 1px solid rgba(128, 0, 0, 0.15);
        }
        .stock-badge-type {
          background-color: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        .stock-item-qty-container {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          position: relative;
          cursor: help;
        }
        .stock-item-qty {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-primary);
        }
        .stock-item-unit {
          font-size: 0.85rem;
          color: var(--text-muted-current);
          font-weight: 500;
        }
        .stock-tooltip {
          visibility: hidden;
          opacity: 0;
          position: absolute;
          bottom: calc(100% + 10px);
          right: 0;
          background-color: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          width: 250px;
          padding: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -4px rgba(0, 0, 0, 0.25);
          z-index: 100;
          transition: opacity 0.2s, visibility 0.2s;
          pointer-events: none;
          font-size: 0.75rem;
          line-height: 1.4;
          color: #f8fafc;
        }
        .stock-item-qty-container:hover .stock-tooltip,
        .stock-item-card:hover .stock-tooltip {
          visibility: visible;
          opacity: 1;
        }
        .stock-tooltip-arrow {
          position: absolute;
          top: 100%;
          right: 15px;
          border-width: 6px;
          border-style: solid;
          border-color: #1e293b transparent transparent transparent;
        }
        .stock-tooltip-header {
          font-weight: 700;
          color: #38bdf8;
          border-bottom: 1px solid #334155;
          padding-bottom: 0.35rem;
          margin-bottom: 0.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .stock-tooltip-row {
          display: flex;
          justify-content: space-between;
          padding: 0.25rem 0;
        }
        .stock-tooltip-mill {
          color: #94a3b8;
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .stock-tooltip-weight {
          font-weight: 600;
          color: #f1f5f9;
        }
      `}</style>

      {/* Stock Availability Section */}
      <div className="stock-section fade-in" style={{ animationDelay: '150ms' }}>
        <div className="stock-header">
          <div>
            <h2 className="stock-title">
              <Database size={20} color="var(--color-primary)" />
              Greige Yarn Stock Availability
            </h2>
            <p className="stock-subtitle">
              Live available stock count and mill breakdown
            </p>
          </div>
          <button 
            onClick={() => navigate('/greige-yarn/stock')}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(128, 0, 0, 0.3)',
              color: 'var(--color-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(128, 0, 0, 0.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Manage Stock <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Activity size={24} className="spin" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--color-primary)' }} />
            <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', margin: 0 }}>
              Calculating real-time inventory balances...
            </p>
          </div>
        ) : stockByCount.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-current)' }}>
            <Package size={32} style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--text-muted-current)' }} />
            <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', margin: 0 }}>
              No available greige yarn stock. Receipts are either empty or fully delivered.
            </p>
          </div>
        ) : (
          <>
            {/* Summary card */}
            <div className="stock-summary-card">
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Raw Inventory
                </span>
                <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                  {totalStockKg.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span style={{ fontSize: '1rem', fontWeight: '600' }}>kg</span>
                </h3>
              </div>
              <div style={{ backgroundColor: 'rgba(128, 0, 0, 0.1)', padding: '0.75rem', borderRadius: '50%', color: 'var(--color-primary)' }}>
                <Layers size={24} />
              </div>
            </div>

            {/* Grid of stock cards */}
            <div className="stock-grid">
              {stockByCount.map((item) => (
                <div key={item.id} className="stock-item-card">
                  <div className="stock-item-info">
                    <span className="stock-item-count">{item.count_value}</span>
                    <div className="stock-item-badges">
                      {item.material && <span className="stock-badge stock-badge-material">{item.material}</span>}
                      {item.product_type && <span className="stock-badge stock-badge-type">{item.product_type}</span>}
                    </div>
                  </div>
                  
                  <div className="stock-item-qty-container">
                    <span className="stock-item-qty">
                      {item.available_weight.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                    <span className="stock-item-unit">kg</span>
                    <HelpCircle size={14} style={{ color: 'var(--text-muted-current)', opacity: 0.7 }} />

                    {/* Mill Breakdown Tooltip */}
                    <div className="stock-tooltip">
                      <div className="stock-tooltip-arrow"></div>
                      <div className="stock-tooltip-header">
                        <span>Mill Availability</span>
                        <span>Weight (kg)</span>
                      </div>
                      {item.mills.length === 0 ? (
                        <div style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '0.25rem 0' }}>
                          No mill logs found
                        </div>
                      ) : (
                        item.mills.map((mill, idx) => (
                          <div key={idx} className="stock-tooltip-row">
                            <span className="stock-tooltip-mill" title={mill.name}>{mill.name}</span>
                            <span className="stock-tooltip-weight">{mill.weight.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Quick Actions Panel */}
      <div style={{ 
        backgroundColor: 'var(--surface-current)', 
        border: '1px solid var(--border-current)', 
        borderRadius: 'var(--radius-lg)', 
        padding: '1.5rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-current)' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <button 
            onClick={() => navigate('/greige-yarn/receipt')}
            className="btn btn-primary" 
            style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: '600', padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
          >
            <Plus size={16} />
            New Receipt
          </button>
          
          <button 
            onClick={() => navigate('/greige-yarn/new-delivery')}
            className="btn btn-primary" 
            style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: '600', padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
          >
            <Plus size={16} />
            New Delivery
          </button>
          
          <button 
            onClick={() => navigate('/greige-yarn/receipts')}
            style={{ 
              backgroundColor: 'transparent',
              border: '1px solid var(--border-current)',
              color: 'var(--text-current)',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex', 
              gap: '0.5rem', 
              alignItems: 'center', 
              fontWeight: '600', 
              padding: '0.625rem 1.25rem', 
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            View All Receipts
          </button>
          
          <button 
            onClick={() => navigate('/greige-yarn/deliveries')}
            style={{ 
              backgroundColor: 'transparent',
              border: '1px solid var(--border-current)',
              color: 'var(--text-current)',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex', 
              gap: '0.5rem', 
              alignItems: 'center', 
              fontWeight: '600', 
              padding: '0.625rem 1.25rem', 
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            View All Deliveries
          </button>
        </div>
      </div>

    </div>
  );
}
