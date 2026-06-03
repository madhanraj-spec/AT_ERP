import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Loader, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Map URL parameters to titles and database tables
const MASTER_CONFIG = {
  'yarn-counts': { title: 'Yarn Counts', table: 'master_yarn_counts', icon: '🧵' },
  'brands': { title: 'Brands', table: 'master_brands', icon: '🏷️' },
  'partners': { title: 'Partners', table: 'master_partners', icon: '🤝' },
  'departments': { title: 'Departments', table: 'master_departments', icon: '🏢' },
  'machines': { title: 'Machines', table: 'master_machines', icon: '⚙️' },
  'locations': { title: 'Locations', table: 'master_locations', icon: '📍' },
  'beams': { title: 'Beams', table: 'master_beams', icon: '🎯' }
};

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

  useEffect(() => {
    if (!config) {
      navigate('/masters');
      return;
    }
    fetchData();
    if (type === 'machines') {
      fetchDependencies();
    }
  }, [type]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from(config.table).select('*').order('created_at', { ascending: false });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    let payload = { ...formData };

    // Set default scope for machines if not touched
    if (type === 'machines' && !payload.scope) {
      payload.scope = 'in_house';
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
      case 'yarn-counts':
        return (
          <>
            <div className="input-group">
              <label className="input-label">Count (e.g. 30s)</label>
              <input type="text" name="count_value" className="input-field" value={formData.count_value || ''} onChange={handleInputChange} required />
            </div>
            <div className="input-group">
              <label className="input-label">Material (e.g. Cotton)</label>
              <input type="text" name="material" className="input-field" value={formData.material || ''} onChange={handleInputChange} required />
            </div>
            <div className="input-group">
              <label className="input-label">Type (e.g. BCI, Organic)</label>
              <input type="text" name="product_type" className="input-field" value={formData.product_type || ''} onChange={handleInputChange} required />
            </div>
          </>
        );
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
                <option value="Vendor">Vendor</option>
              </select>
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
                {departments.map(d => <option key={d.id} value={d.id}>{d.department_name}</option>)}
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
          <div className="input-group">
            <label className="input-label">Beam Name / Identification</label>
            <input type="text" name="beam_name" className="input-field" value={formData.beam_name || ''} onChange={handleInputChange} required />
          </div>
        );
      default: return null;
    }
  };

  // Render Display Rows for existing items
  const renderRow = (item) => {
    switch (type) {
      case 'yarn-counts': return `${item.count_value} — ${item.material} (${item.product_type})`;
      case 'brands': return item.brand_name;
      case 'partners': return `${item.partner_name} - [${item.partner_type}]`;
      case 'departments': return item.department_name;
      case 'machines': return `${item.machine_name} (${item.scope === 'job_work' ? 'Job Work' : 'In-House'})`;
      case 'locations': return `[${item.warehouse_type}] ${item.location_name}`;
      case 'beams': return item.beam_name;
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
                  <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-current)', border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: '500' }}>{renderRow(item)}</span>
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
