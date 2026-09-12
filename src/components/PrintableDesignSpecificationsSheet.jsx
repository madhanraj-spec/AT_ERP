import React from 'react';
import {
  computeWarpDesignResults,
  computeWeftDesignResults,
  getCrimpAndWastage
} from '../utils/yarnCalculations';

export default function PrintableDesignSpecificationsSheet({
  order,
  yarnCounts = [],
  formatCountFn,
  crimpOverrides = null
}) {
  if (!order) return null;

  const techSpecs = order.technical_specs || {};
  const dd = techSpecs.design_details || { warp_designs: [], weft_design: { sequence: [] } };
  const loomReed = parseFloat(techSpecs.on_loom_reed) || parseFloat(techSpecs.order_reed) || 0;
  const loomPick = parseFloat(techSpecs.on_loom_pick) || parseFloat(techSpecs.order_pick) || 0;
  const currentCrimp = crimpOverrides || dd.crimp_overrides || getCrimpAndWastage(
    techSpecs.weave_type,
    loomReed,
    loomPick,
    techSpecs.loom_type || 'Airjet'
  );

  const warpResults = computeWarpDesignResults(techSpecs, yarnCounts, currentCrimp);
  const weftResult = computeWeftDesignResults(techSpecs, yarnCounts, currentCrimp);

  const formatCount = (id) => {
    if (formatCountFn) return formatCountFn(id);
    const yc = yarnCounts.find(y => y.id === id);
    if (!yc) return '—';
    return [yc.count_value, yc.spec, yc.spec1].filter(Boolean).join(' ');
  };

  return (
    <div
      className="a4-confirmation-sheet a4-design-sheet printable-design-sheet"
      style={{
        backgroundColor: 'white',
        color: '#0f172a',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        minHeight: '265mm',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        padding: '0 0.25rem'
      }}
    >
      {/* ── TOP SECTION ── */}
      <div>
        {/* 1. ASHOK TEXTILES HEADER */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2.5px solid #800000',
            paddingBottom: '0.65rem',
            marginBottom: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <img
              src="/logo.png"
              alt="Ashok Textiles"
              style={{ maxHeight: '50px', maxWidth: '140px', objectFit: 'contain' }}
              onError={e => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div
              style={{
                display: 'none',
                width: '44px',
                height: '44px',
                backgroundColor: '#800000',
                borderRadius: '6px',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '900',
                fontSize: '1.15rem'
              }}
            >
              AT
            </div>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#800000', letterSpacing: '-0.3px', lineHeight: '1.1' }}>
                ASHOK TEXTILES
              </div>
              <div style={{ fontSize: '0.76rem', color: '#475569', lineHeight: '1.3', marginTop: '1px' }}>
                6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33
              </div>
              <div style={{ fontSize: '0.76rem', fontWeight: '700', color: '#0f172a' }}>
                GSTIN: 33AAZFA60686D1Z6
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: '900', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: '1.1' }}>
                WEAVING DESIGN SPECIFICATION
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: '800',
                  color: '#800000',
                  backgroundColor: '#fee2e2',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  border: '1px solid #fecaca',
                  whiteSpace: 'nowrap'
                }}
              >
                PAGE 2 OF 2
              </span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: '800', fontFamily: 'monospace', color: '#0f172a', marginTop: '2px' }}>
              {order.order_number || 'DRAFT'}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
              Design: <strong style={{ color: '#0f172a' }}>{order.design_no || '—'} {order.design_name ? `(${order.design_name})` : ''}</strong> | Date: <strong style={{ color: '#0f172a' }}>{order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
            </div>
          </div>
        </div>

        {/* 2. DESIGN SPECIFICATIONS SUMMARY TABLE */}
        <div
          style={{
            border: '1.5px solid #94a3b8',
            borderRadius: '5px',
            overflow: 'hidden',
            marginBottom: '0.85rem',
            backgroundColor: '#ffffff'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <tbody>
              <tr>
                <td style={{ padding: '5px 8px', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', width: '14%' }}>
                  Weave & Loom
                </td>
                <td style={{ padding: '5px 8px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', width: '36%', fontWeight: '700', color: '#0f172a' }}>
                  {techSpecs.weave_type || 'Plain'} • <span style={{ color: '#800000' }}>{techSpecs.loom_type || 'Airjet'}</span>
                </td>
                <td style={{ padding: '5px 8px', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', width: '15%' }}>
                  Loom Reed & Pick
                </td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid #cbd5e1', width: '35%', fontWeight: '700', color: '#0f172a' }}>
                  {techSpecs.order_reed || '—'} Reed × {techSpecs.order_pick || '—'} Pick
                  {(techSpecs.on_loom_reed || techSpecs.on_loom_pick) && (
                    <span style={{ fontWeight: 'normal', color: '#64748b', fontSize: '0.72rem', marginLeft: '4px' }}>
                      (Loom: {techSpecs.on_loom_reed || techSpecs.order_reed} / {techSpecs.on_loom_pick || techSpecs.order_pick})
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '5px 8px', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                  Loom Width
                </td>
                <td style={{ padding: '5px 8px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#0f172a' }}>
                  <span style={{ fontSize: '0.84rem', color: '#0369a1' }}>{techSpecs.order_width || '—'}"</span>
                  {techSpecs.finished_width && (
                    <span style={{ fontWeight: 'normal', color: '#64748b', fontSize: '0.72rem', marginLeft: '6px' }}>
                      (Finished Width: {techSpecs.finished_width}")
                    </span>
                  )}
                </td>
                <td style={{ padding: '5px 8px', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                  Production Qty
                </td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#800000' }}>
                  {techSpecs.production_quantity ? `${Number(techSpecs.production_quantity).toLocaleString()} Mtrs` : `${Number(order.total_quantity || 0).toLocaleString()} Mtrs`}
                  {techSpecs.production_quantity && order.total_quantity && (
                    <span style={{ fontWeight: 'normal', color: '#64748b', fontSize: '0.72rem', marginLeft: '6px' }}>
                      (Order: {Number(order.total_quantity).toLocaleString()} Mtrs)
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '5px 8px', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155', borderRight: '1px solid #cbd5e1' }}>
                  Crimp & Wastage
                </td>
                <td colSpan="3" style={{ padding: '5px 8px', fontSize: '0.76rem', color: '#334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span style={{ fontWeight: '600', color: '#0369a1' }}>Warp: </span>
                      Crimp <strong>{(currentCrimp.warpCrimp * 100).toFixed(1)}%</strong> • Wastage <strong>{(currentCrimp.warpWastage * 100).toFixed(1)}%</strong>
                      <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                      <span style={{ fontWeight: '600', color: '#92400e' }}>Weft: </span>
                      Crimp <strong>{(currentCrimp.weftCrimp * 100).toFixed(1)}%</strong> • Wastage <strong>{(currentCrimp.weftWastage * 100).toFixed(1)}%</strong>
                    </div>
                    <div>
                      Order Category: <strong style={{ color: '#800000', textTransform: 'uppercase' }}>{techSpecs.order_category || order.order_type || 'Conventional'}</strong>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 3. WARP WEAVING PATTERN REPEATS */}
        {warpResults.map((wr, wi) => {
          const numWarps = warpResults.length;
          const flatEntries = wr.colorResults || [];
          const totalWarpEnds = wr.totalEnds || 0;
          const patternEnds = Math.round(wr.endsInOneRepeat * wr.repeats);

          return (
            <div key={`warp-print-${wi}`} style={{ marginBottom: '0.85rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #94a3b8',
                  borderBottom: 'none',
                  padding: '5px 8px',
                  borderRadius: '4px 4px 0 0'
                }}
              >
                <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {numWarps > 1 ? `Warp ${wi + 1} — Details & Weaving Pattern` : 'Warp Details & Weaving Pattern'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#334155', fontWeight: '600', display: 'flex', gap: '0.85rem' }}>
                  <span>Ends / Rep: <strong style={{ color: '#0f172a' }}>{wr.endsInOneRepeat}</strong></span>
                  <span>Repeats: <strong style={{ color: '#0f172a' }}>{wr.repeats}</strong></span>
                  <span>Extra Ends: <strong style={{ color: '#0f172a' }}>{wr.extraThreads || 0}</strong></span>
                  <span>Total Ends: <strong style={{ color: '#0369a1' }}>{totalWarpEnds}</strong></span>
                  <span>Loom Width: <strong style={{ color: '#059669' }}>{wr.calculatedWidth}"</strong></span>
                </div>
              </div>

              {/* Repeat Sequence Table: # | Count | Colour | Ends / Rep | Total Ends */}
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', color: '#334155' }}>
                    <th style={{ padding: '4.5px 6px', textAlign: 'center', border: '1px solid #94a3b8', width: '5%' }}>#</th>
                    <th style={{ padding: '4.5px 6px', textAlign: 'left', border: '1px solid #94a3b8', width: '38%' }}>Count</th>
                    <th style={{ padding: '4.5px 6px', textAlign: 'left', border: '1px solid #94a3b8', width: '25%' }}>Colour</th>
                    <th style={{ padding: '4.5px 6px', textAlign: 'right', border: '1px solid #94a3b8', width: '16%' }}>Ends / Rep</th>
                    <th style={{ padding: '4.5px 6px', textAlign: 'right', border: '1px solid #94a3b8', width: '16%' }}>Total Ends</th>
                  </tr>
                </thead>
                <tbody>
                  {wr.sequence.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '6px', textAlign: 'center', color: '#64748b', border: '1px solid #94a3b8' }}>
                        No warp design repeat pattern entered.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      let stepNum = 1;
                      const rows = [];

                      wr.sequence.forEach((item, itemIdx) => {
                        if (item.type === 'chain') {
                          const subRepeats = parseFloat(item.subRepeats) || 1;
                          (item.entries || []).forEach((entry, entryIdx) => {
                            const endsForEntryInRep = (parseFloat(entry.ends) || 0) * subRepeats;
                            const totalEndsForEntry = Math.round((endsForEntryInRep * wr.repeats) + (wr.extraThreads > 0 && wr.endsInOneRepeat > 0 ? (wr.extraThreads * (endsForEntryInRep / wr.endsInOneRepeat)) : 0));

                            rows.push(
                              <tr key={`chain-${itemIdx}-${entryIdx}`} style={{ backgroundColor: entryIdx % 2 === 0 ? '#fafafa' : 'white' }}>
                                <td style={{ padding: '4px 6px', border: '1px solid #94a3b8', textAlign: 'center', color: '#64748b' }}>
                                  {entryIdx === 0 ? stepNum++ : ''}
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #94a3b8', fontWeight: '600' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{formatCount(entry.countId)}</span>
                                    {entryIdx === 0 && (
                                      <span style={{ fontSize: '0.68rem', backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #e9d5ff', padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>
                                        Chain × {subRepeats}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #94a3b8', fontWeight: '700' }}>
                                  {entry.color}
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #94a3b8', textAlign: 'right' }}>
                                  {entry.ends} {subRepeats > 1 ? `(×${subRepeats} = ${endsForEntryInRep})` : ''}
                                </td>
                                <td style={{ padding: '4px 6px', border: '1px solid #94a3b8', textAlign: 'right', fontWeight: '700', color: '#0369a1' }}>
                                  {totalEndsForEntry}
                                </td>
                              </tr>
                            );
                          });
                        } else {
                          const endsInRep = parseFloat(item.ends) || 0;
                          const totalEndsItem = Math.round((endsInRep * wr.repeats) + (wr.extraThreads > 0 && wr.endsInOneRepeat > 0 ? (wr.extraThreads * (endsInRep / wr.endsInOneRepeat)) : 0));

                          rows.push(
                            <tr key={`single-${itemIdx}`}>
                              <td style={{ padding: '4px 6px', border: '1px solid #94a3b8', textAlign: 'center', color: '#64748b' }}>
                                {stepNum++}
                              </td>
                              <td style={{ padding: '4px 6px', border: '1px solid #94a3b8', fontWeight: '600' }}>
                                {formatCount(item.countId)}
                              </td>
                              <td style={{ padding: '4px 6px', border: '1px solid #94a3b8', fontWeight: '700' }}>
                                {item.color}
                              </td>
                              <td style={{ padding: '4px 6px', border: '1px solid #94a3b8', textAlign: 'right' }}>
                                {item.ends}
                              </td>
                              <td style={{ padding: '4px 6px', border: '1px solid #94a3b8', textAlign: 'right', fontWeight: '700', color: '#0369a1' }}>
                                {totalEndsItem}
                              </td>
                            </tr>
                          );
                        }
                      });
                      return rows;
                    })()
                  )}
                  {/* 3 Clear Lines: TOTAL, EXTRA THREADS, TOTAL THREADS in Table Footer */}
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: '700', borderTop: '2px solid #94a3b8' }}>
                    <td colSpan="3" style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right', color: '#1e293b' }}>
                      TOTAL:
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontWeight: '700' }}>
                      {wr.endsInOneRepeat}
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                      {wr.endsInOneRepeat} × {wr.repeats} = {patternEnds.toLocaleString()}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: '#fffbeb', fontWeight: '700' }}>
                    <td colSpan="3" style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right', color: '#92400e' }}>
                      EXTRA THREADS:
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right', color: '#94a3b8' }}>
                      —
                    </td>
                    <td style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontWeight: '800', color: '#b45309' }}>
                      + {wr.extraThreads || 0}
                    </td>
                  </tr>
                  <tr style={{ backgroundColor: '#f0f9ff', fontWeight: '800', borderTop: '2px solid #0284c7' }}>
                    <td colSpan="3" style={{ padding: '6px 8px', border: '1px solid #94a3b8', textAlign: 'right', color: '#0369a1', fontSize: '0.82rem', letterSpacing: '0.03em' }}>
                      TOTAL THREADS:
                    </td>
                    <td style={{ padding: '6px 8px', border: '1px solid #94a3b8', textAlign: 'right', color: '#0369a1' }}>
                      —
                    </td>
                    <td style={{ padding: '6px 8px', border: '1px solid #94a3b8', textAlign: 'right', color: '#0369a1', fontWeight: '900', fontSize: '0.88rem' }}>
                      {totalWarpEnds.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Warp Calculation Formula: 3 Clean Lines for High Readability */}
              <div style={{
                marginTop: '5px',
                backgroundColor: '#f8fafc',
                border: '1.5px solid #0284c7',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '0.78rem'
              }}>
                {/* Line 1: TOTAL */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                  <span style={{ color: '#334155' }}>
                    <strong style={{ color: '#0f172a', textTransform: 'uppercase', minWidth: '130px', display: 'inline-block' }}>TOTAL:</strong>
                    <span>{wr.endsInOneRepeat} Ends/Rep × {wr.repeats} Repeats</span>
                  </span>
                  <strong style={{ color: '#0f172a', fontSize: '0.82rem' }}>= {patternEnds.toLocaleString()} Pattern Ends</strong>
                </div>

                {/* Line 2: EXTRA THREADS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderTop: '1px dashed #cbd5e1' }}>
                  <span style={{ color: '#92400e' }}>
                    <strong style={{ color: '#92400e', textTransform: 'uppercase', minWidth: '130px', display: 'inline-block' }}>EXTRA THREADS:</strong>
                    <span>Selvedge, Leno & Border</span>
                  </span>
                  <strong style={{ color: '#b45309', fontSize: '0.82rem' }}>+ {wr.extraThreads || 0} Extra Ends</strong>
                </div>

                {/* Line 3: TOTAL THREADS */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0 2px 0',
                  borderTop: '1.5px solid #0284c7',
                  marginTop: '2px'
                }}>
                  <span style={{ fontWeight: '900', color: '#0369a1', textTransform: 'uppercase', minWidth: '130px', display: 'inline-block' }}>
                    TOTAL THREADS:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ backgroundColor: '#e0f2fe', border: '1px solid #bae6fd', padding: '2px 10px', borderRadius: '4px', fontWeight: '900', color: '#0369a1', fontSize: '0.86rem' }}>
                      {totalWarpEnds.toLocaleString()} Total Warp Ends
                    </span>
                    <span style={{ fontWeight: '700', color: '#059669', fontSize: '0.78rem' }}>
                      Calc. Loom Width: <strong style={{ color: '#059669' }}>{wr.calculatedWidth}"</strong> {loomReed > 0 ? `(${totalWarpEnds} / ${loomReed} Loom Reed)` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Color Wise Summary for this warp */}
              {flatEntries.length > 0 && (
                <div style={{ marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.74rem', color: '#334155' }}>
                  <span style={{ fontWeight: '700', color: '#0369a1' }}>Warp Color Breakdown:</span>
                  {flatEntries.map((cr, ci) => (
                    <span key={ci} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '3px', padding: '2px 6px' }}>
                      <strong>{cr.color}</strong>: {cr.totalEnds} ends
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* 4. WEFT WEAVING PATTERN REPEATS */}
        <div style={{ marginBottom: '0.85rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#fef3c7',
              border: '1px solid #d97706',
              borderBottom: 'none',
              padding: '5px 8px',
              borderRadius: '4px 4px 0 0'
            }}
          >
            <div style={{ fontSize: '0.84rem', fontWeight: '800', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Weft Details & Weaving Pattern
            </div>
            <div style={{ fontSize: '0.76rem', color: '#78350f', fontWeight: '600', display: 'flex', gap: '1rem' }}>
              <span>Picks / Rep: <strong style={{ color: '#0f172a' }}>{weftResult.totalPicksPerRepeat || 0}</strong></span>
              <span>Loom Pick (PPI): <strong style={{ color: '#0f172a' }}>{loomPick || '—'}</strong></span>
              <span>Loom Width: <strong style={{ color: '#0f172a' }}>{techSpecs.order_width || '—'}"</strong></span>
            </div>
          </div>

          {/* Repeat Sequence Table: # | Count | Colour | Picks / Rep | Eff. PPI */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d97706', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#fffbeb', color: '#78350f' }}>
                <th style={{ padding: '4.5px 6px', textAlign: 'center', border: '1px solid #d97706', width: '5%' }}>#</th>
                <th style={{ padding: '4.5px 6px', textAlign: 'left', border: '1px solid #d97706', width: '38%' }}>Count</th>
                <th style={{ padding: '4.5px 6px', textAlign: 'left', border: '1px solid #d97706', width: '25%' }}>Colour</th>
                <th style={{ padding: '4.5px 6px', textAlign: 'right', border: '1px solid #d97706', width: '16%' }}>Picks / Rep</th>
                <th style={{ padding: '4.5px 6px', textAlign: 'right', border: '1px solid #d97706', width: '16%' }}>Eff. PPI</th>
              </tr>
            </thead>
            <tbody>
              {weftResult.sequence.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '6px', textAlign: 'center', color: '#64748b', border: '1px solid #d97706' }}>
                    No weft design repeat pattern entered.
                  </td>
                </tr>
              ) : (
                (() => {
                  let stepNum = 1;
                  const rows = [];
                  const loomPickVal = loomPick;

                  weftResult.sequence.forEach((item, itemIdx) => {
                    if (item.type === 'chain') {
                      const subRepeats = parseFloat(item.subRepeats) || 1;
                      (item.entries || []).forEach((entry, entryIdx) => {
                        const picksForEntryInRep = (parseFloat(entry.picks) || 0) * subRepeats;
                        const effPPI = Math.round(weftResult.totalPicksPerRepeat > 0 ? (picksForEntryInRep / weftResult.totalPicksPerRepeat) * loomPickVal : 0);

                        rows.push(
                          <tr key={`weft-chain-${itemIdx}-${entryIdx}`} style={{ backgroundColor: entryIdx % 2 === 0 ? '#fffdf7' : 'white' }}>
                            <td style={{ padding: '4px 6px', border: '1px solid #d97706', textAlign: 'center', color: '#64748b' }}>
                              {entryIdx === 0 ? stepNum++ : ''}
                            </td>
                            <td style={{ padding: '4px 6px', border: '1px solid #d97706', fontWeight: '600' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{formatCount(entry.countId)}</span>
                                {entryIdx === 0 && (
                                  <span style={{ fontSize: '0.68rem', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>
                                    Chain × {subRepeats}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '4px 6px', border: '1px solid #d97706', fontWeight: '700' }}>
                              {entry.color}
                            </td>
                            <td style={{ padding: '4px 6px', border: '1px solid #d97706', textAlign: 'right' }}>
                              {entry.picks} {subRepeats > 1 ? `(×${subRepeats} = ${picksForEntryInRep})` : ''}
                            </td>
                            <td style={{ padding: '4px 6px', border: '1px solid #d97706', textAlign: 'right', fontWeight: '700', color: '#92400e' }}>
                              {effPPI}
                            </td>
                          </tr>
                        );
                      });
                    } else {
                      const picksInRep = parseFloat(item.picks) || 0;
                      const effPPI = Math.round(weftResult.totalPicksPerRepeat > 0 ? (picksInRep / weftResult.totalPicksPerRepeat) * loomPickVal : 0);

                      rows.push(
                        <tr key={`weft-single-${itemIdx}`}>
                          <td style={{ padding: '4px 6px', border: '1px solid #d97706', textAlign: 'center', color: '#64748b' }}>
                            {stepNum++}
                          </td>
                          <td style={{ padding: '4px 6px', border: '1px solid #d97706', fontWeight: '600' }}>
                            {formatCount(item.countId)}
                          </td>
                          <td style={{ padding: '4px 6px', border: '1px solid #d97706', fontWeight: '700' }}>
                            {item.color}
                          </td>
                          <td style={{ padding: '4px 6px', border: '1px solid #d97706', textAlign: 'right' }}>
                            {item.picks}
                          </td>
                          <td style={{ padding: '4px 6px', border: '1px solid #d97706', textAlign: 'right', fontWeight: '700', color: '#92400e' }}>
                            {effPPI}
                          </td>
                        </tr>
                      );
                    }
                  });
                  return rows;
                })()
              )}
              {/* Weft Subtotal */}
              <tr style={{ backgroundColor: '#fffbeb', fontWeight: '800' }}>
                <td colSpan="3" style={{ padding: '4.5px 6px', border: '1px solid #d97706', textAlign: 'right' }}>
                  Total Weft Picks / PPI:
                </td>
                <td style={{ padding: '4.5px 6px', border: '1px solid #d97706', textAlign: 'right' }}>
                  {weftResult.totalPicksPerRepeat || 0}
                </td>
                <td style={{ padding: '4.5px 6px', border: '1px solid #d97706', textAlign: 'right', color: '#92400e' }}>
                  {loomPick || '—'} PPI
                </td>
              </tr>
            </tbody>
          </table>

          {/* Weft Calculation Formula Strip */}
          <div style={{
            marginTop: '4px',
            backgroundColor: '#fffbeb',
            border: '1.5px solid #d97706',
            borderRadius: '4px',
            padding: '6px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px',
            fontSize: '0.78rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '800', color: '#92400e', textTransform: 'uppercase' }}>Weft Calculation:</span>
              <span>
                Total Picks in 1 Repeat: <strong>{weftResult.totalPicksPerRepeat || 0} Picks</strong>
              </span>
              <span style={{ color: '#b45309' }}>•</span>
              <span>
                On-Loom Pick: <strong>{loomPick || '—'} PPI</strong>
              </span>
              <span style={{ color: '#b45309' }}>•</span>
              <span>
                Eff. PPI Formula: <strong>(Picks / {weftResult.totalPicksPerRepeat || 1}) × {loomPick || 0}</strong>
              </span>
              <span style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontWeight: '900', color: '#92400e', fontSize: '0.84rem' }}>
                Total Eff. PPI: {loomPick || '—'} PPI
              </span>
            </div>
            <div style={{ fontWeight: '700', color: '#78350f' }}>
              Loom Width: <strong style={{ color: '#0f172a' }}>{techSpecs.order_width || '—'}"</strong>
            </div>
          </div>

          {/* Color Wise Summary for Weft */}
          {(weftResult.colorResults || []).length > 0 && (
            <div style={{ marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.74rem', color: '#334155' }}>
              <span style={{ fontWeight: '700', color: '#92400e' }}>Weft Color Breakdown:</span>
              {weftResult.colorResults.map((cr, ci) => (
                <span key={ci} style={{ backgroundColor: '#fffdf7', border: '1px solid #fde68a', borderRadius: '3px', padding: '2px 6px' }}>
                  <strong>{cr.color}</strong>: {cr.effectivePPI} PPI
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER & SIGNATURES ── */}
      <div>
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '0.75rem',
            borderTop: '1.5px solid #94a3b8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingBottom: '0.2rem'
          }}
        >
          <div style={{ textAlign: 'center', width: '160px' }}>
            <div style={{ borderBottom: '1.5px solid #0f172a', height: '36px', marginBottom: '4px' }}></div>
            <div style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a' }}>
              Prepared By
            </div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '1px' }}>
              {order.merchandiser_name || 'Merchandiser'}
            </div>
          </div>

          <div style={{ textAlign: 'center', width: '160px' }}>
            <div style={{ borderBottom: '1.5px solid #0f172a', height: '36px', marginBottom: '4px' }}></div>
            <div style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a' }}>
              Weaving Master
            </div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '1px' }}>
              Loom Shed / Unit
            </div>
          </div>

          <div style={{ textAlign: 'center', width: '160px' }}>
            <div style={{ borderBottom: '1.5px solid #0f172a', height: '36px', marginBottom: '4px' }}></div>
            <div style={{ fontSize: '0.78rem', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a' }}>
              Authorized Signatory
            </div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '1px' }}>
              Ashok Textiles
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.66rem', color: '#94a3b8', marginTop: '4px' }}>
          Ashok Textiles ERP • System Generated Weaving Pattern Specification • Page 2 of 2 • {new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
