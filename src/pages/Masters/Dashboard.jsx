import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function MastersDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const basePath = profile?.role === 'admin' ? '/admin' : '/dashboard';

  const masterCategories = [
    {
      title: 'Yarn Counts',
      description: 'Manage yarn count specifications',
      icon: '🧵',
      path: '/masters/yarn-counts'
    },
    {
      title: 'Brands',
      description: 'Manage buyer brands',
      icon: '🏷️',
      path: '/masters/brands'
    },
    {
      title: 'Partners',
      description: 'Manage mills, vendors, and partners',
      icon: '🤝',
      path: '/masters/partners'
    },
    {
      title: 'Departments',
      description: 'Manage production departments',
      icon: '🏢',
      path: '/masters/departments'
    },
    {
      title: 'Machines',
      description: 'Manage production machinery',
      icon: '⚙️',
      path: '/masters/machines'
    },
    {
      title: 'Locations',
      description: 'Manage storage locations',
      icon: '📍',
      path: '/masters/locations'
    },
    {
      title: 'Beams',
      description: 'Manage warping beams',
      icon: '🎯',
      path: '/masters/beams'
    },
    {
      title: 'Workers',
      description: 'Manage staff and department assignments',
      icon: '👥',
      path: '/masters/workers'
    }
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      
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
          Back to Dashboard
        </button>
        <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0', color: 'var(--text-current)', fontWeight: 'bold' }}>
          Master Data Management
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
          Configure and manage all master data for the system
        </p>
      </div>

      {/* Grid Cards Section */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
        gap: '1.25rem'
      }}>
        {masterCategories.map((cat, index) => (
          <div 
            key={index} 
            className="hover-lift"
            style={{ 
              backgroundColor: 'var(--surface-current)', 
              border: '1px solid var(--border-current)', 
              borderRadius: 'var(--radius-md)', 
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '8px', 
                backgroundColor: 'rgba(128, 0, 0, 0.05)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '1.5rem'
              }}>
                {cat.icon}
              </div>
              <div>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--text-current)' }}>
                  {cat.title}
                </h3>
                <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
                  {cat.description}
                </p>
              </div>
            </div>
            
            <button
               onClick={() => navigate(cat.path)}
               style={{ 
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)', 
                fontWeight: '600', 
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
                padding: 0
              }}>
              Manage <ArrowLeft size={16} style={{ transform: 'rotate(180deg)'}} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
