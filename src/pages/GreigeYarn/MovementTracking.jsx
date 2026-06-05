import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, SlidersHorizontal } from 'lucide-react';
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

export default function MovementTracking() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('input_mill'); // 'input_mill' | 'input_prod' | 'output'
  const [loading, setLoading] = useState(true);

  // Arrays
  const [spinningReceipts, setSpinningReceipts] = useState([]);
  const [productionReceipts, setProductionReceipts] = useState([]);
  const [deliveries, setDeliveries] = useState([]); // GYDR receipts with items

  // Modals
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedGYDR, setSelectedGYDR] = useState(null);

  // Expandable filters panel state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Greige Input Tab Filters
  const [millReceiptNos, setMillReceiptNos] = useState([]);
  const [millDates, setMillDates] = useState([]);
  const [millInvoiceNos, setMillInvoiceNos] = useState([]);
  const [millPartners, setMillPartners] = useState([]);
  const [millCounts, setMillCounts] = useState([]);

  // Greige Input from Production Tab Filters
  const [prodReceiptNos, setProdReceiptNos] = useState([]);
  const [prodDates, setProdDates] = useState([]);
  const [prodOrderForms, setProdOrderForms] = useState([]);
  const [prodCounts, setProdCounts] = useState([]);

  // Greige Output Tab Filters
  const [outGydrNos, setOutGydrNos] = useState([]);
  const [outDates, setOutDates] = useState([]);
  const [outPartners, setOutPartners] = useState([]);
  const [outDofs, setOutDofs] = useState([]);
  const [outCounts, setOutCounts] = useState([]);

  useEffect(() => {
    fetchMovements();

    // Reset filters on tab switch
    setMillReceiptNos([]);
    setMillDates([]);
    setMillInvoiceNos([]);
    setMillPartners([]);
    setMillCounts([]);

    setProdReceiptNos([]);
    setProdDates([]);
    setProdOrderForms([]);
    setProdCounts([]);

    setOutGydrNos([]);
    setOutDates([]);
    setOutPartners([]);
    setOutDofs([]);
    setOutCounts([]);
  }, [activeTab]);

  const fetchMovements = async () => {
    setLoading(true);

    // Fetch Receipts
    const { data: recData } = await supabase
      .from('greige_yarn_receipts')
      .select(`
        *,
        master_yarn_counts (count_value, material, product_type),
        master_partners (partner_name),
        master_locations (location_name),
        orders (order_number)
      `)
      .order('created_at', { ascending: false });

    // Fetch GYDR Delivery Receipts with line items
    const { data: gydrData, error: gydrError } = await supabase
      .from('greige_yarn_delivery_receipts')
      .select(`
        *,
        dyeing_order_forms(
          master_partners(partner_name)
        ),
        greige_yarn_delivery_items(
          *,
          orders(order_number, design_no, design_name),
          master_yarn_counts(count_value, material, product_type),
          master_locations(location_name),
          spinning_mill:master_partners(partner_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (recData) {
      setSpinningReceipts(recData.filter(r => r.receipt_type === 'spinning_mill'));
      setProductionReceipts(recData.filter(r => r.receipt_type === 'production'));
    }

    if (gydrData) {
      setDeliveries(gydrData);
    } else if (gydrError && gydrError.code === '42P01') {
      setDeliveries([]);
    }

    setLoading(false);
  };

  const [expandedOutputs, setExpandedOutputs] = useState({});

  const toggleExpandOutput = (key) => {
    setExpandedOutputs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // ── Dependent Filter Helper for Greige Input Tab ──
  const getFilteredSpinning = (excludeField) => {
    return spinningReceipts.filter(r => {
      if (excludeField !== 'receipt' && millReceiptNos.length > 0 && !millReceiptNos.includes(r.receipt_no)) return false;
      if (excludeField !== 'date' && millDates.length > 0) {
        const dateStr = r.created_at ? r.created_at.split('T')[0] : '';
        if (!millDates.includes(dateStr)) return false;
      }
      if (excludeField !== 'invoice' && millInvoiceNos.length > 0 && !millInvoiceNos.includes(r.invoice_no || '')) return false;
      if (excludeField !== 'partner' && millPartners.length > 0) {
        const partner = r.master_partners?.partner_name || '-';
        if (!millPartners.includes(partner)) return false;
      }
      if (excludeField !== 'count' && millCounts.length > 0) {
        const countLabel = r.master_yarn_counts ? `${r.master_yarn_counts.count_value} - ${r.master_yarn_counts.material} - ${r.master_yarn_counts.product_type}`.trim() : '-';
        if (!millCounts.includes(countLabel)) return false;
      }
      return true;
    });
  };

  // ── Unique Options for Greige Input Tab (Dependent) ──
  const uniqueMillReceiptNos = useMemo(() => {
    const data = getFilteredSpinning('receipt');
    return [...new Set(data.map(r => r.receipt_no).filter(Boolean))].sort();
  }, [spinningReceipts, millDates, millInvoiceNos, millPartners, millCounts]);

  const uniqueMillDates = useMemo(() => {
    const data = getFilteredSpinning('date');
    const dates = data.map(r => r.created_at ? r.created_at.split('T')[0] : '').filter(Boolean);
    return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  }, [spinningReceipts, millReceiptNos, millInvoiceNos, millPartners, millCounts]);

  const uniqueMillInvoiceNos = useMemo(() => {
    const data = getFilteredSpinning('invoice');
    return [...new Set(data.map(r => r.invoice_no).filter(Boolean))].sort();
  }, [spinningReceipts, millReceiptNos, millDates, millPartners, millCounts]);

  const uniqueMillPartners = useMemo(() => {
    const data = getFilteredSpinning('partner');
    return [...new Set(data.map(r => r.master_partners?.partner_name).filter(Boolean))].sort();
  }, [spinningReceipts, millReceiptNos, millDates, millInvoiceNos, millCounts]);

  const uniqueMillCounts = useMemo(() => {
    const data = getFilteredSpinning('count');
    const counts = data.map(r => {
      if (!r.master_yarn_counts) return '';
      const { count_value, material, product_type } = r.master_yarn_counts;
      return `${count_value} - ${material} - ${product_type || ''}`.trim();
    }).filter(Boolean);
    return [...new Set(counts)].sort();
  }, [spinningReceipts, millReceiptNos, millDates, millInvoiceNos, millPartners]);

  // ── Dependent Filter Helper for Greige Input from Production Tab ──
  const getFilteredProd = (excludeField) => {
    return productionReceipts.filter(r => {
      if (excludeField !== 'receipt' && prodReceiptNos.length > 0 && !prodReceiptNos.includes(r.receipt_no)) return false;
      if (excludeField !== 'date' && prodDates.length > 0) {
        const dateStr = r.created_at ? r.created_at.split('T')[0] : '';
        if (!prodDates.includes(dateStr)) return false;
      }
      if (excludeField !== 'orderForm' && prodOrderForms.length > 0 && !prodOrderForms.includes(r.order_form_no || '')) return false;
      if (excludeField !== 'count' && prodCounts.length > 0) {
        const countLabel = r.master_yarn_counts ? `${r.master_yarn_counts.count_value} - ${r.master_yarn_counts.material} - ${r.master_yarn_counts.product_type}`.trim() : '-';
        if (!prodCounts.includes(countLabel)) return false;
      }
      return true;
    });
  };

  // ── Unique Options for Greige Input from Production Tab (Dependent) ──
  const uniqueProdReceiptNos = useMemo(() => {
    const data = getFilteredProd('receipt');
    return [...new Set(data.map(r => r.receipt_no).filter(Boolean))].sort();
  }, [productionReceipts, prodDates, prodOrderForms, prodCounts]);

  const uniqueProdDates = useMemo(() => {
    const data = getFilteredProd('date');
    const dates = data.map(r => r.created_at ? r.created_at.split('T')[0] : '').filter(Boolean);
    return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  }, [productionReceipts, prodReceiptNos, prodOrderForms, prodCounts]);

  const uniqueProdOrderForms = useMemo(() => {
    const data = getFilteredProd('orderForm');
    return [...new Set(data.map(r => r.order_form_no).filter(Boolean))].sort();
  }, [productionReceipts, prodReceiptNos, prodDates, prodCounts]);

  const uniqueProdCounts = useMemo(() => {
    const data = getFilteredProd('count');
    const counts = data.map(r => {
      if (!r.master_yarn_counts) return '';
      const { count_value, material, product_type } = r.master_yarn_counts;
      return `${count_value} - ${material} - ${product_type || ''}`.trim();
    }).filter(Boolean);
    return [...new Set(counts)].sort();
  }, [productionReceipts, prodReceiptNos, prodDates, prodOrderForms]);

  // ── Dependent Filter Helper for Greige Output Tab ──
  const getFilteredDeliveries = (excludeField) => {
    return groupedDeliveries.filter(row => {
      if (excludeField !== 'gydr' && outGydrNos.length > 0 && !outGydrNos.includes(row.gydr_number)) return false;
      if (excludeField !== 'date' && outDates.length > 0) {
        const dateStr = row.created_at ? row.created_at.split('T')[0] : '';
        if (!outDates.includes(dateStr)) return false;
      }
      if (excludeField !== 'partner' && outPartners.length > 0 && !outPartners.includes(row.partner_name)) return false;
      if (excludeField !== 'dof' && outDofs.length > 0 && !outDofs.includes(row.dof_number)) return false;
      if (excludeField !== 'count' && outCounts.length > 0 && !outCounts.includes(row.yarn_label)) return false;
      return true;
    });
  };

  // ── Unique Options for Greige Output Tab (Dependent) ──
  const uniqueOutGydrNos = useMemo(() => {
    const data = getFilteredDeliveries('gydr');
    return [...new Set(data.map(r => r.gydr_number).filter(Boolean))].sort();
  }, [groupedDeliveries, outDates, outPartners, outDofs, outCounts]);

  const uniqueOutDates = useMemo(() => {
    const data = getFilteredDeliveries('date');
    const dates = data.map(r => r.created_at ? r.created_at.split('T')[0] : '').filter(Boolean);
    return [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  }, [groupedDeliveries, outGydrNos, outPartners, outDofs, outCounts]);

  const uniqueOutPartners = useMemo(() => {
    const data = getFilteredDeliveries('partner');
    return [...new Set(data.map(r => r.partner_name).filter(Boolean))].sort();
  }, [groupedDeliveries, outGydrNos, outDates, outDofs, outCounts]);

  const uniqueOutDofs = useMemo(() => {
    const data = getFilteredDeliveries('dof');
    return [...new Set(data.map(r => r.dof_number).filter(Boolean))].sort();
  }, [groupedDeliveries, outGydrNos, outDates, outPartners, outCounts]);

  const uniqueOutCounts = useMemo(() => {
    const data = getFilteredDeliveries('count');
    return [...new Set(data.map(r => r.yarn_label).filter(Boolean))].sort();
  }, [groupedDeliveries, outGydrNos, outDates, outPartners, outDofs]);

  // ── Client-side Filtered Receipts ──
  const filteredSpinningReceipts = useMemo(() => {
    return spinningReceipts.filter(r => {
      if (millReceiptNos.length > 0 && !millReceiptNos.includes(r.receipt_no)) return false;
      if (millDates.length > 0) {
        const dateStr = r.created_at ? r.created_at.split('T')[0] : '';
        if (!millDates.includes(dateStr)) return false;
      }
      if (millInvoiceNos.length > 0 && !millInvoiceNos.includes(r.invoice_no || '')) return false;
      if (millPartners.length > 0) {
        const partner = r.master_partners?.partner_name || '-';
        if (!millPartners.includes(partner)) return false;
      }
      if (millCounts.length > 0) {
        const countLabel = r.master_yarn_counts ? `${r.master_yarn_counts.count_value} - ${r.master_yarn_counts.material} - ${r.master_yarn_counts.product_type}`.trim() : '-';
        if (!millCounts.includes(countLabel)) return false;
      }
      return true;
    });
  }, [spinningReceipts, millReceiptNos, millDates, millInvoiceNos, millPartners, millCounts]);

  const filteredProductionReceipts = useMemo(() => {
    return productionReceipts.filter(r => {
      if (prodReceiptNos.length > 0 && !prodReceiptNos.includes(r.receipt_no)) return false;
      if (prodDates.length > 0) {
        const dateStr = r.created_at ? r.created_at.split('T')[0] : '';
        if (!prodDates.includes(dateStr)) return false;
      }
      if (prodOrderForms.length > 0 && !prodOrderForms.includes(r.order_form_no || '')) return false;
      if (prodCounts.length > 0) {
        const countLabel = r.master_yarn_counts ? `${r.master_yarn_counts.count_value} - ${r.master_yarn_counts.material} - ${r.master_yarn_counts.product_type}`.trim() : '-';
        if (!prodCounts.includes(countLabel)) return false;
      }
      return true;
    });
  }, [productionReceipts, prodReceiptNos, prodDates, prodOrderForms, prodCounts]);

  // Group spinning receipts by receipt_no
  const groupedSpinningReceipts = React.useMemo(() => {
    const groups = {};
    filteredSpinningReceipts.forEach(r => {
      const key = r.receipt_no;
      if (!groups[key]) {
        groups[key] = {
          receipt_no: r.receipt_no,
          created_at: r.created_at,
          invoice_no: r.invoice_no,
          invoice_date: r.invoice_date,
          partner_name: r.master_partners?.partner_name || '-',
          items: [],
          rawReceipts: []
        };
      }
      groups[key].items.push({
        yarn_label: r.master_yarn_counts ? `${r.master_yarn_counts.count_value} - ${r.master_yarn_counts.material} - ${r.master_yarn_counts.product_type}` : '-',
        bag_count: r.bag_count || 0,
        cone_count: r.cone_count || 0,
        bag_weight: Number(r.bag_weight || 0).toFixed(2),
        cone_weight: Number(r.cone_weight || 0).toFixed(2),
        total_weight: Number(r.total_weight || 0).toFixed(2),
        rate_per_kg: Number(r.rate_per_kg || 0).toFixed(2),
        location_name: r.master_locations?.location_name || '-'
      });
      groups[key].rawReceipts.push(r);
    });
    return Object.values(groups);
  }, [filteredSpinningReceipts]);

  // Group production receipts by receipt_no
  const groupedProductionReceipts = React.useMemo(() => {
    const groups = {};
    filteredProductionReceipts.forEach(r => {
      const key = r.receipt_no;
      if (!groups[key]) {
        groups[key] = {
          receipt_no: r.receipt_no,
          created_at: r.created_at,
          order_form_no: r.order_form_no || '-',
          items: [],
          rawReceipts: []
        };
      }
      groups[key].items.push({
        yarn_label: r.master_yarn_counts ? `${r.master_yarn_counts.count_value} - ${r.master_yarn_counts.material} - ${r.master_yarn_counts.product_type}` : '-',
        yarn_type: r.yarn_type || '',
        colour: r.colour || '',
        order_no: r.orders?.order_number || '',
        bag_count: r.bag_count || 0,
        cone_count: r.cone_count || 0,
        bag_weight: Number(r.bag_weight || 0).toFixed(2),
        cone_weight: Number(r.cone_weight || 0).toFixed(2),
        total_weight: Number(r.total_weight || 0).toFixed(2),
        location_name: r.master_locations?.location_name || '-'
      });
      groups[key].rawReceipts.push(r);
    });
    return Object.values(groups);
  }, [filteredProductionReceipts]);

  // Group deliveries (greige yarn output) by receipt and countId
  const groupedDeliveries = React.useMemo(() => {
    const list = [];
    deliveries.forEach(r => {
      const countGroups = {};
      (r.greige_yarn_delivery_items || []).forEach(item => {
        const countId = item.yarn_count_id;
        if (!countGroups[countId]) {
          countGroups[countId] = {
            countId,
            yarn_label: item.master_yarn_counts
              ? `${item.master_yarn_counts.count_value} - ${item.master_yarn_counts.material} - ${item.master_yarn_counts.product_type}`
              : '-',
            total_qty: 0,
            locations: [],
            items: []
          };
        }
        countGroups[countId].total_qty += parseFloat(item.quantity_kg || 0);
        const loc = item.master_locations?.location_name || '-';
        if (loc !== '-' && !countGroups[countId].locations.includes(loc)) {
          countGroups[countId].locations.push(loc);
        }
        countGroups[countId].items.push(item);
      });

      if (Object.keys(countGroups).length === 0) {
        list.push({
          receiptId: r.id,
          gydr_number: r.gydr_number,
          dof_number: r.dof_number,
          partner_name: r.dyeing_order_forms?.master_partners?.partner_name || '-',
          created_at: r.created_at,
          countId: 'empty',
          yarn_label: '-',
          total_qty: 0,
          locations_str: '-',
          items: [],
          receiptObj: r
        });
      } else {
        Object.values(countGroups).forEach(g => {
          list.push({
            receiptId: r.id,
            gydr_number: r.gydr_number,
            dof_number: r.dof_number,
            partner_name: r.dyeing_order_forms?.master_partners?.partner_name || '-',
            created_at: r.created_at,
            countId: g.countId,
            yarn_label: g.yarn_label,
            total_qty: g.total_qty,
            locations_str: g.locations.join(', ') || '-',
            items: g.items,
            receiptObj: r
          });
        });
      }
    });
    return list;
  }, [deliveries]);

  // Client-side Filtered Deliveries (flat filter on groupedDeliveries)
  const filteredGroupedDeliveries = React.useMemo(() => {
    return groupedDeliveries.filter(row => {
      if (outGydrNos.length > 0 && !outGydrNos.includes(row.gydr_number)) return false;
      if (outDates.length > 0) {
        const dateStr = row.created_at ? row.created_at.split('T')[0] : '';
        if (!outDates.includes(dateStr)) return false;
      }
      if (outPartners.length > 0 && !outPartners.includes(row.partner_name)) return false;
      if (outDofs.length > 0 && !outDofs.includes(row.dof_number)) return false;
      if (outCounts.length > 0 && !outCounts.includes(row.yarn_label)) return false;
      return true;
    });
  }, [groupedDeliveries, outGydrNos, outDates, outPartners, outDofs, outCounts]);

  return (
    <div style={{ width: '100%', padding: '1rem' }} className="fade-in">

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
          Track Yarn Movement
        </h1>
        <p style={{ color: 'var(--text-muted-current)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
          View all greige yarn receipts and deliveries
        </p>
      </div>

      <div className="glass-panel" style={{ padding: 0 }}>
        {/* Tabs and Filters Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-current)',
          padding: '0 1.5rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '2rem' }}>
            {[
              { key: 'input_mill', label: `Greige Input (${spinningReceipts.length})` },
              { key: 'input_prod', label: `Greige Input from Production (${productionReceipts.length})` },
              { key: 'output', label: `Greige Output (${deliveries.length})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background: 'none', border: 'none', padding: '1.25rem 0', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem',
                  color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--text-muted-current)',
                  borderBottom: activeTab === tab.key ? '3px solid var(--color-primary)' : '3px solid transparent',
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
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
              gap: '0.5rem',
              margin: '0.5rem 0'
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }} className="fade-in">
            {activeTab === 'input_mill' && (
              <>
                <MultiSelectDropdown
                  label="Receipt Number"
                  options={uniqueMillReceiptNos}
                  selectedValues={millReceiptNos}
                  onChange={setMillReceiptNos}
                  placeholder="All Receipts"
                />
                <MultiSelectDropdown
                  label="Date"
                  options={uniqueMillDates}
                  selectedValues={millDates}
                  onChange={setMillDates}
                  placeholder="All Dates"
                />
                <MultiSelectDropdown
                  label="Invoice Number"
                  options={uniqueMillInvoiceNos}
                  selectedValues={millInvoiceNos}
                  onChange={setMillInvoiceNos}
                  placeholder="All Invoices"
                />
                <MultiSelectDropdown
                  label="Mill Name"
                  options={uniqueMillPartners}
                  selectedValues={millPartners}
                  onChange={setMillPartners}
                  placeholder="All Mills"
                />
                <MultiSelectDropdown
                  label="Yarn Count"
                  options={uniqueMillCounts}
                  selectedValues={millCounts}
                  onChange={setMillCounts}
                  placeholder="All Counts"
                />
              </>
            )}

            {activeTab === 'input_prod' && (
              <>
                <MultiSelectDropdown
                  label="Receipt Number"
                  options={uniqueProdReceiptNos}
                  selectedValues={prodReceiptNos}
                  onChange={setProdReceiptNos}
                  placeholder="All Receipts"
                />
                <MultiSelectDropdown
                  label="Date"
                  options={uniqueProdDates}
                  selectedValues={prodDates}
                  onChange={setProdDates}
                  placeholder="All Dates"
                />
                <MultiSelectDropdown
                  label="Order Form Number"
                  options={uniqueProdOrderForms}
                  selectedValues={prodOrderForms}
                  onChange={setProdOrderForms}
                  placeholder="All Orders"
                />
                <MultiSelectDropdown
                  label="Yarn Count"
                  options={uniqueProdCounts}
                  selectedValues={prodCounts}
                  onChange={setProdCounts}
                  placeholder="All Counts"
                />
              </>
            )}

            {activeTab === 'output' && (
              <>
                <MultiSelectDropdown
                  label="GYDR Number"
                  options={uniqueOutGydrNos}
                  selectedValues={outGydrNos}
                  onChange={setOutGydrNos}
                  placeholder="All GYDRs"
                />
                <MultiSelectDropdown
                  label="Date"
                  options={uniqueOutDates}
                  selectedValues={outDates}
                  onChange={setOutDates}
                  placeholder="All Dates"
                />
                <MultiSelectDropdown
                  label="Partner / Unit"
                  options={uniqueOutPartners}
                  selectedValues={outPartners}
                  onChange={setOutPartners}
                  placeholder="All Partners"
                />
                <MultiSelectDropdown
                  label="DOF Number"
                  options={uniqueOutDofs}
                  selectedValues={outDofs}
                  onChange={setOutDofs}
                  placeholder="All DOFs"
                />
                <MultiSelectDropdown
                  label="Yarn Count"
                  options={uniqueOutCounts}
                  selectedValues={outCounts}
                  onChange={setOutCounts}
                  placeholder="All Counts"
                />
              </>
            )}
          </div>
        )}

        {/* Table */}
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}><Loader size={24} className="spin" /></div>
          ) : (
            <table className="table" style={{ fontSize: '0.85rem', width: '100%' }}>
              <thead>
                <tr>
                  {activeTab === 'input_mill' && (<>
                    <th>Receipt No</th><th>Date & Time</th><th>Invoice No</th><th>Invoice Date</th>
                    <th>Mill Name</th><th>Count</th><th>Bags</th><th>Cones</th>
                    <th>Wt/Bag (kg)</th><th>Wt/Cone (kg)</th>
                    <th style={{ color: '#16a34a', textAlign: 'center' }}>Total (kg)</th>
                    <th>Rate/KG (₹)</th><th>Location</th><th style={{ textAlign: 'right' }}>Action</th>
                  </>)}
                  {activeTab === 'input_prod' && (<>
                    <th>Receipt No</th><th>Date & Time</th><th>Order Form No</th><th>Count</th>
                    <th>Bags</th><th>Cones</th><th>Wt/Bag (kg)</th><th>Wt/Cone (kg)</th>
                    <th style={{ color: '#16a34a', textAlign: 'center' }}>Total (kg)</th>
                    <th>Location</th><th style={{ textAlign: 'right' }}>Action</th>
                  </>)}
                  {activeTab === 'output' && (<>
                    <th>GYDR Number</th><th>Date & Time</th><th>Partner / Unit</th><th>DOF #</th>
                    <th>Count</th><th style={{ color: '#dc2626', textAlign: 'right' }}>Qty Issued (kg)</th>
                    <th>Location</th><th style={{ textAlign: 'center' }}>Details</th><th style={{ textAlign: 'center' }}>Receipt</th>
                  </>)}
                </tr>
              </thead>
              <tbody>
                {/* ── Spinning Mill Input ── */}
                {activeTab === 'input_mill' && (
                  groupedSpinningReceipts.length === 0
                    ? <tr><td colSpan={14} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>No incoming mill receipts found</td></tr>
                    : groupedSpinningReceipts.map(group => {
                        return group.items.map((item, idx) => (
                          <tr key={`${group.receipt_no}-${idx}`} style={{ borderBottom: idx === group.items.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                            {idx === 0 && (
                              <>
                                <td rowSpan={group.items.length} style={{ fontWeight: 'bold', verticalAlign: 'middle' }}>{group.receipt_no}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{new Date(group.created_at).toLocaleString()}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{group.invoice_no || '-'}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{group.invoice_date || '-'}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{group.partner_name}</td>
                              </>
                            )}
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.yarn_label}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.bag_count}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.cone_count}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.bag_weight}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.cone_weight}</td>
                            <td style={{ fontWeight: 'bold', color: '#16a34a', textAlign: 'center', borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.total_weight}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>₹{item.rate_per_kg}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.location_name}</td>
                            {idx === 0 && (
                              <td rowSpan={group.items.length} style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                                <button onClick={() => setSelectedReceipt(group.rawReceipts[0])} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0 }}>View</button>
                              </td>
                            )}
                          </tr>
                        ));
                      })
                )}

                {/* ── Production Input ── */}
                {activeTab === 'input_prod' && (
                  groupedProductionReceipts.length === 0
                    ? <tr><td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>No incoming production receipts found</td></tr>
                    : groupedProductionReceipts.map(group => {
                        return group.items.map((item, idx) => (
                          <tr key={`${group.receipt_no}-${idx}`} style={{ borderBottom: idx === group.items.length - 1 ? '1px solid var(--border-current)' : 'none' }}>
                            {idx === 0 && (
                              <>
                                <td rowSpan={group.items.length} style={{ fontWeight: 'bold', verticalAlign: 'middle' }}>{group.receipt_no}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{new Date(group.created_at).toLocaleString()}</td>
                                <td rowSpan={group.items.length} style={{ verticalAlign: 'middle' }}>{group.order_form_no}</td>
                              </>
                            )}
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>
                              <div>{item.yarn_label}</div>
                              {(item.colour || item.yarn_type || item.order_no) && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                  {[item.yarn_type, item.colour, item.order_no].filter(Boolean).join(' • ')}
                                </div>
                              )}
                            </td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.bag_count}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.cone_count}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.bag_weight}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.cone_weight}</td>
                            <td style={{ fontWeight: 'bold', color: '#16a34a', textAlign: 'center', borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.total_weight}</td>
                            <td style={{ borderBottom: idx === group.items.length - 1 ? '' : '1px dashed var(--border-current)' }}>{item.location_name}</td>
                            {idx === 0 && (
                              <td rowSpan={group.items.length} style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                                <button onClick={() => setSelectedReceipt(group.rawReceipts[0])} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0 }}>View</button>
                              </td>
                            )}
                          </tr>
                        ));
                      })
                )}

                {/* ── GYDR Output ── */}
                {activeTab === 'output' && (
                  filteredGroupedDeliveries.length === 0
                    ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>No greige yarn deliveries logged yet.</td></tr>
                    : filteredGroupedDeliveries.map(row => {
                        const expandKey = `${row.receiptId}-${row.countId}`;
                        const isExpanded = !!expandedOutputs[expandKey];
                        
                        return (
                          <React.Fragment key={expandKey}>
                            <tr style={{ backgroundColor: isExpanded ? 'rgba(var(--color-primary-rgb, 128,0,0), 0.02)' : undefined, borderBottom: '1px solid var(--border-current)' }}>
                              <td style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{row.gydr_number}</td>
                              <td>{new Date(row.created_at).toLocaleString()}</td>
                              <td>{row.partner_name}</td>
                              <td>{row.dof_number}</td>
                              <td style={{ fontWeight: '600' }}>{row.yarn_label}</td>
                              <td style={{ fontWeight: 'bold', color: '#dc2626', textAlign: 'right' }}>{row.total_qty.toFixed(2)}</td>
                              <td>{row.locations_str}</td>
                              <td style={{ textAlign: 'center' }}>
                                {row.items.length > 0 ? (
                                  <button
                                    onClick={() => toggleExpandOutput(expandKey)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: '700' }}
                                  >
                                    {isExpanded ? 'Hide Details' : 'Show Details'} ({row.items.length})
                                  </button>
                                ) : '-'}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  onClick={() => setSelectedGYDR(row.receiptObj)}
                                  style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}
                                >
                                  View Receipt
                                </button>
                              </td>
                            </tr>
                            
                            {isExpanded && row.items.length > 0 && (
                              <tr>
                                <td colSpan={9} style={{ padding: '0.5rem 1.5rem', backgroundColor: '#fcfaf9' }}>
                                  <div style={{
                                    padding: '0.5rem 1rem',
                                    border: '1px solid var(--border-current)',
                                    borderRadius: 'var(--radius-md)',
                                    backgroundColor: 'var(--surface-current)'
                                  }}>
                                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-current)', color: 'var(--text-muted-current)', textAlign: 'left' }}>
                                          <th style={{ padding: '6px 8px' }}>Order & Design</th>
                                          <th style={{ padding: '6px 8px' }}>Colour</th>
                                          <th style={{ padding: '6px 8px' }}>Issued From Location</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty Issued (kg)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {row.items.map((item, i) => (
                                          <tr key={item.id || i} style={{ borderBottom: i === row.items.length - 1 ? 'none' : '1px solid var(--border-current)' }}>
                                            <td style={{ padding: '6px 8px' }}>{item.orders ? `${item.orders.order_number} (${item.orders.design_no} / ${item.orders.design_name})` : '-'}</td>
                                            <td style={{ padding: '6px 8px', fontWeight: '700', color: 'var(--color-primary)' }}>{item.colour}</td>
                                            <td style={{ padding: '6px 8px' }}>{item.master_locations?.location_name || '-'}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>{parseFloat(item.quantity_kg).toFixed(2)} kg</td>
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
          )}
        </div>
      </div>

      {/* Greige Yarn Receipt Modal */}
      {selectedReceipt && (
        <ReceiptPrintModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}

      {/* GYDR Quick View Modal */}
      {selectedGYDR && (
        <GYDRQuickView receipt={selectedGYDR} onClose={() => setSelectedGYDR(null)} />
      )}
    </div>
  );
}

// ── Inline GYDR Quick View Modal ──
function GYDRQuickView({ receipt, onClose }) {
  const items = receipt.greige_yarn_delivery_items || [];
  const total = items.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
          <div>
            <span style={{ fontWeight: '800', color: '#7f1d1d', fontSize: '1rem' }}>{receipt.gydr_number}</span>
            <span style={{ marginLeft: '1rem', fontSize: '0.8rem', color: '#64748b' }}>DOF: {receipt.dof_number}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => window.print()} style={{ padding: '5px 12px', backgroundColor: '#7f1d1d', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}>🖨 Print</button>
            <button onClick={onClose} style={{ padding: '5px 12px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <div><strong>Delivered By:</strong> {receipt.delivered_by}</div>
            <div><strong>Vehicle:</strong> {receipt.vehicle_no || '—'}</div>
            <div><strong>Date:</strong> {new Date(receipt.created_at).toLocaleString('en-IN')}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#7f1d1d', color: '#fff' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px' }}>Count</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px' }}>Colour</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px' }}>Spinning Mill</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px' }}>Location</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px' }}>Qty (kg)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? '#f9fafb' : '#fff', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>
                    {item.master_yarn_counts
                      ? `${item.master_yarn_counts.count_value} - ${item.master_yarn_counts.material} - ${item.master_yarn_counts.product_type}`
                      : '-'}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{item.colour}</td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>
                    {item.spinning_mill?.partner_name || (item.spinning_mill_id ? 'Unknown Mill' : 'Production Returns')}
                  </td>
                  <td style={{ padding: '6px 10px', fontSize: '12px' }}>{item.master_locations?.location_name || '-'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', fontSize: '12px' }}>{parseFloat(item.quantity_kg).toFixed(2)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #7f1d1d' }}>
                <td colSpan={4} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', fontSize: '12px' }}>TOTAL:</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#7f1d1d' }}>{total.toFixed(2)} kg</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
