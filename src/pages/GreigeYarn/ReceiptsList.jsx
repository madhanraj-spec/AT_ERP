import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ReceiptPrintModal from './ReceiptPrintModal';

// ──────────────────────────────────────────────────────────────────────────────
// Reusable MultiSelectDropdown Component
// ──────────────────────────────────────────────────────────────────────────────
function MultiSelectDropdown({ label, options, selectedValues, onChange, placeholder = "Select..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (val) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectAll = () => {
    onChange(options);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 0.75rem',
          border: '1px solid var(--border-current)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--surface-current)',
          color: selectedValues.length > 0 ? 'var(--text-current)' : 'var(--text-muted-current)',
          fontSize: '0.85rem',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          minHeight: '38px'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
          {selectedValues.length === 0 
            ? placeholder 
            : selectedValues.length === 1 
              ? selectedValues[0] 
              : `${selectedValues.length} Selected`}
        </span>
        <span style={{ fontSize: '0.6rem', marginLeft: '0.5rem' }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 50,
          marginTop: '4px',
          padding: '0.5rem',
          maxHeight: '250px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {options.length > 5 && (
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.25rem 0.5rem',
                fontSize: '0.8rem',
                border: '1px solid var(--border-current)',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                outline: 'none',
                color: 'var(--text-current)'
              }}
            />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0 0.25rem' }}>
            <button type="button" onClick={selectAll} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: '600' }}>Select All</button>
            <button type="button" onClick={clearAll} style={{ background: 'none', border: 'none', color: 'var(--text-muted-current)', cursor: 'pointer', fontWeight: '600' }}>Clear All</button>
          </div>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingRight: '0.25rem' }}>
            {filteredOptions.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)', padding: '0.25rem' }}>No options found</span>
            ) : (
              filteredOptions.map(opt => {
                const isChecked = selectedValues.includes(opt);
                return (
                  <label key={opt} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.25rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    backgroundColor: isChecked ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                    transition: 'background-color 0.1s'
                  }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ color: 'var(--text-current)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt}</span>
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

// ──────────────────────────────────────────────────────────────────────────────
// Main ReceiptsList Component
// ──────────────────────────────────────────────────────────────────────────────
export default function ReceiptsList() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('spinning'); // 'spinning' | 'production'
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // For Printable view
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Filters State
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [searchReceiptNoText, setSearchReceiptNoText] = useState('');
  const [selectedReceiptNos, setSelectedReceiptNos] = useState([]);
  const [selectedMillNames, setSelectedMillNames] = useState([]);
  const [selectedCounts, setSelectedCounts] = useState([]);
  const [selectedDofNos, setSelectedDofNos] = useState([]);

  // Reset filters on tab switch
  useEffect(() => {
    setSelectedDates([]);
    setSearchReceiptNoText('');
    setSelectedReceiptNos([]);
    setSelectedMillNames([]);
    setSelectedCounts([]);
    setSelectedDofNos([]);
  }, [activeTab]);

  // Options derived from receipts list
  const uniqueDates = useMemo(() => {
    const dates = receipts.map(r => r.created_at ? r.created_at.split('T')[0] : '').filter(Boolean);
    return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  }, [receipts]);

  const uniqueReceiptNos = useMemo(() => {
    return [...new Set(receipts.map(r => r.receipt_no).filter(Boolean))].sort();
  }, [receipts]);

  const uniqueMillNames = useMemo(() => {
    return [...new Set(receipts.map(r => r.master_partners?.partner_name).filter(Boolean))].sort();
  }, [receipts]);

  const uniqueDofNos = useMemo(() => {
    return [...new Set(receipts.map(r => r.order_form_no).filter(Boolean))].sort();
  }, [receipts]);

  const uniqueCounts = useMemo(() => {
    const counts = receipts.map(r => {
      if (!r.master_yarn_counts) return '';
      const { count_value, material, product_type } = r.master_yarn_counts;
      return `${count_value} ${material} ${product_type || ''}`.trim();
    }).filter(Boolean);
    return [...new Set(counts)].sort();
  }, [receipts]);

  // Client-side filtering logic
  const filteredReceipts = useMemo(() => {
    return receipts.filter((row) => {
      // 1. Date Filter
      if (selectedDates.length > 0) {
        const rowDate = row.created_at ? row.created_at.split('T')[0] : '';
        if (!selectedDates.includes(rowDate)) return false;
      }

      // 2. Receipt Number Filter
      if (searchReceiptNoText.trim()) {
        const searchTerms = searchReceiptNoText.split(/[,\s;]+/).map(t => t.trim().toLowerCase()).filter(Boolean);
        if (searchTerms.length > 0) {
          const rowNoLower = (row.receipt_no || '').toLowerCase();
          const matchesText = searchTerms.some(term => rowNoLower.includes(term));
          if (!matchesText) return false;
        }
      }
      if (selectedReceiptNos.length > 0) {
        if (!selectedReceiptNos.includes(row.receipt_no)) return false;
      }

      // 3. Mill Name Filter (Spinning mill tab only)
      if (activeTab === 'spinning' && selectedMillNames.length > 0) {
        const millName = row.master_partners?.partner_name || '';
        if (!selectedMillNames.includes(millName)) return false;
      }

      // 4. Count Filter
      if (selectedCounts.length > 0) {
        const { count_value, material, product_type } = row.master_yarn_counts || {};
        const countStr = count_value ? `${count_value} ${material} ${product_type || ''}`.trim() : '';
        if (!selectedCounts.includes(countStr)) return false;
      }

      // 5. DOF Number Filter (Production returns tab only)
      if (activeTab === 'production' && selectedDofNos.length > 0) {
        if (!selectedDofNos.includes(row.order_form_no)) return false;
      }

      return true;
    });
  }, [receipts, selectedDates, searchReceiptNoText, selectedReceiptNos, selectedMillNames, selectedCounts, selectedDofNos, activeTab]);

  // Group receipts by receipt_no to display multi-count receipts on the same line (using rowspan)
  const groupedReceipts = useMemo(() => {
    const groups = [];
    const map = new Map();
    filteredReceipts.forEach((row) => {
      if (!map.has(row.receipt_no)) {
        const group = {
          id: row.id,
          receipt_no: row.receipt_no,
          created_at: row.created_at,
          invoice_no: row.invoice_no,
          order_form_no: row.order_form_no,
          master_partners: row.master_partners,
          invoice_amount: row.invoice_amount,
          row, // Keep reference to original row object for actions or detail modal
          items: []
        };
        map.set(row.receipt_no, group);
        groups.push(group);
      }
      map.get(row.receipt_no).items.push(row);
    });
    return groups;
  }, [filteredReceipts]);

  const fetchReceipts = async () => {
    setLoading(true);
    const typeQuery = activeTab === 'spinning' ? 'spinning_mill' : 'production';
    
    const { data, error } = await supabase
      .from('greige_yarn_receipts')
      .select(`
        *,
        master_partners (partner_name),
        master_yarn_counts (count_value, material, product_type),
        master_locations!location_id (location_name),
        orders (order_number)
      `)
      .eq('receipt_type', typeQuery)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReceipts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }} className="fade-in">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <button 
            onClick={() => navigate('/greige-yarn')} 
            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.5rem' }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <h1 style={{ fontSize: '1.75rem', margin: '0', color: 'var(--text-current)', fontWeight: 'bold' }}>
            Greige Yarn Receipts
          </h1>
        </div>
        
        <button 
          onClick={() => navigate('/greige-yarn/receipt')} 
          className="btn btn-primary" 
          style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: 'bold', padding: '0.625rem 1.25rem' }}
        >
          <Plus size={18} />
          New Receipt
        </button>
      </div>

      <div className="glass-panel" style={{ padding: 0 }}>
        {/* Tabs & Advanced Filters Button */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: '1px solid var(--border-current)', 
          padding: '0 1rem' 
        }}>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <button 
              onClick={() => setActiveTab('spinning')}
              style={{
                background: 'none',
                border: 'none',
                padding: '1rem 0',
                fontWeight: '600',
                color: activeTab === 'spinning' ? 'var(--color-primary)' : 'var(--text-muted-current)',
                borderBottom: activeTab === 'spinning' ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Spinning Mill
            </button>
            <button 
              onClick={() => setActiveTab('production')}
              style={{
                background: 'none',
                border: 'none',
                padding: '1rem 0',
                fontWeight: '600',
                color: activeTab === 'production' ? 'var(--color-primary)' : 'var(--text-muted-current)',
                borderBottom: activeTab === 'production' ? '2px solid var(--color-primary)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Production Returns
            </button>
          </div>

          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--border-current)',
              backgroundColor: isFilterExpanded ? 'var(--color-primary)' : 'transparent',
              color: isFilterExpanded ? 'white' : 'var(--text-current)',
              borderRadius: 'var(--radius-md)',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <SlidersHorizontal size={16} />
            {isFilterExpanded ? 'Hide Filters' : 'Advanced Filters'}
          </button>
        </div>

        {/* Expandable filter panel */}
        {isFilterExpanded && (
          <div style={{
            backgroundColor: 'var(--surface-current)',
            borderBottom: '1px solid var(--border-current)',
            padding: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem'
          }} className="fade-in">
            {/* Filter by Dates */}
            <MultiSelectDropdown
              label="Select Dates"
              options={uniqueDates}
              selectedValues={selectedDates}
              onChange={setSelectedDates}
              placeholder="All Dates"
            />

            {/* Filter by Receipt Numbers (Select) */}
            <MultiSelectDropdown
              label="Select Receipt Numbers"
              options={uniqueReceiptNos}
              selectedValues={selectedReceiptNos}
              onChange={setSelectedReceiptNos}
              placeholder="All Receipts"
            />

            {/* Enter Receipt Numbers (Text input) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>
                Enter Receipt Numbers
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. 00001, 00002"
                value={searchReceiptNoText}
                onChange={e => setSearchReceiptNoText(e.target.value)}
                style={{ fontSize: '0.85rem', padding: '0.5rem', width: '100%', minHeight: '38px' }}
              />
            </div>

            {/* Filter by Mill Name (Only visible for Spinning Mill) */}
            {activeTab === 'spinning' && (
              <MultiSelectDropdown
                label="Select Mill Names"
                options={uniqueMillNames}
                selectedValues={selectedMillNames}
                onChange={setSelectedMillNames}
                placeholder="All Mills"
              />
            )}

            {/* Filter by DOF Numbers (Only visible for Production Returns) */}
            {activeTab === 'production' && (
              <MultiSelectDropdown
                label="Select DOF Numbers"
                options={uniqueDofNos}
                selectedValues={selectedDofNos}
                onChange={setSelectedDofNos}
                placeholder="All DOFs"
              />
            )}

            {/* Filter by Yarn Counts */}
            <MultiSelectDropdown
              label="Select Yarn Counts"
              options={uniqueCounts}
              selectedValues={selectedCounts}
              onChange={setSelectedCounts}
              placeholder="All Counts"
            />

            {/* Reset Filters button */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                onClick={() => {
                  setSelectedDates([]);
                  setSearchReceiptNoText('');
                  setSelectedReceiptNos([]);
                  setSelectedMillNames([]);
                  setSelectedCounts([]);
                  setSelectedDofNos([]);
                }}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: '600' }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          <table className="table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Receipt No</th>
                {activeTab === 'spinning' ? (
                  <>
                    <th>Invoice No</th>
                    <th>Mill Name</th>
                    <th>Count</th>
                    <th>Location</th>
                  </>
                ) : (
                  <>
                    <th>Order Form No</th>
                    <th>Count</th>
                    <th>Location</th>
                  </>
                )}
                <th>Bags</th>
                <th>Cones</th>
                <th>Wt/Bag (kg)</th>
                <th>Wt/Cone (kg)</th>
                <th>Total Weight (kg)</th>
                <th>Rate/KG (₹)</th>
                {activeTab === 'spinning' && <th>Invoice Value</th>}
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={activeTab === 'spinning' ? 14 : 12} style={{ textAlign: 'center', padding: '2rem' }}>Loading receipts...</td></tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'spinning' ? 14 : 12} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                    No receipts found for this category.
                  </td>
                </tr>
              ) : filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'spinning' ? 14 : 12} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', fontWeight: '500' }}>
                    No receipts match the selected filters.
                  </td>
                </tr>
              ) : (
                groupedReceipts.map((group) => {
                  const rowSpan = group.items.length;
                  return (
                    <React.Fragment key={group.receipt_no}>
                      {group.items.map((item, index) => {
                        const isFirst = index === 0;
                        return (
                          <tr key={item.id}>
                            {isFirst && (
                              <>
                                <td rowSpan={rowSpan}>{new Date(group.created_at).toLocaleString()}</td>
                                <td rowSpan={rowSpan} style={{ fontWeight: 'bold' }}>{group.receipt_no}</td>
                                
                                {activeTab === 'spinning' ? (
                                  <>
                                    <td rowSpan={rowSpan}>{group.invoice_no || '-'}</td>
                                    <td rowSpan={rowSpan}>{group.master_partners?.partner_name || '-'}</td>
                                  </>
                                ) : (
                                  <td rowSpan={rowSpan}>{group.order_form_no || '-'}</td>
                                )}
                              </>
                            )}
                            
                            {activeTab === 'spinning' ? (
                              <>
                                <td>{item.master_yarn_counts ? `${item.master_yarn_counts.count_value} ${item.master_yarn_counts.material} ${item.master_yarn_counts.product_type || ''}` : '-'}</td>
                                <td>{item.master_locations?.location_name || '-'}</td>
                              </>
                            ) : (
                              <>
                                <td>
                                  {item.master_yarn_counts ? `${item.master_yarn_counts.count_value} ${item.master_yarn_counts.material} ${item.master_yarn_counts.product_type || ''}` : '-'}
                                  {(item.yarn_type || item.colour || item.orders?.order_number) && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                      {[item.yarn_type, item.colour, item.orders?.order_number].filter(Boolean).join(' • ')}
                                    </div>
                                  )}
                                </td>
                                <td>{item.master_locations?.location_name || '-'}</td>
                              </>
                            )}

                            <td>{item.bag_count || 0}</td>
                            <td>{item.cone_count || 0}</td>
                            <td>{Number(item.bag_weight || 0).toFixed(2)}</td>
                            <td>{Number(item.cone_weight || 0).toFixed(2)}</td>
                            <td style={{ fontWeight: 'bold' }}>{Number(item.total_weight).toFixed(2)}</td>
                            
                            <td>₹{Number(item.rate_per_kg || 0).toFixed(2)}</td>
                            
                            {isFirst && (
                              <>
                                {activeTab === 'spinning' && (
                                  <td rowSpan={rowSpan}>₹{Number(group.invoice_amount || 0).toFixed(2)}</td>
                                )}
                                
                                <td rowSpan={rowSpan} style={{ textAlign: 'right' }}>
                                  <button 
                                    onClick={() => setSelectedReceipt(group.row)}
                                    style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                                  >
                                    View
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedReceipt && (
        <ReceiptPrintModal 
          receipt={selectedReceipt} 
          onClose={() => setSelectedReceipt(null)} 
        />
      )}
    </div>
  );
}
