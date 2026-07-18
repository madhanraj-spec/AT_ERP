import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Loader, Trash2, Edit3, X, Check, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Map URL parameters to titles and database tables
const MASTER_CONFIG = {
  'yarn-counts': { title: 'Yarn Counts', table: 'master_yarn_counts', icon: '🧵' },
  'brands': { title: 'Brands', table: 'master_brands', icon: '🏷️' },
  'partners': { title: 'Partners', table: 'master_partners', icon: '🤝' },
  'departments': { title: 'Departments', table: 'master_departments', icon: '🏢' },
  'machines': { title: 'Machines', table: 'master_machines', icon: '⚙️' },
  'locations': { title: 'Locations', table: 'master_locations', icon: '📍' },
  'beams': { title: 'Beams', table: 'master_beams', icon: '🎯' },
  'workers': { title: 'Workers', table: 'master_workers', icon: '👥' }
};

const DEFAULT_MATERIALS = [
  'COTTON', 'CP', 'CV', 'PC', 'SF', 'MODAL', 'LYCRA', 'SPUN POLY',
  'COTTON FLEX', 'LINEN', 'PV', 'POLYESTER', 'LINEN COTTON',
  'LINEN VISCOSE', 'COTTON LINEN'
];

const DEFAULT_COUNTS = [
  // 2-ply
  '2/30s', '2/32s', '2/40s', '2/41s', '2/42s', '2/60s', '2/62s', '2/80s',
  // 3-ply
  '3/6s', '3/10s', '3/12s',
  // Singles
  '4s', '8s', '10s', '11s', '12s', '15s', '16s',
  '20s', '21s', '24s', '30s', '32s',
  '40s', '42s', '50s', '60s', '61s', '80s', '100s',
];

const DEFAULT_SPEC1S = [
  'CL', 'COTTON FLEX', 'CP', 'CV',
  'HT',
  'LC', 'LEE', 'LYCRA', 'LV',
  'MEL', 'MODAL',
  'NEPS',
  'PC', 'POLY', 'POLY LINEN',
  'SF', 'SF FLEX', 'SF FLEX SLUB', 'SF SLUB', 'SLUB', 'SPUN POLY',
];

const DEFAULT_SPECS = [
  'CARDED',
  'CARDED COMPACT',
  'COMPACT',
  'COMBED',
  'COMBED COMPACT',
  'SEMI COMBED',
  'OE',
  'LENZING',
  'VORTEX ECOVERA',
  'ROTO DYED',
  'LYOCELL',
];

const DEFAULT_CONTENTS = [
  '100% Cotton',
  'CP(60/40)',
  'PV(67/33)',
  'CF(70/30)',
  'PC(65/35)',
  'LC(55/45)',
  'LYOCELL LINEN (50/50)',
  'CF(45/55)',
  'LV(55/45)',
  '100%SF',
  '100%POLY',
  '100%LYCRA',
  '100%MODAL',
];

const DEFAULT_TYPES = [
  'BCI',
  'GOTS',
  'GRS',
  'ORGANIC',
  'CONVENTIONAL',
];

