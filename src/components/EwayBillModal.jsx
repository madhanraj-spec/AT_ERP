import React, { useState, useEffect } from 'react';
import { X, Truck, CreditCard, ShieldAlert, Sparkles, Loader } from 'lucide-react';
import { createEwayBill, cancelEwayBill } from '../utils/whitebooks';
import { supabase } from '../lib/supabase';

/**
 * Premium Modal to manage Whitebooks E-Way Bill Generation & Cancellation
 */
export default function EwayBillModal({
  isOpen,
  onClose,
  onSuccess,
  type, // 'greige' | 'dyed' | 'pof'
  record, // The parent gydr, dydr, or pof record
  defaultDetails = {}
}) {
  const [activeTab, setActiveTab] = useState('generate'); // 'generate' | 'cancel'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states for Generation
  const [partnerName, setPartnerName] = useState('');
  const [partnerGstin, setPartnerGstin] = useState('');
  const [partnerAddress, setPartnerAddress] = useState('');
  const [partnerPlace, setPartnerPlace] = useState('');
  const [partnerPincode, setPartnerPincode] = useState('');
  const [partnerStateCode, setPartnerStateCode] = useState('33'); // Default Tamil Nadu
  
  // Goods Items — one per yarn count / line item
  const [goodsItems, setGoodsItems] = useState([]);
  
  const [transDistance, setTransDistance] = useState('50');
  const [transMode, setTransMode] = useState('1'); // 1 = Road
  const [vehicleNo, setVehicleNo] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [transporterId, setTransporterId] = useState('');

  // Form states for Cancellation
  const [cancelReasonCode, setCancelReasonCode] = useState('2'); // 2 = Order Cancelled
  const [cancelRemark, setCancelRemark] = useState('');

  // Pre-fill default values when modal opens or defaults change
  useEffect(() => {
    if (isOpen && defaultDetails) {
      setErrorMsg('');
      
      // Partner Info
      setPartnerName(defaultDetails.partnerName || '');
      setPartnerGstin(defaultDetails.partnerGstin || '');
      setPartnerAddress(defaultDetails.partnerAddress || '');
      setPartnerPlace(defaultDetails.partnerPlace || 'Salem');
      
      // Clean pincode string
      let pin = defaultDetails.partnerPincode || '';
      if (!pin && defaultDetails.partnerAddress) {
        // Attempt to extract 6-digit pincode from address
        const pinMatch = defaultDetails.partnerAddress.match(/\b\d{6}\b/);
        if (pinMatch) pin = pinMatch[0];
      }
      setPartnerPincode(pin || '');

      // State Code (Tamil Nadu = 33)
      let sc = '33';
      if (defaultDetails.partnerStateCode) {
        sc = String(defaultDetails.partnerStateCode);
      } else if (defaultDetails.partnerGstin && defaultDetails.partnerGstin.length >= 2) {
        const parsedCode = defaultDetails.partnerGstin.substring(0, 2);
        if (/^\d+$/.test(parsedCode)) sc = parsedCode;
      }
      setPartnerStateCode(sc);

      // Goods Items — build from per-item breakdown or fall back to single item
      if (type === 'greige' || type === 'dyed') {
        const fetchAndConsolidate = async () => {
          try {
            let deliveryItems = [];
            if (type === 'greige') {
              const { data, error } = await supabase
                .from('greige_yarn_delivery_items')
                .select(`
                  yarn_count_id,
                  quantity_kg,
                  master_yarn_counts (
                    count_value,
                    spec,
                    spec1,
                    product_type
                  )
                `)
                .eq('receipt_id', record.id);
              if (error) throw error;
              deliveryItems = data || [];
            } else {
              const { data, error } = await supabase
                .from('dyed_yarn_delivery_items')
                .select(`
                  yarn_count_id,
                  quantity_kg,
                  master_yarn_counts (
                    count_value,
                    spec,
                    spec1,
                    product_type
                  )
                `)
                .eq('delivery_id', record.id);
              if (error) throw error;
              deliveryItems = data || [];
            }

            if (deliveryItems.length === 0) {
              setGoodsItems([{
                productName: 'Yarn',
                productDesc: 'Yarn',
                hsnCode: defaultDetails.hsnCode || (type === 'dyed' ? '5206' : '5205'),
                quantity: defaultDetails.totalQty || 0,
                qtyUnit: 'KGS',
                ratePerKg: type === 'dyed' ? 320.0 : 160.0,
                taxableAmount: (defaultDetails.totalQty || 0) * (type === 'dyed' ? 320.0 : 160.0)
              }]);
              return;
            }

            // Group by yarn_count_id to aggregate quantities
            const countMap = {};
            deliveryItems.forEach(di => {
              const cid = di.yarn_count_id;
              if (cid) {
                if (!countMap[cid]) {
                  const c = di.master_yarn_counts;
                  const yarnName = c ? [c.count_value, c.spec, c.spec1, c.product_type].filter(Boolean).join(' ') : 'Yarn';
                  countMap[cid] = {
                    qty: 0,
                    name: yarnName
                  };
                }
                countMap[cid].qty += parseFloat(di.quantity_kg || 0);
              }
            });

            const countIds = Object.keys(countMap);

            // Fetch rate_per_kg and hsn_code from greige_yarn_receipts
            let rateMap = {};
            if (countIds.length > 0) {
              const { data: receipts, error: receiptsErr } = await supabase
                .from('greige_yarn_receipts')
                .select('yarn_count_id, rate_per_kg, hsn_code')
                .in('yarn_count_id', countIds)
                .order('created_at', { ascending: false });

              if (receiptsErr) throw receiptsErr;

              countIds.forEach(cid => {
                const matching = (receipts || []).filter(r => r.yarn_count_id === cid);
                if (matching.length > 0) {
                  const withRate = matching.find(r => parseFloat(r.rate_per_kg || 0) > 0);
                  const bestMatch = withRate || matching[0];
                  rateMap[cid] = {
                    rate_per_kg: parseFloat(bestMatch.rate_per_kg || 0) || (type === 'dyed' ? 320.0 : 160.0),
                    hsn_code: bestMatch.hsn_code || (type === 'dyed' ? '5206' : '5205')
                  };
                } else {
                  rateMap[cid] = {
                    rate_per_kg: type === 'dyed' ? 320.0 : 160.0,
                    hsn_code: type === 'dyed' ? '5206' : '5205'
                  };
                }
              });
            }

            // Build individual item rows (one row per yarn count)
            const items = countIds.map(cid => {
              const info = countMap[cid];
              const qty = info.qty;
              const rateInfo = rateMap[cid] || {};
              const rate = rateInfo.rate_per_kg || (type === 'dyed' ? 320.0 : 160.0);
              const hsn = rateInfo.hsn_code || (type === 'dyed' ? '5206' : '5205');
              return {
                productName: 'Yarn', // Goods category is always Yarn
                productDesc: info.name + (type === 'dyed' ? ' Dyed Yarn' : ' Yarn'),
                hsnCode: hsn,
                quantity: parseFloat(qty.toFixed(2)),
                qtyUnit: 'KGS',
                ratePerKg: rate,
                taxableAmount: parseFloat((qty * rate).toFixed(2))
              };
            });

            setGoodsItems(items);
          } catch (err) {
            console.error('Error consolidating goods items for E-Way bill:', err);
            const totalQty = defaultDetails.totalQty || 0;
            setGoodsItems([{
              productName: 'Yarn',
              productDesc: 'Yarn',
              hsnCode: defaultDetails.hsnCode || (type === 'dyed' ? '5206' : '5205'),
              quantity: totalQty,
              qtyUnit: 'KGS',
              ratePerKg: type === 'dyed' ? 320.0 : 160.0,
              taxableAmount: totalQty * (type === 'dyed' ? 320.0 : 160.0)
            }]);
          }
        };

        fetchAndConsolidate();
      } else {
        if (defaultDetails.items && defaultDetails.items.length > 0) {
          setGoodsItems(defaultDetails.items.map(item => ({
            productName: item.productName || 'Yarn / Fabric',
            hsnCode: item.hsnCode || '5205',
            quantity: parseFloat(item.quantity || 0),
            qtyUnit: item.qtyUnit || (type === 'pof' ? 'MTR' : 'KGS'),
            ratePerKg: parseFloat(item.ratePerKg || 0),
            taxableAmount: parseFloat(item.taxableAmount || 0)
          })));
        } else {
          const totalQty = defaultDetails.totalQty || 0;
          const estRate = type === 'pof' ? 120 : 250;
          const estValue = defaultDetails.taxableAmount || Math.round(totalQty * estRate);
          setGoodsItems([{
            productName: defaultDetails.productName || 'Yarn / Fabric',
            hsnCode: defaultDetails.hsnCode || '5205',
            quantity: totalQty,
            qtyUnit: defaultDetails.qtyUnit || (type === 'pof' ? 'MTR' : 'KGS'),
            ratePerKg: totalQty > 0 ? parseFloat((estValue / totalQty).toFixed(2)) : 0,
            taxableAmount: estValue
          }]);
        }
      }

      // Transport Info
      setTransDistance(defaultDetails.transDistance || '50');
      setTransMode(defaultDetails.transMode || '1');
      setVehicleNo(defaultDetails.vehicleNo || '');
      setTransporterName(defaultDetails.transporterName || '');
      setTransporterId(defaultDetails.transporterId || '');

      // Determine active mode
      if (record?.eway_bill_no) {
        setActiveTab('cancel');
      } else {
        setActiveTab('generate');
      }
    }
  }, [isOpen, defaultDetails, record, type]);

  if (!isOpen) return null;

  // Helper to compute grand totals from goodsItems
  const grandTotalQty = goodsItems.reduce((s, i) => s + parseFloat(i.quantity || 0), 0);
  const grandTotalValue = goodsItems.reduce((s, i) => s + parseFloat(i.taxableAmount || 0), 0);

  // Update a single goods item field
  const updateGoodsItem = (index, field, value) => {
    setGoodsItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-recalculate taxableAmount when qty or rate changes
      if (field === 'quantity' || field === 'ratePerKg') {
        const qty = field === 'quantity' ? parseFloat(value || 0) : parseFloat(updated[index].quantity || 0);
        const rate = field === 'ratePerKg' ? parseFloat(value || 0) : parseFloat(updated[index].ratePerKg || 0);
        updated[index].taxableAmount = parseFloat((qty * rate).toFixed(2));
      }
      return updated;
    });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!partnerPincode || String(partnerPincode).length !== 6) {
      return setErrorMsg('Please enter a valid 6-digit Pincode.');
    }
    if (grandTotalValue <= 0) {
      return setErrorMsg('Total taxable value must be greater than zero. Check per-item rates.');
    }
    if (!vehicleNo) {
      return setErrorMsg('Vehicle number is required for E-Way Bill generation.');
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await createEwayBill({
        type,
        recordId: record.id,
        docNo: defaultDetails.docNo,
        docDate: defaultDetails.docDate || new Date().toISOString(),
        partner: {
          partner_name: partnerName,
          gstin: partnerGstin,
          address: partnerAddress,
          place: partnerPlace,
          pincode: partnerPincode,
          stateCode: partnerStateCode
        },
        transport: {
          transDistance,
          transMode,
          vehicleNo,
          transporterName,
          transporterId
        },
        items: goodsItems.map(gi => ({
          productName: gi.productName,
          productDesc: gi.productDesc || gi.productName,
          hsnCode: gi.hsnCode,
          quantity: gi.quantity,
          qtyUnit: gi.qtyUnit,
          taxableAmount: gi.taxableAmount
        }))
      });

      if (res.success) {
        onSuccess(res);
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to generate E-Way Bill.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (e) => {
    e.preventDefault();
    if (!cancelRemark) {
      return setErrorMsg('Please enter a cancellation remark.');
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await cancelEwayBill({
        type,
        recordId: record.id,
        ewayBillNo: record.eway_bill_no,
        cancelRsnCode: cancelReasonCode,
        cancelRmrk: cancelRemark
      });

      if (res.success) {
        onSuccess({ eway_bill_status: 'cancelled', ...res });
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to cancel E-Way Bill.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 4000, padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '16px', width: '100%',
        maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex',
        flexDirection: 'column', border: '1px solid #e2e8f0',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.25rem 1.75rem', borderBottom: '1px solid #f1f5f9',
          background: 'linear-gradient(135deg, #800000 0%, #4a0000 100%)',
          borderTopLeftRadius: '15px', borderTopRightRadius: '15px', color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Truck size={22} style={{ color: '#fbcfe8' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                {record?.eway_bill_no ? 'Manage E-Way Bill' : 'Generate E-Way Bill'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#fbcfe8', fontWeight: '600' }}>
                Whitebooks GSP Sandbox Environment
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#fff',
              cursor: 'pointer', padding: '4px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.1)', transition: 'all 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        {record?.eway_bill_no && (
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <button
              onClick={() => setActiveTab('cancel')}
              style={{
                flex: 1, padding: '1rem', border: 'none', background: 'none',
                fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
                color: activeTab === 'cancel' ? '#800000' : '#64748b',
                borderBottom: activeTab === 'cancel' ? '3px solid #800000' : '3px solid transparent'
              }}
            >
              Cancel E-Way Bill
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              style={{
                flex: 1, padding: '1rem', border: 'none', background: 'none',
                fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
                color: activeTab === 'generate' ? '#800000' : '#64748b',
                borderBottom: activeTab === 'generate' ? '3px solid #800000' : '3px solid transparent'
              }}
            >
              Regenerate / View Details
            </button>
          </div>
        )}

        {/* Form Body */}
        <div style={{ padding: '1.75rem' }}>
          {errorMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              backgroundColor: '#fef2f2', color: '#b91c1c', padding: '1rem',
              borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #fca5a5',
              fontSize: '0.85rem', fontWeight: '600'
            }}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {activeTab === 'generate' ? (
            <form onSubmit={handleGenerate}>
              {/* Card Section: Consignee Details */}
              <div style={{
                border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem',
                marginBottom: '1.5rem', backgroundColor: '#f8fafc'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '0.9rem', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={16} style={{ color: '#800000' }} /> Consignee (To Partner) Details
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Partner Name</label>
                    <input type="text" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} required style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Partner GSTIN</label>
                    <input type="text" value={partnerGstin} onChange={(e) => setPartnerGstin(e.target.value)} placeholder="URP or 15-digit GSTIN" style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Delivery Address</label>
                  <input type="text" value={partnerAddress} onChange={(e) => setPartnerAddress(e.target.value)} required style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Place / City</label>
                    <input type="text" value={partnerPlace} onChange={(e) => setPartnerPlace(e.target.value)} required style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Pincode</label>
                    <input type="text" maxLength={6} value={partnerPincode} onChange={(e) => setPartnerPincode(e.target.value.replace(/\D/g, ''))} required placeholder="6-digit ZIP" style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700', color: '#800000' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>State Code</label>
                    <input type="text" maxLength={2} value={partnerStateCode} onChange={(e) => setPartnerStateCode(e.target.value.replace(/\D/g, ''))} required style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }} />
                  </div>
                </div>
              </div>

              {/* ═══════ Goods Description Table (Per Yarn Count) ═══════ */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '0.9rem', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={16} style={{ color: '#800000' }} /> Goods Description (Per Yarn Count)
                </h4>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontWeight: '800', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>HSN Code</th>
                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontWeight: '800', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Goods Category</th>
                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: '800', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>UOM</th>
                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '800', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Qty (KG)</th>
                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '800', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Rate ₹/KG</th>
                        <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '800', color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total Value ₹</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goodsItems.map((gi, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                           <td style={{ padding: '0.5rem' }}>
                            <input type="text" maxLength={50} value={gi.hsnCode} onChange={(e) => updateGoodsItem(idx, 'hsnCode', e.target.value.replace(/[^0-9,\/\s-]/g, ''))} style={{ width: '120px', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '700', fontFamily: 'monospace' }} />
                           </td>
                           <td style={{ padding: '0.5rem' }}>
                            {type === 'branch' || type === 'pof' ? (
                              <select
                                value={gi.productName}
                                onChange={(e) => {
                                  const category = e.target.value;
                                  let hsn = gi.hsnCode;
                                  if (category === 'Fabric') {
                                    hsn = '520842';
                                  } else if (category === 'Processed Fabric' || category === 'Greige Fabric') {
                                    hsn = '5208';
                                  }
                                  setGoodsItems(prev => {
                                    const updated = [...prev];
                                    updated[idx] = { ...updated[idx], productName: category, hsnCode: hsn };
                                    return updated;
                                  });
                                }}
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  color: '#1e293b',
                                  backgroundColor: 'white',
                                  cursor: 'pointer',
                                  width: '100%',
                                  outline: 'none'
                                }}
                              >
                                <option value="Greige Fabric">Greige Fabric</option>
                                <option value="Processed Fabric">Processed Fabric</option>
                                <option value="Fabric">Fabric</option>
                              </select>
                            ) : (
                              <div>
                                <span style={{ fontWeight: '600', color: '#1e293b' }}>{gi.productName}</span>
                                {gi.productDesc && (
                                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', fontWeight: '600' }}>
                                    {gi.productDesc}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                            {gi.qtyUnit}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>
                            {parseFloat(gi.quantity || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            <input type="number" step="0.01" value={gi.ratePerKg} onChange={(e) => updateGoodsItem(idx, 'ratePerKg', e.target.value)} style={{ width: '80px', padding: '0.35rem 0.5rem', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: '700', textAlign: 'right', fontFamily: 'monospace', color: '#800000' }} />
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '800', fontFamily: 'monospace', color: '#166534' }}>
                            ₹{parseFloat(gi.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #800000', backgroundColor: '#fef2f2' }}>
                        <td colSpan={3} style={{ padding: '0.6rem 0.5rem', fontWeight: '850', fontSize: '0.78rem', color: '#800000', textTransform: 'uppercase' }}>Grand Total</td>
                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '850', fontFamily: 'monospace', color: '#800000' }}>{grandTotalQty.toFixed(2)}</td>
                        <td style={{ padding: '0.6rem 0.5rem' }}></td>
                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: '900', fontFamily: 'monospace', color: '#800000', fontSize: '0.9rem' }}>₹{grandTotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Card Section: Transport details */}
              <div style={{ marginBottom: '1.5rem' }}>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '0.9rem', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    🚚 Transport & Part-B
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Vehicle Number</label>
                      <input type="text" placeholder="e.g. TN30AA1234" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} required style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '800', color: '#1e293b' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Distance (KM)</label>
                      <input type="number" value={transDistance} onChange={(e) => setTransDistance(e.target.value)} required style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '700' }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Transporter Name</label>
                    <input type="text" placeholder="Optional" value={transporterName} onChange={(e) => setTransporterName(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }} />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Transporter ID (GSTIN)</label>
                    <input type="text" placeholder="Optional" value={transporterId} onChange={(e) => setTransporterId(e.target.value.toUpperCase())} style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600' }} />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    padding: '0.6rem 1.5rem', borderRadius: '6px', border: '1px solid #cbd5e1',
                    fontSize: '0.85rem', fontWeight: '700', color: '#64748b', backgroundColor: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.6rem 1.75rem', borderRadius: '6px', border: 'none',
                    fontSize: '0.85rem', fontWeight: '700', color: '#fff',
                    backgroundColor: '#800000', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: '0.5rem'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating...
                    </>
                  ) : (
                    'Generate Sandbox E-Way Bill'
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCancel}>
              <div style={{
                border: '1px solid #fca5a5', borderRadius: '10px', padding: '1.25rem',
                backgroundColor: '#fff5f5', marginBottom: '1.5rem'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#991b1b', fontSize: '0.9rem', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⚠️ Cancel E-Way Bill: {record?.eway_bill_no}
                </h4>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#7f1d1d', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Reason Code</label>
                  <select
                    value={cancelReasonCode}
                    onChange={(e) => setCancelReasonCode(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '0.85rem', fontWeight: '600', backgroundColor: '#fff' }}
                  >
                    <option value="1">1 - Duplicate</option>
                    <option value="2">2 - Order Cancelled</option>
                    <option value="3">3 - Data Entry Mistake</option>
                    <option value="4">4 - Others</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: '#7f1d1d', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Cancellation Remarks</label>
                  <input
                    type="text"
                    placeholder="Enter reason for cancelling this eway bill..."
                    value={cancelRemark}
                    onChange={(e) => setCancelRemark(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '0.85rem', fontWeight: '600' }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    padding: '0.6rem 1.5rem', borderRadius: '6px', border: '1px solid #cbd5e1',
                    fontSize: '0.85rem', fontWeight: '700', color: '#64748b', backgroundColor: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.6rem 1.75rem', borderRadius: '6px', border: 'none',
                    fontSize: '0.85rem', fontWeight: '700', color: '#fff',
                    backgroundColor: '#991b1b', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: '0.5rem'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cancelling...
                    </>
                  ) : (
                    'Cancel E-Way Bill'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
