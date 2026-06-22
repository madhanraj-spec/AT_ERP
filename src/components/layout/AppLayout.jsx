import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

export default function AppLayout({ children, user }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        <div style={{ width: 36 }}></div> {/* Spacer to balance layout */}
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
        <main className="main-content">
          <div className="fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

