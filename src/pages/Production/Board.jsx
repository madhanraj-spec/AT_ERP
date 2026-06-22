import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Layers, Package, Zap, Coins, Eye, ChevronDown, ChevronRight, SlidersHorizontal, ChevronUp, Loader, RefreshCw, Calendar, ArrowRight, Clock, AlertCircle, Plus, X, Check, Trash2, Printer
} from 'lucide-react';
import DYDRDetail from '../../components/DYDRDetail';
import { printDydr } from '../../utils/printDydr';
import { useAuth } from '../../contexts/AuthContext';

function getLocalDateString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ProductionBoard() {
  const navigate = useNavigate();
  const [view, setView] = useState('hub'); // 'hub' | 'oversee' | 'finances'
  const [activeTab, setActiveTab] = useState('warping'); // 'warping' | 'sizing' | 'weaving' | 'inspection'
  const [financeTab, setFinanceTab] = useState('warping'); // 'warping' | 'sizing' | 'weaving'

  return (
    <>
      <PrintStyles />
      <div style={{ width: '100%', margin: '0', padding: '1.25rem 1.5rem' }} className="fade-in">
        {view === 'hub' ? (
          <ProductionHubView
            onOverseeClick={() => setView('oversee')}
            onFinancesClick={() => setView('finances')}
          />
        ) : view === 'oversee' ? (
          <ProductionOverseeView
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onBack={() => setView('hub')}
          />
        ) : (
          <ProductionFinancesView
            activeTab={financeTab}
            setActiveTab={setFinanceTab}
            onBack={() => setView('hub')}
          />
        )}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────
// 1. HUB VIEW (Displays all 6 Cards)
// ────────────────────────────────────────────────────────
function ProductionHubView({ onOverseeClick, onFinancesClick }) {
  const navigate = useNavigate();

  const originalModules = [
    {
      id: 'warping',
      title: 'Warping Order Form',
      description: 'Create and manage warping order forms for in-house machines and job work partners. Track colour allotments, machine assignments, and progress.',
      icon: Layers,
      color: '#800000',
      lightColor: 'rgba(128,0,0,0.08)',
      path: '/production/warping-forms',
      available: true,
      stats: [
        { label: 'In-House', icon: '🏭' },
        { label: 'Job Work', icon: '🤝' },
      ]
    },
    {
      id: 'sizing',
      title: 'Sizing Order Form',
      description: 'Manage sizing processes for warp beams, track starch recipes, machine allocations, and beam handover records.',
      icon: Package,
      color: '#0ea5e9',
      lightColor: 'rgba(14,165,233,0.08)',
      path: '/production/sizing-forms',
      available: true,
    },
    {
      id: 'weaving',
      title: 'Weaving Order Form',
      description: 'Issue weaving order forms to loom operators, assign sized beams to looms, and monitor fabric production progress.',
      icon: Zap,
      color: '#800000',
      lightColor: 'rgba(128,0,0,0.08)',
      path: '/production/weaving-forms',
      available: true,
    },
    {
      id: 'fabric-input',
      title: 'Fabric Input',
      description: 'Monitor loom scheduling and production progress with Gantt chart visuals for Airjet, Rapier, and Job Work partners.',
      icon: Layers,
      color: '#059669',
      lightColor: 'rgba(5,150,105,0.08)',
      path: '/production/fabric-input',
      available: true,
    },
    {
      id: 'fabric-movement',
      title: 'Fabric Movement',
      description: 'Track inventory locations and transfer fabric rolls between Factory and Office. Generate delivery challans (FMDCs) and print slips.',
      icon: RefreshCw,
      color: '#10b981',
      lightColor: 'rgba(16,185,129,0.08)',
      path: '/production/fabric-movement',
      available: true,
    },
    {
      id: 'fabric-cut',
      title: 'Fabric Cut',
      description: 'Cut large greige fabric rolls into smaller ones, assign new IDs, and manage inspection details.',
      icon: Package, // Using Package icon for now, can change if a more suitable one is available
      color: '#ff7043',
      lightColor: 'rgba(255,112,67,0.08)',
      path: '/production/fabric-cut',
      available: true,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{
            width: '42px', height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #800000, #4d0000)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Layers size={22} color="white" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-current)' }}>
            Production Management
          </h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.9rem', paddingLeft: '3.25rem' }}>
          Manage your production pipeline — select a module or view oversight details below.
        </p>
      </div>

      {/* Cards Grid containing 6 cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2.5rem'
      }}>
        {/* Render Original Modules */}
        {originalModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.id}
              className="hover-lift"
              onClick={() => navigate(mod.path)}
              style={{
                backgroundColor: 'var(--surface-current)',
                border: '1px solid var(--border-current)',
                borderRadius: '16px',
                padding: '1.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{
                position: 'absolute', top: 0, right: 0,
                width: '120px', height: '120px',
                borderRadius: '0 16px 0 120px',
                background: mod.lightColor,
                pointerEvents: 'none'
              }} />

              <div style={{
                width: '52px', height: '52px',
                borderRadius: '12px',
                backgroundColor: mod.lightColor,
                border: `1.5px solid ${mod.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.25rem'
              }}>
                <Icon size={26} color={mod.color} />
              </div>

              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)' }}>
                {mod.title}
              </h2>
              <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted-current)', fontSize: '0.85rem', lineHeight: '1.55' }}>
                {mod.description}
              </p>

              {mod.stats && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  {mod.stats.map((s, i) => (
                    <span key={i} style={{
                      backgroundColor: mod.lightColor,
                      color: mod.color,
                      border: `1px solid ${mod.color}25`,
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      {s.icon} {s.label}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: mod.color, fontWeight: '700', fontSize: '0.875rem' }}>
                Open Module <ArrowRight size={16} />
              </div>
            </div>
          );
        })}

        {/* Oversee Card */}
        <div
          onClick={onOverseeClick}
          className="hover-lift"
          style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: '16px',
            padding: '1.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '120px', height: '120px',
            borderRadius: '0 16px 0 120px',
            background: 'rgba(128,0,0,0.08)',
            pointerEvents: 'none'
          }} />

          <div style={{
            width: '52px', height: '52px',
            borderRadius: '12px',
            backgroundColor: 'rgba(128,0,0,0.08)',
            border: '1.5px solid rgba(128,0,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1.25rem'
          }}>
            <Eye size={26} color="#800000" />
          </div>

          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)' }}>
            Production Oversee
          </h2>
          <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted-current)', fontSize: '0.85rem', lineHeight: '1.55' }}>
            Monitor completed warping, sizing order forms, daily loom logs, and inspections in real-time.
          </p>
          <div style={{ color: '#800000', fontWeight: '700', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Open Oversee Portal <ArrowRight size={16} />
          </div>
        </div>

        {/* Finances Card */}
        <div
          onClick={onFinancesClick}
          className="hover-lift"
          style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: '16px',
            padding: '1.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '120px', height: '120px',
            borderRadius: '0 16px 0 120px',
            background: 'rgba(14,165,233,0.08)',
            pointerEvents: 'none'
          }} />

          <div style={{
            width: '52px', height: '52px',
            borderRadius: '12px',
            backgroundColor: 'rgba(14,165,233,0.08)',
            border: '1.5px solid rgba(14,165,233,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1.25rem'
          }}>
            <Coins size={26} color="#0ea5e9" />
          </div>

          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)' }}>
            Production Finances
          </h2>
          <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted-current)', fontSize: '0.85rem', lineHeight: '1.55' }}>
            Verify invoices, track settlements, and manage payments for warping, sizing, and weaving.
          </p>
          <div style={{ color: '#0ea5e9', fontWeight: '700', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Open Production Finances <ArrowRight size={16} />
          </div>
        </div>
      </div>

      {/* Info note */}
      <div style={{
        marginTop: '2.5rem',
        padding: '1rem 1.25rem',
        backgroundColor: 'rgba(128,0,0,0.05)',
        border: '1px solid rgba(128,0,0,0.15)',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem'
      }}>
        <AlertCircle size={18} color="#800000" style={{ marginTop: '1px', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-muted-current)', lineHeight: '1.5' }}>
          Production order forms are linked to approved orders. Ensure orders are created and approved in the Orders module before creating warping order forms.
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 2. OVERSEE VIEW (Same as before)
// ────────────────────────────────────────────────────────
function ProductionOverseeView({ activeTab, setActiveTab, onBack }) {
  return (
    <div className="fade-in">
      {/* Header with Back button */}
      <div style={{ marginBottom: '1.5rem' }} className="no-print">
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: '#800000',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
            padding: 0, marginBottom: '0.75rem'
          }}
        >
          &larr; Back to Dashboard
        </button>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>
          Production Oversee
        </h1>
      </div>

      {/* Tabs Menu */}
      <div style={{
        display: 'flex', borderBottom: '2px solid var(--border-current)',
        marginBottom: '1.5rem', gap: '1.5rem', overflowX: 'auto',
        whiteSpace: 'nowrap'
      }} className="hide-scrollbar no-print">
        {[
          { id: 'warping', label: '🔧 Warping' },
          { id: 'sizing', label: '📏 Sizing' },
          { id: 'weaving', label: '🏭 Weaving Daily Logs' },
          { id: 'inspection', label: '🔍 Inspection QC' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #800000' : '3px solid transparent',
              color: activeTab === tab.id ? '#800000' : 'var(--text-muted-current)',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Render selected tab panel */}
      {activeTab === 'warping' && <WarpingOverseeTab />}
      {activeTab === 'sizing' && <SizingOverseeTab />}
      {activeTab === 'weaving' && <WeavingOverseeTab />}
      {activeTab === 'inspection' && <InspectionOverseeTab />}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// 3. PRODUCTION FINANCES VIEW
// ────────────────────────────────────────────────────────
function ProductionFinancesView({ activeTab, setActiveTab, onBack }) {
  return (
    <div className="fade-in">
      {/* Header with Back button */}
      <div style={{ marginBottom: '1.5rem' }} className="no-print">
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: '#800000',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
            padding: 0, marginBottom: '0.75rem'
          }}
        >
          &larr; Back to Dashboard
        </button>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>
          Production Finances
        </h1>
      </div>

      {/* Tabs Menu */}
      <div style={{
        display: 'flex', borderBottom: '2px solid var(--border-current)',
        marginBottom: '1.5rem', gap: '1.5rem', overflowX: 'auto',
        whiteSpace: 'nowrap'
      }} className="hide-scrollbar no-print">
        {[
          { id: 'warping', label: '🔧 Warping' },
          { id: 'sizing', label: '📏 Sizing' },
          { id: 'weaving', label: '🏭 Weaving' },
          { id: 'all_bills', label: '🧾 All Bills' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #800000' : '3px solid transparent',
              color: activeTab === tab.id ? '#800000' : 'var(--text-muted-current)',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Render selected tab panel */}
      {activeTab === 'warping' && <WarpingFinancesTab />}
      {activeTab === 'sizing' && <SizingFinancesTab />}
      {activeTab === 'weaving' && <WeavingFinancesTab />}
      {activeTab === 'all_bills' && <AllBillsFinancesTab />}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// WARPING TAB COMPONENT
// ────────────────────────────────────────────────────────
function WarpingOverseeTab() {
  const [wofs, setWofs] = useState([]);
  const [dydrs, setDydrs] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Filters state
  const [selWofNos, setSelWofNos] = useState([]);
  const [selOrderNos, setSelOrderNos] = useState([]);
  const [selDates, setSelDates] = useState([]);
  const [selWarpers, setSelWarpers] = useState([]);
  const [selMachines, setSelMachines] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [wofRes, ycRes] = await Promise.all([
        supabase
          .from('warping_order_forms')
          .select(`
            *,
            order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements),
            machine:master_machines(machine_name),
            partner:master_partners(partner_name)
          `)
          .eq('wof_type', 'in_house')
          .eq('status', 'completed')
          .order('created_at', { ascending: false }),
        supabase
          .from('master_yarn_counts')
          .select('*')
      ]);

      if (wofRes.error) throw wofRes.error;
      const wofList = wofRes.data || [];
      setWofs(wofList);
      setYarnCounts(ycRes.data || []);

      const wofIds = wofList.map(w => w.id);
      if (wofIds.length > 0) {
        const { data: dData, error: dErr } = await supabase
          .from('dyed_yarn_delivery_items')
          .select(`
            id,
            production_form_id,
            yarn_count_id,
            quantity_kg,
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
        if (!dErr) setDydrs(dData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter logic
  const filtered = useMemo(() => {
    return wofs.filter(w => {
      if (selWofNos.length > 0 && !selWofNos.includes(w.wof_number)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(w.order?.order_number || '—')) return false;
      const dateStr = getLocalDateString(w.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      if (selWarpers.length > 0 && !selWarpers.includes(w.warper_name || 'Not Assigned')) return false;
      const machName = w.machine?.machine_name || w.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
  }, [wofs, selWofNos, selOrderNos, selDates, selWarpers, selMachines]);

  // Dependable Options
  const wofNoOptions = useMemo(() => {
    const matched = wofs.filter(w => {
      if (selOrderNos.length > 0 && !selOrderNos.includes(w.order?.order_number || '—')) return false;
      const dateStr = getLocalDateString(w.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      if (selWarpers.length > 0 && !selWarpers.includes(w.warper_name || 'Not Assigned')) return false;
      const machName = w.machine?.machine_name || w.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(w => w.wof_number).filter(Boolean))).sort();
  }, [wofs, selOrderNos, selDates, selWarpers, selMachines]);

  const orderNoOptions = useMemo(() => {
    const matched = wofs.filter(w => {
      if (selWofNos.length > 0 && !selWofNos.includes(w.wof_number)) return false;
      const dateStr = getLocalDateString(w.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      if (selWarpers.length > 0 && !selWarpers.includes(w.warper_name || 'Not Assigned')) return false;
      const machName = w.machine?.machine_name || w.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(w => w.order?.order_number || '—').filter(Boolean))).sort();
  }, [wofs, selWofNos, selDates, selWarpers, selMachines]);

  const dateOptions = useMemo(() => {
    const matched = wofs.filter(w => {
      if (selWofNos.length > 0 && !selWofNos.includes(w.wof_number)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(w.order?.order_number || '—')) return false;
      if (selWarpers.length > 0 && !selWarpers.includes(w.warper_name || 'Not Assigned')) return false;
      const machName = w.machine?.machine_name || w.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(w => getLocalDateString(w.start_date)).filter(Boolean))).sort();
  }, [wofs, selWofNos, selOrderNos, selWarpers, selMachines]);

  const warperOptions = useMemo(() => {
    const matched = wofs.filter(w => {
      if (selWofNos.length > 0 && !selWofNos.includes(w.wof_number)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(w.order?.order_number || '—')) return false;
      const dateStr = getLocalDateString(w.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      const machName = w.machine?.machine_name || w.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(w => w.warper_name || 'Not Assigned'))).sort();
  }, [wofs, selWofNos, selOrderNos, selDates, selMachines]);

  const machineOptions = useMemo(() => {
    const matched = wofs.filter(w => {
      if (selWofNos.length > 0 && !selWofNos.includes(w.wof_number)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(w.order?.order_number || '—')) return false;
      const dateStr = getLocalDateString(w.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      if (selWarpers.length > 0 && !selWarpers.includes(w.warper_name || 'Not Assigned')) return false;
      return true;
    });
    return Array.from(new Set(matched.map(w => w.machine?.machine_name || w.machine_name || '—').filter(Boolean))).sort();
  }, [wofs, selWofNos, selOrderNos, selDates, selWarpers]);

  const clearFilters = () => {
    setSelWofNos([]);
    setSelOrderNos([]);
    setSelDates([]);
    setSelWarpers([]);
    setSelMachines([]);
  };

  const summary = useMemo(() => {
    const uniqueWofs = new Set(filtered.map(w => w.wof_number).filter(Boolean)).size;
    const uniqueDays = new Set(filtered.map(w => getLocalDateString(w.start_date)).filter(Boolean)).size;
    const totalQty = filtered.reduce((acc, w) => acc + Number(w.qty || 0), 0);
    return { uniqueWofs, uniqueDays, totalQty };
  }, [filtered]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="fade-in print-report-container">
      {/* Print-only Header */}
      <div className="print-only" style={{ display: 'none', marginBottom: '1.5rem', borderBottom: '2px solid #800000', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#800000', fontSize: '1.4rem', fontWeight: '800' }}>ASHOK TEXTILES</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#555' }}>Fabric Manufacturing ERP</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#800000' }}>WARPING OVERSEE REPORT</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#666' }}>Printed on: {new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }} className="no-print">
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-current)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          Completed In-House Warping forms ({filtered.length})
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: 'var(--surface-current)',
              color: '#800000', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            🖨 Print Report
          </button>
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: isFilterExpanded ? 'rgba(128,0,0,0.08)' : 'var(--surface-current)',
              color: '#800000', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={14} /> Filters
            {isFilterExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={fetchData}
            style={{
              padding: '0.45rem 0.75rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: 'var(--surface-current)',
              color: 'var(--text-muted-current)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3'
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {isFilterExpanded && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem', padding: '1rem', backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }} className="no-print">
          <MultiSelectDropdown label="WOF Number" options={wofNoOptions} selectedValues={selWofNos} onChange={setSelWofNos} />
          <MultiSelectDropdown label="Order Number" options={orderNoOptions} selectedValues={selOrderNos} onChange={setSelOrderNos} />
          <MultiSelectDropdown label="Date" options={dateOptions} selectedValues={selDates} onChange={setSelDates} />
          <MultiSelectDropdown label="Warper" options={warperOptions} selectedValues={selWarpers} onChange={setSelWarpers} />
          <MultiSelectDropdown label="Machine" options={machineOptions} selectedValues={selMachines} onChange={setSelMachines} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={clearFilters} style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', color: '#64748b', background: 'none', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Warping Forms (WOF)
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {summary.uniqueWofs} Forms
          </span>
        </div>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Production Days
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {summary.uniqueDays} Days
          </span>
        </div>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Warp Quantity
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {Number(summary.totalQty).toLocaleString()} m
          </span>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }} className="no-print">
          <Loader size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }}>
          No completed warping forms found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }} className="hide-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', minWidth: '850px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.015)', color: 'var(--text-muted-current)', fontWeight: '700' }}>
                <th style={{ padding: '0.75rem 0.5rem', width: '40px' }} />
                <th style={{ padding: '0.75rem 0.5rem' }}>WOF Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Order Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Design (No / Name)</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Planned Dates</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Actual Dates</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Warper</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Machine</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Qty (m)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(w => {
                const isExpanded = expandedId === w.id;
                const associatedDydrs = dydrs.filter(d => d.production_form_id === w.id);
                return (
                  <React.Fragment key={w.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : w.id)}
                      style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.01)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '800', color: '#800000', fontFamily: 'monospace' }}>{w.wof_number}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{w.order?.order_number || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div>{w.order?.design_no || '—'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>{w.order?.design_name || '—'}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem' }}>
                        <div><span style={{ color: 'var(--text-muted-current)' }}>Start:</span> {w.start_date || '—'}</div>
                        <div><span style={{ color: 'var(--text-muted-current)' }}>End:</span> {w.end_date || '—'}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem' }}>
                        <div><span style={{ color: 'var(--text-muted-current)' }}>Start:</span> {w.process_started_at ? new Date(w.process_started_at).toLocaleDateString('en-GB') : '—'}</div>
                        <div><span style={{ color: 'var(--text-muted-current)' }}>End:</span> {w.process_completed_at ? new Date(w.process_completed_at).toLocaleDateString('en-GB') : '—'}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{w.warper_name || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{w.machine?.machine_name || w.machine_name || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(w.qty).toLocaleString()}</td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.01)' }}>
                        <td colSpan={9} style={{ padding: '1rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Created By</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{w.warper_name || '—'}</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Status Check</span>
                              <span style={{ display: 'inline-block', backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700', marginTop: '2px' }}>Completed</span>
                            </div>
                            {w.forwarded_to && (
                              <div>
                                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Forwarded Process</span>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#800000', textTransform: 'capitalize' }}>{w.forwarded_to} ({w.sizing_type || 'in_house'})</span>
                              </div>
                            )}
                          </div>

                          {/* Associated DYDR receipts */}
                          <div style={{ borderTop: '1px dashed var(--border-current)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)' }}>
                              Associated Dyed Yarn Delivery Receipts (DYDR)
                            </h4>
                            {associatedDydrs.length === 0 ? (
                              <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-muted-current)', fontSize: '0.75rem' }}>No DYDR delivery receipts associated.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {(() => {
                                  const groups = {};
                                  associatedDydrs.forEach(item => {
                                    const del = item.delivery;
                                    if (!del) return;
                                    if (!groups[del.id]) {
                                      groups[del.id] = {
                                        id: del.id,
                                        dydr_number: del.dydr_number,
                                        delivered_date: del.delivered_date,
                                        delivered_by: del.delivered_by,
                                        vehicle_no: del.vehicle_no,
                                        remarks: del.remarks,
                                        target_process: 'warping',
                                        doc_no: w.wof_number,
                                        machine_name: w.machine?.machine_name || w.machine_name || '—',
                                        order_no: w.order?.order_number || '—',
                                        design_no: w.order?.design_no || '—',
                                        design_name: w.order?.design_name || '',
                                        items: []
                                      };
                                    }
                                    groups[del.id].items.push(item);
                                  });
                                  return Object.values(groups).map((g, idx) => (
                                    <DYDRDetail
                                      key={g.id || idx}
                                      dydr={g}
                                      onPrint={(d) => printDydr(d, yarnCounts)}
                                    />
                                  ));
                                })()}
                              </div>
                            )}
                          </div>
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
    </div>
  );
}

// ────────────────────────────────────────────────────────
// SIZING TAB COMPONENT
// ────────────────────────────────────────────────────────
function SizingOverseeTab() {
  const [sofs, setSofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Filters state
  const [selSofNos, setSelSofNos] = useState([]);
  const [selWofRefs, setSelWofRefs] = useState([]);
  const [selOrderNos, setSelOrderNos] = useState([]);
  const [selDates, setSelDates] = useState([]);
  const [selMachines, setSelMachines] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sizing_order_forms')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name),
          wof:warping_order_forms(id, wof_number)
        `)
        .eq('sizing_type', 'in_house')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSofs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter logic
  const filtered = useMemo(() => {
    return sofs.filter(s => {
      if (selSofNos.length > 0 && !selSofNos.includes(s.sof_number)) return false;
      if (selWofRefs.length > 0 && !selWofRefs.includes(s.wof?.wof_number || '—')) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(s.order?.order_number || '—')) return false;
      const dateStr = getLocalDateString(s.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      const machName = s.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
  }, [sofs, selSofNos, selWofRefs, selOrderNos, selDates, selMachines]);

  // Dependable Options
  const sofNoOptions = useMemo(() => {
    const matched = sofs.filter(s => {
      if (selWofRefs.length > 0 && !selWofRefs.includes(s.wof?.wof_number || '—')) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(s.order?.order_number || '—')) return false;
      const dateStr = getLocalDateString(s.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      const machName = s.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(s => s.sof_number).filter(Boolean))).sort();
  }, [sofs, selWofRefs, selOrderNos, selDates, selMachines]);

  const wofRefOptions = useMemo(() => {
    const matched = sofs.filter(s => {
      if (selSofNos.length > 0 && !selSofNos.includes(s.sof_number)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(s.order?.order_number || '—')) return false;
      const dateStr = getLocalDateString(s.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      const machName = s.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(s => s.wof?.wof_number || '—').filter(Boolean))).sort();
  }, [sofs, selSofNos, selOrderNos, selDates, selMachines]);

  const orderNoOptions = useMemo(() => {
    const matched = sofs.filter(s => {
      if (selSofNos.length > 0 && !selSofNos.includes(s.sof_number)) return false;
      if (selWofRefs.length > 0 && !selWofRefs.includes(s.wof?.wof_number || '—')) return false;
      const dateStr = getLocalDateString(s.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      const machName = s.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(s => s.order?.order_number || '—').filter(Boolean))).sort();
  }, [sofs, selSofNos, selWofRefs, selDates, selMachines]);

  const dateOptions = useMemo(() => {
    const matched = sofs.filter(s => {
      if (selSofNos.length > 0 && !selSofNos.includes(s.sof_number)) return false;
      if (selWofRefs.length > 0 && !selWofRefs.includes(s.wof?.wof_number || '—')) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(s.order?.order_number || '—')) return false;
      const machName = s.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(s => getLocalDateString(s.start_date)).filter(Boolean))).sort();
  }, [sofs, selSofNos, selWofRefs, selOrderNos, selMachines]);

  const machineOptions = useMemo(() => {
    const matched = sofs.filter(s => {
      if (selSofNos.length > 0 && !selSofNos.includes(s.sof_number)) return false;
      if (selWofRefs.length > 0 && !selWofRefs.includes(s.wof?.wof_number || '—')) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(s.order?.order_number || '—')) return false;
      const dateStr = getLocalDateString(s.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(s => s.machine_name || '—').filter(Boolean))).sort();
  }, [sofs, selSofNos, selWofRefs, selOrderNos, selDates]);

  const clearFilters = () => {
    setSelSofNos([]);
    setSelWofRefs([]);
    setSelOrderNos([]);
    setSelDates([]);
    setSelMachines([]);
  };

  const summary = useMemo(() => {
    const uniqueSofs = new Set(filtered.map(s => s.sof_number).filter(Boolean)).size;
    const uniqueDays = new Set(filtered.map(s => getLocalDateString(s.start_date)).filter(Boolean)).size;
    const totalQty = filtered.reduce((acc, s) => acc + Number(s.qty || 0), 0);
    return { uniqueSofs, uniqueDays, totalQty };
  }, [filtered]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="fade-in print-report-container">
      {/* Print-only Header */}
      <div className="print-only" style={{ display: 'none', marginBottom: '1.5rem', borderBottom: '2px solid #800000', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#800000', fontSize: '1.4rem', fontWeight: '800' }}>ASHOK TEXTILES</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#555' }}>Fabric Manufacturing ERP</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#800000' }}>SIZING OVERSEE REPORT</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#666' }}>Printed on: {new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }} className="no-print">
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-current)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          Completed In-House Sizing forms ({filtered.length})
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: 'var(--surface-current)',
              color: '#800000', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            🖨 Print Report
          </button>
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: isFilterExpanded ? 'rgba(128,0,0,0.08)' : 'var(--surface-current)',
              color: '#800000', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={14} /> Filters
            {isFilterExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={fetchData}
            style={{
              padding: '0.45rem 0.75rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: 'var(--surface-current)',
              color: 'var(--text-muted-current)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3'
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {isFilterExpanded && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem', padding: '1rem', backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }} className="no-print">
          <MultiSelectDropdown label="SOF Number" options={sofNoOptions} selectedValues={selSofNos} onChange={setSelSofNos} />
          <MultiSelectDropdown label="WOF Ref" options={wofRefOptions} selectedValues={selWofRefs} onChange={setSelWofRefs} />
          <MultiSelectDropdown label="Order Number" options={orderNoOptions} selectedValues={selOrderNos} onChange={setSelOrderNos} />
          <MultiSelectDropdown label="Date" options={dateOptions} selectedValues={selDates} onChange={setSelDates} />
          <MultiSelectDropdown label="Machine" options={machineOptions} selectedValues={selMachines} onChange={setSelMachines} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={clearFilters} style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', color: '#64748b', background: 'none', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sizing Forms (SOF)
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {summary.uniqueSofs} Forms
          </span>
        </div>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Production Days
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {summary.uniqueDays} Days
          </span>
        </div>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Sized Quantity
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {Number(summary.totalQty).toLocaleString()} m
          </span>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }} className="no-print">
          <Loader size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }}>
          No completed sizing forms found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }} className="hide-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', minWidth: '850px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.015)', color: 'var(--text-muted-current)', fontWeight: '700' }}>
                <th style={{ padding: '0.75rem 0.5rem', width: '40px' }} />
                <th style={{ padding: '0.75rem 0.5rem' }}>SOF Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>WOF Ref</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Order Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Design (No / Name)</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Planned Dates</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Actual Dates</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Machine</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Qty (m)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const isExpanded = expandedId === s.id;
                return (
                  <React.Fragment key={s.id}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.01)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '800', color: '#800000', fontFamily: 'monospace' }}>{s.sof_number}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: 'var(--text-muted-current)', fontFamily: 'monospace' }}>{s.wof?.wof_number || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{s.order?.order_number || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div>{s.order?.design_no || '—'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>{s.order?.design_name || '—'}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem' }}>
                        <div><span style={{ color: 'var(--text-muted-current)' }}>Start:</span> {s.start_date || '—'}</div>
                        <div><span style={{ color: 'var(--text-muted-current)' }}>End:</span> {s.end_date || '—'}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem' }}>
                        <div><span style={{ color: 'var(--text-muted-current)' }}>Start:</span> {s.process_started_at ? new Date(s.process_started_at).toLocaleDateString('en-GB') : '—'}</div>
                        <div><span style={{ color: 'var(--text-muted-current)' }}>End:</span> {s.process_completed_at ? new Date(s.process_completed_at).toLocaleDateString('en-GB') : '—'}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{s.machine_name || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(s.qty).toLocaleString()}</td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.01)' }}>
                        <td colSpan={9} style={{ padding: '1rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Beam Reference</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>{s.beam_name || '—'}</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Sizer Operator</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{s.sizer_name || '—'}</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Sizing DC Number</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#800000', fontFamily: 'monospace' }}>{s.sofdc_number || '—'}</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Status</span>
                              <span style={{ display: 'inline-block', backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700', marginTop: '2px' }}>Completed</span>
                            </div>
                          </div>
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
    </div>
  );
}

// ────────────────────────────────────────────────────────
// WEAVING TAB (DAILY PRODUCTION LOGS) COMPONENT
// ────────────────────────────────────────────────────────
function WeavingOverseeTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Filters State
  const [selDates, setSelDates] = useState([]);
  const [selMachines, setSelMachines] = useState([]);
  const [selWvofs, setSelWvofs] = useState([]);
  const [selOrderNos, setSelOrderNos] = useState([]);
  const [selDesigns, setSelDesigns] = useState([]);
  const [selWeavers, setSelWeavers] = useState([]);

  // Date range picker values
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name, technical_specs),
          machine:master_machines(machine_name)
        `)
        .eq('weaving_type', 'in_house')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Flat map the logs
      const rawLogs = [];
      data.forEach(wv => {
        const prodLogs = Array.isArray(wv.production_logs) ? wv.production_logs : [];
        prodLogs.forEach(l => {
          rawLogs.push({
            logId: l.id || `${wv.id}-${l.timestamp}-${l.qty}`,
            timestamp: l.timestamp,
            date: getLocalDateString(l.timestamp),
            time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            machine: wv.machine_name || wv.machine?.machine_name || '—',
            wvof: wv.weaving_number,
            order_number: wv.order?.order_number || '—',
            design: `${wv.order?.design_no || '—'} / ${wv.order?.design_name || '—'}`,
            design_no: wv.order?.design_no || '—',
            design_name: wv.order?.design_name || '—',
            construction: wv.order?.technical_specs
              ? `${wv.order.technical_specs.on_loom_reed || '—'} / ${wv.order.technical_specs.on_loom_pick || '—'}`
              : '—',
            weaver: l.weaver || '—',
            qty: l.qty || 0,
            wvof_details: wv
          });
        });
      });

      // Sort logs descending by date and time
      rawLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setLogs(rawLogs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter logs list based on selections and date range
  const filtered = useMemo(() => {
    return logs.filter(l => {
      // Date Range filter
      if (fromDate) {
        const logDate = l.date; // 'YYYY-MM-DD'
        if (logDate < fromDate) return false;
      }
      if (toDate) {
        const logDate = l.date; // 'YYYY-MM-DD'
        if (logDate > toDate) return false;
      }

      // Dropdown filters
      if (selDates.length > 0 && !selDates.includes(l.date)) return false;
      if (selMachines.length > 0 && !selMachines.includes(l.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(l.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(l.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(l.design)) return false;
      if (selWeavers.length > 0 && !selWeavers.includes(l.weaver)) return false;
      return true;
    });
  }, [logs, selDates, selMachines, selWvofs, selOrderNos, selDesigns, selWeavers, fromDate, toDate]);

  // Dependable Options
  const dateOptions = useMemo(() => {
    const matched = logs.filter(l => {
      if (fromDate && l.date < fromDate) return false;
      if (toDate && l.date > toDate) return false;
      if (selMachines.length > 0 && !selMachines.includes(l.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(l.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(l.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(l.design)) return false;
      if (selWeavers.length > 0 && !selWeavers.includes(l.weaver)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(l => l.date).filter(Boolean))).sort();
  }, [logs, selMachines, selWvofs, selOrderNos, selDesigns, selWeavers, fromDate, toDate]);

  const machineOptions = useMemo(() => {
    const matched = logs.filter(l => {
      if (fromDate && l.date < fromDate) return false;
      if (toDate && l.date > toDate) return false;
      if (selDates.length > 0 && !selDates.includes(l.date)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(l.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(l.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(l.design)) return false;
      if (selWeavers.length > 0 && !selWeavers.includes(l.weaver)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(l => l.machine).filter(Boolean))).sort();
  }, [logs, selDates, selWvofs, selOrderNos, selDesigns, selWeavers, fromDate, toDate]);

  const wvofOptions = useMemo(() => {
    const matched = logs.filter(l => {
      if (fromDate && l.date < fromDate) return false;
      if (toDate && l.date > toDate) return false;
      if (selDates.length > 0 && !selDates.includes(l.date)) return false;
      if (selMachines.length > 0 && !selMachines.includes(l.machine)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(l.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(l.design)) return false;
      if (selWeavers.length > 0 && !selWeavers.includes(l.weaver)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(l => l.wvof).filter(Boolean))).sort();
  }, [logs, selDates, selMachines, selOrderNos, selDesigns, selWeavers, fromDate, toDate]);

  const orderNoOptions = useMemo(() => {
    const matched = logs.filter(l => {
      if (fromDate && l.date < fromDate) return false;
      if (toDate && l.date > toDate) return false;
      if (selDates.length > 0 && !selDates.includes(l.date)) return false;
      if (selMachines.length > 0 && !selMachines.includes(l.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(l.wvof)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(l.design)) return false;
      if (selWeavers.length > 0 && !selWeavers.includes(l.weaver)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(l => l.order_number).filter(Boolean))).sort();
  }, [logs, selDates, selMachines, selWvofs, selDesigns, selWeavers, fromDate, toDate]);

  const designOptions = useMemo(() => {
    const matched = logs.filter(l => {
      if (fromDate && l.date < fromDate) return false;
      if (toDate && l.date > toDate) return false;
      if (selDates.length > 0 && !selDates.includes(l.date)) return false;
      if (selMachines.length > 0 && !selMachines.includes(l.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(l.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(l.order_number)) return false;
      if (selWeavers.length > 0 && !selWeavers.includes(l.weaver)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(l => l.design).filter(Boolean))).sort();
  }, [logs, selDates, selMachines, selWvofs, selOrderNos, selWeavers, fromDate, toDate]);

  const weaverOptions = useMemo(() => {
    const matched = logs.filter(l => {
      if (fromDate && l.date < fromDate) return false;
      if (toDate && l.date > toDate) return false;
      if (selDates.length > 0 && !selDates.includes(l.date)) return false;
      if (selMachines.length > 0 && !selMachines.includes(l.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(l.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(l.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(l.design)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(l => l.weaver).filter(Boolean))).sort();
  }, [logs, selDates, selMachines, selWvofs, selOrderNos, selDesigns, fromDate, toDate]);

  const clearFilters = () => {
    setSelDates([]);
    setSelMachines([]);
    setSelWvofs([]);
    setSelOrderNos([]);
    setSelDesigns([]);
    setSelWeavers([]);
    setFromDate('');
    setToDate('');
  };

  const summary = useMemo(() => {
    const uniqueWvofs = new Set(filtered.map(l => l.wvof).filter(Boolean)).size;
    const uniqueDays = new Set(filtered.map(l => l.date).filter(Boolean)).size;
    const totalLogs = filtered.length;
    const totalQty = filtered.reduce((acc, l) => acc + Number(l.qty || 0), 0);
    return { uniqueWvofs, uniqueDays, totalLogs, totalQty };
  }, [filtered]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="fade-in print-report-container">
      {/* Print-only Header */}
      <div className="print-only" style={{ display: 'none', marginBottom: '1.5rem', borderBottom: '2px solid #800000', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#800000', fontSize: '1.4rem', fontWeight: '800' }}>ASHOK TEXTILES</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#555' }}>Fabric Manufacturing ERP</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#800000' }}>WEAVING DAILY LOGS REPORT</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#666' }}>Printed on: {new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }} className="no-print">
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-current)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          Weaving Daily Production Logs ({filtered.length})
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Quick Date Range Summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
            <Calendar size={14} />
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              style={{ border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.2rem 0.4rem', fontSize: '0.75rem', background: 'var(--surface-current)', color: 'var(--text-current)' }}
            />
            <span>to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              style={{ border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.2rem 0.4rem', fontSize: '0.75rem', background: 'var(--surface-current)', color: 'var(--text-current)' }}
            />
          </div>

          <button
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: 'var(--surface-current)',
              color: '#800000', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            🖨 Print Report
          </button>
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: isFilterExpanded ? 'rgba(128,0,0,0.08)' : 'var(--surface-current)',
              color: '#800000', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={14} /> Column Filters
            {isFilterExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={fetchData}
            style={{
              padding: '0.45rem 0.75rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: 'var(--surface-current)',
              color: 'var(--text-muted-current)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3'
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {isFilterExpanded && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem', padding: '1rem', backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }} className="no-print">
          <MultiSelectDropdown label="Date" options={dateOptions} selectedValues={selDates} onChange={setSelDates} />
          <MultiSelectDropdown label="Machine/Loom" options={machineOptions} selectedValues={selMachines} onChange={setSelMachines} />
          <MultiSelectDropdown label="WVOF Number" options={wvofOptions} selectedValues={selWvofs} onChange={setSelWvofs} />
          <MultiSelectDropdown label="Order Number" options={orderNoOptions} selectedValues={selOrderNos} onChange={setSelOrderNos} />
          <MultiSelectDropdown label="Design" options={designOptions} selectedValues={selDesigns} onChange={setSelDesigns} />
          <MultiSelectDropdown label="Weaver" options={weaverOptions} selectedValues={selWeavers} onChange={setSelWeavers} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={clearFilters} style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', color: '#64748b', background: 'none', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Logs Count
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {summary.totalLogs} Entries
          </span>
        </div>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Weaving Forms (WVOF)
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {summary.uniqueWvofs} Forms
          </span>
        </div>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Production Days
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {summary.uniqueDays} Days
          </span>
        </div>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Quantity
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {Number(summary.totalQty).toLocaleString()} m
          </span>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }} className="no-print">
          <Loader size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }}>
          No loom daily production records match your selection.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }} className="hide-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', minWidth: '950px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.015)', color: 'var(--text-muted-current)', fontWeight: '700' }}>
                <th style={{ padding: '0.75rem 0.5rem', width: '40px' }} />
                <th style={{ padding: '0.75rem 0.5rem' }}>Date & Time</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Loom Machine</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>WVOF Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Order Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Design (No / Name)</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Construction</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Weaver Name</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Qty Produced (m)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, idx) => {
                const isExpanded = expandedId === l.logId;
                const dateFmt = new Date(l.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                return (
                  <React.Fragment key={l.logId}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : l.logId)}
                      style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.01)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: '600' }}>{dateFmt}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>{l.time}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '700' }}>{l.machine}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '800', color: '#800000', fontFamily: 'monospace' }}>{l.wvof}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{l.order_number}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div>{l.design_no}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>{l.design_name}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600', color: 'var(--color-primary)' }}>{l.construction}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{l.weaver}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '800', color: 'var(--color-primary)' }}>{Number(l.qty).toLocaleString()}</td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.01)' }}>
                        <td colSpan={9} style={{ padding: '1rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)' }}>
                          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-current)' }}>
                            Weaving Order Form Reference Details
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '0.5rem' }}>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Target Weaving Quantity</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '700' }}>{Number(l.wvof_details.qty).toLocaleString()} Mtrs</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Scheduled Dates</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{l.wvof_details.start_date || '—'} to {l.wvof_details.end_date || '—'}</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Status</span>
                              <span style={{ display: 'inline-block', backgroundColor: l.wvof_details.status === 'completed' || l.wvof_details.status === 'late_complete' ? '#dcfce7' : '#dbeafe', color: l.wvof_details.status === 'completed' || l.wvof_details.status === 'late_complete' ? '#166534' : '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700', marginTop: '2px', textTransform: 'capitalize' }}>
                                {l.wvof_details.status ? l.wvof_details.status.replace('_', ' ') : '—'}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Beam Number</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '700', fontFamily: 'monospace' }}>{l.wvof_details.beam_number || '—'}</span>
                            </div>
                          </div>
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
    </div>
  );
}

// ────────────────────────────────────────────────────────
// INSPECTION TAB COMPONENT
// ────────────────────────────────────────────────────────
function InspectionOverseeTab() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Filters state
  const [selDates, setSelDates] = useState([]);
  const [selRollIds, setSelRollIds] = useState([]);
  const [selMachines, setSelMachines] = useState([]);
  const [selWvofs, setSelWvofs] = useState([]);
  const [selOrderNos, setSelOrderNos] = useState([]);
  const [selDesigns, setSelDesigns] = useState([]);
  const [selInspectors, setSelInspectors] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name),
          machine:master_machines(machine_name)
        `)
        .eq('weaving_type', 'in_house')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Flat map fabric rolls that are 4_point_inspected
      const rawInspections = [];
      data.forEach(wv => {
        const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
        rolls.forEach(r => {
          if (r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing') {
            const inspTime = r.inspected_at || r.received_at;
            rawInspections.push({
              rollId: r.id,
              inspected_at: inspTime,
              date: getLocalDateString(inspTime),
              time: inspTime ? new Date(inspTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
              machine: wv.machine_name || wv.machine?.machine_name || '—',
              wvof: wv.weaving_number,
              order_number: wv.order?.order_number || '—',
              design: `${wv.order?.design_no || '—'} / ${wv.order?.design_name || '—'}`,
              design_no: wv.order?.design_no || '—',
              design_name: wv.order?.design_name || '—',
              actual_qty: r.actual_qty || r.qty || 0,
              shortage: r.shortage || 0,
              mistake: r.mistake || 0,
              approved_qty: r.approved_qty || 0,
              inspector_1: r.inspector_1 || '—',
              inspector_2: r.inspector_2 || '—',
              roll_ok: r.roll_ok,
              warp_comments: r.warp_comments || [],
              weft_comments: r.weft_comments || [],
              attended_fitter: r.attended_fitter || '—',
              roll_details: r,
              wvof_details: wv
            });
          }
        });
      });

      // Sort by inspection date/time descending
      rawInspections.sort((a, b) => {
        const timeA = a.inspected_at || '';
        const timeB = b.inspected_at || '';
        return timeB.localeCompare(timeA);
      });
      setInspections(rawInspections);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter logic
  const filtered = useMemo(() => {
    return inspections.filter(i => {
      if (selDates.length > 0 && !selDates.includes(i.date)) return false;
      if (selRollIds.length > 0 && !selRollIds.includes(i.rollId)) return false;
      if (selMachines.length > 0 && !selMachines.includes(i.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(i.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(i.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(i.design)) return false;
      if (selInspectors.length > 0 && !selInspectors.includes(i.inspector_1) && !selInspectors.includes(i.inspector_2)) return false;
      return true;
    });
  }, [inspections, selDates, selRollIds, selMachines, selWvofs, selOrderNos, selDesigns, selInspectors]);

  // Dependable Options
  const dateOptions = useMemo(() => {
    const matched = inspections.filter(i => {
      if (selRollIds.length > 0 && !selRollIds.includes(i.rollId)) return false;
      if (selMachines.length > 0 && !selMachines.includes(i.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(i.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(i.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(i.design)) return false;
      if (selInspectors.length > 0 && !selInspectors.includes(i.inspector_1) && !selInspectors.includes(i.inspector_2)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(i => i.date).filter(Boolean))).sort();
  }, [inspections, selRollIds, selMachines, selWvofs, selOrderNos, selDesigns, selInspectors]);

  const rollIdOptions = useMemo(() => {
    const matched = inspections.filter(i => {
      if (selDates.length > 0 && !selDates.includes(i.date)) return false;
      if (selMachines.length > 0 && !selMachines.includes(i.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(i.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(i.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(i.design)) return false;
      if (selInspectors.length > 0 && !selInspectors.includes(i.inspector_1) && !selInspectors.includes(i.inspector_2)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(i => i.rollId).filter(Boolean))).sort();
  }, [inspections, selDates, selMachines, selWvofs, selOrderNos, selDesigns, selInspectors]);

  const machineOptions = useMemo(() => {
    const matched = inspections.filter(i => {
      if (selDates.length > 0 && !selDates.includes(i.date)) return false;
      if (selRollIds.length > 0 && !selRollIds.includes(i.rollId)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(i.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(i.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(i.design)) return false;
      if (selInspectors.length > 0 && !selInspectors.includes(i.inspector_1) && !selInspectors.includes(i.inspector_2)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(i => i.machine).filter(Boolean))).sort();
  }, [inspections, selDates, selRollIds, selWvofs, selOrderNos, selDesigns, selInspectors]);

  const wvofOptions = useMemo(() => {
    const matched = inspections.filter(i => {
      if (selDates.length > 0 && !selDates.includes(i.date)) return false;
      if (selRollIds.length > 0 && !selRollIds.includes(i.rollId)) return false;
      if (selMachines.length > 0 && !selMachines.includes(i.machine)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(i.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(i.design)) return false;
      if (selInspectors.length > 0 && !selInspectors.includes(i.inspector_1) && !selInspectors.includes(i.inspector_2)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(i => i.wvof).filter(Boolean))).sort();
  }, [inspections, selDates, selRollIds, selMachines, selOrderNos, selDesigns, selInspectors]);

  const orderNoOptions = useMemo(() => {
    const matched = inspections.filter(i => {
      if (selDates.length > 0 && !selDates.includes(i.date)) return false;
      if (selRollIds.length > 0 && !selRollIds.includes(i.rollId)) return false;
      if (selMachines.length > 0 && !selMachines.includes(i.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(i.wvof)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(i.design)) return false;
      if (selInspectors.length > 0 && !selInspectors.includes(i.inspector_1) && !selInspectors.includes(i.inspector_2)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(i => i.order_number).filter(Boolean))).sort();
  }, [inspections, selDates, selRollIds, selMachines, selWvofs, selDesigns, selInspectors]);

  const designOptions = useMemo(() => {
    const matched = inspections.filter(i => {
      if (selDates.length > 0 && !selDates.includes(i.date)) return false;
      if (selRollIds.length > 0 && !selRollIds.includes(i.rollId)) return false;
      if (selMachines.length > 0 && !selMachines.includes(i.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(i.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(i.order_number)) return false;
      if (selInspectors.length > 0 && !selInspectors.includes(i.inspector_1) && !selInspectors.includes(i.inspector_2)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(i => i.design).filter(Boolean))).sort();
  }, [inspections, selDates, selRollIds, selMachines, selWvofs, selOrderNos, selInspectors]);

  const inspectorOptions = useMemo(() => {
    const matched = inspections.filter(i => {
      if (selDates.length > 0 && !selDates.includes(i.date)) return false;
      if (selRollIds.length > 0 && !selRollIds.includes(i.rollId)) return false;
      if (selMachines.length > 0 && !selMachines.includes(i.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(i.wvof)) return false;
      if (selOrderNos.length > 0 && !selOrderNos.includes(i.order_number)) return false;
      if (selDesigns.length > 0 && !selDesigns.includes(i.design)) return false;
      return true;
    });
    const list = new Set();
    matched.forEach(i => {
      if (i.inspector_1 && i.inspector_1 !== '—') list.add(i.inspector_1);
      if (i.inspector_2 && i.inspector_2 !== '—') list.add(i.inspector_2);
    });
    return Array.from(list).sort();
  }, [inspections, selDates, selRollIds, selMachines, selWvofs, selOrderNos, selDesigns]);

  const clearFilters = () => {
    setSelDates([]);
    setSelRollIds([]);
    setSelMachines([]);
    setSelWvofs([]);
    setSelOrderNos([]);
    setSelDesigns([]);
    setSelInspectors([]);
  };

  const summary = useMemo(() => {
    const uniqueWvofs = new Set(filtered.map(i => i.wvof).filter(Boolean)).size;
    const uniqueRolls = new Set(filtered.map(i => i.rollId).filter(Boolean)).size;
    const uniqueDays = new Set(filtered.map(i => i.date).filter(Boolean)).size;
    const totalActualQty = filtered.reduce((acc, i) => acc + Number(i.actual_qty || 0), 0);
    const totalApprovedQty = filtered.reduce((acc, i) => acc + Number(i.approved_qty || 0), 0);
    const passCount = filtered.filter(i => i.roll_ok).length;
    const failCount = filtered.length - passCount;
    return { uniqueWvofs, uniqueRolls, uniqueDays, totalActualQty, totalApprovedQty, passCount, failCount };
  }, [filtered]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="fade-in print-report-container">
      {/* Print-only Header */}
      <div className="print-only" style={{ display: 'none', marginBottom: '1.5rem', borderBottom: '2px solid #800000', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#800000', fontSize: '1.4rem', fontWeight: '800' }}>ASHOK TEXTILES</h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#555' }}>Fabric Manufacturing ERP</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#800000' }}>LOOM INSPECTION QC REPORT</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#666' }}>Printed on: {new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }} className="no-print">
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-current)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          Loom Inspections QC ({filtered.length})
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: 'var(--surface-current)',
              color: '#800000', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            🖨 Print Report
          </button>
          <button
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: isFilterExpanded ? 'rgba(128,0,0,0.08)' : 'var(--surface-current)',
              color: '#800000', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
            }}
          >
            <SlidersHorizontal size={14} /> Filters
            {isFilterExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={fetchData}
            style={{
              padding: '0.45rem 0.75rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', background: 'var(--surface-current)',
              color: 'var(--text-muted-current)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3'
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {isFilterExpanded && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem', padding: '1rem', backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }} className="no-print">
          <MultiSelectDropdown label="Date" options={dateOptions} selectedValues={selDates} onChange={setSelDates} />
          <MultiSelectDropdown label="Roll ID" options={rollIdOptions} selectedValues={selRollIds} onChange={setSelRollIds} />
          <MultiSelectDropdown label="Loom Machine" options={machineOptions} selectedValues={selMachines} onChange={setSelMachines} />
          <MultiSelectDropdown label="WVOF Number" options={wvofOptions} selectedValues={selWvofs} onChange={setSelWvofs} />
          <MultiSelectDropdown label="Order Number" options={orderNoOptions} selectedValues={selOrderNos} onChange={setSelOrderNos} />
          <MultiSelectDropdown label="Design" options={designOptions} selectedValues={selDesigns} onChange={setSelDesigns} />
          <MultiSelectDropdown label="Inspector" options={inspectorOptions} selectedValues={selInspectors} onChange={setSelInspectors} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={clearFilters} style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', color: '#64748b', background: 'none', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Inspected Rolls
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {summary.uniqueRolls} Rolls
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>
            Pass: {summary.passCount} | Fail: {summary.failCount}
          </span>
        </div>

        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Inspection Days
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {summary.uniqueDays} Days
          </span>
        </div>
        <div className="summary-card" style={{
          background: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Approved Quantity
          </span>
          <span style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-current)' }}>
            {Number(summary.totalApprovedQty).toLocaleString()} m
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>
            Measured: {Number(summary.totalActualQty).toLocaleString()} m
          </span>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }} className="no-print">
          <Loader size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }}>
          No inspected fabric rolls match your selection.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }} className="hide-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', minWidth: '950px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.015)', color: 'var(--text-muted-current)', fontWeight: '700' }}>
                <th style={{ padding: '0.75rem 0.5rem', width: '40px' }} />
                <th style={{ padding: '0.75rem 0.5rem' }}>Inspected Date</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Roll ID</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Loom</th>
                <th style={{ padding: '0.75rem 0.5rem' }} className="no-print">Weaving Form (WVOF)</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Order Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Design Name/No</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Inspector</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>QC Status</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Approved Qty (m)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => {
                const isExpanded = expandedId === i.rollId;
                const dateFmt = i.inspected_at ? new Date(i.inspected_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                const inspectorsText = [i.inspector_1, i.inspector_2].filter(x => x && x !== '—').join(' & ') || '—';
                return (
                  <React.Fragment key={i.rollId}>
                    <tr
                      onClick={() => setExpandedId(isExpanded ? null : i.rollId)}
                      style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.01)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: '600' }}>{dateFmt}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>{i.time}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '800', fontFamily: 'monospace' }}>{i.rollId}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{i.machine}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '800', color: '#800000', fontFamily: 'monospace' }} className="no-print">{i.wvof}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{i.order_number}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div>{i.design_no}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>{i.design_name}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{inspectorsText}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        <span style={{
                          backgroundColor: i.roll_ok ? '#dcfce7' : '#fee2e2',
                          color: i.roll_ok ? '#166534' : '#b91c1c',
                          padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700'
                        }}>
                          {i.roll_ok ? 'PASS (OK)' : 'FAIL (Defect)'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(i.approved_qty).toLocaleString()}</td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.01)' }}>
                        <td colSpan={10} style={{ padding: '1rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Greige Qty Issued</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{Number(i.roll_details.qty || 0).toLocaleString()} m</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Actual Qty Measured</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{Number(i.actual_qty).toLocaleString()} m</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Shortage</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: i.shortage > 0 ? '#b91c1c' : '#166534' }}>{i.shortage} m</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Defects/Mistakes Deduction</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#b91c1c' }}>{i.mistake} m</span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Attended Fitter</span>
                              <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{i.attended_fitter || '—'}</span>
                            </div>
                          </div>

                          {/* Defects comments list */}
                          {!i.roll_ok && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px dashed var(--border-current)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                              <h5 style={{ margin: 0, fontSize: '0.78rem', fontWeight: '800', color: '#be123c', textTransform: 'uppercase' }}>
                                Observed Defect Details
                              </h5>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                                {i.warp_comments.map(c => (
                                  <span key={c} style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '700' }}>
                                    Warp: {c}
                                  </span>
                                ))}
                                {i.weft_comments.map(c => (
                                  <span key={c} style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '700' }}>
                                    Weft: {c}
                                  </span>
                                ))}
                              </div>
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
    </div>
  );
}

// ────────────────────────────────────────────────────────
// MULTI-SELECT DROPDOWN FILTER REUSABLE COMPONENT
// ────────────────────────────────────────────────────────
function MultiSelectDropdown({ label, options, selectedValues, onChange, placeholder = "All Options" }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', position: 'relative' }}>
      <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
        {label}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: '38px',
          padding: '0.4rem 2rem 0.4rem 0.75rem',
          border: '1px solid var(--border-current)',
          borderRadius: '8px',
          fontSize: '0.825rem',
          background: 'var(--surface-current)',
          color: selectedValues.length === 0 ? 'var(--text-muted-current)' : 'var(--text-current)',
          cursor: 'pointer',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        {selectedValues.length === 0 ? placeholder : (
          selectedValues.map(val => (
            <span key={val} style={{
              backgroundColor: 'rgba(128,0,0,0.08)',
              color: '#800000',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.7rem',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}>
              {val}
              <span onClick={(e) => { e.stopPropagation(); onChange(selectedValues.filter(v => v !== val)); }} style={{ cursor: 'pointer', fontWeight: '900' }}>&times;</span>
            </span>
          ))
        )}
        <ChevronDown size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)', pointerEvents: 'none' }} />
      </div>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setIsOpen(false)} />
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 999,
            marginTop: '4px'
          }}>
            {options.map(opt => {
              const isChecked = selectedValues.includes(opt);
              return (
                <div
                  key={opt}
                  onClick={() => {
                    if (isChecked) {
                      onChange(selectedValues.filter(v => v !== opt));
                    } else {
                      onChange([...selectedValues, opt]);
                    }
                  }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    backgroundColor: isChecked ? 'rgba(128,0,0,0.04)' : '#fff',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(128,0,0,0.04)' : '#fff'}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    style={{ accentColor: '#800000', cursor: 'pointer' }}
                  />
                  <span style={{ color: '#000' }}>{opt}</span>
                </div>
              );
            })}
            {options.length === 0 && (
              <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                No options available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// WARPING FINANCES TAB COMPONENT
// ────────────────────────────────────────────────────────
function WarpingFinancesTab() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedBillId, setExpandedBillId] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);

  // Modal Data Options
  const [availableWofs, setAvailableWofs] = useState([]);
  const [availablePartners, setAvailablePartners] = useState([]);

  // Modal Form Inputs
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedWofIds, setSelectedWofIds] = useState([]);
  const [wofRates, setWofRates] = useState({});
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceSubtotal, setInvoiceSubtotal] = useState('');
  const [taxAmount, setTaxAmount] = useState('');

  const [validationError, setValidationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isWofDropdownOpen, setIsWofDropdownOpen] = useState(false);

  // Fetch Bills List
  const fetchBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_finance_bills')
        .select('*')
        .eq('form_type', 'warping')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error('Error fetching bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  // Fetch Available Completed Job-Work WOFs that are not in a pending/approved bill
  const loadModalData = async () => {
    try {
      // 1. Fetch completed job-work warping order forms
      const { data: completedWofs, error: wofErr } = await supabase
        .from('warping_order_forms')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name)
        `)
        .eq('wof_type', 'job_work')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (wofErr) throw wofErr;

      // 2. Fetch all bills of type warping with status !== 'rejected' to exclude already billed forms
      const { data: billsData, error: billsErr } = await supabase
        .from('production_finance_bills')
        .select('selected_form_ids')
        .eq('form_type', 'warping')
        .neq('status', 'rejected');

      if (billsErr) throw billsErr;

      const billedWofIds = new Set();
      billsData?.forEach(b => {
        b.selected_form_ids?.forEach(id => billedWofIds.add(id));
      });

      const unbilledWofs = completedWofs?.filter(w => !billedWofIds.has(w.id)) || [];
      setAvailableWofs(unbilledWofs);

      // Extract unique partners
      const partnersMap = {};
      unbilledWofs.forEach(w => {
        if (w.partner_id) {
          partnersMap[w.partner_id] = w.partner_name || 'Unnamed Partner';
        }
      });
      const partnersList = Object.entries(partnersMap).map(([id, name]) => ({ id, name }));
      setAvailablePartners(partnersList);

      // Reset form variables
      setSelectedPartnerId('');
      setSelectedWofIds([]);
      setWofRates({});
      setInvoiceNumber('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setInvoiceSubtotal('');
      setTaxAmount('');
      setValidationError('');
      setModalStep(1);
      setIsWofDropdownOpen(false);
    } catch (err) {
      console.error('Error loading modal data:', err);
      alert('Failed to load completed warping order forms.');
    }
  };

  const openCreateModal = () => {
    loadModalData();
    setIsModalOpen(true);
  };

  // Filtered available WOFs based on selected partner
  const filteredWofs = availableWofs.filter(w => w.partner_id === selectedPartnerId);

  // Selected WOFs objects
  const selectedWofsObjects = filteredWofs.filter(w => selectedWofIds.includes(w.id));

  // Calculated totals live
  const calculatedTotal = selectedWofsObjects.reduce((sum, wof) => {
    const qty = parseFloat(wof.qty) || 0;
    const rate = parseFloat(wofRates[wof.id]) || 0;
    return sum + (qty * rate);
  }, 0);

  const parsedSubtotal = parseFloat(invoiceSubtotal) || 0;
  const parsedTax = parseFloat(taxAmount) || 0;
  const invoiceTotal = parsedSubtotal + parsedTax;

  const handlePartnerChange = (e) => {
    setSelectedPartnerId(e.target.value);
    setSelectedWofIds([]);
    setWofRates({});
    setIsWofDropdownOpen(false);
  };

  const toggleWofSelection = (wofId) => {
    setSelectedWofIds(prev => {
      if (prev.includes(wofId)) {
        return prev.filter(id => id !== wofId);
      } else {
        return [...prev, wofId];
      }
    });
  };

  const handleRateChange = (wofId, rateVal) => {
    setWofRates(prev => ({
      ...prev,
      [wofId]: rateVal
    }));
  };

  const handleProceedToStep2 = () => {
    if (selectedWofIds.length === 0) {
      alert('Please select at least one Warping Order Form.');
      return;
    }
    setModalStep(2);
  };

  const handleSubmitBill = async () => {
    setValidationError('');

    // Field checks
    if (!invoiceNumber.trim()) {
      setValidationError('Invoice number is required.');
      return;
    }
    if (!invoiceDate) {
      setValidationError('Invoice date is required.');
      return;
    }
    if (!invoiceSubtotal || parsedSubtotal <= 0) {
      setValidationError('Invoice subtotal must be greater than zero.');
      return;
    }

    // Rate validation for each WOF
    for (const wofId of selectedWofIds) {
      const rate = parseFloat(wofRates[wofId]);
      if (isNaN(rate) || rate <= 0) {
        setValidationError('Please enter a valid rate greater than zero for all selected order forms.');
        return;
      }
    }

    // Crucial business validation: Invoice Subtotal <= Calculated Total
    if (parsedSubtotal > calculatedTotal) {
      setValidationError(`The invoice subtotal (₹${parsedSubtotal.toFixed(2)}) cannot be greater than our calculated total (₹${calculatedTotal.toFixed(2)}).`);
      return;
    }

    setSubmitting(true);
    try {
      const selectedPartner = availablePartners.find(p => p.id === selectedPartnerId);
      const partnerName = selectedPartner ? selectedPartner.name : 'Unknown Partner';
      const billNumber = `${partnerName}/${invoiceNumber.trim()}`;

      // Build JSONB items
      const billItems = selectedWofsObjects.map(wof => {
        const qty = parseFloat(wof.qty) || 0;
        const rate = parseFloat(wofRates[wof.id]) || 0;

        // Determine timeliness (on time vs late)
        let timeliness = 'on_time';
        if (wof.end_date && wof.process_completed_at) {
          const plannedEnd = new Date(wof.end_date);
          const actualEnd = new Date(wof.process_completed_at);
          if (actualEnd > plannedEnd) {
            timeliness = 'late';
          }
        }

        return {
          form_id: wof.id,
          form_number: wof.wof_number,
          order_number: wof.order?.order_number || '—',
          design_name: wof.order?.design_name || '—',
          design_no: wof.order?.design_no || '—',
          planned_qty: qty,
          actual_qty: qty,
          start_date: wof.start_date,
          end_date: wof.end_date,
          actual_start_date: wof.process_started_at,
          actual_end_date: wof.process_completed_at,
          timeliness_status: timeliness,
          status: wof.status,
          rate_per_meter: rate,
          calculated_total: qty * rate
        };
      });

      const insertData = {
        bill_number: billNumber,
        form_type: 'warping',
        partner_id: selectedPartnerId,
        partner_name: partnerName,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        selected_form_ids: selectedWofIds,
        bill_items: billItems,
        calculated_total: calculatedTotal,
        invoice_subtotal: parsedSubtotal,
        tax_amount: parsedTax,
        invoice_total: invoiceTotal,
        status: 'awaiting_approval',
        submitted_by: profile?.id,
        submitted_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('production_finance_bills')
        .insert([insertData]);

      if (error) {
        if (error.code === '23505') {
          throw new Error(`A bill with invoice number "${invoiceNumber}" already exists for this partner.`);
        }
        throw error;
      }

      alert('Bill submitted for Admin approval successfully!');
      setIsModalOpen(false);
      fetchBills();
    } catch (err) {
      console.error('Error submitting bill:', err);
      setValidationError(err.message || 'An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'awaiting_approval':
        return { bg: '#fef3c7', text: '#92400e', label: 'Awaiting Approval' };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', label: 'Approved' };
      case 'settled':
        return { bg: '#dbeafe', text: '#1e40af', label: 'Settled' };
      case 'rejected':
        return { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: status };
    }
  };

  const filteredBills = bills.filter(b => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { key: 'all', label: 'All Bills' },
            { key: 'awaiting_approval', label: 'Awaiting Approval' },
            { key: 'approved', label: 'Approved' },
            { key: 'settled', label: 'Settled' }
          ].map(pill => (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(pill.key)}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '20px',
                border: '1px solid ' + (statusFilter === pill.key ? '#800000' : 'var(--border-current)'),
                backgroundColor: statusFilter === pill.key ? '#800000' : 'var(--surface-current)',
                color: statusFilter === pill.key ? 'white' : 'var(--text-main-current)',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <button
          onClick={openCreateModal}
          style={{
            backgroundColor: '#800000',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#600000'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#800000'}
        >
          <Plus size={16} /> Create New Bill
        </button>
      </div>

      {/* Bills Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={24} className="spin" style={{ color: '#800000' }} />
        </div>
      ) : filteredBills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '1px solid var(--border-current)', borderRadius: '12px', background: 'var(--surface-current)' }}>
          No warping bills found for the selected filter.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-current)', borderRadius: '12px', background: 'var(--surface-current)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.015)', color: 'var(--text-muted-current)', fontWeight: '700' }}>
                <th style={{ padding: '0.75rem 0.5rem', width: '40px' }} />
                <th style={{ padding: '0.75rem 0.5rem' }}>Date</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Bill Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Partner</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>WOF Numbers</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Order Numbers</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Designs</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Calculated Subtotal</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Invoice Subtotal</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Tax Amount</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Invoice Total</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(bill => {
                const isExpanded = expandedBillId === bill.id;
                const statusStyle = getStatusBadgeStyle(bill.status);
                const wofNumbers = (bill.bill_items || []).map(item => item.form_number || item.wof_number).filter(Boolean).join(', ');
                const orderNumbers = Array.from(new Set((bill.bill_items || []).map(item => item.order_number).filter(Boolean))).join(', ');
                const designs = Array.from(new Set((bill.bill_items || []).map(item => `${item.design_no || ''} ${item.design_name || ''}`.trim()).filter(Boolean))).join(', ');
                return (
                  <React.Fragment key={bill.id}>
                    <tr
                      onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                      style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.01)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>{bill.invoice_date || new Date(bill.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '800', color: '#800000', fontFamily: 'monospace' }}>{bill.bill_number}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{bill.partner_name}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.72rem' }}>{wofNumbers || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.72rem' }}>{orderNumbers || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.72rem' }}>{designs || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '500' }}>₹{Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--text-muted-current)' }}>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '800', color: '#800000' }}>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        <span style={{
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          display: 'inline-block'
                        }}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => printFinanceBill(bill)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            border: '1px solid var(--border-current)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            color: '#475569'
                          }}
                        >
                          <Printer size={12} /> Print
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.005)' }}>
                        <td colSpan={13} style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontWeight: '800', fontSize: '0.85rem' }}>Billed Warping Order Forms</h4>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: '1rem', border: '1px solid var(--border-current)' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700' }}>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>WOF Number</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Order Number</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Design (No / Name)</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>WOF Status</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Actual Dates</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Timeliness</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Qty (m)</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Rate / Meter</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Total Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(bill.bill_items || []).map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                  <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace' }}>{item.form_number}</td>
                                  <td style={{ padding: '0.5rem' }}>{item.order_number}</td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <div>{item.design_no}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>{item.design_name}</div>
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    <span style={{
                                      backgroundColor: '#dcfce7',
                                      color: '#166534',
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      fontSize: '0.65rem',
                                      fontWeight: '700',
                                      textTransform: 'uppercase'
                                    }}>
                                      {item.status || 'completed'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem', fontSize: '0.7rem' }}>
                                    {item.actual_start_date ? new Date(item.actual_start_date).toLocaleDateString('en-GB') : '—'} to {item.actual_end_date ? new Date(item.actual_end_date).toLocaleDateString('en-GB') : '—'}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    <span style={{
                                      backgroundColor: item.timeliness_status === 'late' ? '#fee2e2' : '#dcfce7',
                                      color: item.timeliness_status === 'late' ? '#991b1b' : '#166534',
                                      padding: '1px 6px',
                                      borderRadius: '10px',
                                      fontSize: '0.65rem',
                                      fontWeight: '700'
                                    }}>
                                      {item.timeliness_status === 'late' ? 'LATE' : 'ON TIME'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500' }}>{Number(item.actual_qty).toLocaleString()}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{Number(item.rate_per_meter).toFixed(2)}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{Number(item.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {bill.admin_notes && (
                            <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid #64748b', fontSize: '0.75rem', color: 'var(--text-main-current)' }}>
                              <strong>Admin Remarks:</strong> {bill.admin_notes}
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

      {/* Create Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: '16px',
            width: '100%', maxWidth: '800px',
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)' }}>Create Warping Finance Bill</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted-current)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Step Indicators */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.01)' }}>
              <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.78rem', color: modalStep === 1 ? '#800000' : 'var(--text-muted-current)', borderBottom: modalStep === 1 ? '2px solid #800000' : 'none' }}>
                Step 1: Partner & Order Forms
              </div>
              <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.78rem', color: modalStep === 2 ? '#800000' : 'var(--text-muted-current)', borderBottom: modalStep === 2 ? '2px solid #800000' : 'none' }}>
                Step 2: Rates & Invoicing
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
              {modalStep === 1 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Select Partner */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Select Warping Partner</label>
                    <select
                      value={selectedPartnerId}
                      onChange={handlePartnerChange}
                      style={{
                        padding: '0.6rem 0.75rem',
                        border: '1px solid var(--border-current)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        backgroundColor: 'var(--surface-current)',
                        color: 'var(--text-current)',
                        width: '100%',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- Choose Partner --</option>
                      {availablePartners.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select WOFs via Dropdown */}
                  {selectedPartnerId && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', position: 'relative' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>
                        Select Order Forms to include ({selectedWofIds.length} selected)
                      </label>
                      <div
                        onClick={() => setIsWofDropdownOpen(!isWofDropdownOpen)}
                        style={{
                          minHeight: '38px',
                          padding: '0.4rem 2.25rem 0.4rem 0.75rem',
                          border: '1px solid var(--border-current)',
                          borderRadius: '8px',
                          fontSize: '0.825rem',
                          background: 'var(--surface-current)',
                          color: selectedWofIds.length === 0 ? 'var(--text-muted-current)' : 'var(--text-current)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.25rem',
                          alignItems: 'center',
                          position: 'relative'
                        }}
                      >
                        {selectedWofIds.length === 0 ? 'Choose Warping Order Forms...' : (
                          selectedWofsObjects.map(wof => (
                            <span key={wof.id} style={{
                              backgroundColor: 'rgba(128,0,0,0.08)',
                              color: '#800000',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              {wof.wof_number}
                              <span onClick={(e) => { e.stopPropagation(); toggleWofSelection(wof.id); }} style={{ cursor: 'pointer', fontWeight: '900' }}>&times;</span>
                            </span>
                          ))
                        )}
                        {isWofDropdownOpen ? (
                          <ChevronUp size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)', pointerEvents: 'none' }} />
                        ) : (
                          <ChevronDown size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)', pointerEvents: 'none' }} />
                        )}
                      </div>

                      {isWofDropdownOpen && (
                        <div style={{
                          backgroundColor: 'var(--surface-current)',
                          border: '1px solid var(--border-current)',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                          maxHeight: '250px',
                          overflowY: 'auto',
                          marginTop: '8px',
                          width: '100%'
                        }}>
                          {filteredWofs.length === 0 ? (
                            <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted-current)', fontStyle: 'italic', textAlign: 'center' }}>
                              No completed unbilled warping order forms for this partner.
                            </div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ backgroundColor: 'rgba(0,0,0,0.015)', borderBottom: '1px solid var(--border-current)', fontWeight: '700', position: 'sticky', top: 0, backgroundColor: 'var(--surface-current)', zIndex: 1 }}>
                                  <th style={{ padding: '0.5rem', width: '40px', textAlign: 'center' }}>Select</th>
                                  <th style={{ padding: '0.5rem' }}>WOF Number</th>
                                  <th style={{ padding: '0.5rem' }}>Order Number</th>
                                  <th style={{ padding: '0.5rem' }}>Design Name</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Qty (m)</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredWofs.map(wof => {
                                  const isChecked = selectedWofIds.includes(wof.id);
                                  return (
                                    <tr
                                      key={wof.id}
                                      onClick={() => toggleWofSelection(wof.id)}
                                      style={{
                                        borderBottom: '1px solid var(--border-current)',
                                        cursor: 'pointer',
                                        backgroundColor: isChecked ? 'rgba(128,0,0,0.02)' : 'transparent',
                                        transition: 'background-color 0.15s ease'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(128,0,0,0.04)' : 'rgba(0,0,0,0.015)'}
                                      onMouseLeave={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(128,0,0,0.02)' : 'transparent'}
                                    >
                                      <td style={{ padding: '0.5rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleWofSelection(wof.id)}
                                          style={{ accentColor: '#800000', cursor: 'pointer' }}
                                        />
                                      </td>
                                      <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace' }}>{wof.wof_number}</td>
                                      <td style={{ padding: '0.5rem' }}>{wof.order?.order_number || '—'}</td>
                                      <td style={{ padding: '0.5rem' }}>{wof.order?.design_name || '—'}</td>
                                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(wof.qty).toLocaleString()}</td>
                                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                        <span style={{
                                          backgroundColor: '#dcfce7',
                                          color: '#166534',
                                          padding: '2px 6px',
                                          borderRadius: '10px',
                                          fontSize: '0.65rem',
                                          fontWeight: '700',
                                          textTransform: 'uppercase'
                                        }}>
                                          {wof.status}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Invoice Styled Sheet */}
                  <div style={{
                    backgroundColor: 'var(--surface-current)',
                    border: '1px solid var(--border-current)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem'
                  }}>
                    {/* Invoice Sheet Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-current)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Billed To (Partner)</h4>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)', marginTop: '0.25rem' }}>
                          🤝 {availablePartners.find(p => p.id === selectedPartnerId)?.name || 'Select Partner'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                          Bill No: {availablePartners.find(p => p.id === selectedPartnerId)?.name || 'Partner'}/{invoiceNumber || 'INV'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '150px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grand Total</h4>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#800000', marginTop: '0.25rem' }}>
                          ₹{invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Invoice Metadata Fields Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Invoice Number</label>
                        <input
                          type="text"
                          placeholder="e.g. INV-1029"
                          value={invoiceNumber}
                          onChange={e => setInvoiceNumber(e.target.value)}
                          style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Invoice Date</label>
                        <input
                          type="date"
                          value={invoiceDate}
                          onChange={e => setInvoiceDate(e.target.value)}
                          style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                        />
                      </div>
                    </div>

                    {/* Invoice Items Table */}
                    <div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'rgba(0,0,0,0.015)', borderBottom: '2px solid var(--border-current)', fontWeight: '700' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Description & Form Details</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', width: '100px' }}>Status</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', width: '100px' }}>Qty (m)</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', width: '130px' }}>Rate / Meter (₹)</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', width: '120px' }}>Total Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedWofsObjects.map(wof => {
                            const qty = parseFloat(wof.qty) || 0;
                            const rate = wofRates[wof.id] || '';
                            const rowTotal = qty * (parseFloat(rate) || 0);
                            return (
                              <tr key={wof.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                  <div style={{ fontWeight: '700', fontFamily: 'monospace', color: '#800000', fontSize: '0.825rem' }}>{wof.wof_number}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                    Order: <strong>{wof.order?.order_number || '—'}</strong> | Design: <strong>{wof.order?.design_no || '—'}</strong> / {wof.order?.design_name || '—'}
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                  <span style={{
                                    backgroundColor: '#dcfce7',
                                    color: '#166534',
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    fontSize: '0.625rem',
                                    fontWeight: '700',
                                    textTransform: 'uppercase'
                                  }}>
                                    {wof.status}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '600' }}>{Number(qty).toLocaleString()}</td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={rate}
                                    onChange={e => handleRateChange(wof.id, e.target.value)}
                                    style={{
                                      width: '90%',
                                      padding: '0.35rem 0.5rem',
                                      border: '1px solid var(--border-current)',
                                      borderRadius: '6px',
                                      fontSize: '0.8rem',
                                      textAlign: 'center',
                                      backgroundColor: 'var(--surface-current)',
                                      color: 'var(--text-current)',
                                      fontWeight: '600'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Invoice Calculations Summary Footer */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid var(--border-current)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', maxWidth: '380px', fontSize: '0.8rem' }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Calculated WOFs Subtotal:</span>
                          <span style={{ fontWeight: '700', color: 'var(--text-current)' }}>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Invoice Subtotal (from Bill):</span>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', width: '160px' }}>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={`Max ₹${calculatedTotal.toFixed(2)}`}
                              value={invoiceSubtotal}
                              onChange={e => setInvoiceSubtotal(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.35rem 0.5rem',
                                border: '1px solid ' + (parsedSubtotal > calculatedTotal ? '#ef4444' : 'var(--border-current)'),
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                textAlign: 'right',
                                backgroundColor: 'var(--surface-current)',
                                color: parsedSubtotal > calculatedTotal ? '#ef4444' : 'var(--text-current)',
                                fontWeight: '700'
                              }}
                            />
                            {parsedSubtotal > calculatedTotal && (
                              <span style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: '600' }}>Exceeds calculated limit</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Tax Amount (CGST/SGST/IGST):</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 0.00"
                            value={taxAmount}
                            onChange={e => setTaxAmount(e.target.value)}
                            style={{
                              width: '160px',
                              padding: '0.35rem 0.5rem',
                              border: '1px solid var(--border-current)',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              textAlign: 'right',
                              backgroundColor: 'var(--surface-current)',
                              color: 'var(--text-current)',
                              fontWeight: '600'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-current)', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                          <span style={{ color: 'var(--text-current)', fontWeight: '800', fontSize: '0.85rem' }}>Grand Total (Invoice Total):</span>
                          <span style={{ fontWeight: '800', fontSize: '1.1rem', color: '#800000' }}>₹{invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>

                      </div>
                    </div>

                  </div>

                  {validationError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', color: '#991b1b', fontSize: '0.75rem', fontWeight: '600' }}>
                      <AlertCircle size={16} /> {validationError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.01)' }}>
              <div>
                {modalStep === 2 && (
                  <button
                    onClick={() => setModalStep(1)}
                    disabled={submitting}
                    style={{
                      border: '1px solid var(--border-current)',
                      backgroundColor: 'var(--surface-current)',
                      color: 'var(--text-main-current)',
                      borderRadius: '8px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  style={{
                    border: '1px solid var(--border-current)',
                    backgroundColor: 'var(--surface-current)',
                    color: 'var(--text-muted-current)',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                {modalStep === 1 ? (
                  <button
                    onClick={handleProceedToStep2}
                    style={{
                      border: 'none',
                      backgroundColor: '#800000',
                      color: 'white',
                      borderRadius: '8px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Next &rarr;
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitBill}
                    disabled={submitting || parsedSubtotal > calculatedTotal}
                    style={{
                      border: 'none',
                      backgroundColor: submitting || parsedSubtotal > calculatedTotal ? '#cbd5e1' : '#800000',
                      color: 'white',
                      borderRadius: '8px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      cursor: submitting || parsedSubtotal > calculatedTotal ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {submitting ? 'Submitting...' : '✓ Submit Bill'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────
// SIZING FINANCES TAB COMPONENT
// ────────────────────────────────────────────────────────
function SizingFinancesTab() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedBillId, setExpandedBillId] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);

  // Modal Data Options
  const [availableSofs, setAvailableSofs] = useState([]);
  const [availablePartners, setAvailablePartners] = useState([]);

  // Modal Form Inputs
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedSofIds, setSelectedSofIds] = useState([]);
  const [sofRates, setSofRates] = useState({});
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceSubtotal, setInvoiceSubtotal] = useState('');
  const [taxAmount, setTaxAmount] = useState('');

  const [validationError, setValidationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSofDropdownOpen, setIsSofDropdownOpen] = useState(false);

  // Fetch Bills List
  const fetchBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_finance_bills')
        .select('*')
        .eq('form_type', 'sizing')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error('Error fetching bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  // Fetch Available Completed Job-Work SOFs that are not in a pending/approved bill
  const loadModalData = async () => {
    try {
      // 1. Fetch completed job-work sizing order forms
      const { data: completedSofs, error: sofErr } = await supabase
        .from('sizing_order_forms')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name)
        `)
        .eq('sizing_type', 'job_work')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (sofErr) throw sofErr;

      // 2. Fetch all bills of type sizing with status !== 'rejected' to exclude already billed forms
      const { data: billsData, error: billsErr } = await supabase
        .from('production_finance_bills')
        .select('selected_form_ids')
        .eq('form_type', 'sizing')
        .neq('status', 'rejected');

      if (billsErr) throw billsErr;

      const billedSofIds = new Set();
      billsData?.forEach(b => {
        b.selected_form_ids?.forEach(id => billedSofIds.add(id));
      });

      const unbilledSofs = completedSofs?.filter(s => !billedSofIds.has(s.id)) || [];
      setAvailableSofs(unbilledSofs);

      // Extract unique partners
      const partnersMap = {};
      unbilledSofs.forEach(s => {
        if (s.partner_id) {
          partnersMap[s.partner_id] = s.partner_name || 'Unnamed Partner';
        }
      });
      const partnersList = Object.entries(partnersMap).map(([id, name]) => ({ id, name }));
      setAvailablePartners(partnersList);

      // Reset form variables
      setSelectedPartnerId('');
      setSelectedSofIds([]);
      setSofRates({});
      setInvoiceNumber('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setInvoiceSubtotal('');
      setTaxAmount('');
      setValidationError('');
      setModalStep(1);
      setIsSofDropdownOpen(false);
    } catch (err) {
      console.error('Error loading modal data:', err);
      alert('Failed to load completed sizing order forms.');
    }
  };

  const openCreateModal = () => {
    loadModalData();
    setIsModalOpen(true);
  };

  // Filtered available SOFs based on selected partner
  const filteredSofs = availableSofs.filter(s => s.partner_id === selectedPartnerId);

  // Selected SOFs objects
  const selectedSofsObjects = filteredSofs.filter(s => selectedSofIds.includes(s.id));

  // Calculated totals live
  const calculatedTotal = selectedSofsObjects.reduce((sum, sof) => {
    const qty = parseFloat(sof.qty) || 0;
    const rate = parseFloat(sofRates[sof.id]) || 0;
    return sum + (qty * rate);
  }, 0);

  const parsedSubtotal = parseFloat(invoiceSubtotal) || 0;
  const parsedTax = parseFloat(taxAmount) || 0;
  const invoiceTotal = parsedSubtotal + parsedTax;

  const handlePartnerChange = (e) => {
    setSelectedPartnerId(e.target.value);
    setSelectedSofIds([]);
    setSofRates({});
    setIsSofDropdownOpen(false);
  };

  const toggleSofSelection = (sofId) => {
    setSelectedSofIds(prev => {
      if (prev.includes(sofId)) {
        return prev.filter(id => id !== sofId);
      } else {
        return [...prev, sofId];
      }
    });
  };

  const handleRateChange = (sofId, rateVal) => {
    setSofRates(prev => ({
      ...prev,
      [sofId]: rateVal
    }));
  };

  const handleProceedToStep2 = () => {
    if (selectedSofIds.length === 0) {
      alert('Please select at least one Sizing Order Form.');
      return;
    }
    setModalStep(2);
  };

  const handleSubmitBill = async () => {
    setValidationError('');

    // Field checks
    if (!invoiceNumber.trim()) {
      setValidationError('Invoice number is required.');
      return;
    }
    if (!invoiceDate) {
      setValidationError('Invoice date is required.');
      return;
    }
    if (!invoiceSubtotal || parsedSubtotal <= 0) {
      setValidationError('Invoice subtotal must be greater than zero.');
      return;
    }

    // Rate validation for each SOF
    for (const sofId of selectedSofIds) {
      const rate = parseFloat(sofRates[sofId]);
      if (isNaN(rate) || rate <= 0) {
        setValidationError('Please enter a valid rate greater than zero for all selected order forms.');
        return;
      }
    }

    // Crucial business validation: Invoice Subtotal <= Calculated Total
    if (parsedSubtotal > calculatedTotal) {
      setValidationError(`The invoice subtotal (₹${parsedSubtotal.toFixed(2)}) cannot be greater than our calculated total (₹${calculatedTotal.toFixed(2)}).`);
      return;
    }

    setSubmitting(true);
    try {
      const selectedPartner = availablePartners.find(p => p.id === selectedPartnerId);
      const partnerName = selectedPartner ? selectedPartner.name : 'Unknown Partner';
      const billNumber = `${partnerName}/${invoiceNumber.trim()}`;

      // Build JSONB items
      const billItems = selectedSofsObjects.map(sof => {
        const qty = parseFloat(sof.qty) || 0;
        const rate = parseFloat(sofRates[sof.id]) || 0;

        // Determine timeliness (on time vs late)
        let timeliness = 'on_time';
        if (sof.end_date && sof.process_completed_at) {
          const plannedEnd = new Date(sof.end_date);
          const actualEnd = new Date(sof.process_completed_at);
          if (actualEnd > plannedEnd) {
            timeliness = 'late';
          }
        }

        return {
          form_id: sof.id,
          form_number: sof.sof_number,
          order_number: sof.order?.order_number || '—',
          design_name: sof.order?.design_name || '—',
          design_no: sof.order?.design_no || '—',
          planned_qty: qty,
          actual_qty: qty,
          start_date: sof.start_date,
          end_date: sof.end_date,
          actual_start_date: sof.process_started_at,
          actual_end_date: sof.process_completed_at,
          timeliness_status: timeliness,
          status: sof.status,
          rate_per_meter: rate,
          calculated_total: qty * rate
        };
      });

      const insertData = {
        bill_number: billNumber,
        form_type: 'sizing',
        partner_id: selectedPartnerId,
        partner_name: partnerName,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        selected_form_ids: selectedSofIds,
        bill_items: billItems,
        calculated_total: calculatedTotal,
        invoice_subtotal: parsedSubtotal,
        tax_amount: parsedTax,
        invoice_total: invoiceTotal,
        status: 'awaiting_approval',
        submitted_by: profile?.id,
        submitted_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('production_finance_bills')
        .insert([insertData]);

      if (error) {
        if (error.code === '23505') {
          throw new Error(`A bill with invoice number "${invoiceNumber}" already exists for this partner.`);
        }
        throw error;
      }

      alert('Bill submitted for Admin approval successfully!');
      setIsModalOpen(false);
      fetchBills();
    } catch (err) {
      console.error('Error submitting bill:', err);
      setValidationError(err.message || 'An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'awaiting_approval':
        return { bg: '#fef3c7', text: '#92400e', label: 'Awaiting Approval' };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', label: 'Approved' };
      case 'settled':
        return { bg: '#dbeafe', text: '#1e40af', label: 'Settled' };
      case 'rejected':
        return { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: status };
    }
  };

  const filteredBills = bills.filter(b => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { key: 'all', label: 'All Bills' },
            { key: 'awaiting_approval', label: 'Awaiting Approval' },
            { key: 'approved', label: 'Approved' },
            { key: 'settled', label: 'Settled' }
          ].map(pill => (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(pill.key)}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '20px',
                border: '1px solid ' + (statusFilter === pill.key ? '#800000' : 'var(--border-current)'),
                backgroundColor: statusFilter === pill.key ? '#800000' : 'var(--surface-current)',
                color: statusFilter === pill.key ? 'white' : 'var(--text-main-current)',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <button
          onClick={openCreateModal}
          style={{
            backgroundColor: '#800000',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#600000'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#800000'}
        >
          <Plus size={16} /> Create New Bill
        </button>
      </div>

      {/* Bills Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={24} className="spin" style={{ color: '#800000' }} />
        </div>
      ) : filteredBills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '1px solid var(--border-current)', borderRadius: '12px', background: 'var(--surface-current)' }}>
          No sizing bills found for the selected filter.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-current)', borderRadius: '12px', background: 'var(--surface-current)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left', minWidth: '900px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.015)', color: 'var(--text-muted-current)', fontWeight: '700' }}>
                <th style={{ padding: '0.75rem 0.5rem', width: '40px' }} />
                <th style={{ padding: '0.75rem 0.5rem' }}>Date</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Bill Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Partner</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>SOF Numbers</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Order Numbers</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Designs</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Calculated Subtotal</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Invoice Subtotal</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Tax Amount</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Invoice Total</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(bill => {
                const isExpanded = expandedBillId === bill.id;
                const statusStyle = getStatusBadgeStyle(bill.status);
                const sofNumbers = (bill.bill_items || []).map(item => item.form_number || item.sof_number).filter(Boolean).join(', ');
                const orderNumbers = Array.from(new Set((bill.bill_items || []).map(item => item.order_number).filter(Boolean))).join(', ');
                const designs = Array.from(new Set((bill.bill_items || []).map(item => `${item.design_no || ''} ${item.design_name || ''}`.trim()).filter(Boolean))).join(', ');
                return (
                  <React.Fragment key={bill.id}>
                    <tr
                      onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                      style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.01)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>{bill.invoice_date || new Date(bill.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '800', color: '#800000', fontFamily: 'monospace' }}>{bill.bill_number}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{bill.partner_name}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.72rem' }}>{sofNumbers || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.72rem' }}>{orderNumbers || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.72rem' }}>{designs || '—'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '500' }}>₹{Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--text-muted-current)' }}>₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '800', color: '#800000' }}>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                        <span style={{
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.text,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          display: 'inline-block'
                        }}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => printFinanceBill(bill)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            border: '1px solid var(--border-current)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            color: '#475569'
                          }}
                        >
                          <Printer size={12} /> Print
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.005)' }}>
                        <td colSpan={13} style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontWeight: '800', fontSize: '0.85rem' }}>Billed Sizing Order Forms</h4>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: '1rem', border: '1px solid var(--border-current)' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700' }}>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>SOF Number</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Order Number</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Design (No / Name)</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>SOF Status</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Actual Dates</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Timeliness</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Qty (m)</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Rate / Meter</th>
                                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Total Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(bill.bill_items || []).map((item, index) => (
                                <tr key={index} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                  <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace' }}>{item.form_number}</td>
                                  <td style={{ padding: '0.5rem' }}>{item.order_number}</td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <div>{item.design_no}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>{item.design_name}</div>
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    <span style={{
                                      backgroundColor: '#dcfce7',
                                      color: '#166534',
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      fontSize: '0.65rem',
                                      fontWeight: '700',
                                      textTransform: 'uppercase'
                                    }}>
                                      {item.status || 'completed'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem', fontSize: '0.7rem' }}>
                                    {item.actual_start_date ? new Date(item.actual_start_date).toLocaleDateString('en-GB') : '—'} to {item.actual_end_date ? new Date(item.actual_end_date).toLocaleDateString('en-GB') : '—'}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    <span style={{
                                      backgroundColor: item.timeliness_status === 'late' ? '#fee2e2' : '#dcfce7',
                                      color: item.timeliness_status === 'late' ? '#991b1b' : '#166534',
                                      padding: '1px 6px',
                                      borderRadius: '10px',
                                      fontSize: '0.65rem',
                                      fontWeight: '700'
                                    }}>
                                      {item.timeliness_status === 'late' ? 'LATE' : 'ON TIME'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500' }}>{Number(item.actual_qty).toLocaleString()}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{Number(item.rate_per_meter).toFixed(2)}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{Number(item.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {bill.admin_notes && (
                            <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.75rem', borderRadius: '8px', borderLeft: '3px solid #64748b', fontSize: '0.75rem', color: 'var(--text-main-current)' }}>
                              <strong>Admin Remarks:</strong> {bill.admin_notes}
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

      {/* Create Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1.5rem', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--surface-current)',
            border: '1px solid var(--border-current)',
            borderRadius: '16px',
            width: '100%', maxWidth: '800px',
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-current)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)' }}>Create Sizing Finance Bill</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted-current)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Step Indicators */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.01)' }}>
              <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.78rem', color: modalStep === 1 ? '#800000' : 'var(--text-muted-current)', borderBottom: modalStep === 1 ? '2px solid #800000' : 'none' }}>
                Step 1: Partner & Order Forms
              </div>
              <div style={{ flex: 1, padding: '0.75rem', textAlign: 'center', fontWeight: '700', fontSize: '0.78rem', color: modalStep === 2 ? '#800000' : 'var(--text-muted-current)', borderBottom: modalStep === 2 ? '2px solid #800000' : 'none' }}>
                Step 2: Rates & Invoicing
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
              {modalStep === 1 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Select Partner */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Select Sizing Partner</label>
                    <select
                      value={selectedPartnerId}
                      onChange={handlePartnerChange}
                      style={{
                        padding: '0.6rem 0.75rem',
                        border: '1px solid var(--border-current)',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        backgroundColor: 'var(--surface-current)',
                        color: 'var(--text-current)',
                        width: '100%',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- Choose Partner --</option>
                      {availablePartners.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select SOFs via Dropdown */}
                  {selectedPartnerId && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', position: 'relative' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>
                        Select Order Forms to include ({selectedSofIds.length} selected)
                      </label>
                      <div
                        onClick={() => setIsSofDropdownOpen(!isSofDropdownOpen)}
                        style={{
                          minHeight: '38px',
                          padding: '0.4rem 2.25rem 0.4rem 0.75rem',
                          border: '1px solid var(--border-current)',
                          borderRadius: '8px',
                          fontSize: '0.825rem',
                          background: 'var(--surface-current)',
                          color: selectedSofIds.length === 0 ? 'var(--text-muted-current)' : 'var(--text-current)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.25rem',
                          alignItems: 'center',
                          position: 'relative'
                        }}
                      >
                        {selectedSofIds.length === 0 ? 'Choose Sizing Order Forms...' : (
                          selectedSofsObjects.map(sof => (
                            <span key={sof.id} style={{
                              backgroundColor: 'rgba(128,0,0,0.08)',
                              color: '#800000',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              {sof.sof_number}
                              <span onClick={(e) => { e.stopPropagation(); toggleSofSelection(sof.id); }} style={{ cursor: 'pointer', fontWeight: '900' }}>&times;</span>
                            </span>
                          ))
                        )}
                        {isSofDropdownOpen ? (
                          <ChevronUp size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)', pointerEvents: 'none' }} />
                        ) : (
                          <ChevronDown size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)', pointerEvents: 'none' }} />
                        )}
                      </div>

                      {isSofDropdownOpen && (
                        <div style={{
                          backgroundColor: 'var(--surface-current)',
                          border: '1px solid var(--border-current)',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                          maxHeight: '250px',
                          overflowY: 'auto',
                          marginTop: '8px',
                          width: '100%'
                        }}>
                          {filteredSofs.length === 0 ? (
                            <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted-current)', fontStyle: 'italic', textAlign: 'center' }}>
                              No completed unbilled sizing order forms for this partner.
                            </div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ backgroundColor: 'rgba(0,0,0,0.015)', borderBottom: '1px solid var(--border-current)', fontWeight: '700', position: 'sticky', top: 0, backgroundColor: 'var(--surface-current)', zIndex: 1 }}>
                                  <th style={{ padding: '0.5rem', width: '40px', textAlign: 'center' }}>Select</th>
                                  <th style={{ padding: '0.5rem' }}>SOF Number</th>
                                  <th style={{ padding: '0.5rem' }}>Order Number</th>
                                  <th style={{ padding: '0.5rem' }}>Design Name</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Qty (m)</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredSofs.map(sof => {
                                  const isChecked = selectedSofIds.includes(sof.id);
                                  return (
                                    <tr
                                      key={sof.id}
                                      onClick={() => toggleSofSelection(sof.id)}
                                      style={{
                                        borderBottom: '1px solid var(--border-current)',
                                        cursor: 'pointer',
                                        backgroundColor: isChecked ? 'rgba(128,0,0,0.02)' : 'transparent',
                                        transition: 'background-color 0.15s ease'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(128,0,0,0.04)' : 'rgba(0,0,0,0.015)'}
                                      onMouseLeave={e => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(128,0,0,0.02)' : 'transparent'}
                                    >
                                      <td style={{ padding: '0.5rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleSofSelection(sof.id)}
                                          style={{ accentColor: '#800000', cursor: 'pointer' }}
                                        />
                                      </td>
                                      <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace' }}>{sof.sof_number}</td>
                                      <td style={{ padding: '0.5rem' }}>{sof.order?.order_number || '—'}</td>
                                      <td style={{ padding: '0.5rem' }}>{sof.order?.design_name || '—'}</td>
                                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(sof.qty).toLocaleString()}</td>
                                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                        <span style={{
                                          backgroundColor: '#dcfce7',
                                          color: '#166534',
                                          padding: '2px 6px',
                                          borderRadius: '10px',
                                          fontSize: '0.65rem',
                                          fontWeight: '700',
                                          textTransform: 'uppercase'
                                        }}>
                                          {sof.status}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Invoice Styled Sheet */}
                  <div style={{
                    backgroundColor: 'var(--surface-current)',
                    border: '1px solid var(--border-current)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem'
                  }}>
                    {/* Invoice Sheet Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-current)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Billed To (Partner)</h4>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)', marginTop: '0.25rem' }}>
                          🤝 {availablePartners.find(p => p.id === selectedPartnerId)?.name || 'Select Partner'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                          Bill No: {availablePartners.find(p => p.id === selectedPartnerId)?.name || 'Partner'}/{invoiceNumber || 'INV'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '150px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grand Total</h4>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#800000', marginTop: '0.25rem' }}>
                          ₹{invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Invoice Metadata Fields Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Invoice Number</label>
                        <input
                          type="text"
                          placeholder="e.g. INV-1029"
                          value={invoiceNumber}
                          onChange={e => setInvoiceNumber(e.target.value)}
                          style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Invoice Date</label>
                        <input
                          type="date"
                          value={invoiceDate}
                          onChange={e => setInvoiceDate(e.target.value)}
                          style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                        />
                      </div>
                    </div>

                    {/* Invoice Items Table */}
                    <div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'rgba(0,0,0,0.015)', borderBottom: '2px solid var(--border-current)', fontWeight: '700' }}>
                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Description & Form Details</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', width: '100px' }}>Status</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', width: '100px' }}>Qty (m)</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', width: '130px' }}>Rate / Meter (₹)</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right', width: '120px' }}>Total Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSofsObjects.map(sof => {
                            const qty = parseFloat(sof.qty) || 0;
                            const rate = sofRates[sof.id] || '';
                            const rowTotal = qty * (parseFloat(rate) || 0);
                            return (
                              <tr key={sof.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                  <div style={{ fontWeight: '700', fontFamily: 'monospace', color: '#800000', fontSize: '0.825rem' }}>{sof.sof_number}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                    Order: <strong>{sof.order?.order_number || '—'}</strong> | Design: <strong>{sof.order?.design_no || '—'}</strong> / {sof.order?.design_name || '—'}
                                  </div>
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                  <span style={{
                                    backgroundColor: '#dcfce7',
                                    color: '#166534',
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    fontSize: '0.625rem',
                                    fontWeight: '700',
                                    textTransform: 'uppercase'
                                  }}>
                                    {sof.status}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '600' }}>{Number(qty).toLocaleString()}</td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={rate}
                                    onChange={e => handleRateChange(sof.id, e.target.value)}
                                    style={{
                                      width: '90%',
                                      padding: '0.35rem 0.5rem',
                                      border: '1px solid var(--border-current)',
                                      borderRadius: '6px',
                                      fontSize: '0.8rem',
                                      textAlign: 'center',
                                      backgroundColor: 'var(--surface-current)',
                                      color: 'var(--text-current)',
                                      fontWeight: '600'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Invoice Calculations Summary Footer */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid var(--border-current)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', maxWidth: '380px', fontSize: '0.8rem' }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Calculated SOFs Subtotal:</span>
                          <span style={{ fontWeight: '700', color: 'var(--text-current)' }}>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Invoice Subtotal (from Bill):</span>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem', width: '160px' }}>
                            <input
                              type="number"
                              step="0.01"
                              placeholder={`Max ₹${calculatedTotal.toFixed(2)}`}
                              value={invoiceSubtotal}
                              onChange={e => setInvoiceSubtotal(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.35rem 0.5rem',
                                border: '1px solid ' + (parsedSubtotal > calculatedTotal ? '#ef4444' : 'var(--border-current)'),
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                textAlign: 'right',
                                backgroundColor: 'var(--surface-current)',
                                color: parsedSubtotal > calculatedTotal ? '#ef4444' : 'var(--text-current)',
                                fontWeight: '700'
                              }}
                            />
                            {parsedSubtotal > calculatedTotal && (
                              <span style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: '600' }}>Exceeds calculated limit</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Tax Amount (CGST/SGST/IGST):</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 0.00"
                            value={taxAmount}
                            onChange={e => setTaxAmount(e.target.value)}
                            style={{
                              width: '160px',
                              padding: '0.35rem 0.5rem',
                              border: '1px solid var(--border-current)',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              textAlign: 'right',
                              backgroundColor: 'var(--surface-current)',
                              color: 'var(--text-current)',
                              fontWeight: '600'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-current)', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                          <span style={{ color: 'var(--text-current)', fontWeight: '800', fontSize: '0.85rem' }}>Grand Total (Invoice Total):</span>
                          <span style={{ fontWeight: '800', fontSize: '1.1rem', color: '#800000' }}>₹{invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>

                      </div>
                    </div>

                  </div>

                  {validationError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.75rem 1rem', borderRadius: '8px', color: '#991b1b', fontSize: '0.75rem', fontWeight: '600' }}>
                      <AlertCircle size={16} /> {validationError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-current)', backgroundColor: 'rgba(0,0,0,0.01)' }}>
              <div>
                {modalStep === 2 && (
                  <button
                    onClick={() => setModalStep(1)}
                    disabled={submitting}
                    style={{
                      border: '1px solid var(--border-current)',
                      backgroundColor: 'var(--surface-current)',
                      color: 'var(--text-main-current)',
                      borderRadius: '8px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  style={{
                    border: '1px solid var(--border-current)',
                    backgroundColor: 'var(--surface-current)',
                    color: 'var(--text-muted-current)',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                {modalStep === 1 ? (
                  <button
                    onClick={handleProceedToStep2}
                    style={{
                      border: 'none',
                      backgroundColor: '#800000',
                      color: 'white',
                      borderRadius: '8px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Next &rarr;
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitBill}
                    disabled={submitting || parsedSubtotal > calculatedTotal}
                    style={{
                      border: 'none',
                      backgroundColor: submitting || parsedSubtotal > calculatedTotal ? '#cbd5e1' : '#800000',
                      color: 'white',
                      borderRadius: '8px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      cursor: submitting || parsedSubtotal > calculatedTotal ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {submitting ? 'Submitting...' : '✓ Submit Bill'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ────────────────────────────────────────────────────────
// GLOBAL PRINT STYLES FOR OVERSEE REPORT PRINTING
// ────────────────────────────────────────────────────────
export function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 10mm 10mm;
        }
        body, html {
          background: white !important;
          color: black !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
        }
        #root, .app-layout-container, .main-content-wrapper, .main-content, .fade-in, .print-report-container {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          max-height: none !important;
          min-height: 0 !important;
          overflow: visible !important;
          display: block !important;
          box-shadow: none !important;
          border: none !important;
          position: static !important;
        }
        /* Hide UI components during print */
        .no-print, 
        .app-sidebar, 
        .mobile-app-header, 
        .sidebar-overlay,
        .sidebar-toggle-btn,
        button, 
        .hide-scrollbar::-webkit-scrollbar, 
        nav,
        input,
        select,
        .multi-select-dropdown,
        .dropdown-menu,
        label,
        .reset-btn {
          display: none !important;
        }
        
        /* Force display of print-only content */
        .print-only {
          display: block !important;
        }

        /* Summary Cards in Print */
        .summary-card {
          border: 1px solid #ddd !important;
          background: #fff !important;
          color: #000 !important;
          padding: 10px 12px !important;
          border-radius: 6px !important;
          box-shadow: none !important;
          margin-bottom: 0.5rem !important;
          page-break-inside: avoid !important;
        }
        .summary-card span {
          color: #000 !important;
        }

        /* Prevent parent wrappers of tables from scroll-clipping when printing */
        .hide-scrollbar, 
        div[style*="overflowX"], 
        div[style*="overflow-x"] {
          overflow: visible !important;
          overflow-x: visible !important;
          width: 100% !important;
          max-width: 100% !important;
          border: none !important;
          background: transparent !important;
        }

        /* Printable Table styles */
        table {
          border-collapse: collapse !important;
          width: 100% !important;
          min-width: 0 !important; /* CRITICAL: Override inline minWidth style */
          max-width: 100% !important;
          table-layout: auto !important;
          font-size: 8.5px !important; /* Tighter font size for 9-10 columns */
          color: #000 !important;
          margin-top: 0.75rem !important;
          background-color: #fff !important;
        }
        th, td {
          border: 0.5px solid #000 !important; /* Clean thin black borders */
          padding: 4px 5px !important; /* Tight padding to maximize space */
          color: #000 !important;
          text-align: left !important;
          white-space: normal !important; /* Allow wrapping */
          word-break: break-word !important; /* Wrap long strings */
        }
        th {
          background-color: #f3f4f6 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-weight: bold !important;
          text-transform: uppercase !important;
          font-size: 8px !important;
          letter-spacing: 0.02em !important;
        }
        tr {
          page-break-inside: avoid !important;
        }
        tr[style*="background-color"] td {
          background-color: #f9fafb !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        td[style*="color"] {
          color: #000 !important;
          font-weight: bold !important;
        }
        .print-only h2 {
          color: #800000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `}</style>
  );
}

// ── Weaving Finances Tab Component ──────────────────────────────
function WeavingFinancesTab() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeSubView, setActiveSubView] = useState('orders'); // 'orders' | 'bills'
  const [weavingOrders, setWeavingOrders] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [bills, setBills] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection/Expansion state
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedPartners, setExpandedPartners] = useState({});
  const [showWvofDetails, setShowWvofDetails] = useState(null);
  const [partnerActiveTabs, setPartnerActiveTabs] = useState({});

  // Manual Select state for Creating New Bill
  const [isManualSelect, setIsManualSelect] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedWvofId, setSelectedWvofId] = useState('');

  const partnersData = useMemo(() => {
    const pMap = {};
    weavingOrders.forEach(o => {
      const pId = o.partner_id || 'unknown';
      const pName = o.partner_name || 'Unknown Partner';
      if (!pMap[pId]) {
        pMap[pId] = { id: pId, name: pName, orders: [], bills: [] };
      }
      pMap[pId].orders.push(o);
    });
    bills.forEach(b => {
      const pId = b.partner_id || 'unknown';
      const pName = b.partner_name || 'Unknown Partner';
      if (!pMap[pId]) {
        pMap[pId] = { id: pId, name: pName, orders: [], bills: [] };
      }
      if (!pMap[pId].bills.some(x => x.id === b.id)) {
        pMap[pId].bills.push(b);
      }
    });
    return Object.values(pMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [weavingOrders, bills]);

  // Bill Creation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWvof, setSelectedWvof] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [reed, setReed] = useState('');
  const [pick, setPick] = useState('');
  const [pickRate, setPickRate] = useState('');
  const [invoiceSubtotal, setInvoiceSubtotal] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [validationError, setValidationError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const partnersWithCompletedUnbilled = useMemo(() => {
    const pMap = {};
    weavingOrders.forEach(o => {
      if (!o.isBilled) {
        const pId = o.partner_id || 'unknown';
        const pName = o.partner_name || 'Unknown Partner';
        if (!pMap[pId]) {
          pMap[pId] = { id: pId, name: pName };
        }
      }
    });
    return Object.values(pMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [weavingOrders]);

  const unbilledWvofsForSelectedPartner = useMemo(() => {
    if (!selectedPartnerId) return [];
    return weavingOrders.filter(o => o.partner_id === selectedPartnerId && !o.isBilled);
  }, [weavingOrders, selectedPartnerId]);

  const fetchWeavingData = async () => {
    setLoading(true);
    try {
      // 1. Fetch completed/late completed job-work weaving orders
      const { data: ordersData, error: ordersErr } = await supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name, total_quantity, yarn_requirements, technical_specs)
        `)
        .eq('weaving_type', 'job_work')
        .in('status', ['completed', 'late_complete'])
        .order('created_at', { ascending: false });

      if (ordersErr) throw ordersErr;

      // 2. Fetch all non-rejected weaving bills to determine which orders are already billed
      const { data: billsData, error: billsErr } = await supabase
        .from('production_finance_bills')
        .select('*')
        .eq('form_type', 'weaving')
        .order('created_at', { ascending: false });

      if (billsErr) throw billsErr;
      setBills(billsData || []);

      const billedWvofIds = new Set();
      billsData?.forEach(b => {
        if (b.status !== 'rejected') {
          b.selected_form_ids?.forEach(id => billedWvofIds.add(id));
        }
      });

      // Filter/decorate weaving orders with billing status
      const decoratedOrders = (ordersData || []).map(o => ({
        ...o,
        isBilled: billedWvofIds.has(o.id),
        billStatus: billsData?.find(b => b.selected_form_ids?.includes(o.id) && b.status !== 'rejected')?.status || null
      }));
      setWeavingOrders(decoratedOrders);

      // 3. Fetch yarn count master
      const { data: ycData } = await supabase.from('master_yarn_counts').select('*');
      setYarnCounts(ycData || []);

      // 4. Fetch dyed yarn deliveries for completed weaving orders
      if (ordersData && ordersData.length > 0) {
        const { data: delData, error: delErr } = await supabase
          .from('dyed_yarn_delivery_items')
          .select(`
            id,
            production_form_id,
            yarn_count_id,
            quantity_kg,
            colour,
            lot_number,
            process_type,
            delivery:dyed_yarn_deliveries(
              id,
              dydr_number,
              delivered_date,
              delivered_by,
              vehicle_no,
              remarks
            )
          `)
          .in('production_form_id', ordersData.map(o => o.id));

        if (!delErr) {
          setDeliveries(delData || []);
        }
      }
    } catch (err) {
      console.error('Error fetching weaving finances data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeavingData();
  }, []);

  const handleOpenCreateBill = async (wvof) => {
    setIsManualSelect(false);
    setSelectedPartnerId(wvof.partner_id);
    setSelectedWvofId(wvof.id);
    setSelectedWvof(wvof);

    // Prefill specs if available
    const specs = wvof.order?.technical_specs;
    let initialReed = '';
    let initialPick = '';
    if (specs) {
      initialReed = specs.on_loom_reed || specs.warp_density || '';
      initialPick = specs.on_loom_pick || specs.weft_density || '';
    }
    setReed(initialReed);
    setPick(initialPick);
    setPickRate('');
    setInvoiceNumber('Generating...');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setInvoiceSubtotal('');
    setTaxAmount('');
    setValidationError('');
    setIsModalOpen(true);

    try {
      const { count, error } = await supabase
        .from('production_finance_bills')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', wvof.partner_id)
        .eq('form_type', 'weaving');

      if (error) throw error;
      const nextSeq = (count || 0) + 1;
      const formattedSeq = String(nextSeq).padStart(4, '0');
      setInvoiceNumber(`${wvof.partner_name}/${formattedSeq}`);
    } catch (err) {
      console.error('Error generating invoice number:', err);
      setInvoiceNumber(`${wvof.partner_name}/0001`);
    }
  };

  const handleOpenCreateNewBillManual = () => {
    setIsManualSelect(true);
    setSelectedPartnerId('');
    setSelectedWvofId('');
    setSelectedWvof(null);
    setReed('');
    setPick('');
    setPickRate('');
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setInvoiceSubtotal('');
    setTaxAmount('');
    setValidationError('');
    setIsModalOpen(true);
  };

  const handlePartnerChange = (e) => {
    const pId = e.target.value;
    setSelectedPartnerId(pId);
    setSelectedWvofId('');
    setSelectedWvof(null);
    setReed('');
    setPick('');
    setPickRate('');
    setInvoiceNumber('');
    setInvoiceSubtotal('');
    setTaxAmount('');
    setValidationError('');
  };

  const handleWvofChange = async (e) => {
    const wId = e.target.value;
    if (!wId) {
      setSelectedWvofId('');
      setSelectedWvof(null);
      setReed('');
      setPick('');
      setPickRate('');
      setInvoiceNumber('');
      setInvoiceSubtotal('');
      setTaxAmount('');
      setValidationError('');
      return;
    }
    const wvof = weavingOrders.find(o => o.id === wId);
    if (!wvof) return;

    setSelectedWvofId(wId);
    setSelectedWvof(wvof);

    // Prefill specs if available
    const specs = wvof.order?.technical_specs;
    let initialReed = '';
    let initialPick = '';
    if (specs) {
      initialReed = specs.on_loom_reed || specs.warp_density || '';
      initialPick = specs.on_loom_pick || specs.weft_density || '';
    }
    setReed(initialReed);
    setPick(initialPick);
    setPickRate('');
    setInvoiceNumber('Generating...');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setInvoiceSubtotal('');
    setTaxAmount('');
    setValidationError('');

    try {
      const { count, error } = await supabase
        .from('production_finance_bills')
        .select('*', { count: 'exact', head: true })
        .eq('partner_id', wvof.partner_id)
        .eq('form_type', 'weaving');

      if (error) throw error;
      const nextSeq = (count || 0) + 1;
      const formattedSeq = String(nextSeq).padStart(4, '0');
      setInvoiceNumber(`${wvof.partner_name}/${formattedSeq}`);
    } catch (err) {
      console.error('Error generating invoice number:', err);
      setInvoiceNumber(`${wvof.partner_name}/0001`);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPartnerId('');
    setSelectedWvofId('');
    setSelectedWvof(null);
    setIsManualSelect(false);
  };

  // Roll totals helper
  const getWvofRollTotals = (wvof) => {
    const rolls = (wvof?.fabric_rolls || []).filter(r => r.status === 'greige received' || r.status === '4_point_inspected' || r.status === 'sent_to_processing' || r.status === 'received_from_processing');
    const totalPlanned = rolls.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);
    const totalActual = rolls.reduce((sum, r) => sum + (parseFloat(r.actual_qty || r.actual_length) || 0), 0);
    const totalShortage = rolls.reduce((sum, r) => sum + (parseFloat(r.shortage) || 0), 0);
    const totalMistakes = rolls.reduce((sum, r) => sum + (parseFloat(r.mistake) || 0), 0);
    const totalOk = rolls.reduce((sum, r) => sum + (parseFloat(r.approved_qty) || 0), 0);

    return { totalPlanned, totalActual, totalShortage, totalMistakes, totalOk, rolls };
  };

  // Live calculations for Bill creation
  const calculatedValues = useMemo(() => {
    if (!selectedWvof) return { ratePerMeter: 0, totalAmount: 0, grossTotal: 0 };
    const { totalOk } = getWvofRollTotals(selectedWvof);
    const pVal = parseFloat(pick) || 0;
    const prVal = parseFloat(pickRate) || 0;
    const ratePerMeter = pVal * prVal;
    const totalAmount = ratePerMeter * totalOk;

    const subtotal = parseFloat(invoiceSubtotal) || 0;
    const tax = parseFloat(taxAmount) || 0;
    const grossTotal = subtotal + tax;

    return { ratePerMeter, totalAmount, grossTotal, totalOk };
  }, [selectedWvof, pick, pickRate, invoiceSubtotal, taxAmount]);

  useEffect(() => {
    if (selectedWvof && invoiceSubtotal) {
      const sub = parseFloat(invoiceSubtotal) || 0;
      if (sub > calculatedValues.totalAmount) {
        setValidationError(`Claimed subtotal (₹${sub.toFixed(2)}) cannot exceed the calculated total amount (₹${calculatedValues.totalAmount.toFixed(2)}).`);
      } else {
        setValidationError('');
      }
    }
  }, [invoiceSubtotal, calculatedValues.totalAmount]);

  const handleSubmitBill = async (e) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || invoiceNumber === 'Generating...') {
      alert('Invoice number is still generating, please wait.');
      return;
    }
    if (validationError) {
      alert('Please resolve validation errors before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const billNumber = invoiceNumber.trim();
      const { totalPlanned, totalActual, totalShortage, totalMistakes, totalOk } = getWvofRollTotals(selectedWvof);

      const subtotal = parseFloat(invoiceSubtotal) || 0;
      const tax = parseFloat(taxAmount) || 0;
      const gross = subtotal + tax;

      const newBill = {
        bill_number: billNumber,
        form_type: 'weaving',
        partner_id: selectedWvof.partner_id,
        partner_name: selectedWvof.partner_name,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        selected_form_ids: [selectedWvof.id],
        bill_items: [{
          form_id: selectedWvof.id,
          form_number: selectedWvof.weaving_number,
          order_number: selectedWvof.order?.order_number || '—',
          design_name: selectedWvof.order?.design_name || '—',
          design_no: selectedWvof.order?.design_no || '—',
          status: selectedWvof.status,
          planned_qty: selectedWvof.qty,
          actual_qty: totalOk,
          start_date: selectedWvof.start_date,
          end_date: selectedWvof.end_date,
          actual_start_date: selectedWvof.process_started_at,
          actual_end_date: selectedWvof.process_completed_at,
          timeliness_status: (selectedWvof.status === 'late_complete' || (selectedWvof.process_completed_at && selectedWvof.end_date && new Date(selectedWvof.process_completed_at) > new Date(selectedWvof.end_date))) ? 'late' : 'on_time',
          rate_per_meter: calculatedValues.ratePerMeter,
          calculated_total: calculatedValues.totalAmount,
          reed: parseFloat(reed) || 0,
          pick: parseFloat(pick) || 0,
          pick_rate: parseFloat(pickRate) || 0,
          fabric_rolls: selectedWvof.fabric_rolls,
          construction: selectedWvof.order?.technical_specs
            ? `${selectedWvof.order.technical_specs.on_loom_reed || '—'} / ${selectedWvof.order.technical_specs.on_loom_pick || '—'}`
            : '—',
          totals: {
            planned_qty: totalPlanned,
            actual_qty: totalActual,
            shortage: totalShortage,
            mistakes: totalMistakes,
            ok_qty: totalOk
          }
        }],
        calculated_total: calculatedValues.totalAmount,
        invoice_subtotal: subtotal,
        tax_amount: tax,
        invoice_total: gross,
        status: 'awaiting_approval',
        submitted_by: profile?.id
      };

      const { error } = await supabase
        .from('production_finance_bills')
        .insert([newBill]);

      if (error) throw error;

      alert('Weaving Finance Bill submitted for approval!');
      handleCloseModal();
      fetchWeavingData();
    } catch (err) {
      alert('Error submitting bill: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'awaiting_approval':
        return { bg: '#fef3c7', text: '#92400e', label: 'AWAITING APPROVAL' };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', label: 'APPROVED' };
      case 'settled':
        return { bg: '#dbeafe', text: '#1e40af', label: 'SETTLED' };
      case 'rejected':
        return { bg: '#fee2e2', text: '#991b1b', label: 'REJECTED' };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: (status || '').toUpperCase() };
    }
  };

  const filteredBills = bills.filter(b => {
    if (statusFilter === 'all') return true;
    return b.status === statusFilter;
  });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <style>{`
        .partner-card { background: white; border: 1px solid var(--border-current); border-radius: 8px; margin-bottom: 1rem; overflow: hidden; }
        .partner-header { padding: 1rem; background: rgba(0,0,0,0.02); border-bottom: 1px solid var(--border-current); display: flex; align-items: center; gap: 1rem; cursor: pointer; }
        .tab-button { padding: 0.5rem 1rem; cursor: pointer; border: none; background: none; font-weight: 600; color: var(--text-muted-current); border-bottom: 2px solid transparent; }
        .tab-button.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
        .qc-tooltip-trigger { position: relative; }
        .qc-tooltip-trigger:hover .qc-tooltip-content { display: block !important; }
        td:has(.qc-tooltip-trigger), .qc-overflow-visible { overflow: visible !important; white-space: normal !important; }
        .wv-fin-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
        .wv-fin-table th, .wv-fin-table td { padding: 0.5rem 0.6rem; font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-bottom: 1px solid var(--border-current); }
        .wv-fin-table th { background-color: rgba(0,0,0,0.02); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted-current); letter-spacing: 0.3px; }
        .wv-compact-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 0.75rem; }
        .wv-compact-table th, .wv-compact-table td { padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border-current); }
      `}</style>

      {/* Global Status Filters & Create Bill button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { key: 'all', label: 'All Bills' },
            { key: 'awaiting_approval', label: 'Awaiting Approval' },
            { key: 'approved', label: 'Approved' },
            { key: 'settled', label: 'Settled' },
            { key: 'rejected', label: 'Rejected' }
          ].map(pill => (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(pill.key)}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '20px',
                border: '1px solid ' + (statusFilter === pill.key ? 'var(--color-primary)' : 'var(--border-current)'),
                backgroundColor: statusFilter === pill.key ? 'var(--color-primary)' : 'white',
                color: statusFilter === pill.key ? 'white' : 'var(--text-main-current)',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleOpenCreateNewBillManual}
          style={{
            backgroundColor: '#800000',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Plus size={16} /> Create New Bill
        </button>
      </div>

      {/* Partners List */}
      {partnersData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
          No weaving orders or bills found.
        </div>
      ) : (
        partnersData.map(partner => {
          const partnerOrders = partner.orders || [];
          const partnerBills = partner.bills || [];

          // Metrics
          const orderFormsCount = partnerOrders.length;
          const totalBilledPrice = partnerBills
            .filter(b => b.status !== 'rejected')
            .reduce((sum, b) => sum + (parseFloat(b.invoice_total) || 0), 0);

          const settledPrice = partnerBills
            .filter(b => b.status === 'settled')
            .reduce((sum, b) => sum + (parseFloat(b.invoice_total) || 0), 0);

          const approvedOrSettledCount = partnerOrders
            .filter(o => o.billStatus === 'approved' || o.billStatus === 'settled')
            .length;

          const awaitingApprovalCount = partnerOrders
            .filter(o => o.billStatus === 'awaiting_approval')
            .length;

          const isPartnerExpanded = !!expandedPartners[partner.id];
          const activeSubTab = partnerActiveTabs[partner.id] || 'orders';

          const partnerFilteredBills = partnerBills.filter(b => {
            if (statusFilter === 'all') return true;
            return b.status === statusFilter;
          });

          return (
            <div key={partner.id} className="partner-card" style={{
              backgroundColor: 'var(--surface-current)',
              border: '1px solid var(--border-current)',
              borderRadius: '12px',
              marginBottom: '1.25rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              overflow: 'hidden'
            }}>
              {/* Card Header (clickable to toggle expansion) */}
              <div
                onClick={() => setExpandedPartners(prev => ({ ...prev, [partner.id]: !prev[partner.id] }))}
                style={{
                  padding: '1.25rem 1.5rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.015)',
                  borderBottom: isPartnerExpanded ? '1px solid var(--border-current)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)' }}>
                      {partner.name}
                    </h3>
                    <span style={{
                      backgroundColor: 'rgba(128, 0, 0, 0.08)',
                      color: '#800000',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      {orderFormsCount} {orderFormsCount === 1 ? 'Order Form' : 'Order Forms'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted-current)' }}>
                    {isPartnerExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Metrics Summary Row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '1rem',
                  fontSize: '0.8rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px dashed var(--border-current)'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600' }}>Total Price (Billed)</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-current)' }}>
                      ₹{totalBilledPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600' }}>Settled Price</span>
                    <strong style={{ fontSize: '0.9rem', color: '#047857' }}>
                      ₹{settledPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600' }}>WVOF Approved / Settled</span>
                    <span style={{
                      backgroundColor: approvedOrSettledCount > 0 ? '#ecfdf5' : '#f1f5f9',
                      color: approvedOrSettledCount > 0 ? '#047857' : '#64748b',
                      padding: '1px 6px',
                      borderRadius: '6px',
                      fontWeight: '700',
                      display: 'inline-block',
                      marginTop: '2px'
                    }}>
                      {approvedOrSettledCount} Approved / Settled
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600' }}>Awaiting Approval</span>
                    <span style={{
                      backgroundColor: awaitingApprovalCount > 0 ? '#fff9db' : '#f1f5f9',
                      color: awaitingApprovalCount > 0 ? '#b45309' : '#64748b',
                      padding: '1px 6px',
                      borderRadius: '6px',
                      fontWeight: '700',
                      display: 'inline-block',
                      marginTop: '2px'
                    }}>
                      {awaitingApprovalCount} Awaiting
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Content (expanded sub-view with two tabs) */}
              {isPartnerExpanded && (
                <div style={{ borderTop: '1px solid var(--border-current)' }}>
                  {/* Tab Headers */}
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.01)', borderBottom: '1px solid var(--border-current)' }}>
                    <button
                      onClick={() => setPartnerActiveTabs(prev => ({ ...prev, [partner.id]: 'orders' }))}
                      className={`tab-button ${activeSubTab === 'orders' ? 'active' : ''}`}
                      style={{
                        padding: '0.75rem 1.25rem',
                        border: 'none',
                        background: 'none',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        color: activeSubTab === 'orders' ? '#800000' : 'var(--text-muted-current)',
                        borderBottom: activeSubTab === 'orders' ? '2.5px solid #800000' : '2.5px solid transparent'
                      }}
                    >
                      Weaving Order Forms (WVOF)
                    </button>
                    <button
                      onClick={() => setPartnerActiveTabs(prev => ({ ...prev, [partner.id]: 'bills' }))}
                      className={`tab-button ${activeSubTab === 'bills' ? 'active' : ''}`}
                      style={{
                        padding: '0.75rem 1.25rem',
                        border: 'none',
                        background: 'none',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        color: activeSubTab === 'bills' ? '#800000' : 'var(--text-muted-current)',
                        borderBottom: activeSubTab === 'bills' ? '2.5px solid #800000' : '2.5px solid transparent'
                      }}
                    >
                      Submitted Bills
                    </button>
                  </div>

                  {/* Tab Body */}
                  <div style={{ padding: '1.25rem' }}>
                    {activeSubTab === 'orders' && (
                      <div className="glass-panel" style={{ padding: 0, overflow: 'visible' }}>
                        {/* Weaving Order Forms Table */}
                        <table className="wv-fin-table">
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }} />
                              <th style={{ width: '18%' }}>WVOF Number</th>
                              <th style={{ width: '12%' }}>Order Info</th>
                              <th style={{ width: '15%' }}>Design Name/No</th>
                              <th style={{ width: '10%', textAlign: 'right' }}>Planned Qty</th>
                              <th style={{ width: '10%', textAlign: 'right' }}>Greige Input</th>
                              <th style={{ width: '10%', textAlign: 'right' }}>Actual Qty</th>
                              <th style={{ width: '12%' }}>Dates</th>
                              <th style={{ width: '13%' }}>Billing Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {partnerOrders.length === 0 ? (
                              <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted-current)' }}>
                                  No completed weaving order forms found.
                                </td>
                              </tr>
                            ) : (
                              [...partnerOrders].sort((a, b) => {
                                const timeA = a.process_completed_at ? new Date(a.process_completed_at).getTime() : 0;
                                const timeB = b.process_completed_at ? new Date(b.process_completed_at).getTime() : 0;
                                if (timeA !== timeB) return timeB - timeA;
                                const createA = a.created_at ? new Date(a.created_at).getTime() : 0;
                                const createB = b.created_at ? new Date(b.created_at).getTime() : 0;
                                return createB - createA;
                              }).map(wvof => {
                                const isExpanded = expandedOrderId === wvof.id;
                                const { totalPlanned, totalActual, totalShortage, totalMistakes, totalOk, rolls } = getWvofRollTotals(wvof);

                                return (
                                  <React.Fragment key={wvof.id}>
                                    <tr
                                      onClick={() => setExpandedOrderId(isExpanded ? null : wvof.id)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <td style={{ textAlign: 'center' }}>
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </td>
                                      <td style={{ fontWeight: '700', color: 'var(--color-primary)', whiteSpace: 'normal', wordBreak: 'break-word' }}>{wvof.weaving_number}</td>
                                      <td>
                                        <div style={{ fontWeight: '600' }}>#{wvof.order?.order_number || '—'}</div>
                                      </td>
                                      <td>
                                        <div>{wvof.order?.design_name || '—'}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>{wvof.order?.design_no || '—'}</div>
                                      </td>
                                      <td style={{ textAlign: 'right' }}>{Number(wvof.qty).toLocaleString()} m</td>
                                      <td style={{ textAlign: 'right' }}>{Number(totalPlanned).toLocaleString()} m</td>
                                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#047857' }}>{Number(totalOk).toLocaleString()} m</td>
                                      <td>
                                        <div style={{ fontSize: '0.7rem' }}>
                                          <span>Plan: {wvof.start_date} to {wvof.end_date}</span>
                                          {wvof.process_completed_at && (
                                            <div style={{ color: 'var(--text-muted-current)' }}>
                                              Actual: {getLocalDateOnly(wvof.process_started_at)} to {getLocalDateOnly(wvof.process_completed_at)}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                      <td onClick={(e) => e.stopPropagation()}>
                                        {wvof.isBilled ? (
                                          <span style={{
                                            backgroundColor: getStatusBadgeStyle(wvof.billStatus).bg,
                                            color: getStatusBadgeStyle(wvof.billStatus).text,
                                            padding: '3px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: '700'
                                          }}>
                                            {getStatusBadgeStyle(wvof.billStatus).label}
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() => handleOpenCreateBill(wvof)}
                                            style={{
                                              backgroundColor: '#800000',
                                              color: 'white',
                                              border: 'none',
                                              padding: '4px 10px',
                                              borderRadius: '4px',
                                              fontSize: '0.7rem',
                                              fontWeight: '700',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            Create Bill
                                          </button>
                                        )}
                                      </td>
                                    </tr>

                                    {/* Expanded Row for weft yarn, daily logs, greige rolls */}
                                    {isExpanded && (
                                      <tr>
                                        <td colSpan={9} style={{ padding: '1.25rem 1.5rem', backgroundColor: 'rgba(0,0,0,0.005)', borderBottom: '1px solid var(--border-current)', overflow: 'visible' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                                            {/* Table of weft yarn delivered and returned */}
                                            <div>
                                              <h4 style={{ margin: '0 0 0.50rem 0', fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-current)', textTransform: 'uppercase' }}>Weft Yarn Delivered & Returned</h4>
                                              <table className="wv-compact-table" style={{ backgroundColor: 'white', border: '1px solid var(--border-current)' }}>
                                                <thead>
                                                  <tr>
                                                    <th style={{ textAlign: 'left' }}>Colour</th>
                                                    <th style={{ textAlign: 'left' }}>Yarn Count</th>
                                                    <th style={{ textAlign: 'right' }}>Allotted</th>
                                                    <th style={{ textAlign: 'right' }}>Delivered</th>
                                                    <th style={{ textAlign: 'right' }}>Returned</th>
                                                    <th style={{ textAlign: 'right' }}>Balance</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {(!wvof.weft_allotments || wvof.weft_allotments.length === 0) ? (
                                                    <tr>
                                                      <td colSpan={6} style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted-current)' }}>No allotments found.</td>
                                                    </tr>
                                                  ) : (
                                                    wvof.weft_allotments.map((allot, aIdx) => {
                                                      const yc = yarnCounts.find(y => y.id === (allot.countId || allot.yarn_count_id));
                                                      const countDisplay = yc ? `${yc.count_value} ${yc.material} ${yc.product_type}` : (allot.countValue || '—');
                                                      const matchingDel = deliveries.filter(d =>
                                                        d.production_form_id === wvof.id &&
                                                        d.colour === allot.colour &&
                                                        (d.yarn_count_id === allot.countId || d.yarn_count_id === allot.yarn_count_id)
                                                      );
                                                      const deliveredQty = matchingDel.reduce((sum, d) => sum + parseFloat(d.quantity_kg || 0), 0);

                                                      // Find returned quantity
                                                      const matchingReturn = (wvof.yarn_returns || []).find(r =>
                                                        r.colour === allot.colour &&
                                                        r.yarn_count_id === (allot.countId || allot.yarn_count_id)
                                                      );
                                                      const returnedQty = parseFloat(matchingReturn?.quantity_returned || 0);
                                                      const balance = Math.max(0, deliveredQty - returnedQty);

                                                      return (
                                                        <tr key={aIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                          <td style={{ padding: '0.5rem', fontWeight: '700', color: '#800000' }}>{allot.colour || '—'}</td>
                                                          <td style={{ padding: '0.5rem' }}>{countDisplay}</td>
                                                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{parseFloat(allot.allotted_qty || allot.qty || 0).toFixed(2)}</td>
                                                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{deliveredQty.toFixed(2)}</td>
                                                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#b45309' }}>{returnedQty.toFixed(2)}</td>
                                                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{balance.toFixed(2)}</td>
                                                        </tr>
                                                      );
                                                    })
                                                  )}
                                                </tbody>
                                              </table>
                                            </div>

                                            {/* Daily Production Logs */}
                                            <div>
                                              <h4 style={{ margin: '0 0 0.50rem 0', fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-current)', textTransform: 'uppercase' }}>Daily Production Logs</h4>
                                              <div style={{ borderRadius: '8px', border: '1px solid var(--border-current)' }}>
                                                <table className="wv-compact-table">
                                                  <thead>
                                                    <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                                      <th style={{ width: '30px', padding: '0.5rem' }}></th>
                                                      <th style={{ padding: '0.5rem' }}>Date</th>
                                                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Planned (Mtrs)</th>
                                                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actual (Mtrs)</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {(() => {
                                                      let totalPlannedSum = 0;
                                                      let totalActualSum = 0;
                                                      const unifiedDates = getUnifiedProductionDates(wvof);
                                                      const rows = [];

                                                      if (unifiedDates.length === 0) {
                                                        return (
                                                          <tr>
                                                            <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                                              No production log entries found.
                                                            </td>
                                                          </tr>
                                                        );
                                                      }

                                                      unifiedDates.forEach((dateStr) => {
                                                        const d = new Date(dateStr + 'T00:00:00');
                                                        const formattedDate = !isNaN(d.getTime())
                                                          ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                                                          : dateStr;

                                                        const plannedObj = (wvof.planned_daily_production || []).find(p => p.date === dateStr);
                                                        const plannedQty = plannedObj ? parseFloat(plannedObj.qty) || 0 : 0;

                                                        const actualLogs = (wvof.production_logs || []).filter(log => getLocalDateOnly(log.timestamp) === dateStr);
                                                        const sumActual = actualLogs.reduce((sum, log) => sum + (parseFloat(log.qty) || 0), 0);

                                                        totalPlannedSum += plannedQty;
                                                        totalActualSum += sumActual;

                                                        const isDateExpanded = expandedDates[`${wvof.id}-${dateStr}`];

                                                        rows.push(
                                                          <tr
                                                            key={`row-${dateStr}`}
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              const key = `${wvof.id}-${dateStr}`;
                                                              setExpandedDates(prev => ({ ...prev, [key]: !prev[key] }));
                                                            }}
                                                            style={{ borderBottom: '1px solid var(--border-current)', cursor: 'pointer', backgroundColor: isDateExpanded ? '#fbf7f7' : 'transparent' }}
                                                          >
                                                            <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                                                              {isDateExpanded ? <ChevronDown size={11} style={{ color: '#800000' }} /> : <ChevronRight size={11} />}
                                                            </td>
                                                            <td style={{ padding: '0.5rem', fontWeight: '600' }}>{formattedDate}</td>
                                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{plannedQty > 0 ? `${plannedQty.toLocaleString()} m` : '—'}</td>
                                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{sumActual > 0 ? `${sumActual.toLocaleString()} m` : '—'}</td>
                                                          </tr>
                                                        );

                                                        if (isDateExpanded) {
                                                          rows.push(
                                                            <tr key={`details-${dateStr}`} style={{ backgroundColor: '#fffdfd', borderBottom: '1px solid var(--border-current)' }}>
                                                              <td colSpan="4" style={{ padding: '0.5rem 1rem 0.5rem 2rem' }}>
                                                                <div style={{ border: '1px solid #fecdd3', borderRadius: '6px', overflow: 'hidden' }}>
                                                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                                                                    <thead>
                                                                      <tr style={{ backgroundColor: '#ffe4e6', borderBottom: '1px solid #fecdd3', textAlign: 'left' }}>
                                                                        <th style={{ padding: '0.3rem 0.5rem', color: '#be123c' }}>Time</th>
                                                                        <th style={{ padding: '0.3rem 0.5rem', color: '#be123c' }}>Weaver</th>
                                                                        <th style={{ padding: '0.3rem 0.5rem', color: '#be123c', textAlign: 'right' }}>Qty (Mtrs)</th>
                                                                      </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                      {actualLogs.length === 0 ? (
                                                                        <tr>
                                                                          <td colSpan="3" style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-muted-current)' }}>No production records.</td>
                                                                        </tr>
                                                                      ) : (
                                                                        actualLogs.map((log, lIdx) => (
                                                                          <tr key={log.id || lIdx} style={{ borderBottom: lIdx !== actualLogs.length - 1 ? '1px solid #fecdd3' : 'none' }}>
                                                                            <td style={{ padding: '0.3rem 0.5rem' }}>
                                                                              {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                            </td>
                                                                            <td style={{ padding: '0.3rem 0.5rem', fontWeight: '600' }}>{log.weaver}</td>
                                                                            <td style={{ padding: '0.3rem 0.5rem', fontWeight: '700', color: '#047857', textAlign: 'right' }}>{Number(log.qty).toLocaleString()} m</td>
                                                                          </tr>
                                                                        ))
                                                                      )}
                                                                    </tbody>
                                                                  </table>
                                                                </div>
                                                              </td>
                                                            </tr>
                                                          );
                                                        }
                                                      });

                                                      rows.push(
                                                        <tr key="totals" style={{ backgroundColor: '#fafafa', fontWeight: '800' }}>
                                                          <td colSpan="2" style={{ padding: '0.5rem', textAlign: 'center' }}>Total</td>
                                                          <td style={{ padding: '0.5rem', color: '#800000', textAlign: 'right' }}>{totalPlannedSum.toLocaleString()} m</td>
                                                          <td style={{ padding: '0.5rem', color: '#047857', textAlign: 'right' }}>{totalActualSum.toLocaleString()} m</td>
                                                        </tr>
                                                      );
                                                      return rows;
                                                    })()}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>

                                            {/* Table of the Greige Roll Received & 4-Point Inspection */}
                                            <div>
                                              <h4 style={{ margin: '0 0 0.50rem 0', fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-current)', textTransform: 'uppercase' }}>Received Greige Rolls & 4-Point Inspection Details</h4>
                                              <div style={{ borderRadius: '8px', border: '1px solid var(--border-current)', overflow: 'visible' }}>
                                                <table className="wv-compact-table">
                                                  <thead>
                                                    <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
                                                      <th style={{ padding: '0.5rem' }}>Received Date & Time</th>
                                                      <th style={{ padding: '0.5rem', minWidth: '180px', whiteSpace: 'nowrap' }}>Fabric Roll ID</th>
                                                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Greige Qty (m)</th>
                                                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actual Qty (m)</th>
                                                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Shortage (m)</th>
                                                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Mistakes</th>
                                                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Approved Qty (m)</th>
                                                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>QC Status</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {rolls.length === 0 ? (
                                                      <tr>
                                                        <td colSpan={8} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                                          No fabric rolls received yet.
                                                        </td>
                                                      </tr>
                                                    ) : (
                                                      rolls.map((roll, rIdx) => {
                                                        const isInspected = roll.status === '4_point_inspected' || roll.status === 'sent_to_processing' || roll.status === 'received_from_processing';
                                                        return (
                                                          <tr key={roll.id || rIdx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                            <td style={{ padding: '0.5rem' }}>
                                                              {roll.received_at ? new Date(roll.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                            </td>
                                                            <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace', fontSize: '0.72rem', wordBreak: 'break-all', whiteSpace: 'normal', maxWidth: '220px' }}>{roll.id}</td>
                                                            <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(roll.qty || 0).toLocaleString()}</td>
                                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500' }}>{roll.actual_qty !== undefined ? Number(roll.actual_qty).toLocaleString() : '—'}</td>
                                                            <td style={{ padding: '0.5rem', textAlign: 'right', color: (roll.shortage || 0) > 0 ? '#b45309' : 'inherit' }}>{roll.shortage || 0}</td>
                                                            <td style={{ padding: '0.5rem', textAlign: 'right', color: (roll.mistake || 0) > 0 ? '#b91c1c' : 'inherit' }}>{roll.mistake || 0}</td>
                                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#166534' }}>{roll.approved_qty !== undefined ? Number(roll.approved_qty).toLocaleString() : '—'}</td>
                                                            <td className="qc-overflow-visible" style={{ padding: '0.5rem', textAlign: 'center', overflow: 'visible', position: 'relative' }}>
                                                              {isInspected ? (
                                                                <div className="qc-tooltip-trigger" style={{ display: 'inline-block' }}>
                                                                  <span style={{
                                                                    backgroundColor: '#ecfdf5', color: '#047857',
                                                                    padding: '2px 8px', borderRadius: '4px',
                                                                    fontSize: '0.7rem', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                                                    cursor: 'help'
                                                                  }}>
                                                                    ✔️ Inspected
                                                                  </span>
                                                                  <div className="qc-tooltip-content" style={{
                                                                    display: 'none', position: 'absolute', right: '105%', top: '50%', transform: 'translateY(-50%)',
                                                                    backgroundColor: '#1e293b', color: 'white', padding: '0.75rem 1rem', borderRadius: '8px',
                                                                    width: '280px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
                                                                    zIndex: 1000, fontSize: '0.72rem', textAlign: 'left', lineHeight: '1.4', fontStyle: 'normal',
                                                                    border: '1px solid #334155'
                                                                  }}>
                                                                    <div style={{ borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '6px', fontWeight: '800', color: '#38bdf8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                      <span>🔍 4-Point QC Details</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#94a3b8' }}>Greige Qty:</span>
                                                                        <strong style={{ color: 'white' }}>{roll.qty} m</strong>
                                                                      </div>
                                                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#94a3b8' }}>Actual Qty:</span>
                                                                        <strong style={{ color: 'white' }}>{roll.actual_qty || '—'} m</strong>
                                                                      </div>
                                                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#94a3b8' }}>Shortage:</span>
                                                                        <strong style={{ color: (roll.shortage || 0) > 0 ? '#fbbf24' : '#34d399' }}>{roll.shortage || 0} m</strong>
                                                                      </div>
                                                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#94a3b8' }}>Mistakes:</span>
                                                                        <strong style={{ color: '#f87171' }}>{roll.mistake || 0} m</strong>
                                                                      </div>
                                                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#94a3b8' }}>Approved Qty:</span>
                                                                        <strong style={{ color: '#34d399' }}>{roll.approved_qty || 0} m</strong>
                                                                      </div>
                                                                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #334155', paddingTop: '4px', marginTop: '2px' }}>
                                                                        <span style={{ color: '#94a3b8' }}>Inspectors:</span>
                                                                        <strong style={{ color: 'white' }}>{roll.inspector_1 || '—'} {roll.inspector_2 ? `& ${roll.inspector_2}` : ''}</strong>
                                                                      </div>
                                                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#94a3b8' }}>Fitter:</span>
                                                                        <strong style={{ color: 'white' }}>{roll.attended_fitter || '—'}</strong>
                                                                      </div>
                                                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#94a3b8' }}>Result:</span>
                                                                        <strong style={{ color: roll.roll_ok ? '#34d399' : '#f87171' }}>{roll.roll_ok ? '🟢 OK' : '🔴 Defects'}</strong>
                                                                      </div>
                                                                      {!roll.roll_ok && roll.warp_comments?.length > 0 && (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px dashed #334155', paddingTop: '2px' }}>
                                                                          <span style={{ color: '#f87171', fontSize: '0.65rem', fontWeight: '700' }}>Warp:</span>
                                                                          <span style={{ color: '#e2e8f0', fontSize: '0.65rem' }}>{roll.warp_comments.join(', ')}</span>
                                                                        </div>
                                                                      )}
                                                                      {!roll.roll_ok && roll.weft_comments?.length > 0 && (
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                          <span style={{ color: '#f87171', fontSize: '0.65rem', fontWeight: '700' }}>Weft:</span>
                                                                          <span style={{ color: '#e2e8f0', fontSize: '0.65rem' }}>{roll.weft_comments.join(', ')}</span>
                                                                        </div>
                                                                      )}
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                              ) : (
                                                                <span style={{
                                                                  backgroundColor: '#fee2e2', color: '#b91c1c',
                                                                  padding: '2px 8px', borderRadius: '4px',
                                                                  fontSize: '0.7rem', fontWeight: '800'
                                                                }}>
                                                                  ❌ Pending QC
                                                                </span>
                                                              )}
                                                            </td>
                                                          </tr>
                                                        );
                                                      })
                                                    )}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>

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
                    )}

                    {activeSubTab === 'bills' && (
                      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
                        {/* Submitted Bills Table */}
                        <table className="wv-fin-table" style={{ tableLayout: 'auto', width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '40px' }} />
                              <th>Date</th>
                              <th>Bill Number</th>
                              <th>WVOF Number</th>
                              <th>Order Number</th>
                              <th>Design Name & Number</th>
                              <th style={{ textAlign: 'right' }}>Qty</th>
                              <th style={{ textAlign: 'right' }}>Actual Qty</th>
                              <th style={{ textAlign: 'right' }}>OK Qty</th>
                              <th style={{ textAlign: 'right' }}>Calc Total</th>
                              <th style={{ textAlign: 'right' }}>Inv Subtotal</th>
                              <th style={{ textAlign: 'right' }}>Inv Total</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {partnerFilteredBills.length === 0 ? (
                              <tr>
                                <td colSpan={14} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                                  No bills found for this partner/filter.
                                </td>
                              </tr>
                            ) : (
                              partnerFilteredBills.map(bill => {
                                const isExpanded = expandedBillId === bill.id;
                                const badge = getStatusBadgeStyle(bill.status);
                                const billItem = bill.bill_items?.[0] || {};

                                const wvofNumbers = (bill.bill_items || []).map(item => item.form_number || item.weaving_number).filter(Boolean).join(', ');
                                const orderNumbers = Array.from(new Set((bill.bill_items || []).map(item => item.order_number).filter(Boolean))).join(', ');
                                const designs = Array.from(new Set((bill.bill_items || []).map(item => `${item.design_no || ''} ${item.design_name || ''}`.trim()).filter(Boolean))).join(', ');

                                const plannedQty = (bill.bill_items || []).reduce((sum, item) => sum + (parseFloat(item.planned_qty || item.totals?.planned_qty || 0)), 0);
                                const actualQty = (bill.bill_items || []).reduce((sum, item) => sum + (parseFloat(item.totals?.actual_qty || item.actual_qty || 0)), 0);
                                const okQty = (bill.bill_items || []).reduce((sum, item) => sum + (parseFloat(item.totals?.ok_qty || item.actual_qty || 0)), 0);

                                return (
                                  <React.Fragment key={bill.id}>
                                    <tr
                                      onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <td style={{ textAlign: 'center' }}>
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </td>
                                      <td style={{ fontWeight: '500', fontSize: '0.72rem' }}>{bill.invoice_date || new Date(bill.created_at).toLocaleDateString('en-IN')}</td>
                                      <td style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.72rem' }}>{bill.bill_number}</td>
                                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{wvofNumbers || '—'}</td>
                                      <td style={{ fontSize: '0.72rem' }}>{orderNumbers || '—'}</td>
                                      <td style={{ fontSize: '0.72rem', whiteSpace: 'normal' }}>{designs || '—'}</td>
                                      <td style={{ textAlign: 'right', fontSize: '0.72rem' }}>{Number(plannedQty).toLocaleString()} m</td>
                                      <td style={{ textAlign: 'right', fontSize: '0.72rem' }}>{Number(actualQty).toLocaleString()} m</td>
                                      <td style={{ textAlign: 'right', fontSize: '0.72rem', fontWeight: '700', color: '#047857' }}>{Number(okQty).toLocaleString()} m</td>
                                      <td style={{ textAlign: 'right', fontWeight: '500', fontSize: '0.72rem' }}>₹{Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td style={{ textAlign: 'right', fontWeight: '500', fontSize: '0.72rem' }}>₹{Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--color-primary)', fontSize: '0.72rem' }}>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      <td>
                                        <span style={{
                                          backgroundColor: badge.bg, color: badge.text,
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.68rem',
                                          fontWeight: '700'
                                        }}>
                                          {badge.label}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                        <button
                                          onClick={() => printFinanceBill(bill)}
                                          style={{
                                            backgroundColor: '#f1f5f9',
                                            border: '1px solid var(--border-current)',
                                            borderRadius: '6px',
                                            padding: '3px 6px',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: '700',
                                            color: '#475569'
                                          }}
                                        >
                                          <Printer size={11} /> Print
                                        </button>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.008)' }}>
                                        <td colSpan={14} style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--color-primary)', borderBottom: '1px solid var(--border-current)', overflow: 'visible', whiteSpace: 'normal' }}>
                                          <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontWeight: '800', fontSize: '0.85rem' }}>Billed Weaving Order Form Details</h4>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem', backgroundColor: 'white', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.75rem' }}>
                                            <div>WVOF Number: <strong>{billItem.form_number}</strong></div>
                                            <div>Order Number: <strong>{billItem.order_number}</strong></div>
                                            <div>Design Name/No: <strong>{billItem.design_no} / {billItem.design_name}</strong></div>
                                            <div>Reed / Pick: <strong>{billItem.reed} / {billItem.pick}</strong></div>
                                            <div>Pick Rate: <strong>₹{billItem.pick_rate}</strong></div>
                                            <div>Rate / Meter: <strong>₹{parseFloat(billItem.rate_per_meter).toFixed(2)}</strong></div>
                                            <div>Billed Qty: <strong>{Number(billItem.actual_qty).toLocaleString()} m</strong></div>
                                            <div>Calculated Cost: <strong>₹{Number(billItem.calculated_total).toLocaleString()}</strong></div>
                                          </div>
                                          {bill.admin_notes && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: '#f1f5f9', borderLeft: '3px solid #64748b', borderRadius: '4px' }}>
                                              <strong>Admin Notes:</strong> {bill.admin_notes}
                                            </div>
                                          )}
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
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Bill Creation Modal */}
      {isModalOpen && (selectedWvof || isManualSelect) && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10000,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', width: '100%',
            maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
            padding: '1.75rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
          }} className="fade-in">

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🏭</span> {selectedWvof ? `Create Weaving Bill for ${selectedWvof.weaving_number}` : 'Create Weaving Bill'}
              </h3>
              <button
                onClick={handleCloseModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted-current)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Manual Partner & WVOF Selectors */}
            {isManualSelect && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.25rem',
                backgroundColor: 'rgba(128, 0, 0, 0.02)',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px dashed var(--border-current)'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Select Partner
                  </label>
                  <select
                    value={selectedPartnerId}
                    onChange={handlePartnerChange}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-current)',
                      backgroundColor: 'white',
                      fontSize: '0.8rem',
                      fontWeight: '600'
                    }}
                  >
                    <option value="">-- Choose Partner --</option>
                    {partnersWithCompletedUnbilled.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {partnersWithCompletedUnbilled.length === 0 && (
                      <option disabled>No partners with unbilled completed orders</option>
                    )}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Select Completed Weaving Form (WVOF)
                  </label>
                  <select
                    value={selectedWvofId}
                    onChange={handleWvofChange}
                    disabled={!selectedPartnerId}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-current)',
                      backgroundColor: !selectedPartnerId ? '#f1f5f9' : 'white',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: !selectedPartnerId ? 'not-allowed' : 'default'
                    }}
                  >
                    <option value="">-- Choose Weaving Form --</option>
                    {unbilledWvofsForSelectedPartner.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.weaving_number} (Order: #{o.order?.order_number || '—'} - Design: {o.order?.design_no || '—'})
                      </option>
                    ))}
                    {unbilledWvofsForSelectedPartner.length === 0 && (
                      <option disabled>No unbilled completed forms available</option>
                    )}
                  </select>
                </div>
              </div>
            )}

            {selectedWvof ? (
              <>
                {/* WVOF Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', fontSize: '0.78rem', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-current)', marginBottom: '1.25rem' }}>
                  <div>WVOF: <strong>{selectedWvof.weaving_number}</strong></div>
                  <div>Order No: <strong>{selectedWvof.order?.order_number || '—'}</strong></div>
                  <div>Design Name/No: <strong>{selectedWvof.order?.design_no} / {selectedWvof.order?.design_name}</strong></div>
                  <div>Planned Qty: <strong>{Number(selectedWvof.qty).toLocaleString()} m</strong></div>
                  <div>Partner Name: <strong>{selectedWvof.partner_name || '—'}</strong></div>
                  <div>Construction Specs: <strong>{selectedWvof.order?.technical_specs ? `${selectedWvof.order.technical_specs.on_loom_reed || '—'} / ${selectedWvof.order.technical_specs.on_loom_pick || '—'}` : '—'}</strong></div>
                </div>

                {/* Rolls & QC details table */}
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase' }}>Greige Roll Input Details</h4>
                <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(0,0,0,0.01)', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                        <th style={{ padding: '0.5rem' }}>Date & Time</th>
                        <th style={{ padding: '0.5rem' }}>Roll ID</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Greige Qty (m)</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Actual Qty (m)</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Shortage (m)</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Mistakes (m)</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>OK Qty (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const { totalPlanned, totalActual, totalShortage, totalMistakes, totalOk, rolls } = getWvofRollTotals(selectedWvof);
                        return (
                          <>
                            {rolls.map((roll, idx) => (
                              <tr key={roll.id || idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                <td style={{ padding: '0.5rem' }}>{roll.received_at ? new Date(roll.received_at).toLocaleDateString('en-IN') : '—'}</td>
                                <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: '600' }}>{roll.id}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(roll.qty || 0).toLocaleString()}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{roll.actual_qty !== undefined ? Number(roll.actual_qty).toLocaleString() : '—'}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: '#b45309' }}>{roll.shortage || 0}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: '#b91c1c' }}>{roll.mistake || 0}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: '#166534' }}>{roll.approved_qty !== undefined ? Number(roll.approved_qty).toLocaleString() : '—'}</td>
                              </tr>
                            ))}
                            <tr style={{ backgroundColor: '#fafafa', fontWeight: '800' }}>
                              <td colSpan="2" style={{ padding: '0.5rem', textAlign: 'center' }}>Total</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{totalPlanned.toLocaleString()}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{totalActual.toLocaleString()}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: '#b45309' }}>{totalShortage.toLocaleString()}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: '#b91c1c' }}>{totalMistakes.toLocaleString()}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: '#166534' }}>{totalOk.toLocaleString()}</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Inputs & Form */}
                <form onSubmit={handleSubmitBill}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Reed</label>
                      <input
                        type="number"
                        value={reed}
                        onChange={e => setReed(e.target.value)}
                        placeholder="Enter reed value"
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.78rem' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Pick</label>
                      <input
                        type="number"
                        value={pick}
                        onChange={e => setPick(e.target.value)}
                        placeholder="Enter pick value"
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.78rem' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Pick Rate (₹ / pick)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={pickRate}
                        onChange={e => setPickRate(e.target.value)}
                        placeholder="e.g. 0.15"
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.78rem' }}
                        required
                      />
                    </div>
                  </div>

                  {/* Calculations Preview */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', backgroundColor: '#f0fdf4', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.78rem', marginBottom: '1.5rem' }}>
                    <div>Rate / Meter: <strong style={{ color: '#166534' }}>₹{calculatedValues.ratePerMeter.toFixed(4)}</strong></div>
                    <div>OK Qty Total: <strong>{calculatedValues.totalOk.toLocaleString()} m</strong></div>
                    <div>Calculated Total: <strong style={{ color: '#166534', fontSize: '0.85rem' }}>₹{calculatedValues.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                  </div>

                  {/* Invoice & Tax settings */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Invoice Number</label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        disabled
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.78rem', backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Invoice Date</label>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={e => setInvoiceDate(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.78rem' }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Claimed Invoice Subtotal (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={invoiceSubtotal}
                        onChange={e => setInvoiceSubtotal(e.target.value)}
                        placeholder="Must not exceed Calculated Total"
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.78rem' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Tax Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={taxAmount}
                        onChange={e => setTaxAmount(e.target.value)}
                        placeholder="GST / Surcharges"
                        style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.78rem' }}
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#475569' }}>Gross Total (Subtotal + Tax)</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--color-primary)' }}>₹{calculatedValues.grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>

                  {validationError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0.75rem', borderRadius: '6px', color: '#991b1b', fontSize: '0.78rem', fontWeight: '600', marginBottom: '1.25rem' }}>
                      <AlertCircle size={16} />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {/* Submit Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-current)', paddingTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="btn btn-secondary"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting || !!validationError}
                      style={{ fontWeight: '700' }}
                    >
                      {submitting ? 'Submitting...' : 'Submit for Approval'}
                    </button>
                  </div>

                </form>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={{
                  textAlign: 'center',
                  padding: '3rem 1.5rem',
                  color: 'var(--text-muted-current)',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid var(--border-current)',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏭</div>
                  <strong>Please select a Partner and Weaving Form (WVOF) above to populate the bill details.</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-current)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View WVOF Info Modal */}
      {showWvofDetails && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 10000,
          padding: '1.5rem'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', width: '100%',
            maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto',
            padding: '1.5rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>Weaving Order details: {showWvofDetails.weaving_number}</h3>
              <button onClick={() => setShowWvofDetails(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.78rem', marginBottom: '1.5rem' }}>
              <div>WVOF Number: <strong>{showWvofDetails.weaving_number}</strong></div>
              <div>Order Number: <strong>{showWvofDetails.order?.order_number || '—'}</strong></div>
              <div>Design: <strong>{showWvofDetails.order?.design_no} / {showWvofDetails.order?.design_name}</strong></div>
              <div>Planned Quantity: <strong>{Number(showWvofDetails.qty).toLocaleString()} m</strong></div>
              <div>Partner: <strong>{showWvofDetails.partner_name || '—'}</strong></div>
              <div>Machine/Loom: <strong>{showWvofDetails.machine_name || '—'}</strong></div>
              <div>Status: <strong>{showWvofDetails.status}</strong></div>
              <div>Planned Dates: <strong>{showWvofDetails.start_date} to {showWvofDetails.end_date}</strong></div>
            </div>

            <h4 style={{ margin: '0 0 0.50rem 0', fontSize: '0.8rem', fontWeight: '800' }}>Weft Allotments</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid var(--border-current)' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(0,0,0,0.01)', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                  <th style={{ padding: '0.5rem' }}>Colour</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Allotted Qty (kg)</th>
                </tr>
              </thead>
              <tbody>
                {(!showWvofDetails.weft_allotments || showWvofDetails.weft_allotments.length === 0) ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-muted-current)' }}>No allotments configured.</td>
                  </tr>
                ) : (
                  showWvofDetails.weft_allotments.map((allot, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: '600' }}>{allot.colour}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{parseFloat(allot.allotted_qty || allot.qty || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setShowWvofDetails(null)} className="btn btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── All Bills Finances Tab Component ──────────────────────────────
function AllBillsFinancesTab() {
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBillId, setExpandedBillId] = useState(null);

  const fetchAllBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_finance_bills')
        .select('*')
        .in('status', ['awaiting_approval', 'approved', 'settled'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error('Error fetching all bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllBills();
  }, []);

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'awaiting_approval':
        return { bg: '#fef3c7', text: '#92400e', label: 'AWAITING APPROVAL' };
      case 'approved':
        return { bg: '#dcfce7', text: '#166534', label: 'APPROVED' };
      case 'settled':
        return { bg: '#dbeafe', text: '#1e40af', label: 'SETTLED' };
      case 'rejected':
        return { bg: '#fee2e2', text: '#991b1b', label: 'REJECTED' };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: (status || '').toUpperCase() };
    }
  };

  const uniquePartners = useMemo(() => {
    const partners = new Set();
    bills.forEach(b => {
      if (b.partner_name) partners.add(b.partner_name);
    });
    return Array.from(partners).sort();
  }, [bills]);

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      if (selectedPartner !== 'all' && bill.partner_name !== selectedPartner) {
        return false;
      }
      if (selectedType !== 'all' && bill.form_type !== selectedType) {
        return false;
      }
      if (selectedStatus !== 'all' && bill.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const billNum = (bill.bill_number || '').toLowerCase();
        const invNum = (bill.invoice_number || '').toLowerCase();
        const partnerName = (bill.partner_name || '').toLowerCase();
        if (!billNum.includes(q) && !invNum.includes(q) && !partnerName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [bills, selectedPartner, selectedType, selectedStatus, searchQuery]);

  const handleResetFilters = () => {
    setSelectedPartner('all');
    setSelectedType('all');
    setSelectedStatus('all');
    setSearchQuery('');
  };

  const getProcessTypeBadgeStyle = (type) => {
    switch (type) {
      case 'warping':
        return { bg: '#e0f2fe', text: '#0369a1', label: 'WARPING' };
      case 'sizing':
        return { bg: '#f3e8ff', text: '#6b21a8', label: 'SIZING' };
      case 'weaving':
        return { bg: '#fee2e2', text: '#991b1b', label: 'WEAVING' };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: (type || '').toUpperCase() };
    }
  };

  const renderBillDetails = (bill) => {
    const isWeaving = bill.form_type === 'weaving';
    const isSizing = bill.form_type === 'sizing';
    const isWarping = bill.form_type === 'warping';

    return (
      <div style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)', overflow: 'visible', whiteSpace: 'normal', backgroundColor: 'rgba(128,0,0,0.005)' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontWeight: '800', fontSize: '0.85rem', textTransform: 'uppercase' }}>
          Billed {bill.form_type} Order Details
        </h4>
        {isWeaving ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(bill.bill_items || []).map((billItem, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', backgroundColor: 'white', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-current)', fontSize: '0.75rem' }}>
                <div>WVOF Number: <strong>{billItem.form_number}</strong></div>
                <div>Order Number: <strong>{billItem.order_number}</strong></div>
                <div>Design Name/No: <strong>{billItem.design_no} / {billItem.design_name}</strong></div>
                <div>Reed / Pick: <strong>{billItem.reed} / {billItem.pick}</strong></div>
                <div>Pick Rate: <strong>₹{billItem.pick_rate}</strong></div>
                <div>Rate / Meter: <strong>₹{parseFloat(billItem.rate_per_meter || 0).toFixed(2)}</strong></div>
                <div>Billed Qty: <strong>{Number(billItem.actual_qty).toLocaleString()} m</strong></div>
                <div>Calculated Cost: <strong>₹{Number(billItem.calculated_total).toLocaleString()}</strong></div>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', marginBottom: '1rem', border: '1px solid var(--border-current)', backgroundColor: 'white' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: '700', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>{isWarping ? 'WOF' : 'SOF'} Number</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Order Number</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Design (No / Name)</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)' }}>Actual Dates</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'center' }}>Timeliness</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Qty (m)</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Rate / Meter</th>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-current)', textAlign: 'right' }}>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {(bill.bill_items || []).map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border-current)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace' }}>{item.form_number}</td>
                  <td style={{ padding: '0.5rem' }}>{item.order_number}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <div>{item.design_no}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted-current)' }}>{item.design_name}</div>
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <span style={{
                      backgroundColor: '#dcfce7',
                      color: '#166534',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      textTransform: 'uppercase'
                    }}>
                      {item.status || 'completed'}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: '0.7rem' }}>
                    {item.actual_start_date ? new Date(item.actual_start_date).toLocaleDateString('en-GB') : '—'} to {item.actual_end_date ? new Date(item.actual_end_date).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <span style={{
                      backgroundColor: item.timeliness_status === 'late' ? '#fee2e2' : '#dcfce7',
                      color: item.timeliness_status === 'late' ? '#991b1b' : '#166534',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      fontSize: '0.65rem',
                      fontWeight: '700'
                    }}>
                      {item.timeliness_status === 'late' ? 'LATE' : 'ON TIME'}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500' }}>{Number(item.actual_qty || item.total_meters || 0).toLocaleString()}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{Number(item.rate_per_meter || item.warping_rate || item.sizing_rate || 0).toFixed(2)}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{Number(item.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {bill.admin_notes && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: '#f1f5f9', borderLeft: '3px solid #64748b', borderRadius: '4px' }}>
            <strong>Admin Notes:</strong> {bill.admin_notes}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <Loader size={28} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      {/* Search & Filter Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by Bill No, Invoice No, Partner..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1',
            minWidth: '240px',
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--border-current)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            backgroundColor: 'white',
            color: 'var(--text-main-current)'
          }}
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            border: '1px solid ' + (showFilters ? 'var(--color-primary)' : 'var(--border-current)'),
            backgroundColor: showFilters ? 'rgba(128, 0, 0, 0.05)' : 'white',
            color: showFilters ? 'var(--color-primary)' : 'var(--text-main-current)',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <SlidersHorizontal size={16} />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Expandable/Collapsible Filters panel */}
      {showFilters && (
        <div style={{
          backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.25rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.25rem'
        }} className="fade-in">
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '4px' }}>Job-Work Partner</label>
            <select
              value={selectedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                border: '1px solid var(--border-current)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                backgroundColor: 'white'
              }}
            >
              <option value="all">All Partners</option>
              {uniquePartners.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '4px' }}>Process Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                border: '1px solid var(--border-current)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                backgroundColor: 'white'
              }}
            >
              <option value="all">All Processes</option>
              <option value="warping">Warping</option>
              <option value="sizing">Sizing</option>
              <option value="weaving">Weaving</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', marginBottom: '4px' }}>Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem',
                border: '1px solid var(--border-current)',
                borderRadius: '6px',
                fontSize: '0.8rem',
                backgroundColor: 'white'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="awaiting_approval">Awaiting Approval</option>
              <option value="approved">Approved</option>
              <option value="settled">Settled</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
            <button
              onClick={handleResetFilters}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer',
                padding: '0.45rem 0',
                textDecoration: 'underline'
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Bills Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="wv-fin-table" style={{ tableLayout: 'auto', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '40px' }} />
              <th>Date</th>
              <th>Bill Number</th>
              <th>Partner Name</th>
              <th>Process</th>
              <th>Forms (WOF/SOF/WVOF)</th>
              <th>Order Number</th>
              <th style={{ textAlign: 'right' }}>Calc Total</th>
              <th style={{ textAlign: 'right' }}>Tax</th>
              <th style={{ textAlign: 'right' }}>Invoice Total</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                  No bills found matching filters.
                </td>
              </tr>
            ) : (
              filteredBills.map(bill => {
                const isExpanded = expandedBillId === bill.id;
                const statusBadge = getStatusBadgeStyle(bill.status);
                const typeBadge = getProcessTypeBadgeStyle(bill.form_type);
                const forms = (bill.bill_items || []).map(item => item.form_number || item.wof_number || item.sof_number || item.weaving_number).filter(Boolean).join(', ');
                const orderNumbers = Array.from(new Set((bill.bill_items || []).map(item => item.order_number).filter(Boolean))).join(', ');

                return (
                  <React.Fragment key={bill.id}>
                    <tr
                      onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                      style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-current)', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.01)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ textAlign: 'center' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td style={{ fontWeight: '500', fontSize: '0.72rem' }}>{bill.invoice_date || new Date(bill.created_at).toLocaleDateString('en-IN')}</td>
                      <td style={{ fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: '0.72rem' }}>{bill.bill_number}</td>
                      <td style={{ fontWeight: '600', fontSize: '0.72rem' }}>{bill.partner_name}</td>
                      <td>
                        <span style={{
                          backgroundColor: typeBadge.bg,
                          color: typeBadge.text,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: '800'
                        }}>
                          {typeBadge.label}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{forms || '—'}</td>
                      <td style={{ fontSize: '0.72rem' }}>{orderNumbers || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: '500', fontSize: '0.72rem' }}>₹{Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted-current)', fontSize: '0.72rem' }}>₹{Number(bill.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--color-primary)', fontSize: '0.72rem' }}>₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>
                        <span style={{
                          backgroundColor: statusBadge.bg,
                          color: statusBadge.text,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.68rem',
                          fontWeight: '700'
                        }}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => printFinanceBill(bill)}
                          style={{
                            backgroundColor: '#f1f5f9',
                            border: '1px solid var(--border-current)',
                            borderRadius: '6px',
                            padding: '3px 6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            color: '#475569'
                          }}
                        >
                          <Printer size={11} /> Print
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={12} style={{ padding: 0 }}>
                          {renderBillDetails(bill)}
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
    </div>
  );
}

// ── Print Finance Bill Helper ────────────────────────────────────
async function printFinanceBill(bill) {
  let submitterName = '—';
  let approverName = '—';

  try {
    if (bill.submitted_by) {
      const { data: subData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', bill.submitted_by)
        .single();
      if (subData?.full_name) submitterName = subData.full_name;
    }
    if (bill.approved_by) {
      const { data: appData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', bill.approved_by)
        .single();
      if (appData?.full_name) approverName = appData.full_name;
    }
  } catch (err) {
    console.error('Error fetching profiles for print:', err);
  }

  // Format the dates
  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const invoiceDateStr = bill.invoice_date
    ? new Date(bill.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  // Build the print content
  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocker is enabled. Please allow pop-ups to print the bill.');
    return;
  }

  const isWeaving = bill.form_type === 'weaving';
  const isSizing = bill.form_type === 'sizing';
  const isWarping = bill.form_type === 'warping';

  // Generate table rows based on form_type
  let tableHeaderHTML = '';
  let tableBodyHTML = '';
  let billedDetailsHTML = '';

  if (isWeaving) {
    let weavingContentHTML = '';
    (bill.bill_items || []).forEach((item) => {
      const rollsList = item.fabric_rolls || [];
      const rollsRows = rollsList.map((roll, rIdx) => {
        const inspectorNames = [roll.inspector_1, roll.inspector_2].filter(Boolean).join(' & ') || '—';
        return `
          <tr>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold; word-break: break-all; white-space: normal;">${roll.id || `Roll ${rIdx + 1}`}</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Number(roll.qty || 0).toLocaleString()} m</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: right;">${roll.actual_qty !== undefined ? Number(roll.actual_qty).toLocaleString() : '—'} m</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${parseFloat(roll.shortage || 0) > 0 ? '#b45309' : 'inherit'};">${roll.shortage || 0} m</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${parseInt(roll.mistake || 0) > 0 ? '#b91c1c' : 'inherit'};">${roll.mistake || 0}</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #166534;">${roll.approved_qty !== undefined ? Number(roll.approved_qty).toLocaleString() : '—'} m</td>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; text-align: left; word-break: break-word; white-space: normal;">${inspectorNames}</td>
          </tr>
        `;
      }).join('');

      weavingContentHTML += `
        <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: white; text-align: left;">
          <div style="background-color: #fafafa; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 11px;">
              <div>WVOF Number: <strong style="font-family: monospace; color: #800000;">${item.form_number}</strong></div>
              <div>Order Number: <strong>${item.order_number}</strong></div>
              <div>Design Name/No: <strong>${item.design_no} / ${item.design_name}</strong></div>
              <div>Reed / Pick: <strong>${item.reed || '—'} / ${item.pick || '—'}</strong></div>
              <div>Pick Rate: <strong>₹${item.pick_rate || '0'}</strong></div>
              <div>Rate / Meter: <strong>₹${parseFloat(item.rate_per_meter || 0).toFixed(2)}</strong></div>
            </div>
          </div>
          <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 0; font-size: 11px;">
            <thead>
              <tr style="background-color: #800000; color: white;">
                <th style="width: 35%; padding: 8px 6px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; word-break: break-all; white-space: normal;">Greige Roll ID</th>
                <th style="width: 11%; padding: 8px 6px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase;">Qty (planned)</th>
                <th style="width: 11%; padding: 8px 6px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase;">Actual Qty</th>
                <th style="width: 9%; padding: 8px 6px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase;">Shortage</th>
                <th style="width: 8%; padding: 8px 6px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase;">Mistakes</th>
                <th style="width: 10%; padding: 8px 6px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase;">OK Qty</th>
                <th style="width: 16%; padding: 8px 6px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; word-break: break-word; white-space: normal;">Inspector Names</th>
              </tr>
            </thead>
            <tbody>
              ${rollsRows || `<tr><td colSpan="7" style="text-align: center; padding: 10px; color: #888;">No rolls associated.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    });
    billedDetailsHTML = weavingContentHTML;
  } else {
    tableHeaderHTML = `
      <tr>
        <th style="padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase;">${isWarping ? 'WOF' : 'SOF'} Number</th>
        <th style="padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase;">Order Number</th>
        <th style="padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase;">Design (No / Name)</th>
        <th style="padding: 8px 10px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase;">Status</th>
        <th style="padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase;">Actual Dates</th>
        <th style="padding: 8px 10px; text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase;">Timeliness</th>
        <th style="padding: 8px 10px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase;">Qty (m)</th>
        <th style="padding: 8px 10px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase;">Rate / Meter</th>
        <th style="padding: 8px 10px; text-align: right; font-size: 10px; font-weight: 700; text-transform: uppercase;">Total Cost</th>
      </tr>
    `;
    tableBodyHTML = (bill.bill_items || []).map(item => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-weight: bold;">${item.form_number}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">${item.order_number}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">${item.design_no} / ${item.design_name}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; text-transform: uppercase;">${item.status || 'completed'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb;">
          ${item.actual_start_date ? new Date(item.actual_start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'} to 
          ${item.actual_end_date ? new Date(item.actual_end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; color: ${item.timeliness_status === 'late' ? '#b91c1c' : '#166534'}">
          ${item.timeliness_status === 'late' ? 'LATE' : 'ON TIME'}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${Number(item.actual_qty || item.total_meters || 0).toLocaleString()}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">₹${Number(item.rate_per_meter || item.warping_rate || item.sizing_rate || 0).toFixed(2)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">₹${Number(item.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('');
    billedDetailsHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px;">
        <thead>
          ${tableHeaderHTML}
        </thead>
        <tbody>
          ${tableBodyHTML}
        </tbody>
      </table>
    `;
  }

  // Approved seal styling
  let sealHTML = '';
  if (bill.status === 'approved' || bill.status === 'settled') {
    const statusText = bill.status.toUpperCase();
    const sealColor = bill.status === 'settled' ? '#1e40af' : '#166534';
    const approvedDateStr = bill.approved_at
      ? new Date(bill.approved_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : todayStr;

    sealHTML = `
      <div class="approved-seal" style="position: absolute; right: 220px; top: 0px; width: 180px; padding: 10px; border: 4px double ${sealColor}; color: ${sealColor}; border-radius: 8px; text-align: center; font-family: 'Arial Black', Impact, sans-serif; transform: rotate(-8deg); background: rgba(255,255,255,0.9); box-shadow: 0 0 8px rgba(0,0,0,0.05); z-index: 100;">
        <div class="seal-status" style="font-size: 18px; font-weight: 900; letter-spacing: 0.05em;">${statusText}</div>
        <div class="seal-by" style="font-size: 9px; font-weight: bold; margin-top: 4px;">BY: ${approverName.toUpperCase()}</div>
        <div class="seal-date" style="font-size: 9px; font-weight: bold;">ON: ${approvedDateStr}</div>
      </div>
    `;
  }

  win.document.write(`
    <html>
      <head>
        <title>BILL INVOICE - ${bill.bill_number}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Arial', sans-serif; color: #111; background: white; padding: 30px; }
          
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #800000; padding-bottom: 16px; margin-bottom: 24px; position: relative; }
          .logo-block { display: flex; align-items: center; gap: 12px; }
          .logo-box { width: 48px; height: 48px; background: #800000; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 900; }
          .company-name { font-size: 22px; font-weight: 900; color: #1e1b4b; }
          .company-sub { font-size: 11px; color: #800000; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
          
          .bill-title { text-align: right; }
          .bill-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; font-weight: 700; }
          .bill-number { font-size: 18px; font-weight: 900; color: #800000; font-family: monospace; margin-top: 2px; }
          
          .info-section { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 24px; }
          .info-block { border: 1px solid #e5e7eb; padding: 12px 16px; border-radius: 8px; background-color: #fafafa; }
          .info-block-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #800000; margin-bottom: 8px; border-bottom: 1px dashed rgba(128,0,0,0.15); padding-bottom: 4px; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 11px; }
          .info-item { display: flex; flex-direction: column; gap: 2px; }
          .info-item label { color: #666; font-weight: 600; font-size: 9px; text-transform: uppercase; }
          .info-item span { font-weight: 700; color: #111; font-size: 12px; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; }
          th { background: #800000; color: white; padding: 8px 10px; text-align: left; font-size: 9px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }
          td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) td { background: rgba(128,0,0,0.015); }
          
          .totals-section { display: flex; justify-content: flex-end; margin-bottom: 32px; }
          .totals-table { width: 320px; font-size: 12px; border-collapse: collapse; }
          .totals-table td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
          .totals-table tr.grand-total td { border-top: 2px solid #800000; border-bottom: 2px double #800000; font-weight: 900; font-size: 14px; color: #800000; }
          
          .admin-notes-box { border-left: 3px solid #64748b; background-color: #f1f5f9; padding: 10px 14px; border-radius: 4px; font-size: 11px; margin-bottom: 32px; }
          
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 10px; }
          .sig-line { border-top: 1px solid #333; width: 150px; padding-top: 4px; font-size: 10px; color: #555; text-align: center; margin-top: 40px; }
          
          .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px dashed #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-block">
            <img src="/logo.png" alt="" style="max-height: 50px; max-width: 150px; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div style="display: none; align-items: center; gap: 8px;">
              <div class="logo-box">AT</div>
              <div>
                <div class="company-name">Ashok Textiles</div>
                <div class="company-sub">Fabric ERP System</div>
              </div>
            </div>
          </div>
          
          <div class="bill-title">
            <div class="bill-label">Finance Bill Invoice</div>
            <div class="bill-number">${bill.bill_number}</div>
          </div>
          
          ${sealHTML}
        </div>
        
        <div class="info-section">
          <div class="info-block">
            <div class="info-block-title">Bill Specifications</div>
            <div class="info-grid">
              <div class="info-item"><label>Partner Name</label><span>${bill.partner_name || '—'}</span></div>
              <div class="info-item"><label>Process Type</label><span style="text-transform: uppercase;">${bill.form_type}</span></div>
              <div class="info-item"><label>Bill Number</label><span>${bill.bill_number}</span></div>
              <div class="info-item"><label>Created At</label><span>${new Date(bill.created_at).toLocaleDateString('en-IN')}</span></div>
            </div>
          </div>
          <div class="info-block">
            <div class="info-block-title">Invoice Details</div>
            <div class="info-grid">
              <div class="info-item"><label>Invoice Number</label><span>${bill.invoice_number || '—'}</span></div>
              <div class="info-item"><label>Invoice Date</label><span>${invoiceDateStr}</span></div>
              <div class="info-item"><label>Submitted By</label><span>${submitterName}</span></div>
              <div class="info-item"><label>Status</label><span style="text-transform: uppercase;">${bill.status}</span></div>
            </div>
          </div>
        </div>
        
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: #800000; margin-bottom: 8px; border-bottom: 1px solid rgba(128,0,0,0.15); padding-bottom: 4px;">
          Billed Form Details
        </div>
        ${billedDetailsHTML}
        
        <div class="totals-section">
          <table class="totals-table">
            <tr>
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Calculated Subtotal:</td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">₹${Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Claimed Invoice Subtotal:</td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">₹${Number(bill.invoice_subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Tax / GST Amount:</td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">₹${Number(bill.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr class="grand-total">
              <td style="padding: 6px 8px; border-top: 2px solid #800000; border-bottom: 2px double #800000; font-weight: 900; font-size: 14px; color: #800000;">Invoice Total (Gross):</td>
              <td style="padding: 6px 8px; border-top: 2px solid #800000; border-bottom: 2px double #800000; font-weight: 900; font-size: 14px; color: #800000; text-align: right;">₹${Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          </table>
        </div>
        
        ${bill.admin_notes ? `
          <div class="admin-notes-box">
            <strong>Admin Notes/Remarks:</strong><br/>
            ${bill.admin_notes}
          </div>
        ` : ''}
        
        <div class="signatures">
          <div>
            <div class="sig-line">Prepared/Submitted By</div>
          </div>
          <div>
            <div class="sig-line">Verified By (Accounts)</div>
          </div>
          <div>
            <div class="sig-line">Approved By (Admin)</div>
          </div>
        </div>
        
        <div class="footer">
          Generated by AT Fabric ERP • ${todayStr}
        </div>
      </body>
    </html>
  `);

  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 350);
}

// ── Weaving Date Helpers ──────────────────────────────────────────
function getLocalDateOnly(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getUnifiedProductionDates(wvof) {
  const datesSet = new Set();
  if (wvof.planned_daily_production && Array.isArray(wvof.planned_daily_production)) {
    wvof.planned_daily_production.forEach(p => {
      if (p.date) datesSet.add(p.date);
    });
  }
  if (wvof.production_logs && Array.isArray(wvof.production_logs)) {
    wvof.production_logs.forEach(log => {
      const dStr = getLocalDateOnly(log.timestamp);
      if (dStr) datesSet.add(dStr);
    });
  }
  return Array.from(datesSet).sort();
}
