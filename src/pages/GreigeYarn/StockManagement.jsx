import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function StockManagement() {
  const navigate = useNavigate();

  const [receipts, setReceipts] = useState([]);
  const [deliveryItems, setDeliveryItems] = useState([]); // GYDR items for stock deduction
  const [counts, setCounts] = useState([]);
  const [mills, setMills] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters (Multi-Select Arrays)
  const [filterCount, setFilterCount] = useState([]);
  const [filterMill, setFilterMill] = useState([]);
  const [filterLocation, setFilterLocation] = useState([]);

  // Accordion & Tabs State
  const [expandedCountId, setExpandedCountId] = useState(null);
  const [expandedCombos, setExpandedCombos] = useState({}); // { [combKey]: boolean }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch Masters for Filter Dropdowns
    const [cRes, mRes, lRes] = await Promise.all([
      supabase.from('master_yarn_counts').select('*'),
      supabase.from('master_partners').select('*').eq('partner_type', 'Spinning Mill'),
      supabase.from('master_locations').select('*').eq('warehouse_type', 'Greige Warehouse')
    ]);
    
    if (cRes.data) setCounts(cRes.data);
    if (mRes.data) setMills(mRes.data);
    if (lRes.data) setLocations(lRes.data);

    // Fetch All Receipts across both types
    const { data: recData } = await supabase
      .from('greige_yarn_receipts')
      .select(`
        *,
        master_yarn_counts (*),
        master_partners (*),
        master_locations (*)
      `)
      .order('created_at', { ascending: false });

    // Fetch all GYDR delivery items for stock deduction
    const { data: gydrItems, error: gydrErr } = await supabase
      .from('greige_yarn_delivery_items')
      .select('yarn_count_id, quantity_kg, spinning_mill_id, location_id');

    if (recData) setReceipts(recData);
    if (gydrItems) setDeliveryItems(gydrItems);
    // If table doesn't exist yet (42P01), silently skip
    setLoading(false);
  };

  // Compute standard filtered array
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      if (filterCount.length > 0 && !filterCount.includes(r.yarn_count_id)) return false;
      if (filterMill.length > 0 && !filterMill.includes(r.spinning_mill_id)) return false;
      if (filterLocation.length > 0 && !filterLocation.includes(r.location_id)) return false;
      return true;
    });
  }, [receipts, filterCount, filterMill, filterLocation]);

  // Custom MultiSelect Dropdown
  const MultiSelectDropdown = ({ options, selected, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
      const handleClickOutside = (event) => {
        if (containerRef.current && !containerRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div ref={containerRef} style={{ position: 'relative' }}>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="input-field"
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', minHeight: '42px' }}
        >
          <span style={{ fontSize: '0.875rem' }}>
            {selected.length === 0 ? placeholder : `${selected.length} Selected`}
          </span>
          <ChevronDown size={16} color="#64748b" />
        </div>
        
        {isOpen && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '4px', backgroundColor: '#fff', border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', maxHeight: '250px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            {options.length === 0 ? <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#9ca3af' }}>No options</div> : null}
            {options.map(opt => (
              <label key={opt.value} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0.75rem', borderBottom: '1px solid #f8fafc', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={selected.includes(opt.value)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...selected, opt.value]);
                    else onChange(selected.filter(v => v !== opt.value));
                  }}
                  style={{ cursor: 'pointer' }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Group filtered receipts by Yarn Count ID and run FIFO deduction
  const groupedData = useMemo(() => {
    // 1) Clone receipts and initialize available_weight
    const receiptsClone = receipts.map(r => ({
      ...r,
      available_weight: parseFloat(r.total_weight || 0)
    }));

    // 2) Run FIFO stock deduction per combination of count + mill + location
    const comboKeys = {};
    receiptsClone.forEach(r => {
      const key = `${r.yarn_count_id}_${r.spinning_mill_id || 'null'}_${r.location_id}`;
      comboKeys[key] = {
        yarn_count_id: r.yarn_count_id,
        spinning_mill_id: r.spinning_mill_id,
        location_id: r.location_id
      };
    });

    Object.values(comboKeys).forEach(({ yarn_count_id, spinning_mill_id, location_id }) => {
      // Get all receipts for this combo, sorted oldest first (FIFO)
      const comboReceipts = receiptsClone
        .filter(r => r.yarn_count_id === yarn_count_id && r.spinning_mill_id === spinning_mill_id && r.location_id === location_id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      // Get total delivered for this combo
      let totalDeliveredForCombo = deliveryItems
        .filter(d => d.yarn_count_id === yarn_count_id && d.spinning_mill_id === spinning_mill_id && d.location_id === location_id)
        .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

      // Deduct from oldest first
      for (const rec of comboReceipts) {
        if (totalDeliveredForCombo <= 0) break;
        const deduct = Math.min(rec.available_weight, totalDeliveredForCombo);
        rec.available_weight -= deduct;
        totalDeliveredForCombo -= deduct;
      }
    });

    // 3) Group filtered receipts by count ID
    const groups = {};
    receiptsClone.forEach(r => {
      if (filterCount.length > 0 && !filterCount.includes(r.yarn_count_id)) return;
      if (filterMill.length > 0 && !filterMill.includes(r.spinning_mill_id)) return;
      if (filterLocation.length > 0 && !filterLocation.includes(r.location_id)) return;

      const cid = r.yarn_count_id || 'unknown';
      if (!groups[cid]) {
        groups[cid] = {
          yarn_count: r.master_yarn_counts
            ? [r.master_yarn_counts.count_value, r.master_yarn_counts.spec, r.master_yarn_counts.spec1, r.master_yarn_counts.product_type, r.master_yarn_counts.content].filter(Boolean).join(' ')
            : 'Unknown Count',
          total_weight: 0,
          receipt_count: 0,
          total_delivered: 0,
          available_weight: 0,
          raw_receipts: []
        };
      }

      groups[cid].total_weight += parseFloat(r.total_weight || 0);
      groups[cid].receipt_count += 1;
      groups[cid].available_weight += r.available_weight;
      groups[cid].raw_receipts.push(r);
    });

    // Calculate total delivered per count group based on active filters
    Object.entries(groups).forEach(([cid, group]) => {
      group.total_delivered = deliveryItems
        .filter(d => {
          if (d.yarn_count_id !== cid) return false;
          if (filterMill.length > 0 && !filterMill.includes(d.spinning_mill_id)) return false;
          if (filterLocation.length > 0 && !filterLocation.includes(d.location_id)) return false;
          return true;
        })
        .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
    });

    // 4) For each group, construct the aggregated Mill combinations
    return Object.entries(groups)
      .map(([id, data]) => {
        const millGroupsMap = {};
        data.raw_receipts.forEach(r => {
          const millId = r.spinning_mill_id || 'null';

          if (!millGroupsMap[millId]) {
            millGroupsMap[millId] = {
              millId,
              spinning_mill_id: r.spinning_mill_id,
              mill_name: r.spinning_mill_id ? (r.master_partners?.partner_name || 'Unknown Mill') : 'Production Returns',
              total_received: 0,
              total_available: 0,
              receipts: []
            };
          }

          millGroupsMap[millId].total_received += parseFloat(r.total_weight || 0);
          millGroupsMap[millId].total_available += r.available_weight;
          millGroupsMap[millId].receipts.push(r);
        });

        const millGroupsList = Object.values(millGroupsMap).sort((a, b) => b.total_available - a.total_available);
        
        // Sort receipts in each mill group by created_at descending (latest first)
        millGroupsList.forEach(g => {
          g.receipts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });

        return {
          id,
          ...data,
          mill_groups: millGroupsList
        };
      })
      .sort((a, b) => b.available_weight - a.available_weight);
  }, [receipts, deliveryItems, filterCount, filterMill, filterLocation]);

  // Overall Total based on filtered groups (sum of available weights)
  const totalStock = useMemo(() => {
    return groupedData.reduce((sum, g) => sum + g.available_weight, 0);
  }, [groupedData]);

  const toggleAccordion = (id) => {
    if (expandedCountId === id) {
      setExpandedCountId(null);
      setExpandedCombos({});
    } else {
      setExpandedCountId(id);
      setExpandedCombos({});
    }
  };

  const toggleCombo = (combKey) => {
    setExpandedCombos(prev => ({
      ...prev,
      [combKey]: !prev[combKey]
    }));
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }} className="fade-in">
      
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button 
          onClick={() => navigate('/greige-yarn')} 
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.5rem' }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <h1 style={{ fontSize: '1.75rem', margin: '0', color: 'var(--text-current)', fontWeight: 'bold' }}>
          Greige Yarn Stock Management
        </h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={24} className="spin" style={{ margin: '0 auto 1rem', display: 'block' }} color="var(--color-primary)" />
          Processing inventory records...
        </div>
      ) : (
        <>
          {/* Filters Section */}
          <div className="glass-panel" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-current)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Filters (Multiple Selection)</span>
              {(filterCount.length > 0 || filterMill.length > 0 || filterLocation.length > 0) && (
                <button 
                  onClick={() => { setFilterCount([]); setFilterMill([]); setFilterLocation([]); }} 
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Clear All Filters
                </button>
              )}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Yarn Count</label>
                <MultiSelectDropdown 
                  options={counts.map(c => ({ value: c.id, label: [c.count_value, c.spec, c.spec1, c.product_type, c.content].filter(Boolean).join(' ') }))}
                  selected={filterCount}
                  onChange={setFilterCount}
                  placeholder="All Counts"
                />
              </div>
              
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Spinning Mill</label>
                <MultiSelectDropdown 
                  options={mills.map(m => ({ value: m.id, label: m.partner_name }))}
                  selected={filterMill}
                  onChange={setFilterMill}
                  placeholder="All Mills"
                />
              </div>
              
              <div>
                <label className="input-label" style={{ fontSize: '0.8rem' }}>Location (Bay)</label>
                <MultiSelectDropdown 
                  options={locations.map(l => ({ value: l.id, label: l.location_name }))}
                  selected={filterLocation}
                  onChange={setFilterLocation}
                  placeholder="All Locations"
                />
              </div>
            </div>
          </div>

          {/* Highlights Banner */}
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.875rem', fontWeight: 'bold', color: '#16a34a' }}>Total Available Stock</p>
            <h2 style={{ margin: '0', fontSize: '2.5rem', fontWeight: 'bold', color: '#15803d' }}>
              {totalStock.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span style={{ fontSize: '1.25rem' }}>kg</span>
            </h2>
          </div>

          {/* Grouped Accordion List */}
          <div className="glass-panel" style={{ padding: 0 }}>
            <table className="table" style={{ fontSize: '0.875rem', border: 'none' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Yarn Count</th>
                  <th style={{ textAlign: 'center' }}>Total Received (kg)</th>
                  <th style={{ textAlign: 'center', color: '#dc2626' }}>Delivered Out (kg)</th>
                  <th style={{ textAlign: 'center', color: '#16a34a' }}>Net Available (kg)</th>
                  <th style={{ textAlign: 'right' }}>Receipts</th>
                </tr>
              </thead>
              <tbody>
                {groupedData.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                      No inventory matches the selected filters.
                    </td>
                  </tr>
                ) : (
                  groupedData.map((group) => (
                    <React.Fragment key={group.id}>
                      {/* Main Group Row */}
                      <tr 
                        onClick={() => toggleAccordion(group.id)}
                        style={{ cursor: 'pointer', backgroundColor: expandedCountId === group.id ? '#f8fafc' : 'transparent', transition: 'background-color 0.2s' }}
                      >
                        <td style={{ textAlign: 'center', color: '#94a3b8' }}>
                          {expandedCountId === group.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{group.yarn_count}</td>
                        <td style={{ textAlign: 'center', color: '#475569' }}>
                          {parseFloat(group.total_weight).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: '600', color: '#dc2626' }}>
                          {parseFloat(group.total_delivered || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#16a34a' }}>
                          {parseFloat(group.available_weight || group.total_weight).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>{group.receipt_count}</td>
                      </tr>

                      {/* Expanded Sub-Table View */}
                      {expandedCountId === group.id && (
                        <tr style={{ backgroundColor: '#f8fafc' }}>
                          <td colSpan="6" style={{ padding: '0 1.5rem 1.5rem 3rem' }}>
                            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginTop: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }} className="fade-in">
                              
                              <h4 style={{ margin: '0 0 1rem 0', color: '#475569', fontSize: '0.9rem', fontWeight: '700' }}>Stock by Mill</h4>

                              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ color: '#64748b', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                    <th style={{ width: '40px', padding: '0.5rem' }}></th>
                                    <th style={{ padding: '0.5rem', fontWeight: '600' }}>Spinning Mill</th>
                                    <th style={{ padding: '0.5rem', fontWeight: '600', textAlign: 'right' }}>Received Qty (kg)</th>
                                    <th style={{ padding: '0.5rem', fontWeight: '600', textAlign: 'right', color: '#16a34a' }}>Available Qty (kg)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.mill_groups.length === 0 ? (
                                    <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>No mill stock groups found</td></tr>
                                  ) : (
                                    group.mill_groups.map((g) => {
                                      const isMillExpanded = !!expandedCombos[g.millId];
                                      return (
                                        <React.Fragment key={g.millId}>
                                          <tr 
                                            onClick={(e) => { e.stopPropagation(); toggleCombo(g.millId); }}
                                            style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer', backgroundColor: isMillExpanded ? '#f8fafc' : 'transparent' }}
                                          >
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#94a3b8' }}>
                                              {isMillExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{g.mill_name}</td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{g.total_received.toFixed(2)}</td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>{g.total_available.toFixed(2)}</td>
                                          </tr>

                                          {/* Nested Receipts Table */}
                                          {isMillExpanded && (
                                            <tr style={{ backgroundColor: '#fafafa' }}>
                                              <td colSpan="4" style={{ padding: '0.5rem 1rem 1rem 2rem' }}>
                                                <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)' }} className="fade-in">
                                                  <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receipt Details</p>
                                                  <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                      <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>Receipt No</th>
                                                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>Received Date</th>
                                                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: '600', textAlign: 'right' }}>Received Qty (kg)</th>
                                                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: '600', textAlign: 'right', color: '#16a34a' }}>Available Qty (kg)</th>
                                                        <th style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>Location</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {g.receipts.map((r) => (
                                                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                          <td style={{ padding: '0.5rem', fontWeight: '600', color: 'var(--color-primary)' }}>{r.receipt_no}</td>
                                                          <td style={{ padding: '0.5rem' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                                                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{parseFloat(r.total_weight).toFixed(2)}</td>
                                                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: r.available_weight > 0 ? '#16a34a' : '#64748b' }}>{r.available_weight.toFixed(2)}</td>
                                                          <td style={{ padding: '0.5rem', fontWeight: '600' }}>{r.master_locations?.location_name || '-'}</td>
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
                                    })
                                  )}
                                </tbody>
                              </table>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
