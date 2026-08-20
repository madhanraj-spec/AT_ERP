import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu, Calendar, ShieldCheck, User } from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';

export default function AppLayout({ children, user }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin':
        return { label: 'Admin', icon: '👑', className: 'badge-role-admin' };
      case 'merchandiser':
        return { label: 'Merchandiser', icon: '🛍️', className: 'badge-role-merchandiser' };
      case 'yarn':
      case 'greige_yarn':
      case 'dyed_yarn':
        return { label: 'Yarn Manager', icon: '🧶', className: 'badge-role-yarn' };
      case 'production':
      case 'warping_sizing':
      case 'weaving':
        return { label: 'Production Manager', icon: '🏭', className: 'badge-role-production' };
      case 'inspection':
        return { label: 'Quality & Inspection', icon: '🔍', className: 'badge-role-inspection' };
      case 'dispatch':
        return { label: 'Dispatch Dept', icon: '🚚', className: 'badge-role-dispatch' };
      default:
        return { label: role || 'Portal', icon: '👤', className: 'badge-role-default' };
    }
  };

  const roleInfo = getRoleLabel(user?.role);
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="app-layout-container">
      {/* Mobile Top Navigation Header */}
      <header className="mobile-app-header">
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="mobile-menu-toggle"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <div className="mobile-header-logo" style={{ display: 'flex', alignItems: 'center', height: '36px' }}>
          <img 
            src="/logo.png" 
            alt="Company Logo" 
            style={{ 
              height: '32px', 
              objectFit: 'contain'
            }} 
          />
        </div>
        <div className="mobile-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <NotificationBell />
        </div>
      </header>

      {/* Sidebar Backdrop Overlay on Mobile */}
      {mobileMenuOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation Drawer */}
      <Sidebar 
        user={user} 
        mobileMenuOpen={mobileMenuOpen} 
        setMobileMenuOpen={setMobileMenuOpen} 
      />

      <div className="main-content-wrapper">
        {/* Desktop Top Navigation Bar */}
        <header className="desktop-top-header">
          <div className="desktop-header-left">
            <div className="user-welcome-info">
              <span className="welcome-greeting">Welcome back,</span>
              <span className="user-display-name">{user?.full_name || 'User'}</span>
            </div>
            <span className={`topbar-role-badge ${roleInfo.className}`}>
              <span className="role-icon">{roleInfo.icon}</span>
              <span>{roleInfo.label}</span>
            </span>
          </div>

          <div className="desktop-header-right">
            <div className="header-date-badge">
              <Calendar size={14} className="date-icon" />
              <span>{todayFormatted}</span>
            </div>
            <div className="header-separator-line" />
            <NotificationBell />
          </div>
        </header>

        <main className="main-content">
          <div className="fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
