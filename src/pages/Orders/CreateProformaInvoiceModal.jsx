import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Search, Check, Plus, Trash2, FileText, ChevronRight, ArrowLeft } from 'lucide-react';

const getFiscalYear = (dateStr) => {
  const d = new Date(dateStr || Date.now());
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const startYr = month >= 4 ? year : year - 1;
  const endYr = startYr + 1;
  return `${String(startYr).substring(2)}-${String(endYr).substring(2)}`;
};

export default function CreateProformaInvoiceModal({ onClose, onSuccess, initialPi = null }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);

  // Form step
  const [step, setStep] = useState(1); // 1: Order selection, 2: Pricing & Party details

  // Order Search & Selection
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);

  // Invoice Header
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [buyerPoNumber, setBuyerPoNumber] = useState('');
  const [buyerPoDate, setBuyerPoDate] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  // Billed To & Shipped To
  const [billedToPartnerId, setBilledToPartnerId] = useState('');
  const [billedToName, setBilledToName] = useState('');
  const [billedToAddress, setBilledToAddress] = useState('');
  const [billedToGstin, setBilledToGstin] = useState('');
  const [billedToState, setBilledToState] = useState('');
  const [billedToStateCode, setBilledToStateCode] = useState('');

  const [shippedToPartnerId, setShippedToPartnerId] = useState('');
  const [shippedToName, setShippedToName] = useState('');
  const [shippedToAddress, setShippedToAddress] = useState('');
  const [shippedToGstin, setShippedToGstin] = useState('');
  const [shippedToState, setShippedToState] = useState('');
  const [shippedToStateCode, setShippedToStateCode] = useState('');

  // Tax state: GST Type & Percentage
  const [gstType, setGstType] = useState('CGST_SGST'); // 'CGST_SGST', 'IGST', or 'CUSTOM'
  const [gstRate, setGstRate] = useState(5); // Total GST Rate % (e.g. 5, 12, 18, 0)
  const [customCgstPercent, setCustomCgstPercent] = useState(0);
  const [customSgstPercent, setCustomSgstPercent] = useState(0);
  const [customIgstPercent, setCustomIgstPercent] = useState(0);

  // Terms
  const [transportMode, setTransportMode] = useState('By Road');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 Days');
  const [qualityTolerance, setQualityTolerance] = useState('+/- 5%');
  const [remarks, setRemarks] = useState('');
  const [bankDetails, setBankDetails] = useState(
    'Bank: TAMILNAD MERCANTILE BANK\nBranch: SHEVAPET, SALEM\nA/C No: 028700150950232\nIFSC: TMBL0000028'
  );

  // Per-Order Line Items Map: { [orderId]: { qty, rate, hsn, discount_percent } }
  const [itemConfigs, setItemConfigs] = useState({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Master Partners
      const { data: partnersData } = await supabase
        .from('master_partners')
        .select('*')
        .order('partner_name');
      setPartners(partnersData || []);

      // 2. Fetch Master Yarn Counts
      const { data: yarnData } = await supabase
        .from('master_yarn_counts')
        .select('*');
      setYarnCounts(yarnData || []);

      // 3. Fetch existing Proforma Invoices to identify used order IDs
      const { data: existingPis } = await supabase
        .from('proforma_invoices')
        .select('id, order_id, order_ids, items');

      const usedOrderIdsSet = new Set();
      (existingPis || []).forEach(pi => {
        // Exclude current PI being edited so its orders remain selectable
        if (initialPi && pi.id === initialPi.id) return;

        if (pi.order_id) usedOrderIdsSet.add(pi.order_id);
        if (Array.isArray(pi.order_ids)) {
          pi.order_ids.forEach(id => usedOrderIdsSet.add(id));
        }
        if (Array.isArray(pi.items)) {
          pi.items.forEach(it => {
            if (it.order_id) usedOrderIdsSet.add(it.order_id);
          });
        }
      });

      // 4. Fetch Orders (Role filtered: Merchandiser sees only their orders, Admin sees all)
      let orderQuery = supabase
        .from('orders')
        .select('*, vendor:master_partners(id, partner_name, address, gstin, state, state_code)')
        .order('created_at', { ascending: false });

      if (profile?.role === 'merchandiser') {
        orderQuery = orderQuery.eq('merchandiser_id', profile.id);
      }

      const { data: ordersData, error: orderErr } = await orderQuery;
      if (orderErr) throw orderErr;

      // Filter out orders that already have a PI created
      const availableOrders = (ordersData || []).filter(o => !usedOrderIdsSet.has(o.id));
      setOrders(availableOrders);

      // If initialPi passed (for editing)
      if (initialPi) {
        setInvoiceNumber(initialPi.invoice_number);
        setInvoiceDate(initialPi.invoice_date || new Date().toISOString().split('T')[0]);
        setBuyerPoNumber(initialPi.buyer_po_number || '');
        setBuyerPoDate(initialPi.buyer_po_date || '');
        setVehicleNumber(initialPi.vehicle_number || '');

        setBilledToPartnerId(initialPi.billed_to_partner_id || '');
        setBilledToName(initialPi.billed_to_name || '');
        setBilledToAddress(initialPi.billed_to_address || '');
        setBilledToGstin(initialPi.billed_to_gstin || '');
        setBilledToState(initialPi.billed_to_state || '');
        setBilledToStateCode(initialPi.billed_to_state_code || '');

        setShippedToPartnerId(initialPi.shipped_to_partner_id || '');
        setShippedToName(initialPi.shipped_to_name || '');
        setShippedToAddress(initialPi.shipped_to_address || '');
        setShippedToGstin(initialPi.shipped_to_gstin || '');
        setShippedToState(initialPi.shipped_to_state || '');
        setShippedToStateCode(initialPi.shipped_to_state_code || '');

        if (parseFloat(initialPi.igst_percent || 0) > 0) {
          setGstType('IGST');
          setGstRate(parseFloat(initialPi.igst_percent));
        } else if (parseFloat(initialPi.cgst_percent || 0) > 0 || parseFloat(initialPi.sgst_percent || 0) > 0) {
          setGstType('CGST_SGST');
          setGstRate(parseFloat(initialPi.cgst_percent || 0) + parseFloat(initialPi.sgst_percent || 0));
        } else if (initialPi.igst_amount === 0 && initialPi.cgst_amount === 0) {
          setGstType('CGST_SGST');
          setGstRate(0);
        }

        setTransportMode(initialPi.transport_mode || 'By Road');
        setDeliveryDate(initialPi.delivery_date || '');
        setPaymentTerms(initialPi.payment_terms || '30 Days');
        setQualityTolerance(initialPi.quality_tolerance || '+/- 5%');
        setRemarks(initialPi.remarks || '');
        if (initialPi.bank_details) setBankDetails(initialPi.bank_details);

        const loadedOrderIds = initialPi.order_ids || (initialPi.order_id ? [initialPi.order_id] : []);
        setSelectedOrderIds(loadedOrderIds);

        // Pre-fill item configs
        const configs = {};
        if (Array.isArray(initialPi.items) && initialPi.items.length > 0) {
          initialPi.items.forEach(it => {
            configs[it.order_id] = {
              qty: it.qty || 0,
              rate: it.rate || 0,
              hsn: it.hsn_code || '5208',
              discount_percent: it.discount_percent || 0,
              uom: it.uom || 'Meter'
            };
          });
        } else if (initialPi.order_id) {
          configs[initialPi.order_id] = {
            qty: initialPi.qty || 0,
            rate: initialPi.rate || 0,
            hsn: initialPi.hsn_code || '5208',
            discount_percent: initialPi.discount_percent || 0,
            uom: initialPi.uom || 'Meter'
          };
        }
        setItemConfigs(configs);
        setStep(2);
      } else {
        fetchNextInvoiceNumber(invoiceDate);
      }
    } catch (err) {
      console.error('Error initializing PI modal:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNextInvoiceNumber = async (selectedDate) => {
    const fyStr = getFiscalYear(selectedDate);
    try {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select('invoice_number')
        .like('invoice_number', `AT/${fyStr}/PI/%`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let nextNum = 1;
      if (data && data.length > 0) {
        let maxSeq = 0;
        data.forEach(item => {
          const parts = item.invoice_number.split('/');
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq) && lastSeq > maxSeq) {
            maxSeq = lastSeq;
          }
        });
        nextNum = maxSeq + 1;
      }

      const seqStr = String(nextNum).padStart(6, '0');
      setInvoiceNumber(`AT/${fyStr}/PI/${seqStr}`);
    } catch (err) {
      console.error("Error generating PI number:", err);
      setInvoiceNumber(`AT/${fyStr}/PI/000001`);
    }
  };

  const handleOrderToggle = (orderId) => {
    setSelectedOrderIds(prev => {
      let updated;
      if (prev.includes(orderId)) {
        updated = prev.filter(id => id !== orderId);
      } else {
        updated = [...prev, orderId];
      }

      // Initialize config for newly selected orders if missing
      const orderObj = orders.find(o => o.id === orderId);
      if (orderObj && !itemConfigs[orderId]) {
        const specs = orderObj.technical_specs || {};
        setItemConfigs(prevCfgs => ({
          ...prevCfgs,
          [orderId]: {
            qty: parseFloat(orderObj.total_quantity || 0),
            rate: parseFloat(specs.target_price || orderObj.target_price || 0),
            hsn: '5208',
            discount_percent: 0,
            uom: 'Meter'
          }
        }));
      }

      return updated;
    });
  };

  const handleItemChange = (orderId, field, val) => {
    setItemConfigs(prev => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || { qty: 0, rate: 0, hsn: '5208', discount_percent: 0, uom: 'Meter' }),
        [field]: val
      }
    }));
  };

  const handleBilledToChange = (partnerId) => {
    setBilledToPartnerId(partnerId);
    const partner = partners.find(p => p.id === partnerId);
    if (partner) {
      setBilledToName(partner.partner_name);
      setBilledToAddress(partner.address || '');
      setBilledToGstin(partner.gstin || '');
      setBilledToState(partner.state || '');
      setBilledToStateCode(partner.state_code || '');

      // Auto-set GST Type based on state
      const isIntraState = partner.state_code === '33' || partner.state?.toLowerCase() === 'tamil nadu' || partner.state?.toLowerCase() === 'tamilnadu';
      setGstType(isIntraState ? 'CGST_SGST' : 'IGST');
    }
  };

  const handleShippedToChange = (partnerId) => {
    setShippedToPartnerId(partnerId);
    const partner = partners.find(p => p.id === partnerId);
    if (partner) {
      setShippedToName(partner.partner_name);
      setShippedToAddress(partner.address || '');
      setShippedToGstin(partner.gstin || '');
      setShippedToState(partner.state || '');
      setShippedToStateCode(partner.state_code || '');
    }
  };

  // Filter partners to show ONLY Vendors in dropdowns
  const vendorPartners = partners.filter(p =>
    p.partner_type?.toLowerCase() === 'vendor' ||
    p.id === billedToPartnerId ||
    p.id === shippedToPartnerId
  );

  // Compute active GST Percentages
  let activeCgstPercent = 0;
  let activeSgstPercent = 0;
  let activeIgstPercent = 0;

  if (gstType === 'CGST_SGST') {
    activeCgstPercent = (parseFloat(gstRate) || 0) / 2;
    activeSgstPercent = (parseFloat(gstRate) || 0) / 2;
    activeIgstPercent = 0;
  } else if (gstType === 'IGST') {
    activeCgstPercent = 0;
    activeSgstPercent = 0;
    activeIgstPercent = parseFloat(gstRate) || 0;
  } else {
    activeCgstPercent = parseFloat(customCgstPercent) || 0;
    activeSgstPercent = parseFloat(customSgstPercent) || 0;
    activeIgstPercent = parseFloat(customIgstPercent) || 0;
  }

  // Selected Order Objects
  const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));

  // Compute Item Breakdowns
  const computedItems = selectedOrders.map(o => {
    const cfg = itemConfigs[o.id] || { qty: parseFloat(o.total_quantity || 0), rate: 0, hsn: '5208', discount_percent: 0, uom: 'Meter' };
    const q = parseFloat(cfg.qty) || 0;
    const r = parseFloat(cfg.rate) || 0;
    const discP = parseFloat(cfg.discount_percent) || 0;

    const amt = q * r;
    const discAmt = amt * (discP / 100);
    const taxableVal = amt - discAmt;

    const cgstAmt = taxableVal * (activeCgstPercent / 100);
    const sgstAmt = taxableVal * (activeSgstPercent / 100);
    const igstAmt = taxableVal * (activeIgstPercent / 100);
    const totalItemGst = cgstAmt + sgstAmt + igstAmt;
    const totalItemPrice = taxableVal + totalItemGst;

    return {
      order_id: o.id,
      order_number: o.order_number,
      design_no: o.design_no,
      design_name: o.design_name,
      qty: q,
      rate: r,
      uom: cfg.uom || 'Meter',
      hsn_code: cfg.hsn || '5208',
      discount_percent: discP,
      amount: amt,
      discount_amount: discAmt,
      taxable_value: taxableVal,
      cgst_percent: activeCgstPercent,
      cgst_amount: cgstAmt,
      sgst_percent: activeSgstPercent,
      sgst_amount: sgstAmt,
      igst_percent: activeIgstPercent,
      igst_amount: igstAmt,
      total_gst_amount: totalItemGst,
      total_amount: totalItemPrice
    };
  });

  // Aggregated Totals
  const totalQty = computedItems.reduce((acc, i) => acc + i.qty, 0);
  const totalAmount = computedItems.reduce((acc, i) => acc + i.amount, 0);
  const totalTaxable = computedItems.reduce((acc, i) => acc + i.taxable_value, 0);
  const totalCgst = computedItems.reduce((acc, i) => acc + i.cgst_amount, 0);
  const totalSgst = computedItems.reduce((acc, i) => acc + i.sgst_amount, 0);
  const totalIgst = computedItems.reduce((acc, i) => acc + i.igst_amount, 0);
  const totalGst = totalCgst + totalSgst + totalIgst;
  const totalInvoicePrice = totalTaxable + totalGst;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) {
      alert('Please select at least one order.');
      return;
    }
    if (!invoiceNumber) {
      alert('Invoice number is generating, please wait.');
      return;
    }
    if (!billedToName || !billedToGstin || !billedToState) {
      alert('Please fill in Billed To details completely (Name, GSTIN, State).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        order_id: selectedOrderIds[0] || null, // primary order ID for backward compatibility
        order_ids: selectedOrderIds,
        created_by: profile?.id || null,
        buyer_po_number: buyerPoNumber || null,
        buyer_po_date: buyerPoDate || null,
        vehicle_number: vehicleNumber || null,

        billed_to_partner_id: billedToPartnerId || null,
        billed_to_name: billedToName,
        billed_to_address: billedToAddress || null,
        billed_to_gstin: billedToGstin || null,
        billed_to_state: billedToState || null,
        billed_to_state_code: billedToStateCode || null,

        shipped_to_partner_id: shippedToPartnerId || null,
        shipped_to_name: shippedToName || billedToName,
        shipped_to_address: shippedToAddress || billedToAddress || null,
        shipped_to_gstin: shippedToGstin || billedToGstin || null,
        shipped_to_state: shippedToState || billedToState || null,
        shipped_to_state_code: shippedToStateCode || billedToStateCode || null,

        items: computedItems,

        hsn_code: computedItems[0]?.hsn_code || '5208',
        uom: computedItems[0]?.uom || 'Meter',
        qty: totalQty,
        rate: computedItems[0]?.rate || 0,
        amount: totalAmount,
        discount_percent: computedItems[0]?.discount_percent || 0,
        taxable_value: totalTaxable,

        cgst_percent: activeCgstPercent,
        cgst_amount: totalCgst,
        sgst_percent: activeSgstPercent,
        sgst_amount: totalSgst,
        igst_percent: activeIgstPercent,
        igst_amount: totalIgst,
        total_gst_amount: totalGst,
        total_invoice_price: totalInvoicePrice,

        transport_mode: transportMode || null,
        delivery_date: deliveryDate || null,
        payment_terms: paymentTerms || null,
        quality_tolerance: qualityTolerance || null,
        remarks: remarks || null,
        bank_details: bankDetails || null
      };

      let resErr;
      if (initialPi) {
        // Fallback safely if schema cache error happens by updating object without created_by if needed
        let updateRes = await supabase.from('proforma_invoices').update(payload).eq('id', initialPi.id);
        if (updateRes.error && updateRes.error.message.includes('created_by')) {
          delete payload.created_by;
          delete payload.order_ids;
          delete payload.items;
          updateRes = await supabase.from('proforma_invoices').update(payload).eq('id', initialPi.id);
        }
        resErr = updateRes.error;
      } else {
        let insertRes = await supabase.from('proforma_invoices').insert([payload]).select().single();
        if (insertRes.error && insertRes.error.message.includes('created_by')) {
          // Schema fallback if created_by column hasn't migrated yet
          delete payload.created_by;
          delete payload.order_ids;
          delete payload.items;
          insertRes = await supabase.from('proforma_invoices').insert([payload]).select().single();
        }
        resErr = insertRes.error;
      }

      if (resErr) throw resErr;

      alert(initialPi ? 'Proforma Invoice updated successfully!' : 'Proforma Invoice created successfully!');
      onSuccess();
    } catch (err) {
      console.error('Error saving Proforma Invoice:', err);
      alert('Error saving Proforma Invoice: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredOrdersList = orders.filter(o => {
    if (!orderSearch) return true;
    const term = orderSearch.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(term) ||
      o.design_no?.toLowerCase().includes(term) ||
      o.design_name?.toLowerCase().includes(term) ||
      o.buyer_po_number?.toLowerCase().includes(term) ||
      o.vendor?.partner_name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="modal-backdrop" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
    }}>
      <div className="modal-card fade-in" style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '1350px',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0 }}>
              {initialPi ? 'Edit Proforma Invoice' : 'Create New Proforma Invoice'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0' }}>
              PI Number: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{invoiceNumber || 'Generating...'}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Wizard Steps Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#ffffff', padding: '0.75rem 1.5rem', gap: '2rem' }}>
          <button
            onClick={() => setStep(1)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontWeight: step === 1 ? '700' : '500', color: step === 1 ? 'var(--color-primary)' : '#64748b', fontSize: '0.9rem'
            }}
          >
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', background: step === 1 ? 'var(--color-primary)' : '#e2e8f0',
              color: step === 1 ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold'
            }}>1</div>
            Select Orders ({selectedOrderIds.length})
          </button>

          <button
            onClick={() => {
              if (selectedOrderIds.length === 0) {
                alert('Please select at least one order first.');
                return;
              }
              setStep(2);
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontWeight: step === 2 ? '700' : '500', color: step === 2 ? 'var(--color-primary)' : '#64748b', fontSize: '0.9rem'
            }}
          >
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', background: step === 2 ? 'var(--color-primary)' : '#e2e8f0',
              color: step === 2 ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold'
            }}>2</div>
            Order Pricing & Billing Details
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {step === 1 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '800', margin: 0, color: '#1e293b' }}>
                    Select Orders for Proforma Invoice
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    {profile?.role === 'merchandiser'
                      ? 'Displaying orders created by you.'
                      : 'Displaying all active orders across merchandisers.'} Select single or multiple orders.
                  </p>
                </div>
                <div style={{ position: 'relative', minWidth: '280px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search by order no, design, buyer..."
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '0.45rem 0.75rem 0.45rem 2.2rem', borderRadius: '8px',
                      border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none'
                    }}
                  />
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading orders...</div>
              ) : filteredOrdersList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
                  No orders found.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: '700' }}>
                        <th style={{ padding: '0.75rem', width: '40px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={filteredOrdersList.length > 0 && filteredOrdersList.every(o => selectedOrderIds.includes(o.id))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrderIds(filteredOrdersList.map(o => o.id));
                              } else {
                                setSelectedOrderIds([]);
                              }
                            }}
                          />
                        </th>
                        <th style={{ padding: '0.75rem' }}>Order No</th>
                        <th style={{ padding: '0.75rem' }}>Design Name & No</th>
                        <th style={{ padding: '0.75rem' }}>Vendor / Customer</th>
                        <th style={{ padding: '0.75rem' }}>Merchandiser</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total Qty (Mtr)</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Target Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrdersList.map(o => {
                        const isSelected = selectedOrderIds.includes(o.id);
                        return (
                          <tr
                            key={o.id}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              backgroundColor: isSelected ? 'rgba(128, 0, 0, 0.04)' : 'white',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleOrderToggle(o.id)}
                          >
                            <td style={{ padding: '0.75rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleOrderToggle(o.id)}
                              />
                            </td>
                            <td style={{ padding: '0.75rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                              {o.order_number}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ fontWeight: '700', color: '#1e293b' }}>{o.design_no || '—'}</span>
                              {o.design_name ? <span style={{ color: '#64748b', marginLeft: '6px' }}>({o.design_name})</span> : null}
                            </td>
                            <td style={{ padding: '0.75rem', color: '#475569' }}>
                              {o.vendor?.partner_name || '—'}
                            </td>
                            <td style={{ padding: '0.75rem', color: '#475569' }}>
                              {o.merchandiser_name || '—'}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>
                              {parseFloat(o.total_quantity || 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>
                              ₹{parseFloat(o.technical_specs?.target_price || o.target_price || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <form id="pi-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Header Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={e => {
                      setInvoiceDate(e.target.value);
                      if (!initialPi) fetchNextInvoiceNumber(e.target.value);
                    }}
                    required
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Buyer PO Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PO-98765"
                    value={buyerPoNumber}
                    onChange={e => setBuyerPoNumber(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Buyer PO Date
                  </label>
                  <input
                    type="date"
                    value={buyerPoDate}
                    onChange={e => setBuyerPoDate(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TN-37-AB-1234"
                    value={vehicleNumber}
                    onChange={e => setVehicleNumber(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Billed To & Shipped To */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.25rem' }}>
                {/* Billed To */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem', background: '#ffffff' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 0.75rem 0', textTransform: 'uppercase' }}>
                    Billed To Details *
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>Select Partner / Party *</label>
                      <select
                        value={billedToPartnerId}
                        onChange={e => handleBilledToChange(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="">-- Choose Vendor Party --</option>
                        {vendorPartners.map(p => (
                          <option key={p.id} value={p.id}>{p.partner_name} ({p.gstin || 'No GSTIN'})</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>Billed To Name *</label>
                        <input
                          type="text"
                          value={billedToName}
                          onChange={e => setBilledToName(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>GSTIN *</label>
                        <input
                          type="text"
                          value={billedToGstin}
                          onChange={e => setBilledToGstin(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>State *</label>
                        <input
                          type="text"
                          value={billedToState}
                          onChange={e => setBilledToState(e.target.value)}
                          required
                          placeholder="e.g. Tamil Nadu"
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>State Code</label>
                        <input
                          type="text"
                          value={billedToStateCode}
                          onChange={e => setBilledToStateCode(e.target.value)}
                          placeholder="e.g. 33"
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>Address</label>
                      <textarea
                        rows={2}
                        value={billedToAddress}
                        onChange={e => setBilledToAddress(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Shipped To */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem', background: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0, textTransform: 'uppercase' }}>
                      Shipped To Details
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShippedToPartnerId(billedToPartnerId);
                        setShippedToName(billedToName);
                        setShippedToAddress(billedToAddress);
                        setShippedToGstin(billedToGstin);
                        setShippedToState(billedToState);
                        setShippedToStateCode(billedToStateCode);
                      }}
                      style={{ background: '#f1f5f9', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '600' }}
                    >
                      Copy Billed To
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>Select Partner / Party</label>
                      <select
                        value={shippedToPartnerId}
                        onChange={e => handleShippedToChange(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="">-- Choose Vendor Party --</option>
                        {vendorPartners.map(p => (
                          <option key={p.id} value={p.id}>{p.partner_name} ({p.gstin || 'No GSTIN'})</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>Shipped To Name</label>
                        <input
                          type="text"
                          value={shippedToName}
                          onChange={e => setShippedToName(e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>GSTIN</label>
                        <input
                          type="text"
                          value={shippedToGstin}
                          onChange={e => setShippedToGstin(e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>State</label>
                        <input
                          type="text"
                          value={shippedToState}
                          onChange={e => setShippedToState(e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>State Code</label>
                        <input
                          type="text"
                          value={shippedToStateCode}
                          onChange={e => setShippedToStateCode(e.target.value)}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b' }}>Address</label>
                      <textarea
                        rows={2}
                        value={shippedToAddress}
                        onChange={e => setShippedToAddress(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* GST & Tax Configuration Section */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0, textTransform: 'uppercase' }}>
                    GST Tax Details & Rate %
                  </h4>
                  <div style={{ fontSize: '0.75rem', fontWeight: '700', background: 'rgba(128, 0, 0, 0.08)', color: 'var(--color-primary)', padding: '2px 10px', borderRadius: '12px' }}>
                    Active Tax: {gstType === 'CGST_SGST'
                      ? `CGST (${activeCgstPercent}%) + SGST (${activeSgstPercent}%)`
                      : gstType === 'IGST'
                      ? `IGST (${activeIgstPercent}%)`
                      : `Custom: CGST ${activeCgstPercent}% | SGST ${activeSgstPercent}% | IGST ${activeIgstPercent}%`}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'center' }}>
                  {/* Select GST Type */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                      Select Tax Type *
                    </label>
                    <select
                      value={gstType}
                      onChange={e => setGstType(e.target.value)}
                      style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600', backgroundColor: 'white' }}
                    >
                      <option value="CGST_SGST">CGST + SGST (Intra-State / Within TN)</option>
                      <option value="IGST">IGST (Inter-State / Outside TN)</option>
                      <option value="CUSTOM">Custom Rates (CGST / SGST / IGST Breakdown)</option>
                    </select>
                  </div>

                  {/* GST Rate (%) / Custom Rates */}
                  {gstType !== 'CUSTOM' ? (
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                        GST Percentage (%) *
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={gstRate}
                          onChange={e => setGstRate(e.target.value)}
                          placeholder="e.g. 5"
                          style={{ width: '90px', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: 'white' }}
                        />
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[0, 5, 12, 18].map(rate => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => setGstRate(rate)}
                              style={{
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: parseFloat(gstRate) === rate ? '1px solid var(--color-primary)' : '1px solid #cbd5e1',
                                background: parseFloat(gstRate) === rate ? 'var(--color-primary)' : 'white',
                                color: parseFloat(gstRate) === rate ? 'white' : '#334155',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              {rate}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>CGST %</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={customCgstPercent}
                          onChange={e => setCustomCgstPercent(e.target.value)}
                          style={{ width: '75px', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: 'white' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>SGST %</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={customSgstPercent}
                          onChange={e => setCustomSgstPercent(e.target.value)}
                          style={{ width: '75px', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: 'white' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>IGST %</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={customIgstPercent}
                          onChange={e => setCustomIgstPercent(e.target.value)}
                          style={{ width: '75px', padding: '0.45rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 'bold', backgroundColor: 'white' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Per-Order Line Items Table (Each order has its own price/rate) */}
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '12px', padding: '1rem', background: '#ffffff' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 0.75rem 0', textTransform: 'uppercase' }}>
                  Selected Orders Line Items & Pricing breakdown
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '0.6rem' }}>Order No</th>
                        <th style={{ padding: '0.6rem' }}>Design & Name</th>
                        <th style={{ padding: '0.6rem', width: '100px' }}>UOM</th>
                        <th style={{ padding: '0.6rem', width: '100px' }}>HSN</th>
                        <th style={{ padding: '0.6rem', width: '110px', textAlign: 'right' }}>Qty</th>
                        <th style={{ padding: '0.6rem', width: '120px', textAlign: 'right' }}>Rate (₹/Unit) *</th>
                        <th style={{ padding: '0.6rem', width: '90px', textAlign: 'right' }}>Disc %</th>
                        <th style={{ padding: '0.6rem', textAlign: 'right' }}>Taxable Amt (₹)</th>
                        <th style={{ padding: '0.6rem', textAlign: 'right' }}>
                          GST ({gstType === 'CGST_SGST' ? `CGST+SGST (${activeCgstPercent + activeSgstPercent}%)` : gstType === 'IGST' ? `IGST (${activeIgstPercent}%)` : `Custom`})
                        </th>
                        <th style={{ padding: '0.6rem', textAlign: 'right' }}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computedItems.map((item) => {
                        const cfg = itemConfigs[item.order_id] || {};
                        return (
                          <tr key={item.order_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.6rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                              {item.order_number}
                            </td>
                            <td style={{ padding: '0.6rem' }}>
                              <strong>{item.design_no}</strong> ({item.design_name || '—'})
                            </td>
                            <td style={{ padding: '0.6rem' }}>
                              <select
                                value={cfg.uom || 'Meter'}
                                onChange={e => handleItemChange(item.order_id, 'uom', e.target.value)}
                                style={{ width: '100%', padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                              >
                                <option value="Meter">Meter</option>
                                <option value="Yard">Yard</option>
                                <option value="Kg">Kg</option>
                                <option value="Pcs">Pcs</option>
                              </select>
                            </td>
                            <td style={{ padding: '0.6rem' }}>
                              <input
                                type="text"
                                value={cfg.hsn || '5208'}
                                onChange={e => handleItemChange(item.order_id, 'hsn', e.target.value)}
                                style={{ width: '100%', padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                              />
                            </td>
                            <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="any"
                                value={cfg.qty !== undefined ? cfg.qty : item.qty}
                                onChange={e => handleItemChange(item.order_id, 'qty', e.target.value)}
                                style={{ width: '100%', padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="any"
                                value={cfg.rate !== undefined ? cfg.rate : item.rate}
                                onChange={e => handleItemChange(item.order_id, 'rate', e.target.value)}
                                required
                                style={{ width: '100%', padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'right', fontWeight: 'bold' }}
                              />
                            </td>
                            <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="any"
                                value={cfg.discount_percent !== undefined ? cfg.discount_percent : 0}
                                onChange={e => handleItemChange(item.order_id, 'discount_percent', e.target.value)}
                                style={{ width: '100%', padding: '0.25rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: '600' }}>
                              ₹{item.taxable_value.toFixed(2)}
                            </td>
                            <td style={{ padding: '0.6rem', textAlign: 'right', color: '#475569' }}>
                              ₹{item.total_gst_amount.toFixed(2)}
                            </td>
                            <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                              ₹{item.total_amount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: '800', borderTop: '2px solid #e2e8f0' }}>
                        <td colSpan={4} style={{ padding: '0.75rem' }}>Total Summary</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalQty.toLocaleString('en-IN')}</td>
                        <td colSpan={2}></td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>₹{totalTaxable.toFixed(2)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>₹{totalGst.toFixed(2)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--color-primary)', fontSize: '0.95rem' }}>
                          ₹{totalInvoicePrice.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Additional Terms & Bank Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Transport Mode</label>
                  <input type="text" value={transportMode} onChange={e => setTransportMode(e.target.value)} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Expected Delivery Date</label>
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Payment Terms</label>
                  <input type="text" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Quality Tolerance</label>
                  <input type="text" value={qualityTolerance} onChange={e => setQualityTolerance(e.target.value)} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Remarks / Terms</label>
                  <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="e.g. Subject to Salem Jurisdiction" style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>Bank Details</label>
                  <textarea rows={2} value={bankDetails} onChange={e => setBankDetails(e.target.value)} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }} />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <ArrowLeft size={16} /> Back to Orders
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            {step === 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (selectedOrderIds.length === 0) {
                    alert('Please select at least one order to proceed.');
                    return;
                  }
                  setStep(2);
                }}
                style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                Proceed to Pricing <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="submit"
                form="pi-form"
                disabled={submitting}
                style={{ padding: '0.55rem 1.5rem', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: '700', cursor: submitting ? 'wait' : 'pointer', fontSize: '0.85rem' }}
              >
                {submitting ? 'Saving...' : (initialPi ? 'Update Proforma Invoice' : 'Create Proforma Invoice')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
