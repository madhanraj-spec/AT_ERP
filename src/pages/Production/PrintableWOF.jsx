import React, { useRef, useState, useEffect } from 'react';
import { Printer } from 'lucide-react';
import QRCode from 'qrcode';

function getLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWofStatusBadge(wof) {
  const todayStr = getLocalDateString(new Date());

  if (wof.status === 'completed') {
    const actualEndStr = wof.process_completed_at
      ? getLocalDateString(wof.process_completed_at)
      : (getLocalDateString(wof.updated_at) || todayStr);
    if (wof.end_date && actualEndStr > wof.end_date) {
      return { label: 'Completed Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' };
  }
  if (wof.status === 'stopped') {
    return { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
  }
  if (wof.status === 'on_process') {
    if (wof.end_date && todayStr > wof.end_date) {
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
  }
  if (wof.status === 'created') {
    if (wof.end_date && todayStr > wof.end_date) {
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'Created', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
  return { label: wof.status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
}

function PrintableWOF({ wof, order, machineName, partnerName, yarnCounts }) {
  const printRef = useRef();
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (wof?.wof_number) {
      QRCode.toDataURL(wof.wof_number, { margin: 1, width: 100 }, (err, url) => {
        if (!err) setQrCodeUrl(url);
      });
    }
  }, [wof?.wof_number]);

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>WOF - ${wof.wof_number}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Arial', sans-serif; color: #111; background: white; padding: 24px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4d0000; padding-bottom: 16px; margin-bottom: 20px; }
            .logo-block { display: flex; align-items: center; gap: 12px; }
            .logo-box { width: 48px; height: 48px; background: #4d0000; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 900; }
            .company-name { font-size: 20px; font-weight: 900; color: #1e1b4b; }
            .company-sub { font-size: 11px; color: #800000; font-weight: 600; }
            .wof-id { text-align: right; }
            .wof-number { font-size: 16px; font-weight: 900; color: #4d0000; font-family: monospace; }
            .wof-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; }
            .wof-date { font-size: 11px; color: #555; margin-top: 4px; }
            .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #800000; margin-bottom: 8px; border-bottom: 1px solid #f5d5d5; padding-bottom: 4px; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .info-item label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 700; display: block; margin-bottom: 2px; }
            .info-item .val { font-size: 13px; font-weight: 700; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th { background: #4d0000; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; }
            td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) td { background: #fdf8f8; }
            .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; border: 1px solid; }
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

  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const typeLabel = wof.wof_type === 'in_house' ? 'In-House' : 'Job Work';
  const badge = getWofStatusBadge(wof);

  return (
    <div>
      <button
        onClick={handlePrint}
        style={{ marginBottom: '1.5rem', background: '#4d0000', color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.875rem' }}
      >
        <Printer size={16} /> Print / Download WOF
      </button>

      {/* Printable area */}
      <div
        ref={printRef}
        style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '2rem', backgroundColor: 'white', fontFamily: 'Arial, sans-serif', color: '#111' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyStyle: 'space-between', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #4d0000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src="/logo.png"
              alt="Company Logo"
              style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
            />
            <div style={{ display: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', background: '#4d0000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyStyle: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem', fontWeight: '900' }}>AT</div>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e1b4b' }}>AT Fabric ERP</div>
                  <div style={{ fontSize: '0.7rem', color: '#800000', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Warping Order Form</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', fontWeight: '700' }}>WOF Number</div>
              <div style={{ fontSize: '1rem', fontWeight: '900', color: '#4d0000', fontFamily: 'monospace' }}>{wof.wof_number}</div>
              <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '4px' }}>Created: {today}</div>
              <div style={{ marginTop: '6px' }}>
                <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '2px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '800' }}>
                  {badge.label}
                </span>
              </div>
            </div>
            {qrCodeUrl && (
              <img 
                src={qrCodeUrl}
                alt="QR Code"
                style={{ width: '70px', height: '70px', border: '1px solid #e5e7eb', padding: '2px', borderRadius: '4px', backgroundColor: '#fff' }}
              />
            )}
          </div>
        </div>

        {/* Order Info Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid #f5d5d5', paddingBottom: '4px' }}>Order Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Order Number', val: order?.order_number || '—' },
              { label: 'Design No', val: order?.design_no || '—' },
              { label: 'Design Name', val: order?.design_name || '—' },
              { label: 'Order Qty', val: order?.total_quantity ? `${Number(order.total_quantity).toLocaleString()} Mtrs` : '—' },
              { label: 'WOF Qty', val: `${Number(wof.qty).toLocaleString()} Mtrs` },
              { label: 'Type', val: typeLabel },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Machine Info Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid #f5d5d5', paddingBottom: '4px' }}>
            {wof.wof_type === 'in_house' ? 'Machine & Schedule' : 'Partner, Machine & Schedule'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {wof.wof_type === 'job_work' && (
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Warping Partner</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{partnerName || '—'}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Machine</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{machineName || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Start Date</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{wof.start_date || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>End Date</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{wof.end_date || '—'}</div>
            </div>
          </div>
        </div>

        {/* Colour Allotment Table */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid #f5d5d5', paddingBottom: '4px' }}>Warp Colour & Count Allotment</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {['#', 'Colour', 'Yarn Count', 'Required Qty (kg)', 'Allotted Qty (kg)'].map(h => (
                  <th key={h} style={{ backgroundColor: '#4d0000', color: 'white', padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(wof.colour_allotments || []).map((row, i) => {
                const yc = yarnCounts?.find(y => y.id === (row.countId || row.yarn_count_id || row.count_id));
                const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (row.countValue || '—');
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? '#fdf8f8' : 'white' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000' }}>{i + 1}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{row.colour}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{countDisplay}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>{Number(row.required_qty || 0).toFixed(2)}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800', color: '#4d0000' }}>{Number(row.allotted_qty || 0).toFixed(2)}</td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ borderTop: '2px solid #4d0000', backgroundColor: '#fdf2f2' }}>
                <td colSpan={3} style={{ padding: '0.6rem 0.75rem', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase' }}>Total</td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800' }}>
                  {(wof.colour_allotments || []).reduce((s, r) => s + Number(r.required_qty || 0), 0).toFixed(2)}
                </td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800', color: '#4d0000' }}>
                  {(wof.colour_allotments || []).reduce((s, r) => s + Number(r.allotted_qty || 0), 0).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyStyle: 'space-between', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px dashed #ccc' }}>
          {['Prepared By', 'Production Supervisor', 'Authorized By'].map(sig => (
            <div key={sig} style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #333', width: '140px', paddingTop: '4px', fontSize: '0.7rem', color: '#555' }}>{sig}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.65rem', color: '#aaa' }}>
          Generated by AT Fabric ERP • {today}
        </div>
      </div>
    </div>
  );
}

export default PrintableWOF;
