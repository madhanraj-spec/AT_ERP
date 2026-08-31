import React, { useState } from 'react';
import { Printer, X } from 'lucide-react';

export default function PrintablePOFRRModal({ pofrr, onClose }) {
  const [printDensity, setPrintDensity] = useState('compact');
  const [printLayout, setPrintLayout] = useState('two-column');
  const [printFontSize, setPrintFontSize] = useState('medium');

  if (!pofrr) return null;

  // Calculate density styles and list partitions
  const cellPadding = printDensity === 'extra-compact' ? '3px 6px' : printDensity === 'compact' ? '6px 10px' : '10px 14px';
  const sectionMargin = printDensity === 'extra-compact' ? '0.75rem' : printDensity === 'compact' ? '1.25rem' : '2rem';
  const rolls = pofrr.received_rolls || [];
  const isTwoColumn = printLayout === 'two-column' && rolls.length > 1;
  const half = Math.ceil(rolls.length / 2);
  const col1 = isTwoColumn ? rolls.slice(0, half) : rolls;
  const col2 = isTwoColumn ? rolls.slice(half) : [];

  const processes = Array.isArray(pofrr.processes)
    ? pofrr.processes
    : typeof pofrr.processes === 'string'
    ? [pofrr.processes]
    : [];

  const renderTableHeader = () => (
    <tr style={{ borderBottom: '2px solid #000', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f2f2f2' }}>
      <th style={{ padding: cellPadding, width: '45px', textAlign: 'center' }}>S.No</th>
      <th style={{ padding: cellPadding, whiteSpace: 'nowrap' }}>Fabric Received ID</th>
      <th style={{ padding: cellPadding, textAlign: 'right', whiteSpace: 'nowrap', width: '135px' }}>Received Qty (m)</th>
    </tr>
  );

  const renderTableRow = (roll, index) => {
    const recdQty = parseFloat(roll.qty || 0);
    return (
      <tr key={roll.id || index} style={{ borderBottom: '1px solid #ccc' }}>
        <td style={{ padding: cellPadding, textAlign: 'center' }}>{index + 1}</td>
        <td style={{ padding: cellPadding, fontFamily: 'monospace', fontWeight: 'bold', whiteSpace: 'nowrap', fontSize: '0.82em' }}>{roll.id}</td>
        <td style={{ padding: cellPadding, textAlign: 'right', fontWeight: 'bold', color: '#047857', whiteSpace: 'nowrap', fontSize: '0.88em' }}>{recdQty.toFixed(2)} m</td>
      </tr>
    );
  };

  const sentQty = pofrr.fabric_rolls?.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0) || 0;
  const recdQty = pofrr.received_rolls?.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0) || 0;
  const lossQty = (sentQty - recdQty).toFixed(2);
  const shrinkagePct = sentQty > 0 ? (((sentQty - recdQty) / sentQty) * 100).toFixed(2) : '0.00';

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
              POFRR Print Options
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
              Font Size
            </label>
            <select 
              value={printFontSize} 
              onChange={(e) => setPrintFontSize(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600', color: '#334155', backgroundColor: '#fff', outline: 'none' }}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
            <button 
              onClick={() => window.print()} 
              className="btn btn-primary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', backgroundColor: '#800000', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
            >
              <Printer size={16} /> Print POFRR
            </button>
            <button 
              onClick={onClose}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', backgroundColor: '#fff', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: '6px', cursor: 'pointer' }}
            >
              <X size={16} /> Close Modal
            </button>
          </div>
        </div>

        {/* Main Print Container */}
        <div 
          className="print-container"
          style={{
            backgroundColor: '#fff', borderRadius: '12px', flex: 1,
            display: 'flex', flexDirection: 'column', overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0',
            maxHeight: '100%'
          }}
        >
          {/* Modal Actions (No Print) */}
          <div className="no-print" style={{
            padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb',
            borderTopLeftRadius: '12px', borderTopRightRadius: '12px'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: '800' }}>
              Print Processing Order Fabric Receipt Register (POFRR)
            </h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => window.print()} 
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem', backgroundColor: '#800000', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}
              >
                <Printer size={16} /> Print POFRR
              </button>
              <button 
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Print Body */}
          <div style={{
            padding: '3.5rem',
            color: '#000',
            backgroundColor: '#fff',
            flex: 1,
            fontSize: printFontSize === 'small' ? '0.785rem' : printFontSize === 'medium' ? '0.875rem' : '1rem'
          }}>
            
            {/* Print Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sectionMargin, borderBottom: '2.5px solid #000', paddingBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <img
                  src="/logo.png"
                  alt="Ashok Textiles"
                  style={{ maxHeight: '60px', objectFit: 'contain' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div>
                  <div style={{ fontSize: '1.9rem', fontWeight: '950', letterSpacing: '1px', margin: 0, color: '#000', lineHeight: '1.1' }}>ASHOK TEXTILES</div>
                  <div style={{ fontSize: '0.72rem', color: '#334155', fontWeight: '600', marginTop: '3px', lineHeight: '1.3' }}>
                    6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33<br />
                    GSTIN: 33AAZFA60686D1Z6
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>FABRIC RECEIPT REGISTER</h2>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>POFRR</div>
              </div>
            </div>

            {/* POFRR Metadata info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginBottom: sectionMargin, fontSize: 'inherit', lineHeight: '1.6' }}>
              <div>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>POFRR Number:</strong> <span style={{ fontFamily: 'monospace', fontSize: '1.05em', fontWeight: 'bold' }}>{pofrr.pofrr_number}</span></p>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>POF Reference:</strong> <span style={{ fontFamily: 'monospace', fontSize: '1em' }}>{pofrr.pof_number}</span></p>
                {pofrr.processing_dc_no && (
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Processing DC Number:</strong> <span style={{ fontFamily: 'monospace', fontSize: '1em', fontWeight: 'bold', color: '#800000' }}>{pofrr.processing_dc_no}</span></p>
                )}
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>Processing Partner:</strong> {pofrr.partner_name}</p>
                {processes.length > 0 && (
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Process:</strong> <span style={{ fontWeight: 'bold', color: '#b45309' }}>{processes.join(', ')}</span></p>
                )}
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>Finished Width:</strong> {pofrr.width ? `${pofrr.width} inches` : '—'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>Date Sent:</strong> {pofrr.created_at ? new Date(pofrr.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</p>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>Date Received:</strong> {pofrr.received_at ? new Date(pofrr.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</p>
                <p style={{ margin: '0 0 0.35rem 0' }}><strong>Expected Return Date:</strong> {pofrr.expected_delivery_date ? new Date(pofrr.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</p>
              </div>
            </div>

            {/* Summary Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', border: '1.5px solid #000', padding: '1rem', borderRadius: '6px', marginBottom: sectionMargin, backgroundColor: '#f9f9f9', fontSize: 'inherit' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.8em', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Sent Qty</span>
                <strong style={{ fontSize: '1.25em' }}>
                  {sentQty.toFixed(2)} m
                </strong>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid #ccc' }}>
                <span style={{ fontSize: '0.8em', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Received Qty</span>
                <strong style={{ fontSize: '1.25em', color: '#047857' }}>
                  {recdQty.toFixed(2)} m
                </strong>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid #ccc' }}>
                <span style={{ fontSize: '0.8em', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Difference (Loss)</span>
                <strong style={{ fontSize: '1.25em', color: '#b91c1c' }}>
                  {lossQty} m
                </strong>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid #ccc' }}>
                <span style={{ fontSize: '0.8em', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Overall Shrinkage</span>
                <strong style={{ fontSize: '1.25em', color: '#b45309' }}>
                  {shrinkagePct}%
                </strong>
              </div>
            </div>

            {/* Comparison Table */}
            <h3 style={{ fontSize: '1.15em', borderBottom: '1.5px solid #000', paddingBottom: '0.35rem', margin: '0 0 1rem 0', fontWeight: 'bold' }}>
              Rolls Reconciliation Details
            </h3>

            {isTwoColumn ? (
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: sectionMargin, fontSize: 'inherit' }}>
                    <thead>
                      {renderTableHeader()}
                    </thead>
                    <tbody>
                      {col1.map((roll, idx) => renderTableRow(roll, idx))}
                    </tbody>
                  </table>
                </div>
                <div style={{ flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: sectionMargin, fontSize: 'inherit' }}>
                    <thead>
                      {renderTableHeader()}
                    </thead>
                    <tbody>
                      {col2.map((roll, idx) => renderTableRow(roll, half + idx))}
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
                  {col1.map((roll, idx) => renderTableRow(roll, idx))}
                </tbody>
              </table>
            )}

            {/* Delivery and Vehicle info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', borderTop: '2px solid #000', paddingTop: '1.5rem', fontSize: 'inherit', color: '#000' }}>
              <div>
                <p style={{ margin: '0 0 0.5rem 0' }}><strong>Received By:</strong> {pofrr.received_by || 'N/A'}</p>
                <p style={{ margin: '0 0 0.5rem 0' }}><strong>Received Place:</strong> {pofrr.received_place || 'N/A'}</p>
                <p style={{ margin: '0 0 0.5rem 0' }}><strong>Return Vehicle No:</strong> {pofrr.receive_vehicle_details || 'Hand Delivery'}</p>
                <p style={{ margin: '0 0 0.5rem 0' }}><strong>Status:</strong> {pofrr.status === 'received' ? 'Fully Received' : 'Partially Received'}</p>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px' }}>
                <div>
                  <div style={{ borderBottom: '1px dashed #000', width: '180px', height: '40px' }} />
                  <div style={{ width: '180px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85em', marginTop: '0.25rem' }}>
                    Receiver Signature
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

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
