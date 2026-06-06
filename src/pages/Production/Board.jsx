import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Package, Zap, ArrowRight, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const modules = [
  {
    id: 'warping',
    title: 'Warping Order Form',
    description: 'Create and manage warping order forms for in-house machines and job work partners. Track colour allotments, machine assignments, and progress.',
    icon: Layers,
    color: '#800000',
    lightColor: 'rgba(128,0,0,0.08)',
    path: '/production/warping-forms',
    available: true,
    stats: [
      { label: 'In-House', icon: '🏭' },
      { label: 'Job Work', icon: '🤝' },
    ]
  },
  {
    id: 'sizing',
    title: 'Sizing Order Form',
    description: 'Manage sizing processes for warp beams, track starch recipes, machine allocations, and beam handover records.',
    icon: Package,
    color: '#0ea5e9',
    lightColor: 'rgba(14,165,233,0.08)',
    path: '/production/sizing-forms',
    available: false,
  },
  {
    id: 'weaving',
    title: 'Weaving Order Form',
    description: 'Issue weaving order forms to loom operators, assign sized beams to looms, and monitor fabric production progress.',
    icon: Zap,
    color: '#10b981',
    lightColor: 'rgba(16,185,129,0.08)',
    path: '/production/weaving-forms',
    available: false,
  },
];

export default function ProductionHub() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.5rem'
        }}>
          <div style={{
            width: '42px', height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #800000, #4d0000)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Layers size={22} color="white" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-current)' }}>
            Production Management
          </h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.9rem', paddingLeft: '3.25rem' }}>
          Manage your production pipeline — from warping to weaving. Select a module to get started.
        </p>
      </div>

      {/* Module Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.5rem'
      }}>
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.id}
              className="hover-lift"
              onClick={() => mod.available && navigate(mod.path)}
              style={{
                backgroundColor: 'var(--surface-current)',
                border: '1px solid var(--border-current)',
                borderRadius: '16px',
                padding: '1.75rem',
                cursor: mod.available ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
                opacity: mod.available ? 1 : 0.72,
              }}
            >
              {/* Subtle gradient background accent */}
              <div style={{
                position: 'absolute',
                top: 0, right: 0,
                width: '120px', height: '120px',
                borderRadius: '0 16px 0 120px',
                background: mod.lightColor,
                pointerEvents: 'none'
              }} />

              {/* Coming Soon badge */}
              {!mod.available && (
                <div style={{
                  position: 'absolute',
                  top: '1rem', right: '1rem',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  fontSize: '0.65rem',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  border: '1px solid #e2e8f0'
                }}>
                  Coming Soon
                </div>
              )}

              {/* Icon */}
              <div style={{
                width: '52px', height: '52px',
                borderRadius: '12px',
                backgroundColor: mod.lightColor,
                border: `1.5px solid ${mod.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.25rem'
              }}>
                <Icon size={26} color={mod.color} />
              </div>

              {/* Title */}
              <h2 style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.1rem',
                fontWeight: '800',
                color: 'var(--text-current)'
              }}>
                {mod.title}
              </h2>

              {/* Description */}
              <p style={{
                margin: '0 0 1.5rem 0',
                color: 'var(--text-muted-current)',
                fontSize: '0.85rem',
                lineHeight: '1.55'
              }}>
                {mod.description}
              </p>

              {/* Stats chips */}
              {mod.stats && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  {mod.stats.map((s, i) => (
                    <span key={i} style={{
                      backgroundColor: mod.lightColor,
                      color: mod.color,
                      border: `1px solid ${mod.color}25`,
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      {s.icon} {s.label}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA */}
              {mod.available ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: mod.color,
                  fontWeight: '700',
                  fontSize: '0.875rem'
                }}>
                  Open Module <ArrowRight size={16} />
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#94a3b8',
                  fontWeight: '600',
                  fontSize: '0.875rem'
                }}>
                  <Clock size={15} /> Under Development
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div style={{
        marginTop: '2.5rem',
        padding: '1rem 1.25rem',
        backgroundColor: 'rgba(128,0,0,0.05)',
        border: '1px solid rgba(128,0,0,0.15)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem'
      }}>
        <AlertCircle size={18} color="#800000" style={{ marginTop: '1px', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-muted-current)', lineHeight: '1.5' }}>
          Production order forms are linked to approved orders. Ensure orders are created and approved in the Orders module before creating warping order forms.
        </p>
      </div>
    </div>
  );
}
