import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  QrCode, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Camera, 
  X, 
  ArrowLeft,
  Sparkles,
  Plus,
  Minus
} from 'lucide-react';

export default function WashedInspection() {
  const [scanInput, setScanInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Scanned roll info
  const [matchedRoll, setMatchedRoll] = useState(null);
  const [weavingOrder, setWeavingOrder] = useState(null);

  // Form states
  const [actualQty, setActualQty] = useState('');
  const [width, setWidth] = useState('');
  const [inspector1, setInspector1] = useState('');
  const [inspector2, setInspector2] = useState('');
  const [inspectors, setInspectors] = useState([]);
  const [washedPlace, setWashedPlace] = useState('Factory');

  // Point Defect click counts
  // Weaving defects (1pt, 2pt, 3pt, 4pt)
  const [weaving1pt, setWeaving1pt] = useState(0);
  const [weaving2pt, setWeaving2pt] = useState(0);
  const [weaving3pt, setWeaving3pt] = useState(0);
  const [weaving4pt, setWeaving4pt] = useState(0);

  // Yarn defects (1pt, 4pt)
  const [yarn1pt, setYarn1pt] = useState(0);
  const [yarn4pt, setYarn4pt] = useState(0);

  // Holes and stains (2pt, 4pt)
  const [holes2pt, setHoles2pt] = useState(0);
  const [holes4pt, setHoles4pt] = useState(0);

  // Defect Action History stacks for Undo
  const [weavingHistory, setWeavingHistory] = useState([]);
  const [yarnHistory, setYarnHistory] = useState([]);
  const [holesHistory, setHolesHistory] = useState([]);

  // Undo Handlers
  const undoLastWeaving = () => {
    if (weavingHistory.length === 0) return;
    const last = weavingHistory[weavingHistory.length - 1];
    setWeavingHistory(prev => prev.slice(0, -1));
    if (last === 1) setWeaving1pt(c => Math.max(0, c - 1));
    else if (last === 2) setWeaving2pt(c => Math.max(0, c - 1));
    else if (last === 3) setWeaving3pt(c => Math.max(0, c - 1));
    else if (last === 4) setWeaving4pt(c => Math.max(0, c - 1));
  };

  const undoLastYarn = () => {
    if (yarnHistory.length === 0) return;
    const last = yarnHistory[yarnHistory.length - 1];
    setYarnHistory(prev => prev.slice(0, -1));
    if (last === 1) setYarn1pt(c => Math.max(0, c - 1));
    else if (last === 4) setYarn4pt(c => Math.max(0, c - 1));
  };

  const undoLastHoles = () => {
    if (holesHistory.length === 0) return;
    const last = holesHistory[holesHistory.length - 1];
    setHolesHistory(prev => prev.slice(0, -1));
    if (last === 2) setHoles2pt(c => Math.max(0, c - 1));
    else if (last === 4) setHoles4pt(c => Math.max(0, c - 1));
  };

  // Camera Scanner modal state
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraScanError, setCameraScanError] = useState('');
  const scannerInstanceRef = useRef(null);

  // Auto focus input
  const inputRef = useRef(null);

  // Fetch Inspector list on mount
  useEffect(() => {
    fetchInspectors();
    loadScripts();
    if (inputRef.current) {
      inputRef.current.focus();
    }

    return () => {
      stopCameraScanner();
    };
  }, []);

  // Dynamically load html5-qrcode library for camera scans
  const loadScripts = () => {
    if (!window.Html5Qrcode) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode';
      script.async = true;
      script.onload = () => console.log('html5-qrcode library loaded.');
      document.body.appendChild(script);
    }
  };

  const fetchInspectors = async () => {
    try {
      const { data: deptData, error: deptErr } = await supabase
        .from('master_departments')
        .select('id')
        .ilike('department_name', '%inspection%');
      
      if (deptErr) throw deptErr;

      const inspectionDeptIds = (deptData || []).map(d => d.id);
      
      if (inspectionDeptIds.length > 0) {
        const { data: workersData, error: workersErr } = await supabase
          .from('master_workers')
          .select('*')
          .in('department_id', inspectionDeptIds)
          .order('worker_name', { ascending: true });
        
        if (workersErr) throw workersErr;
        setInspectors(workersData || []);
      } else {
        // Fallback: fetch all workers
        const { data: workersData } = await supabase
          .from('master_workers')
          .select('*')
          .order('worker_name', { ascending: true });
        setInspectors(workersData || []);
      }
    } catch (err) {
      console.error('Error fetching inspectors:', err);
    }
  };

  // Perform search / lookup for Washed Roll ID
  const handleSearchRoll = async (rollIdToSearch) => {
    const targetId = (rollIdToSearch || '').trim();
    if (!targetId) return;

    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    setMatchedRoll(null);
    setWeavingOrder(null);

    try {
      const { data, error: queryErr } = await supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name)
        `);

      if (queryErr) throw queryErr;

      let foundRoll = null;
      let foundOrder = null;
      let matchedByGreigeId = false;

      // Find roll by processed_roll_id in fabric_rolls, or check if it matches a greige id
      for (const order of data || []) {
        const rolls = Array.isArray(order.fabric_rolls) ? order.fabric_rolls : [];
        
        // 1. Look for processed roll match
        const processedMatch = rolls.find(r => 
          r.processed_roll_id && r.processed_roll_id.toLowerCase() === targetId.toLowerCase()
        );
        if (processedMatch) {
          foundRoll = processedMatch;
          foundOrder = order;
          break;
        }

        // 2. Check if user typed/scanned a greige roll ID
        const greigeMatch = rolls.find(r => 
          r.id.toLowerCase() === targetId.toLowerCase()
        );
        if (greigeMatch) {
          matchedByGreigeId = true;
          break;
        }
      }

      if (matchedByGreigeId) {
        setError('Only processed rolls allowed. Please enter or scan a processed roll ID, not a greige roll ID.');
        setIsLoading(false);
        return;
      }

      if (!foundRoll) {
        setError('Processed Roll ID not found. Verify if it has been generated.');
        setIsLoading(false);
        return;
      }

      // Check if received from processing
      const hasReceived = foundRoll.status === 'received_from_processing' || foundRoll.received_from_processing_at;
      if (!hasReceived) {
        setError(`Roll status is currently "${foundRoll.status || 'unknown'}". It must be received from processing first.`);
        setIsLoading(false);
        return;
      }

      // If already washed inspected, ask user if they want to re-inspect
      if (foundRoll.washed_inspected) {
        const confirmReinspect = window.confirm('This roll is already washed inspected. Do you wish to inspect again and update the details?');
        if (!confirmReinspect) {
          setError('Roll already washed inspected.');
          setIsLoading(false);
          return;
        }
      }

      setMatchedRoll(foundRoll);
      setWeavingOrder(foundOrder);
      
      // Pre-fill form fields
      setActualQty(foundRoll.washed_actual_qty ? String(foundRoll.washed_actual_qty) : (foundRoll.received_qty ? String(foundRoll.received_qty) : (foundRoll.actual_qty ? String(foundRoll.actual_qty) : '')));
      setWidth(foundRoll.washed_width ? String(foundRoll.washed_width) : '');
      setInspector1(foundRoll.washed_inspector_1 || foundRoll.inspector_1 || '');
      setInspector2(foundRoll.washed_inspector_2 || foundRoll.inspector_2 || '');

      // Reset Undo Histories
      setWeavingHistory([]);
      setYarnHistory([]);
      setHolesHistory([]);

      // Retrieve default place of the washed roll received: either Factory or Office
      let rollReceivedPlace = foundRoll.washed_place || 'Factory';
      try {
        const { data: pofsData } = await supabase
          .from('processing_orders')
          .select('received_place, received_rolls');
        
        if (pofsData) {
          const targetId = (foundRoll.processed_roll_id || foundRoll.id).toLowerCase();
          for (const pof of pofsData) {
            const rxRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
            const foundRx = rxRolls.find(rx => rx.id && rx.id.toLowerCase() === targetId);
            if (foundRx) {
              rollReceivedPlace = foundRx.received_place || pof.received_place || rollReceivedPlace;
              break;
            }
          }
        }
      } catch (err) {
        console.error('Error fetching received place:', err);
      }

      if (rollReceivedPlace.toLowerCase().includes('office')) {
        setWashedPlace('Office');
      } else {
        setWashedPlace('Factory');
      }

      // Pre-fill defect points if already inspected
      setWeaving1pt(foundRoll.washed_weaving_defect_1pt_count || 0);
      setWeaving2pt(foundRoll.washed_weaving_defect_2pt_count || 0);
      setWeaving3pt(foundRoll.washed_weaving_defect_3pt_count || 0);
      setWeaving4pt(foundRoll.washed_weaving_defect_4pt_count || 0);

      setYarn1pt(foundRoll.washed_yarn_defect_1pt_count || 0);
      setYarn4pt(foundRoll.washed_yarn_defect_4pt_count || 0);

      setHoles2pt(foundRoll.washed_holes_stains_2pt_count || 0);
      setHoles4pt(foundRoll.washed_holes_stains_4pt_count || 0);

    } catch (err) {
      console.error('Error searching roll:', err);
      setError('System error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    handleSearchRoll(scanInput);
  };

  // Camera QR scanner integration
  const startCameraScanner = () => {
    setCameraScanError('');
    if (!window.Html5Qrcode) {
      setCameraScanError('Scanner library not loaded yet. Please wait a moment and retry.');
      return;
    }
    setShowCameraScanner(true);
    
    setTimeout(() => {
      try {
        const html5QrCode = new window.Html5Qrcode("reader");
        scannerInstanceRef.current = html5QrCode;
        
        html5QrCode.start(
          { facingMode: "environment" }, 
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            setScanInput(decodedText);
            stopCameraScanner();
            handleSearchRoll(decodedText);
          },
          () => {
            // standard frame scan, bypass console logs
          }
        ).catch(err => {
          console.error("Camera start error: ", err);
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

  // Calculations
  const receivedQty = matchedRoll ? parseFloat(matchedRoll.received_qty || matchedRoll.qty || 0) : 0;
  const parsedActualQty = parseFloat(actualQty || 0);
  const shortage = parseFloat((receivedQty - parsedActualQty).toFixed(2));

  // Point summaries
  const weavingTotal = (weaving1pt * 1) + (weaving2pt * 2) + (weaving3pt * 3) + (weaving4pt * 4);
  const yarnTotal = (yarn1pt * 1) + (yarn4pt * 4);
  const holesStainsTotal = (holes2pt * 2) + (holes4pt * 4);
  const grandTotal = weavingTotal + yarnTotal + holesStainsTotal;

  // Submit Handler
  const handleSubmitInspection = async (e) => {
    e.preventDefault();
    if (!matchedRoll || !weavingOrder) return;

    if (!actualQty || parsedActualQty <= 0) {
      alert('Please enter a valid actual quantity.');
      return;
    }

    if (!inspector1) {
      alert('Please select Inspector 1.');
      return;
    }

    setIsLoading(true);
    try {
      const currentRolls = Array.isArray(weavingOrder.fabric_rolls) ? weavingOrder.fabric_rolls : [];
      
      const updatedRolls = currentRolls.map(r => {
        if (r.id.toLowerCase() === matchedRoll.id.toLowerCase()) {
          return {
            ...r,
            // Standard QC fields for tooltip and downstream compatibility
            actual_qty: parsedActualQty,
            actual_length: parsedActualQty,
            shortage: shortage,
            inspector_1: inspector1,
            inspector_2: inspector2,
            inspected_at: new Date().toISOString(),
            roll_ok: grandTotal === 0,

            // Washed Inspection specific fields
            washed_inspected: true,
            washed_inspected_at: new Date().toISOString(),
            washed_actual_qty: parsedActualQty,
            washed_shortage: shortage,
            washed_width: width ? parseFloat(width) : null,
            washed_inspector_1: inspector1,
            washed_inspector_2: inspector2,
            washed_place: washedPlace,

            washed_weaving_defect_1pt_count: weaving1pt,
            washed_weaving_defect_2pt_count: weaving2pt,
            washed_weaving_defect_3pt_count: weaving3pt,
            washed_weaving_defect_4pt_count: weaving4pt,
            washed_weaving_defect_total_points: weavingTotal,

            washed_yarn_defect_1pt_count: yarn1pt,
            washed_yarn_defect_4pt_count: yarn4pt,
            washed_yarn_defect_total_points: yarnTotal,

            washed_holes_stains_2pt_count: holes2pt,
            washed_holes_stains_4pt_count: holes4pt,
            washed_holes_stains_total_points: holesStainsTotal,

            washed_total_defect_points: grandTotal
          };
        }
        return r;
      });

      // Save to Database
      const { error: updateErr } = await supabase
        .from('weaving_orders')
        .update({ fabric_rolls: updatedRolls })
        .eq('id', weavingOrder.id);

      if (updateErr) throw updateErr;

      setSuccessMsg(`✅ Washed Roll ID "${matchedRoll.processed_roll_id || matchedRoll.id}" inspected successfully! Details stored.`);
      
      // Reset Form State
      setMatchedRoll(null);
      setWeavingOrder(null);
      setScanInput('');
      setActualQty('');
      setWidth('');
      setInspector1('');
      setInspector2('');
      setWeaving1pt(0);
      setWeaving2pt(0);
      setWeaving3pt(0);
      setWeaving4pt(0);
      setYarn1pt(0);
      setYarn4pt(0);
      setHoles2pt(0);
      setHoles4pt(0);
      setWeavingHistory([]);
      setYarnHistory([]);
      setHolesHistory([]);

      if (inputRef.current) {
        inputRef.current.focus();
      }

    } catch (err) {
      console.error('Error submitting washed inspection:', err);
      alert('Failed to submit washed inspection: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Styled helper style objects for mobile premium look
  const containerStyle = {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1rem',
    paddingBottom: '4rem',
    fontFamily: 'var(--font-sans)',
    backgroundColor: '#fafafa',
    minHeight: '90vh'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.25rem',
    borderBottom: '1.5px solid var(--border-current)',
    paddingBottom: '0.75rem'
  };

  const formCardStyle = {
    backgroundColor: 'white',
    border: '1px solid var(--border-current)',
    borderRadius: '14px',
    padding: '1.25rem',
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem'
  };

  const sectionStyle = {
    border: '1.5px solid var(--border-current)',
    borderRadius: '10px',
    padding: '0.85rem',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  };

  const sectionHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '0.4rem'
  };

  const defectGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.6rem'
  };

  const defectBtnStyle = (count) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.65rem 0.5rem',
    borderRadius: '8px',
    border: count > 0 ? '1.5px solid var(--color-primary)' : '1px solid var(--border-current)',
    background: count > 0 ? 'rgba(128, 0, 0, 0.05)' : '#fff',
    color: count > 0 ? 'var(--color-primary)' : 'var(--text-current)',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.15s ease'
  });

  const btnBadgeStyle = {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    fontSize: '0.62rem',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
  };

  const resetBtnStyle = {
    alignSelf: 'flex-end',
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '0.68rem',
    fontWeight: '700',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    transition: 'color 0.12s'
  };

  const undoBtnStyle = {
    alignSelf: 'flex-end',
    background: 'none',
    border: 'none',
    color: '#475569',
    fontSize: '0.68rem',
    fontWeight: '700',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    transition: 'color 0.12s'
  };

  return (
    <div style={containerStyle}>
      {/* Mobile Title Header */}
      <div style={headerStyle}>
        <div style={{ background: 'var(--color-primary)', color: 'white', padding: '0.45rem', borderRadius: '8px' }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0, lineHeight: 1.1 }}>Washed Inspection</h1>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Processed Fabric QC
          </span>
        </div>
      </div>

      {successMsg && (
        <div style={{
          backgroundColor: '#ecfdf5', border: '1px solid #10b981', color: '#047857',
          padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.825rem', fontWeight: '700',
          marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
          animation: 'fadeIn 0.2s ease'
        }}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c',
          padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.825rem', fontWeight: '700',
          marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
          animation: 'fadeIn 0.2s ease'
        }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Input / Scanner Section */}
      {!matchedRoll && (
        <div style={{ 
          backgroundColor: 'white', border: '1px solid var(--border-current)', 
          borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-md)',
          display: 'flex', flexDirection: 'column', gap: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🔍 Scan or Enter Washed Roll ID
            </span>
            <button
              onClick={startCameraScanner}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                backgroundColor: 'rgba(128,0,0,0.06)', border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)', padding: '6px 12px', borderRadius: '6px',
                fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
              }}
            >
              <Camera size={12} /> Scan Camera
            </button>
          </div>

          <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Scan or enter processed ID..."
                className="input-field"
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                style={{
                  width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem',
                  fontSize: '0.9rem', height: '44px', fontWeight: '600'
                }}
              />
              <QrCode size={16} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.75rem', top: '14px' }} />
            </div>
            <button
              type="submit"
              disabled={isLoading || !scanInput.trim()}
              style={{
                backgroundColor: 'var(--color-primary)', color: 'white', border: 'none',
                borderRadius: '8px', width: '48px', height: '44px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
            >
              <Search size={18} />
            </button>
          </form>
        </div>
      )}

      {/* Camera Scanning Dialog */}
      {showCameraScanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          padding: '1.5rem'
        }}>
          <div style={{ width: '100%', maxWidth: '380px', backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--color-primary)' }}>📷 QR Code Scanner</strong>
              <button onClick={stopCameraScanner} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#be123c' }}>
                <X size={20} />
              </button>
            </div>
            
            {cameraScanError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                {cameraScanError}
              </div>
            )}

            <div id="reader" style={{ width: '100%', overflow: 'hidden', borderRadius: '12px' }}></div>
            
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', textAlign: 'center' }}>
              Point the camera at the barcode/QR code on the washed roll tag.
            </span>
          </div>
        </div>
      )}

      {/* Matched Roll Inspection Form */}
      {matchedRoll && weavingOrder && (
        <form onSubmit={handleSubmitInspection} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease' }}>
          
          <button
            type="button"
            onClick={() => { setMatchedRoll(null); setWeavingOrder(null); setActualQty(''); setWidth(''); setInspector1(''); setInspector2(''); setWeaving1pt(0); setWeaving2pt(0); setWeaving3pt(0); setWeaving4pt(0); setYarn1pt(0); setYarn4pt(0); setHoles2pt(0); setHoles4pt(0); setWeavingHistory([]); setYarnHistory([]); setHolesHistory([]); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem', border: 'none',
              background: 'none', color: 'var(--text-muted-current)', fontSize: '0.75rem',
              fontWeight: '700', padding: 0, width: 'max-content', cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} /> Back to Scanner
          </button>

          {/* Roll Metadata Card */}
          <div style={{ 
            backgroundColor: '#fdfcfe', border: '1px solid #f3e8ff', borderRadius: '12px',
            padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifycontent: 'space-between', alignitems: 'center', borderbottom: '1px solid #e9d5ff', paddingbottom: '0.4rem' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                🧼 WASHED ID: {matchedRoll.processed_roll_id || matchedRoll.id}
              </span>
              <span className="badge" style={{ fontSize: '0.62rem', backgroundColor: '#f3e8ff', color: '#6b21a8', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>
                Processed
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.78rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>GREIGE ID</span>
                <strong style={{ color: 'var(--text-current)' }}>{matchedRoll.id}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>ORDER NO</span>
                <strong style={{ color: 'var(--text-current)' }}>{weavingOrder.order?.order_number || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>DESIGN</span>
                <strong style={{ color: 'var(--text-current)' }}>
                  {weavingOrder.order?.design_no || weavingOrder.design_no} / {weavingOrder.order?.design_name || '—'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>PROCESSED QTY</span>
                <strong style={{ color: 'var(--color-primary)' }}>{receivedQty} Meters</strong>
              </div>
            </div>
          </div>

          {/* Form Fields Card */}
          <div style={formCardStyle}>
            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1.5px solid var(--color-primary)', paddingBottom: '0.35rem', width: 'max-content' }}>
              📋 QC Parameters
            </h3>

            {/* Qty and Shortage Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700', fontSize: '0.72rem' }}>Actual Length (m)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="Actual meters"
                  required
                  value={actualQty}
                  onChange={e => setActualQty(e.target.value)}
                  style={{ fontWeight: '700', fontSize: '0.9rem', height: '40px' }}
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700', fontSize: '0.72rem' }}>Shortage (m)</label>
                <div style={{
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 0.75rem',
                  border: '1px solid var(--border-current)',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  color: shortage > 0 ? '#b45309' : '#047857'
                }}>
                  {shortage} m
                </div>
              </div>
            </div>

            {/* Width Row */}
            <div className="input-group" style={{ margin: 0 }}>
              <label className="input-label" style={{ fontWeight: '700', fontSize: '0.72rem' }}>Width (inches)</label>
              <input
                type="number"
                step="0.1"
                className="input-field"
                placeholder="Width in inches"
                value={width}
                onChange={e => setWidth(e.target.value)}
                style={{ fontWeight: '700', fontSize: '0.9rem', height: '40px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* Received Place option selector */}
            <div className="input-group" style={{ margin: '0.85rem 0 0 0' }}>
              <label className="input-label" style={{ fontWeight: '750', fontSize: '0.72rem' }}>Washed Roll Place (Received Location)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setWashedPlace('Factory')}
                  style={{
                    flex: 1,
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    border: washedPlace === 'Factory' ? '2px solid var(--color-primary)' : '1px solid var(--border-current)',
                    background: washedPlace === 'Factory' ? 'rgba(128, 0, 0, 0.05)' : 'white',
                    color: washedPlace === 'Factory' ? 'var(--color-primary)' : 'var(--text-muted-current)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  Factory
                </button>
                <button
                  type="button"
                  onClick={() => setWashedPlace('Office')}
                  style={{
                    flex: 1,
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    border: washedPlace === 'Office' ? '2px solid var(--color-primary)' : '1px solid var(--border-current)',
                    background: washedPlace === 'Office' ? 'rgba(128, 0, 0, 0.05)' : 'white',
                    color: washedPlace === 'Office' ? 'var(--color-primary)' : 'var(--text-muted-current)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  Office
                </button>
              </div>
            </div>

            {/* Weaving Defects Point Logger */}
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-primary)', textTransform: 'uppercase' }}>⚠️ Weaving Defects</span>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-primary)', backgroundColor: 'rgba(128, 0, 0, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                  Total: {weavingTotal} Pt
                </span>
              </div>
              <div style={defectGridStyle}>
                <button type="button" onClick={() => { setWeaving1pt(c => c + 1); setWeavingHistory(prev => [...prev, 1]); }} style={defectBtnStyle(weaving1pt)}>
                  1 Point
                  {weaving1pt > 0 && <span style={btnBadgeStyle}>{weaving1pt}</span>}
                </button>
                <button type="button" onClick={() => { setWeaving2pt(c => c + 1); setWeavingHistory(prev => [...prev, 2]); }} style={defectBtnStyle(weaving2pt)}>
                  2 Point
                  {weaving2pt > 0 && <span style={btnBadgeStyle}>{weaving2pt}</span>}
                </button>
                <button type="button" onClick={() => { setWeaving3pt(c => c + 1); setWeavingHistory(prev => [...prev, 3]); }} style={defectBtnStyle(weaving3pt)}>
                  3 Point
                  {weaving3pt > 0 && <span style={btnBadgeStyle}>{weaving3pt}</span>}
                </button>
                <button type="button" onClick={() => { setWeaving4pt(c => c + 1); setWeavingHistory(prev => [...prev, 4]); }} style={defectBtnStyle(weaving4pt)}>
                  4 Point
                  {weaving4pt > 0 && <span style={btnBadgeStyle}>{weaving4pt}</span>}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                {weavingHistory.length > 0 ? (
                  <button type="button" onClick={undoLastWeaving} style={undoBtnStyle}>
                    ↩ Undo
                  </button>
                ) : <div />}
                {(weaving1pt > 0 || weaving2pt > 0 || weaving3pt > 0 || weaving4pt > 0) && (
                  <button type="button" onClick={() => { setWeaving1pt(0); setWeaving2pt(0); setWeaving3pt(0); setWeaving4pt(0); setWeavingHistory([]); }} style={resetBtnStyle}>
                    Reset Counts
                  </button>
                )}
              </div>
            </div>

            {/* Yarn Defects Point Logger */}
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-primary)', textTransform: 'uppercase' }}>⚠️ Yarn Defects</span>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-primary)', backgroundColor: 'rgba(128, 0, 0, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                  Total: {yarnTotal} Pt
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <button type="button" onClick={() => { setYarn1pt(c => c + 1); setYarnHistory(prev => [...prev, 1]); }} style={defectBtnStyle(yarn1pt)}>
                  1 Point
                  {yarn1pt > 0 && <span style={btnBadgeStyle}>{yarn1pt}</span>}
                </button>
                <button type="button" onClick={() => { setYarn4pt(c => c + 1); setYarnHistory(prev => [...prev, 4]); }} style={defectBtnStyle(yarn4pt)}>
                  4 Point
                  {yarn4pt > 0 && <span style={btnBadgeStyle}>{yarn4pt}</span>}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                {yarnHistory.length > 0 ? (
                  <button type="button" onClick={undoLastYarn} style={undoBtnStyle}>
                    ↩ Undo
                  </button>
                ) : <div />}
                {(yarn1pt > 0 || yarn4pt > 0) && (
                  <button type="button" onClick={() => { setYarn1pt(0); setYarn4pt(0); setYarnHistory([]); }} style={resetBtnStyle}>
                    Reset Counts
                  </button>
                )}
              </div>
            </div>

            {/* Holes and Stains Point Logger */}
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-primary)', textTransform: 'uppercase' }}>⚠️ Holes & Stains</span>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--color-primary)', backgroundColor: 'rgba(128, 0, 0, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                  Total: {holesStainsTotal} Pt
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <button type="button" onClick={() => { setHoles2pt(c => c + 1); setHolesHistory(prev => [...prev, 2]); }} style={defectBtnStyle(holes2pt)}>
                  2 Point
                  {holes2pt > 0 && <span style={btnBadgeStyle}>{holes2pt}</span>}
                </button>
                <button type="button" onClick={() => { setHoles4pt(c => c + 1); setHolesHistory(prev => [...prev, 4]); }} style={defectBtnStyle(holes4pt)}>
                  4 Point
                  {holes4pt > 0 && <span style={btnBadgeStyle}>{holes4pt}</span>}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                {holesHistory.length > 0 ? (
                  <button type="button" onClick={undoLastHoles} style={undoBtnStyle}>
                    ↩ Undo
                  </button>
                ) : <div />}
                {(holes2pt > 0 || holes4pt > 0) && (
                  <button type="button" onClick={() => { setHoles2pt(0); setHoles4pt(0); setHolesHistory([]); }} style={resetBtnStyle}>
                    Reset Counts
                  </button>
                )}
              </div>
            </div>

            {/* Total Summary */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border-current)'
            }}>
              <div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-current)', display: 'block' }}>Defect Score Summary</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>Combined defect points counted</span>
              </div>
              <span style={{ fontSize: '1rem', fontWeight: '800', color: grandTotal > 0 ? '#be123c' : '#047857' }}>
                {grandTotal} Points
              </span>
            </div>

            {/* Inspectors Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', borderTop: '1px dashed var(--border-current)', paddingTop: '1rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700', fontSize: '0.72rem' }}>Inspector 1</label>
                <select
                  className="input-field"
                  value={inspector1}
                  required
                  onChange={e => setInspector1(e.target.value)}
                  style={{ paddingRight: '1.5rem', fontWeight: '600' }}
                >
                  <option value="">Select Inspector 1</option>
                  {inspectors.map((w) => (
                    <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700', fontSize: '0.72rem' }}>Inspector 2</label>
                <select
                  className="input-field"
                  value={inspector2}
                  onChange={e => setInspector2(e.target.value)}
                  style={{ paddingRight: '1.5rem', fontWeight: '600' }}
                >
                  <option value="">Select Inspector 2</option>
                  {inspectors.map((w) => (
                    <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '0.8rem', border: 'none', borderRadius: '10px',
                backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: '800',
                fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-primary)',
                transition: 'all var(--transition-fast)'
              }}
              className="hover-lift"
            >
              <CheckCircle size={18} /> Submit QC Results
            </button>
          </div>
        </form>
      )}

      {/* Keyframe Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
