import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  Truck, 
  Repeat, 
  BarChart, 
  Plus, 
  ArrowRight,
  ClipboardList,
  History
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function DyedYarnDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Base path based on role
  const basePath = profile?.role === 'admin' ? '/admin' : '/dashboard';

  const cards = [
    {
      title: 'Receive Dyed Yarn',
      icon: <Download size={24} color="#0369a1" />, 
      iconBg: '#f0f9ff',
      description: 'Receive dyed yarn from dyeing partners or production returns. Select Dyeing Order Forms and record received quantities, weights, and storage locations.',
      linkText: 'Receive Yarn',
      path: '/dyed-yarn/receive'
    },
    {
      title: 'Deliver Dyed Yarn',
      icon: <Truck size={24} color="#7f1d1d" />, 
      iconBg: '#fef2f2',
      description: 'Deliver dyed yarn to warping or weaving units. Manage outgoing inventory by linking deliveries to specific production order forms.',
      linkText: 'Deliver Yarn',
      path: '/dyed-yarn/deliver'
    },
    {
      title: 'Allot to Redyeing',
      icon: <Repeat size={24} color="#dc2626" />, 
      iconBg: '#fff5f5',
      description: 'Send received dyed yarn back to the dyeing unit for redyeing since it failed the quality check.',
      linkText: 'Allot to Redyeing',
      path: '/dyed-yarn/redyeing'
    },
    {
      title: 'Track Yarn Movement',
      icon: <History size={24} color="#0d9488" />, 
      iconBg: '#f0fdfa',
      description: 'View comprehensive logs of all dyed yarn inputs and outputs. Track every receipt and delivery with complete movement details.',
      linkText: 'View Tracking',
      path: '/dyed-yarn/movement'
    },
    {
      title: 'Order Processing Status',
      icon: <ClipboardList size={24} color="#92400e" />, 
      iconBg: '#fefce8',
      description: 'View all orders with dyed yarn inventory status. Track received quantities, available stock, and receipt details by count and color.',
      linkText: 'View Order Stock',
      path: '/dyed-yarn/orders'
    },
    {
      title: 'Dyed Yarn Stock Inventory',
      icon: <BarChart size={24} color="#059669" />, 
      iconBg: '#ecfdf5',
      description: 'View stock balances by Dyeing Order Form. Track greige sent, dyed received, delivered quantities, and locations.',
      linkText: 'View Inventory',
      path: '/dyed-yarn/inventory'
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
          Dyed Yarn Management
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
          Manage dyed yarn receipts, deliveries, and track movements
        </p>
      </div>

      {/* Grid Cards Section */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
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
              transition: 'all 0.2s',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                backgroundColor: card.iconBg, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                {card.icon}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '800', color: 'var(--text-current)' }}>
                {card.title}
              </h3>
            </div>
            
            <p style={{ 
              color: 'var(--text-muted-current)', 
              fontSize: '0.875rem', 
              lineHeight: '1.6',
              flex: 1,
              marginBottom: '1.5rem'
            }}>
              {card.description}
            </p>
            
            <div style={{ 
              color: 'var(--color-primary)', 
              fontWeight: '700', 
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
        padding: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.125rem', fontWeight: '800', color: 'var(--text-current)' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <button 
            onClick={() => navigate('/dyed-yarn/receive')}
            className="btn btn-primary" 
            style={{ 
              display: 'inline-flex', 
              gap: '0.75rem', 
              alignItems: 'center', 
              fontWeight: '700', 
              padding: '0.75rem 1.75rem', 
              fontSize: '0.875rem',
              boxShadow: '0 10px 15px -3px rgba(127, 29, 29, 0.2)'
            }}
          >
            <Plus size={18} />
            Receive Dyed Yarn
          </button>
          
          <button 
            onClick={() => navigate('/dyed-yarn/deliver')}
            className="btn" 
            style={{ 
              display: 'inline-flex', 
              gap: '0.75rem', 
              alignItems: 'center', 
              fontWeight: '700', 
              padding: '0.75rem 1.75rem', 
              fontSize: '0.875rem',
              backgroundColor: '#450a0a',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}
          >
            <Plus size={18} />
            Deliver Dyed Yarn
          </button>
          
          <button 
            onClick={() => navigate('/dyed-yarn/movement')}
            style={{ 
              backgroundColor: 'transparent',
              border: '1px solid var(--border-current)',
              color: 'var(--text-current)',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex', 
              gap: '0.5rem', 
              alignItems: 'center', 
              fontWeight: '700', 
              padding: '0.75rem 1.75rem', 
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            View All Movements
          </button>
          
          <button 
            onClick={() => navigate('/dyed-yarn/orders')}
            style={{ 
              backgroundColor: 'transparent',
              border: '1px solid var(--border-current)',
              color: 'var(--text-current)',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex', 
              gap: '0.5rem', 
              alignItems: 'center', 
              fontWeight: '700', 
              padding: '0.75rem 1.75rem', 
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            View Orders
          </button>

          <button 
            onClick={() => navigate('/dyed-yarn/inventory')}
            style={{ 
              backgroundColor: 'transparent',
              border: '1px solid var(--border-current)',
              color: 'var(--text-current)',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex', 
              gap: '0.5rem', 
              alignItems: 'center', 
              fontWeight: '700', 
              padding: '0.75rem 1.75rem', 
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            View Inventory
          </button>
        </div>
      </div>

    </div>
  );
}
