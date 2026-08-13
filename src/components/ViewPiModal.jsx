import React, { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

function convertNumberToWords(amount) {
  let words = "";
  const num = Math.floor(amount);
  
  if (num === 0) return "Zero Rupees Only";
  
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function numToWords(n, suffix) {
    let str = "";
    if (n > 19) {
      str += b[Math.floor(n / 10)] + " " + a[n % 10];
    } else {
      str += a[n];
    }
    if (n) {
      str += suffix;
    }
    return str;
  }
  
  words += numToWords(Math.floor(num / 10000000), "Crore ");
  words += numToWords(Math.floor((num / 100000) % 100), "Lakh ");
  words += numToWords(Math.floor((num / 1000) % 100), "Thousand ");
  words += numToWords(Math.floor((num / 100) % 10), "Hundred ");
  
  let rest = num % 100;
  if (num > 100 && rest > 0) {
    words += "and ";
  }
  
  words += numToWords(rest, "");
  
  return "Rupees " + words.trim().replace(/\s+/g, ' ') + " Only";
}

export default function ViewPiModal({ pi, ordersMap = {}, currentOrder = null, onClose }) {
  const [orderInfoMap, setOrderInfoMap] = useState({});

  useEffect(() => {
    async function fetchOrderDetails() {
      const map = { ...(ordersMap || {}) };
      if (currentOrder) {
        if (currentOrder.id) map[currentOrder.id] = currentOrder;
        if (currentOrder.order_number) map[currentOrder.order_number] = currentOrder;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validUuids = new Set();
      const orderNumbers = new Set();

      const addId = (val) => {
        if (!val) return;
        const str = String(val).trim();
        if (uuidRegex.test(str)) {
          if (!map[str]) validUuids.add(str);
        } else {
          if (!map[str]) orderNumbers.add(str);
        }
      };

      addId(pi.order_id);
      if (Array.isArray(pi.order_ids)) pi.order_ids.forEach(addId);
      if (Array.isArray(pi.items)) {
        pi.items.forEach(it => {
          addId(it.order_id);
          addId(it.orderId);
          addId(it.order_no);
          addId(it.order_number);
        });
      }

      const queries = [];
      if (validUuids.size > 0) {
        queries.push(
          supabase
            .from('orders')
            .select('id, order_number, design_name, design_no, yarn_count, order_construction, production_construction')
            .in('id', Array.from(validUuids))
        );
      }
      if (orderNumbers.size > 0) {
        queries.push(
          supabase
            .from('orders')
            .select('id, order_number, design_name, design_no, yarn_count, order_construction, production_construction')
            .in('order_number', Array.from(orderNumbers))
        );
      }

      if (queries.length > 0) {
        try {
          const results = await Promise.all(queries);
          results.forEach(({ data, error }) => {
            if (!error && Array.isArray(data)) {
              data.forEach(o => {
                if (o.id) map[o.id] = o;
                if (o.order_number) map[o.order_number] = o;
              });
            }
          });
        } catch (err) {
          console.error("Error querying orders for PI:", err);
        }
      }

      setOrderInfoMap(map);
    }

    fetchOrderDetails();
  }, [pi, currentOrder, ordersMap]);

  const isMultiItem = Array.isArray(pi.items) && pi.items.length > 0;

  const amount = isMultiItem
    ? pi.items.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0)
    : (parseFloat(pi.amount) || 0);

  const discountAmount = isMultiItem
    ? pi.items.reduce((acc, it) => acc + (parseFloat(it.discount_amount) || 0), 0)
    : amount * (parseFloat(pi.discount_percent) || 0) / 100;

  const taxableValue = isMultiItem
    ? pi.items.reduce((acc, it) => acc + (parseFloat(it.taxable_value) || 0), 0)
    : (parseFloat(pi.taxable_value) || (amount - discountAmount));

  const cgstAmount = isMultiItem
    ? pi.items.reduce((acc, it) => acc + (parseFloat(it.cgst_amount) || 0), 0)
    : (parseFloat(pi.cgst_amount) || 0);

  const sgstAmount = isMultiItem
    ? pi.items.reduce((acc, it) => acc + (parseFloat(it.sgst_amount) || 0), 0)
    : (parseFloat(pi.sgst_amount) || 0);

  const igstAmount = isMultiItem
    ? pi.items.reduce((acc, it) => acc + (parseFloat(it.igst_amount) || 0), 0)
    : (parseFloat(pi.igst_amount) || 0);

  const totalGstAmount = parseFloat(pi.total_gst_amount) || (cgstAmount + sgstAmount + igstAmount);
  const totalInvoicePrice = parseFloat(pi.total_invoice_price) || (taxableValue + totalGstAmount);
  const totalQty = isMultiItem
    ? pi.items.reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0)
    : (parseFloat(pi.qty) || 0);

  const words = convertNumberToWords(totalInvoicePrice);
  const hasCgst = cgstAmount > 0 || parseFloat(pi.cgst_percent) > 0;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop print-modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
    }}>
      <div className="modal-card print-container fade-in" style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '880px',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0'
      }}>
        {/* Modal Header Actions (No Print) */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }} className="no-print">
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--color-primary, #800000)' }}>
              Print Proforma Invoice (PI) — {pi.invoice_number}
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0 0' }}>Date: {formatDate(pi.invoice_date)}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handlePrint} style={{ padding: '0.45rem 1.0rem', background: 'var(--color-primary, #800000)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <Printer size={16} /> Print PI
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="print-pi-document print-body" style={{ padding: '2rem', backgroundColor: '#fff', color: '#000', fontSize: '0.85rem', fontFamily: 'sans-serif' }}>
          
          {/* Top Section */}
          <div className="print-top-section">
            {/* Seller Header */}
            <div className="print-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '2px solid #000', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <img src="/logo.png" alt="Ashok Textiles" style={{ maxHeight: '55px', objectFit: 'contain' }} />
                <div>
                  <h1 style={{ margin: '0 0 0.15rem 0', fontSize: '1.6rem', fontWeight: '950', color: '#000', letterSpacing: '0.5px', lineHeight: 1.1 }}>ASHOK TEXTILES</h1>
                  <p style={{ margin: '0 0 0.1rem 0', fontWeight: '800', fontSize: '0.75rem', color: '#800000', letterSpacing: '0.5px', textTransform: 'uppercase' }}>MANUFACTURERS OF GREIGE FABRIC</p>
                  <p style={{ margin: '0 0 0.1rem 0', fontSize: '0.75rem', color: '#222' }}>6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#222' }}><strong>GSTIN:</strong> 33AAZFA60686D1Z6</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>PROFORMA INVOICE</h2>
                <div style={{ fontSize: '0.78rem', fontWeight: 'bold', border: '1.5px solid #000', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-block' }}>
                  ORIGINAL FOR BUYER
                </div>
              </div>
            </div>

            {/* PI Header Metadata Grid */}
            <div className="print-meta-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '1rem', borderBottom: '1px solid #000', paddingBottom: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
              <div>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Invoice No:</strong> <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 'bold' }}>{pi.invoice_number}</span></p>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Invoice Date:</strong> {formatDate(pi.invoice_date)}</p>
                <p style={{ margin: 0 }}><strong>State of Supply:</strong> TAMIL NADU (Code: 33)</p>
              </div>
              <div>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Buyer PO Number:</strong> {pi.buyer_po_number || '—'}</p>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>PO Date:</strong> {formatDate(pi.buyer_po_date)}</p>
                <p style={{ margin: 0 }}><strong>Vehicle Number:</strong> {pi.vehicle_number || '—'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Transport Mode:</strong> {pi.transport_mode || 'ROAD'}</p>
                <p style={{ margin: 0 }}><strong>Delivery Date:</strong> {formatDate(pi.delivery_date)}</p>
              </div>
            </div>

            {/* Address Grid - 2 Evenly Spaced Boxes filling full width */}
            <div className="print-address-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', width: '100%', marginBottom: '1.25rem', alignItems: 'stretch' }}>
              <div className="print-address-box" style={{ border: '1.5px solid #000', borderRadius: '6px', padding: '0.65rem 0.85rem', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                <h4 style={{ margin: '0 0 0.35rem 0', fontWeight: '900', fontSize: '0.78rem', textTransform: 'uppercase', color: '#800000', borderBottom: '1px solid #ccc', paddingBottom: '0.2rem' }}>
                  Billed To (Receiver)
                </h4>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#000' }}>{pi.billed_to_name || '—'}</p>
                <p style={{ margin: '0 0 0.35rem 0', whiteSpace: 'pre-wrap', color: '#333', fontSize: '0.76rem', flex: 1 }}>{pi.billed_to_address || '—'}</p>
                <div style={{ fontSize: '0.76rem', color: '#111', paddingTop: '0.25rem', borderTop: '1px dashed #ccc', marginTop: 'auto' }}>
                  <p style={{ margin: '0 0 0.15rem 0' }}><strong>State:</strong> {pi.billed_to_state || '—'} (Code: {pi.billed_to_state_code || '—'})</p>
                  <p style={{ margin: 0 }}><strong>GSTIN:</strong> {pi.billed_to_gstin || '—'}</p>
                </div>
              </div>
              <div className="print-address-box" style={{ border: '1.5px solid #000', borderRadius: '6px', padding: '0.65rem 0.85rem', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                <h4 style={{ margin: '0 0 0.35rem 0', fontWeight: '900', fontSize: '0.78rem', textTransform: 'uppercase', color: '#800000', borderBottom: '1px solid #ccc', paddingBottom: '0.2rem' }}>
                  Shipped To (Consignee)
                </h4>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 'bold', color: '#000' }}>{pi.shipped_to_name || pi.billed_to_name || '—'}</p>
                <p style={{ margin: '0 0 0.35rem 0', whiteSpace: 'pre-wrap', color: '#333', fontSize: '0.76rem', flex: 1 }}>{pi.shipped_to_address || pi.billed_to_address || '—'}</p>
                <div style={{ fontSize: '0.76rem', color: '#111', paddingTop: '0.25rem', borderTop: '1px dashed #ccc', marginTop: 'auto' }}>
                  <p style={{ margin: '0 0 0.15rem 0' }}><strong>State:</strong> {pi.shipped_to_state || pi.billed_to_state || '—'} (Code: {pi.shipped_to_state_code || pi.billed_to_state_code || '—'})</p>
                  <p style={{ margin: 0 }}><strong>GSTIN:</strong> {pi.shipped_to_gstin || pi.billed_to_gstin || '—'}</p>
                </div>
              </div>
            </div>

            {/* Product Details Table */}
            <h4 className="print-table-title" style={{ margin: '0 0 0.4rem 0', fontWeight: '800', fontSize: '0.82rem', textTransform: 'uppercase', color: '#111' }}>Product Details</h4>
            <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.76rem' }}>
              <thead>
                <tr style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', backgroundColor: '#fafafa', textAlign: 'left', fontWeight: 'bold' }}>
                  <th style={{ padding: '0.45rem 0.35rem', textAlign: 'center', width: '38px' }}>S.No</th>
                  <th style={{ padding: '0.45rem 0.35rem' }}>Description of Goods</th>
                  <th style={{ padding: '0.45rem 0.35rem', width: '70px' }}>HSN</th>
                  <th style={{ padding: '0.45rem 0.35rem', width: '55px' }}>UOM</th>
                  <th style={{ padding: '0.45rem 0.35rem', textAlign: 'right', width: '85px' }}>Qty</th>
                  <th style={{ padding: '0.45rem 0.35rem', textAlign: 'right', width: '85px' }}>Rate (₹)</th>
                  <th style={{ padding: '0.45rem 0.35rem', textAlign: 'right', width: '55px' }}>Disc %</th>
                  <th style={{ padding: '0.45rem 0.35rem', textAlign: 'right', width: '95px' }}>Taxable Value</th>
                  {hasCgst ? (
                    <>
                      <th style={{ padding: '0.45rem 0.35rem', textAlign: 'right', width: '85px' }}>CGST</th>
                      <th style={{ padding: '0.45rem 0.35rem', textAlign: 'right', width: '85px' }}>SGST</th>
                    </>
                  ) : (
                    <th style={{ padding: '0.45rem 0.35rem', textAlign: 'right', width: '95px' }}>IGST</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {isMultiItem ? (
                  pi.items.map((it, idx) => {
                    const itemAmt = parseFloat(it.amount || 0);
                    const itemDisc = parseFloat(it.discount_amount || 0);
                    const itemTaxable = parseFloat(it.taxable_value || (itemAmt - itemDisc));
                    const itemCgst = parseFloat(it.cgst_amount || 0);
                    const itemSgst = parseFloat(it.sgst_amount || 0);
                    const itemIgst = parseFloat(it.igst_amount || 0);

                    const itemKey = it.order_id || it.orderId || it.order_number || it.order_no;
                    const itemOrder = orderInfoMap[itemKey] || orderInfoMap[it.order_id] || orderInfoMap[it.order_number] || orderInfoMap[pi.order_id] || orderInfoMap[pi.order_number] || currentOrder || {};
                    const orderNo = it.order_number || it.order_no || it.orderNo || itemOrder.order_number || pi.order_number || pi.order_no || (currentOrder?.order_number) || '—';
                    const designName = it.design_name || it.designName || itemOrder.design_name || pi.design_name || pi.designName || (currentOrder?.design_name);
                    const designNo = it.design_no || it.designNo || it.design_number || itemOrder.design_no || pi.design_no || pi.designNo || (currentOrder?.design_no) || '—';
                    const count = it.count || it.yarn_count || itemOrder.yarn_count || pi.count || (currentOrder?.yarn_count);
                    const construction = it.construction || it.order_construction || itemOrder.order_construction || itemOrder.production_construction || pi.construction || (currentOrder?.order_construction || currentOrder?.production_construction);

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #ccc', verticalAlign: 'top' }}>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '0.45rem 0.35rem', lineHeight: '1.35' }}>
                          <strong>Order No:</strong> {orderNo}<br />
                          <strong>Design Name:</strong> {designName || '—'}<br />
                          <strong>Design No:</strong> {designNo || '—'}<br />
                          {count && <><strong>Count:</strong> {count}<br /></>}
                          {construction && <><strong>Construction:</strong> {construction}</>}
                        </td>
                        <td style={{ padding: '0.45rem 0.35rem' }}>{it.hsn_code || pi.hsn_code || '5208'}</td>
                        <td style={{ padding: '0.45rem 0.35rem' }}>{(it.uom || pi.uom || 'Meters').toUpperCase()}</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(it.qty || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{it.discount_percent || 0}%</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(itemTaxable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        {hasCgst ? (
                          <>
                            <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>
                              {Number(itemCgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br />
                              <span style={{ fontSize: '0.68rem', color: '#555' }}>({it.cgst_percent ?? pi.cgst_percent}%)</span>
                            </td>
                            <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>
                              {Number(itemSgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br />
                              <span style={{ fontSize: '0.68rem', color: '#555' }}>({it.sgst_percent ?? pi.sgst_percent}%)</span>
                            </td>
                          </>
                        ) : (
                          <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>
                            {Number(itemIgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br />
                            <span style={{ fontSize: '0.68rem', color: '#555' }}>({it.igst_percent ?? pi.igst_percent}%)</span>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  (() => {
                    const singleOrder = orderInfoMap[pi.order_id] || orderInfoMap[pi.order_number] || currentOrder || {};
                    const orderNo = pi.order_number || pi.order_no || singleOrder.order_number || (currentOrder?.order_number) || '—';
                    const designName = pi.design_name || pi.designName || singleOrder.design_name || (currentOrder?.design_name);
                    const designNo = pi.design_no || pi.designNo || singleOrder.design_no || (currentOrder?.design_no) || '—';
                    const count = pi.count || singleOrder.yarn_count || (currentOrder?.yarn_count);
                    const construction = pi.construction || singleOrder.order_construction || singleOrder.production_construction || (currentOrder?.order_construction || currentOrder?.production_construction);

                    return (
                      <tr style={{ borderBottom: '1px solid #ccc', verticalAlign: 'top' }}>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'center' }}>1</td>
                        <td style={{ padding: '0.45rem 0.35rem', lineHeight: '1.35' }}>
                          <strong>Order No:</strong> {orderNo}<br />
                          <strong>Design Name:</strong> {designName || '—'}<br />
                          <strong>Design No:</strong> {designNo || '—'}<br />
                          {count && <><strong>Count:</strong> {count}<br /></>}
                          {construction && <><strong>Construction:</strong> {construction}</>}
                        </td>
                        <td style={{ padding: '0.45rem 0.35rem' }}>{pi.hsn_code || '5208'}</td>
                        <td style={{ padding: '0.45rem 0.35rem' }}>{(pi.uom || 'Meters').toUpperCase()}</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(pi.qty || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(pi.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{pi.discount_percent || 0}%</td>
                        <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        {hasCgst ? (
                          <>
                            <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>
                              {Number(cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br />
                              <span style={{ fontSize: '0.68rem', color: '#555' }}>({pi.cgst_percent}%)</span>
                            </td>
                            <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>
                              {Number(sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br />
                              <span style={{ fontSize: '0.68rem', color: '#555' }}>({pi.sgst_percent}%)</span>
                            </td>
                          </>
                        ) : (
                          <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>
                            {Number(igstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br />
                            <span style={{ fontSize: '0.68rem', color: '#555' }}>({pi.igst_percent}%)</span>
                          </td>
                        )}
                      </tr>
                    );
                  })()
                )}

                {/* Totals Row */}
                <tr style={{ borderBottom: '1.5px solid #000', fontWeight: 'bold' }}>
                  <td style={{ padding: '0.45rem 0.35rem' }}></td>
                  <td style={{ padding: '0.45rem 0.35rem' }}>Total</td>
                  <td></td>
                  <td></td>
                  <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(totalQty).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td></td>
                  <td></td>
                  <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  {hasCgst ? (
                    <>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </>
                  ) : (
                    <td style={{ padding: '0.45rem 0.35rem', textAlign: 'right' }}>{Number(igstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bottom Section */}
          <div className="print-bottom-section">
            <div className="print-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '1.5rem', marginTop: '0.5rem' }}>
              <div>
                <p style={{ margin: '0 0 3px 0', fontSize: '0.78rem', textTransform: 'uppercase', color: '#444' }}>
                  <strong>Amount in Words:</strong>
                </p>
                <p className="print-amount-words" style={{ margin: '0 0 0.8rem 0', fontWeight: 'bold', fontSize: '0.85rem', color: '#111', borderBottom: '1px solid #ccc', paddingBottom: '0.35rem' }}>
                  {words}
                </p>

                <div className="print-bank-details" style={{ fontSize: '0.75rem', color: '#333', lineHeight: '1.35', border: '1px solid #ddd', padding: '0.6rem', borderRadius: '4px', backgroundColor: '#fafafa', whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>
                  <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', color: '#800000', textTransform: 'uppercase', fontSize: '0.75rem' }}>Bank Account Details</p>
                  {pi.bank_details || 'TAMILNAD MERCANTILE BANK, A/C: 028700150960232, SHEVAPET, SALEM, IFSC: TMBL0000028'}
                </div>

                <div className="print-terms-conditions" style={{ fontSize: '0.72rem', color: '#333', lineHeight: '1.3', border: '1px solid #ddd', padding: '0.6rem', borderRadius: '4px', backgroundColor: '#fafafa' }}>
                  <p style={{ margin: '0 0 3px 0', fontWeight: 'bold', color: '#800000', textTransform: 'uppercase', fontSize: '0.72rem' }}>Terms & Conditions</p>
                  <p style={{ margin: '0 0 2px 0' }}><strong>Payment Terms:</strong> {pi.payment_terms || '30 Days'}</p>
                  <p style={{ margin: '0 0 2px 0' }}><strong>Quality Tolerance:</strong> {pi.quality_tolerance || '+/- 5%'}</p>
                  <p style={{ margin: '0 0 2px 0' }}><strong>Remarks / Shipment:</strong> {pi.remarks || 'Subject to Salem Jurisdiction'}</p>
                  <p style={{ margin: 0 }}><strong>Other Terms:</strong> All payments must be made in favour of ASHOK TEXTILES. Discrepancies if any should be reported within 3 days of invoice date. Interest @18% p.a. will be charged for delayed payments beyond due date.</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                <div className="print-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: '0.3rem' }}>
                  <span style={{ color: '#555' }}>Total Amount Before Tax:</span>
                  <span style={{ fontWeight: 'bold' }}>₹{Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="print-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: '0.3rem' }}>
                  <span style={{ color: '#555' }}>Discount:</span>
                  <span style={{ fontWeight: 'bold', color: '#dc2626' }}>-₹{Number(discountAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="print-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: '0.3rem' }}>
                  <span style={{ color: '#555' }}>Taxable Value:</span>
                  <span style={{ fontWeight: 'bold' }}>₹{Number(taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                
                {hasCgst ? (
                  <>
                    <div className="print-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: '0.3rem' }}>
                      <span style={{ color: '#555' }}>Add: CGST ({pi.cgst_percent}%):</span>
                      <span style={{ fontWeight: 'bold' }}>₹{Number(cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="print-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: '0.3rem' }}>
                      <span style={{ color: '#555' }}>Add: SGST ({pi.sgst_percent}%):</span>
                      <span style={{ fontWeight: 'bold' }}>₹{Number(sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                ) : (
                  <div className="print-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: '0.3rem' }}>
                    <span style={{ color: '#555' }}>Add: IGST ({pi.igst_percent}%):</span>
                    <span style={{ fontWeight: 'bold' }}>₹{Number(igstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                
                <div className="print-summary-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #000', paddingBottom: '0.35rem' }}>
                  <span style={{ color: '#555' }}>Total Tax Amount (GST):</span>
                  <span style={{ fontWeight: 'bold' }}>₹{Number(totalGstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="print-total-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2.5px solid #000', paddingBottom: '0.4rem', fontSize: '1.05rem' }}>
                  <span style={{ color: '#800000', fontWeight: '900' }}>Total Amount After Tax:</span>
                  <span style={{ fontWeight: '950', color: '#800000' }}>₹{Number(totalInvoicePrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="print-signature-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: '1.5rem' }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.78rem' }}>For ASHOK TEXTILES,</p>
                  <div className="print-signature-space" style={{ height: '45px' }} />
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '0.78rem', borderTop: '1px dashed #000', width: '160px', textAlign: 'center', paddingTop: '4px' }}>
                    Authorised Signatory
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 10mm 6mm 10mm;
          }
          html, body {
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          .print-modal-overlay, .print-modal-overlay * {
            visibility: visible !important;
          }
          .print-modal-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            min-height: 100% !important;
            height: 100% !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-container {
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 100% !important;
            height: 100% !important;
            border-radius: 0 !important;
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-body, .print-pi-document {
            padding: 0 !important;
            margin: 0 !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
            color: #000 !important;
            background: #fff !important;
            box-sizing: border-box !important;
            height: 275mm !important;
            min-height: 275mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .print-top-section {
            flex: 1 0 auto !important;
          }
          .print-bottom-section {
            flex: 0 0 auto !important;
            margin-top: auto !important;
          }
          .print-header {
            margin-bottom: 0.6rem !important;
            padding-bottom: 0.5rem !important;
            border-bottom: 2px solid #000 !important;
          }
          .print-header img {
            max-height: 52px !important;
          }
          .print-header h1 {
            font-size: 1.5rem !important;
            margin-bottom: 0.1rem !important;
          }
          .print-header h2 {
            font-size: 1.2rem !important;
            margin-bottom: 0.1rem !important;
          }
          .print-header p {
            font-size: 0.75rem !important;
            margin-bottom: 0.05rem !important;
          }
          .print-meta-grid {
            margin-bottom: 0.6rem !important;
            padding-bottom: 0.5rem !important;
            gap: 0.75rem !important;
            font-size: 0.8rem !important;
            border-bottom: 1px solid #000 !important;
          }
          .print-meta-grid p {
            margin-bottom: 0.15rem !important;
          }
          .print-address-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 1rem !important;
            width: 100% !important;
            margin-bottom: 0.6rem !important;
            padding-bottom: 0 !important;
            border-bottom: none !important;
          }
          .print-address-box {
            border: 1.5px solid #000 !important;
            border-radius: 4px !important;
            padding: 0.45rem 0.65rem !important;
            background-color: #fff !important;
            box-sizing: border-box !important;
          }
          .print-address-box h4 {
            font-size: 0.75rem !important;
            margin-bottom: 0.2rem !important;
          }
          .print-address-box p {
            font-size: 0.75rem !important;
            margin-bottom: 0.15rem !important;
          }
          .print-table-title {
            font-size: 0.8rem !important;
            margin-bottom: 0.3rem !important;
          }
          .print-table {
            margin-bottom: 0.75rem !important;
            font-size: 10.5px !important;
          }
          .print-table th, .print-table td {
            padding: 0.4rem 0.35rem !important;
            line-height: 1.3 !important;
          }
          .print-bottom-grid {
            margin-top: 0.5rem !important;
            gap: 1.25rem !important;
            font-size: 0.78rem !important;
          }
          .print-bottom-grid p {
            margin-bottom: 0.2rem !important;
          }
          .print-amount-words {
            font-size: 0.8rem !important;
            margin-bottom: 0.5rem !important;
            padding-bottom: 0.3rem !important;
          }
          .print-bank-details {
            padding: 0.5rem !important;
            margin-bottom: 0.5rem !important;
            font-size: 9.5px !important;
            line-height: 1.3 !important;
          }
          .print-terms-conditions {
            padding: 0.5rem !important;
            margin-top: 0.4rem !important;
            font-size: 9px !important;
            line-height: 1.3 !important;
          }
          .print-summary-row {
            padding-bottom: 0.25rem !important;
            font-size: 0.78rem !important;
          }
          .print-total-row {
            padding-bottom: 0.35rem !important;
            font-size: 0.95rem !important;
          }
          .print-signature-section {
            margin-top: 1.25rem !important;
          }
          .print-signature-space {
            height: 40px !important;
          }
        }
      `}</style>
    </div>
  );
}
