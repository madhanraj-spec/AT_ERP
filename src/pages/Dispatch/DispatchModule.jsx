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
  Eye,
  Check,
  FileText,
  QrCode,
  RefreshCw,
  XCircle,
  HelpCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import { createEInvoice, cancelEInvoice } from '../../utils/whitebooks';

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
  const [slipStatus, setSlipStatus] = useState('created');
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
            setSlipStatus(slipData.status || 'created');
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
    if (slipStatus === 'dispatched') return;
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
          () => { }
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
    if (slipStatus === 'dispatched') {
      setError('This package slip has been dispatched and cannot be edited.');
      return;
    }
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
    if (slipStatus === 'dispatched') return;
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
    if (slipStatus === 'dispatched') return;
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
    if (slipStatus === 'dispatched') return;
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
    if (slipStatus === 'dispatched') return;
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
    if (slipStatus === 'dispatched') return;
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
    if (slipStatus === 'dispatched') {
      setError('This package slip has been dispatched and cannot be edited.');
      return;
    }
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
      if (result.data) {
        setSlipStatus(result.data.status || 'created');
      }
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

  const getCountsString = (specs) => {
    if (!specs) return '—';
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

    if (!warpStr && !weftStr) {
      return specs.yarn_type || '—';
    }
    return `${warpStr || '—'} X ${weftStr || '—'}`;
  };

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
      {slipStatus === 'dispatched' && (
        <div className="no-print" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem 1rem', color: '#1e40af', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: '500' }}>
          ℹ️ This package slip has been dispatched and cannot be edited.
        </div>
      )}

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
                    disabled={slipStatus === 'dispatched'}
                  />
                  <button
                    onClick={() => handleAddRoll()}
                    disabled={isLoading || slipStatus === 'dispatched'}
                    style={{ background: slipStatus === 'dispatched' ? '#cbd5e1' : 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 1rem', fontWeight: '700', fontSize: '0.8rem', cursor: (isLoading || slipStatus === 'dispatched') ? 'not-allowed' : 'pointer' }}
                  >
                    Add
                  </button>
                  <button
                    onClick={startCameraScanner}
                    disabled={slipStatus === 'dispatched'}
                    style={{ background: 'rgba(128,0,0,0.07)', color: 'var(--color-primary)', border: '1.5px solid rgba(128,0,0,0.2)', borderRadius: '8px', padding: '0 0.8rem', fontWeight: '700', fontSize: '0.8rem', cursor: slipStatus === 'dispatched' ? 'not-allowed' : 'pointer', opacity: slipStatus === 'dispatched' ? 0.5 : 1 }}
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
                    disabled={slipStatus === 'dispatched'}
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
              <input type="text" placeholder="Optional notes/remarks" value={remarks} onChange={e => setRemarks(e.target.value)} style={inputStyle} disabled={slipStatus === 'dispatched'} />
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
                          disabled={slipStatus === 'dispatched'}
                        />
                        {r.isManualWeight && slipStatus !== 'dispatched' && (
                          <button
                            onClick={() => resetManualWeight(r.roll_id)}
                            style={{ border: 'none', background: '#f3f4f6', borderRadius: '4px', padding: '0.2rem 0.4rem', cursor: 'pointer', fontSize: '0.7rem' }}
                          >
                            Reset
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {slipStatus === 'dispatched' ? (
                          <button disabled style={{ background: 'none', border: 'none', cursor: 'not-allowed', color: '#cbd5e1', display: 'flex' }}>
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <button onClick={() => handleRemoveRoll(r.roll_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                            <Trash2 size={16} />
                          </button>
                        )}
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
        <button
          onClick={handleSave}
          disabled={isLoading || slipStatus === 'dispatched'}
          style={{
            background: slipStatus === 'dispatched' ? '#cbd5e1' : 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '0.6rem 1.5rem',
            cursor: (isLoading || slipStatus === 'dispatched') ? 'not-allowed' : 'pointer',
            fontWeight: '700',
            fontSize: '0.87rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: (isLoading || slipStatus === 'dispatched') ? 0.7 : 1
          }}
        >
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
                    <h1 style={{ margin: '0 0 1px 0', fontSize: '18px', fontWeight: '950', letterSpacing: '0.5px' }}>ASHOK TEXTILES</h1>
                    <p style={{ margin: '0 0 1px 0', fontSize: '10px' }}>6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33</p>
                    <p style={{ margin: 0, fontSize: '10px' }}><strong>GSTIN:</strong> 33AAZFA60686D1Z6</p>
                  </div>
                </div>

                <div style={{ textAlign: 'center', padding: '0 4mm' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>PACKAGE SLIP</h2>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', border: '1px solid #000', padding: '1px 3px', borderRadius: '3px', marginTop: '1mm', display: 'inline-block' }}>
                    {copyNum === 1 ? 'COPY 1 — OFFICE' : 'COPY 2 — TRANSPORTER'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(slipNumber || 'SLIP')}`}
                    alt="QR Code"
                    style={{ width: '40px', height: '40px', border: '1px solid #ddd' }}
                  />
                  <span style={{ fontSize: '8px', marginTop: '1px', fontFamily: 'monospace' }}>{slipNumber}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4mm', marginBottom: '2mm', fontSize: '11px' }}>
                <div style={{ border: '1px solid #000', borderRadius: '4px', padding: '2mm' }}>
                  <h4 style={{ margin: '0 0 1mm 0', fontSize: '9px', textTransform: 'uppercase', color: '#555', fontWeight: 'bold' }}>Consigned To / Vendor</h4>
                  <p style={{ margin: '0 0 1px 0', fontWeight: 'bold', fontSize: '12px' }}>{vendorDetails.name}</p>
                  <p style={{ margin: '0 0 1px 0', lineHeight: '1.2' }}>{vendorDetails.address}</p>
                  <p style={{ margin: 0 }}><strong>GSTIN:</strong> {vendorDetails.gstin}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #000', borderRadius: '4px', padding: '2mm' }}>
                  <p style={{ margin: 0 }}><strong>Slip Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px' }}>{slipNumber}</span></p>
                  <p style={{ margin: 0 }}><strong>Slip Date:</strong> {formatDate(slipDate)}</p>
                  <p style={{ margin: 0 }}><strong>PO Number:</strong> {orderMetadata.poNumber}</p>
                  <p style={{ margin: 0 }}><strong>PI Number:</strong> {orderMetadata.piNumber}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2mm', background: '#fafafa', border: '1px solid #000', borderRadius: '4px', padding: '1.5mm 2mm', marginBottom: '2mm', fontSize: '10px' }}>
                <div><strong>Order No:</strong><br />{orderMetadata.orderNo}</div>
                <div><strong>Design Name/No:</strong><br />{orderMetadata.designName} / {orderMetadata.designNo}</div>
                <div><strong>Count:</strong><br />{orderMetadata.count}</div>
                <div><strong>Construction:</strong><br />{orderMetadata.construction}</div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', minHeight: '40mm' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4mm', borderTop: '1.5px solid #000', paddingTop: '2mm', marginTop: '2mm', fontSize: '11px', fontWeight: 'bold' }}>
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
function PackageSlipList({ onCreateNew, onEdit, onPrint, onBackToDashboard }) {
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
      const { data: slipsData, error: err } = await supabase
        .from('dispatch_package_slips')
        .select('*, orders(order_number, buyer_po_number, proforma_invoices(invoice_number))')
        .order('created_at', { ascending: false });

      if (err) throw err;

      // Fetch dispatch bills to resolve linked bill/invoice details in memory
      const { data: billsData } = await supabase
        .from('dispatch_bills')
        .select('id, bill_number, bill_date, transport_name, vehicle_number, lr_no, lr_date, package_slip_ids');

      const enriched = (slipsData || []).map(slip => {
        const linkedBill = (billsData || []).find(b => {
          const slipIds = Array.isArray(b.package_slip_ids) ? b.package_slip_ids : [];
          return slipIds.includes(slip.slip_number);
        });
        return {
          ...slip,
          linkedBill: linkedBill ? {
            id: linkedBill.id,
            bill_number: linkedBill.bill_number,
            bill_date: linkedBill.bill_date,
            transport_name: linkedBill.transport_name || null,
            vehicle_number: linkedBill.vehicle_number || null,
            lr_no: linkedBill.lr_no || null,
            lr_date: linkedBill.lr_date || null
          } : null
        };
      });

      setSlips(enriched);
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
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={onBackToDashboard}
          style={{
            background: 'none', border: '1.5px solid var(--border-current)', borderRadius: '10px',
            padding: '0.55rem 1.25rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700',
            display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-current)'
          }}
        >
          <ArrowLeft size={15} /> Back to Dashboard
        </button>
      </div>

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
                  const dynamicPi = s.orders?.proforma_invoices?.map(pi => pi.invoice_number).filter(pi => pi && pi !== '—').join(', ');
                  const displayPi = dynamicPi || s.pi_numbers || '—';
                  const displayPo = (s.orders?.buyer_po_number && s.orders.buyer_po_number !== '—') ? s.orders.buyer_po_number : (s.po_number || '—');
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
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{displayPi}</td>
                        <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{displayPo}</td>
                        <td style={{ padding: '0.75rem' }}>{s.vendor_name}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>{s.total_rolls}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{fmtNum(s.total_qty)} m</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700' }}>{fmtNum(s.total_weight, 3)} kg</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          {s.status === 'dispatched' ? (
                            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                              Dispatched
                            </span>
                          ) : (
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                              Created
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            {s.status === 'dispatched' ? (
                              <button
                                disabled
                                title="Dispatched slip cannot be edited"
                                style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'not-allowed', display: 'flex', padding: '0.2rem' }}
                              >
                                <Edit size={16} />
                              </button>
                            ) : (
                              <button
                                onClick={() => onEdit(s.id)}
                                title="Edit Slip"
                                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', padding: '0.2rem' }}
                              >
                                <Edit size={16} />
                              </button>
                            )}
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
                            <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
                              <div style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: '1rem', flex: '1', minWidth: '280px' }}>
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

                              {s.linkedBill && (
                                <div style={{ borderLeft: '3px solid #10b981', paddingLeft: '1rem', flex: '1', minWidth: '280px' }}>
                                  <h5 style={{ margin: '0 0 0.5rem 0', color: '#10b981', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Linked Bill / Invoice Details
                                  </h5>
                                  <div style={{ fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.45rem', color: 'var(--text-current)' }}>
                                    <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Bill Number:</span>
                                    <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{s.linkedBill.bill_number}</span>
                                    
                                    <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Bill Date:</span>
                                    <span>{formatDate(s.linkedBill.bill_date)}</span>
                                    
                                    {s.linkedBill.transport_name && (
                                      <>
                                        <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Transport Name:</span>
                                        <span>{s.linkedBill.transport_name}</span>
                                      </>
                                    )}
                                    
                                    {s.linkedBill.vehicle_number && (
                                      <>
                                        <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Vehicle Number:</span>
                                        <span>{s.linkedBill.vehicle_number}</span>
                                      </>
                                    )}
                                    
                                    {s.linkedBill.lr_no && (
                                      <>
                                        <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>LR No:</span>
                                        <span style={{ fontFamily: 'monospace' }}>{s.linkedBill.lr_no}</span>
                                      </>
                                    )}
                                    
                                    {s.linkedBill.lr_date && (
                                      <>
                                        <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>LR Date:</span>
                                        <span>{formatDate(s.linkedBill.lr_date)}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
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
    </div>
  );
}

// ─────────────────────────────────────────────
// Number to words helper (Indian Numbering System)
// ─────────────────────────────────────────────
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

const getConstruction = (specs) => {
  if (!specs) return '—';
  return `${specs.order_reed || specs.reed || '—'} / ${specs.order_pick || specs.pick || '—'}`;
};


// ─────────────────────────────────────────────
// Bill List (List of created Invoices/Bills)
// ─────────────────────────────────────────────
function BillList({ onCreateNew, onPrintInvoice, onPrintEInvoice, onPrintPackingList, onEdit, onBackToDashboard }) {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState({});
  const [expandedOrders, setExpandedOrders] = useState({});
  const [generatingEInvId, setGeneratingEInvId] = useState(null);
  const [selectedReviewBill, setSelectedReviewBill] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterBillNo, setFilterBillNo] = useState([]);
  const [filterOrderNo, setFilterOrderNo] = useState([]);
  const [filterDesign, setFilterDesign] = useState([]);
  const [filterBilledTo, setFilterBilledTo] = useState([]);

  const handleConfirmGenerateEInvoice = async (bill) => {
    try {
      setModalLoading(true);
      const res = await createEInvoice(bill);
      if (res.success) {
        alert(`E-Invoice generated successfully!\nIRN: ${res.irn}`);
        setSelectedReviewBill(null);
        await fetchBills();
      } else {
        alert(`E-Invoice generation failed: ${res.error}`);
      }
    } catch (err) {
      alert(`Error generating E-Invoice: ${err.message}`);
    } finally {
      setModalLoading(false);
    }
  };

  const handleGenerateEInvoice = async (bill) => {
    try {
      setGeneratingEInvId(bill.id);
      const res = await createEInvoice(bill);
      if (res.success) {
        alert(`E-Invoice generated successfully!\nIRN: ${res.irn}`);
        await fetchBills();
      } else {
        alert(`E-Invoice generation failed: ${res.error}`);
        await fetchBills();
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
        await fetchBills();
      } else {
        alert(`Cancellation failed: ${res.error}`);
        await fetchBills();
      }
    } catch (err) {
      alert(`Error cancelling E-Invoice: ${err.message}`);
    } finally {
      setGeneratingEInvId(null);
    }
  };

  const fetchBills = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dispatch_bills')
        .select(`
          *,
          buyer:master_brands(id, brand_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Enrich bills with slips and PO/PI numbers
      const enriched = await Promise.all((data || []).map(async (b) => {
        let slipsData = [];
        if (b.package_slip_ids && b.package_slip_ids.length > 0) {
          const { data: slips } = await supabase
            .from('dispatch_package_slips')
            .select('id, slip_number, order_id, total_rolls, total_qty, total_weight')
            .in('slip_number', b.package_slip_ids);
          slipsData = slips || [];
        }
        b.slips = slipsData;

        if (!b.items || b.items.length === 0) return b;
        const orderIds = b.items.map(i => i.order_id).filter(Boolean);
        if (orderIds.length > 0) {
          const { data: ords } = await supabase
            .from('orders')
            .select(`
              id,
              buyer_po_number,
              proforma_invoices(invoice_number)
            `)
            .in('id', orderIds);

          if (ords) {
            b.items = b.items.map(item => {
              const match = ords.find(o => o.id === item.order_id);
              return {
                ...item,
                po_number: item.po_number || match?.buyer_po_number || '—',
                pi_number: item.pi_number || match?.proforma_invoices?.[0]?.invoice_number || '—'
              };
            });
          }
        }
        return b;
      }));

      setBills(enriched);
    } catch (err) {
      console.error("Error loading bills:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handleDeleteBill = async (bill) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete Bill/Invoice ${bill.bill_number}?`);
    if (!confirmDelete) return;

    try {
      setLoading(true);

      // 1. Update the status of package slips back to 'created'
      if (bill.package_slip_ids && bill.package_slip_ids.length > 0) {
        const { error: slipUpdateErr } = await supabase
          .from('dispatch_package_slips')
          .update({ status: 'created' })
          .in('slip_number', bill.package_slip_ids);
        if (slipUpdateErr) throw slipUpdateErr;
      }

      // 2. Delete the bill from dispatch_bills
      const { error: deleteErr } = await supabase
        .from('dispatch_bills')
        .delete()
        .eq('id', bill.id);
      if (deleteErr) throw deleteErr;

      alert(`Bill/Invoice ${bill.bill_number} deleted successfully!`);
      await fetchBills();
    } catch (err) {
      console.error("Error deleting bill:", err);
      alert("Error deleting bill: " + err.message);
      setLoading(false);
    }
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleOrder = (billId, orderId) => {
    const key = `${billId}-${orderId}`;
    setExpandedOrders(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClearFilters = () => {
    setFilterBillNo([]);
    setFilterOrderNo([]);
    setFilterDesign([]);
    setFilterBilledTo([]);
  };

  const getOptionsForFilter = (key) => {
    const tempFilters = {
      billNos: key === 'billNos' ? [] : filterBillNo,
      orderNos: key === 'orderNos' ? [] : filterOrderNo,
      designs: key === 'designs' ? [] : filterDesign,
      billedTos: key === 'billedTos' ? [] : filterBilledTo
    };

    const filtered = bills.filter(b => {
      const matchBill = tempFilters.billNos.length === 0 || tempFilters.billNos.includes(b.bill_number);
      const matchOrder = tempFilters.orderNos.length === 0 || tempFilters.orderNos.some(oNo =>
        (b.items || []).some(i => i.order_number === oNo)
      );
      const matchDesign = tempFilters.designs.length === 0 || tempFilters.designs.some(des =>
        (b.items || []).some(i => `${i.design_no} - ${i.design_name}` === des)
      );
      const matchBilledTo = tempFilters.billedTos.length === 0 || tempFilters.billedTos.includes(
        b.buyer?.brand_name || b.billed_to_address?.split('\n')[0] || '—'
      );

      return matchBill && matchOrder && matchDesign && matchBilledTo;
    });

    let values = [];
    if (key === 'billNos') {
      values = filtered.map(b => b.bill_number);
    } else if (key === 'orderNos') {
      values = filtered.flatMap(b => (b.items || []).map(i => i.order_number)).filter(Boolean);
    } else if (key === 'designs') {
      values = filtered.flatMap(b => (b.items || []).map(i => `${i.design_no} - ${i.design_name}`)).filter(Boolean);
    } else if (key === 'billedTos') {
      values = filtered.map(b => b.buyer?.brand_name || b.billed_to_address?.split('\n')[0] || '—').filter(Boolean);
    }

    return [...new Set(values)].sort();
  };

  const filteredBills = bills.filter(b => {
    const matchBill = filterBillNo.length === 0 || filterBillNo.includes(b.bill_number);
    const matchOrder = filterOrderNo.length === 0 || filterOrderNo.some(oNo =>
      (b.items || []).some(i => i.order_number === oNo)
    );
    const matchDesign = filterDesign.length === 0 || filterDesign.some(des =>
      (b.items || []).some(i => `${i.design_no} - ${i.design_name}` === des)
    );
    const matchBilledTo = filterBilledTo.length === 0 || filterBilledTo.includes(
      b.buyer?.brand_name || b.billed_to_address?.split('\n')[0] || '—'
    );

    return matchBill && matchOrder && matchDesign && matchBilledTo;
  });

  const hasActiveFilters = (
    filterBillNo.length > 0 ||
    filterOrderNo.length > 0 ||
    filterDesign.length > 0 ||
    filterBilledTo.length > 0
  );

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={onBackToDashboard}
          style={{
            background: 'none', border: '1.5px solid var(--border-current)', borderRadius: '10px',
            padding: '0.55rem 1.25rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '700',
            display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-current)'
          }}
        >
          <ArrowLeft size={15} /> Back to Dashboard
        </button>

        <button
          onClick={onCreateNew}
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '0.6rem 1.25rem',
            fontWeight: '700',
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(128,0,0,0.2)'
          }}
        >
          <Plus size={16} /> Create New Bill/Invoice
        </button>
      </div>

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
              label="Invoice Number"
              options={getOptionsForFilter('billNos')}
              selectedValues={filterBillNo}
              onChange={setFilterBillNo}
            />
            <MultiSelectFilter
              label="Order Number"
              options={getOptionsForFilter('orderNos')}
              selectedValues={filterOrderNo}
              onChange={setFilterOrderNo}
            />
            <MultiSelectFilter
              label="Design Name & No"
              options={getOptionsForFilter('designs')}
              selectedValues={filterDesign}
              onChange={setFilterDesign}
            />
            <MultiSelectFilter
              label="Billed To"
              options={getOptionsForFilter('billedTos')}
              selectedValues={filterBilledTo}
              onChange={setFilterBilledTo}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader size={30} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
        </div>
      ) : filteredBills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-current)', borderRadius: '12px', background: 'white' }}>
          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.9rem' }}>No bills or invoices found.</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border-current)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border-current)' }}>
                <th style={{ width: '40px' }}></th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '800' }}>Invoice No</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '800' }}>Date</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '800' }}>Billed To</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '800' }}>Order No</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '800' }}>Design Name & No</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '800' }}>PO Number</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '800' }}>PI Number</th>
                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '800' }}>Qty (Mtr)</th>
                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '800' }}>Taxable Amt</th>
                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '800' }}>Total Bill</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '800' }}>E-Invoice</th>
                <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '800' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(b => {
                const isExpanded = !!expandedRows[b.id];
                return (
                  <React.Fragment key={b.id}>
                    <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ textAlign: 'center', cursor: 'pointer', color: 'var(--color-primary)' }} onClick={() => toggleRow(b.id)}>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: '700', fontFamily: 'monospace' }}>{b.bill_number}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>{formatDate(b.bill_date)}</td>
                      <td style={{ padding: '0.85rem 1rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.buyer?.brand_name || b.billed_to_address?.split('\n')[0] || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace' }}>
                        {[...new Set((b.items || []).map(i => i.order_number).filter(Boolean))].join(', ') || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {[...new Set((b.items || []).map(i => `${i.design_no} (${i.design_name})`).filter(Boolean))].join(', ') || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace' }}>
                        {[...new Set((b.items || []).map(i => i.po_number).filter(Boolean))].join(', ') || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace' }}>
                        {[...new Set((b.items || []).map(i => i.pi_number).filter(Boolean))].join(', ') || '—'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(b.qty)}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(b.taxable_value)}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>₹{fmtNum(b.total_bill_price)}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        {b.einvoice_status === 'generated' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                            <span style={{
                              padding: '0.25rem 0.6rem',
                              borderRadius: '12px',
                              fontSize: '0.68rem',
                              fontWeight: '800',
                              background: '#dcfce7',
                              color: '#166534',
                              border: '1px solid #86efac',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Check size={12} /> Generated
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onPrintEInvoice) onPrintEInvoice(b);
                              }}
                              title="Print Official Government E-Invoice"
                              style={{
                                padding: '0.25rem 0.55rem',
                                background: '#059669',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                marginTop: '3px',
                                boxShadow: '0 2px 4px rgba(5,150,105,0.2)'
                              }}
                            >
                              <Printer size={12} /> Print E-Invoice
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedReviewBill(b)}
                            style={{
                              background: b.einvoice_status === 'failed' ? '#fee2e2' : 'var(--color-primary)',
                              color: b.einvoice_status === 'failed' ? '#991b1b' : 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              whiteSpace: 'nowrap',
                              boxShadow: b.einvoice_status === 'failed' ? 'none' : '0 2px 6px rgba(128,0,0,0.2)'
                            }}
                          >
                            <FileText size={13} />
                            {b.einvoice_status === 'failed' ? 'Retry E-Invoice' : 'Generate E-Invoice'}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => onEdit(b.id)}
                            title="Edit Bill"
                            style={{ padding: '0.4rem', background: '#fef3c7', border: 'none', borderRadius: '6px', color: '#d97706', cursor: 'pointer' }}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => onPrintInvoice(b)}
                            title="Print Tax Invoice"
                            style={{ padding: '0.4rem', background: '#eff6ff', border: 'none', borderRadius: '6px', color: '#2563eb', cursor: 'pointer' }}
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            onClick={() => onPrintPackingList(b)}
                            title="Print Packing List"
                            style={{ padding: '0.4rem', background: '#ecfdf5', border: 'none', borderRadius: '6px', color: '#059669', cursor: 'pointer' }}
                          >
                            <Package size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Accordion Row Details */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={13} style={{ background: '#f8fafc', padding: '1.25rem 2.5rem', borderBottom: '1px solid #e2e8f0' }}>
                          <div style={{ borderLeft: '3.5px solid var(--color-primary)', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* Address details grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', fontSize: '0.8rem' }}>
                              <div>
                                <div style={{ fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em', marginBottom: '4px' }}>Billed From</div>
                                <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: '#475569' }}>{b.billed_from_address || '—'}</pre>
                              </div>
                              <div>
                                <div style={{ fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em', marginBottom: '4px' }}>Billed To (Consignee)</div>
                                <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: '#475569' }}>{b.billed_to_address || '—'}</pre>
                              </div>
                              <div>
                                <div style={{ fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em', marginBottom: '4px' }}>Shipped From</div>
                                <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: '#475569' }}>{b.shipped_from_address || '—'}</pre>
                              </div>
                              <div>
                                <div style={{ fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em', marginBottom: '4px' }}>Shipped To</div>
                                <pre style={{ margin: 0, fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: '#475569' }}>{b.shipped_to_address || '—'}</pre>
                              </div>
                            </div>

                            {/* Transporter details block */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', fontSize: '0.8rem', background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div><strong>Transport Name:</strong> {b.transport_name || '—'}</div>
                              <div><strong>Transport Mode:</strong> {b.transport_mode || '—'}</div>
                              <div><strong>Vehicle Number:</strong> {b.vehicle_number || '—'}</div>
                              <div><strong>Vehicle Type:</strong> {b.vehicle_type === 'R' ? 'Regular' : b.vehicle_type || '—'}</div>
                              <div><strong>Freight Type:</strong> {b.freight_type || '—'}</div>
                              <div><strong>LR Number:</strong> {b.lr_no || '—'}</div>
                              <div><strong>LR Date:</strong> {b.lr_date ? formatDate(b.lr_date) : '—'}</div>
                            </div>

                            {/* Whitebooks E-Invoice details block */}
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
                                      onClick={() => { if (onPrintEInvoice) onPrintEInvoice(b); }}
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

                            {/* Transporter details block */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', fontSize: '0.8rem', background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <div><strong>Transport Name:</strong> {b.transport_name || '—'}</div>
                              <div><strong>Transport Mode:</strong> {b.transport_mode || '—'}</div>
                              <div><strong>Vehicle Number:</strong> {b.vehicle_number || '—'}</div>
                              <div><strong>Vehicle Type:</strong> {b.vehicle_type === 'R' ? 'Regular' : b.vehicle_type || '—'}</div>
                              <div><strong>Freight Type:</strong> {b.freight_type || '—'}</div>
                              <div><strong>LR Number:</strong> {b.lr_no || '—'}</div>
                              <div><strong>LR Date:</strong> {b.lr_date ? formatDate(b.lr_date) : '—'}</div>
                            </div>

                            {/* Items breakdown subtable with nested expanding package slips per order */}
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
                                          <td style={{ padding: '0.5rem' }}>{item.design_no} ({item.design_name})</td>
                                          <td style={{ padding: '0.5rem' }}>{item.count} | {item.construction}</td>
                                          <td style={{ padding: '0.5rem', textAlign: 'center', fontFamily: 'monospace' }}>{item.hsn_code}</td>
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

                            {/* Delete Bill Section */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                              <button
                                onClick={() => handleDeleteBill(b)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  padding: '0.6rem 1.2rem',
                                  background: '#fee2e2',
                                  border: '1px solid #fca5a5',
                                  borderRadius: '8px',
                                  color: '#dc2626',
                                  fontWeight: '600',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = '#fecaca';
                                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.1)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = '#fee2e2';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                <Trash2 size={16} />
                                Delete Bill / Invoice
                              </button>
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

      {selectedReviewBill && (
        <ReviewEInvoiceModal
          bill={selectedReviewBill}
          onClose={() => setSelectedReviewBill(null)}
          onConfirm={handleConfirmGenerateEInvoice}
          loading={modalLoading}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Review E-Invoice Modal Component
// ─────────────────────────────────────────────
function ReviewEInvoiceModal({ bill, onClose, onConfirm, loading }) {
  if (!bill) return null;

  const docNo = bill.bill_number || '—';
  const docDate = bill.bill_date ? formatDate(bill.bill_date) : '—';
  const billedTo = bill.billed_to_address || '—';
  const items = Array.isArray(bill.items) ? bill.items : [];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1100, padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '850px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#fafafa', borderTopLeftRadius: '16px', borderTopRightRadius: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: 'rgba(128,0,0,0.1)', color: 'var(--color-primary)', padding: '0.4rem', borderRadius: '8px' }}>
              <FileText size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-current)' }}>
                Review E-Invoice Details
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>
                Verify invoice details before generating IRN via Whitebooks Sandbox API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Document Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Invoice Number</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', fontFamily: 'monospace', color: 'var(--color-primary)', marginTop: '2px' }}>{docNo}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Invoice Date</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', marginTop: '2px' }}>{docDate}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Doc Type & Supply Type</div>
              <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', marginTop: '2px' }}>INV / B2B</div>
            </div>
          </div>

          {/* Seller, Dispatch, Buyer & Shipping Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Seller */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', background: 'white' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Seller Details (SellerDtls)
              </div>
              <div style={{ fontSize: '0.82rem', lineHeight: '1.4', color: '#334155' }}>
                <strong>ASHOK TEXTILES</strong><br />
                GSTIN: <span style={{ fontFamily: 'monospace', fontWeight: '700' }}>33AAZFA60686D1Z6</span><br />
                6/222, SALEM MAIN ROAD, VEERAPANDI<br />
                SALEM, TAMIL NADU - 33
              </div>
            </div>

            {/* Billed From / Dispatch From */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', background: 'white' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Dispatched From (DispDtls)
              </div>
              <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: '#334155' }}>
                {bill.shipped_from_address || bill.billed_from_address || '6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM'}
              </pre>
            </div>

            {/* Buyer (Billed To) */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', background: 'white' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Billed To (BuyerDtls)
              </div>
              <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: '#334155' }}>
                {billedTo}
              </pre>
            </div>

            {/* Shipped To (Ship Details) */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', background: 'white' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Shipped To (ShipDtls)
              </div>
              <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: '#334155' }}>
                {bill.shipped_to_address || billedTo}
              </pre>
            </div>
          </div>

          {/* Items breakdown table */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Item Breakdown for E-Invoice Schema
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>#</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Product / Design</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>HSN</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>Taxable Val</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>CGST</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>SGST</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>IGST</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>Standard Textile Fabric (HSN: {bill.hsn_code || '5208'})</td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem' }}>{idx + 1}</td>
                        <td style={{ padding: '0.5rem', fontWeight: '600' }}>{it.design_name || it.construction || 'Textile Fabric'}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontFamily: 'monospace' }}>{it.hsn_code || bill.hsn_code || '5208'}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(it.qty)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(it.rate)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(it.taxable_value || it.amount)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(it.cgst_amount)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(it.sgst_amount)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(it.igst_amount)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>₹{fmtNum(it.total_amount || it.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grand Totals Summary */}
          <div style={{ background: '#fcfcfc', border: '1.5px dashed #cbd5e1', borderRadius: '10px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#475569' }}>
              <div>Total Taxable Value: <strong>₹{fmtNum(bill.taxable_value)}</strong></div>
              <div>Total GST Amount: <strong>₹{fmtNum(bill.total_gst_amount)}</strong></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Grand Invoice Amount</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--color-primary)', fontFamily: 'monospace' }}>₹{fmtNum(bill.total_bill_price)}</div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#fafafa',
          display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
          borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px'
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid var(--border-current)',
              background: 'white', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          <button
            onClick={() => onConfirm(bill)}
            disabled={loading}
            style={{
              padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none',
              background: 'var(--color-primary)', color: 'white', fontWeight: '700',
              fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(128,0,0,0.2)'
            }}
          >
            {loading ? (
              <>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Creating E-Invoice...
              </>
            ) : (
              <>
                <Check size={16} />
                Confirm & Create E-Invoice
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Bill Form (Invoice Creation)
// ─────────────────────────────────────────────
function BillForm({ editBillId, onBack, onSaveComplete }) {
  const isInitialEditLoad = useRef(true);
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [buyerId, setBuyerId] = useState('');
  const [step, setStep] = useState(1);

  // Selection
  const [orders, setOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [showOrderDrop, setShowOrderDrop] = useState(false);

  // Slips
  const [availableSlips, setAvailableSlips] = useState([]);
  const [selectedSlips, setSelectedSlips] = useState([]);
  const [manualSlipInput, setManualSlipInput] = useState('');
  const [alreadyDispatchedMap, setAlreadyDispatchedMap] = useState({});

  // Address
  const [billedFrom, setBilledFrom] = useState(
    `ASHOK TEXTILES\n6/222, SALEM MAIN ROAD, VEERAPANDI\nSALEM, TAMIL NADU - 33\nGSTIN: 33AAZFA60686D1Z6`
  );
  const [billedTo, setBilledTo] = useState('');
  const [shippedFrom, setShippedFrom] = useState('');
  const [shippedTo, setShippedTo] = useState('');

  // Dropdown list data
  const [partners, setPartners] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);

  // Transporter
  const [transportName, setTransportName] = useState('');
  const [transportMode, setTransportMode] = useState('ROAD');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('R'); // 'ODC' | 'R'
  const [freightType, setFreightType] = useState('To Pay');
  const [lrNo, setLrNo] = useState('');
  const [lrDate, setLrDate] = useState('');

  // Pricing, Tax & Discount
  const [discountAmount, setDiscountAmount] = useState('0');
  const [itemsDetails, setItemsDetails] = useState({}); // orderId -> { rate, hsn, cgst, sgst, igst }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load Initial Data
  useEffect(() => {
    supabase.from('master_yarn_counts').select('*').then(({ data }) => setYarnCounts(data || []));

    // Fetch orders with vendor partner data joined and proforma invoice metadata
    supabase
      .from('orders')
      .select(`
        id,
        order_number,
        design_name,
        design_no,
        total_quantity,
        buyer_po_number,
        buyer_po_date,
        avg_weight_meter,
        technical_specs,
        vendor_id,
        vendor:master_partners(id, partner_name, address, gstin),
        proforma_invoices(invoice_number, invoice_date, rate, cgst_percent, sgst_percent, igst_percent)
      `)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders(data || []);
      });

    // Fetch master partners for shippers dropdowns
    supabase.from('master_partners').select('id, partner_name, address, gstin, partner_type').order('partner_name').then(({ data }) => {
      setPartners(data || []);
    });
  }, []);

  // Fetch Next Sequence Invoice Number
  const fetchNextInvoiceNumber = async (selectedDate) => {
    const fy = getFiscalYear(selectedDate);
    try {
      const { data, error: fetchErr } = await supabase
        .from('dispatch_bills')
        .select('bill_number')
        .like('bill_number', `AT/${fy}/INV/%`)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      let nextNum = 1;
      if (data && data.length > 0) {
        let maxSeq = 0;
        data.forEach(item => {
          const parts = item.bill_number.split('/');
          const seq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        });
        nextNum = maxSeq + 1;
      }
      const seqStr = String(nextNum).padStart(5, '0');
      setBillNumber(`AT/${fy}/INV/${seqStr}`);
    } catch (err) {
      console.error("Error generating invoice number:", err);
      setBillNumber(`AT/${fy}/INV/00001`);
    }
  };

  useEffect(() => {
    if (!editBillId) {
      fetchNextInvoiceNumber(billDate);
    }
  }, [billDate, editBillId]);

  // Load Slips and PIs when Selected Orders list changes
  useEffect(() => {
    if (editBillId && isInitialEditLoad.current) {
      isInitialEditLoad.current = false;
      return;
    }
    if (selectedOrders.length === 0) {
      setAvailableSlips([]);
      setSelectedSlips([]);
      setActiveOrderId(null);
      return;
    }

    const selectedIds = selectedOrders.map(o => o.id);

    // Fetch created package slips
    supabase
      .from('dispatch_package_slips')
      .select('*')
      .in('order_id', selectedIds)
      .eq('status', 'created')
      .then(({ data }) => {
        setAvailableSlips(data || []);
      });

    // Fetch dispatched slips counts for Already Dispatched calculation
    supabase
      .from('dispatch_package_slips')
      .select('order_id, total_qty')
      .in('order_id', selectedIds)
      .eq('status', 'dispatched')
      .then(({ data }) => {
        const map = {};
        selectedIds.forEach(id => { map[id] = 0; });
        (data || []).forEach(s => {
          map[s.order_id] = (map[s.order_id] || 0) + parseFloat(s.total_qty || 0);
        });
        setAlreadyDispatchedMap(map);
      });

    // Prepopulate Billed To from the first order's vendor details
    const firstOrder = selectedOrders[0];
    if (firstOrder && firstOrder.vendor) {
      const v = firstOrder.vendor;
      const addr = [v.partner_name, v.address, `GSTIN: ${v.gstin || '—'}`].filter(Boolean).join('\n');
      setBilledTo(addr);
    }

    // Default active order
    if (!activeOrderId || !selectedIds.includes(activeOrderId)) {
      setActiveOrderId(selectedIds[0]);
    }

    // Fetch Proforma Invoices rates
    supabase
      .from('proforma_invoices')
      .select('order_id, invoice_number, invoice_date, rate, cgst_percent, sgst_percent, igst_percent, hsn_code')
      .in('order_id', selectedIds)
      .then(({ data }) => {
        const piMap = {};
        (data || []).forEach(pi => {
          piMap[pi.order_id] = {
            rate: pi.rate,
            piNumber: pi.invoice_number,
            piDate: pi.invoice_date,
            cgst: pi.cgst_percent,
            sgst: pi.sgst_percent,
            igst: pi.igst_percent,
            hsn: pi.hsn_code
          };
        });

        setItemsDetails(prev => {
          const next = { ...prev };
          selectedOrders.forEach(o => {
            if (!next[o.id]) {
              const piInfo = piMap[o.id] || {};
              const hasIgst = parseFloat(piInfo.igst || 0) > 0;
              const hasCgst = parseFloat(piInfo.cgst || 0) > 0 || parseFloat(piInfo.sgst || 0) > 0;
              next[o.id] = {
                rate: piInfo.rate !== undefined ? String(piInfo.rate) : '0.00',
                hsn: piInfo.hsn || '5208',
                cgst: hasIgst ? '0' : (piInfo.cgst !== undefined ? String(piInfo.cgst) : '2.5'),
                sgst: hasIgst ? '0' : (piInfo.sgst !== undefined ? String(piInfo.sgst) : '2.5'),
                igst: hasCgst ? '0' : (piInfo.igst !== undefined ? String(piInfo.igst) : '0'),
                piNumber: piInfo.piNumber || '—',
                piDate: piInfo.piDate || '—'
              };
            }
          });
          return next;
        });
      });

  }, [selectedOrders.map(o => o.id).join(',')]);

  // Edit Mode: Load Bill data
  useEffect(() => {
    if (!editBillId) return;

    const loadBillForEdit = async () => {
      setLoading(true);
      try {
        const { data: bill, error: billErr } = await supabase
          .from('dispatch_bills')
          .select('*')
          .eq('id', editBillId)
          .single();
        if (billErr) throw billErr;

        setBillNumber(bill.bill_number || '');
        setBillDate(bill.bill_date || '');
        setBuyerId(bill.buyer_id || '');
        setBilledFrom(bill.billed_from_address || '');
        setBilledTo(bill.billed_to_address || '');
        setShippedFrom(bill.shipped_from_address || '');
        setShippedTo(bill.shipped_to_address || '');
        setTransportName(bill.transport_name || '');
        setTransportMode(bill.transport_mode || 'ROAD');
        setVehicleNumber(bill.vehicle_number || '');
        setVehicleType(bill.vehicle_type || 'R');
        setFreightType(bill.freight_type || 'To Pay');
        setLrNo(bill.lr_no || '');
        setLrDate(bill.lr_date || '');
        setDiscountAmount(String(bill.discount_amount || 0));

        // Reconstruct orders and itemsDetails
        const orderIds = (bill.items || []).map(i => i.order_id);
        if (orderIds.length > 0) {
          const { data: ords, error: ordsErr } = await supabase
            .from('orders')
            .select(`
              id,
              order_number,
              design_name,
              design_no,
              total_quantity,
              buyer_po_number,
              buyer_po_date,
              avg_weight_meter,
              technical_specs,
              vendor_id,
              vendor:master_partners(id, partner_name, address, gstin),
              proforma_invoices(invoice_number, invoice_date, rate, cgst_percent, sgst_percent, igst_percent, hsn_code)
            `)
            .in('id', orderIds);
          if (ordsErr) throw ordsErr;

          setSelectedOrders(ords || []);
          setActiveOrderId(ords?.[0]?.id || null);

          // We also need to fetch slips of status 'created' plus the ones currently associated with this bill
          const { data: allSlips } = await supabase
            .from('dispatch_package_slips')
            .select('*')
            .in('order_id', orderIds);

          const slipNumbers = bill.package_slip_ids || [];
          const filteredSlips = (allSlips || []).filter(
            s => s.status === 'created' || slipNumbers.includes(s.slip_number)
          );
          setAvailableSlips(filteredSlips);

          // Find the IDs of the slips matching the slipNumbers
          const matchedSlipIds = filteredSlips
            .filter(s => slipNumbers.includes(s.slip_number))
            .map(s => s.id);
          setSelectedSlips(matchedSlipIds);
        }

        const initialDetails = {};
        (bill.items || []).forEach(i => {
          initialDetails[i.order_id] = {
            rate: String(i.rate || '0.00'),
            hsn: i.hsn_code || '5208',
            cgst: String(i.cgst_percent || '2.5'),
            sgst: String(i.sgst_percent || '2.5'),
            igst: String(i.igst_percent || '0'),
            piNumber: i.pi_number || '—',
            piDate: '—'
          };
        });
        setItemsDetails(initialDetails);

      } catch (err) {
        console.error("Error loading bill for edit:", err);
        setError("Error loading bill data: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBillForEdit();
  }, [editBillId]);

  // Handle Manual Entry Package Slip Move
  const handleMoveSlip = (slipNo) => {
    const cleanNo = slipNo.trim();
    if (!cleanNo) return;
    const slip = availableSlips.find(s => s.slip_number.toLowerCase() === cleanNo.toLowerCase());
    if (slip) {
      if (!selectedSlips.includes(slip.id)) {
        setSelectedSlips([...selectedSlips, slip.id]);
        setActiveOrderId(slip.order_id);
        setSuccess(`Package slip "${slip.slip_number}" added.`);
        setTimeout(() => setSuccess(''), 2000);
      } else {
        setError(`Package slip "${slip.slip_number}" already added.`);
        setTimeout(() => setError(''), 2000);
      }
      setManualSlipInput('');
    } else {
      supabase
        .from('dispatch_package_slips')
        .select('*')
        .eq('slip_number', cleanNo)
        .single()
        .then(({ data }) => {
          if (data) {
            if (data.status === 'dispatched') {
              setError(`Slip "${cleanNo}" is already billed.`);
              setTimeout(() => setError(''), 2000);
            } else {
              const alreadySelected = selectedOrders.some(o => o.id === data.order_id);
              if (!alreadySelected) {
                supabase
                  .from('orders')
                  .select(`
                    id,
                    order_number,
                    design_name,
                    design_no,
                    total_quantity,
                    buyer_po_number,
                    buyer_po_date,
                    avg_weight_meter,
                    technical_specs,
                    vendor_id,
                    vendor:master_partners(id, partner_name, address, gstin),
                    proforma_invoices(invoice_number, invoice_date, rate, cgst_percent, sgst_percent, igst_percent)
                  `)
                  .eq('id', data.order_id)
                  .single()
                  .then(({ data: oData }) => {
                    if (oData) {
                      setSelectedOrders([...selectedOrders, oData]);
                      setSelectedSlips([...selectedSlips, data.id]);
                      setAvailableSlips(prev => [...prev, data]);
                      setActiveOrderId(data.order_id);
                      setSuccess(`Order and package slip "${cleanNo}" added.`);
                      setTimeout(() => setSuccess(''), 2000);
                    }
                  });
              } else {
                setSelectedSlips([...selectedSlips, data.id]);
                setActiveOrderId(data.order_id);
                setSuccess(`Package slip "${cleanNo}" added.`);
                setTimeout(() => setSuccess(''), 2000);
              }
            }
          } else {
            setError(`Package slip "${cleanNo}" not found.`);
            setTimeout(() => setError(''), 2000);
          }
        });
      setManualSlipInput('');
    }
  };

  // Calculations
  const selectedSlipsDetails = availableSlips.filter(s => selectedSlips.includes(s.id));
  const totalRolls = selectedSlipsDetails.reduce((sum, s) => sum + parseInt(s.total_rolls || 0), 0);
  const totalQty = selectedSlipsDetails.reduce((sum, s) => sum + parseFloat(s.total_qty || 0), 0);
  const totalWeight = selectedSlipsDetails.reduce((sum, s) => sum + parseFloat(s.total_weight || 0), 0);

  let totalGross = 0;
  const itemsCalculationList = selectedOrders.map(o => {
    const oSlips = availableSlips.filter(s => s.order_id === o.id && selectedSlips.includes(s.id));
    const billedQty = oSlips.reduce((sum, s) => sum + parseFloat(s.total_qty || 0), 0);
    const oDetails = itemsDetails[o.id] || { rate: '0.00', hsn: '5208', cgst: '2.5', sgst: '2.5', igst: '0' };
    const amount = billedQty * parseFloat(oDetails.rate || 0);
    totalGross += amount;

    return {
      order: o,
      billedQty,
      rate: oDetails.rate,
      hsn: oDetails.hsn,
      cgst: oDetails.cgst,
      sgst: oDetails.sgst,
      igst: oDetails.igst,
      amount
    };
  });

  const discountVal = parseFloat(discountAmount || 0);
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const finalItemsList = itemsCalculationList.map(item => {
    const lineDiscount = totalGross > 0 ? (discountVal * item.amount / totalGross) : 0;
    const taxableValue = item.amount - lineDiscount;
    const cgstAmt = taxableValue * (parseFloat(item.cgst || 0) / 100);
    const sgstAmt = taxableValue * (parseFloat(item.sgst || 0) / 100);
    const igstAmt = taxableValue * (parseFloat(item.igst || 0) / 100);

    totalTaxable += taxableValue;
    totalCgst += cgstAmt;
    totalSgst += sgstAmt;
    totalIgst += igstAmt;

    return {
      ...item,
      discount: lineDiscount,
      taxableValue,
      cgstAmt,
      sgstAmt,
      igstAmt,
      total: taxableValue + cgstAmt + sgstAmt + igstAmt
    };
  });

  const totalBillPrice = totalTaxable + totalCgst + totalSgst + totalIgst;

  const toggleOrderSelection = (o) => {
    if (selectedOrders.some(sel => sel.id === o.id)) {
      setSelectedOrders(selectedOrders.filter(sel => sel.id !== o.id));
    } else {
      setSelectedOrders([...selectedOrders, o]);
    }
  };

  const handleSave = async () => {
    if (!billDate) { setError('Please specify Bill Date.'); return; }
    if (selectedOrders.length === 0) { setError('Please select at least one order.'); return; }
    if (selectedSlips.length === 0) { setError('Please select at least one package slip.'); return; }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        bill_number: billNumber,
        bill_date: billDate,
        buyer_id: buyerId || null,
        order_id: selectedOrders[0].id,
        package_slip_ids: selectedSlips.map(sId => {
          const slip = availableSlips.find(s => s.id === sId);
          return slip ? slip.slip_number : sId;
        }),
        items: finalItemsList.map(item => ({
          order_id: item.order.id,
          order_number: item.order.order_number,
          design_name: item.order.design_name,
          design_no: item.order.design_no,
          count: getShortCountsString(item.order.technical_specs),
          construction: getConstruction(item.order.technical_specs),
          width: item.order.technical_specs?.finished_width || item.order.technical_specs?.order_width || '—',
          hsn_code: item.hsn,
          qty: item.billedQty,
          rate: parseFloat(item.rate || 0),
          amount: item.amount,
          discount_amount: item.discount,
          taxable_value: item.taxableValue,
          cgst_percent: parseFloat(item.cgst || 0),
          cgst_amount: item.cgstAmt,
          sgst_percent: parseFloat(item.sgst || 0),
          sgst_amount: item.sgstAmt,
          igst_percent: parseFloat(item.igst || 0),
          igst_amount: item.igstAmt,
          total_amount: item.total,
          po_number: item.poNumber,
          pi_number: item.piNumber,
          slips: availableSlips.filter(s => s.order_id === item.order.id && selectedSlips.includes(s.id)).map(s => ({
            slip_number: s.slip_number,
            total_rolls: s.total_rolls,
            total_qty: s.total_qty,
            total_weight: s.total_weight
          }))
        })),
        hsn_code: finalItemsList[0]?.hsn || '5208',
        uom: 'Meter',
        qty: finalItemsList.reduce((sum, i) => sum + i.billedQty, 0),
        rate: parseFloat(finalItemsList[0]?.rate || 0),
        amount: totalGross,
        discount_percent: totalGross > 0 ? (discountVal / totalGross * 100) : 0,
        discount_amount: discountVal,
        taxable_value: totalTaxable,
        cgst_percent: parseFloat(finalItemsList[0]?.cgst || 0),
        cgst_amount: totalCgst,
        sgst_percent: parseFloat(finalItemsList[0]?.sgst || 0),
        sgst_amount: totalSgst,
        igst_percent: parseFloat(finalItemsList[0]?.igst || 0),
        igst_amount: totalIgst,
        total_gst_amount: totalCgst + totalSgst + totalIgst,
        total_bill_price: totalBillPrice,
        billed_from_address: billedFrom,
        billed_to_address: billedTo,
        shipped_from_address: shippedFrom || null,
        shipped_to_address: shippedTo || null,
        transport_name: transportName || null,
        transport_mode: transportMode,
        vehicle_number: vehicleNumber || null,
        vehicle_type: vehicleType,
        freight_type: freightType,
        lr_no: lrNo || null,
        lr_date: lrDate || null,
        remarks: null,
        bank_details: JSON.stringify({
          bank_name: "TAMILNAD MERCANTILE BANK",
          branch: "SHEVAPET, SALEM",
          ac_no: "028700150950232",
          ifsc: "TMBL0000028"
        })
      };

      let res;
      if (editBillId) {
        // Fetch original bill to revert its old package slips' status
        const { data: originalBill } = await supabase
          .from('dispatch_bills')
          .select('package_slip_ids')
          .eq('id', editBillId)
          .single();
        if (originalBill && originalBill.package_slip_ids && originalBill.package_slip_ids.length > 0) {
          await supabase
            .from('dispatch_package_slips')
            .update({ status: 'created' })
            .in('slip_number', originalBill.package_slip_ids);
        }
      }
      if (editBillId) {
        res = await supabase.from('dispatch_bills').update(payload).eq('id', editBillId).select().single();
      } else {
        res = await supabase.from('dispatch_bills').insert(payload).select().single();
      }

      const { data, error: err } = res;
      if (err) throw err;

      // Update package slips statuses to 'dispatched'
      const { error: slipUpdateErr } = await supabase
        .from('dispatch_package_slips')
        .update({ status: 'dispatched' })
        .in('id', selectedSlips);
      if (slipUpdateErr) throw slipUpdateErr;

      setSuccess('Bill saved successfully!');
      if (onSaveComplete) {
        onSaveComplete(data);
      }
    } catch (e) {
      console.error(e);
      setError('Error saving bill: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!orderSearch) return true;
    const term = orderSearch.toLowerCase();
    const matchesOrderNo = o.order_number?.toLowerCase().includes(term);
    const matchesDesignName = o.design_name?.toLowerCase().includes(term);
    const matchesDesignNo = o.design_no?.toLowerCase().includes(term);
    const matchesPo = o.buyer_po_number?.toLowerCase().includes(term);
    const matchesPi = o.proforma_invoices?.[0]?.invoice_number?.toLowerCase().includes(term);
    return matchesOrderNo || matchesDesignName || matchesDesignNo || matchesPo || matchesPi;
  });

  const inputStyle = {
    width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
    border: '1.5px solid var(--border-current)', fontSize: '0.85rem',
    outline: 'none', background: 'white', boxSizing: 'border-box',
    fontFamily: 'inherit', color: 'var(--text-current)'
  };
  const labelStyle = { fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.04em' };

  const getShortCountsString = (specs) => {
    if (!specs) return '—';
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

    if (!warpStr && !weftStr) {
      return specs.yarn_type || '—';
    }

    return `${warpStr || '—'} x ${weftStr || '—'}`;
  };

  return (
    <div className="fade-in" style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={onBack} style={{ background: 'rgba(128,0,0,0.07)', border: 'none', borderRadius: '10px', padding: '0.5rem', cursor: 'pointer', color: 'var(--color-primary)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--color-primary)', margin: 0 }}>{editBillId ? 'Edit Bill/Invoice' : 'Create Bill/Invoice'}</h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Invoice Number: <strong style={{ fontFamily: 'monospace', color: 'var(--text-current)' }}>{billNumber || 'Generating...'}</strong></p>
        </div>
      </div>

      {/* Wizard Progress Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid var(--border-current)', boxShadow: 'var(--shadow-sm)' }}>
        {[
          { num: 1, label: 'Select Orders', desc: 'Choose active orders' },
          { num: 2, label: 'Select Slips', desc: 'Add package slips' },
          { num: 3, label: 'Addresses & Transport', desc: 'Vendor & shipping details' },
          { num: 4, label: 'Review & Pricing', desc: 'HSN, Rate & tax details' }
        ].map((s, idx) => {
          const isCompleted = step > s.num;
          const isActive = step === s.num;
          return (
            <React.Fragment key={s.num}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: isCompleted ? '#10b981' : isActive ? 'var(--color-primary)' : '#e2e8f0',
                  color: isCompleted || isActive ? 'white' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  boxShadow: isActive ? '0 0 0 4px rgba(128,0,0,0.15)' : 'none',
                  transition: 'all 0.3s ease'
                }}>
                  {isCompleted ? <Check size={18} /> : s.num}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: isActive ? '800' : '600', color: isActive ? 'var(--color-primary)' : '#475569' }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    {s.desc}
                  </div>
                </div>
              </div>
              {idx < 3 && (
                <div style={{ flex: 0.5, height: '2px', background: step > s.num ? '#10b981' : '#e2e8f0', margin: '0 1rem' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{error}</div>}
      {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.75rem 1rem', color: '#16a34a', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{success}</div>}

      {/* Step Contents */}
      <div style={{ minHeight: '350px' }}>

        {/* STEP 1: Select Orders */}
        {step === 1 && (
          <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '850', color: 'var(--color-primary)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 1: Select Orders</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>Search and select the orders to be included in this bill/invoice.</p>

            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <span style={labelStyle}>Search & Choose Orders</span>
              <div style={{ position: 'relative', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setShowOrderDrop(!showOrderDrop)}
                  style={{
                    ...inputStyle,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span>
                    {selectedOrders.length > 0
                      ? `${selectedOrders.length} order(s) selected`
                      : 'Search and select orders...'}
                  </span>
                  <ChevronDown size={16} />
                </button>

                {showOrderDrop && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: 'var(--shadow-lg)', zIndex: 100, maxHeight: '250px', overflowY: 'auto', marginTop: '4px', padding: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Type order no, design, PO, PI..."
                      value={orderSearch}
                      onChange={e => setOrderSearch(e.target.value)}
                      style={{ ...inputStyle, marginBottom: '0.5rem' }}
                    />
                    {filteredOrders.slice(0, 50).map(o => {
                      const isSelected = selectedOrders.some(sel => sel.id === o.id);
                      return (
                        <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.5rem', cursor: 'pointer', borderRadius: '6px' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOrderSelection(o)}
                          />
                          <div style={{ fontSize: '0.8rem' }}>
                            <strong>{o.order_number}</strong> — {o.design_no} {o.design_name}
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              PO: {o.buyer_po_number || '—'} | PI: {o.proforma_invoices?.[0]?.invoice_number || itemsDetails[o.id]?.piNumber || '—'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                    {filteredOrders.length === 0 && <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted-current)', textAlign: 'center' }}>No orders found</div>}
                  </div>
                )}
              </div>
            </div>

            {selectedOrders.length > 0 ? (
              <div>
                <span style={labelStyle}>Selected Orders summary</span>
                <div style={{ overflowX: 'auto', marginTop: '0.5rem', border: '1px solid var(--border-current)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-current)' }}>
                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Order No</th>
                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Design No & Name</th>
                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left' }}>Vendor</th>
                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Total Qty</th>
                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Already Dispatched</th>
                        <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Pending Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrders.map(o => {
                        const dispatched = alreadyDispatchedMap[o.id] || 0;
                        const pending = Math.max(0, parseFloat(o.total_quantity || 0) - dispatched);
                        return (
                          <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.6rem 0.8rem', fontWeight: '700' }}>{o.order_number}</td>
                            <td style={{ padding: '0.6rem 0.8rem' }}>{o.design_no} ({o.design_name})</td>
                            <td style={{ padding: '0.6rem 0.8rem' }}>{o.vendor?.partner_name || '—'}</td>
                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>{fmtNum(o.total_quantity)}</td>
                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', color: '#10b981' }}>{fmtNum(dispatched)}</td>
                            <td style={{ padding: '0.6rem 0.8rem', textAlign: 'right', color: 'var(--color-primary)', fontWeight: '700' }}>{fmtNum(pending)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', border: '1.5px dashed var(--border-current)', borderRadius: '12px', background: '#f8fafc', color: '#64748b', fontSize: '0.85rem' }}>
                Please select at least one order from the dropdown above to proceed.
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Select Package Slips */}
        {step === 2 && (
          <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '850', color: 'var(--color-primary)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 2: Select Package Slips</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>Choose package slips for the selected orders to include in this invoice.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
              {/* Left Column: Active Order selector + slips list */}
              <div style={{ borderRight: '1px solid var(--border-current)', paddingRight: '1.5rem' }}>
                <span style={labelStyle}>Active Order Selection</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', marginBottom: '1.25rem' }}>
                  {selectedOrders.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setActiveOrderId(o.id)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '8px',
                        border: activeOrderId === o.id ? '2px solid var(--color-primary)' : '1px solid var(--border-current)',
                        background: activeOrderId === o.id ? '#fef2f2' : 'white',
                        textAlign: 'left',
                        fontSize: '0.8rem',
                        fontWeight: activeOrderId === o.id ? '700' : 'normal',
                        cursor: 'pointer',
                        color: activeOrderId === o.id ? 'var(--color-primary)' : 'var(--text-current)',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {o.order_number} ({o.design_no})
                    </button>
                  ))}
                </div>

                {activeOrderId && (
                  <div>
                    <span style={labelStyle}>Slips of Active Order</span>

                    {/* Manual entry field */}
                    <div style={{ margin: '0.5rem 0 0.8rem 0' }}>
                      <input
                        type="text"
                        placeholder="Scan / Type slip no..."
                        value={manualSlipInput}
                        onChange={e => setManualSlipInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleMoveSlip(manualSlipInput);
                          }
                        }}
                        style={{ ...inputStyle, fontSize: '0.75rem', padding: '0.4rem 0.5rem' }}
                      />
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>Press Enter to add slip</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '250px', overflowY: 'auto' }}>
                      {availableSlips.filter(s => s.order_id === activeOrderId).length > 0 ? (
                        <>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', fontWeight: 'bold', fontSize: '0.75rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={availableSlips.filter(s => s.order_id === activeOrderId).every(s => selectedSlips.includes(s.id))}
                              onChange={(e) => {
                                const orderSlips = availableSlips.filter(s => s.order_id === activeOrderId).map(s => s.id);
                                if (e.target.checked) {
                                  setSelectedSlips(prev => [...new Set([...prev, ...orderSlips])]);
                                } else {
                                  setSelectedSlips(prev => prev.filter(id => !orderSlips.includes(id)));
                                }
                              }}
                            />
                            Select All
                          </label>
                          {availableSlips.filter(s => s.order_id === activeOrderId).map(s => {
                            const isChecked = selectedSlips.includes(s.id);
                            return (
                              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer', fontSize: '0.75rem' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedSlips(selectedSlips.filter(id => id !== s.id));
                                    } else {
                                      setSelectedSlips([...selectedSlips, s.id]);
                                    }
                                  }}
                                />
                                <div>
                                  <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>{s.slip_number}</span>
                                  <span style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: '5px' }}>({fmtNum(s.total_qty)} m, {s.total_rolls} r)</span>
                                </div>
                              </label>
                            );
                          })}
                        </>
                      ) : (
                        <div style={{ padding: '0.5rem 0', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>No slips found.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Selected Slips Summary table */}
              <div>
                <span style={labelStyle}>Billed Slips Summary ({selectedSlips.length} slips)</span>
                <div style={{ overflowY: 'auto', maxHeight: '350px', marginTop: '0.5rem', border: '1px solid var(--border-current)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Slip No</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Order No</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Rolls</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Meters</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Weight (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableSlips.filter(s => selectedSlips.includes(s.id)).map(s => {
                        const order = selectedOrders.find(o => o.id === s.order_id);
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: '600' }}>{s.slip_number}</td>
                            <td style={{ padding: '0.5rem' }}>{order?.order_number || '—'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{s.total_rolls}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{fmtNum(s.total_qty)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{fmtNum(s.total_weight, 3)}</td>
                          </tr>
                        );
                      })}
                      {selectedSlips.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                            No slips selected. Add slips using the active order list and checkboxes on the left.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedSlips.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-current)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    <div>Total Rolls: {totalRolls}</div>
                    <div style={{ textAlign: 'center' }}>Total Qty: {fmtNum(totalQty)} m</div>
                    <div style={{ textAlign: 'right' }}>Total Weight: {fmtNum(totalWeight, 3)} kg</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Address & Transport Info */}
        {step === 3 && (
          <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
            {/* Left Column: Dates, Addresses */}
            <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '850', color: 'var(--color-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 3: Dates & Addresses</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>Bill Date *</span>
                  <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} style={inputStyle} />
                </div>
              </div>

              {/* Billed From */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>Billed From (Our Address)</span>
                <textarea rows={3} value={billedFrom} onChange={e => setBilledFrom(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Billed To */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span style={labelStyle}>Consignee / Billed To *</span>
                  <select
                    onChange={e => {
                      const part = partners.find(p => p.id === e.target.value);
                      if (part) {
                        setBilledTo(`${part.partner_name}\n${part.address || ''}`);
                      }
                    }}
                    style={{ ...inputStyle, width: '220px', padding: '0.35rem', fontSize: '0.75rem' }}
                  >
                    <option value="">Prefill from Vendors...</option>
                    {partners.filter(p => p.partner_type === 'Vendor').map(p => (
                      <option key={p.id} value={p.id}>{p.partner_name} - {p.address}</option>
                    ))}
                  </select>
                </div>
                <textarea rows={3} value={billedTo} onChange={e => setBilledTo(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Shipped From */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span style={labelStyle}>Shipped From (Optional)</span>
                  <select
                    onChange={e => {
                      const part = partners.find(p => p.id === e.target.value);
                      if (part) {
                        setShippedFrom(`${part.partner_name}\n${part.address || ''}`);
                      }
                    }}
                    style={{ ...inputStyle, width: '220px', padding: '0.35rem', fontSize: '0.75rem' }}
                  >
                    <option value="">Prefill from Vendors...</option>
                    {partners.filter(p => p.partner_type === 'Vendor').map(p => (
                      <option key={p.id} value={p.id}>{p.partner_name} - {p.address}</option>
                    ))}
                  </select>
                </div>
                <textarea rows={2} value={shippedFrom} onChange={e => setShippedFrom(e.target.value)} placeholder="Type shipped from address..." style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {/* Shipped To */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span style={labelStyle}>Shipped To (Optional)</span>
                  <select
                    onChange={e => {
                      const part = partners.find(p => p.id === e.target.value);
                      if (part) {
                        setShippedTo(`${part.partner_name}\n${part.address || ''}`);
                      }
                    }}
                    style={{ ...inputStyle, width: '220px', padding: '0.35rem', fontSize: '0.75rem' }}
                  >
                    <option value="">Prefill from Vendors...</option>
                    {partners.filter(p => p.partner_type === 'Vendor').map(p => (
                      <option key={p.id} value={p.id}>{p.partner_name} - {p.address}</option>
                    ))}
                  </select>
                </div>
                <textarea rows={2} value={shippedTo} onChange={e => setShippedTo(e.target.value)} placeholder="Type shipped to address..." style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>

            {/* Right Column: Transport Info */}
            <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'fit-content' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '850', color: 'var(--color-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transporter Info</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>Transport Name</span>
                  <input
                    type="text"
                    list="transporters"
                    value={transportName}
                    onChange={e => setTransportName(e.target.value)}
                    placeholder="Select or type..."
                    style={inputStyle}
                  />
                  <datalist id="transporters">
                    {partners.filter(p => p.partner_type === 'Transportation').map(p => (
                      <option key={p.id} value={p.partner_name} />
                    ))}
                  </datalist>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>Transport Mode</span>
                  <select value={transportMode} onChange={e => setTransportMode(e.target.value)} style={inputStyle}>
                    <option>ROAD</option><option>RAIL</option><option>AIR</option><option>SHIP</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>Vehicle Number</span>
                  <input type="text" placeholder="e.g. TN-30-X-1234" value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>Vehicle Type</span>
                  <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} style={inputStyle}>
                    <option value="R">R (Regular)</option>
                    <option value="ODC">ODC (Over Dimension)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>LR Number</span>
                  <input type="text" placeholder="e.g. LR-402928" value={lrNo} onChange={e => setLrNo(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={labelStyle}>LR Date</span>
                  <input type="date" value={lrDate} onChange={e => setLrDate(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={labelStyle}>Freight Type</span>
                <select value={freightType} onChange={e => setFreightType(e.target.value)} style={inputStyle}>
                  <option>Collection</option>
                  <option>Prepaid</option>
                  <option>To Pay</option>
                  <option>Self Paid</option>
                  <option>Self To Pay</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Review & Pricing */}
        {step === 4 && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '16px', padding: '1.5rem', boxShadow: 'var(--shadow-md)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '850', color: 'var(--color-primary)', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 4: Items, Taxes & Review</h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border-current)' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Goods Description (Order/Design/Specs)</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', width: '100px' }}>HSN</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', width: '90px' }}>Order Qty</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', width: '90px' }}>Billed Qty</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', width: '110px' }}>Rate (₹/m)</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', width: '110px' }}>Gross Amt</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', width: '70px' }}>CGST %</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', width: '70px' }}>SGST %</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', width: '70px' }}>IGST %</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', width: '130px' }}>Net Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalItemsList.map(item => (
                      <tr key={item.order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Order: {item.order.order_number}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                            <div><strong>Design:</strong> {item.order.design_name || '—'} ({item.order.design_no || '—'})</div>
                            <div><strong>Yarn Count:</strong> {getShortCountsString(item.order.technical_specs)}</div>
                            <div><strong>Construction:</strong> {getConstruction(item.order.technical_specs)}</div>
                            <div><strong>Width:</strong> {item.order.technical_specs?.finished_width || item.order.technical_specs?.order_width || '—'}"</div>
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <input
                            type="text"
                            value={item.hsn}
                            onChange={e => {
                              const val = e.target.value;
                              setItemsDetails(prev => ({
                                ...prev,
                                [item.order.id]: { ...(prev[item.order.id] || {}), hsn: val }
                              }));
                            }}
                            style={{ ...inputStyle, textAlign: 'center', padding: '0.35rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{fmtNum(item.order.total_quantity)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>{fmtNum(item.billedQty)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.rate}
                            onChange={e => {
                              const val = e.target.value;
                              setItemsDetails(prev => ({
                                ...prev,
                                [item.order.id]: { ...(prev[item.order.id] || {}), rate: val }
                              }));
                            }}
                            style={{ ...inputStyle, textAlign: 'right', padding: '0.35rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>₹{fmtNum(item.amount)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.cgst}
                            onChange={e => {
                              const val = e.target.value;
                              const num = parseFloat(val || 0);
                              setItemsDetails(prev => {
                                const current = prev[item.order.id] || {};
                                return {
                                  ...prev,
                                  [item.order.id]: {
                                    ...current,
                                    cgst: val,
                                    sgst: num > 0 ? (current.sgst === '0' ? val : current.sgst) : current.sgst,
                                    igst: num > 0 ? '0' : current.igst
                                  }
                                };
                              });
                            }}
                            style={{ ...inputStyle, textAlign: 'center', padding: '0.35rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.sgst}
                            onChange={e => {
                              const val = e.target.value;
                              const num = parseFloat(val || 0);
                              setItemsDetails(prev => {
                                const current = prev[item.order.id] || {};
                                return {
                                  ...prev,
                                  [item.order.id]: {
                                    ...current,
                                    sgst: val,
                                    igst: num > 0 ? '0' : current.igst
                                  }
                                };
                              });
                            }}
                            style={{ ...inputStyle, textAlign: 'center', padding: '0.35rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.igst}
                            onChange={e => {
                              const val = e.target.value;
                              const num = parseFloat(val || 0);
                              setItemsDetails(prev => {
                                const current = prev[item.order.id] || {};
                                return {
                                  ...prev,
                                  [item.order.id]: {
                                    ...current,
                                    igst: val,
                                    cgst: num > 0 ? '0' : current.cgst,
                                    sgst: num > 0 ? '0' : current.sgst
                                  }
                                };
                              });
                            }}
                            style={{ ...inputStyle, textAlign: 'center', padding: '0.35rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>₹{fmtNum(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Discount input and final summary calculations */}
              <div style={{ borderTop: '1.5px solid var(--border-current)', marginTop: '1.5rem', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Gross Amount:</span>
                    <span style={{ fontFamily: 'monospace' }}>₹{fmtNum(totalGross)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Discount Amount:</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={discountAmount}
                      onChange={e => setDiscountAmount(e.target.value)}
                      style={{ ...inputStyle, width: '120px', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Taxable Value:</span>
                    <span style={{ fontFamily: 'monospace' }}>₹{fmtNum(totalTaxable)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#4b5563' }}>Total Taxes (GST):</span>
                    <span style={{ fontFamily: 'monospace', color: '#4b5563' }}>₹{fmtNum(totalCgst + totalSgst + totalIgst)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #ccc', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: '900', color: 'var(--color-primary)' }}>Total Bill Price:</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '950', fontFamily: 'monospace', color: 'var(--color-primary)' }}>₹{fmtNum(totalBillPrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1.5px solid var(--border-current)', paddingTop: '1.5rem' }}>
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            style={{
              background: 'rgba(128,0,0,0.06)',
              color: 'var(--color-primary)',
              border: '1.5px solid rgba(128,0,0,0.2)',
              borderRadius: '10px',
              padding: '0.6rem 1.5rem',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.87rem',
              outline: 'none'
            }}
          >
            Back to Step {step - 1}
          </button>
        ) : (
          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'rgba(128,0,0,0.06)',
              color: 'var(--color-primary)',
              border: '1.5px solid rgba(128,0,0,0.2)',
              borderRadius: '10px',
              padding: '0.6rem 1.5rem',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.87rem',
              outline: 'none'
            }}
          >
            Cancel
          </button>
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={() => {
              // Validations per step
              if (step === 1) {
                if (selectedOrders.length === 0) {
                  setError('Please select at least one order to proceed.');
                  setTimeout(() => setError(''), 3000);
                  return;
                }
              } else if (step === 2) {
                if (selectedSlips.length === 0) {
                  setError('Please select at least one package slip to proceed.');
                  setTimeout(() => setError(''), 3000);
                  return;
                }
              } else if (step === 3) {
                if (!billDate) {
                  setError('Please specify Bill Date.');
                  setTimeout(() => setError(''), 3000);
                  return;
                }
                if (!billedTo.trim()) {
                  setError('Please specify Consignee / Billed To address.');
                  setTimeout(() => setError(''), 3000);
                  return;
                }
              }
              setError('');
              setStep(step + 1);
            }}
            style={{
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '0.6rem 1.5rem',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.87rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              outline: 'none'
            }}
          >
            <span>Next Step</span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            style={{
              background: 'var(--color-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '0.6rem 1.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '700',
              fontSize: '0.87rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: loading ? 0.7 : 1,
              outline: 'none'
            }}
          >
            {loading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={15} />}
            {loading ? 'Saving...' : 'Save & Print Invoice'}
          </button>
        )}
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

  // 'dashboard' | 'list' | 'bill_create' | 'package_slip_create' | 'package_slip_edit'
  const [view, setView] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('bills'); // 'bills' | 'slips'

  const [selectedSlipId, setSelectedSlipId] = useState(null);
  const [selectedBillId, setSelectedBillId] = useState(null);

  // Print preview trigger triggers
  const [printType, setPrintType] = useState(null); // 'package_slip' | 'invoice' | 'packing_list'
  const [printData, setPrintData] = useState(null);

  // Reset view when hitting sidebar link
  useEffect(() => {
    setView('dashboard');
    setActiveTab('bills');
    setSelectedSlipId(null);
    setSelectedBillId(null);
    setPrintType(null);
    setPrintData(null);
  }, [location.key]);

  const handlePrintSlipDirectly = (slip) => {
    setPrintType('package_slip');
    setPrintData(slip);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const enrichBillWithOrders = async (bill) => {
    if (!bill) return bill;

    // 1. Fetch package slips if not present
    if (bill.package_slip_ids && bill.package_slip_ids.length > 0 && (!bill.slips || bill.slips.length === 0)) {
      try {
        const { data: slips } = await supabase
          .from('dispatch_package_slips')
          .select('id, slip_number, order_id, total_rolls, total_qty, total_weight')
          .in('slip_number', bill.package_slip_ids);
        bill.slips = slips || [];
      } catch (err) {
        console.error("Error fetching slips for bill enrichment:", err);
      }
    }

    // 2. Compute total weight from all package slips in the bill
    const calculatedWeight = (bill.slips || []).reduce((sum, s) => sum + parseFloat(s.total_weight || 0), 0);
    if (calculatedWeight > 0) {
      bill.total_weight = calculatedWeight;
    }

    // 3. Enrich bill items with PO & PI numbers
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

  const handlePrintInvoiceDirectly = async (bill) => {
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
      } catch (err) {
        console.error('Error generating E-Invoice QR Code for printing:', err);
      }
    }
    setPrintType('einvoice');
    setPrintData({ ...enriched, einvoice_qr_url: qrDataUrl });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handlePrintPackingListDirectly = async (bill) => {
    const enriched = await enrichBillWithOrders(bill);
    setPrintType('packing_list');
    setPrintData(enriched);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleSaveBillComplete = async (bill) => {
    const enriched = await enrichBillWithOrders(bill);
    // Automatically trigger prints and reset view
    setPrintType('invoice');
    setPrintData(enriched);
    setTimeout(() => {
      window.print();
      setView('list');
      setActiveTab('bills');
    }, 150);
  };

  return (
    <div style={{ padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .tab-btn {
          padding: 0.6rem 1.25rem;
          border: none;
          background: transparent;
          color: #64748b;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }
        .tab-btn.active {
          color: var(--color-primary);
          border-bottom: 2px solid var(--color-primary);
        }
      `}</style>

      {/* ─── Dispatch Control Hub (Dashboard) ─── */}
      {view === 'dashboard' && (
        <div className="fade-in" style={{ maxWidth: '1000px', margin: '2rem auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ display: 'inline-flex', width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #800000, #4d0000)', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(128,0,0,0.25)', marginBottom: '1rem' }}>
              <Truck size={28} color="white" />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--color-primary)', margin: '0 0 0.5rem 0' }}>Dispatch Control Hub</h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted-current)', margin: 0 }}>Select an operation module to begin dispatching and invoicing.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>

            {/* Card 1: Package Slips */}
            <div
              onClick={() => {
                setView('list');
                setActiveTab('slips');
              }}
              style={{
                background: 'white',
                border: '1.5px solid var(--border-current)',
                borderRadius: '24px',
                padding: '2.5rem 2rem',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(128,0,0,0.12)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-current)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
            >
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(128,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: '1.5rem' }}>
                <Package size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 0.75rem 0', color: 'var(--color-primary)' }}>Package Slips</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
                Generate detailed packing lists, record roll quantities, manage roll status, and print package slips.
              </p>
            </div>

            {/* Card 2: Bills & Invoices */}
            <div
              onClick={() => {
                setView('list');
                setActiveTab('bills');
              }}
              style={{
                background: 'white',
                border: '1.5px solid var(--border-current)',
                borderRadius: '24px',
                padding: '2.5rem 2rem',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(128,0,0,0.12)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-current)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
            >
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(128,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', marginBottom: '1.5rem' }}>
                <ReceiptText size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 0.75rem 0', color: 'var(--color-primary)' }}>Bills & Invoices</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
                Generate customer tax invoices, print tax summaries, manage freight particulars, and print detailed packing lists.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* ─── Tabs Navigator ─── */}
      {view === 'list' && (
        <div className="fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #800000, #4d0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(128,0,0,0.35)' }}>
              <Truck size={22} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--color-primary)', margin: 0 }}>Dispatch Control Center</h1>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted-current)', margin: 0 }}>Manage dispatch bills, invoices, and packing list documents.</p>
            </div>
          </div>


          {activeTab === 'bills' ? (
            <BillList
              onCreateNew={() => setView('bill_create')}
              onEdit={(id) => {
                setSelectedBillId(id);
                setView('bill_edit');
              }}
              onPrintInvoice={handlePrintInvoiceDirectly}
              onPrintEInvoice={handlePrintEInvoiceDirectly}
              onPrintPackingList={handlePrintPackingListDirectly}
              onBackToDashboard={() => setView('dashboard')}
            />
          ) : (
            <PackageSlipList
              onCreateNew={() => setView('package_slip_create')}
              onEdit={(id) => {
                setSelectedSlipId(id);
                setView('package_slip_edit');
              }}
              onPrint={handlePrintSlipDirectly}
              onBackToDashboard={() => setView('dashboard')}
            />
          )}
        </div>
      )}

      {/* ─── Invoice Create Form ─── */}
      {view === 'bill_create' && (
        <BillForm
          onBack={() => setView('list')}
          onSaveComplete={handleSaveBillComplete}
        />
      )}

      {/* ─── Invoice Edit Form ─── */}
      {view === 'bill_edit' && (
        <BillForm
          editBillId={selectedBillId}
          onBack={() => {
            setSelectedBillId(null);
            setView('list');
          }}
          onSaveComplete={handleSaveBillComplete}
        />
      )}

      {/* ─── Package Slip Create Form ─── */}
      {view === 'package_slip_create' && (
        <PackageSlipForm
          onBack={() => {
            setView('list');
            setActiveTab('slips');
          }}
        />
      )}

      {/* ─── Package Slip Edit Form ─── */}
      {view === 'package_slip_edit' && (
        <PackageSlipForm
          editSlipId={selectedSlipId}
          onBack={() => {
            setSelectedSlipId(null);
            setView('list');
            setActiveTab('slips');
          }}
        />
      )}

      {/* ───────────────────────────────────────────── */}
      {/* ─── Printing Layouts Container ─── */}
      {/* ───────────────────────────────────────────── */}

      {/* 1. Print Package Slip */}
      {printType === 'package_slip' && printData && (
        <div className="print-only-container" style={{ display: 'none' }}>
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 0; }
              body { margin: 0; -webkit-print-color-adjust: exact; }
              body * { visibility: hidden; }
              .print-only-container, .print-only-container * { visibility: visible; }
              .print-only-container { position: absolute; left: 0; top: 0; width: 100%; display: block !important; background: white; color: black; font-family: Arial, sans-serif; margin: 0; padding: 0; }
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
                    <h1 style={{ margin: '0 0 1px 0', fontSize: '18px', fontWeight: '950', letterSpacing: '0.5px' }}>ASHOK TEXTILES</h1>
                    <p style={{ margin: '0 0 1px 0', fontSize: '10px' }}>6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33</p>
                    <p style={{ margin: 0, fontSize: '10px' }}><strong>GSTIN:</strong> 33AAZFA60686D1Z6</p>
                  </div>
                </div>

                <div style={{ textAlign: 'center', padding: '0 4mm' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>PACKAGE SLIP</h2>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', border: '1px solid #000', padding: '1px 3px', borderRadius: '3px', marginTop: '1mm', display: 'inline-block' }}>
                    {copyNum === 1 ? 'COPY 1 — OFFICE' : 'COPY 2 — TRANSPORTER'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(printData.slip_number || 'SLIP')}`}
                    alt="QR Code"
                    style={{ width: '40px', height: '40px', border: '1px solid #ddd' }}
                  />
                  <span style={{ fontSize: '8px', marginTop: '1px', fontFamily: 'monospace' }}>{printData.slip_number}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4mm', marginBottom: '2mm', fontSize: '11px' }}>
                <div style={{ border: '1px solid #000', borderRadius: '4px', padding: '2mm' }}>
                  <h4 style={{ margin: '0 0 1mm 0', fontSize: '9px', textTransform: 'uppercase', color: '#555', fontWeight: 'bold' }}>Consigned To / Vendor</h4>
                  <p style={{ margin: '0 0 1px 0', fontWeight: 'bold', fontSize: '12px' }}>{printData.vendor_name}</p>
                  <p style={{ margin: '0 0 1px 0', lineHeight: '1.2' }}>{printData.vendor_address}</p>
                  <p style={{ margin: 0 }}><strong>GSTIN:</strong> {printData.vendor_gstin}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #000', borderRadius: '4px', padding: '2mm' }}>
                  <p style={{ margin: 0 }}><strong>Slip Number:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '13px' }}>{printData.slip_number}</span></p>
                  <p style={{ margin: 0 }}><strong>Slip Date:</strong> {formatDate(printData.slip_date)}</p>
                  <p style={{ margin: 0 }}><strong>PO Number:</strong> {printData.po_number}</p>
                  <p style={{ margin: 0 }}><strong>PI Number:</strong> {printData.pi_numbers}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2mm', background: '#fafafa', border: '1px solid #000', borderRadius: '4px', padding: '1.5mm 2mm', marginBottom: '2mm', fontSize: '10px' }}>
                <div><strong>Order No:</strong><br />{printData.orders?.order_number || '—'}</div>
                <div><strong>Design Name/No:</strong><br />{printData.design_name} / {printData.design_no}</div>
                <div><strong>Count:</strong><br />{printData.count}</div>
                <div><strong>Construction:</strong><br />{printData.construction}</div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', minHeight: '40mm' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'left' }}>S.No</th>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'left' }}>Roll / Piece ID</th>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'right' }}>Qty (Meters)</th>
                      <th style={{ border: '1px solid #ccc', padding: '1.5mm', textAlign: 'right' }}>Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printData.items || []).map((r, rIdx) => {
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4mm', borderTop: '1.5px solid #000', paddingTop: '2mm', marginTop: '2mm', fontSize: '11px', fontWeight: 'bold' }}>
                <div>Total Rolls: {printData.total_rolls}</div>
                <div style={{ textAlign: 'center' }}>Total Qty: {fmtNum(printData.total_qty)} Mtrs</div>
                <div style={{ textAlign: 'right' }}>Total Weight: {fmtNum(printData.total_weight, 3)} kg</div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* 2. Print Tax Invoice */}
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
                  {/* Top Left: Company Logo */}
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

                  {/* Top Middle: Company Name, Address & GST (Bold) */}
                  <div style={{ textAlign: 'center' }}>
                    <h1 style={{ margin: '0 0 2px 0', fontSize: '19px', fontWeight: '900', color: 'black', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ASHOK TEXTILES
                    </h1>
                    <p style={{ margin: '0 0 2px 0', fontSize: '10px', fontWeight: 'bold' }}>
                      6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33
                    </p>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: 'bold' }}>
                      GSTIN: 33AAZFA60686D1Z6 | STATE: 33-TAMIL NADU
                    </p>
                  </div>

                  {/* Top Right: Title & Copy */}
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
                  {/* Left Column: Receiver (Billed To) & Consignee (Shipped To) */}
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

                  {/* Right Column: Invoice & Logistics Info */}
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10.5px', background: '#fafafa' }}>
                    <div><strong>Invoice No:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12.5px' }}>{printData.bill_number}</span></div>
                    <div><strong>Invoice Date:</strong> {formatDate(printData.bill_date)}</div>
                    <div><strong>Transport Name:</strong> {printData.transport_name || '—'}</div>
                    <div><strong>L.R. No & Date:</strong> {printData.lr_no || '—'} {printData.lr_date ? `/ ${formatDate(printData.lr_date)}` : ''}</div>
                    <div><strong>Vehicle No & Type:</strong> {printData.vehicle_number || '—'} {printData.vehicle_type ? `(${printData.vehicle_type})` : ''}</div>
                    <div><strong>Package Slip No:</strong> {(printData.package_slip_numbers || (printData.package_slip_ids || []).map(id => `#${id}`).join(', ')) || '—'}</div>
                    <div><strong>Total Package Slips:</strong> {printData.package_slip_ids?.length || 0} Slip(s)</div>
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
                  {/* Left: Bank Details */}
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontWeight: 'bold', textTransform: 'uppercase', color: '#000', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                      Bank Details
                    </h4>
                    <p style={{ margin: '0 0 1px 0' }}><strong>Bank Name:</strong> TAMILNAD MERCANTILE BANK</p>
                    <p style={{ margin: '0 0 1px 0' }}><strong>Branch:</strong> SHEVAPET, SALEM - 636002</p>
                    <p style={{ margin: '0 0 1px 0' }}><strong>A/C No:</strong> 028700150950232</p>
                    <p style={{ margin: 0 }}><strong>IFSC:</strong> TMBL0000028</p>
                  </div>

                  {/* Right: Amounts Calculation Summary */}
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

                {/* Terms & Conditions and Signature Footer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '3mm', borderTop: '1px solid black', paddingTop: '2mm' }}>
                  {/* Left: Terms & Conditions */}
                  <div style={{ fontSize: '9.5px', color: '#222' }}>
                    <h5 style={{ margin: '0 0 1mm 0', fontWeight: 'bold', fontSize: '10px' }}>Terms & Conditions:</h5>
                    <ul style={{ margin: 0, paddingLeft: '4mm', lineHeight: '1.3' }}>
                      <li>Interest Will Be Charged @ 24% on All OverDue Payments</li>
                      <li>All drafts And Remittances to be Made Payable At Salem</li>
                      <li>Any Complaints And Remarks Regarding the Goods Should be Informed With in 4 Days of Receipt Of The Goods</li>
                      <li>All Disputes Subject to salem Jurisdiction Only</li>
                    </ul>
                  </div>

                  {/* Right: Authorised Signatory */}
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

                      {/* Centre: Big logo only */}
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <img src="/logo.png" alt="AT Logo" style={{ width: '150px', height: '150px', objectFit: 'contain' }} />
                      </div>

                      {/* Right: Document title + page */}
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

      {/* 4. Print Official Government E-Invoice */}
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
            <div style={{ border: '2px solid black', borderRadius: '4px', padding: '4mm', minHeight: '276mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
              <div>

                {/* Government E-Invoice Title & Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 110px', alignItems: 'center', borderBottom: '2px solid black', paddingBottom: '3mm', marginBottom: '3mm', gap: '4mm' }}>
                  {/* Left: Supplier info */}
                  <div>
                    <h1 style={{ margin: '0 0 2px 0', fontSize: '20px', fontWeight: '900', color: 'black' }}>ASHOK TEXTILES</h1>
                    <p style={{ margin: '0 0 2px 0', fontSize: '10.5px' }}>6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33</p>
                    <p style={{ margin: 0, fontSize: '10.5px' }}><strong>GSTIN:</strong> 33AAZFA60686D1Z6 | <strong>PAN:</strong> AAZFA6086D</p>
                  </div>

                  {/* Center: Official Title */}
                  <div style={{ textAlign: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '950', letterSpacing: '1px', textTransform: 'uppercase' }}>e-INVOICE</h2>
                    <span style={{ fontSize: '9px', border: '1px solid black', padding: '2px 6px', borderRadius: '3px', display: 'inline-block', marginTop: '2mm', fontWeight: 'bold', background: '#f5f5f5' }}>NIC GST PORTAL / WHITEBOOKS API</span>
                  </div>

                  {/* Right: QR Code */}
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {printData.einvoice_qr_url ? (
                      <>
                        <img src={printData.einvoice_qr_url} alt="E-Invoice QR" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
                        <div style={{ fontSize: '7.5px', fontWeight: 'bold', marginTop: '1px' }}>Signed QR Code</div>
                      </>
                    ) : (
                      <div style={{ border: '1px dashed black', width: '85px', height: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px', textAlign: 'center' }}>
                        IRN Verified
                      </div>
                    )}
                  </div>
                </div>

                {/* IRN & Acknowledgement Details Container Box */}
                <div style={{ border: '1.5px solid black', background: '#fafafa', borderRadius: '4px', padding: '3mm 4mm', marginBottom: '3mm', fontSize: '10.5px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2px' }}>
                    <div><strong>Invoice Reference Number (IRN):</strong></div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11px', wordBreak: 'break-all', color: '#000', background: '#fff', padding: '3px 6px', border: '1px solid #ccc', borderRadius: '3px' }}>
                      {printData.einvoice_irn || '—'}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '3mm', marginTop: '2mm', paddingTop: '2mm', borderTop: '1px dashed #ccc' }}>
                    <div><strong>Ack Number:</strong><br /><span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '11.5px' }}>{printData.einvoice_ack_no || '—'}</span></div>
                    <div><strong>Ack Date & Time:</strong><br /><span>{printData.einvoice_ack_date ? formatDate(printData.einvoice_ack_date) : '—'}</span></div>
                    <div><strong>Doc Type & Supply:</strong><br /><span>INV / B2B</span></div>
                    <div><strong>E-Invoice Status:</strong><br /><span style={{ fontWeight: 'bold', color: '#166534' }}>GENERATED / ACTIVE</span></div>
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
                  {/* Seller */}
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontSize: '9.5px', textTransform: 'uppercase', color: '#000', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                      1. Seller Details (SellerDtls)
                    </h4>
                    <div style={{ lineHeight: '1.3' }}>
                      <strong>ASHOK TEXTILES</strong><br />
                      6/222, SALEM MAIN ROAD, VEERAPANDI<br />
                      SALEM, TAMIL NADU - 33<br />
                      <strong>GSTIN:</strong> 33AAZFA60686D1Z6 (State Code: 33)
                    </div>
                  </div>

                  {/* Dispatched From */}
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontSize: '9.5px', textTransform: 'uppercase', color: '#000', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                      2. Dispatched From Details (DispDtls)
                    </h4>
                    <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '10px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                      {printData.shipped_from_address || printData.billed_from_address || '6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33'}
                    </pre>
                  </div>

                  {/* Buyer (Billed To) */}
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontSize: '9.5px', textTransform: 'uppercase', color: '#000', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                      3. Buyer Details (BuyerDtls - Billed To)
                    </h4>
                    <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '10px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                      {printData.billed_to_address}
                    </pre>
                  </div>

                  {/* Shipped To */}
                  <div style={{ border: '1px solid black', borderRadius: '4px', padding: '2mm', fontSize: '10px' }}>
                    <h4 style={{ margin: '0 0 1mm 0', fontSize: '9.5px', textTransform: 'uppercase', color: '#000', fontWeight: 'bold', borderBottom: '1px solid #ddd', paddingBottom: '1px' }}>
                      4. Goods Delivery Details (ShipDtls - Shipped To)
                    </h4>
                    <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '10px', whiteSpace: 'pre-wrap', lineHeight: '1.3' }}>
                      {printData.shipped_to_address || printData.billed_to_address}
                    </pre>
                  </div>
                </div>

                {/* Items & GST Schedule Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '3mm' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderTop: '1px solid black', borderBottom: '1px solid black' }}>
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
                      const cg = parseFloat(item.cgst_amount || 0);
                      const sg = parseFloat(item.sgst_amount || 0);
                      const ig = parseFloat(item.igst_amount || 0);
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

              {/* Footer Declaration & Signatures */}
              <div style={{ borderTop: '1.5px solid black', paddingTop: '2mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px', color: '#444' }}>Declaration: This is an official computer-generated e-Invoice generated via Whitebooks NIC GST API.</p>
                  <p style={{ margin: 0, fontSize: '9px', fontWeight: 'bold' }}>IRN Validation Status: SUCCESS / VERIFIED</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '8mm' }}>For ASHOK TEXTILES</div>
                  <div style={{ fontSize: '9.5px', borderTop: '1px dashed black', paddingTop: '1mm' }}>Authorized Signatory</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
