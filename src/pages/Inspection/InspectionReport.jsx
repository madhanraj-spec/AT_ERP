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
  RefreshCw
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
        {activeTab === 'washed' && (
          <PlaceholderTab
            emoji="🧼"
            title="Washed Inspection Report"
            description="Washed inspection records will appear here once the module is active."
          />
        )}
      </div>
    </div>
  );
}
