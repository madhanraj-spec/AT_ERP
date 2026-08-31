import React, { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../../contexts/AuthContext';

export default function PrintablePOFModal({ pof, order, onClose }) {
  const { profile } = useAuth();
  const [printDensity, setPrintDensity] = useState('compact');
  const [printLayout, setPrintLayout] = useState('two-column');
  const [printFontSize, setPrintFontSize] = useState('medium');
  const [printShowLogo, setPrintShowLogo] = useState(true);
  const [printShowQr, setPrintShowQr] = useState(true);
  const [pofQrUrl, setPofQrUrl] = useState('');

  useEffect(() => {
    if (pof?.pof_number) {
      QRCode.toDataURL(pof.pof_number, { margin: 1, width: 120 }, (err, url) => {
        if (!err) {
          setPofQrUrl(url);
        } else {
          console.error('Error generating POF QR code:', err);
          setPofQrUrl('');
        }
      });
    } else {
      setPofQrUrl('');
    }
  }, [pof?.pof_number]);

  if (!pof) return null;

  // Calculate density styles and list partitions
  const cellPadding = printDensity === 'extra-compact' ? '3px 6px' : printDensity === 'compact' ? '6px 10px' : '10px 14px';
  const sectionMargin = printDensity === 'extra-compact' ? '0.75rem' : printDensity === 'compact' ? '1.25rem' : '2rem';
  const rolls = pof.fabric_rolls || [];
  const isTwoColumn = printLayout === 'two-column' && rolls.length > 1;
  const half = Math.ceil(rolls.length / 2);
  const col1 = isTwoColumn ? rolls.slice(0, half) : rolls;
  const col2 = isTwoColumn ? rolls.slice(half) : [];

  const orderNo = order?.order_number || pof.fabric_rolls?.[0]?.order_number || pof.order_number || 'N/A';
  const designNo = order?.design_no || pof.fabric_rolls?.[0]?.design_no || pof.design_no || '—';
  const designName = order?.design_name || pof.fabric_rolls?.[0]?.design_name || pof.design_name || '';

  const processes = Array.isArray(pof.processes) 
    ? pof.processes 
    : typeof pof.processes === 'string' 
    ? [pof.processes] 
    : [];

  const renderTableHeader = () => (
    <tr style={{ borderBottom: '2px solid #1e293b', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f8fafc', color: '#1e293b' }}>
      <th style={{ padding: cellPadding, width: '50px' }}>S.No</th>
      <th style={{ padding: cellPadding }}>Fabric Roll QR ID</th>
      <th style={{ padding: cellPadding, textAlign: 'right', width: '130px' }}>Inspected Qty (m)</th>
    </tr>
  );

  const renderTableRow = (roll, index) => (
    <tr key={roll.id || index} style={{ borderBottom: '1px solid #e2e8f0', color: '#334155' }}>
      <td style={{ padding: cellPadding }}>{index + 1}</td>
      <td style={{ padding: cellPadding, fontFamily: 'monospace', fontWeight: '600' }}>{roll.id}</td>
      <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: '700' }}>{Number(roll.actual_qty || roll.qty || 0).toFixed(2)} m</td>
    </tr>
  );

  return (
    <div className="print-modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '1.5rem'
    }}>
      {/* Main Modal Layout Container */}
      <div className="print-modal-layout-container" style={{
        display: 'flex', gap: '1.5rem', width: '100%', maxWidth: '1250px', height: '92vh',
        maxHeight: '850px', color: '#1e293b'
      }}>
        
        {/* Sidebar Control Panel (No Print) */}
        <div className="no-print" style={{
          width: '320px', backgroundColor: '#fff', borderRadius: '12px', padding: '1.5rem',
          display: 'flex', flexDirection: 'column', gap: '1.25rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
            <Printer size={20} style={{ color: '#800000' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>
              POF Print Options
            </h3>
          </div>

          {/* Layout Option */}
          <div>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem', color: '#64748b' }}>
              Rolls Layout
            </label>
            <select 
              value={printLayout} 
              onChange={(e) => setPrintLayout(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600', color: '#334155', backgroundColor: '#fff', outline: 'none' }}
            >
              <option value="two-column">Two-Column (Fits 30+ rolls)</option>
              <option value="single-column">Single Column (Standard)</option>
            </select>
          </div>

          {/* Spacing Option */}
          <div>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem', color: '#64748b' }}>
              Row Spacing
            </label>
            <select 
              value={printDensity} 
              onChange={(e) => setPrintDensity(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600', color: '#334155', backgroundColor: '#fff', outline: 'none' }}
            >
              <option value="extra-compact">Extra Compact</option>
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          {/* Font Size Option */}
          <div>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem', color: '#64748b' }}>
              Print Font Size
            </label>
            <select 
              value={printFontSize} 
              onChange={(e) => setPrintFontSize(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600', color: '#334155', backgroundColor: '#fff', outline: 'none' }}
            >
              <option value="small">Small (11px)</option>
              <option value="medium">Medium (13px)</option>
              <option value="large">Large (15px)</option>
            </select>
          </div>

          {/* Display Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
              <input type="checkbox" checked={printShowLogo} onChange={(e) => setPrintShowLogo(e.target.checked)} style={{ width: '15px', height: '15px' }} />
              Show Company Logo
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
              <input type="checkbox" checked={printShowQr} onChange={(e) => setPrintShowQr(e.target.checked)} style={{ width: '15px', height: '15px' }} />
              Show Order QR Code
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <button 
              onClick={() => window.print()} 
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', backgroundColor: '#800000', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
            >
              <Printer size={16} /> Print Order Form
            </button>
            <button 
              onClick={onClose}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '6px', cursor: 'pointer' }}
            >
              <X size={16} /> Close Modal
            </button>
          </div>
        </div>

        {/* Printable Preview Pane */}
        <div 
          className="print-container"
          style={{
            backgroundColor: '#fff', borderRadius: '12px', flex: 1,
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0'
          }}
        >
          {/* Top Bar for close/print inside preview panel (hidden on print) */}
          <div className="no-print" style={{
            padding: '0.75rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc',
            borderTopRightRadius: '12px'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
              Print Preview (A4 Page Size)
            </span>
            <span style={{ fontSize: '0.8rem', color: '#800000', fontWeight: '700', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '12px' }}>
              {(pof.fabric_rolls || []).length} Greige Rolls
            </span>
          </div>

          {/* Print Paper Content */}
          <div 
            className="print-paper"
            style={{ 
              padding: '2.5rem', 
              color: '#000', 
              backgroundColor: '#fff', 
              flex: 1,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: printFontSize === 'small' ? '11px' : printFontSize === 'medium' ? '13px' : '15px'
            }}
          >
            
            {/* Print Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: sectionMargin, 
              borderBottom: '3.5px double #800000', 
              paddingBottom: '1rem' 
            }}>
              {/* Left: Company Logo */}
              <div style={{ flex: '1', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                {printShowLogo && (
                  <img 
                    src="/logo.png" 
                    alt="Company Logo" 
                    style={{ maxHeight: '56px', objectFit: 'contain' }} 
                    onError={(e) => { e.target.style.display='none'; }} 
                  />
                )}
              </div>

              {/* Center: Centered Company Name and Header Title */}
              <div style={{ flex: '2', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '950', color: '#1e293b', letterSpacing: '0.5px', lineHeight: '1.1' }}>
                  ASHOK TEXTILES
                </h1>
                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#800000', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  PROCESSING ORDER FORM
                </span>
              </div>

              {/* Right: QR Code and POF Number stacked */}
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                {printShowQr && pofQrUrl && (
                  <img 
                    src={pofQrUrl} 
                    alt="POF QR Code" 
                    style={{ width: '60px', height: '60px', objectFit: 'contain', border: '1px solid #cbd5e1', padding: '2px', borderRadius: '4px' }} 
                  />
                )}
                <div style={{ 
                  fontSize: '0.75rem', 
                  fontWeight: '800', 
                  color: '#800000', 
                  border: '1.5px solid #800000', 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  textTransform: 'uppercase', 
                  fontFamily: 'monospace',
                  backgroundColor: '#fff'
                }}>
                  {pof.pof_number}
                </div>
              </div>
            </div>

            {/* Metadata Grid (Invoice-style structure) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              border: '1.5px solid #1e293b',
              borderRadius: '8px',
              marginBottom: sectionMargin,
              overflow: 'hidden',
              backgroundColor: '#fff'
            }}>
              <div style={{ padding: '0.6rem 0.8rem', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '800', display: 'block', marginBottom: '2px' }}>Processing Partner</span>
                <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>{pof.partner_name}</strong>
              </div>
              <div style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '800', display: 'block', marginBottom: '2px' }}>Expected Delivery Date</span>
                <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  {pof.expected_delivery_date ? new Date(pof.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                </strong>
              </div>
              <div style={{ padding: '0.6rem 0.8rem', borderRight: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '800', display: 'block', marginBottom: '2px' }}>Order & Design Details</span>
                <div style={{ fontSize: '0.8rem', color: '#1e293b', lineHeight: '1.4' }}>
                  Order No: <strong>{orderNo}</strong><br />
                  Design No: <strong>{designNo} {designName ? `(${designName})` : ''}</strong>
                </div>
              </div>
              <div style={{ padding: '0.6rem 0.8rem' }}>
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: '800', display: 'block', marginBottom: '2px' }}>Finished Width Specification</span>
                <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>{pof.width ? `${pof.width} inches` : '—'}</strong>
              </div>
            </div>

            {/* Processes Panel */}
            {processes.length > 0 && (
              <div style={{ marginBottom: sectionMargin }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Required Outsource Processes:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {processes.map((proc, index) => (
                    <span key={proc || index} style={{
                      border: '1.5px solid #cbd5e1',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      textTransform: 'uppercase'
                    }}>
                      {index + 1}. {proc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Table Header Section */}
            <h3 style={{ fontSize: '0.85rem', borderBottom: '1.5px solid #1e293b', paddingBottom: '0.25rem', margin: `0 0 ${sectionMargin} 0`, color: '#1e293b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Fabric Rolls Consignment Details ({(pof.fabric_rolls || []).length} rolls)
            </h3>

            {/* Rolls Table */}
            {isTwoColumn ? (
              <div style={{ display: 'flex', gap: '1.5rem', marginBottom: sectionMargin }}>
                <div style={{ flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'inherit' }}>
                    <thead>
                      {renderTableHeader()}
                    </thead>
                    <tbody>
                      {col1.map((roll, idx) => renderTableRow(roll, idx))}
                    </tbody>
                  </table>
                </div>
                <div style={{ flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'inherit' }}>
                    <thead>
                      {renderTableHeader()}
                    </thead>
                    <tbody>
                      {col2.map((roll, idx) => renderTableRow(roll, idx + half))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: sectionMargin, fontSize: 'inherit' }}>
                <thead>
                  {renderTableHeader()}
                </thead>
                <tbody>
                  {rolls.map((roll, idx) => renderTableRow(roll, idx))}
                </tbody>
              </table>
            )}

            {/* Summary Totals Block */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: sectionMargin,
              borderTop: '2px solid #1e293b',
              paddingTop: '0.5rem'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 120px', gap: '0.4rem 1rem', textAlign: 'right', fontSize: '0.85rem' }}>
                <div style={{ color: '#64748b', fontWeight: '700' }}>Total Rolls:</div>
                <div style={{ fontWeight: '700', color: '#1e293b' }}>{rolls.length} rolls</div>
                <div style={{ color: '#64748b', fontWeight: '700' }}>Grand Total Qty:</div>
                <div style={{ fontWeight: '800', color: '#800000', fontSize: '1rem' }}>
                  {rolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0).toFixed(2)} m
                </div>
              </div>
            </div>

            {/* Delivery and Vehicle info */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.5fr 1fr', 
              gap: '2rem', 
              borderTop: '1.5px solid #1e293b', 
              paddingTop: '1rem', 
              fontSize: '0.85rem',
              color: '#334155'
            }}>
              <div>
                <p style={{ margin: '0 0 0.4rem 0' }}><strong>Delivered By:</strong> {pof.delivered_by || 'Hand Delivery'}</p>
                <p style={{ margin: '0 0 0.4rem 0' }}><strong>Vehicle No:</strong> {pof.vehicle_details || 'N/A'}</p>
                <p style={{ margin: '0 0 0.4rem 0' }}><strong>Created By:</strong> {profile?.name || 'Administrator'}</p>
                
                {pof.status === 'received' && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.4rem 0' }}><strong>Received By:</strong> {pof.received_by}</p>
                    <p style={{ margin: '0 0 0.4rem 0' }}><strong>Return Vehicle No:</strong> {pof.receive_vehicle_details || 'Same/Hand Delivery'}</p>
                    <p style={{ margin: '0 0 0.4rem 0' }}><strong>Date Received:</strong> {pof.received_at ? new Date(pof.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</p>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', height: pof.status === 'received' ? '160px' : '90px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px dashed #475569', width: '180px', height: '40px' }} />
                  <div style={{ width: '180px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem', marginTop: '0.35rem', color: '#64748b' }}>
                    Authorized Dispatch Signature
                  </div>
                </div>
                {pof.status === 'received' && (
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <div style={{ borderBottom: '1px dashed #475569', width: '180px', height: '40px' }} />
                    <div style={{ width: '180px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.75rem', marginTop: '0.35rem', color: '#64748b' }}>
                      Authorized Receipt Signature
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Global print style controller */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-modal-overlay, .print-modal-overlay * {
            visibility: visible;
          }
          .print-modal-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            display: block !important;
            background: none !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .print-modal-layout-container {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            gap: 0 !important;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
