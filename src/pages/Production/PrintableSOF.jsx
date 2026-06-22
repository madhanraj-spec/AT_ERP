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

function getSofStatusBadge(sof) {
  const status = sof.status;
  const todayStr = getLocalDateString(new Date());

  if (status === 'completed') {
    const actualEndStr = sof.process_completed_at
      ? getLocalDateString(sof.process_completed_at)
      : (getLocalDateString(sof.updated_at) || todayStr);

    if (sof.end_date && actualEndStr > sof.end_date) {
      return { label: 'Late Completed', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
    }
    return { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' };
  }

  switch (status) {
    case 'stopped':
      return { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    case 'on_process':
      if (sof.end_date && todayStr > sof.end_date) {
        return { label: 'Running Late', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
      }
      return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
    case 'created':
    default:
      if (sof.end_date && todayStr > sof.end_date) {
        return { label: 'Late', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' };
      }
      return { label: 'Created', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
}

function PrintableSOF({ sof, order, machineName, partnerName, allSofs }) {
  const printRef = useRef();
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (sof?.sof_number) {
      QRCode.toDataURL(sof.sof_number, { margin: 1, width: 100 }, (err, url) => {
        if (!err) setQrCodeUrl(url);
      });
    }
  }, [sof?.sof_number]);

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>SOF - ${sof.sof_number}${sof.beam_name ? ` (${sof.beam_name})` : ''}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Arial', sans-serif; color: #111; background: white; padding: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #800000; padding-bottom: 16px; margin-bottom: 20px; }
            .logo-block { display: flex; align-items: center; gap: 12px; }
            .logo-box { width: 48px; height: 48px; background: #800000; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 900; }
            .company-name { font-size: 20px; font-weight: 900; color: #1e1b4b; }
            .company-sub { font-size: 11px; color: #800000; font-weight: 600; }
            .sof-id { text-align: right; }
            .sof-number { font-size: 16px; font-weight: 900; color: #800000; font-family: monospace; }
            .sof-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; }
            .sof-date { font-size: 11px; color: #555; margin-top: 4px; }
            .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #800000; margin-bottom: 8px; border-bottom: 1px solid rgba(128,0,0,0.2); padding-bottom: 4px; }
            .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
            .info-item label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 700; display: block; margin-bottom: 2px; }
            .info-item .val { font-size: 13px; font-weight: 700; color: #111; }
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
  const typeLabel = sof.sizing_type === 'in_house' ? 'In-House' : 'Job Work';
  const badge = getSofStatusBadge(sof);

  // Warp splits calculation
  const siblingSofs = allSofs
    ? allSofs
        .filter(s => s.wof_id === sof.wof_id)
        .sort((a, b) => a.sof_number.localeCompare(b.sof_number))
    : [];
  const currentSofIndex = siblingSofs.findIndex(s => s.id === sof.id);
  const currentWarpNo = sof.wof?.warp_splits && currentSofIndex !== -1 && sof.wof.warp_splits[currentSofIndex]
    ? sof.wof.warp_splits[currentSofIndex].warp_no
    : (sof.wof?.warp_splits?.find(s => Number(s.qty) === Number(sof.qty))?.warp_no || '—');
  const splitConfigLabel = sof.wof?.warp_splits_count 
    ? `Split ${currentSofIndex !== -1 ? currentSofIndex + 1 : '?' } of ${sof.wof.warp_splits_count}` 
    : '—';

  return (
    <div>
      <button
        onClick={handlePrint}
        style={{ marginBottom: '1.5rem', background: '#800000', color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.875rem' }}
      >
        <Printer size={16} /> Print / Download SOF
      </button>

      {/* Printable area */}
      <div
        ref={printRef}
        style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '2rem', backgroundColor: 'white', fontFamily: 'Arial, sans-serif', color: '#111' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyStyle: 'space-between', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #800000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
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
                  <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e1b4b' }}>AT Fabric ERP</div>
                  <div style={{ fontSize: '0.7rem', color: '#800000', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sizing Order Form</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', fontWeight: '700' }}>SOF Number</div>
              <div style={{ fontSize: '1rem', fontWeight: '900', color: '#800000', fontFamily: 'monospace' }}>{sof.sof_number} {sof.beam_name ? `(${sof.beam_name})` : ''}</div>
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
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid rgba(128,0,0,0.2)', paddingBottom: '4px' }}>Order Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Order Number', val: order?.order_number || '—' },
              { label: 'Design No', val: order?.design_no || '—' },
              { label: 'Design Name', val: order?.design_name || '—' },
              { label: 'Warping Ref (WOF)', val: sof.wof?.wof_number || '—' },
              { label: 'Sizing Qty', val: `${Number(sof.qty).toLocaleString()} Mtrs` },
              { label: 'Type', val: typeLabel },
              { label: 'Warp Number', val: currentWarpNo },
              { label: 'Warp Split Config', val: splitConfigLabel },
              { label: 'Beam Number', val: sof.beam_name || '—' },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Warp Split Details */}
        {sof.wof?.warp_splits && sof.wof.warp_splits.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid rgba(128,0,0,0.2)', paddingBottom: '4px' }}>Warp Split Details</div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#fcf8f8', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '6px 12px', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: '#800000' }}>Warp No</th>
                    <th style={{ padding: '6px 12px', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: '#800000' }}>Quantity (Qty)</th>
                    <th style={{ padding: '6px 12px', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: '#800000' }}>Estimated Timeline</th>
                    <th style={{ padding: '6px 12px', fontWeight: '800', fontSize: '0.65rem', textTransform: 'uppercase', color: '#800000', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sof.wof.warp_splits.map((split, index) => {
                    const isCurrent = split.warp_no === currentWarpNo;
                    return (
                      <tr
                        key={index}
                        style={{
                          borderBottom: index < sof.wof.warp_splits.length - 1 ? '1px solid #e5e7eb' : 'none',
                          backgroundColor: isCurrent ? 'rgba(128, 0, 0, 0.04)' : 'transparent',
                          fontWeight: isCurrent ? '700' : 'normal'
                        }}
                      >
                        <td style={{ padding: '8px 12px', color: isCurrent ? '#800000' : '#111' }}>
                          {split.warp_no} {isCurrent && <span style={{ fontSize: '0.65rem', color: '#800000', fontWeight: '600', fontStyle: 'italic', marginLeft: '6px', backgroundColor: 'rgba(128, 0, 0, 0.08)', padding: '1px 6px', borderRadius: '4px' }}>Current SOF</span>}
                        </td>
                        <td style={{ padding: '8px 12px', color: isCurrent ? '#800000' : '#111' }}>
                          {Number(split.qty).toLocaleString()} Mtrs
                        </td>
                        <td style={{ padding: '8px 12px', color: isCurrent ? '#800000' : '#111' }}>
                          {split.start_date || '—'} to {split.end_date || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: isCurrent ? '#800000' : '#6b7280' }}>
                          {isCurrent ? (
                            <span style={{ fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', color: '#800000' }}>Active SOF</span>
                          ) : (
                            <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#9ca3af' }}>Split Reference</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Machine Info Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid rgba(128,0,0,0.2)', paddingBottom: '4px' }}>
            {sof.sizing_type === 'in_house' ? 'Machine & Schedule' : 'Partner, Machine & Schedule'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {sof.sizing_type === 'job_work' && (
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Sizing Partner</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{partnerName || '—'}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Machine</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{machineName || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Start Date</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{sof.start_date || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>End Date</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{sof.end_date || '—'}</div>
            </div>
          </div>
        </div>

        {/* Weaving Info Section */}
        {sof.forwarded_to === 'weaving' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#059669', marginBottom: '0.6rem', borderBottom: '1px solid #a7f3d0', paddingBottom: '4px' }}>
              Weaving Forwarding Schedule
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {sof.weaving_type === 'job_work' && (
                <div>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Weaving Partner</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{sof.weaving_partner_name || '—'}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Weaving Loom</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{sof.weaving_machine_name || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Weaving Start Date</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{sof.weaving_start_date || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Weaving End Date</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{sof.weaving_end_date || '—'}</div>
              </div>
            </div>
          </div>
        )}

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

export default PrintableSOF;
