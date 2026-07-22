import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * DYDRDetail renders a single Dyed Yarn Delivery Receipt (DYDR) entry.
 * Initially shows only DYDR Number, Date, and Delivered By.
 * Clicking the row expands to reveal a table of colour, yarn count, lot, and quantity.
 * A Print button triggers the onPrint callback.
 */
export default function DYDRDetail({ dydr, onPrint, yarnCounts }) {
  const [expanded, setExpanded] = useState(false);
  const [partnerDetails, setPartnerDetails] = useState(null);

  const toggle = () => setExpanded(!expanded);

  const date = dydr.delivered_date
    ? new Date(dydr.delivered_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const deliveredBy = dydr.delivered_by || '—';

  useEffect(() => {
    async function resolvePartner() {
      if (dydr.partner) {
        setPartnerDetails(dydr.partner);
        return;
      }
      
      let partnerId = dydr.partner_id;
      const items = dydr.items || [];
      let formId = null;
      let processType = null;
      
      if (items.length > 0) {
        formId = items[0].production_form_id;
        processType = items[0].process_type;
      } else {
        try {
          const { data: dbItems } = await supabase
            .from('dyed_yarn_delivery_items')
            .select('production_form_id, process_type')
            .eq('delivery_id', dydr.id);
          if (dbItems && dbItems.length > 0) {
            formId = dbItems[0].production_form_id;
            processType = dbItems[0].process_type;
          }
        } catch (e) {
          console.error(e);
        }
      }
      
      if (!partnerId && formId && processType) {
        try {
          const dbTable = processType === 'warping' 
            ? 'warping_order_forms' 
            : processType === 'redyeing' 
            ? 'dyeing_order_forms' 
            : 'weaving_orders';
          const partnerCol = processType === 'redyeing' ? 'dyeing_unit_id' : 'partner_id';
          const { data: formRecord } = await supabase
            .from(dbTable)
            .select(partnerCol)
            .eq('id', formId)
            .maybeSingle();
          if (formRecord?.[partnerCol]) {
            partnerId = formRecord[partnerCol];
          }
        } catch (e) {
          console.error(e);
        }
      }
      
      if (!partnerId && dydr.dyeing_unit_id) {
        partnerId = dydr.dyeing_unit_id;
      }

      if (partnerId) {
        try {
          const { data: partnerData } = await supabase
            .from('master_partners')
            .select('*')
            .eq('id', partnerId)
            .maybeSingle();
          setPartnerDetails(partnerData);
        } catch (e) {
          console.error(e);
        }
      }
    }
    
    if (expanded) {
      resolvePartner();
    }
  }, [dydr, expanded]);

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
          {dydr.dydr_number || '—'}
        </div>
        <div style={{ minWidth: '120px', color: 'var(--text-current)' }}>{date}</div>
        <div style={{ minWidth: '150px', color: 'var(--text-current)' }}>{deliveredBy}</div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrint && onPrint({ ...dydr, partner: partnerDetails }); }}
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
          {partnerDetails && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px dashed var(--border-current)', fontSize: '0.75rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted-current)', fontWeight: 'bold' }}>Delivery To (Partner):</span>
                <div style={{ fontWeight: '700', marginTop: '2px' }}>{partnerDetails.partner_name}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted-current)', fontWeight: 'bold' }}>Address:</span>
                <div style={{ marginTop: '2px', whiteSpace: 'pre-wrap' }}>{partnerDetails.address || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted-current)', fontWeight: 'bold' }}>GSTIN:</span>
                <div style={{ marginTop: '2px' }}>{partnerDetails.gstin || '—'}</div>
              </div>
            </div>
          )}
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
              {(dydr.items || []).map((item, idx) => {
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
