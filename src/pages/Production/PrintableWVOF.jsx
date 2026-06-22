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

function resolveWvofStatusValue(wvof) {
  if (!wvof) return 'pending';
  const todayStr = getLocalDateString(new Date());
  
  // 1. Completed state
  if (wvof.status === 'completed' || wvof.status === 'late_complete') {
    const actualEndStr = wvof.process_completed_at
      ? getLocalDateString(wvof.process_completed_at)
      : (getLocalDateString(wvof.updated_at) || todayStr);
    
    if (wvof.end_date && actualEndStr > wvof.end_date) {
      return 'late_complete';
    }
    return 'completed';
  }
  
  // 2. Stopped state
  if (wvof.status === 'stopped') {
    return 'stopped';
  }
  
  // 3. Exceeded planned end date (Late)
  if (wvof.end_date && todayStr > wvof.end_date) {
    return 'late';
  }
  
  // 4. Start date exceeded (Not started yet, but today is after start_date)
  const isStarted = !!wvof.process_started_at || wvof.status === 'on_process';
  if (!isStarted && wvof.start_date && todayStr > wvof.start_date) {
    return 'start_date_exceeded';
  }
  
  return wvof.status || 'pending';
}

function getWvofStatusBadge(wvofOrStatus) {
  let status = typeof wvofOrStatus === 'string' ? wvofOrStatus : '';
  if (wvofOrStatus && typeof wvofOrStatus === 'object') {
    status = resolveWvofStatusValue(wvofOrStatus);
  }

  switch (status) {
    case 'completed':
      return { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' };
    case 'late_completed':
    case 'late_complete':
      return { label: 'Late Completed', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    case 'late':
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    case 'start_date_exceeded':
      return { label: 'Start Date Exceeded', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    case 'stopped':
      return { label: 'Stopped', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    case 'on_process':
      return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
    case 'weft_yarn_allotted':
      return { label: 'Weft Yarn Allotted', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
    case 'weft_yarn_partially_delivered':
      return { label: 'Weft Yarn Partially Delivered', bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' };
    case 'weft_yarn_delivered':
      return { label: 'Weft Yarn Delivered', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
    case 'pending':
    default:
      return { label: 'Pending', bg: '#fef3c7', color: '#d97706', border: '#fde68a' };
  }
}

function PrintableWVOF({ wvof, order, machineName, partnerName, yarnCounts, weftYarnStatus, deliveries = [] }) {
  const printRef = useRef();
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (wvof?.weaving_number) {
      QRCode.toDataURL(wvof.weaving_number, { margin: 1, width: 100 }, (err, url) => {
        if (!err) setQrCodeUrl(url);
      });
    }
  }, [wvof?.weaving_number]);

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>WVOF - ${wvof.weaving_number}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Arial', sans-serif; color: #111; background: white; padding: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #800000; padding-bottom: 16px; margin-bottom: 20px; }
            .logo-block { display: flex; align-items: center; gap: 12px; }
            .logo-box { width: 48px; height: 48px; background: #800000; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 900; }
            .company-name { font-size: 20px; font-weight: 900; color: #1e1b4b; }
            .company-sub { font-size: 11px; color: #800000; font-weight: 600; }
            .wof-id { text-align: right; }
            .wof-number { font-size: 16px; font-weight: 900; color: #800000; font-family: monospace; }
            .wof-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; }
            .wof-date { font-size: 11px; color: #555; margin-top: 4px; }
            .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #800000; margin-bottom: 8px; border-bottom: 1px solid rgba(128,0,0,0.15); padding-bottom: 4px; }
            .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .info-item label { font-size: 9px; text-transform: uppercase; color: #888; font-weight: 700; display: block; margin-bottom: 2px; }
            .info-item .val { font-size: 13px; font-weight: 700; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th { background: #800000; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 700; }
            td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) td { background: rgba(128,0,0,0.02); }
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
  const typeLabel = wvof.weaving_type === 'in_house' ? 'In-House' : 'Job Work';
  const badge = getWvofStatusBadge(wvof);

  return (
    <div>
      <button
        onClick={handlePrint}
        style={{ marginBottom: '1.5rem', background: '#800000', color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.875rem' }}
      >
        <Printer size={16} /> Print / Download Weaving Order Form
      </button>

      {/* Printable area */}
      <div
        ref={printRef}
        style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '2rem', backgroundColor: 'white', fontFamily: 'Arial, sans-serif', color: '#111' }}
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
                <div style={{ width: '48px', height: '48px', background: '#800000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.1rem', fontWeight: '900' }}>AT</div>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#1e1b4b' }}>AT Fabric ERP</div>
                  <div style={{ fontSize: '0.7rem', color: '#800000', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weaving Order Form</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', fontWeight: '700' }}>Weaving Number</div>
              <div style={{ fontSize: '1rem', fontWeight: '900', color: '#800000', fontFamily: 'monospace' }}>{wvof.weaving_number}</div>
              <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '4px' }}>Created: {today}</div>
              <div style={{ marginTop: '6px', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '2px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '800' }}>
                  {badge.label}
                </span>
                {weftYarnStatus && (
                  <span style={{ backgroundColor: weftYarnStatus.bg, color: weftYarnStatus.color, border: `1px solid ${weftYarnStatus.border}`, padding: '2px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '800' }}>
                    Weft: {weftYarnStatus.label}
                  </span>
                )}
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
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid rgba(128,0,0,0.15)', paddingBottom: '4px' }}>Order Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Order Number', val: order?.order_number || '—' },
              { label: 'Design No', val: order?.design_no || wvof.design_no || '—' },
              { label: 'Design Name', val: order?.design_name || '—' },
              { label: 'Order Qty', val: order?.total_quantity ? `${Number(order.total_quantity).toLocaleString()} Mtrs` : '—' },
              { label: 'Weaving Qty', val: `${Number(wvof.qty).toLocaleString()} Mtrs` },
              { label: 'Weaving Type', val: typeLabel },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Machine & Schedule Info Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid rgba(128,0,0,0.15)', paddingBottom: '4px' }}>
            {wvof.weaving_type === 'in_house' ? 'Loom & Schedule' : 'Partner, Loom & Schedule'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {wvof.weaving_type === 'job_work' && (
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Weaving Partner</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{partnerName || wvof.partner_name || 'Not Assigned'}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Weaving Loom</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{machineName || wvof.machine_name || 'Not Assigned'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Start Date</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{wvof.start_date || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>End Date</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{wvof.end_date || '—'}</div>
            </div>
          </div>
        </div>

        {/* Warp Reference Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid rgba(128,0,0,0.15)', paddingBottom: '4px' }}>Warp Source Reference</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {wvof.sof_number && (
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Sizing Order Form</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111', fontFamily: 'monospace' }}>{wvof.sof_number}</div>
              </div>
            )}
            {wvof.wof_number && (
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Warping Order Form</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111', fontFamily: 'monospace' }}>{wvof.wof_number}</div>
              </div>
            )}
            {wvof.beam_number && (
              <div>
                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Beam Number</div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{wvof.beam_number}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#888', fontWeight: '700', marginBottom: '2px' }}>Source Qty</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111' }}>{Number(wvof.qty).toLocaleString()} m</div>
            </div>
          </div>
        </div>

        {/* Planned Production Schedule Section */}
        {wvof.planned_daily_production && wvof.planned_daily_production.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid rgba(128,0,0,0.15)', paddingBottom: '4px' }}>
              Planned Production Schedule
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ backgroundColor: '#800000', color: 'white', padding: '0.6rem 0.75rem', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: '800', width: '80px' }}>#</th>
                  <th style={{ backgroundColor: '#800000', color: 'white', padding: '0.6rem 0.75rem', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: '800' }}>Date</th>
                  <th style={{ backgroundColor: '#800000', color: 'white', padding: '0.6rem 0.75rem', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: '800', textAlign: 'right' }}>Planned Qty (Mtrs)</th>
                </tr>
              </thead>
              <tbody>
                {wvof.planned_daily_production.map((p, idx) => {
                  const d = new Date(p.date + 'T00:00:00');
                  const formattedDate = !isNaN(d.getTime()) 
                    ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                    : p.date;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? 'rgba(128,0,0,0.02)' : 'white' }}>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000' }}>{idx + 1}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{formattedDate}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', textAlign: 'right' }}>{Number(p.qty).toLocaleString()} m</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '2px solid #800000', backgroundColor: 'rgba(128,0,0,0.04)', fontWeight: '800' }}>
                  <td colSpan={2} style={{ padding: '0.6rem 0.75rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Total Planned</td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#800000' }}>
                    {wvof.planned_daily_production.reduce((sum, p) => sum + (parseFloat(p.qty) || 0), 0).toLocaleString()} m
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Weft Colour Allotment Table */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '800', color: '#800000', marginBottom: '0.6rem', borderBottom: '1px solid rgba(128,0,0,0.15)', paddingBottom: '4px' }}>Weft Colour & Count Allotment</div>
          {(!wvof.weft_allotments || wvof.weft_allotments.length === 0) ? (
            <div style={{ padding: '1rem', border: '1px dashed rgba(128,0,0,0.15)', borderRadius: '8px', color: '#666', fontSize: '11px', textAlign: 'center' }}>
              No weft dyed yarn allotments added yet. Edit this order form to allot weft yarn.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  {['#', 'Colour', 'Yarn Count', 'Required Qty (kg)', 'Allotted Qty (kg)', 'Delivered Qty (kg)', 'Balance Qty (kg)'].map(h => (
                    <th key={h} style={{ backgroundColor: '#800000', color: 'white', padding: '0.6rem 0.75rem', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: '800' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const formDeliveries = (deliveries || []).filter(d => d.production_form_id === wvof.id);
                  let totalRequired = 0;
                  let totalAllotted = 0;
                  let totalDelivered = 0;
                  let totalBalance = 0;

                  const rows = wvof.weft_allotments.map((row, i) => {
                    const yc = yarnCounts?.find(y => y.id === (row.countId || row.yarn_count_id || row.count_id));
                    const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (row.countValue || '—');
                    
                    const rowId = row.countId || row.yarn_count_id || row.count_id;
                    const matchingDel = formDeliveries.filter(d => 
                      d.colour === row.colour && 
                      (d.yarn_count_id === rowId || d.yarn_count?.count_value === row.countValue)
                    );
                    const deliveredQty = matchingDel.reduce((sum, d) => sum + Number(d.quantity_kg || 0), 0);
                    const allottedQty = Number(row.allotted_qty || 0);
                    const balanceQty = Math.max(0, allottedQty - deliveredQty);

                    totalRequired += Number(row.required_qty || 0);
                    totalAllotted += allottedQty;
                    totalDelivered += deliveredQty;
                    totalBalance += balanceQty;

                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'rgba(128,0,0,0.02)' : 'white' }}>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000' }}>{i + 1}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{row.colour}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{countDisplay}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700' }}>{Number(row.required_qty || 0).toFixed(2)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800', color: '#800000' }}>{allottedQty.toFixed(2)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857' }}>{deliveredQty.toFixed(2)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: balanceQty > 0.01 ? '#b45309' : '#047857' }}>{balanceQty.toFixed(2)}</td>
                      </tr>
                    );
                  });

                  return (
                    <>
                      {rows}
                      {/* Totals row */}
                      <tr style={{ borderTop: '2px solid #800000', backgroundColor: 'rgba(128,0,0,0.04)' }}>
                        <td colSpan={3} style={{ padding: '0.6rem 0.75rem', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase' }}>Total</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800' }}>{totalRequired.toFixed(2)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800', color: '#800000' }}>{totalAllotted.toFixed(2)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800', color: '#047857' }}>{totalDelivered.toFixed(2)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800', color: totalBalance > 0.01 ? '#b45309' : '#047857' }}>{totalBalance.toFixed(2)}</td>
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          )}
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px dashed #ccc' }}>
          {['Prepared By', 'Weaving Supervisor', 'Authorized By'].map(sig => (
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

export default PrintableWVOF;
