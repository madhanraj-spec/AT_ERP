import React from 'react';
import { Layers, Package, ClipboardCheck, TrendingUp } from 'lucide-react';

export default function Dashboard({ user }) {
  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Overview Dashboard</h1>
      <p style={{ color: 'var(--text-muted-current)', marginBottom: '2rem' }}>Welcome back, {user?.name}. Here's what's happening today.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel fade-in hover-lift">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', fontWeight: 500 }}>Active Orders</p>
              <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>24</h2>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(128, 0, 0, 0.1)', borderRadius: 'var(--radius-full)', color: 'var(--color-primary)' }}>
              <ClipboardCheck size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel fade-in hover-lift" style={{ animationDelay: '100ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', fontWeight: 500 }}>Yarn Inventory (Kg)</p>
              <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>32,500</h2>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-full)', color: 'var(--color-success)' }}>
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel fade-in hover-lift" style={{ animationDelay: '200ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', fontWeight: 500 }}>Running Looms</p>
              <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>14 / 20</h2>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-full)', color: '#3b82f6' }}>
              <Layers size={24} />
            </div>
          </div>
        </div>

        <div className="glass-panel fade-in hover-lift" style={{ animationDelay: '300ms' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', fontWeight: 500 }}>Production Today (Mtrs)</p>
              <h2 style={{ fontSize: '2rem', marginTop: '0.5rem' }}>1,240</h2>
            </div>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 'var(--radius-full)', color: 'var(--color-warning)' }}>
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ minHeight: '300px' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             <p style={{ fontSize: '0.875rem', color: 'var(--text-muted-current)' }}>Use the sidebar to navigate to your department-specific tools.</p>
          </div>
        </div>
        <div className="glass-panel" style={{ minHeight: '300px' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Recent Alerts</h3>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-danger)', marginTop: '6px' }} />
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Low Greige Cotton 40s Stock</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>Drops below 500kg threshold.</p>
              </div>
            </li>
            <li style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-warning)', marginTop: '6px' }} />
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Weaving Job #JW45 Delayed</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>Vendor ABC reported machine breakdown.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
