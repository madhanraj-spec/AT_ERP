import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Truck,
  Package,
  ArrowRight,
  ArrowLeft,
  Search,
  X,
  Printer,
  CheckCircle,
  Loader,
  AlertTriangle,
  Trash2,
  ReceiptText,
  Plus,
  ChevronDown,
  ChevronRight,
  Edit,
  Eye
} from 'lucide-react';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtNum = (n, dec = 2) =>
  isNaN(parseFloat(n)) ? '0.00' : parseFloat(n).toFixed(dec);

const getFiscalYear = (dateStr) => {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const startYr = month >= 4 ? year : year - 1;
  const endYr = startYr + 1;
  return `${String(startYr).slice(-2)}${String(endYr).slice(-2)}`;
};

const generateBillNumber = () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `DB-${yy}${mm}-${rand}`;
};

// ─────────────────────────────────────────────
// Hub Card Component
// ─────────────────────────────────────────────
function HubCard({ icon: Icon, title, subtitle, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      className="hover-lift"
      style={{
        backgroundColor: 'white',
        border: '1px solid var(--border-current)',
        borderRadius: '18px',
        padding: '1.75rem',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.1rem',
        boxShadow: 'var(--shadow-md)',
        transition: 'all 0.3s ease-in-out',
        position: 'relative',
        overflow: 'hidden',
        borderTop: `3px solid ${accent}`
      }}
    >
      <div style={{
        position: 'absolute', right: '-18px', bottom: '-18px',
        opacity: 0.04, color: accent
      }}>
        <Icon size={130} />
      </div>
      <div style={{
        width: '52px', height: '52px', borderRadius: '14px',
        backgroundColor: accent + '14',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent
      }}>
        <Icon size={26} />
      </div>
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)', margin: 0, marginBottom: '0.3rem' }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)', margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '700', color: accent, marginTop: 'auto' }}>
        Open <ArrowRight size={14} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Package Slip Form (Creates or Edits a slip)
