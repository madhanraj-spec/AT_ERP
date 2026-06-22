import React, { useRef } from 'react';
import { Printer } from 'lucide-react';

function PrintableWOFDC({ wof, order, splits, yarnReturns }) {
  const printRef = useRef();

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Delivery Receipt - ${wof.wofdc_number || 'WOFDC'}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Arial', sans-serif; color: #111; background: white; padding: 24px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #800000; padding-bottom: 16px; margin-bottom: 20px; }
            .logo-block { display: flex; align-items: center; gap: 12px; }
            .logo-box { width: 48px; height: 48px; background: #800000; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 900; }
            .company-name { font-size: 20px; font-weight: 900; color: #1e1b4b; }
            .company-sub { font-size: 11px; color: #800000; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            .receipt-id { text-align: right; }
            .receipt-number { font-size: 15px; font-weight: 900; color: #800000; font-family: monospace; }
            .receipt-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-weight: 700; }
            .receipt-date { font-size: 11px; color: #555; margin-top: 4px; }
            .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #800000; margin-bottom: 8px; border-bottom: 1px solid rgba(128,0,0,0.2); padding-bottom: 4px; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .info-item label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 700; display: block; margin-bottom: 2px; }
            .info-item .val { font-size: 12px; font-weight: 700; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th { background: #800000; color: white; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: 700; }
            td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) td { background: #fdf8f8; }
            .footer { margin-top: 32px; padding-top: 12px; border-top: 1px dashed #ccc; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
            .sig-block { border-top: 1px solid #333; width: 140px; padding-top: 4px; font-size: 10px; color: #555; text-align: center; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-current)', paddingTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button
          onClick={handlePrint}
          style={{
            background: '#800000',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.65rem 1.5rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: '700',
            fontSize: '0.85rem',
            boxShadow: '0 4px 10px rgba(128,0,0,0.2)'
          }}
        >
          <Printer size={16} /> Print / Download Delivery Receipt
        </button>
      </div>

      <div
        ref={printRef}
        style={{
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '2rem',
          backgroundColor: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#111'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #800000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src="/logo.png"
              alt="Company Logo"
              style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
            />
            <div style={{ display: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', background: '#800000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyStyle: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem', fontWeight: '900' }}>AT</div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#1e1b4b' }}>AT Fabric ERP</div>
                  <div style={{ fontSize: '0.7rem', color: '#800000', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Warp Order Form Delivery Receipt (WOFDC)</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', fontWeight: '700' }}>Receipt Number</div>
            <div style={{ fontSize: '1rem', fontWeight: '900', color: '#800000', fontFamily: 'monospace' }}>{wof.wofdc_number || '—'}</div>
            <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>Printed: {todayStr}</div>
          </div>
        </div>

        {/* WOF Info */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '8px', borderBottom: '1px solid rgba(128,0,0,0.2)', paddingBottom: '4px' }}>Warping Order Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12px' }}>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>WOF Number</label>
              <div style={{ fontWeight: '700', fontFamily: 'monospace' }}>{wof.wof_number}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Order Number</label>
              <div style={{ fontWeight: '700', fontFamily: 'monospace' }}>{order?.order_number || '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Design Info</label>
              <div style={{ fontWeight: '700' }}>{order?.design_no ? `${order.design_no} - ${order.design_name || ''}` : '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Start Date</label>
              <div style={{ fontWeight: '700' }}>{wof.start_date ? new Date(wof.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>End Date</label>
              <div style={{ fontWeight: '700' }}>{wof.end_date ? new Date(wof.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Completion Date</label>
              <div style={{ fontWeight: '700' }}>{formatDate(wof.process_completed_at)}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Status</label>
              <div style={{ fontWeight: '700', color: wof.process_completed_at && wof.end_date && new Date(wof.process_completed_at).toISOString().split('T')[0] > wof.end_date ? '#b91c1c' : '#166534' }}>
                {wof.process_completed_at && wof.end_date && new Date(wof.process_completed_at).toISOString().split('T')[0] > wof.end_date ? 'Completed Late' : 'Completed'}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Warper Name</label>
              <div style={{ fontWeight: '700' }}>{wof.warper_name || '—'}</div>
            </div>
          </div>
        </div>

        {/* Splits Configuration */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '8px', borderBottom: '1px solid rgba(128,0,0,0.2)', paddingBottom: '4px' }}>Warp Split Configuration</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#800000', color: 'white' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Warp Split Ref</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Beam Number</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Actual Qty (Mtrs)</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((s, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 1 ? '#fdf8f8' : 'white' }}>
                  <td style={{ padding: '6px 8px', fontWeight: '700', fontFamily: 'monospace' }}>{s.warp_no}</td>
                  <td style={{ padding: '6px 8px', fontWeight: '600' }}>{s.beam_name || '—'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>{Number(s.qty).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dyed Yarn Returns */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '8px', borderBottom: '1px solid rgba(128,0,0,0.2)', paddingBottom: '4px' }}>Dyed Yarn Return Details</div>
          {yarnReturns.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '8px 0' }}>No dyed yarn received or returned.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#800000', color: 'white' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Colour</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Count</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Lot Number</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty Received (kg)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty Returned (kg)</th>
                </tr>
              </thead>
              <tbody>
                {yarnReturns.map((r, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 1 ? '#fdf8f8' : 'white' }}>
                    <td style={{ padding: '6px 8px', fontWeight: '700' }}>{r.colour}</td>
                    <td style={{ padding: '6px 8px' }}>{r.count_display}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.lot_number}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>{Number(r.quantity_received).toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700', color: parseFloat(r.quantity_returned) > 0 ? '#b91c1c' : '#111' }}>
                      {Number(r.quantity_returned).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer / Signatures */}
        <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555' }}>
          <div>
            <div style={{ borderTop: '1px solid #333', width: '140px', paddingTop: '4px', textAlign: 'center' }}>Warper Signature</div>
          </div>
          <div>
            <div style={{ borderTop: '1px solid #333', width: '140px', paddingTop: '4px', textAlign: 'center' }}>Supervisor Signature</div>
          </div>
          <div>
            <div style={{ borderTop: '1px solid #333', width: '140px', paddingTop: '4px', textAlign: 'center' }}>Department Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrintableWOFDC;
