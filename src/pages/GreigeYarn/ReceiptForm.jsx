import React, { useState, useEffect, useMemo, useRef } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// Searchable Yarn Count Select
// Format: Count | Spec | Spec1 | Type | Material | Content
// ──────────────────────────────────────────────────────────────────────────────
function buildLabel(yc) {
  const parts = [
    yc.count_value,
    yc.spec,
    yc.spec1,
    yc.product_type,
    yc.material,
    yc.content
  ].filter(Boolean);
  return parts.join(' | ');
}

function SearchableYarnCountSelect({ yarnCounts, value, onChange, required }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Sync display text when value changes externally
  useEffect(() => {
    if (!value) {
      setQuery('');
    } else {
      const found = yarnCounts.find(yc => yc.id === value);
      if (found) setQuery(buildLabel(found));
    }
  }, [value, yarnCounts]);

  // Close dropdown on outside click & restore label
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        if (!value) setQuery('');
        else {
          const found = yarnCounts.find(yc => yc.id === value);
          setQuery(found ? buildLabel(found) : '');
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value, yarnCounts]);

  const filtered = useMemo(() => {
    if (!query.trim()) return yarnCounts;
    const q = query.toLowerCase();
    return yarnCounts.filter(yc =>
      [yc.count_value, yc.spec, yc.spec1, yc.product_type, yc.material, yc.content]
        .some(f => f && String(f).toLowerCase().includes(q))
    );
  }, [query, yarnCounts]);

  const handleSelect = (yc) => {
    onChange(yc.id);
    setQuery(buildLabel(yc));
    setOpen(false);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    if (!e.target.value) onChange('');
  };

  const Field = ({ label, val }) =>
    val ? (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '2px',
        fontSize: '0.7rem', lineHeight: 1,
        padding: '2px 6px', borderRadius: '4px',
        backgroundColor: '#f1f5f9', color: '#475569',
        border: '1px solid #e2e8f0'
      }}>
        <span style={{ color: '#94a3b8', fontWeight: 500 }}>{label}:</span>
        <span style={{ fontWeight: 600, color: '#1e293b' }}>{val}</span>
      </span>
    ) : null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        className="input-field"
        placeholder="Type to search by count, spec, type, material..."
        value={query}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        required={required && !value}
        autoComplete="off"
        style={{
          paddingRight: '2rem',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.6rem center',
          backgroundSize: '14px 14px'
        }}
      />

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-current, #e2e8f0)',
          borderRadius: '10px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
          maxHeight: '360px',
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%'
        }}>
          {/* Sticky column header */}
          <div style={{
            display: 'flex',
            flexWrap: 'nowrap',
            gap: 0,
            padding: '0.5rem 1rem',
            borderBottom: '2px solid var(--border-current, #e2e8f0)',
            backgroundColor: '#f8fafc',
            borderRadius: '10px 10px 0 0',
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}>
            {[
              { label: 'Count',    w: '12%' },
              { label: 'Spec',     w: '18%' },
              { label: 'Spec 1',   w: '18%' },
              { label: 'Type',     w: '18%' },
              { label: 'Material', w: '18%' },
              { label: 'Content',  w: '16%' }
            ].map(col => (
              <span key={col.label} style={{
                width: col.w, flexShrink: 0,
                fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.06em'
              }}>
                {col.label}
              </span>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '1rem 1.25rem', color: '#9ca3af', fontSize: '0.9rem' }}>
              No matches found
            </div>
          ) : (
            filtered.map(yc => {
              const isSelected = value === yc.id;
              return (
                <div
                  key={yc.id}
                  onMouseDown={() => handleSelect(yc)}
                  style={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    alignItems: 'center',
                    gap: 0,
                    padding: '0.7rem 1rem',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-current, #f1f5f9)',
                    backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                    transition: 'background-color 0.1s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = isSelected ? '#eff6ff' : 'transparent'}
                >
                  {/* Count */}
                  <span style={{ width: '12%', flexShrink: 0, fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-primary, #2563eb)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {yc.count_value || '—'}
                  </span>
                  {/* Spec */}
                  <span style={{ width: '18%', flexShrink: 0, fontSize: '0.875rem', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {yc.spec || <span style={{ color: '#d1d5db' }}>—</span>}
                  </span>
                  {/* Spec1 */}
                  <span style={{ width: '18%', flexShrink: 0, fontSize: '0.875rem', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {yc.spec1 || <span style={{ color: '#d1d5db' }}>—</span>}
                  </span>
                  {/* Type */}
                  <span style={{ width: '18%', flexShrink: 0, fontSize: '0.875rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {yc.product_type || <span style={{ color: '#d1d5db' }}>—</span>}
                  </span>
                  {/* Material */}
                  <span style={{ width: '18%', flexShrink: 0, fontSize: '0.875rem', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {yc.material || <span style={{ color: '#d1d5db' }}>—</span>}
                  </span>
                  {/* Content */}
                  <span style={{ width: '16%', flexShrink: 0, fontSize: '0.875rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {yc.content || <span style={{ color: '#d1d5db' }}>—</span>}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Hidden input for HTML5 required validation */}
      <input type="hidden" value={value || ''} required={required} />
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function ReceiptForm() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  // Masters Data
  const [yarnCounts, setYarnCounts] = useState([]);
  const [mills, setMills] = useState([]);
  const [locations, setLocations] = useState([]);
  const [yarnWorkers, setYarnWorkers] = useState([]);

  // Form State
  const [receiptType, setReceiptType] = useState('spinning_mill');
  const [formData, setFormData] = useState({
    spinning_mill_id: '',
    order_form_no: '',
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    invoice_amount: '',
    vehicle_no: '',
    received_by: ''
  });

  const [items, setItems] = useState([
    {
      yarn_count_id: '',
      bag_weight: '',
      bag_count: '',
      cone_weight: '',
      cone_count: '',
      rate_per_kg: '',
      location_id: '',
      verification_weight: ''
    }
  ]);

  const [fetchedItems, setFetchedItems] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dofGydrs, setDofGydrs] = useState([]);
  const [selectedGydrId, setSelectedGydrId] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      setFormData(prev => ({ ...prev, received_by: profile.full_name }));
    }
  }, [profile]);

  const handleSearchDoc = async () => {
    if (!formData.order_form_no.trim()) {
      alert("Please enter a document number.");
      return;
    }
    setSearching(true);
    setSearched(false);
    setFetchedItems([]);
    setDofGydrs([]);
    setSelectedGydrId('');
    try {
      const docNo = formData.order_form_no.trim();
      let matchedDoc = null;
      let docType = ''; // 'dof', 'warping', 'weaving'
      let sentItems = [];
      let returnedItems = [];

      // 1. Search Dyeing Order Forms
      const { data: dofData } = await supabase
        .from('dyeing_order_forms')
        .select('*')
        .ilike('dof_number', docNo)
        .maybeSingle();

      if (dofData) {
        matchedDoc = dofData;
        docType = 'dof';
      } else {
        // 2. Search Warping Orders
        const { data: warpData } = await supabase
          .from('warping_orders')
          .select('*')
          .ilike('warping_number', docNo)
          .maybeSingle();
        
        if (warpData) {
          matchedDoc = warpData;
          docType = 'warping';
        } else {
          // 3. Search Weaving Orders
          const { data: weaveData } = await supabase
            .from('weaving_orders')
            .select('*')
            .ilike('weaving_number', docNo)
            .maybeSingle();
          if (weaveData) {
            matchedDoc = weaveData;
            docType = 'weaving';
          }
        }
      }

      if (!matchedDoc) {
        alert(`Document "${docNo}" not found. Please verify the document number.`);
        setSearching(false);
        return;
      }

      // Fetch sent items and already returned items
      if (docType === 'dof') {
        const { data: deliveryReceipts, error: gydrErr } = await supabase
          .from('greige_yarn_delivery_receipts')
          .select('id, gydr_number, created_at')
          .eq('dof_id', matchedDoc.id)
          .order('created_at', { ascending: false });
        
        if (gydrErr) throw gydrErr;

        if (!deliveryReceipts || deliveryReceipts.length === 0) {
          alert("No deliveries found for this order form.");
          setSearching(false);
          return;
        }

        setDofGydrs(deliveryReceipts);
        setSearched(true);
      } else {
        const { data: delItems } = await supabase
          .from('dyed_yarn_delivery_items')
          .select(`
            *,
            orders (order_number),
            master_yarn_counts (count_value, material, product_type, spec, spec1)
          `)
          .eq('production_form_id', matchedDoc.id);
        sentItems = delItems || [];

        const docNumberField = docType === 'warping' ? matchedDoc.warping_number : matchedDoc.weaving_number;
        const { data: retItems } = await supabase
          .from('greige_yarn_receipts')
          .select('*')
          .eq('receipt_type', 'production')
          .eq('order_form_no', docNumberField);
        returnedItems = retItems || [];

        const aggregated = {};
        sentItems.forEach(item => {
          const key = `${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}-${item.order_id}`;
          if (!aggregated[key]) {
            aggregated[key] = {
              yarn_count_id: item.yarn_count_id,
              colour: item.colour,
              yarn_type: item.yarn_type || 'warp',
              order_id: item.order_id,
              order_number: item.orders?.order_number || '-',
              count_label: item.master_yarn_counts
                ? [
                    item.master_yarn_counts.count_value,
                    item.master_yarn_counts.spec,
                    item.master_yarn_counts.spec1,
                    item.master_yarn_counts.product_type
                  ].filter(Boolean).join(' • ')
                : 'Unknown',
              quantity_sent: 0,
              already_returned: 0
            };
          }
          aggregated[key].quantity_sent += parseFloat(item.quantity_kg || 0);
        });

        returnedItems.forEach(item => {
          const key = `${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}-${item.order_id}`;
          if (aggregated[key]) {
            aggregated[key].already_returned += parseFloat(item.total_weight || 0);
          }
        });

        const finalItems = Object.values(aggregated).map(item => ({
          ...item,
          net_sent: Math.max(0, item.quantity_sent - item.already_returned),
          bag_weight: '',
          bag_count: '',
          cone_weight: '',
          cone_count: '',
          location_id: '',
          verification_weight: '',
          returned_qty: ''
        }));

        if (finalItems.length === 0) {
          alert("No deliveries found for this order form.");
        } else {
          setFetchedItems(finalItems);
          setSearched(true);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error searching document: " + err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleGydrSelect = async (gydrId) => {
    setSelectedGydrId(gydrId);
    if (!gydrId) {
      setFetchedItems([]);
      return;
    }
    setSearching(true);
    setFetchedItems([]);
    try {
      // 1. Fetch items delivered in this GYDR
      const { data: delItems, error: delErr } = await supabase
        .from('greige_yarn_delivery_items')
        .select(`
          *,
          orders (order_number),
          master_yarn_counts (count_value, material, product_type, spec, spec1),
          spinning_mill:master_partners!spinning_mill_id (partner_name)
        `)
        .eq('receipt_id', gydrId);

      if (delErr) throw delErr;

      // 2. Fetch already returned items for this specific GYDR
      const { data: retItems, error: retErr } = await supabase
        .from('greige_yarn_receipts')
        .select('*')
        .eq('receipt_type', 'production')
        .eq('gydr_id', gydrId);

      if (retErr) throw retErr;

      const itemsList = delItems || [];
      const returnsList = retItems || [];

      // Map each delivery item to a return item entry
      const finalItems = itemsList.map(item => {
        // Sum returns for this specific delivery item by matching count, color, mill, order, and type
        const alreadyReturned = returnsList
          .filter(r => 
            r.yarn_count_id === item.yarn_count_id &&
            r.colour === item.colour &&
            r.spinning_mill_id === item.spinning_mill_id &&
            r.order_id === item.order_id &&
            r.yarn_type === item.yarn_type
          )
          .reduce((sum, r) => sum + parseFloat(r.total_weight || 0), 0);

        const netSent = Math.max(0, parseFloat(item.quantity_kg || 0) - alreadyReturned);

        return {
          id: item.id,
          yarn_count_id: item.yarn_count_id,
          colour: item.colour,
          yarn_type: item.yarn_type || 'warp',
          order_id: item.order_id,
          spinning_mill_id: item.spinning_mill_id,
          mill_name: item.spinning_mill?.partner_name || 'Unknown Mill',
          order_number: item.orders?.order_number || '-',
          count_label: item.master_yarn_counts
            ? [
                item.master_yarn_counts.count_value,
                item.master_yarn_counts.spec,
                item.master_yarn_counts.spec1,
                item.master_yarn_counts.product_type
              ].filter(Boolean).join(' • ')
            : 'Unknown',
          quantity_sent: parseFloat(item.quantity_kg || 0),
          already_returned: alreadyReturned,
          net_sent: netSent,
          returned_qty: '',
          location_id: ''
        };
      });

      if (finalItems.length === 0) {
        alert("No items found in this delivery receipt.");
      } else {
        setFetchedItems(finalItems);
      }
    } catch (err) {
      console.error(err);
      alert("Error loading GYDR details: " + err.message);
    } finally {
      setSearching(false);
    }
  };

  const recalculateDofStatus = async (dofNumber) => {
    try {
      const { data: dofData, error: dofErr } = await supabase
        .from('dyeing_order_forms')
        .select('*')
        .ilike('dof_number', dofNumber)
        .maybeSingle();
      
      if (dofErr || !dofData) return;

      const dofId = dofData.id;

      const { data: deliveryReceipts } = await supabase
        .from('greige_yarn_delivery_receipts')
        .select('id')
        .eq('dof_id', dofId);
      
      const receiptIds = deliveryReceipts?.map(r => r.id) || [];
      let allDeliveryItems = [];
      if (receiptIds.length > 0) {
        const { data: delItems } = await supabase
          .from('greige_yarn_delivery_items')
          .select('yarn_count_id, colour, quantity_kg')
          .in('receipt_id', receiptIds);
        allDeliveryItems = delItems || [];
      }

      const { data: returnedItems } = await supabase
        .from('greige_yarn_receipts')
        .select('yarn_count_id, colour, total_weight')
        .eq('receipt_type', 'production')
        .eq('order_form_no', dofData.dof_number);
      
      const dofSummary = dofData.summary || [];
      let allFullySent = true;
      let anySent = false;

      for (const s of dofSummary) {
        const totalDelivered = allDeliveryItems
          .filter(d => d.yarn_count_id === s.countId && d.colour === s.colour)
          .reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);
        
        const totalReturned = (returnedItems || [])
          .filter(r => r.yarn_count_id === s.countId && r.colour === s.colour)
          .reduce((sum, r) => sum + parseFloat(r.total_weight || 0), 0);

        const netSentForThis = totalDelivered - totalReturned;
        const required = parseFloat(s.total_kg || 0);

        if (netSentForThis > 0.001) anySent = true;
        if (netSentForThis < required - 0.001) allFullySent = false;
      }

      const newStatus = allFullySent ? 'fully_sent' : anySent ? 'partially_sent' : 'approved';
      
      await supabase
        .from('dyeing_order_forms')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', dofId);

    } catch (err) {
      console.error("Error recalculating DOF status:", err);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  // Reset items list when receipt source type changes
  useEffect(() => {
    setItems([
      {
        yarn_count_id: '',
        bag_weight: '',
        bag_count: '',
        cone_weight: '',
        cone_count: '',
        rate_per_kg: '',
        location_id: '',
        verification_weight: ''
      }
    ]);
    setFetchedItems([]);
    setSearched(false);
  }, [receiptType]);

  const fetchMasters = async () => {
    const [counts, partners, locs] = await Promise.all([
      supabase.from('master_yarn_counts').select('*'),
      supabase.from('master_partners').select('*').eq('partner_type', 'Spinning Mill'),
      supabase.from('master_locations').select('*').eq('warehouse_type', 'Greige Warehouse')
    ]);
    if (counts.data) setYarnCounts(counts.data);
    if (partners.data) setMills(partners.data);
    if (locs.data) setLocations(locs.data);

    // Fetch Yarn workers
    try {
      const { data: deptData } = await supabase
        .from('master_departments')
        .select('id')
        .ilike('department_name', '%yarn%');
        
      const yarnDeptIds = (deptData || []).map(d => d.id);
      
      if (yarnDeptIds.length > 0) {
        const { data: workersData } = await supabase
          .from('master_workers')
          .select('*')
          .in('department_id', yarnDeptIds)
          .order('worker_name', { ascending: true });
        setYarnWorkers(workersData || []);
      }
    } catch (err) {
      console.error('Error fetching yarn workers:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Helper calculations for items
  const getItemComputedWeight = (item) => {
    const bags = (parseFloat(item.bag_weight) || 0) * (parseInt(item.bag_count) || 0);
    const cones = (parseFloat(item.cone_weight) || 0) * (parseInt(item.cone_count) || 0);
    return (bags + cones).toFixed(2);
  };

  const isItemVerified = (item) => {
    const weight = parseFloat(getItemComputedWeight(item));
    if (weight <= 0) return false;
    return weight === parseFloat(item.verification_weight);
  };

  // Verification Gatekeepers
  const isAllVerified = useMemo(() => {
    if (receiptType === 'spinning_mill') {
      if (items.length === 0) return false;
      return items.every(item => {
        if (!item.yarn_count_id || !item.location_id) return false;
        return isItemVerified(item);
      });
    } else {
      if (!searched || fetchedItems.length === 0) return false;
      const activeItems = fetchedItems.filter(item => (parseFloat(item.returned_qty) || 0) > 0);
      if (activeItems.length === 0) return false;
      return activeItems.every(item => {
        if (!item.location_id) return false;
        const weight = parseFloat(item.returned_qty) || 0;
        const withinLimits = weight <= item.net_sent + 0.001;
        return withinLimits;
      });
    }
  }, [items, fetchedItems, receiptType, searched]);

  const grandTotalComputedWeight = useMemo(() => {
    if (receiptType === 'spinning_mill') {
      return items.reduce((sum, item) => sum + parseFloat(getItemComputedWeight(item) || 0), 0).toFixed(2);
    } else {
      return fetchedItems.reduce((sum, item) => sum + (parseFloat(item.returned_qty) || 0), 0).toFixed(2);
    }
  }, [items, fetchedItems, receiptType]);

  // Submission Logic
  // Submission Logic
  const generateReceiptNumber = async () => {
    if (receiptType === 'spinning_mill') {
      // Find the latest receipt number for spinning mill
      const { data } = await supabase
        .from('greige_yarn_receipts')
        .select('receipt_no')
        .eq('receipt_type', 'spinning_mill')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].receipt_no) {
        const lastStr = data[0].receipt_no;
        const parts = lastStr.split('/');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
          return `AT/GYRR/${String(lastNum + 1).padStart(5, '0')}`;
        }
      }
      return `AT/GYRR/00001`;
    } else {
      // Production return: AT/YYYY/GYPRR/00001
      const year = new Date().getFullYear();
      const prefix = `AT/${year}/GYPRR/`;
      const { data } = await supabase
        .from('greige_yarn_receipts')
        .select('receipt_no')
        .eq('receipt_type', 'production')
        .ilike('receipt_no', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].receipt_no) {
        const lastStr = data[0].receipt_no;
        const parts = lastStr.split('/');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
          return `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
        }
      }
      return `${prefix}00001`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAllVerified) return;
    
    setSaving(true);
    try {
      const receiptNo = await generateReceiptNumber();

      let payloads = [];

      if (receiptType === 'spinning_mill') {
        payloads = items.map(item => {
          const computedItemWeight = (parseFloat(item.bag_weight) || 0) * (parseInt(item.bag_count) || 0) + 
                                     (parseFloat(item.cone_weight) || 0) * (parseInt(item.cone_count) || 0);
          return {
            receipt_no: receiptNo,
            receipt_type: 'spinning_mill',
            yarn_count_id: item.yarn_count_id,
            total_weight: computedItemWeight,
            bag_weight: parseFloat(item.bag_weight) || 0,
            bag_count: parseInt(item.bag_count) || 0,
            cone_weight: parseFloat(item.cone_weight) || 0,
            cone_count: parseInt(item.cone_count) || 0,
            rate_per_kg: parseFloat(item.rate_per_kg) || 0,
            location_id: item.location_id,
            vehicle_no: formData.vehicle_no,
            received_by: formData.received_by,
            spinning_mill_id: formData.spinning_mill_id,
            invoice_no: formData.invoice_no,
            invoice_date: formData.invoice_date,
            invoice_amount: parseFloat(formData.invoice_amount) || 0
          };
        });
      } else {
        const activeItems = fetchedItems.filter(item => (parseFloat(item.returned_qty) || 0) > 0);
        payloads = activeItems.map(item => {
          const computedItemWeight = parseFloat(item.returned_qty) || 0;
          return {
            receipt_no: receiptNo,
            receipt_type: 'production',
            order_form_no: formData.order_form_no.trim(),
            yarn_count_id: item.yarn_count_id,
            colour: item.colour,
            yarn_type: item.yarn_type,
            order_id: item.order_id,
            total_weight: computedItemWeight,
            bag_weight: 0,
            bag_count: 0,
            cone_weight: 0,
            cone_count: 0,
            rate_per_kg: 0,
            location_id: item.location_id,
            vehicle_no: formData.vehicle_no,
            received_by: formData.received_by,
            spinning_mill_id: item.spinning_mill_id || null,
            gydr_id: selectedGydrId || null,
            gydr_no: dofGydrs.find(g => g.id === selectedGydrId)?.gydr_number || null
          };
        });
      }

      const { error } = await supabase.from('greige_yarn_receipts').insert(payloads);
      
      if (error) {
        throw error;
      }

      if (receiptType === 'production') {
        await recalculateDofStatus(formData.order_form_no.trim());
      }

      setSaving(false);
      navigate('/greige-yarn/receipts');
    } catch (err) {
      setSaving(false);
      alert("Error: " + err.message);
    }
  };

  return (
    <div style={{ width: '100%', padding: '1rem 2rem', boxSizing: 'border-box' }} className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <button 
          onClick={() => navigate('/greige-yarn/receipts')} 
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', padding: '0', marginBottom: '0.5rem' }}
        >
          <ArrowLeft size={16} />
          Back to Receipts List
        </button>
        <h1 style={{ fontSize: '1.75rem', margin: '0', color: 'var(--text-current)', fontWeight: 'bold' }}>
          Receive Greige Yarn
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Step 1: Receipt Source Type */}
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>1. Receiving Source</h2>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input type="radio" checked={receiptType === 'spinning_mill'} onChange={() => setReceiptType('spinning_mill')} />
              Spinning Mill (Fresh Intake)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
              <input type="radio" checked={receiptType === 'production'} onChange={() => setReceiptType('production')} />
              Production Returns
            </label>
          </div>
        </div>

        {/* Step 2: Invoice / Order Details */}
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>2. Document Details</h2>
          
          {receiptType === 'spinning_mill' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Spinning Mill Partner</label>
                <select name="spinning_mill_id" className="input-field" value={formData.spinning_mill_id} onChange={handleChange} required>
                  <option value="">Select Mill...</option>
                  {mills.map(m => <option key={m.id} value={m.id}>{m.partner_name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Invoice Number</label>
                <input type="text" name="invoice_no" className="input-field" value={formData.invoice_no} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label className="input-label">Invoice Date</label>
                <input type="date" name="invoice_date" className="input-field" value={formData.invoice_date} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label className="input-label">Invoice Amount (₹)</label>
                <input type="number" step="0.01" name="invoice_amount" className="input-field" value={formData.invoice_amount} onChange={handleChange} required />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Production Order Form No.</label>
                  <input 
                    type="text" 
                    name="order_form_no" 
                    className="input-field" 
                    value={formData.order_form_no} 
                    onChange={handleChange} 
                    placeholder="e.g. AT/2026/DOF/00002"
                    required 
                    disabled={searched}
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
                {searched ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ height: '42px', padding: '0 1.5rem', fontWeight: 'bold' }}
                    onClick={() => {
                      setSearched(false);
                      setDofGydrs([]);
                      setSelectedGydrId('');
                      setFetchedItems([]);
                    }}
                  >
                    Clear & Search Again
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ height: '42px', padding: '0 1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: searching ? 0.7 : 1 }}
                    disabled={searching || !formData.order_form_no}
                    onClick={handleSearchDoc}
                  >
                    {searching ? 'Fetching...' : 'Fetch Sent Yarn'}
                  </button>
                )}
              </div>
              
              {searched && dofGydrs.length > 0 && (
                <div className="input-group" style={{ marginTop: '0.5rem' }}>
                  <label className="input-label">Select Delivery Receipt (GYDR)</label>
                  <select
                    className="input-field"
                    value={selectedGydrId}
                    onChange={(e) => handleGydrSelect(e.target.value)}
                    required
                  >
                    <option value="">Select GYDR...</option>
                    {dofGydrs.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.gydr_number} ({new Date(g.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Yarn Counts Received */}
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>3. Yarn Counts Received</span>
            {receiptType === 'spinning_mill' && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                onClick={() => setItems(prev => [...prev, {
                  yarn_count_id: '',
                  bag_weight: '',
                  bag_count: '',
                  cone_weight: '',
                  cone_count: '',
                  rate_per_kg: '',
                  location_id: '',
                  verification_weight: ''
                }])}
              >
                + Add Another Yarn Count
              </button>
            )}
          </h2>

          {receiptType === 'spinning_mill' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {items.map((item, idx) => {
                const itemWeight = getItemComputedWeight(item);
                const verified = isItemVerified(item);
                
                return (
                  <div key={idx} style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', padding: '1.5rem', position: 'relative', backgroundColor: verified ? '#f8fafc' : '#ffffff' }}>
                    
                    {/* Item Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px dashed var(--border-current)', paddingBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>Yarn Count #{idx + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                          style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Item Fields Layout (Full width vertical stack) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div className="input-group">
                        <label className="input-label">Select Yarn Count</label>
                        <SearchableYarnCountSelect
                          yarnCounts={yarnCounts}
                          value={item.yarn_count_id}
                          onChange={newId => {
                            const updated = [...items];
                            updated[idx].yarn_count_id = newId;
                            setItems(updated);
                          }}
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label">Storage Location (Bay)</label>
                        <select
                          className="input-field"
                          value={item.location_id}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].location_id = e.target.value;
                            setItems(updated);
                          }}
                          required
                        >
                          <option value="">Select Storage Location...</option>
                          {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Packaging Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                      <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#4b5563', fontWeight: 'bold' }}>Bags (Primary)</h4>
                        <div className="input-group">
                          <label className="input-label">Weight of 1 Bag (kg)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="input-field"
                            value={item.bag_weight}
                            onChange={e => {
                              const updated = [...items];
                              updated[idx].bag_weight = e.target.value;
                              setItems(updated);
                            }}
                            required
                          />
                        </div>
                        <div className="input-group" style={{ marginTop: '0.5rem' }}>
                          <label className="input-label">Number of Bags</label>
                          <input
                            type="number"
                            className="input-field"
                            value={item.bag_count}
                            onChange={e => {
                              const updated = [...items];
                              updated[idx].bag_count = e.target.value;
                              setItems(updated);
                            }}
                            required
                          />
                        </div>
                      </div>

                      <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#4b5563', fontWeight: 'bold' }}>Cones (Optional/Loose)</h4>
                        <div className="input-group">
                          <label className="input-label">Weight per Cone (kg)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="input-field"
                            value={item.cone_weight}
                            onChange={e => {
                              const updated = [...items];
                              updated[idx].cone_weight = e.target.value;
                              setItems(updated);
                            }}
                          />
                        </div>
                        <div className="input-group" style={{ marginTop: '0.5rem' }}>
                          <label className="input-label">Number of Cones</label>
                          <input
                            type="number"
                            className="input-field"
                            value={item.cone_count}
                            onChange={e => {
                              const updated = [...items];
                              updated[idx].cone_count = e.target.value;
                              setItems(updated);
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pricing & Verification Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
                      <div className="input-group">
                        <label className="input-label">Yarn Price / Rate per KG (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input-field"
                          value={item.rate_per_kg}
                          onChange={e => {
                            const updated = [...items];
                            updated[idx].rate_per_kg = e.target.value;
                            setItems(updated);
                          }}
                          required
                        />
                      </div>

                      <div className="input-group">
                        <label className="input-label">Verify Invoice Weight for Count (kg)</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="input-field"
                            placeholder="Enter weight to verify"
                            value={item.verification_weight}
                            onChange={e => {
                              const updated = [...items];
                              updated[idx].verification_weight = e.target.value;
                              setItems(updated);
                            }}
                            required
                            style={{ borderColor: verified ? '#22c55e' : (item.verification_weight && !verified ? '#ef4444' : '') }}
                          />
                          {verified ? <CheckCircle2 color="#22c55e" size={20} /> : <AlertCircle color={item.verification_weight ? '#ef4444' : '#9ca3af'} size={20} />}
                        </div>
                      </div>
                    </div>

                    {/* Calculated Weight Preview */}
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: verified ? '#f0fdf4' : '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: verified ? '1px solid #bbf7d0' : '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>Calculated Count Weight:</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{itemWeight} kg</span>
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              {!searched ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '1px dashed var(--border-current)', borderRadius: '8px' }}>
                  <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>Please enter a Production Order Form No. and click "Fetch Sent Yarn" above.</p>
                </div>
              ) : (dofGydrs.length > 0 && !selectedGydrId) ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '1px dashed var(--border-current)', borderRadius: '8px' }}>
                  <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
                  <p style={{ margin: 0 }}>Please select a Delivery Receipt (GYDR) from the dropdown above.</p>
                </div>
              ) : fetchedItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#991b1b', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px' }}>
                  <AlertCircle size={32} style={{ margin: '0 auto 0.75rem', display: 'block' }} />
                  <p style={{ margin: 0, fontWeight: 'bold' }}>No Sent Yarn Found</p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>No deliveries of greige or dyed yarn were found for this order form/delivery receipt.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {fetchedItems.map((item, idx) => {
                    const hasReturnedQty = (parseFloat(item.returned_qty) || 0) > 0;
                    const weightExceeded = (parseFloat(item.returned_qty) || 0) > item.net_sent + 0.001;

                    return (
                      <div key={idx} style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', padding: '1.5rem', position: 'relative', backgroundColor: hasReturnedQty && !weightExceeded ? '#f8fafc' : '#ffffff' }}>
                        
                        {/* Item Info Header */}
                        <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid var(--border-current)', borderRadius: '8px', marginBottom: '1.25rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', fontSize: '0.85rem' }}>
                            <div><strong>Order:</strong> <span style={{ color: 'var(--color-primary)' }}>{item.order_number}</span></div>
                            <div><strong>Yarn Count:</strong> {item.count_label}</div>
                            {item.mill_name && <div><strong>Spinning Mill:</strong> <span style={{ fontWeight: '600' }}>{item.mill_name}</span></div>}
                            <div><strong>Yarn Type:</strong> <span style={{ textTransform: 'capitalize' }}>{item.yarn_type}</span></div>
                            <div><strong>Colour:</strong> <span style={{ fontWeight: '600' }}>{item.colour}</span></div>
                            <div><strong>Qty Sent:</strong> {item.quantity_sent.toFixed(2)} kg</div>
                            <div><strong>Net Remaining Sent:</strong> <span style={{ fontWeight: 'bold' }}>{item.net_sent.toFixed(2)} kg</span></div>
                          </div>
                          {item.already_returned > 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.5rem', fontWeight: '500' }}>
                              ⚠️ Already Returned: {item.already_returned.toFixed(2)} kg
                            </div>
                          )}
                        </div>

                        {/* Storage Location Choice */}
                        <div className="input-group" style={{ marginBottom: '1rem' }}>
                          <label className="input-label">Storage Location (Bay)</label>
                          <select
                            className="input-field"
                            value={item.location_id}
                            onChange={e => {
                              const updated = [...fetchedItems];
                              updated[idx].location_id = e.target.value;
                              setFetchedItems(updated);
                            }}
                            required={hasReturnedQty}
                          >
                            <option value="">Select Storage Location...</option>
                            {locations.map(l => <option key={l.id} value={l.id}>{l.location_name}</option>)}
                          </select>
                        </div>

                        {/* Total Qty Received Back */}
                        <div className="input-group" style={{ marginBottom: '1rem' }}>
                          <label className="input-label">Total Qty Received Back (kg)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Enter quantity received back in kg"
                            className="input-field"
                            value={item.returned_qty}
                            onChange={e => {
                              const updated = [...fetchedItems];
                              updated[idx].returned_qty = e.target.value;
                              setFetchedItems(updated);
                            }}
                            style={{ borderColor: weightExceeded ? '#ef4444' : (hasReturnedQty ? '#22c55e' : '') }}
                          />
                        </div>

                        {weightExceeded && (
                          <div style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: 'bold', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <AlertCircle size={14} /> Returned quantity exceeds net sent weight ({item.net_sent.toFixed(2)} kg)!
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grand Total Weight Banner */}
        <div style={{ backgroundColor: isAllVerified ? '#f0fdf4' : '#fef2f2', border: isAllVerified ? '1px solid #bbf7d0' : '1px solid #fca5a5', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: isAllVerified ? '#15803d' : '#b91c1c' }}>Grand Total Intake Weight</h3>
            <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '2rem', fontWeight: 'bold', color: isAllVerified ? '#166534' : '#991b1b' }}>{grandTotalComputedWeight} kg</h2>
          </div>
          <div>
            {isAllVerified ? (
              <span style={{ color: '#15803d', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={18} /> All Counts Verified</span>
            ) : (
              <span style={{ color: '#b91c1c', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={18} /> Verification Pending</span>
            )}
          </div>
        </div>

        {/* Step 5: Storage (Locked until verified) */}
        {isAllVerified && (
          <div className="glass-panel fade-in">
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>4. Storage & Logistics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Vehicle Registry No.</label>
                <input type="text" name="vehicle_no" placeholder="TN-XX-XXXX" className="input-field" value={formData.vehicle_no} onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label className="input-label">Received By (Personnel)</label>
                <select name="received_by" className="input-field" value={formData.received_by} onChange={handleChange} required>
                  <option value="">Select Personnel...</option>
                  {formData.received_by && !yarnWorkers.some(w => w.worker_name === formData.received_by) && (
                    <option value={formData.received_by}>{formData.received_by}</option>
                  )}
                  {yarnWorkers.map(w => (
                    <option key={w.id} value={w.worker_name}>{w.worker_name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label className="input-label">Invoice Attachment (Optional)</label>
                <input type="file" className="input-field" style={{ padding: '0.5rem' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>Files will be linked to receipt record.</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={!isAllVerified || saving}
            style={{ fontSize: '1rem', padding: '0.75rem 2rem', opacity: (!isAllVerified || saving) ? 0.5 : 1 }}
          >
            {saving ? (receiptType === 'spinning_mill' ? 'Generating AT/GYRR...' : 'Generating AT/GYPRR...') : 'Create Receipt + Print'}
          </button>
        </div>

      </form>
    </div>
  );
}
