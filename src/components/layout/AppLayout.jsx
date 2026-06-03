import React from 'react';
import Sidebar from './Sidebar';

export default function AppLayout({ children, user }) {
  return (
    <div className="app-container" style={{ flexDirection: 'row', height: '100vh', overflow: 'hidden' }}>
      <Sidebar user={user} />
      <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-current)' }}>
        <main className="main-content">
          <div className="fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
