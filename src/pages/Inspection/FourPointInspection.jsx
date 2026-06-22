import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  QrCode, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  User, 
  Plus, 
  X, 
  Camera, 
  ChevronRight, 
  ArrowLeft,
  Settings,
  Sparkles,
  Calendar,
  Layers,
  FileText
} from 'lucide-react';

// Predefined warp and weft comments from the images provided
const WARP_COMMENTS_OPTIONS = [
  'MISSED ENDS',
  'TEMPER YARN CUT',
  'REED DRAWING MISTAKE',
  'DOUBLE ENDS',
  'END DRAWING MISTAKE',
  'REED GAP',
  'THICK REED',
  'THICK ENDS',
  'SHRINKED ENDS',
  'DOBBY MISTAKE',
  'REED MISTAKE',
  'WRONG COLOURED ENDS',
  'CONTINUE FLOATS'
];

const WEFT_COMMENTS_OPTIONS = [
  'TWILL SIDE MISTAKE',
  'DOUBLE PICK',
  'WEFT DESIGN MISTAKE',
  'THICK PLACE',
  'GAP PLACE',
  'SHRINKED YARN',
  'SHORT PICK',
  'MORE PICK',
  'LESS PICK',
  'COLOUR STREAKS',
  'HOLES',
  'THIRAI',
  'COLOUR PATTAI',
  'EXTRA YARN',
  'LESS SHRINK',
  'FACE SIDE MISTAKE'
];

