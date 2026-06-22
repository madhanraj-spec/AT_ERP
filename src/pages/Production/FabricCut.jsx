import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import QRCode from 'qrcode';
import { 
  QrCode, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Printer, 
  ArrowLeft, 
  Loader, 
  Plus, 
  X, 
  Scissors, 
  Layers, 
  Info,
  Calendar,
  Sparkles
} from 'lucide-react';

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

export default function FabricCut() {
  const [scanInput, setScanInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Loaded parent roll & associated weaving order
  const [parentRoll, setParentRoll] = useState(null);
  const [weavingOrder, setWeavingOrder] = useState(null);

  // Inspector workers list
  const [inspectors, setInspectors] = useState([]);

  // Cuts state
  const [numCuts, setNumCuts] = useState('');
  const [childRollsInput, setChildRollsInput] = useState([]); // Array: [{ id, qty, actual_qty, mistake, roll_ok, warp_comments, weft_comments, inspector_1, inspector_2, attended_fitter }]

  // View state: 'search' | 'details' | 'success'
  const [viewState, setViewState] = useState('search');
  const [savedChildRolls, setSavedChildRolls] = useState([]);

  const inputRef = useRef(null);

  useEffect(() => {
    fetchInspectors();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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

  const handleSearchRoll = async (rollIdToSearch) => {
    const targetId = (rollIdToSearch || '').trim();
    if (!targetId) return;

    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    setParentRoll(null);
    setWeavingOrder(null);
    setNumCuts('');
    setChildRollsInput([]);

    try {
      // Clean ID logic to be flexible. E.g. AT/2026/WVOF/00002/003
      // We search weaving orders that have the roll in their fabric_rolls jsonb array
      const parts = targetId.split('/');
      const potentialWeavingNumber = parts.slice(0, 5).join('/'); // matching the weaving number prefix if formatted normally

      let query = supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name)
        `);

      if (potentialWeavingNumber) {
        query = query.ilike('weaving_number', `%${potentialWeavingNumber}%`);
      }

      const { data, error: queryErr } = await query;
      if (queryErr) throw queryErr;

      let foundRoll = null;
      let foundOrder = null;

      for (const order of data || []) {
        const rolls = Array.isArray(order.fabric_rolls) ? order.fabric_rolls : [];
        const match = rolls.find(r => r.id.toLowerCase() === targetId.toLowerCase());
        if (match) {
          foundRoll = match;
          foundOrder = order;
          break;
        }
      }

      // If not found in the initial filtered query, query all weaving orders as a robust fallback
      if (!foundRoll) {
        const { data: allData, error: allQueryErr } = await supabase
          .from('weaving_orders')
          .select(`
            *,
            order:orders(id, order_number, design_no, design_name)
          `);
        
        if (!allQueryErr) {
          for (const order of allData || []) {
            const rolls = Array.isArray(order.fabric_rolls) ? order.fabric_rolls : [];
            const match = rolls.find(r => r.id.toLowerCase() === targetId.toLowerCase());
            if (match) {
              foundRoll = match;
              foundOrder = order;
              break;
            }
          }
        }
      }

      if (!foundRoll) {
        setError('Greige fabric roll ID not found in database.');
        setIsLoading(false);
        return;
      }

      // Check validation rule: parent greige roll MUST be 4 point inspected
      if (foundRoll.status !== '4_point_inspected') {
        setError(`Greige roll ${foundRoll.id} is not 4-point inspected. You must inspect the roll first before cutting.`);
        setIsLoading(false);
        return;
      }

      // Found roll is validated
      setParentRoll(foundRoll);
      setWeavingOrder(foundOrder);
      setViewState('details');
    } catch (err) {
      console.error('Error finding greige roll:', err);
      setError('System error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    handleSearchRoll(scanInput);
  };

  // Triggered when user enters/changes the number of cuts
  const handleCutsNumberChange = (e) => {
    const val = e.target.value;
    setNumCuts(val);

    const count = parseInt(val) || 0;
    if (count <= 0) {
      setChildRollsInput([]);
      return;
    }

    // Generate N child roll configs
    const configs = [];
    for (let i = 0; i < count; i++) {
      const idxStr = String(i + 1).padStart(2, '0');
      const childId = `${parentRoll.id}/${idxStr}`;
      configs.push({
        id: childId,
        qty: '',
        actual_qty: '',
        mistake: '0',
        roll_ok: true,
        warp_comments: [],
        weft_comments: [],
        inspector_1: parentRoll.inspector_1 || '',
        inspector_2: parentRoll.inspector_2 || '',
        attended_fitter: parentRoll.attended_fitter || ''
      });
    }
    setChildRollsInput(configs);
  };

  // Modify individual child roll inputs
  const updateChildRollField = (index, field, value) => {
    setChildRollsInput(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const toggleChildWarpComment = (index, comment) => {
    setChildRollsInput(prev => {
      const updated = [...prev];
      const roll = updated[index];
      const comments = roll.warp_comments.includes(comment)
        ? roll.warp_comments.filter(c => c !== comment)
        : [...roll.warp_comments, comment];
      updated[index] = { ...roll, warp_comments: comments };
      return updated;
    });
  };

  const toggleChildWeftComment = (index, comment) => {
    setChildRollsInput(prev => {
      const updated = [...prev];
      const roll = updated[index];
      const comments = roll.weft_comments.includes(comment)
        ? roll.weft_comments.filter(c => c !== comment)
        : [...roll.weft_comments, comment];
      updated[index] = { ...roll, weft_comments: comments };
      return updated;
    });
  };

  // Summarize quantities
  const parentGreigeQty = parentRoll ? parseFloat(parentRoll.qty || 0) : 0;
  const parentActualQty = parentRoll ? parseFloat(parentRoll.actual_qty || 0) : 0;
  const childGreigeQtySum = childRollsInput.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
  const childActualQtySum = childRollsInput.reduce((sum, r) => sum + parseFloat(r.actual_qty || 0), 0);
  const qtyMismatch = parseFloat((parentActualQty - childGreigeQtySum).toFixed(2));

  // Submit and replace rolls in database
  const handleSubmitCut = async (e) => {
    e.preventDefault();
    if (!parentRoll || !weavingOrder || childRollsInput.length === 0) return;

    // Basic Validations
    for (let i = 0; i < childRollsInput.length; i++) {
      const child = childRollsInput[i];
      const gQty = parseFloat(child.qty);
      const aQty = parseFloat(child.actual_qty);
      const mist = parseFloat(child.mistake || 0);

      if (isNaN(gQty) || gQty <= 0) {
        alert(`Roll ${child.id}: Please enter a valid greige quantity.`);
        return;
      }
      if (isNaN(aQty) || aQty <= 0) {
        alert(`Roll ${child.id}: Please enter a valid actual quantity.`);
        return;
      }
      if (mist < 0 || mist > aQty) {
        alert(`Roll ${child.id}: Mistakes quantity must be between 0 and actual quantity.`);
        return;
      }
      if (!child.inspector_1) {
        alert(`Roll ${child.id}: Please select Inspector 1.`);
        return;
      }
    }

    // Optional confirmation if sum doesn't match parent actual qty
    if (Math.abs(qtyMismatch) > 0.1) {
      const confirmSumMismatch = window.confirm(
        `Total child greige qty sum (${childGreigeQtySum} m) does not match parent actual qty (${parentActualQty} m). There is a mismatch of ${qtyMismatch} m. Do you still wish to submit?`
      );
      if (!confirmSumMismatch) return;
    }

    setIsLoading(true);
    try {
      const currentRolls = Array.isArray(weavingOrder.fabric_rolls) ? weavingOrder.fabric_rolls : [];

      // Build child roll db structures, inheriting parent details & adding entered qc details
      const newRollsToInsert = childRollsInput.map((child, idx) => {
        const gQty = parseFloat(child.qty);
        const aQty = parseFloat(child.actual_qty);
        const mist = parseFloat(child.mistake || 0);
        const shortage = parseFloat((gQty - aQty).toFixed(2));
        const approvedQty = parseFloat((aQty - mist).toFixed(2));

        return {
          ...parentRoll, // Transfer all metadata from parent greige roll
          id: child.id,
          roll_no: parentRoll.roll_no * 100 + (idx + 1), // Create unique sub roll sequential number
          qty: gQty,
          actual_qty: aQty,
          actual_length: aQty,
          shortage: shortage,
          mistake: mist,
          approved_qty: approvedQty,
          roll_ok: child.roll_ok,
          warp_comments: child.roll_ok ? [] : child.warp_comments,
          weft_comments: child.roll_ok ? [] : child.weft_comments,
          inspector_1: child.inspector_1,
          inspector_2: child.inspector_2,
          attended_fitter: child.attended_fitter,
          status: '4_point_inspected', // Mark as inspected since parent was inspected and child parameters are entered
          inspected_at: new Date().toISOString()
        };
      });

      // Filter out the parent roll and insert the new smaller rolls
      const updatedRolls = [];
      for (const r of currentRolls) {
        if (r.id.toLowerCase() === parentRoll.id.toLowerCase()) {
          updatedRolls.push(...newRollsToInsert);
        } else {
          updatedRolls.push(r);
        }
      }

      // Update in Supabase
      const { error: updateErr } = await supabase
        .from('weaving_orders')
        .update({ fabric_rolls: updatedRolls })
        .eq('id', weavingOrder.id);

      if (updateErr) throw updateErr;

      setSuccessMsg(`✅ Greige Roll ID ${parentRoll.id} split successfully into ${newRollsToInsert.length} rolls.`);
      setSavedChildRolls(newRollsToInsert);
      setViewState('success');
      
      // Auto-trigger printing child labels
      setTimeout(() => {
        handlePrintLabels(newRollsToInsert);
      }, 300);
    } catch (err) {
      console.error('Error splitting roll:', err);
      alert('Failed to split roll: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Print function
  const handlePrintLabels = async (rollsToPrint) => {
    // Open print window synchronously to bypass browser popup blocker
    const win = window.open('', '_blank');
    if (!win) {
      alert('Failed to print: Popup blocker is active. Please allow popups for this site.');
      return;
    }

    // Write loading text
    win.document.write('<html><body><div style="font-family:sans-serif;padding:20px;text-align:center;color:#666;">Generating QR Code labels, please wait...</div></body></html>');
    win.document.close();

    try {
      const rollsWithQr = await Promise.all(rollsToPrint.map(async (roll) => {
        return new Promise((resolve) => {
          QRCode.toDataURL(roll.id, { margin: 1, width: 120 }, (err, url) => {
            if (err) {
              console.error('QR generation error:', err);
              resolve({ ...roll, qrCodeUrl: '' });
            } else {
              resolve({ ...roll, qrCodeUrl: url });
            }
          });
        });
      }));

      // Clear the loading text and write actual labels HTML
      win.document.open();
      const labelsHtml = rollsWithQr.map(roll => `
        <div class="label-container">
          <div class="label-left">
            <div class="field-row">
              <span class="field-label">ROLL ID:</span>
              <span class="field-value roll-id">${roll.id}</span>
            </div>
            <div class="field-row">
              <span class="field-label">ORDER FORM:</span>
              <span class="field-value">${weavingOrder.weaving_number}</span>
            </div>
            <div class="field-row">
              <span class="field-label">ORDER NO:</span>
              <span class="field-value">${weavingOrder.order?.order_number || '—'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">DESIGN NO:</span>
              <span class="field-value">${weavingOrder.order?.design_no || weavingOrder.design_no || '—'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">DESIGN NAME:</span>
              <span class="field-value">${weavingOrder.order?.design_name || '—'}</span>
            </div>
            <div class="field-row" style="margin-top: 2px;">
              <span class="field-label" style="font-size: 8px;">QUANTITY:</span>
              <span class="field-value qty-val">${roll.qty} Mtrs</span>
            </div>
          </div>
          <div class="label-right">
            ${roll.qrCodeUrl ? `<img class="qr-code" src="${roll.qrCodeUrl}" alt="QR" />` : '<div class="qr-placeholder">No QR</div>'}
            <div class="roll-number">Roll #${String(roll.roll_no).slice(-2)}</div>
          </div>
        </div>
      `).join('');

      win.document.write(`
        <html>
          <head>
            <title>Split Greige Roll Labels - ${weavingOrder.weaving_number}</title>
            <style>
              @page {
                size: 9cm 5cm;
                margin: 0;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                background: white;
                color: #000;
                width: 9cm;
                height: 5cm;
              }
              .label-container {
                width: 9cm;
                height: 5cm;
                padding: 0.3cm;
                display: flex;
                border: 1px dashed #ccc;
                page-break-after: always;
                position: relative;
                overflow: hidden;
              }
              @media print {
                .label-container {
                  border: none;
                }
              }
              .label-left {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding-right: 0.2cm;
              }
              .label-right {
                width: 2.8cm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-left: 1px dashed #ddd;
                padding-left: 0.15cm;
              }
              .field-row {
                display: flex;
                align-items: baseline;
                margin-bottom: 1px;
                line-height: 1.1;
              }
              .field-label {
                font-size: 6.5px;
                font-weight: 800;
                color: #555;
                width: 1.8cm;
                flex-shrink: 0;
                letter-spacing: 0.02em;
              }
              .field-value {
                font-size: 8px;
                font-weight: 700;
                color: #000;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .field-value.roll-id {
                font-family: monospace;
                font-size: 8.5px;
                font-weight: 900;
              }
              .field-value.qty-val {
                font-size: 12px;
                font-weight: 900;
                color: #000;
              }
              .qr-code {
                width: 2.2cm;
                height: 2.2cm;
                object-fit: contain;
              }
              .qr-placeholder {
                width: 2.2cm;
                height: 2.2cm;
                border: 1px solid #ccc;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 8px;
              }
              .roll-number {
                font-size: 8px;
                font-weight: 800;
                margin-top: 4px;
                background: #000;
                color: #fff;
                padding: 1px 6px;
                border-radius: 3px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
            <script>
              window.onload = function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      win.document.close();
    } catch (printErr) {
      console.error('Error opening print window:', printErr);
      alert('Failed to print labels: ' + printErr.message);
    }
  };

  const handleReset = () => {
    setViewState('search');
    setParentRoll(null);
    setWeavingOrder(null);
    setScanInput('');
    setNumCuts('');
    setChildRollsInput([]);
    setSavedChildRolls([]);
    setSuccessMsg('');
    setError('');
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem', paddingBottom: '3rem', fontFamily: 'var(--font-sans)' }}>
      {/* Mobile Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem' }}>
        <div style={{ background: 'var(--color-primary)', color: 'white', padding: '0.45rem', borderRadius: '8px' }}>
          <Scissors size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--color-primary)', lineHeight: 1.1 }}>Fabric Cut Management</h1>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Split greige rolls & print labels
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

      {/* VIEW STATE 1: SEARCH BAR */}
      {viewState === 'search' && (
        <div style={{ 
          backgroundColor: 'white', border: '1px solid var(--border-current)', 
          borderRadius: '12px', padding: '1.5rem', boxShadow: 'var(--shadow-md)',
          display: 'flex', flexDirection: 'column', gap: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🔍 Enter Greige Roll ID to Cut
            </span>
          </div>

          <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Type or Scan Greige Roll ID (e.g. AT/2026/WVOF/00002/003)..."
                className="input-field"
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                style={{
                  width: '100%', paddingLeft: '2.5rem', paddingRight: '0.75rem',
                  fontSize: '0.9rem', height: '44px', fontWeight: '600'
                }}
              />
              <QrCode size={16} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.85rem', top: '14px' }} />
            </div>
            <button
              type="submit"
              disabled={isLoading || !scanInput.trim()}
              className="btn btn-primary"
              style={{ height: '44px', padding: '0 1.25rem', borderRadius: '8px', cursor: 'pointer' }}
            >
              {isLoading ? <Loader size={18} className="spin" /> : <Search size={18} />}
            </button>
          </form>

          <div style={{
            marginTop: '0.5rem', display: 'flex', gap: '0.5rem', 
            backgroundColor: 'rgba(128, 0, 0, 0.03)', border: '1px solid rgba(128,0,0,0.08)',
            padding: '0.75rem', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--text-muted-current)'
          }}>
            <Info size={14} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>Note: Only 4-Point inspected rolls are allowed to be cut. The system will look up the roll, verify its inspection status, delete the parent roll, and replace it with smaller cuts.</span>
          </div>
        </div>
      )}

      {/* VIEW STATE 2: CUT FORM */}
      {viewState === 'details' && parentRoll && weavingOrder && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.25s ease-out' }}>
          
          {/* Back button */}
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem', border: 'none',
              background: 'none', color: 'var(--text-muted-current)', fontSize: '0.75rem',
              fontWeight: '700', padding: 0, width: 'max-content', cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} /> Back to Search
          </button>

          {/* Parent Info Banner */}
          <div style={{
            background: 'linear-gradient(135deg, #800000, #4d0000)',
            color: 'white', borderRadius: '12px', padding: '1.25rem',
            boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: '0.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} />
                <strong style={{ fontSize: '0.95rem', fontFamily: 'monospace' }}>Parent ID: {parentRoll.id}</strong>
              </div>
              <span className="badge badge-success" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                ✓ 4-Point Inspected
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', fontSize: '0.78rem', opacity: 0.9, marginBottom: '0.5rem' }}>
              <div>
                <span style={{ display: 'block', opacity: 0.7, fontSize: '0.68rem', fontWeight: '600' }}>WEAVING ORDER</span>
                <strong>{weavingOrder.weaving_number}</strong>
              </div>
              <div>
                <span style={{ display: 'block', opacity: 0.7, fontSize: '0.68rem', fontWeight: '600' }}>ORDER NUMBER</span>
                <strong>{weavingOrder.order?.order_number || '—'}</strong>
              </div>
              <div>
                <span style={{ display: 'block', opacity: 0.7, fontSize: '0.68rem', fontWeight: '600' }}>DESIGN</span>
                <strong>{weavingOrder.order?.design_no || weavingOrder.design_no} / {weavingOrder.order?.design_name || '—'}</strong>
              </div>
              <div>
                <span style={{ display: 'block', opacity: 0.7, fontSize: '0.68rem', fontWeight: '600' }}>GREIGE QUANTITY</span>
                <strong style={{ fontSize: '0.9rem', color: '#34d399' }}>{parentGreigeQty} Meters</strong>
              </div>
              <div>
                <span style={{ display: 'block', opacity: 0.7, fontSize: '0.68rem', fontWeight: '600' }}>ACTUAL INSPECTED</span>
                <strong style={{ fontSize: '0.9rem', color: '#60a5fa' }}>{parentActualQty} Meters</strong>
              </div>
            </div>

            {/* Parent QC details sub-section */}
            <div style={{
              marginTop: '0.25rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              border: '1px dashed rgba(255, 255, 255, 0.25)',
              fontSize: '0.75rem'
            }}>
              <span style={{ display: 'block', fontWeight: '800', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', paddingBottom: '0.25rem', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                🔍 PARENT 4-POINT INSPECTION DETAILS
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.4rem 1rem' }}>
                <span>Shortage: <strong>{parentRoll.shortage ?? '0'} m</strong></span>
                <span>Mistakes Qty: <strong style={{ color: '#fca5a5' }}>{parentRoll.mistake ?? '0'} m</strong></span>
                <span>Approved Ok Qty: <strong>{parentRoll.approved_qty ?? '0'} m</strong></span>
                <span>Attended Fitter: <strong>{parentRoll.attended_fitter || '—'}</strong></span>
                <span>Inspectors: <strong>{parentRoll.inspector_1 || '—'}{parentRoll.inspector_2 ? ` & ${parentRoll.inspector_2}` : ''}</strong></span>
                <span>Status: <strong style={{ color: parentRoll.roll_ok ? '#a7f3d0' : '#fca5a5' }}>{parentRoll.roll_ok ? '🟢 OK' : '🔴 Defects Observed'}</strong></span>
                {parentRoll.inspected_at && (
                  <span style={{ gridColumn: 'span 2' }}>Inspected At: <strong>{new Date(parentRoll.inspected_at).toLocaleString('en-IN')}</strong></span>
                )}
                {!parentRoll.roll_ok && parentRoll.warp_comments?.length > 0 && (
                  <span style={{ gridColumn: 'span 2', color: '#fca5a5' }}>Warp Comments: <strong>{parentRoll.warp_comments.join(', ')}</strong></span>
                )}
                {!parentRoll.roll_ok && parentRoll.weft_comments?.length > 0 && (
                  <span style={{ gridColumn: 'span 2', color: '#fca5a5' }}>Weft Comments: <strong>{parentRoll.weft_comments.join(', ')}</strong></span>
                )}
              </div>
            </div>
          </div>

          {/* Cuts Configuration Card */}
          <div style={{
            backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '12px',
            padding: '1.25rem', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '0.5rem'
          }}>
            <div className="input-group" style={{ margin: 0 }}>
              <label className="input-label" style={{ fontWeight: '800', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                ✂️ Number of Cuts for this roll:
              </label>
              <input
                type="number"
                min="1"
                placeholder="Enter number of pieces (e.g. 3)"
                className="input-field"
                value={numCuts}
                onChange={handleCutsNumberChange}
                style={{ maxWidth: '200px', fontWeight: '700', fontSize: '0.95rem' }}
              />
            </div>
          </div>

          {/* Render individual child inputs */}
          {childRollsInput.length > 0 && (
            <form onSubmit={handleSubmitCut} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {childRollsInput.map((child, idx) => (
                  <div key={idx} style={{
                    backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '12px',
                    padding: '1.25rem', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: '1.25rem',
                    position: 'relative'
                  }}>
                    {/* Header for Child Cut */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{
                          backgroundColor: 'rgba(128,0,0,0.06)', color: 'var(--color-primary)', 
                          fontSize: '0.65rem', fontWeight: '900', padding: '2px 8px', borderRadius: '4px'
                        }}>
                          CUT #{idx + 1}
                        </span>
                        <strong style={{ fontSize: '0.825rem', fontFamily: 'monospace', color: 'var(--text-current)' }}>{child.id}</strong>
                      </span>
                    </div>

                    {/* Roll parameters grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '0.75rem'
                    }}>
                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontWeight: '700', fontSize: '0.7rem' }}>Greige Qty (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="input-field"
                          placeholder="Greige meters"
                          value={child.qty}
                          onChange={e => updateChildRollField(idx, 'qty', e.target.value)}
                          style={{ fontWeight: '700' }}
                        />
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontWeight: '700', fontSize: '0.7rem' }}>Actual Length (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          className="input-field"
                          placeholder="Actual meters"
                          value={child.actual_qty}
                          onChange={e => updateChildRollField(idx, 'actual_qty', e.target.value)}
                          style={{ fontWeight: '700' }}
                        />
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontWeight: '700', fontSize: '0.7rem' }}>Shortage (m)</label>
                        <div className="calculation-display" style={{
                          color: (parseFloat(child.qty || 0) - parseFloat(child.actual_qty || 0)) > 0 ? '#b45309' : '#047857',
                          fontSize: '0.8rem'
                        }}>
                          {(parseFloat(child.qty || 0) - parseFloat(child.actual_qty || 0)).toFixed(2)} m
                        </div>
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontWeight: '700', fontSize: '0.7rem' }}>Mistakes Qty (m)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          placeholder="Defects in m"
                          value={child.mistake}
                          onChange={e => updateChildRollField(idx, 'mistake', e.target.value)}
                          style={{ fontWeight: '700', color: '#be123c' }}
                        />
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontWeight: '700', fontSize: '0.7rem' }}>Ok Qty (m)</label>
                        <div className="calculation-display" style={{
                          backgroundColor: 'rgba(16,185,129,0.05)', borderColor: '#10b981',
                          fontWeight: '800', color: '#047857', fontSize: '0.8rem'
                        }}>
                          {(parseFloat(child.actual_qty || 0) - parseFloat(child.mistake || 0)).toFixed(2)} m
                        </div>
                      </div>
                    </div>

                    {/* Inspectors selection & Fitter row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '0.75rem',
                      borderTop: '1px dashed var(--border-current)',
                      paddingTop: '0.75rem'
                    }}>
                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontWeight: '700', fontSize: '0.7rem' }}>Inspector 1</label>
                        <select
                          className="input-field"
                          required
                          value={child.inspector_1}
                          onChange={e => updateChildRollField(idx, 'inspector_1', e.target.value)}
                          style={{ fontWeight: '600' }}
                        >
                          <option value="">Select Inspector</option>
                          {inspectors.map((w) => (
                            <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontWeight: '700', fontSize: '0.7rem' }}>Inspector 2</label>
                        <select
                          className="input-field"
                          value={child.inspector_2}
                          onChange={e => updateChildRollField(idx, 'inspector_2', e.target.value)}
                          style={{ fontWeight: '600' }}
                        >
                          <option value="">Select Inspector</option>
                          {inspectors.map((w) => (
                            <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="input-group" style={{ margin: 0 }}>
                        <label className="input-label" style={{ fontWeight: '700', fontSize: '0.7rem' }}>Attended Fitter</label>
                        <input
                          type="text"
                          placeholder="Fitter details"
                          className="input-field"
                          value={child.attended_fitter}
                          onChange={e => updateChildRollField(idx, 'attended_fitter', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Roll OK / Fail Switch */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: '#f8fafc', padding: '0.6rem 0.85rem', borderRadius: '8px',
                      border: '1px solid var(--border-current)', marginTop: '0.25rem'
                    }}>
                      <div>
                        <strong style={{ fontSize: '0.78rem', color: 'var(--text-current)', display: 'block' }}>Roll OK Status</strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>Uncheck to flag defects observed and add comments</span>
                      </div>
                      <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '42px', height: '22px' }}>
                        <input
                          type="checkbox"
                          checked={child.roll_ok}
                          onChange={e => updateChildRollField(idx, 'roll_ok', e.target.checked)}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: child.roll_ok ? 'var(--color-primary)' : '#cbd5e1',
                          transition: '0.2s', borderRadius: '22px',
                          display: 'flex', alignItems: 'center', padding: '2px'
                        }}>
                          <span style={{
                            height: '18px', width: '18px', borderRadius: '50%', backgroundColor: 'white',
                            transition: '0.2s', transform: child.roll_ok ? 'translateX(20px)' : 'translateX(0px)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }} />
                        </span>
                      </label>
                    </div>

                    {/* Comments section if Roll is Fail */}
                    {!child.roll_ok && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', borderTop: '1px dashed var(--border-current)', paddingTop: '0.85rem', animation: 'fadeIn 0.15s ease-out' }}>
                        
                        {/* Warp Comments */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#be123c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            ⚠️ Warp Defect Comments
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxHeight: '110px', overflowY: 'auto', border: '1px solid var(--border-current)', padding: '0.4rem', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                            {WARP_COMMENTS_OPTIONS.map((comment) => {
                              const isSelected = child.warp_comments.includes(comment);
                              return (
                                <button
                                  key={comment}
                                  type="button"
                                  onClick={() => toggleChildWarpComment(idx, comment)}
                                  style={{
                                    padding: '3px 8px', borderRadius: '12px', border: '1px solid',
                                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-current)',
                                    background: isSelected ? 'rgba(128,0,0,0.06)' : 'white',
                                    color: isSelected ? 'var(--color-primary)' : 'var(--text-muted-current)',
                                    fontSize: '0.625rem', fontWeight: isSelected ? '700' : '500',
                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                    transition: 'all 0.1s'
                                  }}
                                >
                                  {isSelected && <Plus size={8} style={{ transform: 'rotate(45deg)' }} />}
                                  {comment}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Weft Comments */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#be123c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            ⚠️ Weft Defect Comments
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxHeight: '110px', overflowY: 'auto', border: '1px solid var(--border-current)', padding: '0.4rem', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                            {WEFT_COMMENTS_OPTIONS.map((comment) => {
                              const isSelected = child.weft_comments.includes(comment);
                              return (
                                <button
                                  key={comment}
                                  type="button"
                                  onClick={() => toggleChildWeftComment(idx, comment)}
                                  style={{
                                    padding: '3px 8px', borderRadius: '12px', border: '1px solid',
                                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-current)',
                                    background: isSelected ? 'rgba(128,0,0,0.06)' : 'white',
                                    color: isSelected ? 'var(--color-primary)' : 'var(--text-muted-current)',
                                    fontSize: '0.625rem', fontWeight: isSelected ? '700' : '500',
                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                    transition: 'all 0.1s'
                                  }}
                                >
                                  {isSelected && <Plus size={8} style={{ transform: 'rotate(45deg)' }} />}
                                  {comment}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom Sticky Summary Bar */}
              <div style={{
                backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '12px',
                padding: '1.25rem', boxShadow: '0 -4px 20px rgba(0,0,0,0.05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
                position: 'sticky', bottom: '1rem', zIndex: 10
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '700', textTransform: 'uppercase' }}>
                    Split Balance Verification
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <span>Parent Actual Qty: <strong>{parentActualQty} m</strong></span>
                    <span>Cuts Sum: <strong style={{ color: Math.abs(qtyMismatch) <= 0.1 ? '#047857' : '#b45309' }}>{childGreigeQtySum.toFixed(2)} m</strong></span>
                    {Math.abs(qtyMismatch) > 0.01 && (
                      <span style={{ 
                        fontSize: '0.72rem', fontWeight: '800', 
                        color: qtyMismatch > 0 ? '#b45309' : '#be123c',
                        backgroundColor: qtyMismatch > 0 ? '#fef3c7' : '#fef2f2',
                        padding: '1px 8px', borderRadius: '4px' 
                      }}>
                        {qtyMismatch > 0 ? `Waste: ${qtyMismatch} m` : `Excess: ${Math.abs(qtyMismatch)} m`}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary"
                  style={{
                    padding: '0.75rem 2rem', fontWeight: '800', fontSize: '0.9rem',
                    boxShadow: 'var(--shadow-primary)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}
                >
                  {isLoading ? <Loader size={18} className="spin" /> : 'Validate & Save Splits'}
                </button>
              </div>
            </form>
          )}

        </div>
      )}

      {/* VIEW STATE 3: SUCCESS & PRINT VIEW */}
      {viewState === 'success' && savedChildRolls.length > 0 && (
        <div style={{
          backgroundColor: 'white', border: '1px solid var(--border-current)', 
          borderRadius: '16px', padding: '2rem', boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem',
          textAlign: 'center', animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            backgroundColor: '#ecfdf5', color: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #34d399'
          }}>
            <CheckCircle size={36} />
          </div>

          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-current)' }}>
              Greige Roll Cut Successful!
            </h2>
            <p style={{ color: 'var(--text-muted-current)', fontSize: '0.85rem', marginTop: '0.4rem', maxWidth: '420px' }}>
              The parent roll ID has been deleted and replaced with {savedChildRolls.length} smaller greige rolls.
            </p>
          </div>

          <div style={{ width: '100%', border: '1px solid var(--border-current)', borderRadius: '12px', padding: '1rem', backgroundColor: '#fafafa' }}>
            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
              Registered Split Rolls
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {savedChildRolls.map((roll, rIdx) => (
                <div key={roll.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '0.825rem', fontFamily: 'monospace' }}>{roll.id}</strong>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>Greige: {roll.qty} m | Actual: {roll.actual_qty} m</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePrintLabels([roll])}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem',
                      padding: '4px 10px', borderRadius: '6px', border: '1px solid #800000',
                      background: 'rgba(128,0,0,0.04)', color: '#800000', fontSize: '0.72rem',
                      fontWeight: '800', cursor: 'pointer'
                    }}
                  >
                    <Printer size={12} /> Print Label
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
            <button
              onClick={() => handlePrintLabels(savedChildRolls)}
              className="btn btn-primary"
              style={{
                flex: 1, padding: '0.75rem', fontWeight: '800',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                boxShadow: 'var(--shadow-primary)', cursor: 'pointer'
              }}
            >
              <Printer size={18} /> Print All Labels (9x5 cm)
            </button>

            <button
              onClick={handleReset}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
            >
              Cut Another Roll
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
