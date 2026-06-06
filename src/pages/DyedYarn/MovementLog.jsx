import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Filter, Calendar, 
  Download, Truck, ArrowRight, Package,
  History, Loader, ChevronDown, Eye, SlidersHorizontal
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import DyedReceiptPrintModal from './DyedReceiptPrintModal';
import DyedDeliveryPrintModal from './DyedDeliveryPrintModal';

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

export default function DyedYarnMovement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('receipts'); // 'receipts' or 'deliveries'
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [wofs, setWofs] = useState([]);
  const [weavings, setWeavings] = useState([]);
  
  // Filters
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  // Expandable filters panel state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Filters for Receipts
  const [selectedReceiptNos, setSelectedReceiptNos] = useState([]);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedDofs, setSelectedDofs] = useState([]);
  const [selectedPartners, setSelectedPartners] = useState([]);
  const [selectedOrderNos, setSelectedOrderNos] = useState([]);
  const [selectedDesignNos, setSelectedDesignNos] = useState([]);
  const [selectedDesignNames, setSelectedDesignNames] = useState([]);

  const wofsMap = useMemo(() => new Map(wofs.map(w => [w.id, w])), [wofs]);
  const weavingsMap = useMemo(() => new Map(weavings.map(w => [w.id, w])), [weavings]);

  useEffect(() => {
    fetchMastersAndData();
    // Reset filters on tab switch
    setSelectedReceiptNos([]);
    setSelectedDates([]);
    setSelectedDofs([]);
    setSelectedPartners([]);
    setSelectedOrderNos([]);
    setSelectedDesignNos([]);
    setSelectedDesignNames([]);
  }, [activeTab]);

  const fetchMastersAndData = async () => {
    setLoading(true);
    try {
      const [yarnData, wofData, weavingData] = await Promise.all([
        supabase.from('master_yarn_counts').select('*'),
        supabase.from('warping_order_forms').select('*, partner:master_partners(partner_name)'),
        supabase.from('weaving_orders').select('*, order:orders(*)')
      ]);
      setYarnCounts(yarnData.data || []);
      setWofs(wofData.data || []);
      setWeavings(weavingData.data || []);

      if (activeTab === 'receipts') {
        const { data, error } = await supabase
          .from('dyed_yarn_receipts')
          .select('*, dyeing_unit:master_partners(partner_name), items:dyed_yarn_receipt_items(*, orders(*), master_yarn_counts(*), master_locations(*))')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRecords(data || []);
      } else {
        const { data, error } = await supabase
          .from('dyed_yarn_deliveries')
          .select('*, items:dyed_yarn_delivery_items(*, location:master_locations(location_name), orders(*), yarn_count:master_yarn_counts(*))')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRecords(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Dependent Filter Helper for Incoming Receipts Tab ──
  const getFilteredReceipts = (excludeField) => {
    if (activeTab !== 'receipts') return [];
    return records.filter(r => {
      // Receipt No
      if (excludeField !== 'receipt' && selectedReceiptNos.length > 0) {
        if (!selectedReceiptNos.includes(r.dyrr_number)) return false;
      }
      // Date
      if (excludeField !== 'date' && selectedDates.length > 0) {
        const dateStr = r.created_at ? r.created_at.split('T')[0] : '';
        if (!selectedDates.includes(dateStr)) return false;
      }
      // DOF
      if (excludeField !== 'dof' && selectedDofs.length > 0) {
        if (!selectedDofs.includes(r.dof_number || '')) return false;
      }
      // Partner
      if (excludeField !== 'partner' && selectedPartners.length > 0) {
        const partnerName = r.source_type === 'production' ? 'Production Return' : (r.dyeing_unit?.partner_name || 'Partner Receipt');
        if (!selectedPartners.includes(partnerName)) return false;
      }
      // Order Number
      if (excludeField !== 'orderNo' && selectedOrderNos.length > 0) {
        const hasOrder = (r.items || []).some(item => item.orders && selectedOrderNos.includes(item.orders.order_number));
        if (!hasOrder) return false;
      }
      // Design Number
      if (excludeField !== 'designNo' && selectedDesignNos.length > 0) {
        const hasDesign = (r.items || []).some(item => item.orders && selectedDesignNos.includes(item.orders.design_no));
        if (!hasDesign) return false;
      }
      // Design Name
      if (excludeField !== 'designName' && selectedDesignNames.length > 0) {
        const hasName = (r.items || []).some(item => item.orders && selectedDesignNames.includes(item.orders.design_name));
        if (!hasName) return false;
      }
      return true;
    });
  };

  // ── Unique Options for Incoming Receipts Tab (Dependent) ──
  const uniqueReceiptNos = useMemo(() => {
    const data = getFilteredReceipts('receipt');
    return [...new Set(data.map(r => r.dyrr_number).filter(Boolean))].sort();
  }, [records, activeTab, selectedDates, selectedDofs, selectedPartners, selectedOrderNos, selectedDesignNos, selectedDesignNames]);

  const uniqueDates = useMemo(() => {
    const data = getFilteredReceipts('date');
    const dates = data.map(r => r.created_at ? r.created_at.split('T')[0] : '').filter(Boolean);
    return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  }, [records, activeTab, selectedReceiptNos, selectedDofs, selectedPartners, selectedOrderNos, selectedDesignNos, selectedDesignNames]);

  const uniqueDofs = useMemo(() => {
    const data = getFilteredReceipts('dof');
    return [...new Set(data.map(r => r.dof_number).filter(Boolean))].sort();
  }, [records, activeTab, selectedReceiptNos, selectedDates, selectedPartners, selectedOrderNos, selectedDesignNos, selectedDesignNames]);

  const uniquePartners = useMemo(() => {
    const data = getFilteredReceipts('partner');
    const partners = data.map(r => r.source_type === 'production' ? 'Production Return' : (r.dyeing_unit?.partner_name || 'Partner Receipt')).filter(Boolean);
    return [...new Set(partners)].sort();
  }, [records, activeTab, selectedReceiptNos, selectedDates, selectedDofs, selectedOrderNos, selectedDesignNos, selectedDesignNames]);

  const uniqueOrderNos = useMemo(() => {
    const data = getFilteredReceipts('orderNo');
    const nos = [];
    data.forEach(r => {
      (r.items || []).forEach(item => {
        if (item.orders?.order_number) {
          nos.push(item.orders.order_number);
        }
      });
    });
    return [...new Set(nos)].sort();
  }, [records, activeTab, selectedReceiptNos, selectedDates, selectedDofs, selectedPartners, selectedDesignNos, selectedDesignNames]);

  const uniqueDesignNos = useMemo(() => {
    const data = getFilteredReceipts('designNo');
    const nos = [];
    data.forEach(r => {
      (r.items || []).forEach(item => {
        if (item.orders?.design_no) {
          nos.push(item.orders.design_no);
        }
      });
    });
    return [...new Set(nos)].sort();
  }, [records, activeTab, selectedReceiptNos, selectedDates, selectedDofs, selectedPartners, selectedOrderNos, selectedDesignNames]);

  const uniqueDesignNames = useMemo(() => {
    const data = getFilteredReceipts('designName');
    const names = [];
    data.forEach(r => {
      (r.items || []).forEach(item => {
        if (item.orders?.design_name) {
          names.push(item.orders.design_name);
        }
      });
    });
    return [...new Set(names)].sort();
  }, [records, activeTab, selectedReceiptNos, selectedDates, selectedDofs, selectedPartners, selectedOrderNos, selectedDesignNos]);

  // Client-side Filtered Records
  const filteredRecords = useMemo(() => {
    if (activeTab === 'receipts') {
      return records.filter(r => {
        if (selectedReceiptNos.length > 0 && !selectedReceiptNos.includes(r.dyrr_number)) return false;
        if (selectedDates.length > 0) {
          const dateStr = r.created_at ? r.created_at.split('T')[0] : '';
          if (!selectedDates.includes(dateStr)) return false;
        }
        if (selectedDofs.length > 0 && !selectedDofs.includes(r.dof_number || '')) return false;
        if (selectedPartners.length > 0) {
          const partnerName = r.source_type === 'production' ? 'Production Return' : (r.dyeing_unit?.partner_name || 'Partner Receipt');
          if (!selectedPartners.includes(partnerName)) return false;
        }
        if (selectedOrderNos.length > 0) {
          const hasOrder = (r.items || []).some(item => item.orders && selectedOrderNos.includes(item.orders.order_number));
          if (!hasOrder) return false;
        }
        if (selectedDesignNos.length > 0) {
          const hasDesign = (r.items || []).some(item => item.orders && selectedDesignNos.includes(item.orders.design_no));
          if (!hasDesign) return false;
        }
        if (selectedDesignNames.length > 0) {
          const hasName = (r.items || []).some(item => item.orders && selectedDesignNames.includes(item.orders.design_name));
          if (!hasName) return false;
        }
        return true;
      });
    } else {
      return records;
    }
  }, [records, activeTab, selectedReceiptNos, selectedDates, selectedDofs, selectedPartners, selectedOrderNos, selectedDesignNos, selectedDesignNames]);

  const formatYarn = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    return y ? `${y.count_value} ${y.material} ${y.product_type || ''}`.trim() : '-';
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
      {selectedReceipt && activeTab === 'receipts' && (
        <DyedReceiptPrintModal 
          receipt={selectedReceipt} 
          onClose={() => setSelectedReceipt(null)} 
        />
      )}
      {selectedReceipt && activeTab === 'deliveries' && (
        <DyedDeliveryPrintModal 
          delivery={selectedReceipt} 
          wof={wofsMap.get(selectedReceipt.items?.[0]?.production_form_id)}
          weaving={weavingsMap.get(selectedReceipt.items?.[0]?.production_form_id)}
          onClose={() => setSelectedReceipt(null)} 
          getFormatCount={formatYarn}
        />
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/dyed-yarn')} className="btn-icon">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Yarn Movement Log</h1>
          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Complete history of dyed yarn transactions</p>
        </div>
      </div>

      {/* Tabs and Optional Advanced Filters Toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2px solid #eee',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <button 
            onClick={() => setActiveTab('receipts')}
            style={{
              padding: '1rem 0', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1rem', fontWeight: '700',
              color: activeTab === 'receipts' ? 'var(--color-primary)' : '#666',
              borderBottom: activeTab === 'receipts' ? '3px solid var(--color-primary)' : '3px solid transparent'
            }}
          >
            Incoming Receipts (DYRR)
          </button>
          <button 
            onClick={() => setActiveTab('deliveries')}
            style={{
              padding: '1rem 0', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1rem', fontWeight: '700',
              color: activeTab === 'deliveries' ? 'var(--color-primary)' : '#666',
              borderBottom: activeTab === 'deliveries' ? '3px solid var(--color-primary)' : '3px solid transparent'
            }}
          >
            Outgoing Deliveries (DYDR)
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '0.5rem 0' }}>
          {activeTab === 'receipts' && (
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
          )}
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Expandable filter panel */}
      {activeTab === 'receipts' && isFilterExpanded && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #eee',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }} className="fade-in">
          <MultiSelectDropdown
            label="Receipt Number"
            options={uniqueReceiptNos}
            selectedValues={selectedReceiptNos}
            onChange={setSelectedReceiptNos}
            placeholder="All Receipts"
          />
          <MultiSelectDropdown
            label="Date"
            options={uniqueDates}
            selectedValues={selectedDates}
            onChange={setSelectedDates}
            placeholder="All Dates"
          />
          <MultiSelectDropdown
            label="DOF Number"
            options={uniqueDofs}
            selectedValues={selectedDofs}
            onChange={setSelectedDofs}
            placeholder="All DOFs"
          />
          <MultiSelectDropdown
            label="Partner / Unit"
            options={uniquePartners}
            selectedValues={selectedPartners}
            onChange={setSelectedPartners}
            placeholder="All Partners"
          />
          <MultiSelectDropdown
            label="Order Number"
            options={uniqueOrderNos}
            selectedValues={selectedOrderNos}
            onChange={setSelectedOrderNos}
            placeholder="All Orders"
          />
          <MultiSelectDropdown
            label="Design Number"
            options={uniqueDesignNos}
            selectedValues={selectedDesignNos}
            onChange={setSelectedDesignNos}
            placeholder="All Designs"
          />
          <MultiSelectDropdown
            label="Design Name"
            options={uniqueDesignNames}
            selectedValues={selectedDesignNames}
            onChange={setSelectedDesignNames}
            placeholder="All Names"
          />
        </div>
      )}

      {/* Data Table */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem' }}>
            <Loader size={32} className="spin" color="var(--color-primary)" />
            <p style={{ marginTop: '1rem', color: '#666' }}>Fetching logs...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem' }}>
            <History size={48} color="#ddd" style={{ marginBottom: '1rem' }} />
            <p style={{ color: '#999' }}>No movement records found.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: '#f9fafb', borderBottom: '2px solid #eee' }}>
                <th style={{ padding: '1rem' }}>Receipt #</th>
                <th style={{ padding: '1rem' }}>Date</th>
                <th style={{ padding: '1rem' }}>Source / Unit</th>
                <th style={{ padding: '1rem' }}>Orders & Designs</th>
                <th style={{ padding: '1rem' }}>Items Breakdown</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Total Qty (kg)</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r, idx) => {
                const items = r.items || r.dyed_yarn_receipt_items || [];
                const totalQty = items.reduce((acc, curr) => acc + (parseFloat(curr.quantity_kg) || 0), 0);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                      {activeTab === 'receipts' ? r.dyrr_number : r.dydr_number}
                    </td>
                    <td style={{ padding: '1rem', color: '#666' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {activeTab === 'receipts' ? (
                        <>
                          <div style={{ fontWeight: '700', color: r.source_type === 'production' ? '#64748b' : 'inherit' }}>
                            {r.source_type === 'production' ? 'Production Return' : (r.dyeing_unit?.partner_name || 'Partner Receipt')}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>
                             {r.dof_number && r.dof_number !== 'PRODUCTION_RETURN' ? `DOF: ${r.dof_number}` : ''}
                             {r.dc_number ? ` (DC: ${r.dc_number})` : ''}
                          </div>
                        </>
                      ) : (
                        (() => {
                          const firstItem = r.items?.[0] || {};
                          let formNo = '—';
                          let machineName = '';
                          if (firstItem.process_type === 'warping') {
                            const wof = wofsMap.get(firstItem.production_form_id);
                            if (wof) {
                              formNo = wof.wof_number;
                              machineName = wof.machine_name || '';
                            }
                          } else if (firstItem.process_type === 'weaving') {
                            const weaving = weavingsMap.get(firstItem.production_form_id);
                            if (weaving) {
                              formNo = weaving.weaving_number;
                              machineName = '—';
                            }
                          }
                          return (
                            <>
                              <div style={{ fontWeight: '700' }}>{formNo}</div>
                              {machineName && machineName !== '—' && (
                                <div style={{ fontSize: '0.75rem', color: '#666' }}>Machine: {machineName}</div>
                              )}
                              <div style={{ fontSize: '0.75rem', color: '#999' }}>Delivered by: {r.delivered_by || '-'}</div>
                            </>
                          );
                        })()
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {Array.from(new Set(items.map(i => i.orders?.order_number).filter(Boolean))).map((on, i) => {
                          const item = items.find(it => it.orders?.order_number === on);
                          return (
                            <div key={i} style={{ fontSize: '0.75rem' }}>
                              <div style={{ fontWeight: '800' }}>{on}</div>
                              <div style={{ color: '#666', fontSize: '0.7rem' }}>
                                {item.orders?.design_no} / {item.orders?.design_name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {(r.items || []).slice(0, 2).map((item, i) => (
                          <div key={i} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                            <span>{formatYarn(item.yarn_count_id)} - <strong>{item.colour}</strong></span>
                            <span style={{ color: '#666' }}>{item.quantity_kg}kg</span>
                          </div>
                        ))}
                        {r.items?.length > 2 && <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>+{r.items.length - 2} more items</div>}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '800' }}>
                      {totalQty.toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button 
                        onClick={() => setSelectedReceipt(r)}
                        className="btn-icon"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
