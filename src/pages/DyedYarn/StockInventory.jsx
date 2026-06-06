import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Loader, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Layers, 
  Download, 
  Truck,
  RotateCcw,
  Check
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// Multi-Select Dropdown Component with Search
function MultiSelectDropdown({ title, options, selected, onChange, labelMapping }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    return options.filter(opt => {
      const displayLabel = labelMapping ? labelMapping(opt) : String(opt);
      return displayLabel.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [options, searchTerm, labelMapping]);

  const handleToggleOption = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = () => {
    onChange(options);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const displayText = useMemo(() => {
    if (selected.length === 0) return `All ${title}s`;
    if (selected.length === options.length) return `All ${title}s`;
    return `${title} (${selected.length} selected)`;
  }, [selected, options, title]);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', minWidth: '180px', flex: 1 }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '0.6rem 1rem',
          borderRadius: '8px',
          border: '1px solid var(--border-current)',
          backgroundColor: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          fontSize: '0.825rem',
          fontWeight: selected.length > 0 ? '700' : '500',
          borderColor: selected.length > 0 ? '#800000' : 'var(--border-current)',
          color: selected.length > 0 ? '#800000' : 'var(--text-current)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          outline: 'none'
        }}
      >
        <span>{displayText}</span>
        <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 1000,
          backgroundColor: '#fff',
          padding: '0.75rem',
          minWidth: '220px'
        }}>
          {options.length > 5 && (
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem',
                fontSize: '0.8rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                marginBottom: '0.5rem',
                outline: 'none'
              }}
            />
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0
              }}
            >
              Select All
            </button>
            <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>|</span>
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {filteredOptions.length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem' }}>No options available</span>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt);
                const displayLabel = labelMapping ? labelMapping(opt) : String(opt);
                return (
                  <label
                    key={String(opt)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-current)',
                      cursor: 'pointer',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px',
                      backgroundColor: isChecked ? '#fff5f5' : 'transparent',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleOption(opt)}
                      style={{
                        accentColor: '#800000',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ fontWeight: isChecked ? '700' : '500' }}>{displayLabel}</span>
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

export default function StockInventory() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Loading & Master States
  const [loading, setLoading] = useState(true);
  const [dofRecords, setDofRecords] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);

  // Expanded DOF details map: key = dof_id => boolean
  const [expandedDofs, setExpandedDofs] = useState({});

  // Collapsed transaction panels state: key = `${recordId}||${txType}` => boolean
  const [expandedTxs, setExpandedTxs] = useState({});

  const handleToggleTx = (recordId, txType) => {
    const key = `${recordId}||${txType}`;
    setExpandedTxs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Filter States
  const [selectedDofs, setSelectedDofs] = useState([]);
  const [selectedDesignNames, setSelectedDesignNames] = useState([]);
  const [selectedDesignNos, setSelectedDesignNos] = useState([]);
  const [selectedCounts, setSelectedCounts] = useState([]);
  const [selectedColours, setSelectedColours] = useState([]);
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);

  // Load Base Route
  const basePath = profile?.role === 'admin' ? '/admin' : '/merchandiser';

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      // Fetch all required data in parallel
      const [
        dofRes,
        ordersRes,
        gydiRes,
        dyriRes,
        dydiRes,
        countsRes,
        wofsRes,
        weavingsRes
      ] = await Promise.all([
        supabase
          .from('dyeing_order_forms')
          .select(`
            *,
            dyeing_unit:master_partners(partner_name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('id, order_number, design_no, design_name'),
        supabase
          .from('greige_yarn_delivery_items')
          .select(`
            *,
            receipt:greige_yarn_delivery_receipts(dof_id)
          `),
        supabase
          .from('dyed_yarn_receipt_items')
          .select(`
            *,
            receipt:dyed_yarn_receipts(dof_id, dyrr_number, received_date, dc_number, vehicle_no, received_by, remarks),
            location:master_locations(location_name)
          `),
        supabase
          .from('dyed_yarn_delivery_items')
          .select(`
            *,
            delivery:dyed_yarn_deliveries(dydr_number, delivered_date, delivered_by, vehicle_no, remarks),
            location:master_locations(location_name),
            source_receipt:dyed_yarn_receipts(dof_id, dof_number)
          `),
        supabase
          .from('master_yarn_counts')
          .select('*'),
        supabase
          .from('warping_order_forms')
          .select('id, wof_number, machine_name'),
        supabase
          .from('weaving_orders')
          .select('id, weaving_number')
      ]);

      if (dofRes.error) throw dofRes.error;

      const allDofs = dofRes.data || [];
      const orders = ordersRes.data || [];
      const gydi = gydiRes.data || [];
      const dyri = dyriRes.data || [];
      const dydi = dydiRes.data || [];
      const counts = countsRes.data || [];
      const wofs = wofsRes.data || [];
      const weavings = weavingsRes.data || [];

      setYarnCounts(counts);

      // Filter: ONLY Approved DOFs (not pending, not rejected)
      const approvedDofs = allDofs.filter(
        d => d.status !== 'pending' && d.status !== 'rejected'
      );

      // Fast Lookup maps
      const ordersMap = new Map(orders.map(o => [o.id, o]));
      const countsMap = new Map(counts.map(c => [c.id, c]));
      const wofsMap = new Map(wofs.map(w => [w.id, w]));
      const weavingsMap = new Map(weavings.map(w => [w.id, w]));

      // Process each approved DOF to calculate inventories & transaction logs
      const records = approvedDofs.map(dof => {
        // Resolve linked orders metadata
        const linkedOrders = (dof.order_ids || [])
          .map(id => ordersMap.get(id))
          .filter(Boolean);

        const orderNumbers = Array.from(new Set(linkedOrders.map(o => o.order_number)));
        const designNos = Array.from(new Set(linkedOrders.map(o => o.design_no).filter(Boolean)));
        const designNames = Array.from(new Set(linkedOrders.map(o => o.design_name).filter(Boolean)));

        // Filter transaction items for this DOF
        const formGydi = gydi.filter(item => item.receipt?.dof_id === dof.id);
        const formDyri = dyri.filter(item => item.receipt?.dof_id === dof.id);

        // Find matching dyed delivery items
        const formReceivedLots = new Set(
          formDyri
            .map(r => `${r.yarn_count_id}||${r.colour}||${r.lot_number}`)
            .filter(Boolean)
        );
        const formDydi = dydi.filter(item => {
          // If the delivery item has a source_receipt with dof_id, match it EXACTLY!
          if (item.source_receipt?.dof_id) {
            return item.source_receipt.dof_id === dof.id;
          }

          // Legacy fallback:
          const matchesOrder = dof.order_ids?.includes(item.order_id);
          if (!matchesOrder) return false;

          // Match by lot if available
          if (item.lot_number) {
            const lotKey = `${item.yarn_count_id}||${item.colour}||${item.lot_number}`;
            return formReceivedLots.has(lotKey);
          }

          // Fallback: match by colour and yarn count in allocations
          return (dof.yarn_allocations || []).some(
            alloc => alloc.countId === item.yarn_count_id && alloc.colour === item.colour
          );
        });

        // Unique combinations of yarn count, colour, and lot number in this DOF
        const yarnKeys = new Set();
        (dof.yarn_allocations || []).forEach(a => yarnKeys.add(`${a.countId}||${a.colour}||—`));
        formDyri.forEach(i => yarnKeys.add(`${i.yarn_count_id}||${i.colour}||${i.lot_number || '—'}`));
        formDydi.forEach(i => yarnKeys.add(`${i.yarn_count_id}||${i.colour}||${i.lot_number || '—'}`));

        // Build inventory rows
        let totalDofInventoryBalance = 0;
        const rawInventoryRows = Array.from(yarnKeys).map(key => {
          const [countId, colour, lotNumber] = key.split('||');
          
          const matchingDyri = formDyri.filter(i => 
            i.yarn_count_id === countId && 
            i.colour === colour && 
            (i.lot_number || '—') === lotNumber
          );
          const matchingDydi = formDydi.filter(i => 
            i.yarn_count_id === countId && 
            i.colour === colour && 
            (i.lot_number || '—') === lotNumber
          );

          const dyedReceived = matchingDyri.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);
          const dyedDelivered = matchingDydi.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);
          const balance = dyedReceived - dyedDelivered;

          totalDofInventoryBalance += balance;

          // Map Location details: track balance per location
          const locationBalances = {};
          matchingDyri.forEach(i => {
            const locName = i.location?.location_name || '—';
            if (!locationBalances[locName]) locationBalances[locName] = { received: 0, delivered: 0 };
            locationBalances[locName].received += parseFloat(i.quantity_kg || 0);
          });
          matchingDydi.forEach(i => {
            const locName = i.location?.location_name || '—';
            if (!locationBalances[locName]) locationBalances[locName] = { received: 0, delivered: 0 };
            locationBalances[locName].delivered += parseFloat(i.quantity_kg || 0);
          });

          // List locations with active stock
          const activeLocations = Object.entries(locationBalances)
            .filter(([_, qty]) => (qty.received - qty.delivered) > 0.01)
            .map(([locName, _]) => locName);

          // Fallback to all received locations if balance is 0
          const locationDisplay = activeLocations.length > 0 
            ? activeLocations.join(', ') 
            : (Object.keys(locationBalances).join(', ') || '—');

          return {
            countId,
            colour,
            lotNumber,
            dyedReceived,
            dyedDelivered,
            balance,
            locationDisplay
          };
        });

        // Filter out empty '—' lot rows if there are active transactions with real lot numbers for the same count+colour
        const activeCountColours = new Set(
          rawInventoryRows
            .filter(r => r.dyedReceived > 0 || r.dyedDelivered > 0)
            .map(r => `${r.countId}||${r.colour}`)
        );
        const inventoryRows = rawInventoryRows.filter(r => {
          if (r.dyedReceived > 0 || r.dyedDelivered > 0) return true;
          // Keep the 0-activity row only if there are no active transactions for this count+colour
          return !activeCountColours.has(`${r.countId}||${r.colour}`);
        });

        // Group Dyed Receipts (DYRR) for audit logs
        const dyrrGroups = {};
        formDyri.forEach(item => {
          const receipt = item.receipt;
          if (!receipt) return;
          if (!dyrrGroups[receipt.dyrr_number]) {
            dyrrGroups[receipt.dyrr_number] = {
              dyrr_number: receipt.dyrr_number,
              received_date: receipt.received_date,
              received_by: receipt.received_by || '—',
              vehicle_no: receipt.vehicle_no || '—',
              remarks: receipt.remarks || '—',
              items: []
            };
          }

          const currentItems = dyrrGroups[receipt.dyrr_number].items;
          const lotNum = item.lot_number || '—';
          const locName = item.location?.location_name || '—';

          // Check if an item with the same colour, yarn count, and lot number already exists
          const existing = currentItems.find(it => 
            it.colour === item.colour && 
            it.yarn_count_id === item.yarn_count_id && 
            it.lot_number === lotNum
          );

          if (existing) {
            existing.quantity_kg += parseFloat(item.quantity_kg || 0);
            // Combine locations uniquely
            const existingLocs = existing.location.split(', ').map(l => l.trim());
            if (!existingLocs.includes(locName)) {
              existingLocs.push(locName);
              existing.location = existingLocs.filter(l => l !== '—' || existingLocs.length === 1).join(', ');
            }
          } else {
            currentItems.push({
              colour: item.colour,
              yarn_count_id: item.yarn_count_id,
              lot_number: lotNum,
              location: locName,
              quantity_kg: parseFloat(item.quantity_kg || 0)
            });
          }
        });

        // Group Dyed Deliveries (DYDR) for audit logs
        const dydrGroups = {};
        formDydi.forEach(item => {
          const delivery = item.delivery;
          if (!delivery) return;
          if (!dydrGroups[delivery.dydr_number]) {
            dydrGroups[delivery.dydr_number] = {
              dydr_number: delivery.dydr_number,
              delivered_date: delivery.delivered_date,
              delivered_by: delivery.delivered_by || '—',
              vehicle_no: delivery.vehicle_no || '—',
              remarks: delivery.remarks || '—',
              targetFormNo: '—',
              targetMachine: '—',
              items: []
            };
          }

          let targetFormNo = '—';
          let targetMachine = '—';
          if (item.process_type === 'warping') {
            const wof = wofsMap.get(item.production_form_id);
            if (wof) {
              targetFormNo = wof.wof_number;
              targetMachine = wof.machine_name || '—';
            }
          } else if (item.process_type === 'weaving') {
            const weaving = weavingsMap.get(item.production_form_id);
            if (weaving) {
              targetFormNo = weaving.weaving_number;
              targetMachine = '—';
            }
          }

          dydrGroups[delivery.dydr_number].targetFormNo = targetFormNo;
          dydrGroups[delivery.dydr_number].targetMachine = targetMachine;

          dydrGroups[delivery.dydr_number].items.push({
            colour: item.colour,
            yarn_count_id: item.yarn_count_id,
            lot_number: item.lot_number || '—',
            location: item.location?.location_name || '—',
            quantity_kg: parseFloat(item.quantity_kg || 0),
            targetFormNo,
            targetMachine,
            process_type: item.process_type
          });
        });

        return {
          id: dof.id,
          dof_number: dof.dof_number,
          dyeing_unit_name: dof.dyeing_unit?.partner_name || '—',
          orderNumbers,
          designNos,
          designNames,
          counts: Array.from(new Set(inventoryRows.map(r => r.countId))),
          colours: Array.from(new Set(inventoryRows.map(r => r.colour))),
          inventoryRows,
          totalInventoryBalance: Math.max(0, totalDofInventoryBalance),
          dyrrList: Object.values(dyrrGroups).sort((a, b) => {
            const dateA = a.received_date ? new Date(a.received_date).getTime() : 0;
            const dateB = b.received_date ? new Date(b.received_date).getTime() : 0;
            return dateB - dateA;
          }),
          dydrList: Object.values(dydrGroups).sort((a, b) => {
            const dateA = a.delivered_date ? new Date(a.delivered_date).getTime() : 0;
            const dateB = b.delivered_date ? new Date(b.delivered_date).getTime() : 0;
            return dateB - dateA;
          })
        };
      });

      setDofRecords(records);
    } catch (err) {
      console.error(err);
      alert('Error loading inventory data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getFormatCount = (countId) => {
    const yc = yarnCounts.find(y => y.id === countId);
    if (!yc) return '—';
    return `${yc.count_value} ${yc.material} ${yc.product_type}`;
  };

  // ── FILTER IMPLEMENTATION ──

  // Determine filtered list of DOFs based on active filters
  const filteredDofs = useMemo(() => {
    return dofRecords.filter(rec => {
      const matchDof = selectedDofs.length === 0 || selectedDofs.includes(rec.dof_number);
      const matchDesignName = selectedDesignNames.length === 0 || rec.designNames.some(n => selectedDesignNames.includes(n));
      const matchDesignNo = selectedDesignNos.length === 0 || rec.designNos.some(n => selectedDesignNos.includes(n));
      const matchCount = selectedCounts.length === 0 || rec.counts.some(c => selectedCounts.includes(c));
      const matchColour = selectedColours.length === 0 || rec.colours.some(c => selectedColours.includes(c));
      return matchDof && matchDesignName && matchDesignNo && matchCount && matchColour;
    });
  }, [dofRecords, selectedDofs, selectedDesignNames, selectedDesignNos, selectedCounts, selectedColours]);

  // Compute available options dynamically using cascade logic
  const filterOptions = useMemo(() => {
    const getDofOptions = () => {
      const matching = dofRecords.filter(rec => {
        const matchDesignName = selectedDesignNames.length === 0 || rec.designNames.some(n => selectedDesignNames.includes(n));
        const matchDesignNo = selectedDesignNos.length === 0 || rec.designNos.some(n => selectedDesignNos.includes(n));
        const matchCount = selectedCounts.length === 0 || rec.counts.some(c => selectedCounts.includes(c));
        const matchColour = selectedColours.length === 0 || rec.colours.some(c => selectedColours.includes(c));
        return matchDesignName && matchDesignNo && matchCount && matchColour;
      });
      return Array.from(new Set(matching.map(r => r.dof_number))).sort();
    };

    const getDesignNameOptions = () => {
      const matching = dofRecords.filter(rec => {
        const matchDof = selectedDofs.length === 0 || selectedDofs.includes(rec.dof_number);
        const matchDesignNo = selectedDesignNos.length === 0 || rec.designNos.some(n => selectedDesignNos.includes(n));
        const matchCount = selectedCounts.length === 0 || rec.counts.some(c => selectedCounts.includes(c));
        const matchColour = selectedColours.length === 0 || rec.colours.some(c => selectedColours.includes(c));
        return matchDof && matchDesignNo && matchCount && matchColour;
      });
      return Array.from(new Set(matching.flatMap(r => r.designNames))).sort();
    };

    const getDesignNoOptions = () => {
      const matching = dofRecords.filter(rec => {
        const matchDof = selectedDofs.length === 0 || selectedDofs.includes(rec.dof_number);
        const matchDesignName = selectedDesignNames.length === 0 || rec.designNames.some(n => selectedDesignNames.includes(n));
        const matchCount = selectedCounts.length === 0 || rec.counts.some(c => selectedCounts.includes(c));
        const matchColour = selectedColours.length === 0 || rec.colours.some(c => selectedColours.includes(c));
        return matchDof && matchDesignName && matchCount && matchColour;
      });
      return Array.from(new Set(matching.flatMap(r => r.designNos))).sort();
    };

    const getCountOptions = () => {
      const matching = dofRecords.filter(rec => {
        const matchDof = selectedDofs.length === 0 || selectedDofs.includes(rec.dof_number);
        const matchDesignName = selectedDesignNames.length === 0 || rec.designNames.some(n => selectedDesignNames.includes(n));
        const matchDesignNo = selectedDesignNos.length === 0 || rec.designNos.some(n => selectedDesignNos.includes(n));
        const matchColour = selectedColours.length === 0 || rec.colours.some(c => selectedColours.includes(c));
        return matchDof && matchDesignName && matchDesignNo && matchColour;
      });
      return Array.from(new Set(matching.flatMap(r => r.counts))).sort();
    };

    const getColourOptions = () => {
      const matching = dofRecords.filter(rec => {
        const matchDof = selectedDofs.length === 0 || selectedDofs.includes(rec.dof_number);
        const matchDesignName = selectedDesignNames.length === 0 || rec.designNames.some(n => selectedDesignNames.includes(n));
        const matchDesignNo = selectedDesignNos.length === 0 || rec.designNos.some(n => selectedDesignNos.includes(n));
        const matchCount = selectedCounts.length === 0 || rec.counts.some(c => selectedCounts.includes(c));
        return matchDof && matchDesignName && matchDesignNo && matchCount;
      });
      return Array.from(new Set(matching.flatMap(r => r.colours))).sort();
    };

    return {
      dofs: getDofOptions(),
      designNames: getDesignNameOptions(),
      designNos: getDesignNoOptions(),
      counts: getCountOptions(),
      colours: getColourOptions()
    };
  }, [dofRecords, selectedDofs, selectedDesignNames, selectedDesignNos, selectedCounts, selectedColours]);

  const handleResetFilters = () => {
    setSelectedDofs([]);
    setSelectedDesignNames([]);
    setSelectedDesignNos([]);
    setSelectedCounts([]);
    setSelectedColours([]);
  };

  const handleToggleExpandDof = (id) => {
    setExpandedDofs(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <Loader size={32} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-muted-current)', fontSize: '0.9rem' }}>Loading dyed yarn stock inventory...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1rem' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button 
            onClick={() => navigate('/dyed-yarn')} 
            style={{ 
              background: 'none', border: 'none', color: 'var(--color-primary)', 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.5rem' 
            }}
          >
            <ArrowLeft size={16} /> Back to Dyed Yarn
          </button>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '850', color: 'var(--text-current)', margin: 0 }}>
            Dyed Yarn Stock Inventory
          </h1>
          <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted-current)', fontSize: '0.825rem' }}>
            Monitor and track stock balances, Greige dispatches, receipts, and deliveries for all approved Dyeing Order Forms.
          </p>
        </div>
      </div>

      {/* Expandable Cascade Filters */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div 
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-current)' }}>
            <Filter size={16} color="var(--color-primary)" />
            Filter Stock Records
            {(selectedDofs.length > 0 || selectedDesignNames.length > 0 || selectedDesignNos.length > 0 || selectedCounts.length > 0 || selectedColours.length > 0) && (
              <span style={{ fontSize: '0.75rem', color: '#b45309', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                Active Filters
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ChevronDown size={18} style={{ transform: isFilterExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#666' }} />
          </div>
        </div>

        {isFilterExpanded && (
          <div className="fade-in" style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              
              <MultiSelectDropdown 
                title="DOF Number" 
                options={filterOptions.dofs} 
                selected={selectedDofs} 
                onChange={setSelectedDofs} 
              />
              
              <MultiSelectDropdown 
                title="Design Name" 
                options={filterOptions.designNames} 
                selected={selectedDesignNames} 
                onChange={setSelectedDesignNames} 
              />
              
              <MultiSelectDropdown 
                title="Design No." 
                options={filterOptions.designNos} 
                selected={selectedDesignNos} 
                onChange={setSelectedDesignNos} 
              />
              
              <MultiSelectDropdown 
                title="Yarn Count" 
                options={filterOptions.counts} 
                selected={selectedCounts} 
                onChange={setSelectedCounts} 
                labelMapping={getFormatCount}
              />
              
              <MultiSelectDropdown 
                title="Colour" 
                options={filterOptions.colours} 
                selected={selectedColours} 
                onChange={setSelectedColours} 
              />

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                type="button" 
                onClick={handleResetFilters}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.45rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <RotateCcw size={12} /> Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Records List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredDofs.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted-current)' }}>
            <Layers size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>No matching stock records found.</p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', opacity: 0.7 }}>Try adjusting your filters or resetting the filter card.</p>
          </div>
        ) : (
          filteredDofs.map((record) => {
            const isExpanded = expandedDofs[record.id];
            return (
              <div 
                key={record.id}
                className="glass-panel"
                style={{
                  borderLeft: isExpanded ? '4px solid #800000' : '1px solid var(--border-current)',
                  padding: '1.25rem',
                  backgroundColor: '#fff',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                }}
              >
                {/* Collapsed Header Info */}
                <div 
                  onClick={() => handleToggleExpandDof(record.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                    
                    {/* DOF info */}
                    <div>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Dyeing Order Form</span>
                      <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#800000', fontFamily: 'monospace', marginTop: '2px' }}>
                        {record.dof_number}
                      </div>
                    </div>

                    {/* Order Numbers */}
                    <div>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Order Numbers</span>
                      <div style={{ fontWeight: '600', fontSize: '0.825rem', color: 'var(--text-current)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {record.orderNumbers.join(', ') || '—'}
                      </div>
                    </div>

                    {/* Design Specs */}
                    <div>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Design Specification</span>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-current)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {record.designNos.join(', ') || '—'} {record.designNames.length > 0 ? `/ ${record.designNames.join(', ')}` : ''}
                      </div>
                    </div>

                    {/* Dyeing Unit */}
                    <div>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Dyeing Unit</span>
                      <div style={{ fontSize: '0.825rem', fontWeight: '600', color: '#059669', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {record.dyeing_unit_name}
                      </div>
                    </div>

                    {/* Available Balance Stock badge */}
                    <div style={{ textAlign: 'right', paddingRight: '1rem' }}>
                      <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: '800', color: 'var(--text-muted-current)' }}>Available Stock</span>
                      <div style={{ marginTop: '2px' }}>
                        <span style={{ 
                          backgroundColor: record.totalInventoryBalance > 0.01 ? '#ecfdf5' : '#f1f5f9',
                          color: record.totalInventoryBalance > 0.01 ? '#047857' : '#64748b',
                          border: `1px solid ${record.totalInventoryBalance > 0.01 ? '#a7f3d0' : '#e2e8f0'}`,
                          padding: '0.3rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: '800',
                          display: 'inline-block'
                        }}>
                          {record.totalInventoryBalance.toFixed(2)} kg
                        </span>
                      </div>
                    </div>

                  </div>

                  <div>
                    {isExpanded ? <ChevronUp size={18} color="#666" /> : <ChevronDown size={18} color="#666" />}
                  </div>
                </div>

                {/* Expanded Detailed Sections */}
                {isExpanded && (
                  <div className="fade-in" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-current)', paddingTop: '1.25rem' }}>
                    
                    {/* Section 1: Detailed Yarn Inventory Balances */}
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Detailed Inventory Balances
                      </h4>
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                              <th style={{ padding: '0.75rem 1rem' }}>Colour</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Yarn Count</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Lot Number</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Dyed Received (kg)</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Dyed Delivered (kg)</th>
                              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Balance Stock (kg)</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Storage Location</th>
                            </tr>
                          </thead>
                          <tbody>
                            {record.inventoryRows.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)', backgroundColor: '#fff' }}>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '700', color: '#800000' }}>{row.colour}</td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{getFormatCount(row.countId)}</td>
                                <td style={{ padding: '0.75rem 1rem', fontWeight: '650', fontFamily: 'monospace' }}>{row.lotNumber}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: '#0369a1' }}>{row.dyedReceived.toFixed(2)}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: '#b91c1c' }}>{row.dyedDelivered.toFixed(2)}</td>
                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '800', color: row.balance > 0.01 ? '#047857' : '#9ca3af' }}>
                                  {row.balance.toFixed(2)}
                                </td>
                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted-current)', fontWeight: '500' }}>
                                  {row.locationDisplay}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Section 2: Associated DYRR & DYDR Transaction Logs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      
                      {/* Left: Dyed Yarn Receipts (DYRR) */}
                      <div>
                        <h4 
                          onClick={() => handleToggleTx(record.id, 'dyrr')}
                          style={{ 
                            margin: '0 0 0.75rem 0', 
                            fontSize: '0.85rem', 
                            fontWeight: '800', 
                            color: '#0369a1', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.05em', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            padding: '0.5rem 0.75rem',
                            backgroundColor: '#f0f9ff',
                            borderRadius: '6px',
                            border: '1px solid #e0f2fe',
                            userSelect: 'none',
                            transition: 'background-color 0.2s'
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Download size={14} />
                            Received Receipts (DYRR) ({record.dyrrList.length})
                          </span>
                          {expandedTxs[`${record.id}||dyrr`] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </h4>
                        
                        {expandedTxs[`${record.id}||dyrr`] && (
                          <div className="fade-in" style={{ marginTop: '0.5rem' }}>
                            {record.dyrrList.length === 0 ? (
                              <div style={{ border: '1px dashed var(--border-current)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                                No dyed yarn receipts recorded yet.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                                {record.dyrrList.map((dyrr) => (
                                  <div key={dyrr.dyrr_number} style={{ border: '1px solid var(--border-current)', borderRadius: '8px', padding: '0.75rem', backgroundColor: '#fdfdfd' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                                      <span style={{ fontWeight: '750', fontSize: '0.8rem', color: '#0369a1', fontFamily: 'monospace' }}>{dyrr.dyrr_number}</span>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>{dyrr.received_date ? new Date(dyrr.received_date).toLocaleDateString() : '—'}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', marginBottom: '0.5rem', color: 'var(--text-muted-current)' }}>
                                      <div><strong>By:</strong> {dyrr.received_by}</div>
                                      <div><strong>Vehicle:</strong> {dyrr.vehicle_no}</div>
                                      <div style={{ gridColumn: 'span 2' }}><strong>Remarks:</strong> {dyrr.remarks}</div>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                          <th style={{ padding: '0.3rem 0.5rem' }}>Yarn Details</th>
                                          <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>Qty</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {dyrr.items.map((it, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.3rem 0.5rem' }}>
                                              <span style={{ fontWeight: '700', color: '#800000' }}>{it.colour}</span> ({getFormatCount(it.yarn_count_id)})
                                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>Lot: {it.lot_number} | Loc: {it.location}</div>
                                            </td>
                                            <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>{it.quantity_kg.toFixed(2)} kg</td>
                                          </tr>
                                        ))}
                                        <tr style={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>
                                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Total:</td>
                                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#0369a1' }}>
                                            {dyrr.items.reduce((s, i) => s + i.quantity_kg, 0).toFixed(2)} kg
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Delivered Receipts (DYDR) */}
                      <div>
                        <h4 
                          onClick={() => handleToggleTx(record.id, 'dydr')}
                          style={{ 
                            margin: '0 0 0.75rem 0', 
                            fontSize: '0.85rem', 
                            fontWeight: '800', 
                            color: '#7f1d1d', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.05em', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            padding: '0.5rem 0.75rem',
                            backgroundColor: '#fef2f2',
                            borderRadius: '6px',
                            border: '1px solid #fee2e2',
                            userSelect: 'none',
                            transition: 'background-color 0.2s'
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Truck size={14} />
                            Delivered Receipts (DYDR) ({record.dydrList.length})
                          </span>
                          {expandedTxs[`${record.id}||dydr`] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </h4>
                        
                        {expandedTxs[`${record.id}||dydr`] && (
                          <div className="fade-in" style={{ marginTop: '0.5rem' }}>
                            {record.dydrList.length === 0 ? (
                              <div style={{ border: '1px dashed var(--border-current)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                                No dispatches recorded yet.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                                {record.dydrList.map((dydr) => (
                                  <div key={dydr.dydr_number} style={{ border: '1px solid var(--border-current)', borderRadius: '8px', padding: '0.75rem', backgroundColor: '#fdfdfd' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.35rem' }}>
                                      <span style={{ fontWeight: '750', fontSize: '0.8rem', color: '#b91c1c', fontFamily: 'monospace' }}>{dydr.dydr_number}</span>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>{dydr.delivered_date ? new Date(dydr.delivered_date).toLocaleDateString() : '—'}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', marginBottom: '0.5rem', color: 'var(--text-muted-current)' }}>
                                      <div><strong>By:</strong> {dydr.delivered_by}</div>
                                      <div><strong>Vehicle:</strong> {dydr.vehicle_no}</div>
                                      <div><strong>Order Form No:</strong> {dydr.targetFormNo}</div>
                                      <div><strong>Machine:</strong> {dydr.targetMachine}</div>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                          <th style={{ padding: '0.3rem 0.5rem' }}>Yarn Details</th>
                                          <th style={{ padding: '0.3rem 0.5rem', textAlign: 'right' }}>Qty</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {dydr.items.map((it, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.3rem 0.5rem', verticalAlign: 'top' }}>
                                              <span style={{ fontWeight: '700', color: '#800000' }}>{it.colour}</span> ({getFormatCount(it.yarn_count_id)})
                                              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>Lot: {it.lot_number} | Loc: {it.location}</div>
                                            </td>
                                            <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: '700', verticalAlign: 'top' }}>{it.quantity_kg.toFixed(2)} kg</td>
                                          </tr>
                                        ))}
                                        <tr style={{ fontWeight: 'bold', backgroundColor: '#f8fafc' }}>
                                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Total:</td>
                                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#b91c1c' }}>
                                            {dydr.items.reduce((s, i) => s + i.quantity_kg, 0).toFixed(2)} kg
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
