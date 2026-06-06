import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ArrowLeft, Loader, Layers, Search, Eye, RefreshCw, ChevronDown, ChevronRight, Printer
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PrintableWOF from './PrintableWOF';
import DYDRDetail from '../../components/DYDRDetail';
import { printDydr } from '../../utils/printDydr';

// ── Status badge helper ─────────────────────────────────────────────────────
function getWofStatusBadge(wof) {
  const today = new Date().toISOString().split('T')[0];

  if (wof.status === 'completed') {
    // Completed late?
    if (wof.end_date && wof.end_date < today) {
      return { label: 'Completed Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'Completed', bg: '#dcfce7', color: '#166534', border: '#86efac' };
  }
  if (wof.status === 'stopped') {
    return { label: 'Stopped', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
  }
  if (wof.status === 'on_process') {
    // Late?
    if (wof.end_date && wof.end_date < today) {
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'On Process', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
  }
  // created
  if (wof.status === 'created') {
    if (wof.end_date && wof.end_date < today) {
      return { label: 'Late', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
    }
    return { label: 'Created', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
  return { label: wof.status, bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
}

function getYarnStatusBadge(allotments, associatedDydrs) {
  const totalAllotted = (allotments || []).reduce((sum, a) => sum + parseFloat(a.allotted_qty || a.kg || a.allottedQty || 0), 0);
  const totalDelivered = (associatedDydrs || []).reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

  if (totalAllotted === 0) {
    return { label: 'Not Required', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
  }
  if (totalDelivered === 0) {
    return { label: 'Not Delivered', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
  }
  if (totalDelivered < totalAllotted - 0.05) {
    return { label: 'Partially Delivered', bg: '#fef9c3', color: '#854d0e', border: '#fde047' };
  }
  return { label: 'Delivered', bg: '#dcfce7', color: '#166534', border: '#86efac' };
}

const STATUS_OPTIONS = ['all', 'created', 'on_process', 'completed', 'stopped'];

export default function WarpingOrderForms() {
  const navigate = useNavigate();
  const [wofs, setWofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [updating, setUpdating] = useState(null); // id of WOF being status-updated

  // Expanded row details state
  const [yarnCounts, setYarnCounts] = useState([]);
  const [expandedWofId, setExpandedWofId] = useState(null);
  const [activeDetailTab, setActiveDetailTab] = useState('yarn');
  const [dydrsByWof, setDydrsByWof] = useState({}); // { wofId: [dydrItems] }
  const [loadingDydrs, setLoadingDydrs] = useState(false);
  const [printWof, setPrintWof] = useState(null);

  const fetchWofs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('warping_order_forms')
      .select(`
        *,
        order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements),
        machine:master_machines(machine_name),
        partner:master_partners(partner_name)
      `)
      .order('created_at', { ascending: false });

    if (!error) {
      setWofs(data || []);
      const wofIds = (data || []).map(w => w.id);
      if (wofIds.length > 0) {
        setLoadingDydrs(true);
        const { data: dydrData } = await supabase
          .from('dyed_yarn_delivery_items')
          .select(`
            id,
            production_form_id,
            yarn_count_id,
            quantity_kg,
            no_of_bags,
            cone_weight,
            colour,
            lot_number,
            yarn_count:master_yarn_counts(count_value, material, product_type),
            delivery:dyed_yarn_deliveries(
              id,
              dydr_number,
              delivered_date,
              delivered_by,
              vehicle_no,
              remarks
            )
          `)
          .in('production_form_id', wofIds);
        
        const grouped = {};
        wofIds.forEach(id => { grouped[id] = []; });
        dydrData?.forEach(item => {
          if (grouped[item.production_form_id]) {
            grouped[item.production_form_id].push(item);
          }
        });
        setDydrsByWof(grouped);
        setLoadingDydrs(false);
      }
    }
    setLoading(false);
  };

  const fetchYarnCounts = async () => {
    const { data } = await supabase.from('master_yarn_counts').select('*');
    setYarnCounts(data || []);
  };

  useEffect(() => {
    fetchWofs();
    fetchYarnCounts();
  }, []);

  const handleToggleExpand = async (wofId) => {
    if (expandedWofId === wofId) {
      setExpandedWofId(null);
    } else {
      setExpandedWofId(wofId);
      setActiveDetailTab('yarn');
      if (!dydrsByWof[wofId]) {
        setLoadingDydrs(true);
        const { data, error } = await supabase
          .from('dyed_yarn_delivery_items')
          .select(`
            id,
            yarn_count_id,
            quantity_kg,
            no_of_bags,
            cone_weight,
            colour,
            lot_number,
            yarn_count:master_yarn_counts(count_value, material, product_type),
            delivery:dyed_yarn_deliveries(
              id,
              dydr_number,
              delivered_date,
              delivered_by,
              vehicle_no,
              remarks
            )
          `)
          .eq('production_form_id', wofId);
        
        if (!error && data) {
          setDydrsByWof(prev => ({ ...prev, [wofId]: data }));
        } else {
          setDydrsByWof(prev => ({ ...prev, [wofId]: [] }));
        }
        setLoadingDydrs(false);
      }
    }
  };

  const getPrevAllotted = (countId, countValue, colour, currentWof) => {
    const otherWofs = wofs.filter(w => w.order_id === currentWof.order_id && w.id !== currentWof.id);
    return otherWofs.reduce((sum, w) => {
      const allotment = (w.colour_allotments || []).find(
        a => (a.countId && countId && a.countId === countId) || (a.colour === colour && a.countValue === countValue)
      );
      return sum + parseFloat(allotment?.allotted_qty || 0);
    }, 0);
  };

  const updateStatus = async (id, newStatus) => {
    setUpdating(id);
    const updates = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'completed') {
      updates.process_completed_at = new Date().toISOString();
    } else if (newStatus === 'on_process') {
      updates.process_completed_at = null;
    }
    await supabase.from('warping_order_forms').update(updates).eq('id', id);
    await fetchWofs();
    setUpdating(null);
  };


  const filtered = wofs.filter(w => {
    const matchStatus = statusFilter === 'all' || w.status === statusFilter;
    const matchSearch = !searchText ||
      w.wof_number?.toLowerCase().includes(searchText.toLowerCase()) ||
      w.order?.order_number?.toLowerCase().includes(searchText.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Summary counts
  const counts = { all: wofs.length };
  STATUS_OPTIONS.slice(1).forEach(s => {
    counts[s] = wofs.filter(w => w.status === s).length;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => navigate('/production')}
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', padding: 0, marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={15} /> Back to Production
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg,#800000,#4d0000)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={20} color="white" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>Warping Order Forms</h1>
              <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>{wofs.length} total forms</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={fetchWofs} style={{ background: 'none', border: '1px solid var(--border-current)', borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => navigate('/production/warping-forms/new')}
              style={{ background: 'linear-gradient(135deg,#800000,#4d0000)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', fontSize: '0.875rem' }}
            >
              <Plus size={16} /> Create WOF
            </button>
          </div>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '0.35rem 1rem',
              borderRadius: '20px',
              border: `1.5px solid ${statusFilter === s ? '#800000' : 'var(--border-current)'}`,
              background: statusFilter === s ? '#800000' : 'var(--surface-current)',
              color: statusFilter === s ? 'white' : 'var(--text-muted-current)',
              fontWeight: '700',
              fontSize: '0.78rem',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: '380px' }}>
        <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)' }} />
        <input
          type="text"
          placeholder="Search WOF number or order number…"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem', paddingTop: '0.6rem', paddingBottom: '0.6rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)', color: 'var(--text-current)', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--text-muted-current)', gap: '0.75rem' }}>
          <Loader size={20} className="spin" /> Loading warping order forms…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: 'var(--surface-current)', borderRadius: '12px', border: '1px dashed var(--border-current)' }}>
          <Layers size={48} style={{ color: 'var(--text-muted-current)', opacity: 0.3, marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-muted-current)' }}>No warping order forms found</h3>
          <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Create your first warping order form to get started.</p>
          <button
            onClick={() => navigate('/production/warping-forms/new')}
            style={{ background: '#800000', color: 'white', border: 'none', borderRadius: '8px', padding: '0.65rem 1.5rem', cursor: 'pointer', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} /> Create WOF
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-current)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)', textAlign: 'left' }}>
                <th style={{ width: '40px', padding: '0.875rem 0.5rem' }}></th>
                {['WOF Number','Order','Design','Type','Machine / Partner','Qty (Mtrs)','Start','End','Status','Yarn Status','Action'].map(h => (
                  <th key={h} style={{ padding: '0.875rem 1rem', fontWeight: '800', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted-current)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((wof, idx) => {
                const badge = getWofStatusBadge(wof);
                const isExpanded = expandedWofId === wof.id;
                
                // Get warp requirements for the order
                const warpReqs = wof.order?.yarn_requirements?.filter(y => y.type === 'warp') || [];
                const associatedDydrs = dydrsByWof[wof.id] || [];
                const yarnBadge = getYarnStatusBadge(wof.colour_allotments, associatedDydrs);

                return (
                  <React.Fragment key={wof.id}>
                    <tr 
                      onClick={() => handleToggleExpand(wof.id)}
                      style={{ 
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)', 
                        backgroundColor: idx % 2 === 0 ? 'var(--surface-current)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      className="wof-row"
                    >
                      <td style={{ padding: '0.875rem 0.5rem', textAlign: 'center', width: '40px' }} onClick={(e) => { e.stopPropagation(); handleToggleExpand(wof.id); }}>
                        {isExpanded ? <ChevronDown size={16} color="var(--text-muted-current)" /> : <ChevronRight size={16} color="var(--text-muted-current)" />}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '700', color: '#800000', fontFamily: 'monospace', fontSize: '0.8rem' }}>{wof.wof_number}</td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '600' }}>{wof.order?.order_number || '—'}</td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>
                        {wof.order?.design_no || '—'} {wof.order?.design_name ? `/ ${wof.order.design_name}` : ''}
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{ backgroundColor: wof.wof_type === 'in_house' ? 'rgba(128,0,0,0.08)' : 'rgba(16,185,129,0.08)', color: wof.wof_type === 'in_house' ? '#800000' : '#059669', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700' }}>
                          {wof.wof_type === 'in_house' ? 'In-House' : 'Job Work'}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontSize: '0.8rem' }}>
                        {wof.wof_type === 'in_house' ? (wof.machine?.machine_name || wof.machine_name || '—') : (
                          <div>
                            <div style={{ fontWeight: '600' }}>{wof.partner?.partner_name || wof.partner_name || '—'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>{wof.machine?.machine_name || wof.machine_name || ''}</div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1rem', fontWeight: '700' }}>{Number(wof.qty).toLocaleString()}</td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>{wof.start_date || '—'}</td>
                      <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>{wof.end_date || '—'}</td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }}>
                        <span style={{ backgroundColor: yarnBadge.bg, color: yarnBadge.color, border: `1px solid ${yarnBadge.border}`, padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800', whiteSpace: 'nowrap' }}>
                          {yarnBadge.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.875rem 1rem' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setPrintWof(wof)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.35rem 0.75rem',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--border-current)',
                            borderRadius: '6px',
                            color: '#800000',
                            fontWeight: '600',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Eye size={13} /> View / Print
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.01)', borderBottom: '1px solid var(--border-current)' }}>
                        <td colSpan={12} style={{ padding: '1.5rem', borderLeft: '3px solid #800000' }} onClick={(e) => e.stopPropagation()}>
                          
                          {/* Tabs Header */}
                          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', marginBottom: '1.25rem', gap: '1rem' }}>
                            <button
                              onClick={() => setActiveDetailTab('yarn')}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeDetailTab === 'yarn' ? '2.5px solid #800000' : '2.5px solid transparent',
                                color: activeDetailTab === 'yarn' ? '#800000' : 'var(--text-muted-current)',
                                fontWeight: '700',
                                cursor: 'pointer',
                                fontSize: '0.825rem',
                                paddingBottom: '0.75rem',
                                transition: 'all 0.15s'
                              }}
                            >
                              Yarn Requirements & DYDR
                            </button>
                            <button
                              onClick={() => setActiveDetailTab('warping')}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeDetailTab === 'warping' ? '2.5px solid #800000' : '2.5px solid transparent',
                                color: activeDetailTab === 'warping' ? '#800000' : 'var(--text-muted-current)',
                                fontWeight: '700',
                                cursor: 'pointer',
                                fontSize: '0.825rem',
                                paddingBottom: '0.75rem',
                                transition: 'all 0.15s'
                              }}
                            >
                              Warping
                            </button>
                          </div>

                          {/* Tab Contents */}
                          {activeDetailTab === 'yarn' && (
                            <div>
                              {/* 1. Allotments Table */}
                              <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yarn Allotments for Warping Order Form</h4>
                                {(!wof.colour_allotments || wof.colour_allotments.length === 0) ? (
                                  <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic' }}>No allotments specified for this warping order form.</p>
                                ) : (
                                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#fdf8f8', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                          {['Colour', 'Yarn Count', 'Required Qty (kg)', 'Allotted (This WOF) (kg)', 'Dyed Yarn Delivered (kg)', 'Balance to Deliver (kg)'].map(h => (
                                            <th key={h} style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(wof.colour_allotments || []).map((a, rIdx) => {
                                          const yc = yarnCounts.find(y => y.id === a.countId);
                                          const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (a.countValue || '—');
                                          
                                          const allottedThisWof = parseFloat(a.allotted_qty || 0);

                                          // Dyed yarn delivered (matching both count and colour)
                                          const deliveredItems = associatedDydrs.filter(dItem => {
                                            const matchCount = (dItem.yarn_count_id && a.countId && dItem.yarn_count_id === a.countId) || 
                                                               (dItem.yarn_count?.count_value === a.countValue);
                                            const matchColour = (dItem.colour === a.colour);
                                            return matchCount && matchColour;
                                          });
                                          const deliveredQty = deliveredItems.reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);
                                          
                                          const requiredQty = parseFloat(a.required_qty || 0);
                                          const balanceToDeliver = Math.max(0, allottedThisWof - deliveredQty);

                                          return (
                                            <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{a.colour || '—'}</td>
                                              <td style={{ padding: '0.6rem 0.75rem' }}>{countDisplay}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600' }}>{requiredQty.toFixed(2)}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#800000' }}>{allottedThisWof.toFixed(2)}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: '#047857' }}>{deliveredQty.toFixed(2)}</td>
                                              <td style={{ padding: '0.6rem 0.75rem', fontWeight: '700', color: balanceToDeliver > 0.01 ? '#b45309' : '#047857' }}>
                                                {balanceToDeliver.toFixed(2)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                              {/* 2. DYDR Deliveries */}
                              <div>
                                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Associated Dyed Yarn Delivery Receipts (DYDR)
                                </h4>
                                {loadingDydrs ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>
                                    <Loader size={14} className="spin" /> Loading associated deliveries…
                                  </div>
                                ) : associatedDydrs.length === 0 ? (
                                  <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                    No DYDR delivery receipts have been created for this warping order form yet.
                                  </p>
                                ) : (
                                  <div>
                                    {(() => {
                                      const groupedMap = {};
                                      associatedDydrs.forEach(item => {
                                        const del = item.delivery;
                                        if (!del) return;
                                        if (!groupedMap[del.id]) {
                                          groupedMap[del.id] = {
                                            id: del.id,
                                            dydr_number: del.dydr_number,
                                            delivered_date: del.delivered_date,
                                            delivered_by: del.delivered_by,
                                            vehicle_no: del.vehicle_no,
                                            remarks: del.remarks,
                                            target_process: 'warping',
                                            doc_no: wof.wof_number,
                                            machine_name: wof.machine?.machine_name || wof.machine_name || '—',
                                            order_no: wof.order?.order_number || '—',
                                            design_no: wof.order?.design_no || '—',
                                            design_name: wof.order?.design_name || '',
                                            items: []
                                          };
                                        }
                                        groupedMap[del.id].items.push(item);
                                      });
                                      const groupedList = Object.values(groupedMap);
                                      return groupedList.map(gDydr => (
                                        <DYDRDetail 
                                          key={gDydr.id} 
                                          dydr={gDydr} 
                                          onPrint={(d) => printDydr(d, yarnCounts)} 
                                        />
                                      ));
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {activeDetailTab === 'warping' && (
                            <div style={{ padding: '2rem 1rem', textAlign: 'center', border: '1px dashed var(--border-current)', borderRadius: '8px', backgroundColor: 'var(--surface-current)' }}>
                              <Layers size={32} style={{ color: 'var(--text-muted-current)', opacity: 0.3, marginBottom: '0.75rem' }} />
                              <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                Warping production track records will be displayed here in a future update.
                              </p>
                            </div>
                          )}

                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {/* View/Print Modal Overlay */}
      {printWof && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: 'var(--surface-current)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '960px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--border-current)',
              backgroundColor: 'var(--surface-current)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)' }}>
                Warping Order Form details: {printWof.wof_number}
              </h3>
              <button
                onClick={() => setPrintWof(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted-current)',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  fontWeight: '300',
                  lineHeight: 1,
                  padding: '4px'
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              backgroundColor: 'var(--bg-current)'
            }}>
              <PrintableWOF
                wof={printWof}
                order={printWof.order}
                machineName={printWof.machine?.machine_name || printWof.machine_name}
                partnerName={printWof.partner?.partner_name || printWof.partner_name}
                yarnCounts={yarnCounts}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusUpdater({ wof, onUpdate, loading }) {
  const [open, setOpen] = useState(false);
  const nextStatuses = {
    created: ['on_process', 'stopped'],
    on_process: ['completed', 'stopped'],
    completed: [],
    stopped: ['on_process'],
  };

  const options = nextStatuses[wof.status] || [];

  if (options.length === 0) return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>—</span>;

  return (
    <div style={{ position: 'relative' }}>
      {loading ? (
        <Loader size={14} className="spin" />
      ) : (
        <button
          onClick={() => setOpen(!open)}
          style={{ border: '1px solid var(--border-current)', background: 'var(--surface-current)', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)' }}
        >
          Update <ChevronDown size={12} />
        </button>
      )}
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, background: 'var(--surface-current)', border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '140px', overflow: 'hidden' }}>
          {options.map(s => (
            <button
              key={s}
              onClick={() => { onUpdate(wof.id, s); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 1rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-current)', textTransform: 'capitalize' }}
            >
              → {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
