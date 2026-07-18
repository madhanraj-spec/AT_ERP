import React, { useState, useEffect } from 'react';
import { Loader, ChevronDown, ChevronRight, FileText, Package, Layers, Printer } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Helper for formatting date
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Helper for formatting numbers
const fmtNum = (num, decimals = 2) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

// Number to words helper (Indian Numbering System)
const numberToWords = (num) => {
  if (num === null || num === undefined || isNaN(num)) return 'Zero';
  const parts = parseFloat(num).toFixed(2).split('.');
  const wholeNumber = parseInt(parts[0], 10);
  const decimalNumber = parseInt(parts[1], 10);

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertGroup = (n) => {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + ' ';
    }
    return str.trim();
  };

  const convertIndian = (n) => {
    if (n === 0) return 'Zero';
    let str = '';

    if (n >= 10000000) {
      str += convertGroup(Math.floor(n / 10000000)) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      str += convertGroup(Math.floor(n / 100000)) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      str += convertGroup(Math.floor(n / 1000)) + ' Thousand ';
      n %= 1000;
    }
    if (n > 0) {
      str += convertGroup(n);
    }
    return str.trim();
  };

  let word = convertIndian(wholeNumber);
  if (decimalNumber > 0) {
    word += ' And ' + convertGroup(decimalNumber) + ' Paise';
  } else {
    word += ' And Zero Paise';
  }
  return word + ' Only';
};

