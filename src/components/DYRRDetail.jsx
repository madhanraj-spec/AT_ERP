import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Printer } from 'lucide-react';

/**
 * DYRRDetail renders a single Dyed Yarn Return Receipt (DYRR) entry.
 * Initially shows only DYRR Number, Date, and Received By.
 * Clicking the row expands to reveal a table of colour, yarn count, lot, and quantity.
 * A Print button triggers the onPrint callback.
 */
export default function DYRRDetail({ dyrr, onPrint, yarnCounts }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => setExpanded(!expanded);

  const date = dyrr.received_date
    ? new Date(dyrr.received_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const receivedBy = dyrr.received_by || '—';

  return (
    <div style={{ marginBottom: '0.75rem', maxWidth: '800px' }}>
      {/* Collapsed row */}
      <div
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          padding: '0.6rem 1rem',
          backgroundColor: expanded ? 'var(--surface-current)' : 'transparent',
          border: '1px solid var(--border-current)',
          borderRadius: '6px',
          gap: '1rem',
          fontSize: '0.8rem',
          transition: 'all 0.2s ease-in-out'
        }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <div style={{ minWidth: '120px', fontWeight: '700', color: '#800000', fontFamily: 'monospace' }}>
          {dyrr.dyrr_number || '—'}
        </div>
        <div style={{ minWidth: '120px', color: 'var(--text-current)' }}>{date}</div>
        <div style={{ minWidth: '150px', color: 'var(--text-current)' }}>Received By: {receivedBy}</div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrint && onPrint(dyrr); }}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid #800000',
            borderRadius: '4px',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            color: '#800000',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontWeight: '600'
          }}
        >
          <Printer size={12} /> Print
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0.75rem 1rem', borderLeft: '3px solid #800000', backgroundColor: '#fff', borderBottom: '1px solid var(--border-current)', borderRight: '1px solid var(--border-current)', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)' }}>
                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', textAlign: 'left', color: '#800000' }}>Colour</th>
                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', textAlign: 'left', color: '#800000' }}>Yarn Count</th>
                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', textAlign: 'left', color: '#800000' }}>Lot Number</th>
                <th style={{ padding: '0.5rem 0.75rem', fontWeight: '700', textAlign: 'right', color: '#800000' }}>Qty (kg)</th>
              </tr>
            </thead>
            <tbody>
              {dyrr.items.map((item, idx) => {
                const countId = item.yarn_count_id || item.yarn_count?.id;
                const yc = yarnCounts ? yarnCounts.find(y => y.id === countId) : item.yarn_count;
                const countDisplay = yc ? [yc.count_value, yc.spec, yc.spec1].filter(Boolean).join(' ') : '—';
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{item.colour || '—'}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{countDisplay}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{item.lot_number || '—'}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.quantity_kg || 0).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
