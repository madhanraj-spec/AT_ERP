import React, { useState, useEffect } from 'react';
import { Loader, ChevronDown, ChevronRight, FileText, Package, Layers, Printer, RefreshCw, XCircle, QrCode } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createEInvoice, cancelEInvoice } from '../../utils/whitebooks';
import QRCode from 'qrcode';

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
  const [expandedOrders, setExpandedOrders] = useState({});
  const [generatingEInvId, setGeneratingEInvId] = useState(null);

  // Printing states
  const [printType, setPrintType] = useState(null);
  const [printData, setPrintData] = useState(null);

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

      // Enrich bills with slips for nested display
      const enrichedBills = await Promise.all(orderBills.map(async (b) => {
        let slipsDataForBill = [];
        if (b.package_slip_ids && b.package_slip_ids.length > 0) {
          const { data: slipsForBill } = await supabase
            .from('dispatch_package_slips')
            .select('id, slip_number, order_id, total_rolls, total_qty, total_weight')
            .in('slip_number', b.package_slip_ids);
          slipsDataForBill = slipsForBill || [];
        }
        return { ...b, slips: slipsDataForBill };
      }));

      setBills(enrichedBills);
    } catch (err) {
      console.error("Error loading order dispatch data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchData();
  }, [order.id]);

  const toggleBill = (billId) => {
    setExpandedBills(prev => ({ ...prev, [billId]: !prev[billId] }));
  };

  const toggleSlip = (slipId) => {
    setExpandedSlips(prev => ({ ...prev, [slipId]: !prev[slipId] }));
  };

  const toggleOrder = (billId, orderId) => {
    const key = `${billId}-${orderId}`;
    setExpandedOrders(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper to enrich a bill with order/PI/PO numbers from database
  const enrichBillWithOrders = async (bill) => {
    if (!bill) return bill;

    // Fetch slips if missing
    if (bill.package_slip_ids && bill.package_slip_ids.length > 0 && (!bill.slips || bill.slips.length === 0)) {
      try {
        const { data: slipsForBill } = await supabase
          .from('dispatch_package_slips')
          .select('id, slip_number, order_id, total_rolls, total_qty, total_weight')
          .in('slip_number', bill.package_slip_ids);
        bill.slips = slipsForBill || [];
      } catch (err) {
        console.error("Error fetching slips for bill:", err);
      }
    }

    const calculatedWeight = (bill.slips || []).reduce((sum, s) => sum + parseFloat(s.total_weight || 0), 0);
    if (calculatedWeight > 0) {
      bill.total_weight = calculatedWeight;
    }

    if (bill.items && bill.items.length > 0) {
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
    }
    return bill;
  };

  const handleGenerateEInvoice = async (bill) => {
    try {
      setGeneratingEInvId(bill.id);
      const res = await createEInvoice(bill);
      if (res.success) {
        alert(`E-Invoice generated successfully!\nIRN: ${res.irn}`);
        await fetchDispatchData();
      } else {
        alert(`E-Invoice generation failed: ${res.error}`);
        await fetchDispatchData();
      }
    } catch (err) {
      alert(`Error generating E-Invoice: ${err.message}`);
    } finally {
      setGeneratingEInvId(null);
    }
  };

  const handleCancelEInvoice = async (bill) => {
    const reason = window.prompt("Enter reason for E-Invoice cancellation:", "Wrong entry");
    if (!reason) return;
    try {
      setGeneratingEInvId(bill.id);
      const res = await cancelEInvoice({
        billId: bill.id,
        irn: bill.einvoice_irn,
        cancelRsnCode: "1",
        cancelRmrk: reason
      });
      if (res.success) {
        alert("E-Invoice cancelled successfully!");
        await fetchDispatchData();
      } else {
        alert(`Cancellation failed: ${res.error}`);
        await fetchDispatchData();
      }
    } catch (err) {
      alert(`Error cancelling E-Invoice: ${err.message}`);
    } finally {
      setGeneratingEInvId(null);
    }
  };

  const handlePrintInvoice = async (bill) => {
    const enriched = await enrichBillWithOrders(bill);
    setPrintType('invoice');
    setPrintData(enriched);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintEInvoiceDirectly = async (bill) => {
    const enriched = await enrichBillWithOrders(bill);
    let qrDataUrl = null;
    const qrText = enriched.einvoice_qr_code || enriched.einvoice_irn;
    if (qrText) {
      try {
        qrDataUrl = await QRCode.toDataURL(qrText, { width: 160, margin: 1 });
      } catch (e) {
        console.error("QR generation error:", e);
      }
    }
    setPrintType('einvoice');
    setPrintData({ ...enriched, einvoice_qr_url: qrDataUrl });
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
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '800', width: '110px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(b => {
                  const isExpanded = !!expandedBills[b.id];
                  const matchingItem = b.items?.find(i => i.order_id === order.id);
                  if (!matchingItem) return null;

                  const billSlips = b.slips || matchingItem.slips || [];
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
                          ₹{fmtNum(b.total_bill_price || matchingItem.total_amount || matchingItem.total)}
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

                      {/* Level 1 Expanded Content (Complete Bill Details: 4 Address Cards, E-Invoice, Transporter, Items & Slips) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} style={{ background: '#f8fafc', padding: '1.25rem 2rem', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                              {/* 1. 4 Address Cards Grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.8rem', background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div>
                                  <div style={{ fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em', marginBottom: '4px' }}>Billed From</div>
                                  <div style={{ fontWeight: '700', color: '#1e293b' }}>ASHOK TEXTILES</div>
                                  <div style={{ color: '#475569', fontSize: '0.75rem', lineHeight: '1.4' }}>
                                    6/222, SALEM MAIN ROAD, VEERAPANDI<br />
                                    SALEM, TAMIL NADU - 33<br />
                                    <strong>GSTIN:</strong> 33AAZFA6086D1Z6
                                  </div>
                                </div>

                                <div>
                                  <div style={{ fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em', marginBottom: '4px' }}>Billed To (Consignee)</div>
                                  <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: '#475569', fontSize: '0.75rem' }}>{b.billed_to_address || '—'}</pre>
                                </div>

                                <div>
                                  <div style={{ fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em', marginBottom: '4px' }}>Shipped From</div>
                                  <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: '#475569', fontSize: '0.75rem' }}>{b.shipped_from_address || '—'}</pre>
                                </div>

                                <div>
                                  <div style={{ fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em', marginBottom: '4px' }}>Shipped To</div>
                                  <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: '#475569', fontSize: '0.75rem' }}>{b.shipped_to_address || '—'}</pre>
                                </div>
                              </div>

                              {/* 2. Whitebooks E-Invoice Details Card */}
                              <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileText size={16} style={{ color: 'var(--color-primary)' }} />
                                    <span style={{ fontWeight: '800', fontSize: '0.82rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      Whitebooks E-Invoice Details
                                    </span>
                                    <span style={{
                                      padding: '0.2rem 0.6rem',
                                      borderRadius: '12px',
                                      fontSize: '0.7rem',
                                      fontWeight: '800',
                                      textTransform: 'uppercase',
                                      background: b.einvoice_status === 'generated' ? '#dcfce7' : b.einvoice_status === 'failed' ? '#fee2e2' : b.einvoice_status === 'cancelled' ? '#f3f4f6' : '#fff7ed',
                                      color: b.einvoice_status === 'generated' ? '#166534' : b.einvoice_status === 'failed' ? '#991b1b' : b.einvoice_status === 'cancelled' ? '#374151' : '#c2410c',
                                      border: `1px solid ${b.einvoice_status === 'generated' ? '#86efac' : b.einvoice_status === 'failed' ? '#fca5a5' : b.einvoice_status === 'cancelled' ? '#d1d5db' : '#ffedd5'}`
                                    }}>
                                      {b.einvoice_status || 'Pending'}
                                    </span>
                                  </div>

                                  {b.einvoice_status !== 'generated' ? (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        onClick={() => handleGenerateEInvoice(b)}
                                        disabled={generatingEInvId === b.id}
                                        style={{
                                          background: 'var(--color-primary)',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '6px',
                                          padding: '0.35rem 0.75rem',
                                          fontSize: '0.75rem',
                                          fontWeight: '700',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.35rem'
                                        }}
                                      >
                                        {generatingEInvId === b.id ? <Loader size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                        {b.einvoice_status === 'failed' ? 'Retry E-Invoice' : 'Generate E-Invoice'}
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        onClick={() => handlePrintEInvoiceDirectly(b)}
                                        style={{
                                          background: '#059669',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '6px',
                                          padding: '0.35rem 0.75rem',
                                          fontSize: '0.75rem',
                                          fontWeight: '700',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.35rem',
                                          boxShadow: '0 2px 4px rgba(5,150,105,0.2)'
                                        }}
                                      >
                                        <Printer size={13} />
                                        Print E-Invoice
                                      </button>
                                      <button
                                        onClick={() => handleCancelEInvoice(b)}
                                        disabled={generatingEInvId === b.id}
                                        style={{
                                          background: '#ef4444',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '6px',
                                          padding: '0.35rem 0.75rem',
                                          fontSize: '0.75rem',
                                          fontWeight: '700',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.35rem'
                                        }}
                                      >
                                        {generatingEInvId === b.id ? <Loader size={13} className="animate-spin" /> : <XCircle size={13} />}
                                        Cancel E-Invoice
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {b.einvoice_irn ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.78rem' }}>
                                    <div>
                                      <div style={{ color: 'var(--text-muted-current)', fontWeight: '600', fontSize: '0.7rem' }}>IRN Number</div>
                                      <div style={{ fontFamily: 'monospace', fontWeight: '700', wordBreak: 'break-all', color: '#1e293b' }}>{b.einvoice_irn}</div>
                                    </div>
                                    <div>
                                      <div style={{ color: 'var(--text-muted-current)', fontWeight: '600', fontSize: '0.7rem' }}>Ack Number</div>
                                      <div style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1e293b' }}>{b.einvoice_ack_no || '—'}</div>
                                    </div>
                                    <div>
                                      <div style={{ color: 'var(--text-muted-current)', fontWeight: '600', fontSize: '0.7rem' }}>Ack Date</div>
                                      <div style={{ color: '#1e293b' }}>{b.einvoice_ack_date ? formatDate(b.einvoice_ack_date) : '—'}</div>
                                    </div>
                                    {b.einvoice_qr_code && (
                                      <div>
                                        <div style={{ color: 'var(--text-muted-current)', fontWeight: '600', fontSize: '0.7rem' }}>QR Code Data</div>
                                        <div style={{ color: '#059669', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                          <QrCode size={14} /> Signed QR Present
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                                    {b.einvoice_error ? (
                                      <span style={{ color: '#dc2626', fontStyle: 'normal' }}>
                                        <strong>Error:</strong> {b.einvoice_error}
                                      </span>
                                    ) : (
                                      'No E-Invoice has been generated for this bill yet. Click "Generate E-Invoice" above to generate via Whitebooks API.'
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 3. Transporter details block */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', fontSize: '0.8rem', background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div><strong>Transport Name:</strong> {b.transport_name || '—'}</div>
                                <div><strong>Transport Mode:</strong> {b.transport_mode || '—'}</div>
                                <div><strong>Vehicle Number:</strong> {b.vehicle_number || '—'}</div>
                                <div><strong>Vehicle Type:</strong> {b.vehicle_type === 'R' ? 'Regular' : b.vehicle_type || '—'}</div>
                                <div><strong>Freight Type:</strong> {b.freight_type || '—'}</div>
                                <div><strong>LR Number:</strong> {b.lr_no || '—'}</div>
                                <div><strong>LR Date:</strong> {b.lr_date ? formatDate(b.lr_date) : '—'}</div>
                              </div>

                              {/* 4. Items & Price Breakdown Table with nested package slips */}
                              <div>
                                <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary)', fontSize: '0.82rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Items & Price Breakdown</h5>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', background: 'white', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                  <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                      <th style={{ width: '30px' }}></th>
                                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '700' }}>Order No</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '700' }}>Design Name & No</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: '700' }}>Count & Construction</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: '700' }}>HSN</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>Qty (m)</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>Rate (₹/m)</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>Taxable Amt</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>GST %</th>
                                      <th style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>Net Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(b.items || []).map((item, idx) => {
                                      const isOrderExpanded = !!expandedOrders[`${b.id}-${item.order_id}`];
                                      const matchingSlips = (b.slips || []).filter(s => s.order_id === item.order_id);

                                      return (
                                        <React.Fragment key={idx}>
                                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ textAlign: 'center', cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => toggleOrder(b.id, item.order_id)}>
                                              {isOrderExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </td>
                                            <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{item.order_number}</td>
                                            <td style={{ padding: '0.5rem' }}>{item.design_no ? `${item.design_no} (${item.design_name})` : item.design_name}</td>
                                            <td style={{ padding: '0.5rem' }}>{item.count} | {item.construction}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center', fontFamily: 'monospace' }}>{item.hsn_code || '520831'}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{fmtNum(item.qty)} m</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{fmtNum(item.rate)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{fmtNum(item.taxable_value)}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.igst_percent > 0 ? `IGST ${item.igst_percent}%` : `CGST ${item.cgst_percent}% + SGST ${item.sgst_percent}%`}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{fmtNum(item.total_amount || item.total)}</td>
                                          </tr>
                                          {isOrderExpanded && (
                                            <tr>
                                              <td colSpan={10} style={{ background: '#fcfcfc', padding: '0.5rem 1rem 0.5rem 2.5rem' }}>
                                                <div style={{ borderLeft: '2px solid #2563eb', paddingLeft: '1rem' }}>
                                                  <div style={{ fontWeight: 'bold', fontSize: '0.72rem', color: '#2563eb', textTransform: 'uppercase', marginBottom: '4px' }}>Linked Package Slips</div>
                                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', background: 'white', border: '1px solid #e2e8f0' }}>
                                                    <thead>
                                                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                        <th style={{ padding: '0.35rem', textAlign: 'left', fontWeight: '600' }}>Slip Number</th>
                                                        <th style={{ padding: '0.35rem', textAlign: 'right', fontWeight: '600' }}>No of Rolls</th>
                                                        <th style={{ padding: '0.35rem', textAlign: 'right', fontWeight: '600' }}>Total Meters</th>
                                                        <th style={{ padding: '0.35rem', textAlign: 'right', fontWeight: '600' }}>Total Weight</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {matchingSlips.length === 0 ? (
                                                        <tr>
                                                          <td colSpan={4} style={{ padding: '0.35rem', textAlign: 'center', color: '#94a3b8' }}>No package slip details found.</td>
                                                        </tr>
                                                      ) : (
                                                        matchingSlips.map((slip, slipIdx) => (
                                                          <tr key={slipIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '0.35rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{slip.slip_number}</td>
                                                            <td style={{ padding: '0.35rem', textAlign: 'right' }}>{slip.total_rolls} rolls</td>
                                                            <td style={{ padding: '0.35rem', textAlign: 'right' }}>{fmtNum(slip.total_qty)} m</td>
                                                            <td style={{ padding: '0.35rem', textAlign: 'right' }}>{fmtNum(slip.total_weight, 3)} kg</td>
                                                          </tr>
                                                        ))
                                                      )}
                                                    </tbody>
                                                  </table>
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

          <div style={{ padding: '4mm', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000' }}>
            <div style={{ border: '1.5px solid black', borderRadius: '4px', padding: '4mm', minHeight: '276mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
              <div>

                {/* Top Header: Logo (Left), Company Info (Middle Bold), Title (Right) */}
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px', alignItems: 'center', borderBottom: '2px solid black', paddingBottom: '3mm', marginBottom: '3mm', gap: '3mm' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                    <img 
                      src="/logo.png" 
                      alt="Company Logo" 
                      style={{ maxHeight: '55px', maxWidth: '100px', objectFit: 'contain' }} 
                      onError={(e) => { 
                        e.target.style.display = 'none'; 
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; 
                      }} 
                    />
                    <div style={{ display: 'none', width: '45px', height: '45px', background: '#800000', color: 'white', fontWeight: '900', borderRadius: '6px', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                      AT
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <h1 style={{ margin: '0 0 2px 0', fontSize: '19px', fontWeight: '900', color: 'black', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ASHOK TEXTILES
                    </h1>
                    <p style={{ margin: '0 0 2px 0', fontSize: '10px', fontWeight: 'bold' }}>
                      6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33
                    </p>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: 'bold' }}>
                      GSTIN: 33AAZFA6086D1Z6 | STATE: 33-TAMIL NADU
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      TAX INVOICE
                    </h2>
                    <span style={{ fontSize: '9px', border: '1px solid black', padding: '2px 5px', borderRadius: '3px', display: 'inline-block', marginTop: '2mm', fontWeight: 'bold', textTransform: 'uppercase', background: '#f8f8f8' }}>
                      ORIGINAL FOR RECIPIENT
                    </span>
                  </div>
                </div>

                {/* Details Grid: Receiver & Consignee (Left) vs Invoice Details (Right) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '3mm', borderBottom: '1px solid black', paddingBottom: '3mm', marginBottom: '3mm' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2mm' }}>
                    <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm' }}>
                      <h4 style={{ margin: '0 0 1mm 0', fontSize: '9.5px', textTransform: 'uppercase', color: '#000', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                        Details of Receiver (Billed to)
                      </h4>
                      <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '10.5px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                        {printData.billed_to_address}
                      </pre>
                    </div>

                    <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm' }}>
                      <h4 style={{ margin: '0 0 1mm 0', fontSize: '9.5px', textTransform: 'uppercase', color: '#000', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                        Details of Consignee (Shipped to)
                      </h4>
                      <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '10.5px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                        {printData.shipped_to_address || printData.billed_to_address}
                      </pre>
                    </div>
                  </div>

                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10.5px', background: '#fafafa' }}>
                    <div><strong>Invoice No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12.5px' }}>{printData.bill_number}</span></div>
                    <div><strong>Invoice Date:</strong> {formatDate(printData.bill_date)}</div>
                    <div><strong>Transport Name:</strong> {printData.transport_name || '—'}</div>
                    <div><strong>L.R. No & Date:</strong> {printData.lr_no || '—'} {printData.lr_date ? `/ ${formatDate(printData.lr_date)}` : ''}</div>
                    <div><strong>Vehicle No & Type:</strong> {printData.vehicle_number || '—'} {printData.vehicle_type ? `(${printData.vehicle_type})` : ''}</div>
                    <div><strong>Package Slip No:</strong> {(printData.package_slip_numbers || (printData.package_slip_ids || []).map(id => `#${id}`).join(', ')) || '—'}</div>
                    <div><strong>Total Package Slips:</strong> {printData.package_slip_ids?.length || 0} Slip(s)</div>
                    <div><strong>Freight Mode:</strong> {printData.transport_mode || '—'} {printData.freight_type ? `(${printData.freight_type})` : ''}</div>
                    <div>
                      <strong>Total Weight:</strong> {
                        (() => {
                          const calculatedWeight = (printData.slips || []).reduce((sum, s) => sum + parseFloat(s.total_weight || 0), 0) || parseFloat(printData.total_weight || 0);
                          return calculatedWeight > 0 ? `${fmtNum(calculatedWeight)} KGS` : '—';
                        })()
                      }
                    </div>
                  </div>
                </div>

                {/* Items & GST Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', marginBottom: '3mm' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderTop: '1.5px solid black', borderBottom: '1.5px solid black' }}>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'center', width: '28px' }}>S.No</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'left' }}>Description of Goods</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'center', width: '55px' }}>HSN Code</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '65px' }}>Quantity</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '55px' }}>Rate</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '65px' }}>CGST</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '65px' }}>SGST</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '65px' }}>IGST</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '75px' }}>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let calcTotalGst = 0;
                      let calcTotalNet = 0;
                      const taxableValSum = parseFloat(printData.taxable_value || 0) || (printData.items || []).reduce((sum, i) => sum + parseFloat(i.taxable_value || 0), 0);

                      const rows = (printData.items || []).map((item, idx) => {
                        const rawIg = parseFloat(item.igst_amount || 0);
                        const rawIgPct = parseFloat(item.igst_percent || 0);
                        const hasIgst = rawIg > 0 || rawIgPct > 0;

                        const cg = hasIgst ? 0 : parseFloat(item.cgst_amount || 0);
                        const sg = hasIgst ? 0 : parseFloat(item.sgst_amount || 0);
                        const ig = rawIg;

                        const cgPct = hasIgst ? 0 : (item.cgst_percent ?? (cg > 0 ? 2.5 : 0));
                        const sgPct = hasIgst ? 0 : (item.sgst_percent ?? (sg > 0 ? 2.5 : 0));
                        const igPct = item.igst_percent ?? (ig > 0 ? 5 : 0);

                        const itemTaxable = parseFloat(item.taxable_value || item.amount || 0);
                        const lineTotal = itemTaxable + cg + sg + ig;
                        calcTotalGst += (cg + sg + ig);

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                            <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                            <td style={{ border: '1px solid black', padding: '1.5mm', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 'bold' }}>Order No: {item.order_number || '—'}</div>
                              <div style={{ fontSize: '9.5px', color: '#111' }}>
                                {item.design_no ? `${item.design_no} - ` : ''}{item.design_name || item.construction || 'Textile Fabric'} 
                                {item.count ? ` | Count: ${item.count}` : ''}
                                {item.width ? ` | Width: ${item.width}"` : ''}
                              </div>
                              {item.slips?.length > 0 && (
                                <div style={{ fontSize: '8.5px', color: '#444', marginTop: '0.5mm', fontFamily: 'monospace' }}>
                                  Slips: {item.slips.map(s => `${s.slip_number} (${s.total_rolls}r, ${fmtNum(s.total_qty)}m)`).join(', ')}
                                </div>
                              )}
                            </td>
                            <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'center', fontFamily: 'monospace', verticalAlign: 'top' }}>{item.hsn_code || '5208'}</td>
                            <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace', verticalAlign: 'top' }}>{fmtNum(item.qty)} mtrs</td>
                            <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace', verticalAlign: 'top' }}>₹{fmtNum(item.rate)}</td>
                            <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace', fontSize: '9.5px', verticalAlign: 'top' }}>
                              {cg > 0 ? `${cgPct}%\n(₹${fmtNum(cg)})` : '—'}
                            </td>
                            <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace', fontSize: '9.5px', verticalAlign: 'top' }}>
                              {sg > 0 ? `${sgPct}%\n(₹${fmtNum(sg)})` : '—'}
                            </td>
                            <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace', fontSize: '9.5px', verticalAlign: 'top' }}>
                              {ig > 0 ? `${igPct}%\n(₹${fmtNum(ig)})` : '—'}
                            </td>
                            <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace', verticalAlign: 'top' }}>
                              ₹{fmtNum(lineTotal)}
                            </td>
                          </tr>
                        );
                      });

                      calcTotalNet = taxableValSum + calcTotalGst;

                      return (
                        <>
                          {rows}
                          <tr style={{ fontWeight: 'bold', background: '#fafafa' }}>
                            <td colSpan={3} style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right' }}>Total</td>
                            <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>
                              {fmtNum(printData.qty || (printData.items || []).reduce((sum, i) => sum + parseFloat(i.qty || 0), 0))} mtrs
                            </td>
                            <td style={{ border: '1px solid black', padding: '1.5mm' }}></td>
                            <td colSpan={3} style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>
                              GST: ₹{fmtNum(calcTotalGst)}
                            </td>
                            <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace', fontSize: '11px' }}>
                              ₹{fmtNum(calcTotalNet)}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>

                {/* Performa Invoice Reference Note */}
                <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', marginBottom: '4mm', fontSize: '10px', background: '#fafafa' }}>
                  <strong>Reference:</strong> As per our Performa Invoice No: <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{printData.pi_number || printData.bill_number?.replace('/INV/', '/PI/') || '—'}</span> {printData.pi_date ? ` dated ${formatDate(printData.pi_date)}` : ` dated ${formatDate(printData.bill_date)}`}
                </div>

                {/* Amount in Words */}
                <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', marginBottom: '4mm', marginTop: '2mm', fontSize: '10.5px' }}>
                  <strong>Amount in Words:</strong> {numberToWords(
                    (printData.items || []).some(i => (parseFloat(i.igst_amount || 0) > 0 || parseFloat(i.igst_percent || 0) > 0)) 
                      ? (parseFloat(printData.taxable_value || 0) + (printData.items || []).reduce((sum, i) => sum + parseFloat(i.igst_amount || 0), 0))
                      : printData.total_bill_price
                  )}
                </div>

              </div>

              {/* Bottom Section: Bank Details & Amount Summary placed directly above Terms & Conditions */}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '3mm' }}>
                {/* Bank Details & Calculation Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '3mm' }}>
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontWeight: 'bold', textTransform: 'uppercase', color: '#000', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                      Bank Details
                    </h4>
                    <p style={{ margin: '0 0 1px 0' }}><strong>Bank Name:</strong> TAMILNAD MERCANTILE BANK</p>
                    <p style={{ margin: '0 0 1px 0' }}><strong>Branch:</strong> SHEVAPET, SALEM - 636002</p>
                    <p style={{ margin: '0 0 1px 0' }}><strong>A/C No:</strong> 028700150950232</p>
                    <p style={{ margin: 0 }}><strong>IFSC:</strong> TMBL0000028</p>
                  </div>

                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10.5px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Gross Amount:</span>
                      <span style={{ fontFamily: 'monospace' }}>₹{fmtNum(printData.amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Discount Amount:</span>
                      <span style={{ fontFamily: 'monospace' }}>- ₹{fmtNum(printData.discount_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Taxable Amount:</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>₹{fmtNum(printData.taxable_value)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total Tax Amount:</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        + ₹{fmtNum(
                          (printData.items || []).some(i => (parseFloat(i.igst_amount || 0) > 0 || parseFloat(i.igst_percent || 0) > 0))
                            ? (printData.items || []).reduce((sum, i) => sum + parseFloat(i.igst_amount || 0), 0)
                            : (printData.total_gst_amount || 0)
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1.5px solid black', paddingTop: '2px', marginTop: '2px', fontWeight: 'bold', fontSize: '12px' }}>
                      <span>Total Net Amount:</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        ₹{fmtNum(
                          (printData.items || []).some(i => (parseFloat(i.igst_amount || 0) > 0 || parseFloat(i.igst_percent || 0) > 0))
                            ? (parseFloat(printData.taxable_value || 0) + (printData.items || []).reduce((sum, i) => sum + parseFloat(i.igst_amount || 0), 0))
                            : printData.total_bill_price
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '3mm', borderTop: '1px solid black', paddingTop: '2mm' }}>
                  <div style={{ fontSize: '9.5px', color: '#222' }}>
                    <h5 style={{ margin: '0 0 1mm 0', fontWeight: 'bold', fontSize: '10px' }}>Terms & Conditions:</h5>
                    <ul style={{ margin: 0, paddingLeft: '4mm', lineHeight: '1.3' }}>
                      <li>Interest Will Be Charged @ 24% on All OverDue Payments</li>
                      <li>All drafts And Remittances to be Made Payable At Salem</li>
                      <li>Any Complaints And Remarks Regarding the Goods Should be Informed With in 4 Days of Receipt Of The Goods</li>
                      <li>All Disputes Subject to salem Jurisdiction Only</li>
                    </ul>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', height: '22mm', textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold' }}>For ASHOK TEXTILES</div>
                    <div style={{ borderTop: '1px dashed #555', width: '40mm', textAlign: 'center', fontSize: '9.5px', paddingTop: '1mm', color: '#333' }}>
                      Authorised Signatory
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 2. Print E-Invoice */}
      {printType === 'einvoice' && printData && (
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

          <div style={{ padding: '4mm', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000' }}>
            <div style={{ border: '1.5px solid black', borderRadius: '4px', padding: '4mm', minHeight: '276mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
              <div>

                {/* E-Invoice Header Banner */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', alignItems: 'center', borderBottom: '2px solid black', paddingBottom: '3mm', marginBottom: '3mm', gap: '3mm' }}>
                  <div>
                    <h1 style={{ margin: '0 0 2px 0', fontSize: '18px', fontWeight: '900', color: 'black', textTransform: 'uppercase' }}>
                      e-Invoice Details
                    </h1>
                    <div style={{ fontSize: '9.5px', color: '#333' }}>
                      <strong>IRN:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', wordBreak: 'break-all' }}>{printData.einvoice_irn || '—'}</span>
                    </div>
                    <div style={{ fontSize: '9.5px', color: '#333', marginTop: '1px' }}>
                      <strong>Ack No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{printData.einvoice_ack_no || '—'}</span> | <strong>Ack Date:</strong> {printData.einvoice_ack_date ? formatDate(printData.einvoice_ack_date) : '—'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <h2 style={{ margin: '0 0 1px 0', fontSize: '15px', fontWeight: '900' }}>ASHOK TEXTILES</h2>
                    <p style={{ margin: 0, fontSize: '9.5px', fontWeight: 'bold' }}>GSTIN: 33AAZFA6086D1Z6</p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {printData.einvoice_qr_url ? (
                      <img src={printData.einvoice_qr_url} alt="E-Invoice QR" style={{ width: '75px', height: '75px', objectFit: 'contain', border: '1px solid #ccc', padding: '1px' }} />
                    ) : (
                      <div style={{ width: '75px', height: '75px', border: '1px dashed black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', textAlign: 'center' }}>
                        SIGNED QR
                      </div>
                    )}
                  </div>
                </div>

                {/* Invoice Document Meta Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2mm', border: '1px solid black', padding: '2mm', borderRadius: '4px', marginBottom: '3mm', fontSize: '10.5px', background: '#fff' }}>
                  <div><strong>Invoice Number:</strong><br /><span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px' }}>{printData.bill_number}</span></div>
                  <div><strong>Invoice Date:</strong><br /><span>{formatDate(printData.bill_date)}</span></div>
                  <div><strong>Transport Name:</strong><br /><span>{printData.transport_name || '—'}</span></div>
                  <div><strong>Vehicle & LR No:</strong><br /><span>{printData.vehicle_number || '—'} {printData.lr_no ? `/ LR: ${printData.lr_no}` : ''}</span></div>
                </div>

                {/* 4 Address Cards Grid (2x2) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginBottom: '3mm' }}>
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontSize: '9.5px', textTransform: 'uppercase', color: '#000', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                      1. Seller Details (SellerDtls)
                    </h4>
                    <div style={{ lineHeight: '1.3' }}>
                      <strong>ASHOK TEXTILES</strong><br />
                      6/222, SALEM MAIN ROAD, VEERAPANDI<br />
                      SALEM, TAMIL NADU - 33<br />
                      <strong>GSTIN:</strong> 33AAZFA6086D1Z6 (State Code: 33)
                    </div>
                  </div>

                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontSize: '9.5px', textTransform: 'uppercase', color: '#000', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                      2. Dispatched From Details (DispDtls)
                    </h4>
                    <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '10px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                      {printData.shipped_from_address || printData.billed_from_address || '6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33'}
                    </pre>
                  </div>

                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontSize: '9.5px', textTransform: 'uppercase', color: '#000', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                      3. Buyer Details (BuyerDtls / Billed To)
                    </h4>
                    <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '10px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                      {printData.billed_to_address}
                    </pre>
                  </div>

                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontSize: '9.5px', textTransform: 'uppercase', color: '#000', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                      4. Shipped To Details (ShipDtls)
                    </h4>
                    <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '10px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                      {printData.shipped_to_address || printData.billed_to_address}
                    </pre>
                  </div>
                </div>

                {/* Item List Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '3mm' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderTop: '1.5px solid black', borderBottom: '1.5px solid black' }}>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'center', width: '25px' }}>#</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'left' }}>Item Description</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'center', width: '55px' }}>HSN</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '60px' }}>Qty</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '55px' }}>Rate</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '75px' }}>Taxable Val</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '50px' }}>CGST</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '50px' }}>SGST</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '50px' }}>IGST</th>
                      <th style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', width: '75px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printData.items || []).map((item, idx) => {
                      const rawIg = parseFloat(item.igst_amount || 0);
                      const rawIgPct = parseFloat(item.igst_percent || 0);
                      const hasIgst = rawIg > 0 || rawIgPct > 0;

                      const cg = hasIgst ? 0 : parseFloat(item.cgst_amount || 0);
                      const sg = hasIgst ? 0 : parseFloat(item.sgst_amount || 0);
                      const ig = rawIg;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                          <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid black', padding: '1.5mm' }}>
                            <strong>{item.design_name || item.construction || 'Textile Fabric'}</strong>
                            <div style={{ fontSize: '9px', color: '#333' }}>Order No: {item.order_number || '—'}</div>
                          </td>
                          <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'center', fontFamily: 'monospace' }}>{item.hsn_code || '5208'}</td>
                          <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(item.qty)}</td>
                          <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(item.rate)}</td>
                          <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(item.taxable_value)}</td>
                          <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>{cg > 0 ? `₹${fmtNum(cg)}` : '—'}</td>
                          <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>{sg > 0 ? `₹${fmtNum(sg)}` : '—'}</td>
                          <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>{ig > 0 ? `₹${fmtNum(ig)}` : '—'}</td>
                          <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>₹{fmtNum(item.total_amount || item.total || item.taxable_value + cg + sg + ig)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ fontWeight: 'bold', background: '#fafafa' }}>
                      <td colSpan={3} style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right' }}>Grand Total</td>
                      <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(printData.qty || (printData.items || []).reduce((sum, i) => sum + parseFloat(i.qty || 0), 0))}</td>
                      <td style={{ border: '1px solid black', padding: '1.5mm' }}></td>
                      <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(printData.taxable_value)}</td>
                      <td colSpan={3} style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(printData.total_gst_amount)}</td>
                      <td style={{ border: '1px solid black', padding: '1.5mm', textAlign: 'right', fontFamily: 'monospace', fontSize: '11px' }}>₹{fmtNum(printData.total_bill_price)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Amount in words */}
                <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', marginBottom: '3mm', fontSize: '10.5px' }}>
                  <strong>Invoice Value in Words:</strong> {numberToWords(printData.total_bill_price)}
                </div>

              </div>

              {/* Bottom Signatory */}
              <div style={{ borderTop: '1px solid black', paddingTop: '2mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '9px', color: '#555' }}>
                  This is a Government Compliant E-Invoice generated via GST portal.<br />
                  IRN: {printData.einvoice_irn}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold' }}>For ASHOK TEXTILES</div>
                  <div style={{ marginTop: '10mm', borderTop: '1px dashed #555', width: '35mm', textAlign: 'center', fontSize: '9px', color: '#444' }}>
                    Authorised Signatory
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Print Detailed Packing List */}
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
              const slipsList = item.slips || [];
              const totalRolls = slipsList.reduce((sum, s) => sum + parseInt(s.total_rolls || 0), 0);
              const totalQty = slipsList.reduce((sum, s) => sum + parseFloat(s.total_qty || 0), 0);
              const totalWeight = slipsList.reduce((sum, s) => sum + parseFloat(s.total_weight || 0), 0);

              return (
                <div key={itemIdx} className={itemIdx > 0 ? "page-break" : ""} style={{ minHeight: '260mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingBottom: '10mm', boxSizing: 'border-box' }}>
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', borderBottom: '2px solid black', paddingBottom: '4mm', marginBottom: '4mm', gap: '6mm' }}>
                      <div style={{ alignSelf: 'center' }}>
                        <h1 style={{ margin: '0 0 3px 0', fontSize: '22px', fontWeight: '950', letterSpacing: '0.5px' }}>ASHOK TEXTILES</h1>
                        <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33</p>
                        <p style={{ margin: 0, fontSize: '11px' }}><strong>GSTIN:</strong> 33AAZFA60686D1Z6</p>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <img src="/logo.png" alt="AT Logo" style={{ width: '150px', height: '150px', objectFit: 'contain' }} />
                      </div>

                      <div style={{ textAlign: 'right', alignSelf: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>DETAILED PACKING LIST</h2>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '1mm' }}>
                          Page: {itemIdx + 1} / {printData.items.length}
                        </div>
                      </div>
                    </div>

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
                        <div><strong>P.O. NUMBER:</strong> {item.po_number || printData.po_number || slipsList[0]?.po_number || '—'}</div>
                        <div><strong>P.I. NUMBER:</strong> {item.pi_number || printData.pi_numbers || slipsList[0]?.pi_numbers || '—'}</div>
                        <div style={{ borderTop: '1px solid #eee', paddingTop: '2px', marginTop: '2px' }}>
                          <div><strong>DES. NO:</strong> {item.design_no}</div>
                          <div><strong>PATTERN / COLOR:</strong> {item.design_name}</div>
                          <div><strong>COUNT:</strong> {item.count}</div>
                          <div><strong>CONSTRUCTION:</strong> {item.construction}</div>
                          <div><strong>WIDTH:</strong> {item.width}"</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#f5f5f5', border: '1px solid black', borderRadius: '4px', padding: '1.5mm 2mm', marginBottom: '4mm', fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}>
                      100% COTTON YARN DYED WOVEN FABRICS
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '4mm' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5', borderTop: '1.5px solid black', borderBottom: '1.5px solid black' }}>
                          <th style={{ border: '1px solid black', padding: '2mm', textAlign: 'center', width: '50px' }}>S.No</th>
                          <th style={{ border: '1px solid black', padding: '2mm', textAlign: 'left' }}>Package Slip Number</th>
                          <th style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', width: '100px' }}>No of Rolls</th>
                          <th style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', width: '120px' }}>Total Meters</th>
                          <th style={{ border: '1px solid black', padding: '2mm', textAlign: 'right', width: '120px' }}>Total Weight (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slipsList.map((slip, slipIdx) => (
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
