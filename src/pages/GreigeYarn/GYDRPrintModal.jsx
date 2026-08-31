import React, { useState, useEffect } from 'react';
import { X, Printer, Loader, Truck, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EwayBillModal from '../../components/EwayBillModal';
import EwayBillPrintModal from '../../components/EwayBillPrintModal';

export default function GYDRPrintModal({ 
  receipt, 
  data,
  dof, 
  orders, 
  onClose,
  yarnCounts = []
}) {
  const actualReceipt = receipt || data?.receipt || data;
  if (!actualReceipt) return null;

  const [items, setItems] = useState(data?.items || actualReceipt?.items || []);
  const [dofData, setDofData] = useState(dof || data?.dof || actualReceipt?.dof || null);
  const [ordersData, setOrdersData] = useState(orders || data?.orders || []);
  const [loading, setLoading] = useState(!data?.items && !actualReceipt?.items);
  const [localReceipt, setLocalReceipt] = useState(actualReceipt);
  const [showEwayModal, setShowEwayModal] = useState(false);
  const [showEwayPrint, setShowEwayPrint] = useState(false);
  const [partnerDetails, setPartnerDetails] = useState(null);

  useEffect(() => {
    setLocalReceipt(actualReceipt);
  }, [actualReceipt]);

  useEffect(() => {
    const partnerId = dofData?.dyeing_unit_id || localReceipt?.dyeing_unit_id || localReceipt?.partner_id;
    if (partnerId) {
      const fetchPartner = async () => {
        const { data: pData } = await supabase
          .from('master_partners')
          .select('*')
          .eq('id', partnerId)
          .maybeSingle();
        if (pData) {
          setPartnerDetails(pData);
        }
      };
      fetchPartner();
    } else {
      setPartnerDetails(null);
    }
  }, [dofData, localReceipt]);

  useEffect(() => {
    if (actualReceipt?.id || actualReceipt?.gydr_number) {
      fetchDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualReceipt?.id, actualReceipt?.gydr_number]);

  const fetchDetails = async () => {
    if (items.length > 0 && dofData && ordersData.length > 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Fetch items with relationships if not already provided
      if (items.length === 0 && actualReceipt.id) {
        const { data: itemsData, error: itemsErr } = await supabase
          .from('greige_yarn_delivery_items')
          .select(`
            *,
            master_yarn_counts (*),
            spinning_mill:master_partners!spinning_mill_id (*),
            master_locations (*),
            orders (id, order_number, design_no, design_name)
          `)
          .eq('receipt_id', actualReceipt.id);
        
        if (itemsErr) throw itemsErr;
        setItems(itemsData || []);
      }

      // 1.5 Fetch fresh receipt header to get eway details
      if (actualReceipt.id) {
        const { data: freshReceipt } = await supabase
          .from('greige_yarn_delivery_receipts')
          .select('*')
          .eq('id', actualReceipt.id)
          .maybeSingle();
        if (freshReceipt) {
          setLocalReceipt(freshReceipt);
        }
      }

      // 2. Fetch DOF & dyeing unit if not passed
      let currentDof = dofData;
      if (!currentDof && (actualReceipt.dof_id || actualReceipt.dof_number)) {
        let dofQuery = supabase.from('dyeing_order_forms').select(`
          *,
          dyeing_unit:master_partners(id, partner_name, gstin, address, pincode, state_code)
        `);
        
        if (actualReceipt.dof_id) {
          dofQuery = dofQuery.eq('id', actualReceipt.dof_id);
        } else {
          dofQuery = dofQuery.eq('dof_number', actualReceipt.dof_number);
        }
        
        const { data: dofRes } = await dofQuery.maybeSingle();
        currentDof = dofRes;
        setDofData(dofRes);
      }

      // 3. Fetch linked orders if not passed
      let currentOrders = ordersData;
      if (currentOrders.length === 0 && currentDof?.order_ids?.length > 0) {
        const { data: ordersRes } = await supabase
          .from('orders')
          .select('id, order_number, design_no, design_name')
          .in('id', currentDof.order_ids);
        currentOrders = ordersRes || [];
        setOrdersData(currentOrders);
      }
    } catch (err) {
      console.error('Error loading GYDR print details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return '—';
    try {
      return new Date(dateVal).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(dateVal);
    }
  };

  const formatTime = (dateVal) => {
    if (!dateVal) return '';
    try {
      return new Date(dateVal).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const formatYarnCount = (item) => {
    if (item.master_yarn_counts) {
      return [
        item.master_yarn_counts.count_value, 
        item.master_yarn_counts.spec, 
        item.master_yarn_counts.spec1, 
        item.master_yarn_counts.product_type
      ].filter(Boolean).join(' ');
    }
    if (item.yarn_count) {
      if (typeof item.yarn_count === 'object') {
        return [
          item.yarn_count.count_value, 
          item.yarn_count.spec, 
          item.yarn_count.spec1, 
          item.yarn_count.product_type
        ].filter(Boolean).join(' ');
      }
      return String(item.yarn_count);
    }
    if (yarnCounts && item.yarn_count_id) {
      const yc = yarnCounts.find(y => y.id === item.yarn_count_id);
      if (yc) return [yc.count_value, yc.spec, yc.spec1, yc.product_type].filter(Boolean).join(' ');
    }
    return item.count || '—';
  };

  const receiptNumber = localReceipt.gydr_number || actualReceipt.gydr_number || localReceipt.receipt_no || '—';
  const receiptDate = formatDate(localReceipt.created_at || localReceipt.date || actualReceipt.created_at);
  const receiptTime = formatTime(localReceipt.created_at || localReceipt.date || actualReceipt.created_at);

  const dofNo = dofData?.dof_number || localReceipt.dof_number || actualReceipt.dof_number || '—';
  const dyeingUnitName = partnerDetails?.partner_name || dofData?.dyeing_unit?.partner_name || dofData?.dyeing_unit_name || localReceipt.dyeing_unit_name || '—';
  const deliveredBy = localReceipt.delivered_by || actualReceipt.delivered_by || '—';
  const vehicleNo = localReceipt.vehicle_no || localReceipt.vehicle_details || actualReceipt.vehicle_no || '—';
  const remarks = localReceipt.remarks || actualReceipt.remarks || '';

  const totalWeight = items.reduce((s, i) => s + parseFloat(i.quantity_kg || i.weight || 0), 0);

  // Formatting linked orders summary
  const ordersSummaryList = ordersData.map(o => o.order_number).filter(Boolean);
  const ordersText = ordersSummaryList.length > 0 ? ordersSummaryList.join(', ') : '—';
  const designsSummaryList = ordersData.map(o => [o.design_no, o.design_name].filter(Boolean).join(' / ')).filter(Boolean);
  const designsText = designsSummaryList.length > 0 ? designsSummaryList.join(', ') : '';

  const renderDeliveryCopy = (copyType, copyBadge) => (
    <div className="gydr-single-copy" style={{
      padding: '0.85rem 1.25rem',
      backgroundColor: '#fff',
      color: '#000',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative'
    }}>
      {/* Top Header Row */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid #7f1d1d',
          paddingBottom: '0.45rem',
          marginBottom: '0.5rem'
        }}>
          {/* Company Brand & Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img 
              src="/logo.png" 
              alt="Ashok Textiles" 
              style={{ 
                height: '38px', 
                objectFit: 'contain'
              }} 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div>
              <div style={{ 
                fontSize: '1.2rem', 
                fontWeight: '900', 
                letterSpacing: '0.5px', 
                margin: 0, 
                color: '#1a1a1a', 
                lineHeight: '1.1' 
              }}>
                ASHOK TEXTILES
              </div>
              <div style={{ fontSize: '0.68rem', color: '#4b5563', fontWeight: '500', marginTop: '1px', lineHeight: '1.2' }}>
                6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33
              </div>
              <div style={{ fontSize: '0.68rem', color: '#111827', fontWeight: '700', marginTop: '1px' }}>
                GSTIN: <span style={{ fontFamily: 'monospace' }}>33AAZFA60686D1Z6</span>
              </div>
            </div>
          </div>

          {/* Title & Copy Badge */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#7f1d1d', 
              fontWeight: '900', 
              letterSpacing: '0.5px', 
              textTransform: 'uppercase' 
            }}>
              GREIGE YARN DELIVERY (GYDR)
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: '800',
                padding: '1px 6px',
                borderRadius: '3px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                border: '1px solid #fecaca',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {copyBadge}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#374151', marginTop: '2px', fontWeight: '600' }}>
              Delivery No: <strong style={{ color: '#7f1d1d', fontFamily: 'monospace', fontSize: '0.8rem' }}>{receiptNumber}</strong>
            </div>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.5rem',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '0.45rem 0.65rem',
          marginBottom: '0.5rem',
          fontSize: '0.7rem'
        }}>
          <div>
            <div style={metaLabelStyle}>DELIVERY INFO</div>
            <div style={metaValStyle}><strong>Date:</strong> {receiptDate}</div>
            {receiptTime && <div style={metaValStyle}><strong>Time:</strong> {receiptTime}</div>}
          </div>
          <div>
            <div style={metaLabelStyle}>DOF & DYEING UNIT</div>
            <div style={metaValStyle}><strong>Ref DOF:</strong> <span style={{ fontWeight: '700', color: '#7f1d1d' }}>{dofNo}</span></div>
            <div style={metaValStyle} title={dyeingUnitName}><strong>Unit:</strong> {dyeingUnitName}</div>
            {partnerDetails?.gstin && (
              <div style={metaValStyle}><strong>GSTIN:</strong> {partnerDetails.gstin}</div>
            )}
          </div>
          <div>
            <div style={metaLabelStyle}>LINKED ORDERS</div>
            <div style={metaValStyle}><strong>Orders:</strong> {ordersText}</div>
            {designsText && (
              <div style={{ ...metaValStyle, fontSize: '0.64rem', color: '#64748b' }} title={designsText}>
                <strong>Design:</strong> {designsText}
              </div>
            )}
          </div>
          <div>
            <div style={metaLabelStyle}>LOGISTICS & DISPATCH</div>
            <div style={metaValStyle}><strong>Delivered By:</strong> {deliveredBy}</div>
            <div style={metaValStyle}><strong>Vehicle No:</strong> {vehicleNo}</div>
            {localReceipt?.eway_bill_no && (
              <div style={metaValStyle}>
                <strong>E-Way Bill:</strong> <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#166534' }}>{localReceipt.eway_bill_no}</span>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.4rem', fontSize: '0.72rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1.5px solid #334155', borderBottom: '1.5px solid #334155' }}>
              <th style={{ ...compactThStyle, width: '4%', textAlign: 'center' }}>#</th>
              <th style={{ ...compactThStyle, width: '28%' }}>Yarn Description</th>
              <th style={{ ...compactThStyle, width: '14%' }}>Colour</th>
              <th style={{ ...compactThStyle, width: '10%', textAlign: 'center' }}>Type</th>
              <th style={{ ...compactThStyle, width: '20%' }}>Spinning Mill</th>
              <th style={{ ...compactThStyle, width: '10%' }}>Location</th>
              <th style={{ ...compactThStyle, width: '14%', textAlign: 'right' }}>Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ ...compactTdStyle, textAlign: 'center', color: '#6b7280', padding: '0.5rem' }}>
                  No yarn items found in delivery receipt.
                </td>
              </tr>
            ) : (
              items.map((it, i) => {
                const yarnCount = formatYarnCount(it);
                const colour = it.colour || it.color || '—';
                const yarnType = it.yarn_type || it.type || '—';
                const millName = it.spinning_mill?.partner_name || it.spinning_mill_name || (it.spinning_mill_id ? 'Unknown Mill' : 'Production Returns');
                const locationName = typeof it.master_locations === 'object'
                  ? it.master_locations?.location_name
                  : (typeof it.location === 'object' ? it.location?.location_name : (it.location || '—'));
                const qtyKg = Number(it.quantity_kg ?? it.weight ?? 0).toFixed(2);

                return (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ ...compactTdStyle, textAlign: 'center', color: '#64748b', fontSize: '0.65rem' }}>{i + 1}</td>
                    <td style={{ ...compactTdStyle, fontWeight: '700', color: '#1e293b' }}>
                      {yarnCount}
                    </td>
                    <td style={{ ...compactTdStyle, fontWeight: '700', color: '#7f1d1d', textTransform: 'uppercase' }}>
                      {colour}
                    </td>
                    <td style={{ ...compactTdStyle, textAlign: 'center' }}>
                      <span style={{ 
                        padding: '1px 5px', 
                        borderRadius: '3px', 
                        fontSize: '0.62rem', 
                        fontWeight: '800', 
                        backgroundColor: yarnType.toLowerCase() === 'warp' ? '#eff6ff' : '#ecfdf5',
                        color: yarnType.toLowerCase() === 'warp' ? '#1e40af' : '#047857',
                        border: `1px solid ${yarnType.toLowerCase() === 'warp' ? '#bfdbfe' : '#a7f3d0'}`,
                        textTransform: 'uppercase'
                      }}>
                        {yarnType}
                      </span>
                    </td>
                    <td style={{ ...compactTdStyle, color: '#334155' }}>
                      {millName}
                    </td>
                    <td style={{ ...compactTdStyle, color: '#334155' }}>
                      {locationName}
                    </td>
                    <td style={{ ...compactTdStyle, textAlign: 'right', fontWeight: '900', color: '#0f172a', fontSize: '0.78rem' }}>
                      {qtyKg}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f8fafc', borderTop: '1.5px solid #334155' }}>
              <td colSpan="6" style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: '800', color: '#334155', fontSize: '0.72rem' }}>
                TOTAL DELIVERED WEIGHT:
              </td>
              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: '900', fontSize: '0.9rem', color: '#0f172a', borderBottom: '3px double #0f172a' }}>
                {totalWeight.toFixed(2)} <span style={{ fontSize: '0.72rem', fontWeight: '700' }}>kg</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer / Signatures Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingTop: '0.4rem',
        marginTop: '0.2rem',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.68rem'
      }}>
        {/* Left: Delivered By Sign */}
        <div style={{ minWidth: '160px', textAlign: 'left' }}>
          <div style={{ color: '#64748b', fontSize: '0.62rem', marginBottom: '1.25rem' }}>
            Delivered By: <strong>{deliveredBy !== '—' ? deliveredBy : ''}</strong>
          </div>
          <div style={{ borderTop: '1.5px dashed #475569', paddingTop: '2px', fontWeight: '700', color: '#1e293b' }}>
            Sender / Dispatcher Signature
          </div>
        </div>

        {/* Center: Remarks if available */}
        {remarks ? (
          <div style={{ maxWidth: '220px', textAlign: 'center', color: '#4b5563', fontSize: '0.62rem', fontStyle: 'italic' }}>
            <strong>Remarks:</strong> {remarks}
          </div>
        ) : <div />}

        {/* Right: Dyeing Unit / Receiver Signature */}
        <div style={{ minWidth: '180px', textAlign: 'right' }}>
          <div style={{ fontWeight: '800', color: '#1a1a1a', marginBottom: '1.25rem', fontSize: '0.72rem' }}>
            For {dyeingUnitName !== '—' ? dyeingUnitName : 'ASHOK TEXTILES'}
          </div>
          <div style={{ borderTop: '1.5px solid #1a1a1a', paddingTop: '2px', fontWeight: '700', color: '#1e293b', textAlign: 'center' }}>
            Receiver / Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="print-overlay" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '1rem'
    }}>
      <div 
        className="print-modal-container"
        style={{
          backgroundColor: '#fff',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '96vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="no-print" style={{ 
          padding: '0.85rem 1.5rem', 
          borderBottom: '1px solid #e2e8f0', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          borderTopLeftRadius: '10px',
          borderTopRightRadius: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>
              Greige Yarn Delivery: {receiptNumber}
            </h2>
            <span style={{
              fontSize: '0.7rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: '700'
            }}>
              2 Copies / A4 Sheet
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {localReceipt?.eway_bill_no ? (
              localReceipt.eway_bill_status === 'cancelled' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', color: '#991b1b', fontWeight: '700' }}>
                  Cancelled
                  <button
                    onClick={() => setShowEwayModal(true)}
                    style={{ border: 'none', background: 'none', color: '#0284c7', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '0.78rem', marginLeft: '4px', fontWeight: '700' }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', color: '#166534', fontWeight: '700' }}>
                  <CheckCircle size={15} style={{ color: '#15803d' }} /> Eway: {localReceipt.eway_bill_no}
                  <button
                    onClick={() => setShowEwayModal(true)}
                    style={{ border: 'none', background: 'none', color: '#b91c1c', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '0.78rem', marginLeft: '4px', fontWeight: '700' }}
                  >
                    Cancel
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={() => setShowEwayModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              >
                <Truck size={15} /> Generate E-Way Bill
              </button>
            )}

            {localReceipt?.eway_bill_no && localReceipt.eway_bill_status === 'generated' && (
              <button
                onClick={() => setShowEwayPrint(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              >
                <Printer size={15} /> Print E-Way Bill
              </button>
            )}

            <button 
              onClick={handlePrint} 
              className="btn btn-primary" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                padding: '0.45rem 1rem', 
                backgroundColor: '#7f1d1d',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <Printer size={16} /> Print 2 Copies (A4)
            </button>
            <button 
              onClick={onClose} 
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable 2-Copies Container */}
        <div id="printable-gydr" className="printable-content" style={{ backgroundColor: '#fff' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <Loader size={28} className="spin" style={{ margin: '0 auto 1rem', display: 'block' }} color="#7f1d1d" />
              <div style={{ fontWeight: '600', color: '#475569' }}>Loading delivery details...</div>
            </div>
          ) : (
            <>
              {/* Top Half: Original Copy */}
              {renderDeliveryCopy('original', 'Original / Office Copy')}

              {/* Divider between copies */}
              <div className="print-divider" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 1.25rem',
                color: '#64748b',
                fontSize: '0.65rem',
                fontWeight: '700',
                letterSpacing: '1px',
                userSelect: 'none'
              }}>
                <div style={{ flex: 1, borderBottom: '1.5px dashed #94a3b8' }} />
                <span style={{ padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                  ✂ CUT HERE ✂
                </span>
                <div style={{ flex: 1, borderBottom: '1.5px dashed #94a3b8' }} />
              </div>

              {/* Bottom Half: Duplicate Copy */}
              {renderDeliveryCopy('duplicate', 'Duplicate / Mill Copy')}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media screen {
          .gydr-single-copy {
            border: 1px solid #e2e8f0;
            margin: 0.5rem 1rem;
            border-radius: 6px;
          }
        }
        @media print {
          @page { 
            size: A4 portrait;
            margin: 5mm 8mm; 
          }
          html, body, #root, .app-layout-container, .main-content-wrapper, .main-content {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          body * {
            visibility: hidden !important;
          }
          .print-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            background: transparent !important;
          }
          .print-modal-container, .print-modal-container * {
            visibility: visible !important;
          }
          .print-modal-container {
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .printable-content {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: 282mm !important;
            display: flex !important;
            flex-direction: column !important;
            justifyContent: space-between !important;
            box-sizing: border-box !important;
          }
          .gydr-single-copy {
            height: 136mm !important;
            max-height: 136mm !important;
            padding: 2mm 3mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            border: none !important;
            margin: 0 !important;
          }
          .print-divider {
            height: 5mm !important;
            margin: 0 !important;
            padding: 0 3mm !important;
          }
        }
      `}</style>

      <EwayBillModal
        isOpen={showEwayModal}
        onClose={() => setShowEwayModal(false)}
        type="greige"
        record={localReceipt}
        defaultDetails={{
          docNo: localReceipt?.gydr_number,
          docDate: localReceipt?.created_at,
          partnerName: partnerDetails?.partner_name || dofData?.dyeing_unit?.partner_name || localReceipt?.dyeing_unit_name || 'Processing Partner',
          partnerGstin: partnerDetails?.gstin,
          partnerAddress: partnerDetails?.address,
          partnerPincode: partnerDetails?.pincode,
          partnerStateCode: partnerDetails?.state_code,
          vehicleNo: localReceipt?.vehicle_details || localReceipt?.vehicle_no,
          totalQty: items.reduce((sum, item) => sum + parseFloat(item.delivered_qty || item.quantity_kg || 0), 0),
          qtyUnit: 'KGS',
          productName: 'Greige Cotton Yarn'
        }}
        onSuccess={(res) => {
          setLocalReceipt(prev => ({
            ...prev,
            eway_bill_no: res.ewayBillNo || prev?.eway_bill_no,
            eway_bill_status: res.eway_bill_status || 'generated',
            eway_bill_date: res.ewayBillDate || prev?.eway_bill_date
          }));
        }}
      />
      <EwayBillPrintModal
        isOpen={showEwayPrint}
        onClose={() => setShowEwayPrint(false)}
        type="greige"
        record={{
          ...localReceipt,
          totalQty: items.reduce((sum, item) => sum + parseFloat(item.delivered_qty || item.quantity_kg || 0), 0)
        }}
      />
    </div>
  );
}

const metaLabelStyle = {
  fontSize: '0.58rem',
  fontWeight: '900',
  color: '#64748b',
  letterSpacing: '0.5px',
  marginBottom: '2px',
  textTransform: 'uppercase'
};

const metaValStyle = {
  fontSize: '0.68rem',
  color: '#0f172a',
  lineHeight: '1.3'
};

const compactThStyle = {
  padding: '3px 5px',
  textAlign: 'left',
  fontSize: '0.64rem',
  textTransform: 'uppercase',
  fontWeight: '800',
  color: '#1e293b',
  borderBottom: '1.5px solid #cbd5e1'
};

const compactTdStyle = {
  padding: '3px 5px',
  fontSize: '0.7rem',
  color: '#1e293b',
  verticalAlign: 'middle',
  lineHeight: '1.2'
};
