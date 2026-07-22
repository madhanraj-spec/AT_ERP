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

const PARTNER_TABS = [
  { id: 'all', label: 'All Partners', match: null },
  { id: 'dyeing', label: 'Dyeing', match: 'Dyeing Unit' },
  { id: 'spinning', label: 'Spinning', match: 'Spinning Mill' },
  { id: 'processing', label: 'Processing', match: 'Processing Unit' },
  { id: 'weaving', label: 'Weaving', match: 'Weaving Mill' },
  { id: 'sizing', label: 'Sizing', match: 'Sizing Unit' },
  { id: 'warping', label: 'Warping', match: 'Warping Unit' },
  { id: 'vendor', label: 'Vendor', match: 'Vendor' }
];

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

function SearchMultiSelect({ label, options, selected, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = React.useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    return options.filter(option =>
      String(option).toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const toggleOption = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter(x => x !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = () => {
    const newSelected = [...new Set([...selected, ...filteredOptions])];
    onChange(newSelected);
  };

  const handleClearAll = () => {
    const newSelected = selected.filter(x => !filteredOptions.includes(x));
    onChange(newSelected);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', textAlign: 'left' }}>
      <label style={{
        display: 'block',
        fontSize: '0.6875rem',
        fontWeight: '700',
        color: 'var(--text-muted-current)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.35rem'
      }}>{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          border: '1px solid var(--border-current)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8125rem',
          backgroundColor: 'var(--bg-current)',
          color: 'var(--text-current)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '36px',
          userSelect: 'none'
        }}
      >
        <span style={{ 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          marginRight: '0.5rem',
          maxWidth: '180px'
        }}>
          {selected.length === 0 
            ? `All ${label}s` 
            : selected.join(', ')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {selected.length > 0 && (
            <span style={{
              background: 'var(--color-primary)',
              color: '#fff',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6875rem',
              fontWeight: '700'
            }}>
              {selected.length}
            </span>
          )}
          <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </div>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '0.25rem',
          backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 100,
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxHeight: '280px'
        }}>
          <input
            type="text"
            placeholder={placeholder || "Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              padding: '0.375rem 0.5rem',
              border: '1px solid var(--border-current)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              backgroundColor: 'var(--bg-current)',
              color: 'var(--text-current)',
              outline: 'none'
            }}
          />
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontSize: '0.6875rem', 
            padding: '0 0.25rem',
            color: 'var(--color-primary)',
            fontWeight: '600'
          }}>
            <span onClick={(e) => { e.stopPropagation(); handleSelectAll(); }} style={{ cursor: 'pointer' }}>Select All</span>
            <span onClick={(e) => { e.stopPropagation(); handleClearAll(); }} style={{ cursor: 'pointer', color: 'var(--text-muted-current)' }}>Clear</span>
          </div>
          <div style={{ 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.25rem',
            paddingRight: '2px'
          }}>
            {filteredOptions.length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', padding: '0.5rem 0', textAlign: 'center' }}>No options found</span>
            ) : (
              filteredOptions.map(option => {
                const isChecked = selected.includes(option);
                return (
                  <label 
                    key={option} 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.35rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      color: 'var(--text-current)',
                      backgroundColor: isChecked ? 'rgba(128, 0, 0, 0.05)' : 'transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(128, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(128, 0, 0, 0.05)' : 'transparent'}
                  >
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={() => toggleOption(option)}
                      style={{ 
                        accentColor: 'var(--color-primary)',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{option}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [filterTypes, setFilterTypes] = useState([]);
  const [filterNames, setFilterNames] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

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
    setFilterTypes([]);
    setFilterNames([]);
    setFilterOpen(false);
    setShowAddModal(false);
    setActiveTab('all');
  }, [type]);

  // Compute tab-filtered items first
  const tabFilteredItems = useMemo(() => {
    if (type !== 'partners') return items;
    if (activeTab === 'all') return items;
    const tabMatch = PARTNER_TABS.find(t => t.id === activeTab)?.match;
    if (!tabMatch) return items;
    return items.filter(item => item.partner_type === tabMatch);
  }, [items, activeTab, type]);

  // Compute filtered items (interdependent filters for Partners)
  const filteredItems = useMemo(() => {
    if (type !== 'partners') return items;
    return tabFilteredItems.filter(item => {
      if (filterTypes.length > 0 && !filterTypes.includes(item.partner_type)) return false;
      if (filterNames.length > 0 && !filterNames.includes(item.partner_name)) return false;
      return true;
    });
  }, [tabFilteredItems, filterTypes, filterNames, type]);

  // Get unique partner types and names for filter dropdowns (interdependent)
  const partnerFilterTypes = useMemo(() => {
    if (type !== 'partners') return [];
    const typesSet = new Set();
    tabFilteredItems.forEach(item => {
      if (filterNames.length > 0) {
        // Only show types that correspond to the selected names
        if (filterNames.includes(item.partner_name)) typesSet.add(item.partner_type);
      } else {
        typesSet.add(item.partner_type);
      }
    });
    return [...typesSet].filter(Boolean).sort();
  }, [tabFilteredItems, filterNames, type]);

  const partnerFilterNames = useMemo(() => {
    if (type !== 'partners') return [];
    const namesSet = new Set();
    tabFilteredItems.forEach(item => {
      if (filterTypes.length > 0) {
        // Only show names that correspond to the selected types
        if (filterTypes.includes(item.partner_type)) namesSet.add(item.partner_name);
      } else {
        namesSet.add(item.partner_name);
      }
    });
    return [...namesSet].filter(Boolean).sort();
  }, [tabFilteredItems, filterTypes, type]);

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
      if (type === 'partners') {
        setShowAddModal(false);
      }
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="input-group" style={{ gridColumn: 'span 2' }}>
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
            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Pincode (Optional)</label>
              <input type="text" name="pincode" className="input-field" value={formData.pincode || ''} onChange={handleInputChange} placeholder="e.g. 636001" maxLength={6} />
            </div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label className="input-label">Address (Optional)</label>
              <textarea name="address" className="input-field" value={formData.address || ''} onChange={handleInputChange} placeholder="Full billing address..." rows={3} style={{ resize: 'vertical' }} />
            </div>
          </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', textAlign: 'left' }}>
            <div>
              <label style={{ ...labelStyle, marginBottom: '0.15rem' }}>Partner Name</label>
              <input type="text" name="partner_name" style={{ ...inputStyle, width: '100%' }} value={editFormData.partner_name || ''} onChange={handleEditChange} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ ...labelStyle, marginBottom: '0.15rem' }}>Type</label>
                <select name="partner_type" style={{ ...inputStyle, width: '100%' }} value={editFormData.partner_type || ''} onChange={handleEditChange}>
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
              <div>
                <label style={{ ...labelStyle, marginBottom: '0.15rem' }}>GSTIN</label>
                <input type="text" name="gstin" style={{ ...inputStyle, width: '100%' }} value={editFormData.gstin || ''} onChange={handleEditChange} maxLength={15} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ ...labelStyle, marginBottom: '0.15rem' }}>State</label>
                <input type="text" name="state" style={{ ...inputStyle, width: '100%' }} value={editFormData.state || ''} onChange={handleEditChange} />
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: '0.15rem' }}>State Code</label>
                <input type="text" name="state_code" style={{ ...inputStyle, width: '100%' }} value={editFormData.state_code || ''} onChange={handleEditChange} maxLength={2} />
              </div>
            </div>
            <div>
              <label style={{ ...labelStyle, marginBottom: '0.15rem' }}>Pincode</label>
              <input type="text" name="pincode" style={{ ...inputStyle, width: '100%' }} value={editFormData.pincode || ''} onChange={handleEditChange} maxLength={6} />
            </div>
            <div>
              <label style={{ ...labelStyle, marginBottom: '0.15rem' }}>Address</label>
              <textarea name="address" style={{ ...inputStyle, width: '100%', resize: 'vertical' }} value={editFormData.address || ''} onChange={handleEditChange} rows={2} />
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

  const renderPartnerTabs = () => {
    return (
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        borderBottom: '1px solid var(--border-current)', 
        paddingBottom: '0.75rem', 
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        marginBottom: '1rem'
      }}>
        {PARTNER_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setFilterTypes([]);
              }}
              style={{
                background: isActive ? 'var(--color-primary)' : 'var(--surface-current)',
                color: isActive ? '#fff' : 'var(--text-muted-current)',
                border: isActive ? 'none' : '1px solid var(--border-current)',
                borderRadius: 'var(--radius-full)',
                padding: '0.5rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = 'var(--border-current)';
              }}
            >
              {tab.label}
              <span style={{
                background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                color: isActive ? '#fff' : 'var(--text-muted-current)',
                fontSize: '0.75rem',
                padding: '0.05rem 0.4rem',
                borderRadius: '999px',
                fontWeight: '700'
              }}>
                {tab.id === 'all' 
                  ? items.length 
                  : items.filter(item => item.partner_type === tab.match).length
                }
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: type === 'partners' ? '1200px' : '1000px', margin: '0 auto', padding: '1rem' }} className="fade-in">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <button 
            onClick={() => navigate('/masters')} 
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.75rem' }}
          >
            <ArrowLeft size={16} />
            Back to Masters
          </button>
          <h1 style={{ fontSize: '1.75rem', margin: 0, color: 'var(--text-current)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {config.icon} Manage {config.title}
          </h1>
        </div>
        {type === 'partners' && (
          <button 
            onClick={() => {
              setFormData({}); // Clear form data
              setShowAddModal(true);
            }}
            className="btn btn-primary"
            style={{ padding: '0.625rem 1.25rem', boxShadow: 'var(--shadow-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={18} />
            Add Partner
          </button>
        )}
      </div>

      {type === 'partners' ? (
        /* ── Partners Full-Width Layout ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Tabs for Category Selection */}
          {renderPartnerTabs()}

          {/* Listing & Filters card */}
          <div className="glass-panel" style={{ padding: 0 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)', backgroundColor: 'var(--bg-current)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Existing Database Entries</h2>
                {items.length > 0 && (
                  <button
                    onClick={() => setFilterOpen(prev => !prev)}
                    style={{
                      background: (filterTypes.length > 0 || filterNames.length > 0) ? 'var(--color-primary)' : 'var(--surface-current)',
                      color: (filterTypes.length > 0 || filterNames.length > 0) ? '#fff' : 'var(--text-muted-current)',
                      border: (filterTypes.length > 0 || filterNames.length > 0) ? 'none' : '1px solid var(--border-current)',
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
                    {(filterTypes.length > 0 || filterNames.length > 0) && (
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
                        {filterTypes.length + filterNames.length}
                      </span>
                    )}
                    {filterOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>

              {/* Expandable Filter Panel */}
              {filterOpen && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: 'var(--surface-current)',
                  border: '1px solid var(--border-current)',
                  borderRadius: 'var(--radius-md)',
                  animation: 'fadeIn 0.2s ease'
                }}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <SearchMultiSelect
                        label="Partner Type"
                        options={partnerFilterTypes}
                        selected={filterTypes}
                        onChange={setFilterTypes}
                        placeholder="Search types..."
                      />
                    </div>

                    <div style={{ flex: '1', minWidth: '200px' }}>
                      <SearchMultiSelect
                        label="Partner Name"
                        options={partnerFilterNames}
                        selected={filterNames}
                        onChange={setFilterNames}
                        placeholder="Search names..."
                      />
                    </div>

                    <button
                      onClick={() => { setFilterTypes([]); setFilterNames([]); }}
                      disabled={filterTypes.length === 0 && filterNames.length === 0}
                      style={{
                        background: 'none',
                        color: (filterTypes.length > 0 || filterNames.length > 0) ? '#dc2626' : 'var(--text-muted-current)',
                        border: '1px solid ' + ((filterTypes.length > 0 || filterNames.length > 0) ? '#fca5a5' : 'var(--border-current)'),
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.5rem 0.75rem',
                        cursor: (filterTypes.length > 0 || filterNames.length > 0) ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        opacity: (filterTypes.length > 0 || filterNames.length > 0) ? 1 : 0.5,
                        whiteSpace: 'nowrap',
                        height: '36px'
                      }}
                    >
                      <X size={14} /> Clear Filters
                    </button>
                  </div>

                  {/* Filter summary */}
                  {(filterTypes.length > 0 || filterNames.length > 0) && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'rgba(128, 0, 0, 0.04)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted-current)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap'
                    }}>
                      Showing <strong style={{ color: 'var(--text-current)' }}>{filteredItems.length}</strong> of <strong style={{ color: 'var(--text-current)' }}>{items.length}</strong> partners
                      {filterTypes.map(t => (
                        <span key={t} style={{ background: 'var(--color-primary)', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          {t}
                          <X size={10} style={{ cursor: 'pointer' }} onClick={() => setFilterTypes(filterTypes.filter(x => x !== t))} />
                        </span>
                      ))}
                      {filterNames.map(n => (
                        <span key={n} style={{ background: '#2563eb', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.6875rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          {n}
                          <X size={10} style={{ cursor: 'pointer' }} onClick={() => setFilterNames(filterNames.filter(x => x !== n))} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: '1.25rem' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>
                  <Loader size={24} className="spin" style={{ margin: '0 auto 1rem' }} /> Loading...
                </div>
              ) : filteredItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>
                  {filterTypes.length > 0 || filterNames.length > 0 || activeTab !== 'all'
                    ? `No partners found matching the selected filters.`
                    : `No partners found in the database.`
                  }
                </div>
              ) : (
                /* Card layout for partners */
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1.25rem',
                  marginTop: '0.5rem'
                }}>
                  {filteredItems.map(item => {
                    const isEditing = editingId === item.id;
                    const badge = (() => {
                      const colors = {
                        'Spinning Mill': { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: 'rgba(16, 185, 129, 0.2)' },
                        'Weaving Mill': { bg: 'rgba(37, 99, 235, 0.1)', text: '#2563eb', border: 'rgba(37, 99, 235, 0.2)' },
                        'Dyeing Unit': { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.2)' },
                        'Processing Unit': { bg: 'rgba(236, 72, 153, 0.1)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.2)' },
                        'Warping Unit': { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.2)' },
                        'Sizing Unit': { bg: 'rgba(20, 184, 166, 0.1)', text: '#14b8a6', border: 'rgba(20, 184, 166, 0.2)' },
                        'Twisting Unit': { bg: 'rgba(14, 165, 233, 0.1)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.2)' },
                        'Transportation': { bg: 'rgba(107, 114, 128, 0.1)', text: '#6b7280', border: 'rgba(107, 114, 128, 0.2)' },
                        'Vendor': { bg: 'rgba(128, 0, 0, 0.1)', text: 'var(--color-primary)', border: 'rgba(128, 0, 0, 0.2)' },
                      };
                      return colors[item.partner_type] || { bg: 'rgba(128, 0, 0, 0.1)', text: 'var(--color-primary)', border: 'rgba(128, 0, 0, 0.2)' };
                    })();

                    return (
                      <div 
                        key={item.id} 
                        className={isEditing ? "" : "hover-lift"}
                        style={{ 
                          padding: '1.25rem', 
                          backgroundColor: isEditing ? 'var(--surface-current)' : 'var(--bg-current)', 
                          border: isEditing ? '2px solid var(--color-primary)' : '1px solid var(--border-current)', 
                          borderRadius: 'var(--radius-lg)', 
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: 'var(--shadow-sm)',
                          transition: 'all 0.2s ease',
                          position: 'relative'
                        }}
                      >
                        {isEditing ? (
                          /* Card Edit Mode */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                ✏️ Edit Partner
                              </span>
                            </div>
                            
                            <div style={{ flexGrow: 1 }}>
                              {renderEditFields(item)}
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-current)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                              <button
                                onClick={handleUpdate}
                                disabled={editSaving}
                                className="btn btn-primary"
                                style={{
                                  flex: 1,
                                  padding: '0.4rem 0.75rem',
                                  fontSize: '0.8125rem',
                                  fontWeight: '600',
                                  opacity: editSaving ? 0.7 : 1,
                                  minHeight: '32px'
                                }}
                              >
                                {editSaving ? <Loader size={14} className="spin" /> : <Check size={14} />} Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={editSaving}
                                className="btn"
                                style={{
                                  flex: 1,
                                  background: 'var(--bg-current)',
                                  color: 'var(--text-muted-current)',
                                  border: '1px solid var(--border-current)',
                                  padding: '0.4rem 0.75rem',
                                  fontSize: '0.8125rem',
                                  fontWeight: '600',
                                  minHeight: '32px'
                                }}
                              >
                                <X size={14} /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Card Display Mode */
                          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', textAlign: 'left' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: '600', color: 'var(--text-current)', lineHeight: '1.3' }}>
                                  {item.partner_name}
                                </h3>
                                <span style={{ 
                                  display: 'inline-block',
                                  backgroundColor: badge.bg,
                                  color: badge.text,
                                  border: `1px solid ${badge.border}`,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '999px',
                                  fontSize: '0.6875rem',
                                  fontWeight: '600',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {item.partner_type}
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted-current)' }}>
                                  <span style={{ fontWeight: '500' }}>GSTIN: </span>
                                  <span style={{ color: item.gstin ? 'var(--text-current)' : 'var(--text-muted-current)', fontFamily: item.gstin ? 'monospace' : 'inherit', letterSpacing: item.gstin ? '0.05em' : 'none' }}>
                                    {item.gstin || 'Not Provided'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted-current)' }}>
                                  <span style={{ fontWeight: '500' }}>State: </span>
                                  <span style={{ color: 'var(--text-current)' }}>
                                    {item.state || '--'} ({item.state_code || '--'})
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted-current)' }}>
                                  <span style={{ fontWeight: '500' }}>Pincode: </span>
                                  <span style={{ color: item.pincode ? 'var(--text-current)' : 'var(--text-muted-current)' }}>
                                    {item.pincode || '--'}
                                  </span>
                                </div>
                                <div style={{ 
                                  marginTop: '0.5rem', 
                                  fontSize: '0.8125rem', 
                                  color: 'var(--text-muted-current)',
                                  borderTop: '1px dashed var(--border-current)',
                                  paddingTop: '0.5rem'
                                }}>
                                  <span style={{ fontWeight: '600', display: 'block', marginBottom: '0.15rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Billing Address</span>
                                  <div style={{ 
                                    color: item.address ? 'var(--text-current)' : 'var(--text-muted-current)', 
                                    lineHeight: '1.4',
                                    minHeight: '2.8rem',
                                    overflow: 'hidden', 
                                    display: '-webkit-box', 
                                    WebkitLineClamp: 2, 
                                    WebkitBoxOrient: 'vertical',
                                    fontStyle: item.address ? 'normal' : 'italic'
                                  }}>
                                    {item.address || 'No address specified'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'flex-end', 
                              gap: '0.5rem', 
                              marginTop: '1rem', 
                              borderTop: '1px solid var(--border-current)', 
                              paddingTop: '0.75rem' 
                            }}>
                              <button 
                                onClick={() => handleEdit(item)}
                                className="btn"
                                style={{ 
                                  background: 'rgba(37, 99, 235, 0.06)', 
                                  color: '#2563eb', 
                                  padding: '0.3rem 0.6rem', 
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  minHeight: '28px'
                                }}
                                title="Edit Partner"
                              >
                                <Edit3 size={12} /> Edit
                              </button>
                              <button 
                                onClick={() => handleDelete(item.id)}
                                className="btn"
                                style={{ 
                                  background: 'rgba(220, 38, 38, 0.06)', 
                                  color: '#dc2626', 
                                  padding: '0.3rem 0.6rem', 
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  minHeight: '28px'
                                }}
                                title="Delete Partner"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── Standard 2-Column Split Layout for other Masters ── */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          
          {/* ADD NEW FORM */}
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', color: 'var(--color-primary)' }}>
              <Plus size={18} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }}/>
              Add New {config.title.slice(0, -1)}
            </h2>
            <form onSubmit={handleSubmit}>
              {renderFormFields()}
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem', justifyContent: 'center' }} disabled={saving}>
                {saving ? <Loader size={16} className="spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save to Database'}
              </button>
            </form>
          </div>

          {/* EXISTING ITEMS LIST */}
          <div className="glass-panel" style={{ padding: 0 }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)', backgroundColor: 'var(--bg-current)', borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)' }}>
              <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Existing Database Entries</h2>
            </div>
            <div style={{ padding: '1rem' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>
                  <Loader size={24} className="spin" style={{ margin: '0 auto 1rem' }} /> Loading...
                </div>
              ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>
                  No {config.title.toLowerCase()} found in the database.
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map(item => (
                    <li key={item.id} style={{ 
                      padding: '0.75rem 1rem', 
                      backgroundColor: editingId === item.id ? 'var(--surface-current)' : 'var(--bg-current)', 
                      border: editingId === item.id ? '2px solid var(--color-primary)' : '1px solid var(--border-current)', 
                      borderRadius: 'var(--radius-md)', 
                      fontSize: '0.875rem',
                      transition: 'all 0.2s ease',
                      textAlign: 'left'
                    }}>
                      {editingId === item.id ? (
                        /* Inline Edit Mode */
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
                        /* Display Mode */
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
      )}

      {/* ADD NEW PARTNER MODAL */}
      {type === 'partners' && showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s ease',
          padding: '1.5rem'
        }} onClick={() => setShowAddModal(false)}>
          <div 
            className="glass-panel" 
            style={{ 
              width: '100%', 
              maxWidth: '600px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              backgroundColor: 'var(--surface-current)',
              border: '1px solid var(--border-current)',
              boxShadow: 'var(--shadow-lg)',
              padding: '1.5rem 2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Plus size={20} />
                Add New Partner
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {renderFormFields()}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', borderTop: '1px solid var(--border-current)', paddingTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="btn"
                  style={{ flex: 1, background: 'var(--bg-current)', color: 'var(--text-muted-current)', border: '1px solid var(--border-current)' }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1, justifyContent: 'center' }} 
                  disabled={saving}
                >
                  {saving ? <Loader size={16} className="spin" /> : <Save size={16} />}
                  {saving ? 'Saving...' : 'Save Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