export default function MasterDetail() {
  const { type } = useParams();
  const navigate = useNavigate();
  const config = MASTER_CONFIG[type];

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Cross-reference data for Machines
  const [departments, setDepartments] = useState([]);
  const [partners, setPartners] = useState([]);

  // Form State
  const [formData, setFormData] = useState({});

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Filter State (for Partners)
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterName, setFilterName] = useState('');

  useEffect(() => {
    if (!config) {
      navigate('/masters');
      return;
    }
    fetchData();
    if (type === 'machines' || type === 'workers') {
      fetchDependencies();
    }
    // Reset filters on type change
    setFilterType('');
    setFilterName('');
    setFilterOpen(false);
  }, [type]);

  // Compute filtered items (interdependent filters for Partners)
  const filteredItems = useMemo(() => {
    if (type !== 'partners') return items;
    return items.filter(item => {
      if (filterType && item.partner_type !== filterType) return false;
      if (filterName && item.partner_name !== filterName) return false;
      return true;
    });
  }, [items, filterType, filterName, type]);

  // Get unique partner types and names for filter dropdowns (interdependent)
  const partnerFilterTypes = useMemo(() => {
    if (type !== 'partners') return [];
    const typesSet = new Set();
    items.forEach(item => {
      if (filterName) {
        // Only show types that have the selected name
        if (item.partner_name === filterName) typesSet.add(item.partner_type);
      } else {
        typesSet.add(item.partner_type);
      }
    });
    return [...typesSet].filter(Boolean).sort();
  }, [items, filterName, type]);

  const partnerFilterNames = useMemo(() => {
    if (type !== 'partners') return [];
    const namesSet = new Set();
    items.forEach(item => {
      if (filterType) {
        // Only show names that match the selected type
        if (item.partner_type === filterType) namesSet.add(item.partner_name);
      } else {
        namesSet.add(item.partner_name);
      }
    });
    return [...namesSet].filter(Boolean).sort();
  }, [items, filterType, type]);

  const fetchData = async () => {
    setLoading(true);
    let selectQuery = '*';
    if (type === 'machines') {
      selectQuery = '*, master_departments(department_name), master_partners(partner_name)';
    } else if (type === 'workers') {
      selectQuery = '*, master_departments(department_name)';
    }
    const { data, error } = await supabase
      .from(config.table)
      .select(selectQuery)
      .order('created_at', { ascending: false });
    if (error) console.error("Fetch error:", error);
    else setItems(data || []);
    setLoading(false);
  };

  const fetchDependencies = async () => {
    const [deptRes, partsRes] = await Promise.all([
      supabase.from('master_departments').select('*'),
      supabase.from('master_partners').select('*')
    ]);
    if (deptRes.data) setDepartments(deptRes.data);
    if (partsRes.data) setPartners(partsRes.data);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this master entry? This action cannot be undone.")) return;
    
    setLoading(true);
    const { error } = await supabase.from(config.table).delete().eq('id', id);
    if (error) {
      alert("Error deleting record: " + error.message);
      setLoading(false);
    } else {
      fetchData();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ── Edit Handlers ──
  const handleEdit = (item) => {
    setEditingId(item.id);
    // Clone the item data for editing, stripping out joined relation objects
    const editData = { ...item };
    delete editData.master_departments;
    delete editData.master_partners;
    delete editData.id;
    delete editData.created_at;
    setEditFormData(editData);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({});
  };

  const handleUpdate = async () => {
    setEditSaving(true);
    let payload = { ...editFormData };

    // Set default scope for machines if not set
    if (type === 'machines' && !payload.scope) {
      payload.scope = 'in_house';
    }
    // Clear partner_id if scope is not job_work
    if (type === 'machines' && payload.scope !== 'job_work') {
      payload.partner_id = null;
    }

    // Duplicate check for yarn-counts (exclude the row being edited)
    if (type === 'yarn-counts') {
      const norm = (v) => (v || '').trim().toLowerCase();
      const isDuplicate = items.some(item =>
        item.id !== editingId &&
        norm(item.count_value)   === norm(payload.count_value) &&
        norm(item.spec1)         === norm(payload.spec1) &&
        norm(item.spec)          === norm(payload.spec) &&
        norm(item.material)      === norm(payload.material) &&
        norm(item.content)       === norm(payload.content) &&
        norm(item.product_type)  === norm(payload.product_type)
      );
      if (isDuplicate) {
        alert('This yarn count already exists! Duplicates are not allowed.');
        setEditSaving(false);
        return;
      }
    }

    const { error } = await supabase.from(config.table).update(payload).eq('id', editingId);
    setEditSaving(false);
    if (error) {
      if (error.code === '23505') {
        alert('This record already exists in the database! No duplicates allowed.');
      } else {
        alert('Error updating: ' + error.message);
      }
    } else {
      setEditingId(null);
      setEditFormData({});
      fetchData();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    let payload = { ...formData };

    // Set default scope for machines if not touched
    if (type === 'machines' && !payload.scope) {
      payload.scope = 'in_house';
    }

    // Duplicate check for yarn-counts
    if (type === 'yarn-counts') {
      const norm = (v) => (v || '').trim().toLowerCase();
      const isDuplicate = items.some(item =>
        norm(item.count_value)   === norm(payload.count_value) &&
        norm(item.spec1)         === norm(payload.spec1) &&
        norm(item.spec)          === norm(payload.spec) &&
        norm(item.material)      === norm(payload.material) &&
        norm(item.content)       === norm(payload.content) &&
        norm(item.product_type)  === norm(payload.product_type)
      );
      if (isDuplicate) {
        alert('This yarn count already exists! Duplicates are not allowed.');
        setSaving(false);
        return;
      }
    }

    const { data, error } = await supabase.from(config.table).insert([payload]);
    
    setSaving(false);
    if (error) {
      if (error.code === '23505') {
        alert("This record already exists in the database! No duplicates allowed.");
      } else {
        alert("Error saving: " + error.message);
      }
    } else {
      setFormData({}); // Reset
      fetchData(); // Refresh list
    }
  };

  if (!config) return null;

  // Render specific form fields based on type
  const renderFormFields = () => {
    switch (type) {
      case 'yarn-counts': {
        // Merge default materials with any custom ones already saved in DB
        const savedMaterials = [...new Set(items.map(i => i.material).filter(Boolean))];
        const allMaterials = [...new Set([...DEFAULT_MATERIALS, ...savedMaterials])];
        return (
          <>
            <div className="input-group">
              <label className="input-label">Material <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>(select or type new)</span></label>
              <input
                type="text"
                name="material"
                list="material-options"
                className="input-field"
                value={formData.material || ''}
                onChange={handleInputChange}
                placeholder="Select or type a material..."
                required
              />
              <datalist id="material-options">
                {allMaterials.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div className="input-group">
              <label className="input-label">Count <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>(select or type new)</span></label>
              <input
                type="text"
                name="count_value"
                list="count-options"
                className="input-field"
                value={formData.count_value || ''}
                onChange={handleInputChange}
                placeholder="Select or type a count..."
                required
              />
              <datalist id="count-options">
                {[...new Set([...DEFAULT_COUNTS, ...items.map(i => i.count_value).filter(Boolean)])].map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="input-group">
              <label className="input-label">Spec 1 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>(Optional — select or type new)</span></label>
              <input
                type="text"
                name="spec1"
                list="spec1-options"
                className="input-field"
                value={formData.spec1 || ''}
                onChange={handleInputChange}
                placeholder="Select or type spec 1..."
              />
              <datalist id="spec1-options">
                {[...new Set([...DEFAULT_SPEC1S, ...items.map(i => i.spec1).filter(Boolean)])].map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="input-group">
              <label className="input-label">Spec <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>(Optional — select or type new)</span></label>
              <input
                type="text"
                name="spec"
                list="spec-options"
                className="input-field"
                value={formData.spec || ''}
                onChange={handleInputChange}
                placeholder="Select or type a spec..."
              />
              <datalist id="spec-options">
                {[...new Set([...DEFAULT_SPECS, ...items.map(i => i.spec).filter(Boolean)])].map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div className="input-group">
              <label className="input-label">Content <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>(select or type new)</span></label>
              <input
                type="text"
                name="content"
                list="content-options"
                className="input-field"
                value={formData.content || ''}
                onChange={handleInputChange}
                placeholder="Select or type content..."
                required
              />
              <datalist id="content-options">
                {[...new Set([...DEFAULT_CONTENTS, ...items.map(i => i.content).filter(Boolean)])].map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="input-group">
              <label className="input-label">Type <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>(select or type new)</span></label>
              <input
                type="text"
                name="product_type"
                list="type-options"
                className="input-field"
                value={formData.product_type || ''}
                onChange={handleInputChange}
                placeholder="Select or type a type..."
                required
              />
              <datalist id="type-options">
                {[...new Set([...DEFAULT_TYPES, ...items.map(i => i.product_type).filter(Boolean)])].map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
          </>
        );
      }
      case 'brands':
        return (
          <div className="input-group">
            <label className="input-label">Brand / Vendor Name</label>
            <input type="text" name="brand_name" className="input-field" value={formData.brand_name || ''} onChange={handleInputChange} required />
          </div>
        );
      case 'partners':
        return (
          <>
            <div className="input-group">
              <label className="input-label">Partner Name</label>
              <input type="text" name="partner_name" className="input-field" value={formData.partner_name || ''} onChange={handleInputChange} required />
            </div>
            <div className="input-group">
              <label className="input-label">Partner Type</label>
              <select name="partner_type" className="input-field" value={formData.partner_type || ''} onChange={handleInputChange} required>
                <option value="">Select Type...</option>
                <option value="Spinning Mill">Spinning Mill</option>
                <option value="Weaving Mill">Weaving Mill</option>
                <option value="Dyeing Unit">Dyeing Unit</option>
                <option value="Processing Unit">Processing Unit</option>
                <option value="Warping Unit">Warping Unit</option>
                <option value="Sizing Unit">Sizing Unit</option>
                <option value="Twisting Unit">Twisting Unit</option>
                <option value="Transportation">Transportation</option>
                <option value="Vendor">Vendor</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">GSTIN (Optional)</label>
              <input type="text" name="gstin" className="input-field" value={formData.gstin || ''} onChange={handleInputChange} placeholder="e.g. 33AAACC1234A1Z1" maxLength={15} />
            </div>
            <div className="input-group">
              <label className="input-label">State (Optional)</label>
              <input type="text" name="state" className="input-field" value={formData.state || ''} onChange={handleInputChange} placeholder="e.g. TAMIL NADU" />
            </div>
            <div className="input-group">
              <label className="input-label">State Code (Optional)</label>
              <input type="text" name="state_code" className="input-field" value={formData.state_code || ''} onChange={handleInputChange} placeholder="e.g. 33" maxLength={2} />
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">Address (Optional)</label>
              <textarea name="address" className="input-field" value={formData.address || ''} onChange={handleInputChange} placeholder="Full billing address..." rows={3} style={{ resize: 'vertical' }} />
            </div>
          </>
        );
      case 'departments':
        return (
          <div className="input-group">
            <label className="input-label">Department Name (e.g. Warping, Weaving)</label>
            <input type="text" name="department_name" className="input-field" value={formData.department_name || ''} onChange={handleInputChange} required />
          </div>
        );
      case 'machines':
        return (
          <>
            <div className="input-group">
              <label className="input-label">Machine Name</label>
              <input type="text" name="machine_name" className="input-field" value={formData.machine_name || ''} onChange={handleInputChange} required />
            </div>
            <div className="input-group">
              <label className="input-label">Allot to Department</label>
              <select name="department_id" className="input-field" value={formData.department_id || ''} onChange={handleInputChange} required>
                <option value="">Select Department...</option>
                {departments
                  .filter(d => ['WARPING', 'SIZING', 'WEAVING'].includes(d.department_name.toUpperCase()))
                  .map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
              </select>
            </div>
            <div className="input-group" style={{ flexDirection: 'row', gap: '1rem', alignItems: 'center', margin: '1rem 0' }}>
              <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="scope" value="in_house" checked={formData.scope !== 'job_work'} onChange={handleInputChange} />
                In-House
              </label>
              <label style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="scope" value="job_work" checked={formData.scope === 'job_work'} onChange={handleInputChange} />
                Job Work
              </label>
            </div>
            {formData.scope === 'job_work' && (
              <div className="input-group fade-in">
                <label className="input-label">Assign to Partner</label>
                <select name="partner_id" className="input-field" value={formData.partner_id || ''} onChange={handleInputChange} required>
                  <option value="">Select Partner...</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.partner_name} ({p.partner_type})</option>)}
                </select>
              </div>
            )}
          </>
        );
      case 'locations':
        return (
          <>
            <div className="input-group">
              <label className="input-label">Warehouse Type</label>
              <select name="warehouse_type" className="input-field" value={formData.warehouse_type || ''} onChange={handleInputChange} required>
                <option value="">Select Type...</option>
                <option value="Greige Warehouse">Greige Warehouse</option>
                <option value="Dyed Yarn Warehouse">Dyed Yarn Warehouse</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Location Name</label>
              <input type="text" name="location_name" className="input-field" value={formData.location_name || ''} onChange={handleInputChange} required />
            </div>
          </>
        );
      case 'beams':
        return (
          <>
            <div className="input-group">
              <label className="input-label">Beam Name / Identification</label>
              <input type="text" name="beam_name" className="input-field" value={formData.beam_name || ''} onChange={handleInputChange} required />
            </div>
            <div className="input-group">
              <label className="input-label">Owner</label>
              <input type="text" name="owner" className="input-field" value={formData.owner || ''} onChange={handleInputChange} placeholder="e.g. Company / In-House" />
            </div>
            <div className="input-group">
              <label className="input-label">Weight (kg)</label>
              <input type="number" name="weight" className="input-field" value={formData.weight || ''} onChange={handleInputChange} step="0.01" min="0" placeholder="Beam weight in kg" />
            </div>
          </>
        );
      case 'workers':
        return (
          <>
            <div className="input-group">
              <label className="input-label">Worker Name</label>
              <input type="text" name="worker_name" className="input-field" value={formData.worker_name || ''} onChange={handleInputChange} required />
            </div>
            <div className="input-group">
              <label className="input-label">Assign to Department</label>
              <select name="department_id" className="input-field" value={formData.department_id || ''} onChange={handleInputChange} required>
                <option value="">Select Department...</option>
                {departments
                  .filter(d => ['YARN', 'WARPING', 'SIZING', 'WEAVING', 'INSPECTION'].includes(d.department_name.toUpperCase()))
                  .map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
              </select>
            </div>
          </>
        );
      default: return null;
    }
  };

  // ── Render Inline Edit Fields for each master type ──
  const renderEditFields = (item) => {
    const inputStyle = {
      padding: '0.5rem 0.75rem',
      border: '1px solid var(--border-current)',
      borderRadius: 'var(--radius-sm)',
      fontSize: '0.8125rem',
      backgroundColor: 'var(--surface-current)',
      color: 'var(--text-current)',
      width: '100%',
      boxSizing: 'border-box',
    };
    const labelStyle = {
      fontSize: '0.6875rem',
      fontWeight: '600',
      color: 'var(--text-muted-current)',
      marginBottom: '0.25rem',
      display: 'block',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    };
    const fieldWrap = { display: 'flex', flexDirection: 'column', flex: '1', minWidth: '120px' };

    switch (type) {
      case 'yarn-counts': {
        const savedMaterials = [...new Set(items.map(i => i.material).filter(Boolean))];
        const allMaterials = [...new Set([...DEFAULT_MATERIALS, ...savedMaterials])];
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Material</label>
              <input type="text" name="material" list="edit-material-options" style={inputStyle} value={editFormData.material || ''} onChange={handleEditChange} />
              <datalist id="edit-material-options">{allMaterials.map(m => <option key={m} value={m} />)}</datalist>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Count</label>
              <input type="text" name="count_value" list="edit-count-options" style={inputStyle} value={editFormData.count_value || ''} onChange={handleEditChange} />
              <datalist id="edit-count-options">{[...new Set([...DEFAULT_COUNTS, ...items.map(i => i.count_value).filter(Boolean)])].map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Spec 1</label>
              <input type="text" name="spec1" list="edit-spec1-options" style={inputStyle} value={editFormData.spec1 || ''} onChange={handleEditChange} />
              <datalist id="edit-spec1-options">{[...new Set([...DEFAULT_SPEC1S, ...items.map(i => i.spec1).filter(Boolean)])].map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Spec</label>
              <input type="text" name="spec" list="edit-spec-options" style={inputStyle} value={editFormData.spec || ''} onChange={handleEditChange} />
              <datalist id="edit-spec-options">{[...new Set([...DEFAULT_SPECS, ...items.map(i => i.spec).filter(Boolean)])].map(s => <option key={s} value={s} />)}</datalist>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Content</label>
              <input type="text" name="content" list="edit-content-options" style={inputStyle} value={editFormData.content || ''} onChange={handleEditChange} />
              <datalist id="edit-content-options">{[...new Set([...DEFAULT_CONTENTS, ...items.map(i => i.content).filter(Boolean)])].map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Type</label>
              <input type="text" name="product_type" list="edit-type-options" style={inputStyle} value={editFormData.product_type || ''} onChange={handleEditChange} />
              <datalist id="edit-type-options">{[...new Set([...DEFAULT_TYPES, ...items.map(i => i.product_type).filter(Boolean)])].map(t => <option key={t} value={t} />)}</datalist>
            </div>
          </div>
        );
      }
      case 'brands':
        return (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Brand Name</label>
              <input type="text" name="brand_name" style={inputStyle} value={editFormData.brand_name || ''} onChange={handleEditChange} />
            </div>
          </div>
        );
      case 'partners':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Partner Name</label>
              <input type="text" name="partner_name" style={inputStyle} value={editFormData.partner_name || ''} onChange={handleEditChange} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Type</label>
              <select name="partner_type" style={inputStyle} value={editFormData.partner_type || ''} onChange={handleEditChange}>
                <option value="">Select...</option>
                <option value="Spinning Mill">Spinning Mill</option>
                <option value="Weaving Mill">Weaving Mill</option>
                <option value="Dyeing Unit">Dyeing Unit</option>
                <option value="Processing Unit">Processing Unit</option>
                <option value="Warping Unit">Warping Unit</option>
                <option value="Sizing Unit">Sizing Unit</option>
                <option value="Twisting Unit">Twisting Unit</option>
                <option value="Transportation">Transportation</option>
                <option value="Vendor">Vendor</option>
              </select>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>GSTIN</label>
              <input type="text" name="gstin" style={inputStyle} value={editFormData.gstin || ''} onChange={handleEditChange} maxLength={15} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>State</label>
              <input type="text" name="state" style={inputStyle} value={editFormData.state || ''} onChange={handleEditChange} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>State Code</label>
              <input type="text" name="state_code" style={inputStyle} value={editFormData.state_code || ''} onChange={handleEditChange} maxLength={2} />
            </div>
            <div style={{ ...fieldWrap, width: '100%' }}>
              <label style={labelStyle}>Address</label>
              <textarea name="address" style={{ ...inputStyle, resize: 'vertical' }} value={editFormData.address || ''} onChange={handleEditChange} rows={2} />
            </div>
          </div>
        );
      case 'departments':
        return (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Department Name</label>
              <input type="text" name="department_name" style={inputStyle} value={editFormData.department_name || ''} onChange={handleEditChange} />
            </div>
          </div>
        );
      case 'machines':
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Machine Name</label>
              <input type="text" name="machine_name" style={inputStyle} value={editFormData.machine_name || ''} onChange={handleEditChange} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Department</label>
              <select name="department_id" style={inputStyle} value={editFormData.department_id || ''} onChange={handleEditChange}>
                <option value="">Select...</option>
                {departments
                  .filter(d => ['WARPING', 'SIZING', 'WEAVING'].includes(d.department_name.toUpperCase()))
                  .map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
              </select>
            </div>
            <div style={{ ...fieldWrap, flexDirection: 'row', gap: '0.75rem', alignItems: 'center', minWidth: 'auto' }}>
              <label style={{ display: 'flex', gap: '0.35rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                <input type="radio" name="scope" value="in_house" checked={editFormData.scope !== 'job_work'} onChange={handleEditChange} />
                In-House
              </label>
              <label style={{ display: 'flex', gap: '0.35rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                <input type="radio" name="scope" value="job_work" checked={editFormData.scope === 'job_work'} onChange={handleEditChange} />
                Job Work
              </label>
            </div>
            {editFormData.scope === 'job_work' && (
              <div style={fieldWrap}>
                <label style={labelStyle}>Partner</label>
                <select name="partner_id" style={inputStyle} value={editFormData.partner_id || ''} onChange={handleEditChange}>
                  <option value="">Select...</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.partner_name} ({p.partner_type})</option>)}
                </select>
              </div>
            )}
          </div>
        );
      case 'locations':
        return (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Warehouse Type</label>
              <select name="warehouse_type" style={inputStyle} value={editFormData.warehouse_type || ''} onChange={handleEditChange}>
                <option value="">Select...</option>
                <option value="Greige Warehouse">Greige Warehouse</option>
                <option value="Dyed Yarn Warehouse">Dyed Yarn Warehouse</option>
              </select>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Location Name</label>
              <input type="text" name="location_name" style={inputStyle} value={editFormData.location_name || ''} onChange={handleEditChange} />
            </div>
          </div>
        );
      case 'beams':
        return (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Beam Name</label>
              <input type="text" name="beam_name" style={inputStyle} value={editFormData.beam_name || ''} onChange={handleEditChange} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Owner</label>
              <input type="text" name="owner" style={inputStyle} value={editFormData.owner || ''} onChange={handleEditChange} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Weight (kg)</label>
              <input type="number" name="weight" style={inputStyle} value={editFormData.weight || ''} onChange={handleEditChange} step="0.01" min="0" />
            </div>
          </div>
        );
      case 'workers':
        return (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={fieldWrap}>
              <label style={labelStyle}>Worker Name</label>
              <input type="text" name="worker_name" style={inputStyle} value={editFormData.worker_name || ''} onChange={handleEditChange} />
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>Department</label>
              <select name="department_id" style={inputStyle} value={editFormData.department_id || ''} onChange={handleEditChange}>
                <option value="">Select...</option>
                {departments
                  .filter(d => ['YARN', 'WARPING', 'SIZING', 'WEAVING', 'INSPECTION'].includes(d.department_name.toUpperCase()))
                  .map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
              </select>
            </div>
          </div>
        );
      default: return null;
    }
  };

  // Render Display Rows for existing items
  const renderRow = (item) => {
    switch (type) {
      case 'yarn-counts': {
        const parts = [item.count_value];
        if (item.spec1) parts.push(item.spec1);
        if (item.spec) parts.push(item.spec);
        if (item.material) parts.push(item.material);
        if (item.content) parts.push(item.content);
        if (item.product_type) parts.push(item.product_type);
        return parts.join(' | ');
      }
      case 'brands': return item.brand_name;
      case 'partners': {
        const parts = [`${item.partner_name} [${item.partner_type}]`        ];
        if (item.gstin) parts.push(`GST: ${item.gstin}`);
        if (item.state) parts.push(`State: ${item.state} (${item.state_code || '-'})`);
        if (item.address) parts.push(`Addr: ${item.address}`);
        return parts.join(' | ');
      }
      case 'departments': return item.department_name;
      case 'machines': {
        const deptName = item.master_departments?.department_name || 'N/A';
        if (item.scope === 'job_work') {
          const partnerName = item.master_partners?.partner_name || 'N/A';
          return `${item.machine_name} - [Dept: ${deptName}] (Job Work - ${partnerName})`;
        }
        return `${item.machine_name} - [Dept: ${deptName}] (In-House)`;
      }
      case 'locations': return `[${item.warehouse_type}] ${item.location_name}`;
      case 'beams': {
        const parts = [item.beam_name];
        if (item.owner) parts.push(`Owner: ${item.owner}`);
        if (item.weight) parts.push(`${Number(item.weight).toFixed(2)} kg`);
        return parts.join(' — ');
      }
      case 'workers': {
        const deptName = item.master_departments?.department_name || 'N/A';
        return `${item.worker_name} — [Dept: ${deptName}]`;
      }
      default: return JSON.stringify(item);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }} className="fade-in">
      
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <button 
          onClick={() => navigate('/masters')} 
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={16} />
          Back to Masters
        </button>
        <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0', color: 'var(--text-current)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {config.icon} Manage {config.title}
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* ADD NEW FORM */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', color: 'var(--color-primary)' }}>
            <Plus size={18} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }}/>
            Add New {config.title.slice(0, -1)}
          </h2>
          <form onSubmit={handleSubmit}>
            {renderFormFields()}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }} disabled={saving}>
              {saving ? <Loader size={16} className="spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save to Database'}
            </button>
          </form>
        </div>

        {/* EXISTING ITEMS LIST */}
        <div className="glass-panel" style={{ padding: 0 }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)', backgroundColor: 'var(--bg-current)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Existing Database Entries</h2>
              {type === 'partners' && items.length > 0 && (
                <button
                  onClick={() => setFilterOpen(prev => !prev)}
                  style={{
                    background: (filterType || filterName) ? 'var(--color-primary)' : 'var(--surface-current)',
                    color: (filterType || filterName) ? '#fff' : 'var(--text-muted-current)',
                    border: (filterType || filterName) ? 'none' : '1px solid var(--border-current)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.35rem 0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.8125rem',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Filter size={14} />
                  Filter
                  {(filterType || filterName) && (
                    <span style={{
                      background: '#fff',
                      color: 'var(--color-primary)',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6875rem',
                      fontWeight: '700',
                      marginLeft: '0.15rem'
                    }}>
                      {(filterType ? 1 : 0) + (filterName ? 1 : 0)}
                    </span>
                  )}
                  {filterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
            </div>

            {/* Expandable Filter Panel for Partners */}
            {type === 'partners' && filterOpen && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'var(--surface-current)',
                border: '1px solid var(--border-current)',
                borderRadius: 'var(--radius-md)',
                animation: 'fadeIn 0.2s ease'
              }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1', minWidth: '180px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.6875rem',
                      fontWeight: '700',
                      color: 'var(--text-muted-current)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.35rem'
                    }}>Partner Type</label>
                    <select
                      value={filterType}
                      onChange={(e) => {
                        setFilterType(e.target.value);
                        // If a name was selected that doesn't match the new type, clear it
                        if (filterName && e.target.value) {
                          const match = items.find(i => i.partner_name === filterName && i.partner_type === e.target.value);
                          if (!match) setFilterName('');
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid var(--border-current)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8125rem',
                        backgroundColor: 'var(--bg-current)',
                        color: 'var(--text-current)',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">All Types</option>
                      {partnerFilterTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div style={{ flex: '1', minWidth: '180px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.6875rem',
                      fontWeight: '700',
                      color: 'var(--text-muted-current)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.35rem'
                    }}>Partner Name</label>
                    <select
                      value={filterName}
                      onChange={(e) => {
                        setFilterName(e.target.value);
                        // Auto-fill type if a name is selected and only one type matches
                        if (e.target.value && !filterType) {
                          const matchingTypes = [...new Set(items.filter(i => i.partner_name === e.target.value).map(i => i.partner_type))];
                          if (matchingTypes.length === 1) setFilterType(matchingTypes[0]);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid var(--border-current)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8125rem',
                        backgroundColor: 'var(--bg-current)',
                        color: 'var(--text-current)',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">All Names</option>
                      {partnerFilterNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  <button
                    onClick={() => { setFilterType(''); setFilterName(''); }}
                    disabled={!filterType && !filterName}
                    style={{
                      background: 'none',
                      color: (filterType || filterName) ? '#dc2626' : 'var(--text-muted-current)',
                      border: '1px solid ' + ((filterType || filterName) ? '#fca5a5' : 'var(--border-current)'),
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 0.75rem',
                      cursor: (filterType || filterName) ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      opacity: (filterType || filterName) ? 1 : 0.5,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <X size={14} /> Clear Filters
                  </button>
                </div>

                {/* Filter summary */}
                {(filterType || filterName) && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'rgba(128, 0, 0, 0.04)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted-current)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    Showing <strong style={{ color: 'var(--text-current)' }}>{filteredItems.length}</strong> of <strong style={{ color: 'var(--text-current)' }}>{items.length}</strong> partners
                    {filterType && <span style={{ background: 'var(--color-primary)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: '600' }}>{filterType}</span>}
                    {filterName && <span style={{ background: '#2563eb', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: '600' }}>{filterName}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ padding: '1rem' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>
                <Loader size={24} className="spin" style={{ margin: '0 auto 1rem' }} /> Loading...
              </div>
            ) : (type === 'partners' ? filteredItems : items).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>
                {type === 'partners' && (filterType || filterName)
                  ? `No partners found matching the selected filters.`
                  : `No ${config.title.toLowerCase()} found in the database.`
                }
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(type === 'partners' ? filteredItems : items).map(item => (
                  <li key={item.id} style={{ 
                    padding: '0.75rem 1rem', 
                    backgroundColor: editingId === item.id ? 'var(--surface-current)' : 'var(--bg-current)', 
                    border: editingId === item.id ? '2px solid var(--color-primary)' : '1px solid var(--border-current)', 
                    borderRadius: 'var(--radius-md)', 
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease'
                  }}>
                    {editingId === item.id ? (
                      /* ── Inline Edit Mode ── */
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            ✏️ Editing
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={handleUpdate}
                              disabled={editSaving}
                              style={{
                                background: 'var(--color-primary)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.35rem 0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.8125rem',
                                fontWeight: '600',
                                opacity: editSaving ? 0.7 : 1
                              }}
                              title="Save Changes"
                            >
                              {editSaving ? <Loader size={14} className="spin" /> : <Check size={14} />}
                              {editSaving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={editSaving}
                              style={{
                                background: 'var(--bg-current)',
                                color: 'var(--text-muted-current)',
                                border: '1px solid var(--border-current)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.35rem 0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.8125rem',
                                fontWeight: '600'
                              }}
                              title="Cancel Edit"
                            >
                              <X size={14} /> Cancel
                            </button>
                          </div>
                        </div>
                        {renderEditFields(item)}
                      </div>
                    ) : (
                      /* ── Display Mode ── */
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '500' }}>{renderRow(item)}</span>
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          <button 
                            onClick={() => handleEdit(item)}
                            className="hover-lift"
                            style={{ 
                              background: '#eff6ff', 
                              color: '#2563eb', 
                              border: '1px solid #93c5fd', 
                              borderRadius: 'var(--radius-sm)', 
                              padding: '0.25rem 0.5rem', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Edit Master Entry"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="hover-lift"
                            style={{ 
                              background: '#fee2e2', 
                              color: '#dc2626', 
                              border: '1px solid #fca5a5', 
                              borderRadius: 'var(--radius-sm)', 
                              padding: '0.25rem 0.5rem', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Delete Master Entry"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