export default function OrderDispatchTab({ order }) {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [slips, setSlips] = useState([]);
  const [expandedBills, setExpandedBills] = useState({});
  const [expandedSlips, setExpandedSlips] = useState({});

  // Printing states
  const [printType, setPrintType] = useState(null);
  const [printData, setPrintData] = useState(null);

  useEffect(() => {
    const fetchDispatchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch package slips for this order
        const { data: slipsData, error: slipsErr } = await supabase
          .from('dispatch_package_slips')
          .select('*')
          .eq('order_id', order.id)
          .order('slip_date', { ascending: false });

        if (slipsErr) throw slipsErr;
        setSlips(slipsData || []);

        // 2. Fetch bills that include this order
        const { data: billsData, error: billsErr } = await supabase
          .from('dispatch_bills')
          .select(`
            *,
            buyer:master_brands(id, brand_name)
          `)
          .order('bill_date', { ascending: false });

        if (billsErr) throw billsErr;

        // Filter bills where this order is in the primary order_id or items array
        const orderBills = (billsData || []).filter(b => 
          b.order_id === order.id || 
          (Array.isArray(b.items) && b.items.some(item => item.order_id === order.id))
        );

        setBills(orderBills);
      } catch (err) {
        console.error("Error loading order dispatch data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDispatchData();
  }, [order.id]);

  const toggleBill = (billId) => {
    setExpandedBills(prev => ({ ...prev, [billId]: !prev[billId] }));
  };

  const toggleSlip = (slipId) => {
    setExpandedSlips(prev => ({ ...prev, [slipId]: !prev[slipId] }));
  };

  // Helper to enrich a bill with order/PI/PO numbers from database
  const enrichBillWithOrders = async (bill) => {
    if (!bill || !bill.items) return bill;
    const orderIds = (bill.items || []).map(i => i.order_id).filter(Boolean);
    if (orderIds.length > 0) {
      try {
        const { data: ords } = await supabase
          .from('orders')
          .select(`
            id,
            buyer_po_number,
            proforma_invoices(invoice_number)
          `)
          .in('id', orderIds);

        if (ords) {
          bill.items = bill.items.map(item => {
            const match = ords.find(o => o.id === item.order_id);
            return {
              ...item,
              po_number: item.po_number || match?.buyer_po_number || '—',
              pi_number: item.pi_number || match?.proforma_invoices?.[0]?.invoice_number || '—'
            };
          });
        }
      } catch (err) {
        console.error("Error enriching bill with orders:", err);
      }
    }
    return bill;
  };

  const handlePrintInvoice = async (bill) => {
    const enriched = await enrichBillWithOrders(bill);
    setPrintType('invoice');
    setPrintData(enriched);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintPackingList = async (bill) => {
    const enriched = await enrichBillWithOrders(bill);
    setPrintType('packing_list');
    setPrintData(enriched);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Calculate summary metrics
  const totalOrderQty = Number(order.total_quantity || 0);

  const totalBilledQty = bills.reduce((sum, b) => {
    const matchingItem = b.items?.find(i => i.order_id === order.id);
    return sum + Number(matchingItem?.qty || 0);
  }, 0);

  const totalPackedQty = slips.reduce((sum, s) => sum + Number(s.total_qty || 0), 0);
  const totalPackedRolls = slips.reduce((sum, s) => sum + Number(s.total_rolls || 0), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <div>
      <h4 style={{ margin: '0 0 1rem 0', fontWeight: '800', fontSize: '0.95rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <FileText size={18} /> Dispatch & Billing Details
      </h4>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#f8fafc', border: '1px solid var(--border-current)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Order Quantity</div>
          <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--text-current)' }}>
            {fmtNum(totalOrderQty)} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>Mtrs</span>
          </div>
        </div>

        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.65rem', color: '#047857', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Packed Quantity</div>
          <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#065f46' }}>
            {fmtNum(totalPackedQty)} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#047857' }}>Mtrs</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#047857', marginTop: '2px', fontWeight: '600' }}>
            Total Rolls: {totalPackedRolls}
          </div>
        </div>

        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.65rem', color: '#1d4ed8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Billed Quantity</div>
          <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#1e3a8a' }}>
            {fmtNum(totalBilledQty)} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1d4ed8' }}>Mtrs</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: '#1d4ed8', marginTop: '2px', fontWeight: '600' }}>
            Pending Bill: {fmtNum(Math.max(0, totalOrderQty - totalBilledQty))} Mtrs
          </div>
        </div>
      </div>

      {/* Bills Accordion List */}
      <div>
        <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontSize: '0.85rem', fontWeight: '800' }}>
          Bills and Invoices ({bills.length})
        </h5>

        {bills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--border-current)', borderRadius: '12px', background: 'white' }}>
            <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>No bills or invoices have been created for this order yet.</p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-current)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border-current)' }}>
                  <th style={{ width: '40px' }}></th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800' }}>Invoice No</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800' }}>Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800' }}>Billed To</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>Billed Qty (Mtr)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>Rolls</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>Net Amount</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '800', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(b => {
                  const isExpanded = !!expandedBills[b.id];
                  const matchingItem = b.items?.find(i => i.order_id === order.id);
                  if (!matchingItem) return null;

                  // Find slips that are linked to this order and included in this bill
                  const billSlips = matchingItem.slips || [];
                  const rollsCount = billSlips.reduce((sum, s) => sum + Number(s.total_rolls || 0), 0);

                  return (
                    <React.Fragment key={b.id}>
                      <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                        <td 
                          style={{ textAlign: 'center', cursor: 'pointer', color: 'var(--color-primary)' }} 
                          onClick={() => toggleBill(b.id)}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </td>
                        <td style={{ padding: '0.75rem', fontWeight: '700', fontFamily: 'monospace' }}>{b.bill_number}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDate(b.bill_date)}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {b.buyer?.brand_name || b.billed_to_address?.split('\n')[0] || '—'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(matchingItem.qty)} m</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{rollsCount} rolls</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>
                          ₹{fmtNum(matchingItem.total_amount || matchingItem.total)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePrintInvoice(b); }}
                              title="Print Tax Invoice"
                              style={{ padding: '0.4rem', background: '#eff6ff', border: 'none', borderRadius: '6px', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePrintPackingList(b); }}
                              title="Print Detailed Packing List"
                              style={{ padding: '0.4rem', background: '#ecfdf5', border: 'none', borderRadius: '6px', color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Package size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Level 1 Expanded Content (Package Slips) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} style={{ background: '#f8fafc', padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: '1.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                <Package size={14} style={{ color: 'var(--color-primary)' }} />
                                <span style={{ fontWeight: '800', fontSize: '0.75rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Linked Package Slips ({billSlips.length})
                                </span>
                              </div>

                              {billSlips.length === 0 ? (
                                <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '0.5rem 0' }}>
                                  No package slips linked to this bill for this order.
                                </div>
                              ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                  <thead>
                                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                      <th style={{ width: '30px' }}></th>
                                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '700' }}>Slip Number</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '700' }}>Date</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>No of Rolls</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>Total Meters</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>Total Weight</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {billSlips.map(s => {
                                      // Get fully loaded slip details (to retrieve rolls list)
                                      const fullSlip = slips.find(fs => fs.slip_number === s.slip_number);
                                      const slipId = fullSlip?.id || s.slip_number;
                                      const isSlipExpanded = !!expandedSlips[slipId];
                                      const slipDateVal = fullSlip?.slip_date || '—';

                                      return (
                                        <React.Fragment key={s.slip_number}>
                                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td 
                                              style={{ textAlign: 'center', cursor: 'pointer', color: '#10b981' }} 
                                              onClick={() => toggleSlip(slipId)}
                                            >
                                              {isSlipExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </td>
                                            <td style={{ padding: '0.5rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{s.slip_number}</td>
                                            <td style={{ padding: '0.5rem' }}>{slipDateVal !== '—' ? formatDate(slipDateVal) : '—'}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{s.total_rolls} rolls</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{fmtNum(s.total_qty)} m</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{fmtNum(s.total_weight, 3)} kg</td>
                                          </tr>

                                          {/* Level 2 Expanded Content (Rolls List) */}
                                          {isSlipExpanded && (
                                            <tr>
                                              <td colSpan={6} style={{ background: '#fcfcfc', padding: '0.5rem 1rem 0.5rem 2rem' }}>
                                                <div style={{ borderLeft: '2.5px solid #10b981', paddingLeft: '1rem' }}>
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                                                    <Layers size={12} style={{ color: '#10b981' }} />
                                                    <span style={{ fontWeight: '800', fontSize: '0.7rem', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                      Rolls Breakdown ({(fullSlip?.items || []).length})
                                                    </span>
                                                  </div>

                                                  {(!fullSlip || !Array.isArray(fullSlip.items) || fullSlip.items.length === 0) ? (
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', padding: '0.25rem 0' }}>
                                                      No individual roll details available for this package slip.
                                                    </div>
                                                  ) : (
                                                    <table style={{ width: '100%', maxWidth: '500px', borderCollapse: 'collapse', fontSize: '0.7rem', background: 'white', border: '1px solid #e2e8f0' }}>
                                                      <thead>
                                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                                                          <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: '600' }}>S.No</th>
                                                          <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', fontWeight: '600' }}>Roll ID</th>
                                                          <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: '600' }}>Quantity (m)</th>
                                                          <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: '600' }}>Weight (kg)</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {fullSlip.items.map((roll, idx) => (
                                                          <tr key={roll.roll_id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '0.3rem 0.5rem', color: '#94a3b8' }}>{idx + 1}</td>
                                                            <td style={{ padding: '0.3rem 0.5rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{roll.roll_id}</td>
                                                            <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>{fmtNum(roll.qty || roll.qty_meters)} m</td>
                                                            <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: 'bold' }}>{fmtNum(roll.weight, 3)} kg</td>
                                                          </tr>
                                                        ))}
                                                      </tbody>
                                                    </table>
                                                  )}
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* ─── Printable Elements (Hidden via screen layout) ─── */}
      {/* ──────────────────────────────────────────────────────── */}

      {/* 1. Print Tax Invoice */}
      {printType === 'invoice' && printData && (
        <div className="print-only-container" style={{ display: 'none' }}>
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 4mm; }
              body { margin: 0; padding: 0; background: white; color: black; -webkit-print-color-adjust: exact; }
              body * { visibility: hidden; }
              .print-only-container, .print-only-container * { visibility: visible; }
              .print-only-container { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
            }
          `}</style>

          <div style={{ padding: '4mm', fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>
            <div style={{ border: '1.5px solid black', borderRadius: '4px', padding: '4mm', minHeight: '276mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
              <div>
                {/* Logo & Company info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '2px solid black', paddingBottom: '4mm', marginBottom: '4mm', gap: '6mm' }}>
                  {/* Left: Company name + address */}
                  <div style={{ alignSelf: 'center' }}>
                    <h1 style={{ margin: '0 0 3px 0', fontSize: '22px', fontWeight: '950', letterSpacing: '0.5px' }}>ASHOK TEXTILES</h1>
                    <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33</p>
                    <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}><strong>GSTIN:</strong> 33AAZFA60686D1Z6 | <strong>PAN:</strong> AAZFA6086D</p>
                    <p style={{ margin: 0, fontSize: '11px' }}><strong>Mob:</strong> 9366655050 | <strong>Email:</strong> srini@ashoktextiles.com</p>
                  </div>

                  {/* Centre: Big logo */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <img src="/logo.png" alt="AT Logo" style={{ width: '150px', height: '150px', objectFit: 'contain' }} />
                  </div>

                  {/* Right: Document title */}
                  <div style={{ textAlign: 'right', alignSelf: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '0.5px' }}>TAX INVOICE</h2>
                    <span style={{ fontSize: '10px', border: '1px solid black', padding: '2px 5px', borderRadius: '3px', display: 'inline-block', marginTop: '2mm', fontWeight: 'bold' }}>ORIGINAL FOR RECIPIENT</span>
                  </div>
                </div>

                {/* Sender/receiver boxes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4mm', borderBottom: '1px solid black', paddingBottom: '3mm', marginBottom: '3mm' }}>
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontSize: '10px', textTransform: 'uppercase', color: '#555', fontWeight: 'bold' }}>Details of Receiver (Billed to)</h4>
                    <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '11px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>{printData.billed_to_address}</pre>
                  </div>
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', display: 'flex', flexDirection: 'column', gap: '1px', fontSize: '11px' }}>
                    <div><strong>Invoice No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px' }}>{printData.bill_number}</span></div>
                    <div><strong>Invoice Date:</strong> {formatDate(printData.bill_date)}</div>
                    <div><strong>Transport:</strong> {printData.transport_name || '—'}</div>
                    <div><strong>L.R. No & Date:</strong> {printData.lr_no || '—'} {printData.lr_date ? `/ ${formatDate(printData.lr_date)}` : ''}</div>
                    <div><strong>Vehicle No & Type:</strong> {printData.vehicle_number || '—'} ({printData.vehicle_type || '—'})</div>
                    <div><strong>Freight Mode:</strong> {printData.transport_mode || '—'} ({printData.freight_type || '—'})</div>
                    <div><strong>No of Bales:</strong> {printData.package_slip_ids?.length || 0} Package Slip(s)</div>
                  </div>
                </div>

                {/* Shipped to address */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', borderBottom: '1px solid black', paddingBottom: '3mm', marginBottom: '3mm' }}>
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontSize: '10px', textTransform: 'uppercase', color: '#555', fontWeight: 'bold' }}>Details of Consignee (Shipped to)</h4>
                    <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '11px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>{printData.shipped_to_address || printData.billed_to_address}</pre>
                  </div>
                </div>

                {/* Main Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '4mm' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderTop: '1px solid black', borderBottom: '1px solid black' }}>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'center', width: '30px' }}>Sr No</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'left' }}>Description of Goods</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'center', width: '65px' }}>HSN Code</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '70px' }}>Qty (METER)</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '65px' }}>Rate</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '85px' }}>Taxable Amt</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'left', width: '130px' }}>Tax breakdown</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printData.items || []).map((item, idx) => {
                      const cg = parseFloat(item.cgst_amount || 0);
                      const sg = parseFloat(item.sgst_amount || 0);
                      const ig = parseFloat(item.igst_amount || 0);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                          <td style={{ border: '1px solid black', padding: '2mm 1.5mm', textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid black', padding: '2mm 1.5mm', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 'bold' }}>Order No: {item.order_number}</div>
                            <div style={{ fontSize: '10px', color: '#333' }}>
                              {item.design_no} - {item.design_name} | {item.count} | Construction: {item.construction} | Width: {item.width}"
                            </div>
                            {item.slips?.length > 0 && (
                              <div style={{ fontSize: '9px', color: '#555', marginTop: '1mm', fontFamily: 'monospace', lineHeight: '1.2' }}>
                                Slips: {item.slips.map(s => `${s.slip_number} (${s.total_rolls}r, ${fmtNum(s.total_qty)}m)`).join(', ')}
                              </div>
                            )}
                          </td>
                          <td style={{ border: '1px solid black', padding: '2mm 1.5mm', textAlign: 'center', verticalAlign: 'top' }}>{item.hsn_code || '5208'}</td>
                          <td style={{ border: '1px solid black', padding: '2mm 1.5mm', textAlign: 'right', fontFamily: 'monospace', verticalAlign: 'top' }}>{fmtNum(item.qty)}</td>
                          <td style={{ border: '1px solid black', padding: '2mm 1.5mm', textAlign: 'right', fontFamily: 'monospace', verticalAlign: 'top' }}>{fmtNum(item.rate)}</td>
                          <td style={{ border: '1px solid black', padding: '2mm 1.5mm', textAlign: 'right', fontFamily: 'monospace', verticalAlign: 'top' }}>₹{fmtNum(item.taxable_value)}</td>
                          <td style={{ border: '1px solid black', padding: '2mm 1.5mm', fontSize: '10px', verticalAlign: 'top' }}>
                            {cg > 0 && <div>CGST {item.cgst_percent}%: ₹{fmtNum(cg)}</div>}
                            {sg > 0 && <div>SGST {item.sgst_percent}%: ₹{fmtNum(sg)}</div>}
                            {ig > 0 && <div>IGST {item.igst_percent}%: ₹{fmtNum(ig)}</div>}
                            {cg === 0 && sg === 0 && ig === 0 && '—'}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ fontWeight: 'bold', background: '#fafafa' }}>
                      <td colSpan={3} style={{ border: '1px solid black', padding: '2mm', textAlign: 'right' }}>Total</td>
                      <td style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmtNum(printData.qty || (printData.items || []).reduce((sum, i) => sum + parseFloat(i.qty || 0), 0))}
                      </td>
                      <td style={{ border: '1px solid black', padding: '2mm' }}></td>
                      <td style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', fontFamily: 'monospace' }}>
                        ₹{fmtNum(printData.taxable_value || (printData.items || []).reduce((sum, i) => sum + parseFloat(i.taxable_value || 0), 0))}
                      </td>
                      <td style={{ border: '1px solid black', padding: '2mm', fontFamily: 'monospace' }}>
                        ₹{fmtNum(printData.total_gst_amount || (printData.items || []).reduce((sum, i) => sum + parseFloat(i.cgst_amount || 0) + parseFloat(i.sgst_amount || 0) + parseFloat(i.igst_amount || 0), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Amount in words */}
                <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', marginBottom: '4mm', fontSize: '11px' }}>
                  <strong>Amount (INR in words):</strong> {numberToWords(printData.total_bill_price)}
                </div>
              </div>

              {/* Bank and Summary blocks */}
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '4mm', marginBottom: '4mm' }}>
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10.5px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontWeight: 'bold', textTransform: 'uppercase', color: '#333' }}>Bank Details</h4>
                    <p style={{ margin: '0 0 1px 0' }}><strong>Bank Name:</strong> TAMILNAD MERCANTILE BANK</p>
                    <p style={{ margin: '0 0 1px 0' }}><strong>Branch:</strong> SHEVAPET, SALEM - 636002</p>
                    <p style={{ margin: '0 0 1px 0' }}><strong>A/C No:</strong> 028700150950232</p>
                    <p style={{ margin: 0 }}><strong>IFSC:</strong> TMBL0000028</p>
                  </div>

                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Gross Amount:</span>
                      <span style={{ fontFamily: 'monospace' }}>₹{fmtNum(printData.amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Discount Amount:</span>
                      <span style={{ fontFamily: 'monospace' }}>- ₹{fmtNum(printData.discount_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Taxable Value:</span>
                      <span style={{ fontFamily: 'monospace' }}>₹{fmtNum(printData.taxable_value)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>GST Amount:</span>
                      <span style={{ fontFamily: 'monospace' }}>+ ₹{fmtNum(printData.total_gst_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid black', paddingTop: '2px', fontWeight: 'bold', fontSize: '13px' }}>
                      <span>Net Amount:</span>
                      <span style={{ fontFamily: 'monospace' }}>₹{fmtNum(printData.total_bill_price)}</span>
                    </div>
                  </div>
                </div>

                {/* Terms and conditions signature blocks */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '4mm' }}>
                  <div style={{ fontSize: '10px', color: '#444' }}>
                    <h5 style={{ margin: '0 0 1mm 0', fontWeight: 'bold' }}>Terms & Conditions:</h5>
                    <ul style={{ margin: 0, paddingLeft: '4mm' }}>
                      <li>Interest Will Be Charged @ 24% on All OverDue Payments</li>
                      <li>All drafts And Remittances to be Made Payable At Salem</li>
                      <li>Any Complaints And Remarks Regarding the Goods Should be Informed With in 4 Days of Receipt Of The Goods</li>
                      <li>All Disputes Subject to salem Jurisdiction Only</li>
                    </ul>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', height: '18mm' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>For ASHOK TEXTILES</div>
                    <div style={{ borderTop: '1px dashed #777', width: '35mm', textAlign: 'center', fontSize: '10px', paddingTop: '1mm', color: '#555' }}>Authorised Signatory</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Print Detailed Packing List */}
      {printType === 'packing_list' && printData && (
        <div className="print-only-container" style={{ display: 'none' }}>
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 8mm; }
              body { margin: 0; padding: 0; background: white; color: black; -webkit-print-color-adjust: exact; }
              body * { visibility: hidden; }
              .print-only-container, .print-only-container * { visibility: visible; }
              .print-only-container { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
              .page-break { page-break-before: always; break-before: page; }
            }
          `}</style>

          <div style={{ padding: '2mm', fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>
            {(printData.items || []).map((item, itemIdx) => {
              const slips = item.slips || [];
              const totalRolls = slips.reduce((sum, s) => sum + parseInt(s.total_rolls || 0), 0);
              const totalQty = slips.reduce((sum, s) => sum + parseFloat(s.total_qty || 0), 0);
              const totalWeight = slips.reduce((sum, s) => sum + parseFloat(s.total_weight || 0), 0);

              return (
                <div key={itemIdx} className={itemIdx > 0 ? "page-break" : ""} style={{ minHeight: '260mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: '10mm', boxSizing: 'border-box' }}>
                  <div>
                    {/* Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '2px solid black', paddingBottom: '4mm', marginBottom: '4mm', gap: '6mm' }}>
                      {/* Left: Company name + address */}
                      <div style={{ alignSelf: 'center' }}>
                        <h1 style={{ margin: '0 0 3px 0', fontSize: '22px', fontWeight: '950', letterSpacing: '0.5px' }}>ASHOK TEXTILES</h1>
                        <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33</p>
                        <p style={{ margin: 0, fontSize: '11px' }}><strong>GSTIN:</strong> 33AAZFA60686D1Z6</p>
                      </div>

                      {/* Centre: Big logo */}
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <img src="/logo.png" alt="AT Logo" style={{ width: '150px', height: '150px', objectFit: 'contain' }} />
                      </div>

                      {/* Right: Document title */}
                      <div style={{ textAlign: 'right', alignSelf: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>DETAILED PACKING LIST</h2>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '1mm' }}>
                          Page: {itemIdx + 1} / {printData.items.length}
                        </div>
                      </div>
                    </div>

                    {/* Address boxes */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4mm', marginBottom: '4mm', fontSize: '11px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2mm' }}>
                        <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm' }}>
                          <h4 style={{ margin: '0 0 1mm 0', fontSize: '10px', textTransform: 'uppercase', color: '#555', fontWeight: 'bold' }}>FROM</h4>
                          <p style={{ margin: 0, fontWeight: 'bold' }}>ASHOK TEXTILES</p>
                          <p style={{ margin: 0 }}>6/222, SALEM MAIN ROAD, VEERAPANDI POST</p>
                          <p style={{ margin: 0 }}>SALEM - 636308, TAMIL NADU</p>
                        </div>
                        <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm' }}>
                          <h4 style={{ margin: '0 0 1mm 0', fontSize: '10px', textTransform: 'uppercase', color: '#555', fontWeight: 'bold' }}>APPLICANT (BILLED TO)</h4>
                          <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: '1.2' }}>{printData.billed_to_address}</pre>
                        </div>
                        <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm' }}>
                          <h4 style={{ margin: '0 0 1mm 0', fontSize: '10px', textTransform: 'uppercase', color: '#555', fontWeight: 'bold' }}>FABRIC DESPATCH TO (SHIPPED TO)</h4>
                          <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: '1.2' }}>{printData.shipped_to_address || printData.billed_to_address}</pre>
                        </div>
                      </div>

                      <div style={{ border: '1px solid black', borderRadius: '4px', padding: '3mm', display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'space-between' }}>
                        <div><strong>INVOICE NO:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px' }}>{printData.bill_number}</span></div>
                        <div><strong>INVOICE DATE:</strong> {formatDate(printData.bill_date)}</div>
                        <div><strong>P.O. NUMBER:</strong> {item.po_number || printData.po_number || slips[0]?.po_number || '—'}</div>
                        <div><strong>P.I. NUMBER:</strong> {item.pi_number || printData.pi_numbers || slips[0]?.pi_numbers || '—'}</div>
                        <div style={{ borderTop: '1px solid #eee', paddingTop: '2px', marginTop: '2px' }}>
                          <div><strong>DES. NO:</strong> {item.design_no}</div>
                          <div><strong>PATTERN / COLOR:</strong> {item.design_name}</div>
                          <div><strong>COUNT:</strong> {item.count}</div>
                          <div><strong>CONSTRUCTION:</strong> {item.construction}</div>
                          <div><strong>WIDTH:</strong> {item.width}"</div>
                        </div>
                      </div>
                    </div>

                    {/* Fabrics declaration */}
                    <div style={{ background: '#f5f5f5', border: '1px solid black', borderRadius: '4px', padding: '1.5mm 2mm', marginBottom: '4mm', fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}>
                      100% COTTON YARN DYED WOVEN FABRICS
                    </div>

                    {/* Slips subtable */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '4mm' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5', borderTop: '1px solid black', borderBottom: '1px solid black' }}>
                          <th style={{ border: '1px solid black', padding: '2mm', textAlign: 'center', width: '50px' }}>S.No</th>
                          <th style={{ border: '1px solid black', padding: '2mm', textAlign: 'left' }}>Package Slip Number</th>
                          <th style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', width: '100px' }}>No of Rolls</th>
                          <th style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', width: '120px' }}>Total Meters</th>
                          <th style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', width: '120px' }}>Total Weight (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slips.map((slip, slipIdx) => (
                          <tr key={slipIdx} style={{ borderBottom: '1px solid #ccc' }}>
                            <td style={{ border: '1px solid black', padding: '2mm', textAlign: 'center' }}>{slipIdx + 1}</td>
                            <td style={{ border: '1px solid black', padding: '2mm', fontWeight: 'bold', fontFamily: 'monospace' }}>{slip.slip_number}</td>
                            <td style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', fontFamily: 'monospace' }}>{slip.total_rolls}</td>
                            <td style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(slip.total_qty)} m</td>
                            <td style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(slip.total_weight, 3)} kg</td>
                          </tr>
                        ))}
                        <tr style={{ fontWeight: 'bold', background: '#fafafa' }}>
                          <td colSpan={2} style={{ border: '1px solid black', padding: '2mm', textAlign: 'right' }}>Total</td>
                          <td style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', fontFamily: 'monospace' }}>{totalRolls}</td>
                          <td style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(totalQty)} m</td>
                          <td style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(totalWeight, 3)} kg</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Footer signature lines */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid black', paddingTop: '4mm' }}>
                    <div style={{ fontSize: '10px' }}>
                      <strong>Prepared By:</strong> _________________
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '11px' }}>
                      <strong>For ASHOK TEXTILES</strong>
                      <br /><br />
                      <span style={{ fontSize: '10px', color: '#555' }}>Authorised Signatory</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