export default function FourPointInspection() {
  const [scanInput, setScanInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Scanned roll info
  const [matchedRoll, setMatchedRoll] = useState(null);
  const [weavingOrder, setWeavingOrder] = useState(null);

  // Form states
  const [actualQty, setActualQty] = useState('');
  const [mistakeQty, setMistakeQty] = useState('0');
  const [inspector1, setInspector1] = useState('');
  const [inspector2, setInspector2] = useState('');
  const [isRollOk, setIsRollOk] = useState(true);
  const [selectedWarpComments, setSelectedWarpComments] = useState([]);
  const [selectedWeftComments, setSelectedWeftComments] = useState([]);
  const [attendedFitter, setAttendedFitter] = useState('');
  const [inspectors, setInspectors] = useState([]);

  // Camera Scanner modal state
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraScanError, setCameraScanError] = useState('');
  const scannerInstanceRef = useRef(null);

  // Auto focus input
  const inputRef = useRef(null);

  // Fetch Inspector list (workers under Inspection department) on mount
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
        // Fallback: fetch all workers if no specific inspection department found
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

  // Perform scanner matching lookup
  const handleSearchRoll = async (rollIdToSearch) => {
    const targetId = (rollIdToSearch || '').trim();
    if (!targetId) return;

    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    setMatchedRoll(null);
    setWeavingOrder(null);

    try {
      // Query weaving orders that contain the roll in fabric_rolls
      const { data, error: queryErr } = await supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name)
        `);

      if (queryErr) throw queryErr;

      let foundRoll = null;
      let foundOrder = null;

      // Find roll by ID in fabric_rolls jsonb
      for (const order of data || []) {
        const rolls = Array.isArray(order.fabric_rolls) ? order.fabric_rolls : [];
        const match = rolls.find(r => r.id.toLowerCase() === targetId.toLowerCase());
        if (match) {
          foundRoll = match;
          foundOrder = order;
          break;
        }
      }

      if (!foundRoll) {
        setError('greige not scanned at input');
        setIsLoading(false);
        return;
      }

      // If roll status is already 4_point_inspected or beyond, ask user if they want to re-inspect
      if (foundRoll.status === '4_point_inspected' || foundRoll.status === 'sent_to_processing' || foundRoll.status === 'received_from_processing') {
        const confirmReinspect = window.confirm('already 4 point inspected. Do you wish to again 4 point inspect and change the data?');
        if (!confirmReinspect) {
          setError('already 4 point inspected');
          setIsLoading(false);
          return;
        }
      } else if (foundRoll.status !== 'greige received') {
        setError('greige not scanned at input');
        setIsLoading(false);
        return;
      }

      // Roll is found and either is greige received or user agreed to re-inspect
      setMatchedRoll(foundRoll);
      setWeavingOrder(foundOrder);
      
      // Pre-fill form fields
      if (foundRoll.status === '4_point_inspected' || foundRoll.status === 'sent_to_processing' || foundRoll.status === 'received_from_processing') {
        setActualQty(foundRoll.actual_qty ? String(foundRoll.actual_qty) : (foundRoll.qty ? String(foundRoll.qty) : ''));
        setMistakeQty(foundRoll.mistake !== undefined ? String(foundRoll.mistake) : '0');
        setIsRollOk(foundRoll.roll_ok !== undefined ? foundRoll.roll_ok : true);
        setSelectedWarpComments(Array.isArray(foundRoll.warp_comments) ? foundRoll.warp_comments : []);
        setSelectedWeftComments(Array.isArray(foundRoll.weft_comments) ? foundRoll.weft_comments : []);
        setAttendedFitter(foundRoll.attended_fitter || '');
        setInspector1(foundRoll.inspector_1 || '');
        setInspector2(foundRoll.inspector_2 || '');
      } else {
        setActualQty(foundRoll.qty ? String(foundRoll.qty) : '');
        setMistakeQty('0');
        setIsRollOk(true);
        setSelectedWarpComments([]);
        setSelectedWeftComments([]);
        setAttendedFitter('');
        setInspector1('');
        setInspector2('');
      }
    } catch (err) {
      console.error('Error searching roll ID:', err);
      setError('System error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    handleSearchRoll(scanInput);
  };

  // Handle camera scanner toggle
  const startCameraScanner = () => {
    setCameraScanError('');
    if (!window.Html5Qrcode) {
      setCameraScanError('Scanner library not loaded. Please wait a second and retry.');
      return;
    }
    setShowCameraScanner(true);
    
    // Allow React to mount the reader div
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
            // Success
            setScanInput(decodedText);
            stopCameraScanner();
            handleSearchRoll(decodedText);
          },
          () => {
            // Standard search logging, ignore to prevent console flooding
          }
        ).catch(err => {
          console.error("Camera start error: ", err);
          setCameraScanError("Could not access camera. Make sure permissions are allowed.");
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

  // Comments toggler handlers (Pill style tags)
  const toggleWarpComment = (comment) => {
    setSelectedWarpComments(prev => 
      prev.includes(comment) ? prev.filter(c => c !== comment) : [...prev, comment]
    );
  };

  const toggleWeftComment = (comment) => {
    setSelectedWeftComments(prev => 
      prev.includes(comment) ? prev.filter(c => c !== comment) : [...prev, comment]
    );
  };

  // Automatic calculation helpers
  const greigeQty = matchedRoll ? parseFloat(matchedRoll.qty || 0) : 0;
  const parsedActualQty = parseFloat(actualQty || 0);
  const parsedMistakeQty = parseFloat(mistakeQty || 0);
  const shortage = parseFloat((greigeQty - parsedActualQty).toFixed(2));
  const approvedQty = parseFloat((parsedActualQty - parsedMistakeQty).toFixed(2));

  // Submit the inspection form
  const handleSubmitInspection = async (e) => {
    e.preventDefault();
    if (!matchedRoll || !weavingOrder) return;

    if (!actualQty || parsedActualQty <= 0) {
      alert('Please enter a valid actual quantity.');
      return;
    }

    if (parsedMistakeQty < 0 || parsedMistakeQty > parsedActualQty) {
      alert('Mistake quantity must be between 0 and actual quantity.');
      return;
    }

    if (!inspector1) {
      alert('Please select Inspector 1.');
      return;
    }

    setIsLoading(true);
    try {
      // Read current rolls array of weaving order
      const currentRolls = Array.isArray(weavingOrder.fabric_rolls) ? weavingOrder.fabric_rolls : [];
      
      // Update targeted roll values
      const updatedRolls = currentRolls.map(r => {
        if (r.id.toLowerCase() === matchedRoll.id.toLowerCase()) {
          return {
            ...r,
            status: '4_point_inspected',
            actual_qty: parsedActualQty,
            actual_length: parsedActualQty, // "becomes the qty in the actual length"
            shortage: shortage,
            mistake: parsedMistakeQty,
            approved_qty: approvedQty,
            inspector_1: inspector1,
            inspector_2: inspector2,
            roll_ok: isRollOk,
            warp_comments: isRollOk ? [] : selectedWarpComments,
            weft_comments: isRollOk ? [] : selectedWeftComments,
            attended_fitter: attendedFitter,
            inspected_at: new Date().toISOString()
          };
        }
        return r;
      });

      // Update weaving_orders table
      const { error: updateErr } = await supabase
        .from('weaving_orders')
        .update({ fabric_rolls: updatedRolls })
        .eq('id', weavingOrder.id);

      if (updateErr) throw updateErr;

      setSuccessMsg(`✅ Roll ID ${matchedRoll.id} inspected successfully! Status updated to "4_point_inspected".`);
      setMatchedRoll(null);
      setWeavingOrder(null);
      setScanInput('');
      
      // Reset auto-calculated forms
      setActualQty('');
      setMistakeQty('0');
      setInspector1('');
      setInspector2('');
      setIsRollOk(true);
      setSelectedWarpComments([]);
      setSelectedWeftComments([]);
      setAttendedFitter('');

      // Focus back to scanning field
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (err) {
      console.error('Error submitting inspection:', err);
      alert('Failed to submit inspection: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem', paddingBottom: '3rem', fontFamily: 'var(--font-sans)' }}>
      {/* Mobile Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem' }}>
        <div style={{ background: 'var(--color-primary)', color: 'white', padding: '0.4rem', borderRadius: '8px' }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-primary)', lineHeight: 1.1 }}>4 Point Inspection</h1>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Loom Greige Fabric QC
          </span>
        </div>
      </div>

      {successMsg && (
        <div style={{
          backgroundColor: '#ecfdf5', border: '1px solid #10b981', color: '#047857',
          padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.825rem', fontWeight: '700',
          marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c',
          padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.825rem', fontWeight: '700',
          marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
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
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🔍 Scan or Enter Fabric Roll ID
            </span>
            <button
              onClick={startCameraScanner}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                backgroundColor: 'rgba(128,0,0,0.06)', border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)', padding: '4px 10px', borderRadius: '6px',
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
                placeholder="Type or Scan Roll ID..."
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

          {/* Pulse Scanner Decoration */}
          <div style={{
            height: '2px', width: '100%', background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
            animation: 'pulse 1.5s infinite', borderRadius: '1px', opacity: 0.7
          }} />
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
          <div style={{ width: '100%', maxWidth: '380px', backgroundColor: 'white', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--color-primary)' }}>📷 QR Code Camera Scanner</strong>
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
              Point the phone camera at the QR code on the roll label.
            </span>
          </div>
        </div>
      )}

      {/* Main Inspection Form */}
      {matchedRoll && weavingOrder && (
        <form onSubmit={handleSubmitInspection} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease-out' }}>
          
          {/* Back button */}
          <button
            type="button"
            onClick={() => { setMatchedRoll(null); setWeavingOrder(null); }}
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
            backgroundColor: '#fffcfc', border: '1px solid #fee2e2', borderRadius: '12px',
            padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fecdd3', paddingBottom: '0.4rem' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                🏷️ ID: {matchedRoll.id}
              </span>
              <span className="badge badge-warning" style={{ fontSize: '0.62rem', backgroundColor: '#fef3c7', color: '#b45309' }}>
                Greige Received
              </span>
            </div>

            <div className="responsive-grid-2" style={{ fontSize: '0.78rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>WEAVING ORDER FORM</span>
                <strong style={{ color: 'var(--text-current)' }}>{weavingOrder.weaving_number}</strong>
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
                <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>GREIGE QTY</span>
                <strong style={{ color: 'var(--color-primary)' }}>{matchedRoll.qty} Meters</strong>
              </div>
              <div className="mobile-span-2" style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>GREIGE INPUT DATE</span>
                <strong style={{ color: 'var(--text-current)' }}>
                  {matchedRoll.received_at ? new Date(matchedRoll.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </strong>
              </div>
            </div>
          </div>

          {/* Form Fields Card */}
          <div style={{
            backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '12px',
            padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem',
            boxShadow: 'var(--shadow-md)'
          }}>
            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1.5px solid var(--color-primary)', paddingBottom: '0.35rem', width: 'max-content' }}>
              📋 QC Parameters
            </h3>

            {/* Qty and Calculations */}
            <div className="responsive-grid-2">
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
                  style={{ fontWeight: '700' }}
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700', fontSize: '0.72rem' }}>Shortage (m)</label>
                <div className="calculation-display" style={{
                  color: shortage > 0 ? '#b45309' : '#047857'
                }}>
                  {shortage} m
                </div>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700', fontSize: '0.72rem' }}>Mistakes Qty (m)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  placeholder="Defects in m"
                  value={mistakeQty}
                  onChange={e => setMistakeQty(e.target.value)}
                  style={{ fontWeight: '700', color: '#be123c' }}
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700', fontSize: '0.72rem' }}>Approved Qty (m)</label>
                <div className="calculation-display" style={{
                  backgroundColor: 'rgba(16,185,129,0.06)', borderColor: '#10b981',
                  fontWeight: '800', color: '#047857'
                }}>
                  {approvedQty} m
                </div>
              </div>
            </div>

            {/* Inspector Selection */}
            <div className="responsive-grid-2" style={{ borderTop: '1px dashed var(--border-current)', paddingTop: '1rem' }}>
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

            {/* Roll Status: Roll OK */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border-current)', marginTop: '0.25rem'
            }}>
              <div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-current)', display: 'block' }}>Roll OK</strong>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>No defects observed in this fabric roll</span>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                <input
                  type="checkbox"
                  checked={isRollOk}
                  onChange={e => setIsRollOk(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: isRollOk ? 'var(--color-primary)' : '#cbd5e1',
                  transition: '0.2s', borderRadius: '24px',
                  display: 'flex', alignItems: 'center', padding: '2px'
                }}>
                  <span style={{
                    height: '20px', width: '20px', borderRadius: '50%', backgroundColor: 'white',
                    transition: '0.2s', transform: isRollOk ? 'translateX(22px)' : 'translateX(0px)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </span>
              </label>
            </div>

            {/* Comments Dropdowns / Checklists */}
            {!isRollOk && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px dashed var(--border-current)', paddingTop: '1rem', animation: 'fadeIn 0.15s ease-out' }}>
                
                {/* Warp Comments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label className="input-label" style={{ fontWeight: '800', fontSize: '0.72rem', color: '#be123c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ⚠️ Warp Comments
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-current)', padding: '0.5rem', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                    {WARP_COMMENTS_OPTIONS.map((comment) => {
                      const isSelected = selectedWarpComments.includes(comment);
                      return (
                        <button
                          key={comment}
                          type="button"
                          onClick={() => toggleWarpComment(comment)}
                          style={{
                            padding: '4px 10px', borderRadius: '15px', border: '1px solid',
                            borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-current)',
                            background: isSelected ? 'rgba(128,0,0,0.06)' : 'white',
                            color: isSelected ? 'var(--color-primary)' : 'var(--text-muted-current)',
                            fontSize: '0.68rem', fontWeight: isSelected ? '700' : '500',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            transition: 'all 0.15s'
                          }}
                        >
                          {isSelected && <Plus size={10} style={{ transform: 'rotate(45deg)' }} />}
                          {comment}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weft Comments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label className="input-label" style={{ fontWeight: '800', fontSize: '0.72rem', color: '#be123c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ⚠️ Weft Comments
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-current)', padding: '0.5rem', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                    {WEFT_COMMENTS_OPTIONS.map((comment) => {
                      const isSelected = selectedWeftComments.includes(comment);
                      return (
                        <button
                          key={comment}
                          type="button"
                          onClick={() => toggleWeftComment(comment)}
                          style={{
                            padding: '4px 10px', borderRadius: '15px', border: '1px solid',
                            borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-current)',
                            background: isSelected ? 'rgba(128,0,0,0.06)' : 'white',
                            color: isSelected ? 'var(--color-primary)' : 'var(--text-muted-current)',
                            fontSize: '0.68rem', fontWeight: isSelected ? '700' : '500',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            transition: 'all 0.15s'
                          }}
                        >
                          {isSelected && <Plus size={10} style={{ transform: 'rotate(45deg)' }} />}
                          {comment}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* Attended Fitter */}
            <div className="input-group" style={{ margin: 0, borderTop: '1px dashed var(--border-current)', paddingTop: '1rem' }}>
              <label className="input-label" style={{ fontWeight: '700', fontSize: '0.72rem' }}>Attended Fitter Name</label>
              <input
                type="text"
                placeholder="Enter fitter name"
                className="input-field"
                value={attendedFitter}
                onChange={e => setAttendedFitter(e.target.value)}
                style={{ fontSize: '0.825rem' }}
              />
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

      {/* Basic Keyframe Animations */}
      <style>{`
        @keyframes pulse {
          0% { transform: scaleX(0.75); opacity: 0.3; }
          50% { transform: scaleX(1); opacity: 0.8; }
          100% { transform: scaleX(0.75); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
