import React from 'react';

export default function WashedInspection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', padding: '1rem' }}>
      <div style={{ fontSize: '3rem' }}>🧴</div>
      <h2 style={{ color: 'var(--color-primary)' }}>Washed Inspection</h2>
      <p style={{ color: 'var(--text-muted-current)', textAlign: 'center', maxWidth: '400px' }}>
        This module is under development. Here you will be able to perform inspections of washed fabric.
      </p>
    </div>
  );
}
