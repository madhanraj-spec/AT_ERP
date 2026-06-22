import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Package, Zap, ArrowRight, Clock, CheckCircle, AlertCircle } from 'lucide-react';

const modules = [
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
    available: false,
  },
  {
    id: 'weaving',
    title: 'Weaving Order Form',
    description: 'Issue weaving order forms to loom operators, assign sized beams to looms, and monitor fabric production progress.',
    icon: Zap,
    color: '#10b981',
    lightColor: 'rgba(16,185,129,0.08)',
    path: '/production/weaving-forms',
    available: false,
  },
];

export default function ProductionHub() {
  const navigate = useNavigate();


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

// === GAP: lines 101 to 171 missing ===

                    </span>
                  ))}
                </div>
              )}

              {/* CTA */}
              {mod.available ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: mod.color,
                  fontWeight: '700',
                  fontSize: '0.875rem'
                }}>
                  Open Module <ArrowRight size={16} />
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#94a3b8',
                  fontWeight: '600',
                  fontSize: '0.875rem'
                }}>
                  <Clock size={15} /> Under Development
                </div>
              )}
            </div>
          );
        })}
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

          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem
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

// === GAP: lines 301 to 319 missing ===

  return (
    <div className="fade-in">
      {/* Header with Back button */}
      <div style={{ marginBottom: '1.5rem' }}>
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
      }} className="hide-scrollbar">
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
            {tab.label}
          </button>
        ))}
      </div>

      {/* Render selected tab panel */}
      {activeTab === 'warping' && <WarpingOverseeTab />}
      {activeTab === 'sizing' && <SizingOverseeTab />}
      {activeTab === 'weaving' && <WeavingOverseeTab />}
      {activeTab === 'inspection' && <InspectionOverseeTab />}
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
          { id: 'weaving', label: '🏭 Weaving' }
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
      {activeTab === 'weaving' && (
        <div style={{ 
          padding: '2.5rem', 
          backgroundColor: 'var(--surface-current)', 
          border: '1px solid var(--border-current)', 
          borderRadius: '12px', 
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          minHeight: '220px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏭</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-current)', fontWeight: '800' }}>Weaving Finances</h3>
            <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Weaving loom rate settlements and daily production cost accounting will be designed here.</p>
          </div>
        </div>
      )}
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
  const [dydrs, setDydrs] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
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
  }, [wofs, selWofNos, selOrderNos, selDates, selWarpers, selMachi
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {isFilterExpanded && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem', padding: '1rem', backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
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

      {/* Data Table */}
      {loading ? (

// === GAP: lines 596 to 596 missing ===

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

// === GAP: lines 621 to 696 missing ===

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

        `)
        .eq('sizing_type', 'in_house')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

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
                   
      return true;
    });
    return Array.from(new Set(matched.map(s => s.order?.order_number || '—').filter(Boolean))).sort();
  }, [sofs, selSofNos, selWofRefs, selDates, selMachines]);

// === GAP: lines 826 to 831 missing ===

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
      if (selOrderNos.length > 0 && !selOrderNos.includes(s.order?.order_number || '—')) return false;
      const dateStr = getLocalDateString(s.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      const machName = s.machine_name || '—';
      if (selMachines.length > 0 && !selMachines.includes(machName)) return false;
      return true;
    });
    return Array.from(new Set(matche

// === GAP: lines 889 to 895 missing ===

          border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
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
      if (selOrderNos.length > 0 && !selOrderNos.includes(s.order?.order_number || '—')) return false;
      const dateStr = getLocalDateString(s.start_date);
      if (selDates.length > 0 && !selDates.includes(dateStr)) return false;
      return true;
    });
    return Array.from(new Set(matched.map(s => s.machine_name || '—').filter(Boolean))).sort();
  }, [sofs, selSofNos, selWofRefs, selOrderNos, selDates]);

  const summary = useMemo(() => {
    const uniqueSofs = new Set(filtered.map(s => s.sof_number).filter(Boolean)).size;
    const uniqueDays = new Set(filtered.map(s => getLocalDateString(s.start_date)).filter(Boolean)).size;
    const totalQty = filtered.reduce((acc, s) => acc + Number(s.qty || 0), 0);
    return { uniqueSofs, uniqueDays, totalQty };
  }, [filtered]);
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
          >
            <RefreshCw size={14} />
                                        <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-current)', textAlign: 'left' }}>
        </div>
      </div>

      {isFilterExpanded && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem', padding: '1rem', backgroundColor: 'var(--surface-current)',
          border: '1px solid var(--border-current)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
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

      {/* Data Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }}>
          No completed sizing forms found.
        </div>
      ) : (

// === GAP: lines 1011 to 1099 missing ===

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
       

// === GAP: lines 1119 to 1134 missing ===

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

// === GAP: lines 1151 to 1197 missing ===


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="fade-in">
      {/* Filters bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
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
              style={{ border: '1px solid var(--border-current)', borderRadius: '6px', padding: '0.2rem 0.4rem', fontSize: '0.75rem', b

// === GAP: lines 1222 to 1255 missing ===

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

      {/* Data Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={24} className="spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }}>
          No loom daily production records match your selection.
        </div>
      ) : (

// === GAP: lines 1280 to 1294 missing ===

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
      if (selOrd

// === GAP: lines 1356 to 1359 missing ===

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

// === GAP: lines 1386 to 1388 missing ===

            />
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
        }}>
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

      {/* Data Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
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

// === GAP: lines 1461 to 1499 missing ===

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
      if (selWvofs.length > 0 && !selWvofs.includes(i.wvof))

// === GAP: lines 1524 to 1547 missing ===

      if (selMachines.length > 0 && !selMachines.includes(i.machine)) return false;
      if (selWvofs.length > 0 && !selWvofs.includes(i.wvof)) return false;
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
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-current)', borderRadius: '8px', background: 'var(--surface-current)' }} className="hide-s
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
              col

// === GAP: lines 1598 to 1600 missing ===

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

// === GAP: lines 1621 to 1629 missing ===

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
                <th style={{ padding: '0.75rem 0.5rem' }}>Weaving Form (WVOF)</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Order Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Design Name/No</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Inspector</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>QC Status</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Approved Qty (m)</th>
              </tr>

// === GAP: lines 1651 to 1749 missing ===

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

        const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
        rolls.forEach(r => {
          if (r.status === '4_point_inspected') {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="fade-in print-report
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

      {/* Data Table */}

// === GAP: lines 1911 to 1926 missing ===

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
            Inspection Days
          </span>

// === GAP: lines 2016 to 2016 missing ===

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
                <th style={{ padding: '0.75rem 0.5rem' }}>Weaving Form (WVOF)</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Order Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Design Name/No</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Inspector</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>QC Status</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Approved Qty (m)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => {
                const isExp
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
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: '800', color: '#800000', fontFamily: 'monospace' }}>{i.wvof}</td>
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
                              <span style={{ display: 'block', fontSize: '0.7r

// === GAP: lines 2118 to 2129 missing ===

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

// === GAP: lines 2151 to 2239 missing ===

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
                    display: 'flex', 
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
         
              borderRadius: '12px', 
         
    <style>{`
      @media print {
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
          min-height: 0 !important;
          overflow: visible !important;
          display: block !important;
          box-shadow: none !important;
          border: none !important;
        }
        /* Hide UI components during print */
        .no-print, 
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
        .from('production_fin
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
  };

  const toggleWofSelection = (wofId) => {
    setSelectedWofIds(prev => {

// === GAP: lines 2503 to 2519 missing ===

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


// === GAP: lines 2641 to 2699 missing ===

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
              <tr style={{ borderBottom: '2px solid var(--border-current)', 

// === GAP: lines 2729 to 2739 missing ===

                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          display: 'inline-block'
                        }}>
                          {statusStyle.label}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.005)' }}>
                        <td colSpan={9} style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)' }}>
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
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
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

// === GAP: lines 2831 to 2849 missing ===

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
                          background: 'var(--sur
                      <div 
                        onClick
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
          
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Enter Rates Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Enter Rates for Warping Forms</label>
                            </span>
                          ))
                        )}
                        <ChevronDown size={14} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)', pointerEvents: 'none' }} />
                      </div>

                      {isWofDropdownOpen && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setIsWofDropdownOpen(false)} />
                          <div style={{ 
                            position: 'absolute', 
                            top: '100%', 
                            left: 0, 
                            right: 0, 
                            backgroundColor: 'var(--surface-current)', 
                            border: '1px solid var(--border-current)', 
                            borderRadius: '8px', 
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', 
                            maxHeight: '250px', 
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
                                          style={{ accentColor: '#800000', cursor: 'poin
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
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Enter Rates Table */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Enter Rates for Warping Forms</label>
                    <div style={{ border: '1px solid var(--border-current)', borderRadius: '10px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'rgba(0,0,0,0.015)', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                            <th style={{ padding: '0.5rem' }}>WOF Number</th>
                            <th style={{ padding: '0.5rem' }}>Design Name</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center' }}>WOF Status</th>
                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Qty (m)</th>
                            <th style={{ padding: '0.5rem', textAlign: 'center', width: '150px' }}>Rate / Meter (₹)</th>
                            <th style={{ padding: '
                          </tr>
                        </thead>
                        <tbody>
                          {selectedWofsObjects.map(w
                        </thead>
                        <tbody>
                          {selectedWofsObjects.map(wof => {
                            const qty = parseFloat(wof.qty) || 0;
                            const rate = wofRates[wof.id] || '';
                            const rowTotal = qty * (parseFloat(rate) || 0);
                            return (
                              <tr key={wof.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                <td style={{ padding: '0.5rem', fontWeight: '700', fontFamily: 'monospace' }}>{wof.wof_number}</td>
                                <td style={{ padding: '0.5rem' }}>{wof.order?.design_name || '—'}</td>
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
                                      borderRadius: '6px',
                                      fontSize: '0.8rem',
                                      textAlign: 'center',
                                      backgroundColor: 'var(--surface-current)',
                                      color: 'var(--text-current)'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </tr>
                            );
                          })}
                          <tr style={{ backgroundColor: 'rgba(0,0,0,0.01)', fontWeight: '800' }}>
                            <td colSpan={3} style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Calculated Subtotal:</td>
                            <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{selectedWofsObjects.reduce((sum, w) => sum + (parseFloat(w.qty) || 0), 0).toLocaleString()}</td>
                            <td />
                            <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: '#800000', fontSize: '0.85rem' }}>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Invoice Form Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', backgroundColor: 'rgba(0,0,0,0.01)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-current)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Inv
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
                        style={{
                          padding: '0.5rem 0.75rem',
                          border: '1px solid ' + (parsedSubtotal > calculatedTotal ? '#ef4444' : 'var(--border-current)'),
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          backgroundColor: 'var(--surface-current)',
                          color: parsedSubtotal > calculatedTotal ? '#ef4444' : 'var(--text-current)',
                          fontWeight: '700'
                        }}
                      />
                      {parsedSubtotal > calculatedTotal && (
                        <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: '600' }}>Must not exceed calculated ₹{calculatedTotal.toFixed(2)}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Tax Amount (CGST/SGST/IGST)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 250.00"
                        value={taxAmount}
                        onChange={e => setTaxAmount(e.target.value)}
                        style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', backgroundColor: 'var(--surface-current)', color: 'var(--text-current)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Bill Number (System Generated)</span>
                      <span style={{ fontSize: '0.825rem', fontWeight: '700', color: 'var(--text-current)', fontFamily: 'monospace' }}>
                        {availablePartners.find(p => p.id === selectedPartnerId)?.name || 'Partner'}/{invoiceNumber || 'INV'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted-current)', textTransform: 'uppercase' }}>Grand Total</span>
                      <span style={{ fontSize: '1rem', fontWeight: '800', color: '#800000' }}>
                        ₹{invoiceTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
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

// === GAP: lines 3231 to 3265 missing ===

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
        .from('production_fina

// === GAP: lines 3359 to 3379 missing ===

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


// === GAP: lines 3465 to 3678 missing ===

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
                <th style={{ padding: '0.75rem 0.5rem' }}>Bill Number</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Partner Name</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Invoice Details</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Calculated Subtotal</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Invoice Subtotal</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Tax Amount</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Invoice Total</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(bill => {
                const isExpanded = expandedBillId === bill.id;
                const statusStyle = getStatusBadgeStyle(bill.status);
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
                          {statusStyle.label}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'rgba(128,0,0,0.005)' }}>
                        <td colSpan={9} style={{ padding: '1.25rem 1.5rem', borderLeft: '3px solid #800000', borderBottom: '1px solid var(--border-current)' }}>
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
                                    {item.actual_start_date ? new Date(item.actual_start_date).toLocaleDateString('en-GB') : '—'} to {item.actual_end_date ? new Date(item.actual_end_date).toLocaleDateStri

// === GAP: lines 3761 to 3765 missing ===

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

// === GAP: lines 3801 to 3976 missing ===

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
                        <div style={{ fontSize: '1.1rem', f

// === GAP: lines 4027 to 4169 missing ===

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


// === GAP: lines 4230 to 4380 missing ===

          table-layout: auto !important;
          font-size: 8.5px !important; /* Tighter font size for 9-10 columns */
          color: #000 !important;
          margin-top: 0.75rem !important;
          background-color: #fff !important;
        }
        th, td {
          border: 0.5px solid #000 !important; /* Clean thin black borders */
          padding: 4px 5px !important; /* Tight padding to maximize space */
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
  const [showWvofDetails, setShowWvofDetails] = useState(null);

  // Bill Creation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWvof, setSelectedWvof] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [reed, setReed] = useState('');
  const [pick, setPick] = useState('');
  const [pickRate, setPickRate] = useState('');
  const [invoiceSubtotal, setInvoice

// === GAP: lines 4432 to 4954 missing ===


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
                                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-current)' }}>

// === GAP: lines 4976 to 4978 missing ===

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
                                            
                   

// === GAP: lines 5020 to 5473 missing ===

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
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-001"
                    style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid var(--border-current)', borderRadius: '6px', fontSize: '0.78rem' }}
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

// === GAP: lines 5525 to 5613 missing ===

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

