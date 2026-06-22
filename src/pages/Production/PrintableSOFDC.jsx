import React, { useRef } from 'react';
import { Printer } from 'lucide-react';

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

function PrintableSOFDC({ sof, order, machineName, partnerName, allSofs }) {
  const printRef = useRef();

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Delivery Challan - ${sof.sofdc_number || 'SOFDC'}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Arial', sans-serif; color: #111; background: white; padding: 24px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0284c7; padding-bottom: 16px; margin-bottom: 20px; }
            .logo-block { display: flex; align-items: center; gap: 12px; }
            .logo-box { width: 48px; height: 48px; background: #0284c7; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 900; }
            .company-name { font-size: 20px; font-weight: 900; color: #1e1b4b; }
            .company-sub { font-size: 11px; color: #0284c7; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
            .receipt-id { text-align: right; }
            .receipt-number { font-size: 15px; font-weight: 900; color: #0284c7; font-family: monospace; }
            .receipt-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-weight: 700; }
            .receipt-date { font-size: 11px; color: #555; margin-top: 4px; }
            .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #0284c7; margin-bottom: 8px; border-bottom: 1px solid rgba(2,132,199,0.2); padding-bottom: 4px; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .info-item label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 700; display: block; margin-bottom: 2px; }
            .info-item .val { font-size: 12px; font-weight: 700; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
            th { background: #0284c7; color: white; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: 700; }
            td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) td { background: #f0f9ff; }
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
  const typeLabel = sof.sizing_type === 'in_house' ? 'In-House' : 'Job Work';
  const badge = getSofStatusBadge(sof);

  // Generate SOFDC number dynamically if empty
  const sofdcNumber = sof.sofdc_number || (sof.sof_number ? sof.sof_number.replace('/SOF/', '/SOFDC/') + '/1' : '—');

  // Warp splits calculation
  const siblingSofs = allSofs
    ? allSofs
        .filter(s => s.wof_id === sof.wof_id)
        .sort((a, b) => a.sof_number.localeCompare(b.sof_number))
    : [];
  const currentSofIndex = siblingSofs.findIndex(s => s.id === sof.id);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button
          onClick={handlePrint}
          style={{
            background: '#0284c7',
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
            boxShadow: '0 4px 10px rgba(2,132,199,0.2)'
          }}
        >
          <Printer size={16} /> Print / Download Sizing Delivery Challan
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #0284c7', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src="/logo.png"
              alt="Company Logo"
              style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
            />
            <div style={{ display: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', background: '#0284c7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyStyle: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem', fontWeight: '900' }}>AT</div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#1e1b4b' }}>AT Fabric ERP</div>
                  <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sizing Delivery Challan (SOFDC)</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', fontWeight: '700' }}>Challan Number</div>
            <div style={{ fontSize: '1rem', fontWeight: '900', color: '#0284c7', fontFamily: 'monospace' }}>{sofdcNumber}</div>
            <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '4px' }}>Printed: {todayStr}</div>
          </div>
        </div>

        {/* Sizing Info */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#0284c7', marginBottom: '8px', borderBottom: '1px solid rgba(2,132,199,0.2)', paddingBottom: '4px' }}>Sizing Order Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12px' }}>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>SOF Number</label>
              <div style={{ fontWeight: '700', fontFamily: 'monospace' }}>{sof.sof_number}</div>
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
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Planned Timeline</label>
              <div style={{ fontWeight: '700' }}>{sof.start_date || '—'} to {sof.end_date || '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Actual Start Date</label>
              <div style={{ fontWeight: '700' }}>{formatDate(sof.process_started_at)}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Actual End Date</label>
              <div style={{ fontWeight: '700' }}>{formatDate(sof.process_completed_at)}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Sizing Type</label>
              <div style={{ fontWeight: '700' }}>{typeLabel}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Sizing Machine / Partner</label>
              <div style={{ fontWeight: '700' }}>
                {sof.sizing_type === 'in_house' 
                  ? (machineName || sof.machine_name || 'In-House Sizing Machine') 
                  : `${partnerName || sof.partner_name || '—'} (${machineName || sof.machine_name || '—'})`}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Sizing Quantity</label>
              <div style={{ fontWeight: '700' }}>{Number(sof.qty).toLocaleString()} Mtrs</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Beam Number</label>
              <div style={{ fontWeight: '700' }}>{sof.beam_name || '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Sizer Name</label>
              <div style={{ fontWeight: '700' }}>{sof.sizer_name || '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '9px', textTransform: 'uppercase', color: '#888', fontWeight: '700', display: 'block' }}>Status</label>
              <div style={{ marginTop: '2px' }}>
                <span style={{
                  backgroundColor: badge.bg,
                  color: badge.color,
                  border: `1px solid ${badge.border}`,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: '850',
                  display: 'inline-block',
                  textTransform: 'capitalize'
                }}>
                  {badge.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Weaving Splits Configuration */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#0284c7', marginBottom: '8px', borderBottom: '1px solid rgba(2,132,199,0.2)', paddingBottom: '4px' }}>Weaving / Warp Split Details</div>
          {(!sof.weaving_splits || sof.weaving_splits.length === 0) ? (
            <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '8px 0' }}>No weaving splits configured for this sizing beam.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#0284c7', color: 'white' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Weaving Split Ref</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Beam Number</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Quantity (Mtrs)</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', paddingLeft: '20px' }}>Planned Timeline</th>
                </tr>
              </thead>
              <tbody>
                {sof.weaving_splits.map((s, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 1 ? '#f0f9ff' : 'white' }}>
                    <td style={{ padding: '6px 8px', fontWeight: '700', fontFamily: 'monospace' }}>{s.split_no}</td>
                    <td style={{ padding: '6px 8px', fontWeight: '600' }}>{sof.beam_name || '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>{Number(s.qty).toLocaleString()} m</td>
                    <td style={{ padding: '6px 8px', paddingLeft: '20px', color: '#555' }}>{s.start_date || '—'} to {s.end_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer / Signatures */}
        <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555' }}>
          <div>
            <div style={{ borderTop: '1px solid #333', width: '140px', paddingTop: '4px', textAlign: 'center' }}>Sizer Signature</div>
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

export default PrintableSOFDC;