// ─────────────────────────────────────────────
function PackageSlipForm({ onBack, editSlipId }) {
  const [slipNumber, setSlipNumber] = useState('');
  const [slipDate, setSlipDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');
  
  // Scanned/Typed Roll Input
  const [scanInput, setScanInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedSlip, setSavedSlip] = useState(null);

  // Locked Order metadata
  const [lockedOrderId, setLockedOrderId] = useState(null);
  const [orderMetadata, setOrderMetadata] = useState({
    orderNo: '—',
    designName: '—',
    designNo: '—',
    piNumber: '—',
    poNumber: '—',
    count: '—',
    construction: '—'
  });

  // Vendor details
  const [vendorDetails, setVendorDetails] = useState({
    name: '—',
    address: '—',
    gstin: '—'
  });

  // Roll list items
  const [addedRolls, setAddedRolls] = useState([]);
  const [avgWeightMeter, setAvgWeightMeter] = useState('');
  const [displayUnit, setDisplayUnit] = useState('meters'); // 'meters' | 'yards'

  // Master lists loaded for helper displays
  const [yarnCounts, setYarnCounts] = useState([]);
  const [allWeavingOrders, setAllWeavingOrders] = useState([]);

  // Scanner modal state
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraScanError, setCameraScanError] = useState('');
  const scannerInstanceRef = useRef(null);
  const inputRef = useRef(null);

  // Preload counts, weaving orders & edit data if editSlipId is provided
  useEffect(() => {
    const preload = async () => {
      try {
        const [ycRes, woRes] = await Promise.all([
          supabase.from('master_yarn_counts').select('*'),
          supabase.from('weaving_orders').select(`
            *,
            order:orders(
              id,
              order_number,
              design_no,
              design_name,
              buyer_po_number,
              avg_weight_meter,
              technical_specs,
              vendor_id
            )
          `)
        ]);

        if (ycRes.data) setYarnCounts(ycRes.data);
        if (woRes.data) setAllWeavingOrders(woRes.data);

        // Load Edit Mode Data
        if (editSlipId) {
          setIsLoading(true);
          const { data: slipData, error: slipErr } = await supabase
            .from('dispatch_package_slips')
            .select('*, orders(order_number)')
            .eq('id', editSlipId)
            .single();

          if (slipErr) throw slipErr;

          if (slipData) {
            setSlipNumber(slipData.slip_number);
            setSlipDate(slipData.slip_date);
            setRemarks(slipData.remarks || '');
            setLockedOrderId(slipData.order_id);
            setAvgWeightMeter(slipData.avg_weight_meter ? String(slipData.avg_weight_meter) : '0.35');
            
            setOrderMetadata({
              orderNo: slipData.orders?.order_number || '—',
              designName: slipData.design_name || '—',
              designNo: slipData.design_no || '—',
              piNumber: slipData.pi_numbers || '—',
              poNumber: slipData.po_number || '—',
              count: slipData.count || '—',
              construction: slipData.construction || '—'
            });

            setVendorDetails({
              name: slipData.vendor_name || '—',
              address: slipData.vendor_address || '—',
              gstin: slipData.vendor_gstin || '—'
            });

            const formattedItems = (Array.isArray(slipData.items) ? slipData.items : []).map(item => ({
              roll_id: item.roll_id,
              qty_meters: parseFloat(item.qty || 0),
              weight: parseFloat(item.weight || 0),
              isManualWeight: false
            }));
            setAddedRolls(formattedItems);
          }
        }
      } catch (err) {
        console.error("Error preloading package slip resources:", err);
        setError("Failed to load details: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    preload();
    loadScripts();

    return () => {
      stopCameraScanner();
    };
  }, [editSlipId]);

  // Recalculate slip number dynamically when date changes (Only in create mode)
  useEffect(() => {
    if (!editSlipId) {
      fetchNextSlipNumber(slipDate);
    }
  }, [slipDate, editSlipId]);

  const loadScripts = () => {
    if (!window.Html5Qrcode) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode';
      script.async = true;
      script.onload = () => console.log('html5-qrcode library loaded.');
      document.body.appendChild(script);
    }
  };

  const fetchNextSlipNumber = async (selectedDate) => {
    const fy = getFiscalYear(selectedDate);
    try {
      const { data, error: fetchErr } = await supabase
        .from('dispatch_package_slips')
        .select('slip_number')
        .like('slip_number', `AT/${fy}/PSN/S/%`)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      let nextNum = 1;
      if (data && data.length > 0) {
        const lastNo = data[0].slip_number;
        const parts = lastNo.split('/');
        const lastSeq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastSeq)) {
          nextNum = lastSeq + 1;
        }
      }
      const seqStr = String(nextNum).padStart(5, '0');
      setSlipNumber(`AT/${fy}/PSN/S/${seqStr}`);
    } catch (err) {
      console.error("Error generating slip number:", err);
      setSlipNumber(`AT/${fy}/PSN/S/00001`);
    }
  };

  const getShortCountsString = (specs) => {
    if (!specs) return '-';
    const allWarpIds = specs.warp_selections?.flat() || [];
    const allWeftIds = specs.weft_selections?.flat() || [];
    
    const formatYarnPreview = (y) => {
      if (!y) return '';
      return [y.count_value, y.spec, y.spec1].filter(Boolean).join(' ');
    };

    const warpStr = allWarpIds.map(id => {
      const y = yarnCounts.find(yc => yc.id === id);
      return y ? formatYarnPreview(y) : '';
    }).filter(Boolean).join(' + ');

    const weftStr = allWeftIds.map(id => {
      const y = yarnCounts.find(yc => yc.id === id);
      return y ? formatYarnPreview(y) : '';
    }).filter(Boolean).join(' + ');

    return `${warpStr || '-'} X ${weftStr || '-'}`;
  };

  const startCameraScanner = () => {
    setCameraScanError('');
    if (!window.Html5Qrcode) {
      setCameraScanError('Scanner library not loaded yet. Please wait a moment and retry.');
      return;
    }
    setShowCameraScanner(true);
    setTimeout(() => {
      try {
        const html5QrCode = new window.Html5Qrcode("modal-reader");
        scannerInstanceRef.current = html5QrCode;
        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (w, h) => {
              const size = Math.min(w, h) * 0.7;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            setScanInput(decodedText);
            stopCameraScanner();
            handleAddRoll(decodedText);
          },
          () => {}
        ).catch(err => {
          console.error("Camera start error:", err);
          setCameraScanError("Could not access camera. Ensure permissions are allowed.");
        });
      } catch (err) {
        console.error("Scanner init error:", err);
        setCameraScanError("Failed to initialize camera scanner.");
      }
    }, 300);
  };

  const stopCameraScanner = () => {
    if (scannerInstanceRef.current && scannerInstanceRef.current.isScanning) {
      scannerInstanceRef.current.stop().then(() => {
        scannerInstanceRef.current = null;
        setShowCameraScanner(false);
      }).catch(err => {
        console.error("Failed to stop scanner:", err);
        setShowCameraScanner(false);
      });
    } else {
      setShowCameraScanner(false);
    }
  };

  const handleAddRoll = async (idToUse) => {
    const targetId = (idToUse || scanInput).trim();
    if (!targetId) return;

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const duplicate = addedRolls.some(r => r.roll_id.toLowerCase() === targetId.toLowerCase());
      if (duplicate) {
        setError(`Roll "${targetId}" is already added to this package slip.`);
        setIsLoading(false);
        return;
      }

      let foundRoll = null;
      let foundOrder = null;

      for (const wo of allWeavingOrders) {
        const rolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
        const match = rolls.find(r => 
          (r.processed_roll_id && r.processed_roll_id.toLowerCase() === targetId.toLowerCase()) ||
          (r.id && r.id.toLowerCase() === targetId.toLowerCase())
        );
        if (match) {
          foundRoll = match;
          foundOrder = wo;
          break;
        }
      }

      if (!foundRoll) {
        setError(`Roll ID "${targetId}" not found in database.`);
        setIsLoading(false);
        return;
      }

      if (foundRoll.washed_inspected !== true) {
        setError(`Roll "${targetId}" has not passed washed inspection. Only washed inspected rolls are allowed.`);
        setIsLoading(false);
        return;
      }

      const currentOrderId = foundOrder.order_id;

      if (lockedOrderId && currentOrderId !== lockedOrderId) {
        setError(`Roll belongs to a different order (Expected: ${orderMetadata.orderNo}). Slips are limited to one order.`);
        setIsLoading(false);
        return;
      }

      const qtyMeters = parseFloat(foundRoll.washed_actual_qty ?? 0);

      if (!lockedOrderId) {
        setLockedOrderId(currentOrderId);
        
        const { data: piData } = await supabase
          .from('proforma_invoices')
          .select('*')
          .eq('order_id', currentOrderId);
        
        const piNumbers = piData && piData.length > 0 ? piData.map(pi => pi.invoice_number).join(', ') : '—';
        const poNumber = foundOrder.order?.buyer_po_number || '—';

        let vName = '—';
        let vAddress = '—';
        let vGstin = '—';

        if (foundOrder.order?.vendor_id) {
          const { data: partnerData } = await supabase
            .from('master_partners')
            .select('*')
            .eq('id', foundOrder.order.vendor_id)
            .single();
          if (partnerData) {
            vName = partnerData.partner_name || '—';
            vAddress = partnerData.address || '—';
            vGstin = partnerData.gstin || '—';
          }
        }

        if ((vName === '—' || vAddress === '—') && piData && piData.length > 0) {
          const firstPi = piData[0];
          vName = firstPi.billed_to_name || vName;
          vAddress = firstPi.billed_to_address || vAddress;
          vGstin = firstPi.billed_to_gstin || vGstin;
        }

        const countStr = getShortCountsString(foundOrder.order?.technical_specs);
        const constrStr = foundOrder.order?.technical_specs 
          ? `${foundOrder.order.technical_specs.order_reed || '—'} / ${foundOrder.order.technical_specs.order_pick || '—'}`
          : '—';

        setOrderMetadata({
          orderNo: foundOrder.order?.order_number || '—',
          designName: foundOrder.order?.design_name || '—',
          designNo: foundOrder.order?.design_no || '—',
          piNumber: piNumbers,
          poNumber: poNumber,
          count: countStr,
          construction: constrStr
        });

        setVendorDetails({
          name: vName,
          address: vAddress,
          gstin: vGstin
        });

        const defaultAvg = parseFloat(foundOrder.order?.avg_weight_meter || 0);
        setAvgWeightMeter(defaultAvg ? defaultAvg.toString() : '0.35');
        
        const calculatedWeight = Math.round(qtyMeters * (defaultAvg || 0.35) * 1000) / 1000;
        setAddedRolls([{
          roll_id: foundRoll.processed_roll_id || foundRoll.id,
          qty_meters: qtyMeters,
          weight: calculatedWeight,
          isManualWeight: false
        }]);
      } else {
        const currentAvg = parseFloat(avgWeightMeter) || 0.35;
        const calculatedWeight = Math.round(qtyMeters * currentAvg * 1000) / 1000;
        setAddedRolls(prev => [...prev, {
          roll_id: foundRoll.processed_roll_id || foundRoll.id,
          qty_meters: qtyMeters,
          weight: calculatedWeight,
          isManualWeight: false
        }]);
      }

      setSuccess(`Roll "${targetId}" successfully added.`);
      setScanInput('');
    } catch (err) {
      console.error(err);
      setError('Error scanning roll: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (val) => {
    setScanInput(val);
    const targetId = val.trim();
    if (!targetId) return;

    let foundRoll = null;
    let foundOrder = null;
    for (const wo of allWeavingOrders) {
      const rolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
      const match = rolls.find(r => 
        (r.processed_roll_id && r.processed_roll_id.toLowerCase() === targetId.toLowerCase()) ||
        (r.id && r.id.toLowerCase() === targetId.toLowerCase())
      );
      if (match) {
        foundRoll = match;
        foundOrder = wo;
        break;
      }
    }

    if (foundRoll && foundOrder) {
      handleAddRoll(targetId);
    }
  };

  const handleRemoveRoll = (rollId) => {
    const updated = addedRolls.filter(r => r.roll_id !== rollId);
    setAddedRolls(updated);

    if (updated.length === 0) {
      setLockedOrderId(null);
      setOrderMetadata({
        orderNo: '—',
        designName: '—',
        designNo: '—',
        piNumber: '—',
        poNumber: '—',
        count: '—',
        construction: '—'
      });
      setVendorDetails({
        name: '—',
        address: '—',
        gstin: '—'
      });
      setAvgWeightMeter('');
    }
  };

  const handleAvgWeightChange = (val) => {
    setAvgWeightMeter(val);
    const numericAvg = parseFloat(val) || 0;
    setAddedRolls(prev => prev.map(item => {
      if (item.isManualWeight) return item;
      return {
        ...item,
        weight: Math.round(item.qty_meters * numericAvg * 1000) / 1000
      };
    }));
  };

  const handleItemWeightChange = (rollId, val) => {
    const numericVal = parseFloat(val) || 0;
    setAddedRolls(prev => prev.map(item => {
      if (item.roll_id === rollId) {
        return {
          ...item,
          weight: numericVal,
          isManualWeight: true
        };
      }
      return item;
    }));
  };

  const resetManualWeight = (rollId) => {
    const numericAvg = parseFloat(avgWeightMeter) || 0;
    setAddedRolls(prev => prev.map(item => {
      if (item.roll_id === rollId) {
        return {
          ...item,
          weight: Math.round(item.qty_meters * numericAvg * 1000) / 1000,
          isManualWeight: false
        };
      }
      return item;
    }));
  };

  // Totals
  const totalRollsCount = addedRolls.length;
  const totalQtyMeters = addedRolls.reduce((sum, item) => sum + item.qty_meters, 0);
  const totalQtyYards = totalQtyMeters * 1.09361;
  const totalWeightKg = addedRolls.reduce((sum, item) => sum + item.weight, 0);

  const handleSave = async () => {
    if (!slipDate) { setError('Please specify Slip Date.'); return; }
    if (addedRolls.length === 0) { setError('Please scan/add at least one roll.'); return; }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        slip_number: slipNumber,
        slip_date: slipDate,
        order_id: lockedOrderId,
        pi_numbers: orderMetadata.piNumber,
        po_number: orderMetadata.poNumber,
        vendor_name: vendorDetails.name,
        vendor_address: vendorDetails.address,
        vendor_gstin: vendorDetails.gstin,
        design_name: orderMetadata.designName,
        design_no: orderMetadata.designNo,
        count: orderMetadata.count,
        construction: orderMetadata.construction,
        avg_weight_meter: parseFloat(avgWeightMeter) || null,
        total_rolls: totalRollsCount,
        total_qty: totalQtyMeters,
        total_weight: totalWeightKg,
        remarks: remarks || null,
        items: addedRolls.map(r => ({
          roll_id: r.roll_id,
          qty: r.qty_meters,
          weight: r.weight
        }))
      };

      let result;
      if (editSlipId) {
        result = await supabase
          .from('dispatch_package_slips')
          .update(payload)
          .eq('id', editSlipId)
          .select()
          .single();
      } else {
        result = await supabase
          .from('dispatch_package_slips')
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      setSavedSlip(result.data);
      setSuccess(`Package Slip ${editSlipId ? 'updated' : 'saved'} successfully!`);
    } catch (err) {
      if (err.message?.includes('does not exist') || err.code === '42P01') {
        setError('⚠️ The dispatch_package_slips database table does not exist. Please run migration_add_dispatch_module.sql first.');
      } else {
        setError('Error saving package slip: ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
    border: '1.5px solid var(--border-current)', fontSize: '0.85rem',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'inherit', color: 'var(--text-current)'
  };
  const labelStyle = { fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em' };

  return (
    <div className="fade-in" style={{ width: '100%' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={onBack} style={{ background: 'rgba(128,0,0,0.07)', border: 'none', borderRadius: '10px', padding: '0.5rem', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--color-primary)', margin: 0 }}>
            {editSlipId ? 'Edit Package Slip' : 'Create Package Slip'}
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)', margin: 0 }}>
            Slip No: <strong style={{ fontFamily: 'monospace', color: 'var(--text-current)' }}>{slipNumber || '...'}</strong>
          </p>
        </div>
      </div>

      {error && <div className="no-print" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="no-print" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.75rem 1rem', color: '#16a34a', fontSize: '0.85rem', marginBottom: '1rem' }}>{success}</div>}

      {/* Main Grid */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        
        {/* Left Card: Input details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 1.25rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scan washed inspected rolls</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={labelStyle}>Slip Date *</span>
                <input type="date" value={slipDate} onChange={e => setSlipDate(e.target.value)} style={inputStyle} disabled={!!editSlipId} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={labelStyle}>Enter / Scan Roll ID</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Enter processed roll ID (e.g. PR-...)"
                    value={scanInput}
                    onChange={e => handleInputChange(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddRoll()}
                    style={inputStyle}
                  />
                  <button
                    onClick={() => handleAddRoll()}
                    disabled={isLoading}
                    style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 1rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Add
                  </button>
                  <button
                    onClick={startCameraScanner}
                    style={{ background: 'rgba(128,0,0,0.07)', color: 'var(--color-primary)', border: '1.5px solid rgba(128,0,0,0.2)', borderRadius: '8px', padding: '0 0.8rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Camera
                  </button>
                </div>
              </div>
            </div>
          </div>

          {lockedOrderId && (
            <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weight & Unit Settings</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={labelStyle}>Avg Weight / Meter (kg)</span>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={avgWeightMeter}
                    onChange={e => handleAvgWeightChange(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={labelStyle}>Display Unit</span>
                  <div style={{ display: 'flex', border: '1.5px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
                    {['meters', 'yards'].map(u => (
                      <button
                        key={u}
                        onClick={() => setDisplayUnit(u)}
                        style={{
                          flex: 1, padding: '0.5rem', border: 'none', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer',
                          background: displayUnit === u ? 'var(--color-primary)' : 'white',
                          color: displayUnit === u ? 'white' : 'var(--text-current)',
                          transition: 'all 0.2s'
                        }}
                      >
                        {u.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Card: Auto-populated details */}
        <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 1.25rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-populated Details</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ ...labelStyle, display: 'block', marginBottom: '0.2rem' }}>Vendor Details</span>
              <div style={{ border: '1px solid var(--border-current)', borderRadius: '10px', padding: '0.75rem', background: '#fafafa' }}>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Name:</strong> {vendorDetails.name}</p>
                <p style={{ margin: '0 0 0.25rem 0' }}><strong>Address:</strong> {vendorDetails.address}</p>
                <p style={{ margin: 0 }}><strong>GSTIN:</strong> {vendorDetails.gstin}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <span style={labelStyle}>Order Number</span>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '0.9rem' }}>{orderMetadata.orderNo}</p>
              </div>
              <div>
                <span style={labelStyle}>Design Name / No</span>
                <p style={{ margin: 0, fontWeight: '700' }}>{orderMetadata.designName} ({orderMetadata.designNo})</p>
              </div>
              <div>
                <span style={labelStyle}>PI Number</span>
                <p style={{ margin: 0, fontWeight: '700' }}>{orderMetadata.piNumber}</p>
              </div>
              <div>
                <span style={labelStyle}>PO Number</span>
                <p style={{ margin: 0, fontWeight: '700' }}>{orderMetadata.poNumber}</p>
              </div>
              <div>
                <span style={labelStyle}>Count</span>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '0.8rem', color: 'var(--color-primary)' }}>{orderMetadata.count}</p>
              </div>
              <div>
                <span style={labelStyle}>Construction</span>
                <p style={{ margin: 0, fontWeight: '700' }}>{orderMetadata.construction}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
              <span style={labelStyle}>Remarks</span>
              <input type="text" placeholder="Optional notes/remarks" value={remarks} onChange={e => setRemarks(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>
      </div>

      {/* Rolls Table */}
      {addedRolls.length > 0 && (
        <div className="no-print" style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rolls List ({totalRollsCount})
            </h3>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#fdf0f0' }}>
                  {['S.No', 'Roll / Piece ID', `Qty (${displayUnit === 'meters' ? 'Meters' : 'Yards'})`, 'Weight (kg)', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '800', color: 'var(--color-primary)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {addedRolls.map((r, idx) => {
                  const displayQty = displayUnit === 'meters' ? r.qty_meters : r.qty_meters * 1.09361;
                  return (
                    <tr key={r.roll_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted-current)', fontWeight: '700' }}>{idx + 1}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: '700' }}>{r.roll_id}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700' }}>{fmtNum(displayQty)}</td>
                      <td style={{ padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="number"
                          step="0.001"
                          value={r.weight}
                          onChange={e => handleItemWeightChange(r.roll_id, e.target.value)}
                          style={{ ...inputStyle, width: '100px', textAlign: 'right', padding: '0.35rem' }}
                        />
                        {r.isManualWeight && (
                          <button
                            onClick={() => resetManualWeight(r.roll_id)}
                            style={{ border: 'none', background: '#f3f4f6', borderRadius: '4px', padding: '0.2rem 0.4rem', cursor: 'pointer', fontSize: '0.7rem' }}
                          >
                            Reset
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <button onClick={() => handleRemoveRoll(r.roll_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#fdf9f9', borderTop: '2px solid var(--border-current)' }}>
                  <td colSpan={2} style={{ padding: '0.6rem 0.75rem', fontWeight: '800', fontSize: '0.82rem' }}>Total</td>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                    {fmtNum(displayUnit === 'meters' ? totalQtyMeters : totalQtyYards)} {displayUnit === 'meters' ? 'Mtrs' : 'Yds'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                    {fmtNum(totalWeightKg, 3)} kg
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="no-print" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button onClick={onBack} style={{ background: 'rgba(128,0,0,0.06)', color: 'var(--color-primary)', border: '1.5px solid rgba(128,0,0,0.2)', borderRadius: '10px', padding: '0.6rem 1.5rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.87rem' }}>
          Back
        </button>
        {savedSlip && (
          <button onClick={() => window.print()} style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.5rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.87rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={15} /> Print Slip
          </button>
        )}
        <button onClick={handleSave} disabled={isLoading} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.5rem', cursor: isLoading ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.87rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isLoading ? 0.7 : 1 }}>
          {isLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={15} />}
          {isLoading ? 'Saving...' : 'Save Slip'}
        </button>
      </div>

      {showCameraScanner && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, color: 'var(--color-primary)' }}>Camera Scanner</h4>
              <button onClick={stopCameraScanner} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
            </div>
            {cameraScanError ? (
              <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{cameraScanError}</div>
            ) : (
              <div id="modal-reader" style={{ width: '100%', overflow: 'hidden', borderRadius: '8px' }} />
            )}
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280', textAlign: 'center' }}>Point camera at roll barcode / QR tag.</p>
          </div>
        </div>
      )}

      {/* Print Copy Layout */}
      {(savedSlip || addedRolls.length > 0) && (
        <div className="print-only-container" style={{ display: 'none' }}>
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 0;
              }
              body {
                margin: 0;
                -webkit-print-color-adjust: exact;
              }
              body * {
                visibility: hidden;
              }
              .print-only-container, .print-only-container * {
                visibility: visible;
              }
              .print-only-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                display: block !important;
                background: white;
                color: black;
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>
          
          {[1, 2].map((copyNum, cIdx) => (
            <div key={copyNum} style={{
              height: '132mm',
              maxHeight: '132mm',
              overflow: 'hidden',
              boxSizing: 'border-box',
              padding: '4mm 8mm',
              borderBottom: cIdx === 0 ? '2px dashed #000' : 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative'
            }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #000', paddingBottom: '3mm', marginBottom: '2mm' }}>
                <div style={{ display: 'flex', gap: '8mm', alignItems: 'center' }}>
                  <img src="/logo.png" alt="AT Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                  <div>
                    <h1 style={{ margin: '0 0 1px 0', fontSize: '15px', fontWeight: '950', letterSpacing: '0.5px' }}>ASHOK TEXTILES</h1>
                    <p style={{ margin: '0 0 1px 0', fontSize: '8px' }}>6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33</p>
                    <p style={{ margin: 0, fontSize: '8px' }}><strong>GSTIN:</strong> 33AAZFA60686D1Z6</p>
                  </div>
                </div>
                
                <div style={{ textAlign: 'center', padding: '0 4mm' }}>
                  <h2 style={{ margin: 0, fontSize: '13px', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>PACKAGE SLIP</h2>
                  <div style={{ fontSize: '8px', fontWeight: 'bold', border: '1px solid #000', padding: '1px 3px', borderRadius: '3px', marginTop: '1mm', display: 'inline-block' }}>
                    {copyNum === 1 ? 'COPY 1 — OFFICE' : 'COPY 2 — TRANSPORTER'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(slipNumber || 'SLIP')}`}
                    alt="QR Code"
                    style={{ width: '40px', height: '40px', border: '1px solid #ddd' }}
                  />
                  <span style={{ fontSize: '6px', marginTop: '1px', fontFamily: 'monospace' }}>{slipNumber}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4mm', marginBottom: '2mm', fontSize: '9px' }}>
                <div style={{ border: '1px solid #000', borderRadius: '4px', padding: '2mm' }}>
                  <h4 style={{ margin: '0 0 1mm 0', fontSize: '7.5px', textTransform: 'uppercase', color: '#555', fontWeight: 'bold' }}>Consigned To / Vendor</h4>
                  <p style={{ margin: '0 0 1px 0', fontWeight: 'bold', fontSize: '9.5px' }}>{vendorDetails.name}</p>
                  <p style={{ margin: '0 0 1px 0', lineHeight: '1.2' }}>{vendorDetails.address}</p>
                  <p style={{ margin: 0 }}><strong>GSTIN:</strong> {vendorDetails.gstin}</p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #000', borderRadius: '4px', padding: '2mm' }}>
                  <p style={{ margin: 0 }}><strong>Slip Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '10px' }}>{slipNumber}</span></p>
                  <p style={{ margin: 0 }}><strong>Slip Date:</strong> {formatDate(slipDate)}</p>
                  <p style={{ margin: 0 }}><strong>PO Number:</strong> {orderMetadata.poNumber}</p>
                  <p style={{ margin: 0 }}><strong>PI Number:</strong> {orderMetadata.piNumber}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2mm', background: '#fafafa', border: '1px solid #000', borderRadius: '4px', padding: '1.5mm 2mm', marginBottom: '2mm', fontSize: '8.5px' }}>
                <div><strong>Order No:</strong><br />{orderMetadata.orderNo}</div>
                <div><strong>Design Name/No:</strong><br />{orderMetadata.designName} / {orderMetadata.designNo}</div>
                <div><strong>Count:</strong><br />{orderMetadata.count}</div>
                <div><strong>Construction:</strong><br />{orderMetadata.construction}</div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', minHeight: '40mm' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'left' }}>S.No</th>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'left' }}>Roll / Piece ID</th>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'right' }}>Qty ({displayUnit === 'meters' ? 'Meters' : 'Yards'})</th>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'right' }}>Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {addedRolls.map((r, rIdx) => {
                      const displayQty = displayUnit === 'meters' ? r.qty_meters : r.qty_meters * 1.09361;
                      return (
                        <tr key={r.roll_id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ border: '1px solid #ccc', padding: '1mm 1.5mm' }}>{rIdx + 1}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1mm 1.5mm', fontFamily: 'monospace' }}>{r.roll_id}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1mm 1.5mm', textAlign: 'right' }}>{fmtNum(displayQty)}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1mm 1.5mm', textAlign: 'right' }}>{fmtNum(r.weight, 3)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4mm', borderTop: '1.5px solid #000', paddingTop: '2mm', marginTop: '2mm', fontSize: '9px', fontWeight: 'bold' }}>
                <div>Total Rolls: {totalRollsCount}</div>
                <div style={{ textAlign: 'center' }}>Total Qty: {fmtNum(displayUnit === 'meters' ? totalQtyMeters : totalQtyYards)} {displayUnit === 'meters' ? 'Mtrs' : 'Yds'}</div>
                <div style={{ textAlign: 'right' }}>Total Weight: {fmtNum(totalWeightKg, 3)} kg</div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Multi-Select Dropdown Filter Component
// ─────────────────────────────────────────────
function MultiSelectFilter({ label, options, selectedValues, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const clickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  const toggleOption = (val) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid var(--border-current)',
          background: 'white', cursor: 'pointer', fontSize: '0.82rem', minHeight: '34px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box'
        }}
      >
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px', fontWeight: selectedValues.length ? 'bold' : 'normal' }}>
          {selectedValues.length === 0 ? 'All' : `${selectedValues.length} Selected`}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted-current)' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, background: 'white',
          border: '1.5px solid var(--border-current)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)',
          zIndex: 200, maxHeight: '180px', overflowY: 'auto', marginTop: '4px', padding: '0.4rem'
        }}>
          {options.length === 0 ? (
            <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>No options</div>
          ) : (
            options.map(opt => {
              const isChecked = selectedValues.includes(opt);
              return (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.5rem', cursor: 'pointer', borderRadius: '4px', fontSize: '0.8rem' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOption(opt)}
                    style={{ cursor: 'pointer', marginRight: '4px' }}
                  />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{opt || '—'}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Package Slip List (Dashboard list of slips)
// ─────────────────────────────────────────────
function PackageSlipList({ onCreateNew, onEdit, onPrint }) {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterSlipNo, setFilterSlipNo] = useState([]);
  const [filterOrderNo, setFilterOrderNo] = useState([]);
  const [filterDesignName, setFilterDesignName] = useState([]);
  const [filterDesignNo, setFilterDesignNo] = useState([]);
  const [filterPiNumber, setFilterPiNumber] = useState([]);
  const [filterPoNumber, setFilterPoNumber] = useState([]);
  const [filterVendor, setFilterVendor] = useState([]);

  const fetchSlips = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('dispatch_package_slips')
        .select('*, orders(order_number)')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setSlips(data || []);
    } catch (err) {
      console.error("Error loading slips list:", err);
      setError("Failed to load generated package slips: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlips();
  }, []);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleClearFilters = () => {
    setFilterSlipNo([]);
    setFilterOrderNo([]);
    setFilterDesignName([]);
    setFilterDesignNo([]);
    setFilterPiNumber([]);
    setFilterPoNumber([]);
    setFilterVendor([]);
  };

  // Interdependent Option Generation
  const getOptionsForFilter = (key) => {
    const tempFilters = {
      slipNumbers: key === 'slipNumbers' ? [] : filterSlipNo,
      orderNumbers: key === 'orderNumbers' ? [] : filterOrderNo,
      designNames: key === 'designNames' ? [] : filterDesignName,
      designNumbers: key === 'designNumbers' ? [] : filterDesignNo,
      piNumbers: key === 'piNumbers' ? [] : filterPiNumber,
      poNumbers: key === 'poNumbers' ? [] : filterPoNumber,
      vendors: key === 'vendors' ? [] : filterVendor
    };

    const filtered = slips.filter(s => {
      const matchSlip = tempFilters.slipNumbers.length === 0 || tempFilters.slipNumbers.includes(s.slip_number);
      const matchOrder = tempFilters.orderNumbers.length === 0 || tempFilters.orderNumbers.includes(s.orders?.order_number);
      const matchDesignName = tempFilters.designNames.length === 0 || tempFilters.designNames.includes(s.design_name);
      const matchDesignNo = tempFilters.designNumbers.length === 0 || tempFilters.designNumbers.includes(s.design_no);
      const matchPi = tempFilters.piNumbers.length === 0 || tempFilters.piNumbers.some(pi => s.pi_numbers?.split(',').map(x => x.trim()).includes(pi));
      const matchPo = tempFilters.poNumbers.length === 0 || tempFilters.poNumbers.includes(s.po_number);
      const matchVendor = tempFilters.vendors.length === 0 || tempFilters.vendors.includes(s.vendor_name);

      return matchSlip && matchOrder && matchDesignName && matchDesignNo && matchPi && matchPo && matchVendor;
    });

    let values = [];
    if (key === 'slipNumbers') {
      values = filtered.map(s => s.slip_number);
    } else if (key === 'orderNumbers') {
      values = filtered.map(s => s.orders?.order_number).filter(Boolean);
    } else if (key === 'designNames') {
      values = filtered.map(s => s.design_name).filter(Boolean);
    } else if (key === 'designNumbers') {
      values = filtered.map(s => s.design_no).filter(Boolean);
    } else if (key === 'piNumbers') {
      values = filtered.flatMap(s => s.pi_numbers ? s.pi_numbers.split(',').map(pi => pi.trim()) : []).filter(Boolean);
    } else if (key === 'poNumbers') {
      values = filtered.map(s => s.po_number).filter(Boolean);
    } else if (key === 'vendors') {
      values = filtered.map(s => s.vendor_name).filter(Boolean);
    }

    return [...new Set(values)].sort();
  };

  // Final Filtered list of slips to render in the table
  const filteredSlips = slips.filter(s => {
    const matchSlip = filterSlipNo.length === 0 || filterSlipNo.includes(s.slip_number);
    const matchOrder = filterOrderNo.length === 0 || filterOrderNo.includes(s.orders?.order_number);
    const matchDesignName = filterDesignName.length === 0 || filterDesignName.includes(s.design_name);
    const matchDesignNo = filterDesignNo.length === 0 || filterDesignNo.includes(s.design_no);
    const matchPi = filterPiNumber.length === 0 || filterPiNumber.some(pi => s.pi_numbers?.split(',').map(x => x.trim()).includes(pi));
    const matchPo = filterPoNumber.length === 0 || filterPoNumber.includes(s.po_number);
    const matchVendor = filterVendor.length === 0 || filterVendor.includes(s.vendor_name);

    return matchSlip && matchOrder && matchDesignName && matchDesignNo && matchPi && matchPo && matchVendor;
  });

  const hasActiveFilters = (
    filterSlipNo.length > 0 ||
    filterOrderNo.length > 0 ||
    filterDesignName.length > 0 ||
    filterDesignNo.length > 0 ||
    filterPiNumber.length > 0 ||
    filterPoNumber.length > 0 ||
    filterVendor.length > 0
  );

  return (
    <div className="fade-in">
      {/* Top Header Row with Title and Top Right Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #800000, #4d0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(128,0,0,0.35)' }}>
              <Package size={22} color="white" />
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: '900', color: 'var(--color-primary)', margin: 0 }}>Package Slips</h1>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted-current)', margin: 0, paddingLeft: '56px' }}>
            View, search, edit and print generated package slips.
          </p>
        </div>

        <button
          onClick={onCreateNew}
          style={{
            background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '10px',
            padding: '0.6rem 1.25rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)'
          }}
        >
          <Plus size={16} /> Create New Package Slip
        </button>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}

      {/* Expandable Filter Toggle bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            background: showFilters ? 'rgba(128,0,0,0.05)' : 'white', border: '1.5px solid var(--border-current)', borderRadius: '10px',
            padding: '0.55rem 1.25rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700',
            display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-current)'
          }}
        >
          <Search size={15} /> {showFilters ? 'Hide Filters' : 'Show Filters'}
          {hasActiveFilters && (
            <span style={{ background: 'var(--color-primary)', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold' }}>
              !
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            style={{
              background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700'
            }}
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Expandable Filter Box */}
      {showFilters && (
        <div style={{ background: '#fcfcfc', border: '1.5px solid var(--border-current)', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            <MultiSelectFilter
              label="Slip Number"
              options={getOptionsForFilter('slipNumbers')}
              selectedValues={filterSlipNo}
              onChange={setFilterSlipNo}
            />
            <MultiSelectFilter
              label="Order Number"
              options={getOptionsForFilter('orderNumbers')}
              selectedValues={filterOrderNo}
              onChange={setFilterOrderNo}
            />
            <MultiSelectFilter
              label="Design Name"
              options={getOptionsForFilter('designNames')}
              selectedValues={filterDesignName}
              onChange={setFilterDesignName}
            />
            <MultiSelectFilter
              label="Design Number"
              options={getOptionsForFilter('designNumbers')}
              selectedValues={filterDesignNo}
              onChange={setFilterDesignNo}
            />
            <MultiSelectFilter
              label="PI Number"
              options={getOptionsForFilter('piNumbers')}
              selectedValues={filterPiNumber}
              onChange={setFilterPiNumber}
            />
            <MultiSelectFilter
              label="PO Number"
              options={getOptionsForFilter('poNumbers')}
              selectedValues={filterPoNumber}
              onChange={setFilterPoNumber}
            />
            <MultiSelectFilter
              label="Vendor"
              options={getOptionsForFilter('vendors')}
              selectedValues={filterVendor}
              onChange={setFilterVendor}
            />
          </div>
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.5rem', color: 'var(--color-primary)' }}>
            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> loading package slips...
          </div>
        ) : filteredSlips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted-current)', fontSize: '0.9rem' }}>
            {hasActiveFilters ? 'No package slips match the selected filter criteria.' : 'No package slips have been generated yet.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1.5px solid var(--border-current)' }}>
                  <th style={{ width: '40px' }}></th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800' }}>Slip Date</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800' }}>Slip Number</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800' }}>Order No</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800' }}>Design Name & No</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800' }}>PI Number</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800' }}>PO Number</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '800' }}>Vendor Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>Rolls</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>Total Qty (m)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '800' }}>Total Wt (kg)</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '800' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: '800' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlips.map(s => {
                  const isExpanded = !!expandedRows[s.id];
                  return (
                    <React.Fragment key={s.id}>
                      <tr style={{ borderBottom: '1px solid #eee', transition: 'background 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ textAlign: 'center', cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => toggleRow(s.id)}>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{formatDate(s.slip_date)}</td>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{s.slip_number}</td>
                        <td style={{ padding: '0.75rem', fontWeight: '700' }}>{s.orders?.order_number || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{s.design_name} / {s.design_no}</td>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{s.pi_numbers || '—'}</td>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{s.po_number || '—'}</td>
                        <td style={{ padding: '0.75rem' }}>{s.vendor_name}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>{s.total_rolls}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{fmtNum(s.total_qty)} m</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>{fmtNum(s.total_weight, 3)} kg</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                            Created
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => onEdit(s.id)}
                                title="Edit Slip"
                                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', padding: '0.2rem' }}
                            >
                              <Edit size={16} />
                            </button>
                            <button
                                onClick={() => onPrint(s)}
                                title="Print Slip"
                                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', padding: '0.2rem' }}
                            >
                              <Printer size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded rows view */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={13} style={{ background: '#fcfcfc', padding: '1rem 1.5rem', borderBottom: '1px solid #eee' }}>
                            <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: '1rem' }}>
                              <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Included Rolls ({s.items?.length || 0})
                              </h5>
                              <table style={{ width: '100%', maxWidth: '600px', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid #ddd', color: '#6b7280' }}>
                                    <th style={{ padding: '0.4rem', textAlign: 'left' }}>S.No</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'left' }}>Roll ID</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'right' }}>Quantity (m)</th>
                                    <th style={{ padding: '0.4rem', textAlign: 'right' }}>Weight (kg)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(s.items || []).map((item, idx) => (
                                    <tr key={item.roll_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                      <td style={{ padding: '0.4rem', color: '#9ca3af' }}>{idx + 1}</td>
                                      <td style={{ padding: '0.4rem', fontFamily: 'monospace', fontWeight: '700' }}>{item.roll_id}</td>
                                      <td style={{ padding: '0.4rem', textAlign: 'right' }}>{fmtNum(item.qty)} m</td>
                                      <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: '700' }}>{fmtNum(item.weight, 3)} kg</td>
                                    </tr>
                                  ))}
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
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Bill Form
// ─────────────────────────────────────────────
function BillForm({ onBack }) {
  const [billNumber] = useState(generateBillNumber());
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [buyerId, setBuyerId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [showOrderDrop, setShowOrderDrop] = useState(false);

  const [buyers, setBuyers] = useState([]);
  const [orders, setOrders] = useState([]);

  const [hsnCode, setHsnCode] = useState('5208');
  const [uom, setUom] = useState('Meter');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [discountPct, setDiscountPct] = useState('0');
  const [cgstPct, setCgstPct] = useState('2.5');
  const [sgstPct, setSgstPct] = useState('2.5');
  const [igstPct, setIgstPct] = useState('0');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [remarks, setRemarks] = useState('');
  const [bankDetails, setBankDetails] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedBill, setSavedBill] = useState(null);

  useEffect(() => {
    supabase.from('master_brands').select('id, brand_name').order('brand_name').then(({ data }) => setBuyers(data || []));
    supabase.from('orders').select('id, order_number, design_name, design_no').order('created_at', { ascending: false }).limit(100).then(({ data }) => setOrders(data || []));
  }, []);

  const filteredOrders = orders.filter(o =>
    !orderSearch || o.order_number?.toLowerCase().includes(orderSearch.toLowerCase()) || o.design_name?.toLowerCase().includes(orderSearch.toLowerCase())
  );
  const selectedOrder = orders.find(o => o.id === orderId);

  // calculations
  const amount = parseFloat(qty || 0) * parseFloat(rate || 0);
  const discountAmt = amount * (parseFloat(discountPct || 0) / 100);
  const taxableValue = amount - discountAmt;
  const cgstAmt = taxableValue * (parseFloat(cgstPct || 0) / 100);
  const sgstAmt = taxableValue * (parseFloat(sgstPct || 0) / 100);
  const igstAmt = taxableValue * (parseFloat(igstPct || 0) / 100);
  const totalGst = cgstAmt + sgstAmt + igstAmt;
  const totalBill = taxableValue + totalGst;

  const handleSave = async () => {
    if (!billDate || !qty || !rate) { setError('Please fill in Bill Date, Qty, and Rate.'); return; }
    setLoading(true);
    setError('');
    try {
      const payload = {
        bill_number: billNumber,
        bill_date: billDate,
        buyer_id: buyerId || null,
        order_id: orderId || null,
        package_slip_ids: [],
        hsn_code: hsnCode || null,
        uom,
        qty: parseFloat(qty),
        rate: parseFloat(rate),
        amount,
        discount_percent: parseFloat(discountPct || 0),
        taxable_value: taxableValue,
        cgst_percent: parseFloat(cgstPct || 0),
        cgst_amount: cgstAmt,
        sgst_percent: parseFloat(sgstPct || 0),
        sgst_amount: sgstAmt,
        igst_percent: parseFloat(igstPct || 0),
        igst_amount: igstAmt,
        total_gst_amount: totalGst,
        total_bill_price: totalBill,
        payment_terms: paymentTerms || null,
        remarks: remarks || null,
        bank_details: bankDetails || null
      };
      const { data, error: err } = await supabase.from('dispatch_bills').insert(payload).select().single();
      if (err) throw err;
      setSavedBill(data);
      setSuccess('Bill saved successfully!');
    } catch (e) {
      if (e.message?.includes('does not exist') || e.code === '42P01') {
        setError('The dispatch_bills table does not exist yet. Please run migration_add_dispatch_module.sql first.');
      } else {
        setError('Error saving bill: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px',
    border: '1.5px solid var(--border-current)', fontSize: '0.85rem',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'inherit', color: 'var(--text-current)'
  };
  const labelStyle = { fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em' };
  const calcRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', fontSize: '0.85rem' };

  return (
    <div className="fade-in" style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={onBack} style={{ background: 'rgba(128,0,0,0.07)', border: 'none', borderRadius: '10px', padding: '0.5rem', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--color-primary)', margin: 0 }}>Create Dispatch Bill</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)', margin: 0 }}>Bill No: <strong style={{ fontFamily: 'monospace', color: 'var(--text-current)' }}>{billNumber}</strong></p>
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.75rem 1rem', color: '#16a34a', fontSize: '0.85rem', marginBottom: '1rem' }}>
        {success}
        <button onClick={() => window.print()} style={{ marginLeft: '1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem' }}>
          <Printer size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />Print
        </button>
      </div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Left Col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Bill details */}
          <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.25rem', boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bill Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>Bill Date *</span>
                <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>Buyer</span>
                <select value={buyerId} onChange={e => setBuyerId(e.target.value)} style={inputStyle}>
                  <option value="">Select buyer...</option>
                  {buyers.map(b => <option key={b.id} value={b.id}>{b.brand_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', position: 'relative' }}>
                <span style={labelStyle}>Order</span>
                <input
                  type="text"
                  placeholder="Search order..."
                  value={selectedOrder ? `${selectedOrder.order_number} — ${selectedOrder.design_name || ''}` : orderSearch}
                  onFocus={() => setShowOrderDrop(true)}
                  onChange={e => { setOrderSearch(e.target.value); setOrderId(''); setShowOrderDrop(true); }}
                  style={inputStyle}
                />
                {showOrderDrop && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', zIndex: 50, maxHeight: '180px', overflowY: 'auto', marginTop: '2px' }}>
                    {filteredOrders.slice(0, 30).map(o => (
                      <div key={o.id} onClick={() => { setOrderId(o.id); setOrderSearch(''); setShowOrderDrop(false); }}
                        style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        <strong>{o.order_number}</strong>{o.design_name ? ` — ${o.design_name}` : ''}
                      </div>
                    ))}
                    {filteredOrders.length === 0 && <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>No orders found</div>}
                    <div onClick={() => setShowOrderDrop(false)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', cursor: 'pointer', borderTop: '1px solid #f3f4f6' }}>Close</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Item line */}
          <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.25rem', boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item Line</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>HSN Code</span>
                  <input value={hsnCode} onChange={e => setHsnCode(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>UOM</span>
                  <select value={uom} onChange={e => setUom(e.target.value)} style={inputStyle}>
                    <option>Meter</option><option>Kg</option><option>Piece</option><option>Roll</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>Qty *</span>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>Rate per unit *</span>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={rate} onChange={e => setRate(e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>Discount %</span>
                <input type="number" min="0" max="100" step="0.01" value={discountPct} onChange={e => setDiscountPct(e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
              </div>
            </div>
          </div>

          {/* Tax */}
          <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.25rem', boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tax (GST)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>CGST %</span>
                <input type="number" min="0" step="0.5" value={cgstPct} onChange={e => setCgstPct(e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>SGST %</span>
                <input type="number" min="0" step="0.5" value={sgstPct} onChange={e => setSgstPct(e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>IGST %</span>
                <input type="number" min="0" step="0.5" value={igstPct} onChange={e => setIgstPct(e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Live Summary */}
          <div style={{ background: 'linear-gradient(135deg, #4d0000 0%, #800000 100%)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 8px 24px rgba(128,0,0,0.3)', color: 'white' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', margin: '0 0 1.2rem 0', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>Bill Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {[
                ['Amount', fmtNum(amount)],
                [`Discount (${discountPct}%)`, `- ${fmtNum(discountAmt)}`],
                ['Taxable Value', fmtNum(taxableValue)],
                [`CGST (${cgstPct}%)`, fmtNum(cgstAmt)],
                [`SGST (${sgstPct}%)`, fmtNum(sgstAmt)],
                [`IGST (${igstPct}%)`, fmtNum(igstAmt)],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ ...calcRowStyle, borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                  <span>{lbl}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0 0 0', marginTop: '0.25rem' }}>
                <span style={{ fontWeight: '900', fontSize: '1rem' }}>Total Bill</span>
                <span style={{ fontWeight: '900', fontSize: '1.25rem', fontFamily: 'monospace' }}>{fmtNum(totalBill)}</span>
              </div>
            </div>
          </div>

          {/* Addl fields */}
          <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.25rem', boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Additional Info</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>Payment Terms</span>
                <input type="text" placeholder="e.g. 30 days net" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>Bank Details</span>
                <textarea rows={2} placeholder="Bank name, Account No, IFSC..." value={bankDetails} onChange={e => setBankDetails(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>Remarks</span>
                <input type="text" placeholder="Optional remarks" value={remarks} onChange={e => setRemarks(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
        <button onClick={onBack} style={{ background: 'rgba(128,0,0,0.06)', color: 'var(--color-primary)', border: '1.5px solid rgba(128,0,0,0.2)', borderRadius: '10px', padding: '0.6rem 1.5rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.87rem' }}>
          Back
        </button>
        {savedBill && (
          <button onClick={() => window.print()} style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.5rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.87rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={15} /> Print Bill
          </button>
        )}
        <button onClick={handleSave} disabled={loading} style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '0.6rem 1.5rem', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.87rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: loading ? 0.7 : 1 }}>
          {loading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={15} />}
          {loading ? 'Saving...' : 'Save Bill'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main DispatchModule
// ─────────────────────────────────────────────
export default function DispatchModule() {
  const { profile } = useAuth();
  const location = useLocation();
  
  // 'menu' | 'package_slip_list' | 'package_slip_create' | 'package_slip_edit' | 'bill'
  const [view, setView] = useState('menu');
  const [selectedSlipId, setSelectedSlipId] = useState(null);
  const [printSlipData, setPrintSlipData] = useState(null);

  // Reset view when hitting sidebar link
  useEffect(() => {
    setView('menu');
    setSelectedSlipId(null);
    setPrintSlipData(null);
  }, [location.key]);

  const handlePrintSlipDirectly = (slip) => {
    setPrintSlipData(slip);
    // Give state a small frame to update and render the print block, then print
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div style={{ padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ─── Menu Hub ─── */}
      {view === 'menu' && (
        <div className="fade-in">
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #800000, #4d0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(128,0,0,0.35)' }}>
                <Truck size={22} color="white" />
              </div>
              <h1 style={{ fontSize: '1.65rem', fontWeight: '900', color: 'var(--color-primary)', margin: 0 }}>Dispatch</h1>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted-current)', margin: 0, paddingLeft: '56px' }}>
              Manage package slips, commercial bills, and outbound dispatch operations.
            </p>
          </div>

          <div style={{ fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted-current)', marginBottom: '0.75rem' }}>
            Create / View
          </div>

          <style>{`
            .dispatch-hub-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 1.25rem;
            }
            @media (max-width: 640px) {
              .dispatch-hub-grid {
                grid-template-columns: 1fr;
              }
            }
          `}</style>

          <div className="dispatch-hub-grid">
            <HubCard
              icon={Package}
              title="Package Slips"
              subtitle="View, edit, search, and print all generated package slips."
              accent="#800000"
              onClick={() => setView('package_slip_list')}
            />
            <HubCard
              icon={ReceiptText}
              title="Create New Bill"
              subtitle="Raise a commercial dispatch bill with GST breakdown and printable invoice."
              accent="#2563eb"
              onClick={() => setView('bill')}
            />
          </div>

          <div style={{ marginTop: '2.5rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <AlertTriangle size={18} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '0.85rem', color: '#92400e' }}>Database Setup Required</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#78350f' }}>
                To persist data, run <code style={{ background: '#fef3c7', padding: '0 4px', borderRadius: '4px' }}>database/migration_add_dispatch_module.sql</code> in your Supabase SQL editor. Until then, the save operation will show a guidance message.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Package Slip List View ─── */}
      {view === 'package_slip_list' && (
        <PackageSlipList
          onCreateNew={() => setView('package_slip_create')}
          onEdit={(id) => {
            setSelectedSlipId(id);
            setView('package_slip_edit');
          }}
          onPrint={handlePrintSlipDirectly}
        />
      )}

      {/* ─── Package Slip Create Form ─── */}
      {view === 'package_slip_create' && (
        <PackageSlipForm onBack={() => setView('package_slip_list')} />
      )}

      {/* ─── Package Slip Edit Form ─── */}
      {view === 'package_slip_edit' && (
        <PackageSlipForm
          editSlipId={selectedSlipId}
          onBack={() => {
            setSelectedSlipId(null);
            setView('package_slip_list');
          }}
        />
      )}

      {/* ─── Bill Form ─── */}
      {view === 'bill' && (
        <BillForm onBack={() => setView('menu')} />
      )}

      {/* Direct print container (for List page printing) */}
      {printSlipData && (
        <div className="print-only-container" style={{ display: 'none' }}>
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 0;
              }
              body {
                margin: 0;
                -webkit-print-color-adjust: exact;
              }
              body * {
                visibility: hidden;
              }
              .print-only-container, .print-only-container * {
                visibility: visible;
              }
              .print-only-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                display: block !important;
                background: white;
                color: black;
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
              }
            }
          `}</style>
          
          {[1, 2].map((copyNum, cIdx) => (
            <div key={copyNum} style={{
              height: '132mm',
              maxHeight: '132mm',
              overflow: 'hidden',
              boxSizing: 'border-box',
              padding: '4mm 8mm',
              borderBottom: cIdx === 0 ? '2px dashed #000' : 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative'
            }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #000', paddingBottom: '3mm', marginBottom: '2mm' }}>
                <div style={{ display: 'flex', gap: '8mm', alignItems: 'center' }}>
                  <img src="/logo.png" alt="AT Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                  <div>
                    <h1 style={{ margin: '0 0 1px 0', fontSize: '15px', fontWeight: '950', letterSpacing: '0.5px' }}>ASHOK TEXTILES</h1>
                    <p style={{ margin: '0 0 1px 0', fontSize: '8px' }}>6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33</p>
                    <p style={{ margin: 0, fontSize: '8px' }}><strong>GSTIN:</strong> 33AAZFA60686D1Z6</p>
                  </div>
                </div>
                
                <div style={{ textAlign: 'center', padding: '0 4mm' }}>
                  <h2 style={{ margin: 0, fontSize: '13px', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>PACKAGE SLIP</h2>
                  <div style={{ fontSize: '8px', fontWeight: 'bold', border: '1px solid #000', padding: '1px 3px', borderRadius: '3px', marginTop: '1mm', display: 'inline-block' }}>
                    {copyNum === 1 ? 'COPY 1 — OFFICE' : 'COPY 2 — TRANSPORTER'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(printSlipData.slip_number || 'SLIP')}`}
                    alt="QR Code"
                    style={{ width: '40px', height: '40px', border: '1px solid #ddd' }}
                  />
                  <span style={{ fontSize: '6px', marginTop: '1px', fontFamily: 'monospace' }}>{printSlipData.slip_number}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4mm', marginBottom: '2mm', fontSize: '9px' }}>
                <div style={{ border: '1px solid #000', borderRadius: '4px', padding: '2mm' }}>
                  <h4 style={{ margin: '0 0 1mm 0', fontSize: '7.5px', textTransform: 'uppercase', color: '#555', fontWeight: 'bold' }}>Consigned To / Vendor</h4>
                  <p style={{ margin: '0 0 1px 0', fontWeight: 'bold', fontSize: '9.5px' }}>{printSlipData.vendor_name}</p>
                  <p style={{ margin: '0 0 1px 0', lineHeight: '1.2' }}>{printSlipData.vendor_address}</p>
                  <p style={{ margin: 0 }}><strong>GSTIN:</strong> {printSlipData.vendor_gstin}</p>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #000', borderRadius: '4px', padding: '2mm' }}>
                  <p style={{ margin: 0 }}><strong>Slip Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '10px' }}>{printSlipData.slip_number}</span></p>
                  <p style={{ margin: 0 }}><strong>Slip Date:</strong> {formatDate(printSlipData.slip_date)}</p>
                  <p style={{ margin: 0 }}><strong>PO Number:</strong> {printSlipData.po_number}</p>
                  <p style={{ margin: 0 }}><strong>PI Number:</strong> {printSlipData.pi_numbers}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2mm', background: '#fafafa', border: '1px solid #000', borderRadius: '4px', padding: '1.5mm 2mm', marginBottom: '2mm', fontSize: '8.5px' }}>
                <div><strong>Order No:</strong><br />{printSlipData.orders?.order_number || '—'}</div>
                <div><strong>Design Name/No:</strong><br />{printSlipData.design_name} / {printSlipData.design_no}</div>
                <div><strong>Count:</strong><br />{printSlipData.count}</div>
                <div><strong>Construction:</strong><br />{printSlipData.construction}</div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', minHeight: '40mm' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'left' }}>S.No</th>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'left' }}>Roll / Piece ID</th>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'right' }}>Qty (Meters)</th>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'right' }}>Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printSlipData.items || []).map((r, rIdx) => {
                      return (
                        <tr key={r.roll_id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ border: '1px solid #ccc', padding: '1mm 1.5mm' }}>{rIdx + 1}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1mm 1.5mm', fontFamily: 'monospace' }}>{r.roll_id}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1mm 1.5mm', textAlign: 'right' }}>{fmtNum(r.qty)}</td>
                          <td style={{ border: '1px solid #ccc', padding: '1mm 1.5mm', textAlign: 'right' }}>{fmtNum(r.weight, 3)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4mm', borderTop: '1.5px solid #000', paddingTop: '2mm', marginTop: '2mm', fontSize: '9px', fontWeight: 'bold' }}>
                <div>Total Rolls: {printSlipData.total_rolls}</div>
                <div style={{ textAlign: 'center' }}>Total Qty: {fmtNum(printSlipData.total_qty)} Mtrs</div>
                <div style={{ textAlign: 'right' }}>Total Weight: {fmtNum(printSlipData.total_weight, 3)} kg</div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
