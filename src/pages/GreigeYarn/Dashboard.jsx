import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  BarChart2, 
  TrendingUp, 
  Plus, 
  ArrowRight 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function GreigeYarnDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Base path based on role so back button works correctly
  const basePath = profile?.role === 'admin' ? '/admin' : '/dashboard';

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
