import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  FileText,
  Filter,
  ChevronDown,
  ChevronUp,
  Edit3,
  Check,
  X,
  Loader,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Minus,
  Printer
} from 'lucide-react';


// ─── Constants ────────────────────────────────────────────────────────────────
const WARP_COMMENTS_OPTIONS = [
  'MISSED ENDS','TEMPER YARN CUT','REED DRAWING MISTAKE','DOUBLE ENDS',
  'END DRAWING MISTAKE','REED GAP','THICK REED','THICK ENDS','SHRINKED ENDS',
  'DOBBY MISTAKE','REED MISTAKE','WRONG COLOURED ENDS','CONTINUE FLOATS'
];

const WEFT_COMMENTS_OPTIONS = [
  'TWILL SIDE MISTAKE','DOUBLE PICK','WEFT DESIGN MISTAKE','THICK PLACE',
  'GAP PLACE','SHRINKED YARN','SHORT PICK','MORE PICK','LESS PICK',
  'COLOUR STREAKS','HOLES','THIRAI','COLOUR PATTAI','EXTRA YARN',
  'LESS SHRINK','FACE SIDE MISTAKE'
];

// ─── Helper: Multi-Select Dropdown ───────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = React.useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [open]);

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  };

  const filteredOptions = options.filter(opt =>
    String(opt).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', minWidth: '160px' }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.4rem', padding: '0.45rem 0.75rem', border: '1.5px solid var(--border-current)',
          borderRadius: '8px', background: 'white', cursor: 'pointer',
          fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-current)',
          transition: 'border-color 0.15s'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
          {selected.length === 0 ? (
            <span style={{ color: 'var(--text-muted-current)', fontWeight: '400' }}>{placeholder || label}</span>
          ) : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 200, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', border: '1.5px solid var(--border-current)', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '250px', overflowY: 'auto',
          minWidth: '200px', display: 'flex', flexDirection: 'column'
        }}>
          {/* Search Input */}
          <div style={{ padding: '0.4rem', borderBottom: '1px solid var(--border-current)', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 5 }}>
            <input
              type="text"
              placeholder={`Search ${label}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.75rem',
                border: '1px solid var(--border-current)', borderRadius: '6px',
                outline: 'none', background: 'white', boxSizing: 'border-box'
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          
          {selected.length > 0 && (
            <button
              onClick={() => { onChange([]); setSearch(''); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.4rem 0.75rem', border: 'none', borderBottom: '1px solid var(--border-current)',
                background: '#fef2f2', color: '#b91c1c', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer'
              }}
            >
              ✕ Clear All
            </button>
          )}

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.map(opt => (
              <label
                key={opt}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.45rem 0.75rem', cursor: 'pointer', fontSize: '0.78rem',
                  background: selected.includes(opt) ? 'rgba(128,0,0,0.04)' : 'white',
                  fontWeight: selected.includes(opt) ? '700' : '400',
                  borderBottom: '1px solid rgba(0,0,0,0.04)'
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span style={{ flex: 1 }}>{opt}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <div style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted-current)', fontSize: '0.78rem' }}>
                No matches found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ roll, weavingOrder, inspectors, onClose, onSave }) {
  const [form, setForm] = useState({
    actual_qty: roll.actual_qty ?? roll.qty ?? '',
    mistake: roll.mistake ?? 0,
    inspector_1: roll.inspector_1 ?? '',
    inspector_2: roll.inspector_2 ?? '',
    roll_ok: roll.roll_ok !== false,
    attended_fitter: roll.attended_fitter ?? '',
    warp_comments: roll.warp_comments ?? [],
    weft_comments: roll.weft_comments ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const actualQty = parseFloat(form.actual_qty || 0);
  const mistakeQty = parseFloat(form.mistake || 0);
  const greigeQty = parseFloat(roll.qty || 0);
  const shortage = parseFloat((greigeQty - actualQty).toFixed(2));
  const okQty = parseFloat((actualQty - mistakeQty).toFixed(2));

  const handleSave = async () => {
    if (actualQty <= 0) { setErr('Actual qty must be > 0.'); return; }
    if (mistakeQty < 0 || mistakeQty > actualQty) { setErr('Mistake qty must be between 0 and actual qty.'); return; }
    if (!form.inspector_1) { setErr('Inspector 1 is required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const currentRolls = Array.isArray(weavingOrder.fabric_rolls) ? weavingOrder.fabric_rolls : [];
      const updatedRolls = currentRolls.map(r => {
        if (r.id.toLowerCase() === roll.id.toLowerCase()) {
          return {
            ...r,
            actual_qty: actualQty,
            actual_length: actualQty,
            shortage,
            mistake: mistakeQty,
            approved_qty: okQty,
            inspector_1: form.inspector_1,
            inspector_2: form.inspector_2,
            roll_ok: form.roll_ok,
            warp_comments: form.roll_ok ? [] : form.warp_comments,
            weft_comments: form.roll_ok ? [] : form.weft_comments,
            attended_fitter: form.attended_fitter,
          };
        }
        return r;
      });

      const { error: updateErr } = await supabase
        .from('weaving_orders')
        .update({ fabric_rolls: updatedRolls })
        .eq('id', weavingOrder.id);

      if (updateErr) throw updateErr;

      onSave();
    } catch (e) {
      setErr('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleComment = (type, comment) => {
    const key = type === 'warp' ? 'warp_comments' : 'weft_comments';
    setForm(f => ({
      ...f,
      [key]: f[key].includes(comment) ? f[key].filter(c => c !== comment) : [...f[key], comment]
    }));
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)',
          position: 'sticky', top: 0, background: 'white', zIndex: 2
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: 'var(--color-primary)' }}>
              Edit Inspection: {roll.id}
            </h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>
              Changes will reflect everywhere in the system
            </span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted-current)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {err && (
            <div style={{ background: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
              <AlertTriangle size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />{err}
            </div>
          )}

          {/* Read-only roll info */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.85rem', border: '1px solid var(--border-current)', fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <div>
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase' }}>Order No</div>
              <strong>{weavingOrder.order?.order_number || '—'}</strong>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase' }}>WVOF</div>
              <strong>{weavingOrder.weaving_number || '—'}</strong>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase' }}>Design</div>
              <strong>{weavingOrder.order?.design_no || weavingOrder.design_no} / {weavingOrder.order?.design_name || '—'}</strong>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase' }}>Greige Qty</div>
              <strong>{roll.qty} m</strong>
            </div>
          </div>

          {/* Qty fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem' }}>Actual Qty (m)</label>
              <input type="number" step="0.01" className="input-field" value={form.actual_qty}
                onChange={e => setForm(f => ({ ...f, actual_qty: e.target.value }))} style={{ fontWeight: '700' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem' }}>Mistake Qty (m)</label>
              <input type="number" step="0.01" className="input-field" value={form.mistake}
                onChange={e => setForm(f => ({ ...f, mistake: e.target.value }))} style={{ color: '#be123c', fontWeight: '700' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem', color: '#b45309' }}>Shortage (m)</label>
              <div style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #fcd34d', borderRadius: '8px', background: '#fffbeb', fontWeight: '800', color: '#b45309' }}>
                {shortage} m
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem', color: '#047857' }}>OK Qty (m)</label>
              <div style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #10b981', borderRadius: '8px', background: '#ecfdf5', fontWeight: '800', color: '#047857' }}>
                {okQty} m
              </div>
            </div>
          </div>

          {/* Inspectors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem' }}>Inspector 1 *</label>
              <select className="input-field" value={form.inspector_1} onChange={e => setForm(f => ({ ...f, inspector_1: e.target.value }))}>
                <option value="">Select Inspector 1</option>
                {inspectors.map(w => <option key={w.id} value={w.worker_name}>{w.worker_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem' }}>Inspector 2</label>
              <select className="input-field" value={form.inspector_2} onChange={e => setForm(f => ({ ...f, inspector_2: e.target.value }))}>
                <option value="">Select Inspector 2</option>
                {inspectors.map(w => <option key={w.id} value={w.worker_name}>{w.worker_name}</option>)}
              </select>
            </div>
          </div>

          {/* Roll OK toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-current)', background: '#f8fafc' }}>
            <div>
              <strong style={{ fontSize: '0.8rem' }}>Roll OK</strong>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)' }}>No defects observed in this fabric roll</div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
              <input type="checkbox" checked={form.roll_ok} onChange={e => setForm(f => ({ ...f, roll_ok: e.target.checked }))} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: 'absolute', cursor: 'pointer', inset: 0,
                backgroundColor: form.roll_ok ? 'var(--color-primary)' : '#cbd5e1',
                transition: '0.2s', borderRadius: '24px', display: 'flex', alignItems: 'center', padding: '2px'
              }}>
                <span style={{ height: '20px', width: '20px', borderRadius: '50%', backgroundColor: 'white', transition: '0.2s', transform: form.roll_ok ? 'translateX(22px)' : 'translateX(0px)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </span>
            </label>
          </div>

          {/* Comments (only if not OK) */}
          {!form.roll_ok && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px dashed var(--border-current)', paddingTop: '1rem' }}>
              {[{ type: 'warp', opts: WARP_COMMENTS_OPTIONS, key: 'warp_comments', label: '⚠️ Warp Comments' }, { type: 'weft', opts: WEFT_COMMENTS_OPTIONS, key: 'weft_comments', label: '⚠️ Weft Comments' }].map(({ type, opts, key, label }) => (
                <div key={type}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: '#be123c', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>{label}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-current)', padding: '0.5rem', borderRadius: '8px', background: '#fafafa' }}>
                    {opts.map(c => {
                      const sel = form[key].includes(c);
                      return (
                        <button key={c} type="button" onClick={() => toggleComment(type, c)} style={{
                          padding: '4px 10px', borderRadius: '15px', border: '1px solid',
                          borderColor: sel ? 'var(--color-primary)' : 'var(--border-current)',
                          background: sel ? 'rgba(128,0,0,0.06)' : 'white',
                          color: sel ? 'var(--color-primary)' : 'var(--text-muted-current)',
                          fontSize: '0.68rem', fontWeight: sel ? '700' : '500', cursor: 'pointer', transition: 'all 0.15s'
                        }}>
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Attended Fitter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem' }}>Attended Fitter Name</label>
            <input type="text" className="input-field" placeholder="Enter fitter name" value={form.attended_fitter}
              onChange={e => setForm(f => ({ ...f, attended_fitter: e.target.value }))} />
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          display: 'flex', gap: '0.75rem', padding: '1.25rem 1.5rem',
          borderTop: '1px solid var(--border-current)', position: 'sticky', bottom: 0, background: 'white', zIndex: 2
        }}>
          <button onClick={onClose} disabled={saving} style={{ flex: 1, padding: '0.65rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', background: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', color: 'var(--text-muted-current)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: '0.65rem', border: 'none', borderRadius: '8px',
            background: 'var(--color-primary)', color: 'white', fontSize: '0.85rem', fontWeight: '800',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
          }}>
            {saving ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 4 Point Report Tab ───────────────────────────────────────────────────────
function FourPointReportTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inspectors, setInspectors] = useState([]);
  const [editTarget, setEditTarget] = useState(null); // { roll, weavingOrder }
  const [successMsg, setSuccessMsg] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    rollIds: [],
    orderNumbers: [],
    wvofs: [],
    designNames: [],
    designNos: [],
    inspector1s: [],
    inspector2s: [],
    fitters: [],
    rollOk: [], // 'Yes', 'No'
    partners: [],
    looms: [],
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  // Load data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('weaving_orders')
        .select('*, order:orders(id, order_number, design_no, design_name)')
        .order('created_at', { ascending: false });
      if (err) throw err;

      const inspectedRolls = [];
      for (const order of data || []) {
        const rolls = Array.isArray(order.fabric_rolls) ? order.fabric_rolls : [];
        for (const roll of rolls) {
          if (roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing') {
            inspectedRolls.push({ roll, weavingOrder: order });
          }
        }
      }
      setRows(inspectedRolls);
    } catch (e) {
      setError('Failed to load data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInspectors = useCallback(async () => {
    try {
      const { data: deptData } = await supabase.from('master_departments').select('id').ilike('department_name', '%inspection%');
      const ids = (deptData || []).map(d => d.id);
      const { data: workers } = ids.length > 0
        ? await supabase.from('master_workers').select('*').in('department_id', ids).order('worker_name')
        : await supabase.from('master_workers').select('*').order('worker_name');
      setInspectors(workers || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchData(); fetchInspectors(); }, [fetchData, fetchInspectors]);

  // Derive unique filter options from all rows (not yet filtered, for global options)
  const allOptions = useMemo(() => {
    const set = (fn) => [...new Set(rows.map(fn).filter(Boolean))].sort();
    return {
      rollIds: set(r => r.roll.id),
      orderNumbers: set(r => r.weavingOrder.order?.order_number),
      wvofs: set(r => r.weavingOrder.weaving_number),
      designNames: set(r => r.weavingOrder.order?.design_name || r.weavingOrder.design_name),
      designNos: set(r => r.weavingOrder.order?.design_no || r.weavingOrder.design_no),
      inspector1s: set(r => r.roll.inspector_1),
      inspector2s: set(r => r.roll.inspector_2),
      fitters: set(r => r.roll.attended_fitter),
      rollOk: ['Yes', 'No'],
      partners: set(r => r.weavingOrder.partner_name || (r.weavingOrder.weaving_type === 'in_house' ? 'In-House Loom Shed' : null)),
      looms: set(r => r.weavingOrder.machine_name),
    };
  }, [rows]);

  // Derive dependent (filtered-context) options based on current non-self filters
  const dependentOptions = useMemo(() => {
    const applyExcept = (excludeKey) => {
      return rows.filter(({ roll, weavingOrder }) => {
        const r = roll; const w = weavingOrder;
        const orderNo = w.order?.order_number;
        const designName = w.order?.design_name || w.design_name;
        const designNo = w.order?.design_no || w.design_no;
        const inspectedAt = r.inspected_at ? new Date(r.inspected_at) : null;
        const searchTerm = filters.search.toLowerCase();
        const partnerVal = w.partner_name || (w.weaving_type === 'in_house' ? 'In-House Loom Shed' : '');
        const loomVal = w.machine_name || '';

        return (
          (excludeKey === 'rollIds' || filters.rollIds.length === 0 || filters.rollIds.includes(r.id)) &&
          (excludeKey === 'orderNumbers' || filters.orderNumbers.length === 0 || filters.orderNumbers.includes(orderNo)) &&
          (excludeKey === 'wvofs' || filters.wvofs.length === 0 || filters.wvofs.includes(w.weaving_number)) &&
          (excludeKey === 'designNames' || filters.designNames.length === 0 || filters.designNames.includes(designName)) &&
          (excludeKey === 'designNos' || filters.designNos.length === 0 || filters.designNos.includes(designNo)) &&
          (excludeKey === 'inspector1s' || filters.inspector1s.length === 0 || filters.inspector1s.includes(r.inspector_1)) &&
          (excludeKey === 'inspector2s' || filters.inspector2s.length === 0 || filters.inspector2s.includes(r.inspector_2)) &&
          (excludeKey === 'fitters' || filters.fitters.length === 0 || filters.fitters.includes(r.attended_fitter)) &&
          (excludeKey === 'rollOk' || filters.rollOk.length === 0 || filters.rollOk.includes(r.roll_ok !== false ? 'Yes' : 'No')) &&
          (excludeKey === 'partners' || filters.partners.length === 0 || filters.partners.includes(partnerVal)) &&
          (excludeKey === 'looms' || filters.looms.length === 0 || filters.looms.includes(loomVal)) &&
          (!filters.dateFrom || !inspectedAt || inspectedAt >= new Date(filters.dateFrom)) &&
          (!filters.dateTo || !inspectedAt || inspectedAt <= new Date(filters.dateTo + 'T23:59:59')) &&
          (!searchTerm || r.id?.toLowerCase().includes(searchTerm) || orderNo?.toLowerCase().includes(searchTerm) || designName?.toLowerCase().includes(searchTerm))
        );
      });
    };

    const set = (subset, fn) => [...new Set(subset.map(fn).filter(Boolean))].sort();

    return {
      rollIds: set(applyExcept('rollIds'), r => r.roll.id),
      orderNumbers: set(applyExcept('orderNumbers'), r => r.weavingOrder.order?.order_number),
      wvofs: set(applyExcept('wvofs'), r => r.weavingOrder.weaving_number),
      designNames: set(applyExcept('designNames'), r => r.weavingOrder.order?.design_name || r.weavingOrder.design_name),
      designNos: set(applyExcept('designNos'), r => r.weavingOrder.order?.design_no || r.weavingOrder.design_no),
      inspector1s: set(applyExcept('inspector1s'), r => r.roll.inspector_1),
      inspector2s: set(applyExcept('inspector2s'), r => r.roll.inspector_2),
      fitters: set(applyExcept('fitters'), r => r.roll.attended_fitter),
      partners: set(applyExcept('partners'), w => w.weavingOrder.partner_name || (w.weavingOrder.weaving_type === 'in_house' ? 'In-House Loom Shed' : null)),
      looms: set(applyExcept('looms'), w => w.weavingOrder.machine_name),
    };
  }, [rows, filters]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const searchTerm = filters.search.toLowerCase();
    return rows.filter(({ roll: r, weavingOrder: w }) => {
      const orderNo = w.order?.order_number;
      const designName = w.order?.design_name || w.design_name;
      const designNo = w.order?.design_no || w.design_no;
      const inspectedAt = r.inspected_at ? new Date(r.inspected_at) : null;
      const partnerVal = w.partner_name || (w.weaving_type === 'in_house' ? 'In-House Loom Shed' : '');
      const loomVal = w.machine_name || '';
      return (
        (filters.rollIds.length === 0 || filters.rollIds.includes(r.id)) &&
        (filters.orderNumbers.length === 0 || filters.orderNumbers.includes(orderNo)) &&
        (filters.wvofs.length === 0 || filters.wvofs.includes(w.weaving_number)) &&
        (filters.designNames.length === 0 || filters.designNames.includes(designName)) &&
        (filters.designNos.length === 0 || filters.designNos.includes(designNo)) &&
        (filters.inspector1s.length === 0 || filters.inspector1s.includes(r.inspector_1)) &&
        (filters.inspector2s.length === 0 || filters.inspector2s.includes(r.inspector_2)) &&
        (filters.fitters.length === 0 || filters.fitters.includes(r.attended_fitter)) &&
        (filters.rollOk.length === 0 || filters.rollOk.includes(r.roll_ok !== false ? 'Yes' : 'No')) &&
        (filters.partners.length === 0 || filters.partners.includes(partnerVal)) &&
        (filters.looms.length === 0 || filters.looms.includes(loomVal)) &&
        (!filters.dateFrom || !inspectedAt || inspectedAt >= new Date(filters.dateFrom)) &&
        (!filters.dateTo || !inspectedAt || inspectedAt <= new Date(filters.dateTo + 'T23:59:59')) &&
        (!searchTerm || r.id?.toLowerCase().includes(searchTerm) || orderNo?.toLowerCase().includes(searchTerm) || designName?.toLowerCase().includes(searchTerm))
      );
    });
  }, [rows, filters]);

  const activeFilterCount = useMemo(() => {
    return ['rollIds','orderNumbers','wvofs','designNames','designNos','inspector1s','inspector2s','fitters','rollOk','partners','looms']
      .reduce((c, k) => c + (filters[k]?.length || 0), 0) +
      (filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0);
  }, [filters]);

  const clearAllFilters = () => setFilters({ rollIds:[], orderNumbers:[], wvofs:[], designNames:[], designNos:[], inspector1s:[], inspector2s:[], fitters:[], rollOk:[], partners:[], looms:[], dateFrom:'', dateTo:'', search:'' });

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const handleEditSave = async () => {
    setEditTarget(null);
    setSuccessMsg('✅ Inspection record updated successfully!');
    await fetchData();
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handlePrint = () => {
    const totalRolls = filteredRows.length;
    let totalQty = 0;
    let totalActualQty = 0;
    let totalShortage = 0;
    let totalMistake = 0;
    let totalOkQty = 0;

    filteredRows.forEach(({ roll: r }) => {
      totalQty += parseFloat(r.qty || 0);
      totalActualQty += parseFloat(r.actual_qty || r.actual_length || 0);
      totalShortage += parseFloat(r.shortage ?? ((r.qty || 0) - (r.actual_qty || r.actual_length || 0)));
      totalMistake += parseFloat(r.mistake || 0);
      totalOkQty += parseFloat(r.approved_qty ?? ((r.actual_qty || 0) - (r.mistake || 0)));
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocker is enabled. Please allow pop-ups to print the report.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Inspection Report - Print Summary</title>
          <style>
            @page { size: landscape; margin: 10mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1e293b; line-height: 1.4; }
            h1 { margin: 0 0 5px 0; color: #800000; font-size: 20px; border-bottom: 2px solid #800000; padding-bottom: 5px; }
            .meta { font-size: 11px; color: #64748b; margin-bottom: 20px; }
            .summary-card {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 10px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 25px;
            }
            .summary-item { text-align: center; }
            .summary-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
            .summary-value { font-size: 16px; font-weight: 800; color: #0f172a; }
            .summary-value.primary { color: #800000; }
            .summary-value.green { color: #15803d; }
            .summary-value.amber { color: #b45309; }
            .summary-value.red { color: #b91c1c; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 15px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; color: #334155; }
            .right { text-align: right; }
            .center { text-align: center; }
            .badge { display: inline-block; padding: 2px 5px; border-radius: 3px; font-size: 8px; font-weight: 700; }
            .badge-ok { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
            .badge-fail { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
            .comment { display: inline-block; font-size: 8px; background: #f1f5f9; padding: 2px 4px; border-radius: 3px; margin: 1px; border: 1px solid #cbd5e1; }
            @media print {
              @page { size: landscape; margin: 10mm; }
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h1>Inspection Summary Report</h1>
            <button onclick="window.print()" style="padding: 6px 12px; background: #800000; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px;">Print Report</button>
          </div>
          <div class="meta">Generated on ${new Date().toLocaleString('en-IN')} | Records: ${totalRolls}</div>
          
          <div class="summary-card">
            <div class="summary-item">
              <div class="summary-label">Total Rolls</div>
              <div class="summary-value primary">${totalRolls}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Qty (m)</div>
              <div class="summary-value">${totalQty.toFixed(2)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Act Qty (m)</div>
              <div class="summary-value">${totalActualQty.toFixed(2)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Shortage (m)</div>
              <div class="summary-value ${totalShortage > 0 ? 'amber' : 'green'}">${totalShortage.toFixed(2)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Mistakes (m)</div>
              <div class="summary-value ${totalMistake > 0 ? 'red' : ''}">${totalMistake.toFixed(2)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total OK Qty (m)</div>
              <div class="summary-value green">${totalOkQty.toFixed(2)}</div>
            </div>
          </div>
          
          <h2>Greige Roll Details</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 8%">Date</th>
                <th style="width: 14%">Greige Fabric ID</th>
                <th style="width: 10%">WVOF</th>
                <th style="width: 10%">Order No</th>
                <th style="width: 12%">Weaving Unit / Loom</th>
                <th style="width: 12%">Design</th>
                <th style="width: 12%">Inspectors</th>
                <th class="right" style="width: 5%">Qty</th>
                <th class="right" style="width: 5%">Act Qty</th>
                <th class="right" style="width: 5%">Short</th>
                <th class="right" style="width: 5%">Mistake</th>
                <th class="right" style="width: 5%">OK Qty</th>
                <th style="width: 15%">Defect Comments</th>
                <th class="center" style="width: 6%">Result</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.map(({ roll: r, weavingOrder: w }) => {
                const orderNo = w.order?.order_number || '—';
                const designName = w.order?.design_name || w.design_name || '—';
                const designNo = w.order?.design_no || w.design_no || '—';
                const inspectedAt = r.inspected_at ? new Date(r.inspected_at) : null;
                const dateStr = inspectedAt ? inspectedAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
                const isOk = r.roll_ok !== false;
                const shortageVal = parseFloat(r.shortage ?? ((r.qty || 0) - (r.actual_qty || r.actual_length || 0))).toFixed(2);
                const okQtyVal = parseFloat(r.approved_qty ?? ((r.actual_qty || 0) - (r.mistake || 0))).toFixed(2);
                const warpComments = r.warp_comments || [];
                const weftComments = r.weft_comments || [];
                const comments = [...warpComments, ...weftComments];
                const typeLabel = w.weaving_type === 'in_house' ? 'In-House' : 'Job Work';
                const unitStr = `${typeLabel}${w.machine_name ? ` (${w.machine_name})` : ''} - ${w.partner_name || (w.weaving_type === 'in_house' ? 'In-House Loom Shed' : '—')}`;
                
                return `
                  <tr>
                    <td>${dateStr}</td>
                    <td style="font-family: monospace; font-weight: bold;">${r.id}</td>
                    <td>${w.weaving_number || '—'}</td>
                    <td>${orderNo}</td>
                    <td>${unitStr}</td>
                    <td><b>${designNo}</b><br/><span style="color:#64748b; font-size:9px;">${designName}</span></td>
                    <td><b>${r.inspector_1 || '—'}</b>${r.inspector_2 ? `<br/><span style="color:#64748b; font-size:9px;">${r.inspector_2}</span>` : ''}</td>
                    <td class="right">${parseFloat(r.qty || 0).toFixed(2)}</td>
                    <td class="right">${parseFloat(r.actual_qty || r.actual_length || 0).toFixed(2)}</td>
                    <td class="right" style="${parseFloat(shortageVal) > 0 ? 'background: #fffbeb; color: #b45309; font-weight: bold;' : ''}">${shortageVal}</td>
                    <td class="right" style="${parseFloat(r.mistake || 0) > 0 ? 'background: #fff1f2; color: #b91c1c; font-weight: bold;' : ''}">${parseFloat(r.mistake || 0).toFixed(2)}</td>
                    <td class="right" style="background: #ecfdf5; color: #15803d; font-weight: bold;">${okQtyVal}</td>
                    <td>
                      ${comments.map(c => `<span class="comment">${c}</span>`).join('') || '—'}
                    </td>
                    <td class="center">
                      <span class="badge ${isOk ? 'badge-ok' : 'badge-fail'}">${isOk ? 'OK' : 'FAIL'}</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#047857', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.825rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={16} />{successMsg}
        </div>
      )}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.825rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} />{error}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)' }} />
          <input
            type="text"
            placeholder="Search Roll ID, Order, Design..."
            className="input-field"
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            style={{ paddingLeft: '2rem', fontSize: '0.8rem' }}
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setFilterOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
            border: `1.5px solid ${filterOpen ? 'var(--color-primary)' : 'var(--border-current)'}`,
            borderRadius: '8px', background: filterOpen ? 'rgba(128,0,0,0.06)' : 'white',
            color: filterOpen ? 'var(--color-primary)' : 'var(--text-current)', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
          }}
        >
          <Filter size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span style={{ background: 'var(--color-primary)', color: 'white', borderRadius: '99px', fontSize: '0.65rem', fontWeight: '800', padding: '1px 6px', marginLeft: '2px' }}>
              {activeFilterCount}
            </span>
          )}
          {filterOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* Print Summary Button */}
        <button
          onClick={handlePrint}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.1rem',
            border: 'none', borderRadius: '8px', background: 'var(--color-primary)',
            color: 'white', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer',
            transition: 'opacity 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <FileText size={14} />
          Print Summary
        </button>

        {activeFilterCount > 0 && (
          <button onClick={clearAllFilters} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.75rem', border: 'none', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>
            <X size={12} /> Clear All
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
            {filteredRows.length} of {rows.length} records
          </span>
          <button onClick={fetchData} disabled={loading} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted-current)', padding: '4px' }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {filterOpen && (
        <div style={{
          border: '1.5px solid var(--border-current)', borderRadius: '12px',
          background: 'white', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)', animation: 'fadeIn 0.15s ease-out'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)' }}>
            🔽 Advanced Filters — Multi-select, Interdependent
          </div>

          {/* Row 1 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start' }}>
            <MultiSelect label="Roll ID" options={dependentOptions.rollIds} selected={filters.rollIds} onChange={v => setFilter('rollIds', v)} placeholder="All Roll IDs" />
            <MultiSelect label="Order No" options={dependentOptions.orderNumbers} selected={filters.orderNumbers} onChange={v => setFilter('orderNumbers', v)} placeholder="All Orders" />
            <MultiSelect label="WVOF" options={dependentOptions.wvofs} selected={filters.wvofs} onChange={v => setFilter('wvofs', v)} placeholder="All WVOFs" />
            <MultiSelect label="Partner" options={dependentOptions.partners} selected={filters.partners} onChange={v => setFilter('partners', v)} placeholder="All Partners" />
            <MultiSelect label="Loom / Machine" options={dependentOptions.looms} selected={filters.looms} onChange={v => setFilter('looms', v)} placeholder="All Looms" />
          </div>

          {/* Row 2 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-start' }}>
            <MultiSelect label="Design Name" options={dependentOptions.designNames} selected={filters.designNames} onChange={v => setFilter('designNames', v)} placeholder="All Designs" />
            <MultiSelect label="Design No" options={dependentOptions.designNos} selected={filters.designNos} onChange={v => setFilter('designNos', v)} placeholder="All Design Nos" />
            <MultiSelect label="Inspector 1" options={dependentOptions.inspector1s} selected={filters.inspector1s} onChange={v => setFilter('inspector1s', v)} placeholder="All Inspector 1s" />
            <MultiSelect label="Inspector 2" options={dependentOptions.inspector2s} selected={filters.inspector2s} onChange={v => setFilter('inspector2s', v)} placeholder="All Inspector 2s" />
            <MultiSelect label="Attended Fitter" options={dependentOptions.fitters} selected={filters.fitters} onChange={v => setFilter('fitters', v)} placeholder="All Fitters" />
            <MultiSelect label="Roll OK?" options={['Yes', 'No']} selected={filters.rollOk} onChange={v => setFilter('rollOk', v)} placeholder="All Statuses" />
          </div>

          {/* Date Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Inspected From</label>
              <input type="date" className="input-field" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} style={{ fontSize: '0.8rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Inspected To</label>
              <input type="date" className="input-field" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} style={{ fontSize: '0.8rem' }} />
            </div>
          </div>
        </div>
      )}

      {/* Cards List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
          <Loader size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.85rem' }}>Loading inspections...</div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '2px dashed var(--border-current)', borderRadius: '12px' }}>
          <FileText size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <div style={{ fontWeight: '700' }}>No 4-Point inspected rolls found</div>
          <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
            {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Inspections will appear here after rolls are inspected'}
          </div>
        </div>
      ) : (
        <div style={{
          width: '100%',
          overflowX: 'hidden',
          background: 'white',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.72rem',
            fontFamily: 'var(--font-sans)',
            tableLayout: 'fixed',
          }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border-current)', color: 'var(--text-muted-current)' }}>
                <th style={{ width: '6%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left' }}>Date</th>
                <th style={{ width: '13%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left' }}>Greige Fabric ID / WVOF</th>
                <th style={{ width: '9%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left' }}>Order No</th>
                <th style={{ width: '11%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left' }}>Weaving Unit</th>
                <th style={{ width: '10%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left' }}>Design</th>
                <th style={{ width: '8%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left' }}>Inspectors</th>
                <th style={{ width: '5%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'right' }}>Qty</th>
                <th style={{ width: '5%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'right' }}>Act Qty</th>
                <th style={{ width: '5%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'right' }}>Short</th>
                <th style={{ width: '5%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'right' }}>Mistake</th>
                <th style={{ width: '5%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'right' }}>OK Qty</th>
                <th style={{ width: '12%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left' }}>Mistakes</th>
                <th style={{ width: '6%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center' }}>Result</th>
                <th style={{ width: '5%', padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center' }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ roll: r, weavingOrder: w }) => {
                const orderNo = w.order?.order_number || '—';
                const designName = w.order?.design_name || w.design_name || '—';
                const designNo = w.order?.design_no || w.design_no || '—';
                const inspectedAt = r.inspected_at ? new Date(r.inspected_at) : null;
                const dateStr = inspectedAt ? inspectedAt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
                const isOk = r.roll_ok !== false;
                const shortage = parseFloat(r.shortage ?? ((r.qty || 0) - (r.actual_qty || r.actual_length || 0))).toFixed(2);
                const okQty = parseFloat(r.approved_qty ?? ((r.actual_qty || 0) - (r.mistake || 0))).toFixed(2);
                const warpComments = r.warp_comments || [];
                const weftComments = r.weft_comments || [];
                const allComments = [...warpComments, ...weftComments];

                return (
                  <tr
                    key={`${w.id}-${r.id}`}
                    style={{
                      borderBottom: '1px solid var(--border-current)',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {/* Date */}
                    <td style={{ padding: '0.5rem 0.4rem', color: 'var(--text-muted-current)' }}>{dateStr}</td>
                    
                    {/* Greige Fabric ID & WVOF */}
                    <td style={{ padding: '0.5rem 0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.7rem' }} title={`Roll: ${r.id}`}>{r.id}</span>
                        <span style={{ color: 'var(--text-muted-current)', fontSize: '0.62rem', fontWeight: '600' }} title={`WVOF: ${w.weaving_number}`}>({w.weaving_number || '—'})</span>
                      </div>
                    </td>
                    
                    {/* Order No */}
                    <td style={{ padding: '0.5rem 0.4rem', wordBreak: 'break-all' }}>{orderNo}</td>

                    {/* Weaving Unit */}
                    <td style={{ padding: '0.5rem 0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                        <span style={{
                          fontSize: '0.58rem',
                          fontWeight: '800',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          background: w.weaving_type === 'in_house' ? '#f3e8ff' : '#e0f2fe',
                          color: w.weaving_type === 'in_house' ? '#6b21a8' : '#0369a1',
                          whiteSpace: 'nowrap'
                        }}>
                          {w.weaving_type === 'in_house' ? 'In-House' : 'Job Work'}
                        </span>
                        {w.machine_name && (
                          <span style={{ fontSize: '0.65rem', fontWeight: '750', color: 'var(--text-current)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={w.machine_name}>
                            {w.machine_name}
                          </span>
                        )}
                      </div>
                      <div
                        style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                        title={w.partner_name || (w.weaving_type === 'in_house' ? 'In-House Loom Shed' : '—')}
                      >
                        {w.partner_name || (w.weaving_type === 'in_house' ? 'In-House Loom Shed' : '—')}
                      </div>
                    </td>
                    
                    {/* Design Name and Number */}
                    <td style={{ padding: '0.5rem 0.4rem', overflow: 'hidden' }}>
                      <div style={{ fontWeight: '700', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }} title={designNo}>{designNo}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }} title={designName}>{designName}</div>
                    </td>
                    
                    {/* Inspection Names (Inspectors) */}
                    <td style={{ padding: '0.5rem 0.4rem' }}>
                      <div style={{ fontWeight: '600', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }} title={r.inspector_1}>{r.inspector_1 || '—'}</div>
                      {r.inspector_2 && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }} title={r.inspector_2}>{r.inspector_2}</div>}
                    </td>
                    
                    {/* Qty */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', fontWeight: '600' }}>{parseFloat(r.qty || 0).toFixed(2)}</td>
                    
                    {/* Actual Qty */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', fontWeight: '600' }}>{parseFloat(r.actual_qty || r.actual_length || 0).toFixed(2)}</td>
                    
                    {/* Shortage */}
                    <td style={{
                      padding: '0.5rem 0.4rem',
                      textAlign: 'right',
                      fontWeight: '700',
                      color: parseFloat(shortage) > 0 ? '#b45309' : '#047857',
                      backgroundColor: parseFloat(shortage) > 0 ? '#fffbeb' : 'transparent'
                    }}>{parseFloat(shortage).toFixed(2)}</td>
                    
                    {/* Mistake */}
                    <td style={{
                      padding: '0.5rem 0.4rem',
                      textAlign: 'right',
                      fontWeight: '700',
                      color: parseFloat(r.mistake || 0) > 0 ? '#be123c' : 'inherit',
                      backgroundColor: parseFloat(r.mistake || 0) > 0 ? '#fef2f2' : 'transparent'
                    }}>{parseFloat(r.mistake || 0).toFixed(2)}</td>
                    
                    {/* OK Qty */}
                    <td style={{
                      padding: '0.5rem 0.4rem',
                      textAlign: 'right',
                      fontWeight: '800',
                      color: '#047857',
                      backgroundColor: '#ecfdf5'
                    }}>{parseFloat(okQty).toFixed(2)}</td>
                    
                    {/* Mistakes */}
                    <td style={{ padding: '0.5rem 0.4rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', maxHeight: '40px', overflowY: 'auto' }}>
                        {allComments.length > 0 ? (
                          allComments.map(c => (
                            <span
                              key={c}
                              style={{
                                fontSize: '0.58rem',
                                background: '#fee2e2',
                                color: '#991b1b',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                whiteSpace: 'nowrap',
                              }}
                              title={c}
                            >
                              {c}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-muted-current)' }}>—</span>
                        )}
                      </div>
                    </td>
                    
                    {/* OK or Fail */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        fontWeight: '800',
                        background: isOk ? '#dcfce7' : '#fee2e2',
                        color: isOk ? '#15803d' : '#b91c1c',
                        border: `1.5px solid ${isOk ? '#bbf7d0' : '#fecaca'}`
                      }}>
                        {isOk ? 'OK' : 'FAIL'}
                      </span>
                    </td>
                    
                    {/* Edit Option */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setEditTarget({ roll: r, weavingOrder: w })}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          padding: '3px 8px',
                          border: '1.5px solid var(--color-primary)',
                          borderRadius: '5px',
                          background: 'rgba(128,0,0,0.04)',
                          color: 'var(--color-primary)',
                          fontSize: '0.68rem',
                          fontWeight: '800',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(128,0,0,0.04)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                      >
                        <Edit3 size={10} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <EditModal
          roll={editTarget.roll}
          weavingOrder={editTarget.weavingOrder}
          inspectors={inspectors}
          onClose={() => setEditTarget(null)}
          onSave={handleEditSave}
        />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}


// ─── Washed Edit Modal ─────────────────────────────────────────────────────────
function WashedEditModal({ roll, weavingOrder, inspectors, onClose, onSave }) {
  const [form, setForm] = useState({
    actual_qty: roll.washed_actual_qty ?? roll.actual_qty ?? roll.received_qty ?? roll.qty ?? '',
    inspector_1: roll.washed_inspector_1 ?? roll.inspector_1 ?? '',
    inspector_2: roll.washed_inspector_2 ?? roll.inspector_2 ?? '',
    washed_place: roll.washed_place ?? 'Factory',
    weaving1pt: roll.washed_weaving_defect_1pt_count ?? 0,
    weaving2pt: roll.washed_weaving_defect_2pt_count ?? 0,
    weaving3pt: roll.washed_weaving_defect_3pt_count ?? 0,
    weaving4pt: roll.washed_weaving_defect_4pt_count ?? 0,
    yarn1pt: roll.washed_yarn_defect_1pt_count ?? 0,
    yarn4pt: roll.washed_yarn_defect_4pt_count ?? 0,
    holes2pt: roll.washed_holes_stains_2pt_count ?? 0,
    holes4pt: roll.washed_holes_stains_4pt_count ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const receivedQty = parseFloat(roll.received_qty ?? roll.qty ?? 0);
  const actualQty = parseFloat(form.actual_qty || 0);
  const shortage = parseFloat((receivedQty - actualQty).toFixed(2));

  const weavingTotal = form.weaving1pt * 1 + form.weaving2pt * 2 + form.weaving3pt * 3 + form.weaving4pt * 4;
  const yarnTotal = form.yarn1pt * 1 + form.yarn4pt * 4;
  const holesStainsTotal = form.holes2pt * 2 + form.holes4pt * 4;
  const totalPoints = weavingTotal + yarnTotal + holesStainsTotal;

  const handleSave = async () => {
    if (actualQty <= 0) { setErr('Actual qty must be > 0.'); return; }
    if (!form.inspector_1) { setErr('Inspector 1 is required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const currentRolls = Array.isArray(weavingOrder.fabric_rolls) ? weavingOrder.fabric_rolls : [];
      const updatedRolls = currentRolls.map(r => {
        if (r.id.toLowerCase() === roll.id.toLowerCase()) {
          return {
            ...r,
            actual_qty: actualQty,
            actual_length: actualQty,
            shortage: shortage,
            inspector_1: form.inspector_1,
            inspector_2: form.inspector_2,
            inspected_at: new Date().toISOString(),
            roll_ok: totalPoints === 0,
            
            washed_actual_qty: actualQty,
            washed_shortage: shortage,
            washed_inspector_1: form.inspector_1,
            washed_inspector_2: form.inspector_2,
            washed_place: form.washed_place || 'Factory',
            washed_inspected_at: new Date().toISOString(),
            
            washed_weaving_defect_1pt_count: form.weaving1pt,
            washed_weaving_defect_2pt_count: form.weaving2pt,
            washed_weaving_defect_3pt_count: form.weaving3pt,
            washed_weaving_defect_4pt_count: form.weaving4pt,
            washed_weaving_defect_total_points: weavingTotal,
            
            washed_yarn_defect_1pt_count: form.yarn1pt,
            washed_yarn_defect_4pt_count: form.yarn4pt,
            washed_yarn_defect_total_points: yarnTotal,
            
            washed_holes_stains_2pt_count: form.holes2pt,
            washed_holes_stains_4pt_count: form.holes4pt,
            washed_holes_stains_total_points: holesStainsTotal,
            
            washed_total_defect_points: totalPoints
          };
        }
        return r;
      });

      const { error: updateErr } = await supabase
        .from('weaving_orders')
        .update({ fabric_rolls: updatedRolls })
        .eq('id', weavingOrder.id);

      if (updateErr) throw updateErr;

      onSave();
    } catch (e) {
      setErr('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const defectCounterStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.4rem 0.75rem',
    border: '1px solid var(--border-current)',
    borderRadius: '8px',
    background: '#f8fafc'
  };

  const btnStyle = {
    background: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    fontWeight: '800',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)',
          position: 'sticky', top: 0, background: 'white', zIndex: 2
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: 'var(--color-primary)' }}>
              Edit Washed Inspection: {roll.processed_roll_id || roll.id}
            </h2>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>
              Updates will reflect in washed QC reports
            </span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted-current)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {err && (
            <div style={{ background: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600' }}>
              <AlertTriangle size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />{err}
            </div>
          )}

          {/* Roll Metadata */}
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.85rem', border: '1px solid var(--border-current)', fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <div>
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase' }}>Order No</div>
              <strong>{weavingOrder.order?.order_number || '—'}</strong>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase' }}>WVOF</div>
              <strong>{weavingOrder.weaving_number || '—'}</strong>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase' }}>Design</div>
              <strong>{weavingOrder.order?.design_no || weavingOrder.design_no} / {weavingOrder.order?.design_name || '—'}</strong>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase' }}>Received Qty</div>
              <strong>{receivedQty} m</strong>
            </div>
          </div>

          {/* Qty Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem' }}>Actual Qty (m)</label>
              <input type="number" step="0.01" className="input-field" value={form.actual_qty}
                onChange={e => setForm(f => ({ ...f, actual_qty: e.target.value }))} style={{ fontWeight: '700' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem', color: '#b45309' }}>Shortage (m)</label>
              <div style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #fcd34d', borderRadius: '8px', background: '#fffbeb', fontWeight: '800', color: '#b45309', minHeight: '38px', display: 'flex', alignItems: 'center' }}>
                {shortage} m
              </div>
            </div>
          </div>

          {/* Defect Point counters */}
          <div style={{ borderTop: '1px dashed var(--border-current)', paddingTop: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Defect Point Counts</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Weaving Defects */}
              <div style={{ border: '1px solid var(--border-current)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', display: 'block', marginBottom: '0.5rem', color: 'var(--text-current)' }}>Weaving Defects (Total: {weavingTotal} Pt)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={defectCounterStyle}>
                    <span style={{ fontSize: '0.72rem' }}>1 Point: <strong>{form.weaving1pt}</strong></span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" onClick={() => setForm(f => ({ ...f, weaving1pt: Math.max(0, f.weaving1pt - 1) }))} style={btnStyle}>-</button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, weaving1pt: f.weaving1pt + 1 }))} style={btnStyle}>+</button>
                    </div>
                  </div>
                  <div style={defectCounterStyle}>
                    <span style={{ fontSize: '0.72rem' }}>2 Point: <strong>{form.weaving2pt}</strong></span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" onClick={() => setForm(f => ({ ...f, weaving2pt: Math.max(0, f.weaving2pt - 1) }))} style={btnStyle}>-</button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, weaving2pt: f.weaving2pt + 1 }))} style={btnStyle}>+</button>
                    </div>
                  </div>
                  <div style={defectCounterStyle}>
                    <span style={{ fontSize: '0.72rem' }}>3 Point: <strong>{form.weaving3pt}</strong></span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" onClick={() => setForm(f => ({ ...f, weaving3pt: Math.max(0, f.weaving3pt - 1) }))} style={btnStyle}>-</button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, weaving3pt: f.weaving3pt + 1 }))} style={btnStyle}>+</button>
                    </div>
                  </div>
                  <div style={defectCounterStyle}>
                    <span style={{ fontSize: '0.72rem' }}>4 Point: <strong>{form.weaving4pt}</strong></span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" onClick={() => setForm(f => ({ ...f, weaving4pt: Math.max(0, f.weaving4pt - 1) }))} style={btnStyle}>-</button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, weaving4pt: f.weaving4pt + 1 }))} style={btnStyle}>+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Yarn Defects */}
              <div style={{ border: '1px solid var(--border-current)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', display: 'block', marginBottom: '0.5rem', color: 'var(--text-current)' }}>Yarn Defects (Total: {yarnTotal} Pt)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={defectCounterStyle}>
                    <span style={{ fontSize: '0.72rem' }}>1 Point: <strong>{form.yarn1pt}</strong></span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" onClick={() => setForm(f => ({ ...f, yarn1pt: Math.max(0, f.yarn1pt - 1) }))} style={btnStyle}>-</button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, yarn1pt: f.yarn1pt + 1 }))} style={btnStyle}>+</button>
                    </div>
                  </div>
                  <div style={defectCounterStyle}>
                    <span style={{ fontSize: '0.72rem' }}>4 Point: <strong>{form.yarn4pt}</strong></span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" onClick={() => setForm(f => ({ ...f, yarn4pt: Math.max(0, f.yarn4pt - 1) }))} style={btnStyle}>-</button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, yarn4pt: f.yarn4pt + 1 }))} style={btnStyle}>+</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Holes & Stains */}
              <div style={{ border: '1px solid var(--border-current)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', display: 'block', marginBottom: '0.5rem', color: 'var(--text-current)' }}>Holes & Stains (Total: {holesStainsTotal} Pt)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={defectCounterStyle}>
                    <span style={{ fontSize: '0.72rem' }}>2 Point: <strong>{form.holes2pt}</strong></span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" onClick={() => setForm(f => ({ ...f, holes2pt: Math.max(0, f.holes2pt - 1) }))} style={btnStyle}>-</button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, holes2pt: f.holes2pt + 1 }))} style={btnStyle}>+</button>
                    </div>
                  </div>
                  <div style={defectCounterStyle}>
                    <span style={{ fontSize: '0.72rem' }}>4 Point: <strong>{form.holes4pt}</strong></span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" onClick={() => setForm(f => ({ ...f, holes4pt: Math.max(0, f.holes4pt - 1) }))} style={btnStyle}>-</button>
                      <button type="button" onClick={() => setForm(f => ({ ...f, holes4pt: f.holes4pt + 1 }))} style={btnStyle}>+</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Inspectors & Place */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem' }}>Inspector 1 *</label>
              <select className="input-field" value={form.inspector_1} onChange={e => setForm(f => ({ ...f, inspector_1: e.target.value }))}>
                <option value="">Select Inspector 1</option>
                {inspectors.map(w => <option key={w.id} value={w.worker_name}>{w.worker_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem' }}>Inspector 2</label>
              <select className="input-field" value={form.inspector_2} onChange={e => setForm(f => ({ ...f, inspector_2: e.target.value }))}>
                <option value="">Select Inspector 2</option>
                {inspectors.map(w => <option key={w.id} value={w.worker_name}>{w.worker_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', marginBottom: '0.3rem' }}>Place *</label>
              <select className="input-field" value={form.washed_place} onChange={e => setForm(f => ({ ...f, washed_place: e.target.value }))}>
                <option value="Factory">Factory</option>
                <option value="Office">Office</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: '0.75rem', padding: '1.25rem 1.5rem',
          borderTop: '1px solid var(--border-current)', position: 'sticky', bottom: 0, background: 'white', zIndex: 2
        }}>
          <button onClick={onClose} disabled={saving} style={{ flex: 1, padding: '0.65rem', border: '1.5px solid var(--border-current)', borderRadius: '8px', background: 'white', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', color: 'var(--text-muted-current)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: '0.65rem', border: 'none', borderRadius: '8px',
            background: 'var(--color-primary)', color: 'white', fontSize: '0.85rem', fontWeight: '800',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
          }}>
            {saving ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Washed Report Tab ───────────────────────────────────────────────────────────
function WashedReportTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inspectors, setInspectors] = useState([]);
  const [editTarget, setEditTarget] = useState(null); // { roll, weavingOrder }
  const [successMsg, setSuccessMsg] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    rollIds: [],
    orderNumbers: [],
    wvofs: [],
    designNames: [],
    designNos: [],
    inspector1s: [],
    inspector2s: [],
    rollOk: [], // 'Yes', 'No'
    partners: [],
    looms: [],
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: woData, error: err } = await supabase
        .from('weaving_orders')
        .select('*, order:orders(id, order_number, design_no, design_name)')
        .order('created_at', { ascending: false });
      if (err) throw err;

      const { data: pofsData } = await supabase
        .from('processing_orders')
        .select('received_place, received_rolls');

      const washedRolls = [];
      for (const order of woData || []) {
        const rolls = Array.isArray(order.fabric_rolls) ? order.fabric_rolls : [];
        for (const roll of rolls) {
          if (roll.washed_inspected === true) {
            let pofPlace = roll.washed_place || 'Factory';
            if (pofsData) {
              const targetId = (roll.processed_roll_id || roll.id).toLowerCase();
              for (const pof of pofsData) {
                const rxRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
                const foundRx = rxRolls.find(rx => rx.id && rx.id.toLowerCase() === targetId);
                if (foundRx) {
                  pofPlace = foundRx.received_place || pof.received_place || pofPlace;
                  break;
                }
              }
            }

            // Normalize to Office/Factory
            if (pofPlace.toLowerCase().includes('office')) {
              pofPlace = 'Office';
            } else {
              pofPlace = 'Factory';
            }

            washedRolls.push({ 
              roll: {
                ...roll,
                washed_place: pofPlace
              }, 
              weavingOrder: order 
            });
          }
        }
      }
      setRows(washedRolls);
    } catch (e) {
      setError('Failed to load washed inspection data: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInspectors = useCallback(async () => {
    try {
      const { data: deptData } = await supabase.from('master_departments').select('id').ilike('department_name', '%inspection%');
      const ids = (deptData || []).map(d => d.id);
      const { data: workers } = ids.length > 0
        ? await supabase.from('master_workers').select('*').in('department_id', ids).order('worker_name')
        : await supabase.from('master_workers').select('*').order('worker_name');
      setInspectors(workers || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchData(); fetchInspectors(); }, [fetchData, fetchInspectors]);

  // Unique options for filters
  const allOptions = useMemo(() => {
    const set = (fn) => [...new Set(rows.map(fn).filter(Boolean))].sort();
    return {
      rollIds: set(r => r.roll.processed_roll_id || r.roll.id),
      orderNumbers: set(r => r.weavingOrder.order?.order_number),
      wvofs: set(r => r.weavingOrder.weaving_number),
      designNames: set(r => r.weavingOrder.order?.design_name || r.weavingOrder.design_name),
      designNos: set(r => r.weavingOrder.order?.design_no || r.weavingOrder.design_no),
      inspector1s: set(r => r.roll.washed_inspector_1),
      inspector2s: set(r => r.roll.washed_inspector_2),
      rollOk: ['Yes', 'No'],
      partners: set(r => r.weavingOrder.partner_name || (r.weavingOrder.weaving_type === 'in_house' ? 'In-House Loom Shed' : null)),
      looms: set(r => r.weavingOrder.machine_name),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(({ roll, weavingOrder }) => {
      const r = roll; const w = weavingOrder;
      const rollId = r.processed_roll_id || r.id;
      const orderNo = w.order?.order_number;
      const designName = w.order?.design_name || w.design_name;
      const designNo = w.order?.design_no || w.design_no;
      const inspectedAt = r.washed_inspected_at ? new Date(r.washed_inspected_at) : null;
      const partnerVal = w.partner_name || (w.weaving_type === 'in_house' ? 'In-House Loom Shed' : '');
      const loomVal = w.machine_name || '';
      const isOk = (r.washed_total_defect_points || 0) === 0 ? 'Yes' : 'No';

      if (filters.rollIds.length > 0 && !filters.rollIds.includes(rollId)) return false;
      if (filters.orderNumbers.length > 0 && !filters.orderNumbers.includes(orderNo)) return false;
      if (filters.wvofs.length > 0 && !filters.wvofs.includes(w.weaving_number)) return false;
      if (filters.designNames.length > 0 && !filters.designNames.includes(designName)) return false;
      if (filters.designNos.length > 0 && !filters.designNos.includes(designNo)) return false;
      if (filters.inspector1s.length > 0 && !filters.inspector1s.includes(r.washed_inspector_1)) return false;
      if (filters.inspector2s.length > 0 && !filters.inspector2s.includes(r.washed_inspector_2)) return false;
      if (filters.partners.length > 0 && !filters.partners.includes(partnerVal)) return false;
      if (filters.looms.length > 0 && !filters.looms.includes(loomVal)) return false;
      if (filters.rollOk.length > 0 && !filters.rollOk.includes(isOk)) return false;

      if (filters.dateFrom && inspectedAt && new Date(inspectedAt) < new Date(filters.dateFrom + 'T00:00:00')) return false;
      if (filters.dateTo && inspectedAt && new Date(inspectedAt) > new Date(filters.dateTo + 'T23:59:59')) return false;

      if (filters.search) {
        const term = filters.search.toLowerCase();
        return (
          rollId.toLowerCase().includes(term) ||
          (orderNo || '').toLowerCase().includes(term) ||
          (w.weaving_number || '').toLowerCase().includes(term) ||
          (designName || '').toLowerCase().includes(term) ||
          (designNo || '').toLowerCase().includes(term) ||
          (r.washed_inspector_1 || '').toLowerCase().includes(term) ||
          (r.washed_inspector_2 || '').toLowerCase().includes(term)
        );
      }

      return true;
    });
  }, [rows, filters]);

  const handleEditSave = () => {
    setEditTarget(null);
    setSuccessMsg('Washed inspection details updated successfully!');
    fetchData();
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handlePrint = () => {
    const totalRolls = filteredRows.length;
    const totalRecQty = filteredRows.reduce((acc, { roll: r }) => acc + parseFloat(r.received_qty ?? r.qty ?? 0), 0);
    const totalActQty = filteredRows.reduce((acc, { roll: r }) => acc + parseFloat(r.washed_actual_qty ?? r.actual_qty ?? 0), 0);
    const totalShortage = totalRecQty - totalActQty;

    // Group rolls by Order and Design
    const grouped = {};
    filteredRows.forEach(({ roll: r, weavingOrder: w }) => {
      const orderNumber = w.order?.order_number || '—';
      const designNo = w.order?.design_no || w.design_no || '—';
      const designName = w.order?.design_name || w.design_name || '—';
      const key = `${orderNumber}_${designNo}_${designName}`;
      if (!grouped[key]) {
        grouped[key] = {
          orderNumber,
          designNo,
          designName,
          rolls: []
        };
      }
      grouped[key].rolls.push(r);
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Washed Fabric Inspection Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1e293b; line-height: 1.4; }
            .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #800000; padding-bottom: 10px; margin-bottom: 15px; }
            .logo-section { display: flex; align-items: center; gap: 10px; }
            .logo-text { font-size: 22px; font-weight: 850; color: #800000; letter-spacing: -0.5px; }
            .logo-sub { font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            h1 { margin: 0; color: #800000; font-size: 16px; text-transform: uppercase; }
            .meta { font-size: 10px; color: #64748b; margin-bottom: 15px; }
            .summary-card {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px;
              margin-bottom: 20px;
            }
            .summary-item { text-align: center; }
            .summary-label { font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
            .summary-value { font-size: 14px; font-weight: 800; color: #0f172a; }
            .summary-value.primary { color: #800000; }
            .summary-value.green { color: #15803d; }
            .summary-value.amber { color: #b45309; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 8px; margin-bottom: 15px; }
            th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; }
            th { background: #f1f5f9; font-weight: 700; color: #334155; }
            .right { text-align: right; }
            .center { text-align: center; }
            .order-title { font-size: 11px; font-weight: 800; color: #0f172a; margin-top: 15px; background: #f8fafc; padding: 4px 8px; border-left: 3px solid #800000; }
            @media print {
              @page { size: landscape; margin: 10mm; }
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="logo-section">
              <img src="/logo.png" alt="Company Logo" style="max-height: 48px; object-fit: contain;" onerror="this.style.display='none'; document.getElementById('fallback-logo').style.display='flex';" />
              <div id="fallback-logo" style="display: none; align-items: center; gap: 0.6rem;">
                <div style="width: 32px; height: 32px; background: #800000; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: 900;">AT</div>
                <h1 style="margin: 0; color: #800000; font-size: 16px; text-transform: uppercase; font-weight: 850;">AT FABRICS</h1>
              </div>
            </div>
            <h1>Inspection Report Summary (Washed)</h1>
            <button onclick="window.print()" style="padding: 6px 12px; background: #800000; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px;">Print Report</button>
          </div>
          <div class="meta">Report Generated: ${new Date().toLocaleString('en-IN')} | Total Filtered Rolls: ${totalRolls}</div>
          
          <div class="summary-card">
            <div class="summary-item">
              <div class="summary-label">Total Rolls</div>
              <div class="summary-value primary">${totalRolls}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Received Qty</div>
              <div class="summary-value">${totalRecQty.toFixed(2)} m</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Actual Qty</div>
              <div class="summary-value green">${totalActQty.toFixed(2)} m</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Shortage</div>
              <div class="summary-value ${totalShortage > 0 ? 'amber' : ''}">${totalShortage.toFixed(2)} m</div>
            </div>
          </div>
          
          ${Object.values(grouped).map(group => `
            <div style="page-break-inside: avoid; margin-bottom: 20px;">
              <div class="order-title">
                ORDER NO: ${group.orderNumber} &nbsp;&nbsp;|&nbsp;&nbsp; DESIGN: ${group.designNo} - ${group.designName}
              </div>
              <table>
                <thead>
                  <tr>
                    <th rowspan="2" style="width: 20%">Roll Number</th>
                    <th rowspan="2" class="right" style="width: 10%">Rec Qty</th>
                    <th rowspan="2" class="right" style="width: 10%">Act Qty</th>
                    <th rowspan="2" class="right" style="width: 10%">Short</th>
                    <th colspan="4" class="center" style="border-left: 1px solid #cbd5e1">Weaving Defects</th>
                    <th colspan="2" class="center" style="border-left: 1px solid #cbd5e1">Yarn Defects</th>
                    <th colspan="2" class="center" style="border-left: 1px solid #cbd5e1">Holes & Stains</th>
                  </tr>
                  <tr>
                    <th class="center" style="border-left: 1px solid #cbd5e1; width: 6%">1 Pt</th>
                    <th class="center" style="width: 6%">2 Pt</th>
                    <th class="center" style="width: 6%">3 Pt</th>
                    <th class="center" style="width: 6%">4 Pt</th>
                    <th class="center" style="border-left: 1px solid #cbd5e1; width: 6%">1 Pt</th>
                    <th class="center" style="width: 6%">4 Pt</th>
                    <th class="center" style="border-left: 1px solid #cbd5e1; width: 6%">2 Pt</th>
                    <th class="center" style="width: 6%">4 Pt</th>
                  </tr>
                </thead>
                <tbody>
                  ${group.rolls.map(r => {
                    const recVal = parseFloat(r.received_qty ?? r.qty ?? 0);
                    const actVal = parseFloat(r.washed_actual_qty ?? r.actual_qty ?? 0);
                    const shortVal = parseFloat(r.washed_shortage ?? (recVal - actVal)).toFixed(2);
                    return `
                      <tr>
                        <td style="font-family: monospace; font-weight: bold;">${r.processed_roll_id || r.id}</td>
                        <td class="right">${recVal.toFixed(2)}</td>
                        <td class="right">${actVal.toFixed(2)}</td>
                        <td class="right" style="${parseFloat(shortVal) > 0 ? 'background: #fffbeb; color: #b45309; font-weight: bold;' : ''}">${shortVal}</td>
                        
                        <td class="center" style="border-left: 1px solid #cbd5e1; ${r.washed_weaving_defect_1pt_count > 0 ? 'font-weight: bold; color: #800000;' : 'color: #94a3b8;'}">${r.washed_weaving_defect_1pt_count ?? 0}</td>
                        <td class="center" style="${r.washed_weaving_defect_2pt_count > 0 ? 'font-weight: bold; color: #800000;' : 'color: #94a3b8;'}">${r.washed_weaving_defect_2pt_count ?? 0}</td>
                        <td class="center" style="${r.washed_weaving_defect_3pt_count > 0 ? 'font-weight: bold; color: #800000;' : 'color: #94a3b8;'}">${r.washed_weaving_defect_3pt_count ?? 0}</td>
                        <td class="center" style="${r.washed_weaving_defect_4pt_count > 0 ? 'font-weight: bold; color: #800000;' : 'color: #94a3b8;'}">${r.washed_weaving_defect_4pt_count ?? 0}</td>
                        
                        <td class="center" style="border-left: 1px solid #cbd5e1; ${r.washed_yarn_defect_1pt_count > 0 ? 'font-weight: bold; color: #800000;' : 'color: #94a3b8;'}">${r.washed_yarn_defect_1pt_count ?? 0}</td>
                        <td class="center" style="${r.washed_yarn_defect_4pt_count > 0 ? 'font-weight: bold; color: #800000;' : 'color: #94a3b8;'}">${r.washed_yarn_defect_4pt_count ?? 0}</td>
                        
                        <td class="center" style="border-left: 1px solid #cbd5e1; ${r.washed_holes_stains_2pt_count > 0 ? 'font-weight: bold; color: #800000;' : 'color: #94a3b8;'}">${r.washed_holes_stains_2pt_count ?? 0}</td>
                        <td class="center" style="${r.washed_holes_stains_4pt_count > 0 ? 'font-weight: bold; color: #800000;' : 'color: #94a3b8;'}">${r.washed_holes_stains_4pt_count ?? 0}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div style={{ background: 'white', border: '1px solid var(--border-current)', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
      
      {successMsg && (
        <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #10b981', color: '#047857', padding: '0.85rem 1rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '750', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CheckCircle size={14} />{successMsg}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <input
              type="text"
              placeholder="Search washed roll report..."
              className="input-field"
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.8rem' }}
            />
            <Search size={14} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.75rem', top: '11px' }} />
          </div>
          <button
            onClick={() => setFilterOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.45rem 0.85rem', height: '36px', border: '1.5px solid var(--border-current)',
              borderRadius: '8px', background: filterOpen ? 'rgba(128,0,0,0.06)' : 'white',
              cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', color: filterOpen ? 'var(--color-primary)' : 'var(--text-current)'
            }}
          >
            <Filter size={14} /> {filterOpen ? 'Hide Filters' : 'More Filters'}
          </button>
          <button onClick={() => { setFilters({ rollIds: [], orderNumbers: [], wvofs: [], designNames: [], designNos: [], inspector1s: [], inspector2s: [], rollOk: [], partners: [], looms: [], dateFrom: '', dateTo: '', search: '' }); }} style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>
            Clear All
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={handlePrint}
            disabled={loading || filteredRows.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              border: '1.5px solid var(--color-primary)', background: 'rgba(128,0,0,0.04)',
              color: 'var(--color-primary)', padding: '0.45rem 0.85rem', height: '36px',
              borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '750'
            }}
          >
            <Printer size={14} /> Print Summary
          </button>
          <button onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1.5px solid var(--border-current)', background: 'white', padding: '0.45rem 0.85rem', height: '36px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700' }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Reload
          </button>
        </div>
      </div>

      {/* Expanded filters */}
      {filterOpen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', padding: '1rem', border: '1.5px solid var(--border-current)', borderRadius: '10px', background: '#fafafa', marginBottom: '1rem', animation: 'fadeIn 0.15s ease-out' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '750', textTransform: 'uppercase', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Date From</label>
            <input type="date" className="input-field" style={{ height: '34px', fontSize: '0.75rem' }} value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '750', textTransform: 'uppercase', marginBottom: '0.25rem', color: 'var(--text-muted-current)' }}>Date To</label>
            <input type="date" className="input-field" style={{ height: '34px', fontSize: '0.75rem' }} value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
          </div>
          <MultiSelect label="Roll ID" options={allOptions.rollIds} selected={filters.rollIds} onChange={val => setFilters(f => ({ ...f, rollIds: val }))} />
          <MultiSelect label="Order No" options={allOptions.orderNumbers} selected={filters.orderNumbers} onChange={val => setFilters(f => ({ ...f, orderNumbers: val }))} />
          <MultiSelect label="WVOF" options={allOptions.wvofs} selected={filters.wvofs} onChange={val => setFilters(f => ({ ...f, wvofs: val }))} />
          <MultiSelect label="Design No" options={allOptions.designNos} selected={filters.designNos} onChange={val => setFilters(f => ({ ...f, designNos: val }))} />
          <MultiSelect label="Weaving Unit" options={allOptions.partners} selected={filters.partners} onChange={val => setFilters(f => ({ ...f, partners: val }))} />
          <MultiSelect label="Machine" options={allOptions.looms} selected={filters.looms} onChange={val => setFilters(f => ({ ...f, looms: val }))} />
          <MultiSelect label="Inspector 1" options={allOptions.inspector1s} selected={filters.inspector1s} onChange={val => setFilters(f => ({ ...f, inspector1s: val }))} />
          <MultiSelect label="Inspector 2" options={allOptions.inspector2s} selected={filters.inspector2s} onChange={val => setFilters(f => ({ ...f, inspector2s: val }))} />
          <MultiSelect label="Roll Status" options={allOptions.rollOk} selected={filters.rollOk} onChange={val => setFilters(f => ({ ...f, rollOk: val }))} />
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', gap: '0.5rem', color: 'var(--text-muted-current)' }}>
          <Loader size={26} style={{ animation: 'spin 1.2s linear infinite' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Fetching records...</span>
        </div>
      ) : filteredRows.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', color: 'var(--text-muted-current)' }}>
          <AlertTriangle size={32} style={{ marginBottom: '0.5rem' }} />
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-current)' }}>No Washed Inspections Found</strong>
          <span style={{ fontSize: '0.75rem' }}>Try adjusting your search query or check if washed rolls are scanned.</span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1.5px solid var(--border-current)', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textRendering: 'optimizeLegibility' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-current)', color: 'var(--text-muted-current)' }}>
                <th rowSpan="2" style={{ padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left', verticalAlign: 'middle' }}>Date</th>
                <th rowSpan="2" style={{ padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left', verticalAlign: 'middle' }}>Roll ID</th>
                <th rowSpan="2" style={{ padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left', verticalAlign: 'middle' }}>Order & Design</th>
                <th rowSpan="2" style={{ padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'right', verticalAlign: 'middle' }}>Rec Qty</th>
                <th rowSpan="2" style={{ padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'right', verticalAlign: 'middle' }}>Act Qty</th>
                <th rowSpan="2" style={{ padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'right', verticalAlign: 'middle' }}>Short</th>
                <th rowSpan="2" style={{ padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left', verticalAlign: 'middle' }}>Inspection</th>
                
                {/* Defect categories */}
                <th colSpan="4" style={{ padding: '0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', borderBottom: '1px solid var(--border-current)', borderLeft: '1px solid var(--border-current)' }}>Weaving Defects</th>
                <th colSpan="2" style={{ padding: '0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', borderBottom: '1px solid var(--border-current)', borderLeft: '1px solid var(--border-current)' }}>Yarn Defects</th>
                <th colSpan="2" style={{ padding: '0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', borderBottom: '1px solid var(--border-current)', borderLeft: '1px solid var(--border-current)' }}>Holes & Stains</th>
                
                <th rowSpan="2" style={{ padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'left', verticalAlign: 'middle', borderLeft: '1px solid var(--border-current)' }}>Place</th>
                <th rowSpan="2" style={{ padding: '0.6rem 0.4rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', verticalAlign: 'middle' }}>Edit</th>
              </tr>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border-current)', color: 'var(--text-muted-current)' }}>
                {/* Weaving sub-headers */}
                <th style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '800', borderLeft: '1px solid var(--border-current)' }}>1 Pt</th>
                <th style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '800' }}>2 Pt</th>
                <th style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '800' }}>3 Pt</th>
                <th style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '800' }}>4 Pt</th>
                {/* Yarn sub-headers */}
                <th style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '800', borderLeft: '1px solid var(--border-current)' }}>1 Pt</th>
                <th style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '800' }}>4 Pt</th>
                {/* Holes sub-headers */}
                <th style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '800', borderLeft: '1px solid var(--border-current)' }}>2 Pt</th>
                <th style={{ padding: '0.35rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '800' }}>4 Pt</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({ roll: r, weavingOrder: w }) => {
                const orderNo = w.order?.order_number || '—';
                const designName = w.order?.design_name || w.design_name || '—';
                const designNo = w.order?.design_no || w.design_no || '—';
                const date = r.washed_inspected_at ? new Date(r.washed_inspected_at) : (r.inspected_at ? new Date(r.inspected_at) : null);
                const dateStr = date ? date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
                const recQty = parseFloat(r.received_qty ?? r.qty ?? 0);
                const actQty = parseFloat(r.washed_actual_qty ?? r.actual_qty ?? 0);
                const shortage = parseFloat(r.washed_shortage ?? (recQty - actQty)).toFixed(2);
                
                const w1 = r.washed_weaving_defect_1pt_count ?? 0;
                const w2 = r.washed_weaving_defect_2pt_count ?? 0;
                const w3 = r.washed_weaving_defect_3pt_count ?? 0;
                const w4 = r.washed_weaving_defect_4pt_count ?? 0;
                
                const y1 = r.washed_yarn_defect_1pt_count ?? 0;
                const y4 = r.washed_yarn_defect_4pt_count ?? 0;
                
                const h2 = r.washed_holes_stains_2pt_count ?? 0;
                const h4 = r.washed_holes_stains_4pt_count ?? 0;

                const placeStr = r.washed_place || 'Factory';

                return (
                  <tr
                    key={`${w.id}-${r.id}`}
                    style={{ borderBottom: '1px solid var(--border-current)', transition: 'background-color 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {/* Date */}
                    <td style={{ padding: '0.5rem 0.4rem', color: 'var(--text-muted-current)' }}>{dateStr}</td>
                    
                    {/* Roll ID (No WVOF) */}
                    <td style={{ padding: '0.5rem 0.4rem', fontFamily: 'monospace', fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.7rem' }}>
                      {r.processed_roll_id || r.id}
                    </td>

                    {/* Order & Design */}
                    <td style={{ padding: '0.5rem 0.4rem' }}>
                      <div style={{ fontWeight: '750', color: 'var(--text-current)', marginBottom: '2px' }}>{orderNo}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)', lineHeight: 1.15 }}>
                        <strong>{designNo}</strong> / {designName}
                      </div>
                    </td>

                    {/* Rec Qty */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', fontWeight: '600' }}>{recQty.toFixed(2)}</td>
                    
                    {/* Act Qty */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', fontWeight: '600' }}>{actQty.toFixed(2)}</td>
                    
                    {/* Shortage */}
                    <td style={{
                      padding: '0.5rem 0.4rem', textAlign: 'right', fontWeight: '700',
                      color: parseFloat(shortage) > 0 ? '#b45309' : '#047857',
                      backgroundColor: parseFloat(shortage) > 0 ? '#fffbeb' : 'transparent'
                    }}>{shortage}</td>

                    {/* Inspection (Inspectors) */}
                    <td style={{ padding: '0.5rem 0.4rem' }}>
                      <div style={{ fontWeight: '600' }}>{r.washed_inspector_1 || r.inspector_1 || '—'}</div>
                      {(r.washed_inspector_2 || r.inspector_2) && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>{r.washed_inspector_2 || r.inspector_2}</div>}
                    </td>

                    {/* Weaving Points */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', borderLeft: '1px solid var(--border-current)', color: w1 > 0 ? 'var(--color-primary)' : '#94a3b8', fontWeight: w1 > 0 ? '700' : '400' }}>{w1}</td>
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: w2 > 0 ? 'var(--color-primary)' : '#94a3b8', fontWeight: w2 > 0 ? '700' : '400' }}>{w2}</td>
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: w3 > 0 ? 'var(--color-primary)' : '#94a3b8', fontWeight: w3 > 0 ? '700' : '400' }}>{w3}</td>
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: w4 > 0 ? 'var(--color-primary)' : '#94a3b8', fontWeight: w4 > 0 ? '700' : '400' }}>{w4}</td>

                    {/* Yarn Points */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', borderLeft: '1px solid var(--border-current)', color: y1 > 0 ? 'var(--color-primary)' : '#94a3b8', fontWeight: y1 > 0 ? '700' : '400' }}>{y1}</td>
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: y4 > 0 ? 'var(--color-primary)' : '#94a3b8', fontWeight: y4 > 0 ? '700' : '400' }}>{y4}</td>

                    {/* Holes & Stains */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', borderLeft: '1px solid var(--border-current)', color: h2 > 0 ? 'var(--color-primary)' : '#94a3b8', fontWeight: h2 > 0 ? '700' : '400' }}>{h2}</td>
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: h4 > 0 ? 'var(--color-primary)' : '#94a3b8', fontWeight: h4 > 0 ? '700' : '400' }}>{h4}</td>

                    {/* Place */}
                    <td style={{ padding: '0.5rem 0.4rem', borderLeft: '1px solid var(--border-current)', fontSize: '0.7rem', color: 'var(--text-current)' }} title={placeStr}>
                      {placeStr}
                    </td>

                    {/* Edit */}
                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center' }}>
                      <button
                        onClick={() => setEditTarget({ roll: r, weavingOrder: w })}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '3px 8px',
                          border: '1.5px solid var(--color-primary)', borderRadius: '5px',
                          background: 'rgba(128,0,0,0.04)', color: 'var(--color-primary)',
                          fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary)'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(128,0,0,0.04)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                      >
                        <Edit3 size={10} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <WashedEditModal
          roll={editTarget.roll}
          weavingOrder={editTarget.weavingOrder}
          inspectors={inspectors}
          onClose={() => setEditTarget(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}

// ─── Placeholder tabs ─────────────────────────────────────────────────────────
function PlaceholderTab({ emoji, title, description }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '320px', gap: '1rem', color: 'var(--text-muted-current)' }}>
      <div style={{ fontSize: '3rem' }}>{emoji}</div>
      <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-current)' }}>{title}</div>
      <div style={{ fontSize: '0.85rem', maxWidth: '360px', textAlign: 'center' }}>{description}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const TABS = [
  { id: '4point', label: '4 Point', emoji: '🔍' },
  { id: 'unwashed', label: 'Unwashed', emoji: '🧶' },
  { id: 'washed', label: 'Washed', emoji: '🧼' },
];

export default function InspectionReport() {
  const [activeTab, setActiveTab] = useState('4point');

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%', fontFamily: 'var(--font-sans)' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-current)' }}>
        <div style={{ background: 'var(--color-primary)', color: 'white', padding: '0.5rem', borderRadius: '10px' }}>
          <FileText size={22} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-primary)', lineHeight: 1.1 }}>
            Inspection Report
          </h1>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Full Inspection Records & Analysis
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-current)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.65rem 1.25rem', border: 'none', background: 'none',
              fontSize: '0.875rem', fontWeight: activeTab === tab.id ? '800' : '500',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted-current)',
              cursor: 'pointer', position: 'relative', transition: 'all 0.15s',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-2px'
            }}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ animation: 'fadeIn 0.18s ease-out' }}>
        {activeTab === '4point' && <FourPointReportTab />}
        {activeTab === 'unwashed' && (
          <PlaceholderTab
            emoji="🧶"
            title="Unwashed Inspection Report"
            description="Unwashed inspection records will appear here once the module is active."
          />
        )}
        {activeTab === 'washed' && <WashedReportTab />}
      </div>
    </div>
  );
}
