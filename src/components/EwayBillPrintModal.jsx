import React, { useState, useEffect } from 'react';
import { X, Printer, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function EwayBillPrintModal({ isOpen, onClose, type, record }) {
  const [partnerDetails, setPartnerDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [goodsItems, setGoodsItems] = useState([]);

  useEffect(() => {
    if (isOpen && record) {
      fetchPartner();

      // Reset to defaults first, then load dynamically
      const initialItems = record.eway_bill_details?.items || [
        {
          hsnCode: record.hsn_code || '5205',
          productName: record.productName || 'Cotton Yarn / Fabric - Outsource Processing',
          quantity: record.totalQty || record.delivered_qty || '0.00',
          qtyUnit: record.qtyUnit || 'KGS',
          taxableAmount: record.taxableAmount || 0
        }
      ];
      setGoodsItems(initialItems);

      loadGoodsItems();
    }
  }, [isOpen, record]);

  const loadGoodsItems = async () => {
    // If eway_bill_details has items, use them
    if (record?.eway_bill_details?.items && record.eway_bill_details.items.length > 0) {
      setGoodsItems(record.eway_bill_details.items);
      return;
    }

    // Otherwise, check if type is 'greige' or 'dyed' and fetch dynamically from database
    if (type === 'greige' || type === 'dyed') {
      try {
        let deliveryItems = [];
        if (type === 'greige') {
          const { data } = await supabase
            .from('greige_yarn_delivery_items')
            .select('yarn_count_id, quantity_kg')
            .eq('receipt_id', record.id);
          deliveryItems = data || [];
        } else {
          const { data } = await supabase
            .from('dyed_yarn_delivery_items')
            .select('yarn_count_id, quantity_kg')
            .eq('delivery_id', record.id);
          deliveryItems = data || [];
        }

        if (deliveryItems.length === 0) {
          setGoodsItems([
            {
              hsnCode: record.hsn_code || '5205',
              productName: record.productName || 'Yarn',
              quantity: record.totalQty || record.delivered_qty || 0,
              qtyUnit: record.qtyUnit || 'KGS',
              taxableAmount: record.taxableAmount || 0
            }
          ]);
          return;
        }

        // Group by yarn_count_id
        const countMap = {};
        deliveryItems.forEach(di => {
          const cid = di.yarn_count_id;
          if (cid) {
            if (!countMap[cid]) countMap[cid] = 0;
            countMap[cid] += parseFloat(di.quantity_kg || 0);
          }
        });

        const countIds = Object.keys(countMap);

        // Fetch rate_per_kg and hsn_code from greige_yarn_receipts
        let rateMap = {};
        if (countIds.length > 0) {
          const { data: receipts } = await supabase
            .from('greige_yarn_receipts')
            .select('yarn_count_id, rate_per_kg, hsn_code')
            .in('yarn_count_id', countIds)
            .order('created_at', { ascending: false });

          countIds.forEach(cid => {
            const matching = (receipts || []).filter(r => r.yarn_count_id === cid);
            if (matching.length > 0) {
              const withRate = matching.find(r => parseFloat(r.rate_per_kg || 0) > 0);
              const bestMatch = withRate || matching[0];
              rateMap[cid] = {
                rate_per_kg: parseFloat(bestMatch.rate_per_kg || 0),
                hsn_code: bestMatch.hsn_code || '5205'
              };
            } else {
              rateMap[cid] = {
                rate_per_kg: 0,
                hsn_code: '5205'
              };
            }
          });
        }

        // Build items
        const items = countIds.map(cid => {
          const qty = countMap[cid];
          const rateInfo = rateMap[cid] || {};
          const rate = rateInfo.rate_per_kg || 0;
          const hsn = rateInfo.hsn_code || '5205';
          return {
            productName: 'Yarn',
            hsnCode: hsn,
            quantity: parseFloat(qty.toFixed(2)),
            qtyUnit: 'KGS',
            ratePerKg: rate,
            taxableAmount: parseFloat((qty * rate).toFixed(2))
          };
        });

        setGoodsItems(items);
      } catch (err) {
        console.error('Error fetching print items dynamically:', err);
      }
    }
  };

  const fetchPartner = async () => {
    setLoading(true);
    try {
      if (record.partner) {
        setPartnerDetails(record.partner);
        return;
      }

      let partnerId = record.dyeing_unit_id || record.partner_id;
      if (!partnerId && record.dof_id) {
        const { data: dofRecord } = await supabase
          .from('dyeing_order_forms')
          .select('dyeing_unit_id')
          .eq('id', record.dof_id)
          .maybeSingle();
        partnerId = dofRecord?.dyeing_unit_id;
      }

      // If still not resolved and it's a dyed yarn delivery, resolve from items
      if (!partnerId && type === 'dyed') {
        const { data: dbItems } = await supabase
          .from('dyed_yarn_delivery_items')
          .select('production_form_id, process_type')
          .eq('delivery_id', record.id);
        
        if (dbItems && dbItems.length > 0) {
          const formId = dbItems[0].production_form_id;
          const processType = dbItems[0].process_type;
          
          if (formId && processType) {
            const dbTable = processType === 'warping' 
              ? 'warping_order_forms' 
              : processType === 'redyeing' 
              ? 'dyeing_order_forms' 
              : 'weaving_orders';
            const partnerCol = processType === 'redyeing' ? 'dyeing_unit_id' : 'partner_id';
            const { data: formRecord } = await supabase
              .from(dbTable)
              .select(partnerCol)
              .eq('id', formId)
              .maybeSingle();
            if (formRecord?.[partnerCol]) {
              partnerId = formRecord[partnerCol];
            }
          }
        }
      }

      if (partnerId) {
        const { data } = await supabase
          .from('master_partners')
          .select('*')
          .eq('id', partnerId)
          .maybeSingle();
        if (data) {
          setPartnerDetails(data);
        }
      }
    } catch (err) {
      console.error('Error fetching partner details for print:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !record) return null;

  const handlePrint = () => {
    window.print();
  };

  // Format e-Way Bill Number: "XXXX XXXX XXXX"
  const formatEwbNo = (no) => {
    if (!no) return '—';
    const clean = String(no).replace(/\s/g, '');
    return clean.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3');
  };

  // Format Date to DD/MM/YYYY hh:mm A
  const formatDateTime = (dtStr) => {
    if (!dtStr) return '—';
    const d = new Date(dtStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const ewbNo = record.eway_bill_no || '—';
  const ewbDate = formatDateTime(record.eway_bill_date || record.created_at);
  const docNo = record.gydr_number || record.dydr_number || record.pof_number || record.fmdc_number || '—';
  const docDate = new Date(record.created_at).toLocaleDateString('en-IN');
  const vehicleNo = record.vehicle_details || record.vehicle_no || record.vehicle_number || record.eway_bill_details?.request?.vehicleNo || record.eway_bill_details?.request?.transport?.vehicleNo || record.eway_bill_details?.vehicleNo || '—';

  // Sender details
  const senderGstin = '33AAZFA6086D1Z6';
  const senderName = 'ASHOK TEXTILES';
  const senderAddr = '6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 636308';

  // Consignee details
  const toGstin = partnerDetails?.gstin || 'URP';
  const toName = partnerDetails?.partner_name || 'Processing Partner';
  const toAddr = partnerDetails?.address || 'Salem, Tamil Nadu';
  const toPincode = partnerDetails?.pincode || '636001';
  const printItems = goodsItems;

  return (
    <div className="print-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div 
        className="print-modal-container"
        style={{ 
          backgroundColor: '#fff', 
          borderRadius: '8px', 
          width: '100%', 
          maxWidth: '850px', 
          maxHeight: '95vh', 
          overflowY: 'auto', 
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Toolbar (Hidden on Print) */}
        <div className="no-print" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '1rem 1.5rem', 
          backgroundColor: '#f8fafc', 
          borderBottom: '1px solid #e2e8f0',
          borderRadius: '8px 8px 0 0'
        }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} color="#16a34a" /> e-Way Bill Slip — {ewbNo}
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              onClick={handlePrint}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                padding: '0.5rem 1.25rem', 
                backgroundColor: '#0284c7', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontSize: '0.85rem', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              <Printer size={15} /> Print Slip (Preview)
            </button>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(record.eway_bill_no);
                alert(`E-Way Bill Number ${record.eway_bill_no} copied to clipboard!\n\nOpening the official GST Portal print search in a new tab. Just paste the number and print the exact official e-Way Bill.`);
                window.open('https://ewaybillgst.gov.in/search-ewaybill', '_blank');
              }}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                padding: '0.5rem 1.25rem', 
                backgroundColor: '#16a34a', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontSize: '0.85rem', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              Print Official e-Way Bill
            </button>
            <button 
              onClick={onClose}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                padding: '0.5rem 1rem', 
                backgroundColor: '#cbd5e1', 
                color: '#334155', 
                border: 'none', 
                borderRadius: '6px', 
                fontSize: '0.85rem', 
                fontWeight: '600', 
                cursor: 'pointer' 
              }}
            >
              <X size={15} /> Close
            </button>
          </div>
        </div>

        {/* Eway Bill Printable Slip Content */}
        <div className="printable-content" style={{ padding: '2rem', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000', lineHeight: '1.4' }}>
          
          {/* Official Style Header */}
          <div style={{ border: '2px solid #000', padding: '10px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>e-Way Bill System</h1>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', fontWeight: 'bold' }}>GST e-Way Bill Slip</p>
              </div>
              
              {/* Barcode Mockup */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <svg width="220" height="35" style={{ display: 'block' }}>
                  <g fill="#000">
                    <rect x="0" width="3" height="35" />
                    <rect x="5" width="1" height="35" />
                    <rect x="8" width="2" height="35" />
                    <rect x="13" width="4" height="35" />
                    <rect x="19" width="1" height="35" />
                    <rect x="22" width="3" height="35" />
                    <rect x="28" width="2" height="35" />
                    <rect x="33" width="1" height="35" />
                    <rect x="36" width="4" height="35" />
                    <rect x="42" width="2" height="35" />
                    <rect x="47" width="1" height="35" />
                    <rect x="50" width="3" height="35" />
                    <rect x="56" width="2" height="35" />
                    <rect x="61" width="1" height="35" />
                    <rect x="64" width="4" height="35" />
                    <rect x="70" width="2" height="35" />
                    <rect x="75" width="1" height="35" />
                    <rect x="78" width="3" height="35" />
                    <rect x="84" width="2" height="35" />
                    <rect x="89" width="1" height="35" />
                    <rect x="92" width="4" height="35" />
                    <rect x="98" width="2" height="35" />
                    <rect x="103" width="1" height="35" />
                    <rect x="106" width="3" height="35" />
                    <rect x="112" width="2" height="35" />
                    <rect x="117" width="1" height="35" />
                    <rect x="120" width="4" height="35" />
                    <rect x="126" width="2" height="35" />
                    <rect x="131" width="1" height="35" />
                    <rect x="134" width="3" height="35" />
                    <rect x="140" width="2" height="35" />
                    <rect x="145" width="1" height="35" />
                    <rect x="148" width="4" height="35" />
                    <rect x="154" width="2" height="35" />
                    <rect x="159" width="1" height="35" />
                    <rect x="162" width="3" height="35" />
                    <rect x="168" width="2" height="35" />
                    <rect x="173" width="1" height="35" />
                    <rect x="176" width="4" height="35" />
                    <rect x="182" width="2" height="35" />
                    <rect x="187" width="1" height="35" />
                    <rect x="190" width="3" height="35" />
                    <rect x="196" width="2" height="35" />
                    <rect x="201" width="1" height="35" />
                    <rect x="204" width="4" height="35" />
                    <rect x="210" width="2" height="35" />
                    <rect x="215" width="3" height="35" />
                  </g>
                </svg>
                <span style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '3px', fontFamily: 'monospace' }}>{formatEwbNo(ewbNo)}</span>
              </div>
            </div>
          </div>

          {/* 1. e-Way Bill Details Block */}
          <div style={{ border: '1px solid #000', marginBottom: '15px' }}>
            <div style={{ backgroundColor: '#eaeaea', padding: '5px', fontWeight: 'bold', borderBottom: '1px solid #000', fontSize: '12px' }}>
              1. e-Way Bill Details
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td style={{ width: '25%', padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>e-Way Bill No:</td>
                  <td style={{ width: '25%', padding: '6px', fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', borderRight: '1px solid #000' }}>{ewbNo}</td>
                  <td style={{ width: '25%', padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Generated Date:</td>
                  <td style={{ width: '25%', padding: '6px' }}>{ewbDate}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Generated By:</td>
                  <td style={{ padding: '6px', borderRight: '1px solid #000' }}>{senderGstin} - {senderName}</td>
                  <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Mode of Transport:</td>
                  <td style={{ padding: '6px' }}>Road</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Type of Transaction:</td>
                  <td style={{ padding: '6px', borderRight: '1px solid #000' }}>{type === 'branch' ? 'Outward - Branch Transfer' : 'Outward-Jobwork'}</td>
                  <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Approx Distance:</td>
                  <td style={{ padding: '6px' }}>{record.eway_bill_details?.request?.transDistance || record.eway_bill_details?.request?.transport?.transDistance || record.eway_bill_details?.transDistance || '50'} km</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2. Address Details Block */}
          <div style={{ border: '1px solid #000', marginBottom: '15px' }}>
            <div style={{ backgroundColor: '#eaeaea', padding: '5px', fontWeight: 'bold', borderBottom: '1px solid #000', fontSize: '12px' }}>
              2. Address Details
            </div>
            <div style={{ display: 'flex' }}>
              <div style={{ width: '50%', borderRight: '1px solid #000', padding: '10px' }}>
                <h4 style={{ margin: '0 0 5px 0', textDecoration: 'underline', fontWeight: 'bold', fontSize: '11px' }}>From (Place of Dispatch)</h4>
                <p style={{ margin: '3px 0' }}><strong>GSTIN:</strong> {senderGstin}</p>
                <p style={{ margin: '3px 0' }}><strong>Trade Name:</strong> {senderName}</p>
                <p style={{ margin: '3px 0' }}><strong>Address:</strong> {type === 'branch' && record.from_location === 'Office' ? '12/1 JAGADESN KADU, GUGAI, SALEM, 636006' : senderAddr}</p>
              </div>
              
              <div style={{ width: '50%', padding: '10px' }}>
                <h4 style={{ margin: '0 0 5px 0', textDecoration: 'underline', fontWeight: 'bold', fontSize: '11px' }}>To (Place of Delivery)</h4>
                {type === 'branch' ? (
                  <>
                    <p style={{ margin: '3px 0' }}><strong>GSTIN:</strong> {senderGstin}</p>
                    <p style={{ margin: '3px 0' }}><strong>Trade Name:</strong> {senderName} - {record.to_location}</p>
                    <p style={{ margin: '3px 0' }}><strong>Address:</strong> {record.to_location === 'Factory' ? '6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, 636308' : '12/1 JAGADESN KADU, GUGAI, SALEM, 636006'}</p>
                    <p style={{ margin: '3px 0' }}><strong>Pincode:</strong> {record.to_location === 'Factory' ? '636308' : '636006'}</p>
                  </>
                ) : (
                  <>
                    <p style={{ margin: '3px 0' }}><strong>GSTIN:</strong> {toGstin}</p>
                    <p style={{ margin: '3px 0' }}><strong>Trade Name:</strong> {toName}</p>
                    <p style={{ margin: '3px 0' }}><strong>Address:</strong> {toAddr}</p>
                    <p style={{ margin: '3px 0' }}><strong>Pincode:</strong> {toPincode}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 3. Goods Details Block */}
          <div style={{ border: '1px solid #000', marginBottom: '15px' }}>
            <div style={{ backgroundColor: '#eaeaea', padding: '5px', fontWeight: 'bold', borderBottom: '1px solid #000', fontSize: '12px' }}>
              3. Goods Details
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid #000' }}>
                  <th style={{ padding: '6px', borderRight: '1px solid #000', fontWeight: 'bold' }}>HSN Code</th>
                  <th style={{ padding: '6px', borderRight: '1px solid #000', fontWeight: 'bold' }}>Product Name / Description</th>
                  <th style={{ padding: '6px', borderRight: '1px solid #000', fontWeight: 'bold', textAlign: 'right' }}>Quantity</th>
                  <th style={{ padding: '6px', borderRight: '1px solid #000', fontWeight: 'bold' }}>Unit</th>
                  <th style={{ padding: '6px', fontWeight: 'bold', textAlign: 'right' }}>Taxable Value (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {printItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #000' }}>
                    <td style={{ padding: '6px', borderRight: '1px solid #000' }}>{item.hsnCode}</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #000' }}>{item.productName}</td>
                    <td style={{ padding: '6px', borderRight: '1px solid #000', textAlign: 'right', fontWeight: 'bold' }}>
                      {parseFloat(item.quantity || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '6px', borderRight: '1px solid #000' }}>{item.qtyUnit || 'KGS'}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>
                      {item.taxableAmount ? `Rs. ${parseFloat(item.taxableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Rs. 0.00'}
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr style={{ fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                  <td colSpan={2} style={{ padding: '6px', textAlign: 'right', borderRight: '1px solid #000' }}>Total:</td>
                  <td style={{ padding: '6px', textAlign: 'right', borderRight: '1px solid #000' }}>
                    {printItems.reduce((s, i) => s + parseFloat(i.quantity || 0), 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '6px', borderRight: '1px solid #000' }}>{printItems[0]?.qtyUnit || 'KGS'}</td>
                  <td style={{ padding: '6px', textAlign: 'right' }}>
                    Rs. {printItems.reduce((s, i) => s + parseFloat(i.taxableAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 4. Transportation & Vehicle Details Block */}
          <div style={{ border: '1px solid #000', marginBottom: '15px' }}>
            <div style={{ backgroundColor: '#eaeaea', padding: '5px', fontWeight: 'bold', borderBottom: '1px solid #000', fontSize: '12px' }}>
              4. Transportation & Vehicle Details
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td style={{ width: '25%', padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Doc No:</td>
                  <td style={{ width: '25%', padding: '6px', borderRight: '1px solid #000', fontFamily: 'monospace', fontWeight: 'bold' }}>{docNo}</td>
                  <td style={{ width: '25%', padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Doc Date:</td>
                  <td style={{ width: '25%', padding: '6px' }}>{docDate}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Transporter Name:</td>
                  <td style={{ padding: '6px', borderRight: '1px solid #000' }}>Self / Local Transport</td>
                  <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Transporter ID:</td>
                  <td style={{ padding: '6px' }}>—</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Vehicle Number:</td>
                  <td style={{ padding: '6px', borderRight: '1px solid #000', fontWeight: 'bold', color: '#1e3a8a' }}>{vehicleNo}</td>
                  <td style={{ padding: '6px', fontWeight: 'bold', borderRight: '1px solid #000' }}>Vehicle Type:</td>
                  <td style={{ padding: '6px' }}>Regular</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* QR Code Mockup and declaration */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '30px' }}>
            <div style={{ width: '70%' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>Declaration:</p>
              <p style={{ margin: 0, fontSize: '9px', color: '#444', textAlign: 'justify' }}>
                I hereby declare that the details and information given above are true, correct, and complete to the best of my knowledge and belief. The goods described are being transported for job work purposes and are not for sale.
              </p>
              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ borderBottom: '1px solid #000', width: '120px', height: '30px' }}></div>
                  <p style={{ margin: '5px 0 0 0', fontSize: '9px', fontWeight: 'bold' }}>Prepared By</p>
                </div>
                <div style={{ marginRight: '50px' }}>
                  <div style={{ borderBottom: '1px solid #000', width: '150px', height: '30px' }}></div>
                  <p style={{ margin: '5px 0 0 0', fontSize: '9px', fontWeight: 'bold' }}>Authorized Signatory / Sender</p>
                </div>
              </div>
            </div>

            {/* QR Code SVG */}
            <div style={{ border: '1px solid #000', padding: '5px', backgroundColor: '#fff' }}>
              <svg width="80" height="80" style={{ display: 'block' }}>
                {/* QR Matrix Mockup */}
                <g fill="#000">
                  {/* Top-left position block */}
                  <rect x="0" y="0" width="20" height="20" />
                  <rect x="2" y="2" width="16" height="16" fill="#fff" />
                  <rect x="5" y="5" width="10" height="10" />

                  {/* Top-right position block */}
                  <rect x="60" y="0" width="20" height="20" />
                  <rect x="62" y="2" width="16" height="16" fill="#fff" />
                  <rect x="65" y="5" width="10" height="10" />

                  {/* Bottom-left position block */}
                  <rect x="0" y="60" width="20" height="20" />
                  <rect x="2" y="62" width="16" height="16" fill="#fff" />
                  <rect x="65" y="65" width="10" height="10" />
                  <rect x="5" y="65" width="10" height="10" />

                  {/* Random pixels */}
                  <rect x="25" y="5" width="5" height="10" />
                  <rect x="35" y="2" width="8" height="5" />
                  <rect x="48" y="8" width="5" height="12" />
                  
                  <rect x="25" y="25" width="15" height="5" />
                  <rect x="45" y="20" width="10" height="10" />
                  <rect x="60" y="25" width="8" height="8" />

                  <rect x="5" y="25" width="12" height="5" />
                  <rect x="10" y="35" width="5" height="15" />
                  
                  <rect x="25" y="45" width="5" height="20" />
                  <rect x="35" y="55" width="15" height="8" />
                  <rect x="55" y="40" width="12" height="12" />
                  
                  <rect x="30" y="35" width="8" height="8" />
                  <rect x="45" y="35" width="5" height="12" />
                  <rect x="65" y="48" width="10" height="5" />
                </g>
              </svg>
              <div style={{ fontSize: '8px', fontWeight: 'bold', textAlign: 'center', marginTop: '3px' }}>E-WAY QR</div>
            </div>
          </div>

        </div>
      </div>

       <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          .printable-content, .printable-content * {
            visibility: visible !important;
          }
          .printable-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
