import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus, ArrowLeft, Search, Loader, Trash2,
  ChevronDown, ChevronRight, Package, Layers,
  CheckCircle, QrCode, X, Camera, Truck,
  ArrowRight, Info, Edit, RefreshCw, Archive
} from 'lucide-react';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtNum = (n, dec = 2) =>
  isNaN(parseFloat(n)) ? '0.00' : parseFloat(n).toFixed(dec);

function cleanScannerInput(str) {
  if (!str) return '';
  return str.replace(/[^\x20-\x7E]/g, '').trim();
}

function getFormattedRollStatus(roll, tabType, dispatchedRollIdsSet = new Set()) {
  const rollIdClean = String(roll.id || '').toLowerCase();
  const processedIdClean = String(roll.processed_roll_id || '').toLowerCase();
  const isDispatchedInSlip = (rollIdClean && dispatchedRollIdsSet.has(rollIdClean)) ||
                             (processedIdClean && dispatchedRollIdsSet.has(processedIdClean)) ||
                             roll.dispatched === true ||
                             String(roll.status || '').toLowerCase() === 'dispatched';

  if (tabType === 'greige') {
    const s = String(roll.status || '').toLowerCase();
    if (s === 'greige received') {
      return { label: 'GREIGE', bg: '#dbeafe', color: '#1e40af' };
    }
    if (s === '4_point_inspected') {
      return { label: '4 POINT INSPECTED', bg: '#dcfce7', color: '#166534' };
    }
    if (s === 'sent_to_processing' || s === 'received_from_processing') {
      return { label: 'SENT TO POF', bg: '#fef3c7', color: '#92400e' };
    }
    return { label: (roll.status || 'GREIGE').toUpperCase().replace(/_/g, ' '), bg: '#f3f4f6', color: '#4b5563' };
  } else {
    // Processed tab
    if (isDispatchedInSlip) {
      return { label: 'DISPATCHED', bg: '#dcfce7', color: '#166534' };
    }
    if (roll.washed_inspected === true || String(roll.status || '').toLowerCase() === 'washed_inspected') {
      return { label: 'WASHED INSPECTED', bg: '#d1fae5', color: '#047857' };
    }
    return { label: 'POF RECEIVED', bg: '#f3e8ff', color: '#7c3aed' };
  }
}

// ─────────────────────────────────────────────
// Hub Card Component
// ─────────────────────────────────────────────
function HubCard({ icon: Icon, title, subtitle, accent, onClick, stat }) {
  return (
    <div
      onClick={onClick}
      className="hover-lift"
      style={{
        backgroundColor: 'white',
        border: '1px solid var(--border-current)',
        borderRadius: '18px',
        padding: '1.75rem',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.1rem',
        boxShadow: 'var(--shadow-md)',
        transition: 'all 0.3s ease-in-out',
        position: 'relative',
        overflow: 'hidden',
        borderTop: `3px solid ${accent}`
      }}
    >
      <div style={{
        position: 'absolute', right: '-18px', bottom: '-18px',
        opacity: 0.04, color: accent
      }}>
        <Icon size={130} />
      </div>
      <div style={{
        width: '52px', height: '52px', borderRadius: '14px',
        backgroundColor: accent + '14',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent
      }}>
        <Icon size={26} />
      </div>
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-current)', margin: 0, marginBottom: '0.3rem' }}>
          {title}
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted-current)', margin: 0 }}>{subtitle}</p>
      </div>
      {stat !== undefined && (
        <div style={{ fontSize: '1.5rem', fontWeight: '900', color: accent }}>{stat}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function FabricStockInventory() {
  const { profile } = useAuth();
  const [view, setView] = useState('hub'); // hub | create_fso | fso_list | fso_detail | allot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Data
  const [fsoList, setFsoList] = useState([]);
  const [orders, setOrders] = useState([]);
  const [weavingOrders, setWeavingOrders] = useState([]);
  const [processingOrders, setProcessingOrders] = useState([]);
  const [packageSlips, setPackageSlips] = useState([]);
  const [stockItems, setStockItems] = useState([]);

  // Create FSO form
  const [selectedSourceOrderId, setSelectedSourceOrderId] = useState('');
  const [customDesignName, setCustomDesignName] = useState('');
  const [customDesignNo, setCustomDesignNo] = useState('');
  const [fsoNotes, setFsoNotes] = useState('');
  const [rollsToAdd, setRollsToAdd] = useState([]);
  const [scanInput, setScanInput] = useState('');
  const [activeRollTab, setActiveRollTab] = useState('greige'); // 'greige' | 'processed'

  // FSO Detail
  const [selectedFso, setSelectedFso] = useState(null);
  const [expandedFso, setExpandedFso] = useState({});

  // Allotment
  const [selectedStockRolls, setSelectedStockRolls] = useState([]);
  const [allotTargetOrderId, setAllotTargetOrderId] = useState('');
  const [showAllotModal, setShowAllotModal] = useState(false);
  const [targetOrderSearch, setTargetOrderSearch] = useState('');
  const [fsoRollSearch, setFsoRollSearch] = useState({});
  const [isTargetOrderDropdownOpen, setIsTargetOrderDropdownOpen] = useState(false);
  const targetOrderDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (targetOrderDropdownRef.current && !targetOrderDropdownRef.current.contains(event.target)) {
        setIsTargetOrderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Stats
  const [stats, setStats] = useState({ totalFsos: 0, totalInStock: 0, totalAllotted: 0 });

  // Scanner ref
  const scanInputRef = useRef(null);

  // ─── Data Fetching ───
  const fetchFsoList = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('fabric_stock_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (!err && data) setFsoList(data);
  }, []);

  const fetchStockItems = useCallback(async (fsoId) => {
    let query = supabase.from('fabric_stock_inventory').select('*');
    if (fsoId) query = query.eq('fso_id', fsoId);
    query = query.order('created_at', { ascending: false });
    const { data, error: err } = await query;
    if (!err && data) setStockItems(data);
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, order_number, design_no, design_name, total_quantity, status, buyer_po_number')
      .order('created_at', { ascending: false });

    const { data: piData } = await supabase
      .from('proforma_invoices')
      .select('order_id, invoice_number');

    const piMap = {};
    (piData || []).forEach(pi => {
      if (pi.order_id) {
        if (!piMap[pi.order_id]) piMap[pi.order_id] = [];
        piMap[pi.order_id].push(pi.invoice_number);
      }
    });

    const enriched = (ordersData || []).map(o => ({
      ...o,
      pi_numbers: (piMap[o.id] || []).join(', ')
    }));

    setOrders(enriched);
  }, []);

  const fetchWeavingOrders = useCallback(async (orderId) => {
    let query = supabase
      .from('weaving_orders')
      .select('id, weaving_number, order_id, fabric_rolls, status, order:orders(id, order_number, design_no, design_name)');
    if (orderId) query = query.eq('order_id', orderId);
    const { data } = await query;
    if (data) setWeavingOrders(data);
  }, []);

  const fetchProcessingOrders = useCallback(async (orderId) => {
    let query = supabase
      .from('processing_orders')
      .select('id, pof_number, fabric_rolls, received_rolls, status, weaving_order_ids');
    if (orderId) {
      // Filter POFs that belong to weaving orders of this order
      const { data: wvofs } = await supabase
        .from('weaving_orders')
        .select('id')
        .eq('order_id', orderId);
      if (wvofs && wvofs.length > 0) {
        const wvofIds = wvofs.map(w => w.id);
        query = query.overlaps('weaving_order_ids', wvofIds);
      }
    }
    const { data } = await query;
    if (data) setProcessingOrders(data);
  }, []);

  const fetchPackageSlips = useCallback(async (orderId) => {
    if (!orderId) {
      setPackageSlips([]);
      return;
    }
    const { data } = await supabase
      .from('dispatch_package_slips')
      .select('id, slip_number, status, items')
      .eq('order_id', orderId);
    if (data) setPackageSlips(data);
  }, []);

  const [existingStockRollIds, setExistingStockRollIds] = useState(new Set());

  const fetchExistingStockRolls = useCallback(async (orderId) => {
    if (!orderId) {
      setExistingStockRollIds(new Set());
      return;
    }
    const { data } = await supabase
      .from('fabric_stock_inventory')
      .select('original_roll_id, roll_id')
      .eq('original_order_id', orderId);

    if (data) {
      const set = new Set();
      data.forEach(item => {
        if (item.original_roll_id) set.add(String(item.original_roll_id).toLowerCase());
        if (item.roll_id) set.add(String(item.roll_id).toLowerCase());
      });
      setExistingStockRollIds(set);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    const [fsoRes, stockRes, allottedRes] = await Promise.all([
      supabase.from('fabric_stock_orders').select('id', { count: 'exact', head: true }),
      supabase.from('fabric_stock_inventory').select('id', { count: 'exact', head: true }).eq('status', 'in_stock'),
      supabase.from('fabric_stock_inventory').select('id', { count: 'exact', head: true }).eq('status', 'allotted')
    ]);
    setStats({
      totalFsos: fsoRes.count || 0,
      totalInStock: stockRes.count || 0,
      totalAllotted: allottedRes.count || 0
    });
  }, []);

  useEffect(() => {
    fetchFsoList();
    fetchOrders();
    fetchStats();
  }, []);

  // ─── Source Order Selection → Load Rolls ───
  const sourceOrder = useMemo(() => orders.find(o => o.id === selectedSourceOrderId), [orders, selectedSourceOrderId]);

  const handleSelectSourceOrder = async (orderId) => {
    setSelectedSourceOrderId(orderId);
    setRollsToAdd([]);
    if (orderId) {
      const selected = orders.find(o => o.id === orderId);
      if (selected) {
        setCustomDesignName(selected.design_name || '');
        setCustomDesignNo(selected.design_no || '');
      }
      await fetchWeavingOrders(orderId);
      await fetchProcessingOrders(orderId);
      await fetchPackageSlips(orderId);
      await fetchExistingStockRolls(orderId);
    } else {
      setCustomDesignName('');
      setCustomDesignNo('');
      setPackageSlips([]);
      setExistingStockRollIds(new Set());
    }
  };

  // Build set of dispatched roll IDs from package slips
  const dispatchedRollIdsSet = useMemo(() => {
    const set = new Set();
    packageSlips.forEach(slip => {
      const s = String(slip.status || '').toLowerCase();
      if (['dispatched', 'in_transit', 'delivered'].includes(s)) {
        const items = Array.isArray(slip.items) ? slip.items : [];
        items.forEach(item => {
          if (item.roll_id) {
            set.add(String(item.roll_id).toLowerCase());
          }
        });
      }
    });
    return set;
  }, [packageSlips]);

  // Build available rolls from weaving_orders (greige) and processing_orders (processed)
  const availableGreigeRolls = useMemo(() => {
    const rolls = [];
    weavingOrders.forEach(wv => {
      const fabricRolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
      fabricRolls.forEach(roll => {
        const rollIdClean = String(roll.id || '').toLowerCase();
        // Validation: skip if already added to a stock order
        if (roll.status === 'moved_to_stock' || existingStockRollIds.has(rollIdClean)) {
          return;
        }
        if (!roll.isProcessed && !(roll.id && /\/P\d+/i.test(roll.id))) {
          if (['greige received', '4_point_inspected', 'sent_to_processing', 'received_from_processing'].includes(roll.status)) {
            rolls.push({
              ...roll,
              roll_type: 'greige',
              wvof_number: wv.weaving_number,
              wvof_id: wv.id,
              order_number: wv.order?.order_number,
              design_no: wv.order?.design_no,
              design_name: wv.order?.design_name,
              order_id: wv.order_id
            });
          }
        }
      });
    });
    return rolls;
  }, [weavingOrders, existingStockRollIds]);

  const availableProcessedRolls = useMemo(() => {
    const rolls = [];
    processingOrders.forEach(pof => {
      const rxRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
      rxRolls.forEach(roll => {
        const rollIdClean = String(roll.id || '').toLowerCase();
        // Validation: skip if already added to a stock order
        if (roll.status === 'moved_to_stock' || existingStockRollIds.has(rollIdClean)) {
          return;
        }
        rolls.push({
          ...roll,
          roll_type: 'processed',
          pof_number: pof.pof_number,
          pof_id: pof.id
        });
      });
    });
    return rolls;
  }, [processingOrders, existingStockRollIds]);

  const allAvailableRolls = useMemo(() => {
    const combined = [...availableGreigeRolls, ...availableProcessedRolls];
    if (activeRollTab === 'greige') return combined.filter(r => r.roll_type === 'greige');
    if (activeRollTab === 'processed') return combined.filter(r => r.roll_type === 'processed');
    return combined;
  }, [availableGreigeRolls, availableProcessedRolls, activeRollTab]);

  // ─── Roll Scanning ───
  const handleScanRoll = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const scannedId = cleanScannerInput(scanInput);
      if (!scannedId) return;

      const found = allAvailableRolls.find(r => r.id?.toLowerCase() === scannedId.toLowerCase());
      if (found) {
        if (!rollsToAdd.find(r => r.id?.toLowerCase() === scannedId.toLowerCase())) {
          setRollsToAdd(prev => [...prev, found]);
          setSuccessMsg(`Roll ${scannedId} added`);
          setTimeout(() => setSuccessMsg(''), 2000);
        } else {
          setError(`Roll ${scannedId} already added`);
          setTimeout(() => setError(''), 2000);
        }
      } else {
        setError(`Roll ${scannedId} not found in this order`);
        setTimeout(() => setError(''), 2000);
      }
      setScanInput('');
    }
  };

  const toggleRollSelection = (roll) => {
    const exists = rollsToAdd.find(r => r.id === roll.id);
    if (exists) {
      setRollsToAdd(prev => prev.filter(r => r.id !== roll.id));
    } else {
      setRollsToAdd(prev => [...prev, roll]);
    }
  };

  const selectAllRolls = () => {
    setRollsToAdd([...allAvailableRolls]);
  };

  const clearAllRolls = () => {
    setRollsToAdd([]);
  };

  // ─── Create FSO ───
  const handleCreateFso = async () => {
    if (!selectedSourceOrderId || rollsToAdd.length === 0) {
      setError('Please select an order and add at least one roll');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const year = new Date().getFullYear();
      const { data: fsoNumData, error: fsoNumErr } = await supabase.rpc('get_next_fso_number', { p_year: year });
      if (fsoNumErr) throw fsoNumErr;

      const fsoNumber = fsoNumData;
      const totalMeters = rollsToAdd.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || r.meters || 0), 0);

      // Insert FSO
      const { data: fsoData, error: fsoErr } = await supabase
        .from('fabric_stock_orders')
        .insert({
          fso_number: fsoNumber,
          source_order_id: selectedSourceOrderId,
          source_order_number: sourceOrder?.order_number || '',
          design_no: customDesignNo || sourceOrder?.design_no || '',
          design_name: customDesignName || sourceOrder?.design_name || '',
          color: rollsToAdd[0]?.color || '',
          quality: '',
          total_rolls: rollsToAdd.length,
          total_meters: totalMeters,
          status: 'active',
          notes: fsoNotes,
          created_by: profile?.id
        })
        .select()
        .single();

      if (fsoErr) throw fsoErr;

      // Insert inventory items
      const inventoryItems = rollsToAdd.map(roll => ({
        fso_id: fsoData.id,
        fso_number: fsoNumber,
        inventory_order_name: fsoNumber,
        roll_id: roll.id || '',
        original_roll_id: roll.id || '',
        piece_no: roll.piece_no || '',
        roll_type: roll.roll_type || 'greige',
        original_order_id: roll.order_id || selectedSourceOrderId,
        original_order_number: roll.order_number || sourceOrder?.order_number || '',
        original_design_no: customDesignNo || roll.design_no || sourceOrder?.design_no || '',
        original_design_name: customDesignName || roll.design_name || sourceOrder?.design_name || '',
        original_wvof_number: roll.wvof_number || '',
        original_pof_number: roll.pof_number || '',
        color: roll.color || roll.colour || '',
        meters: parseFloat(roll.actual_qty || roll.qty || roll.meters || 0),
        actual_meters: parseFloat(roll.actual_qty || roll.qty || 0),
        status: 'in_stock',
        metadata: {
          original_status: roll.status,
          weaver: roll.weaver,
          loom: roll.loom,
          inspection: roll.inspection || {}
        }
      }));

      const { error: invErr } = await supabase
        .from('fabric_stock_inventory')
        .insert(inventoryItems);

      if (invErr) throw invErr;

      // Update roll status in weaving_orders to 'moved_to_stock'
      for (const roll of rollsToAdd) {
        if (roll.roll_type === 'greige' && roll.wvof_id) {
          const { data: wvof } = await supabase
            .from('weaving_orders')
            .select('fabric_rolls')
            .eq('id', roll.wvof_id)
            .single();

          if (wvof) {
            const updatedRolls = (wvof.fabric_rolls || []).map(r => {
              if (r.id === roll.id) {
                return { ...r, status: 'moved_to_stock', fso_number: fsoNumber };
              }
              return r;
            });
            await supabase
              .from('weaving_orders')
              .update({ fabric_rolls: updatedRolls })
              .eq('id', roll.wvof_id);
          }
        }
      }

      setSuccessMsg(`Fabric Stock Order ${fsoNumber} created with ${rollsToAdd.length} rolls`);
      setRollsToAdd([]);
      setSelectedSourceOrderId('');
      setFsoNotes('');
      await fetchFsoList();
      await fetchStats();
      setView('fso_list');
    } catch (err) {
      console.error('Error creating FSO:', err);
      setError('Failed to create FSO: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Delete Fabric Stock Order ───
  const handleDeleteFso = async (fso) => {
    if (!fso || !fso.id) return;

    // 1. Fetch all stock items for this FSO
    const { data: items, error: itemsErr } = await supabase
      .from('fabric_stock_inventory')
      .select('*')
      .eq('fso_id', fso.id);

    if (itemsErr) {
      alert('Failed to verify stock items: ' + itemsErr.message);
      return;
    }

    // 2. Validation: check if any roll is allotted or dispatched to a new order
    const allottedOrDispatched = (items || []).filter(item => item.status === 'allotted' || item.status === 'dispatched');
    if (allottedOrDispatched.length > 0) {
      alert(`Cannot delete Fabric Stock Order "${fso.fso_number}" because ${allottedOrDispatched.length} roll(s) have already been allotted or dispatched to another order (${allottedOrDispatched[0].allotted_order_number || ''}).`);
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete Fabric Stock Order "${fso.fso_number}"?\n\nThis will delete the stock order and release all ${items?.length || 0} roll(s) back to source order inventory.`);
    if (!confirmDelete) return;

    setLoading(true);
    setError('');
    try {
      // 3. Release rolls back in weaving_orders
      for (const item of items || []) {
        if (item.roll_type === 'greige' && (item.original_wvof_number || item.original_order_id)) {
          let query = supabase.from('weaving_orders').select('id, fabric_rolls');
          if (item.original_wvof_number) {
            query = query.eq('weaving_number', item.original_wvof_number);
          } else if (item.original_order_id) {
            query = query.eq('order_id', item.original_order_id);
          }

          const { data: wvofs } = await query;
          if (wvofs && wvofs.length > 0) {
            for (const wv of wvofs) {
              const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
              const match = rolls.find(r => r.id?.toLowerCase() === item.original_roll_id?.toLowerCase());
              if (match) {
                const origStatus = item.metadata?.original_status || '4_point_inspected';
                const updatedRolls = rolls.map(r => {
                  if (r.id?.toLowerCase() === item.original_roll_id?.toLowerCase()) {
                    const { fso_number, ...rest } = r;
                    return { ...rest, status: origStatus };
                  }
                  return r;
                });

                await supabase
                  .from('weaving_orders')
                  .update({ fabric_rolls: updatedRolls })
                  .eq('id', wv.id);
              }
            }
          }
        }
      }

      // 4. Delete inventory items and FSO record
      await supabase.from('fabric_stock_inventory').delete().eq('fso_id', fso.id);
      const { error: delErr } = await supabase.from('fabric_stock_orders').delete().eq('id', fso.id);

      if (delErr) throw delErr;

      setSuccessMsg(`Fabric Stock Order ${fso.fso_number} deleted successfully and rolls released.`);
      setTimeout(() => setSuccessMsg(''), 4000);

      // Refresh list & stats
      await fetchFsoList();
      await fetchStats();
      if (selectedSourceOrderId) {
        await fetchWeavingOrders(selectedSourceOrderId);
        await fetchProcessingOrders(selectedSourceOrderId);
        await fetchExistingStockRolls(selectedSourceOrderId);
      }
    } catch (err) {
      console.error('Error deleting FSO:', err);
      setError('Failed to delete Fabric Stock Order: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Allotment Helpers & Search ───
  const filteredTargetOrders = useMemo(() => {
    if (!targetOrderSearch.trim()) return orders;
    const q = targetOrderSearch.toLowerCase().trim();
    return orders.filter(o =>
      String(o.order_number || '').toLowerCase().includes(q) ||
      String(o.design_name || '').toLowerCase().includes(q) ||
      String(o.design_no || '').toLowerCase().includes(q) ||
      String(o.pi_numbers || '').toLowerCase().includes(q) ||
      String(o.buyer_po_number || '').toLowerCase().includes(q)
    );
  }, [orders, targetOrderSearch]);

  const selectAllStockRollsInFso = (fsoId) => {
    const fsoRolls = stockItems.filter(si => si.fso_id === fsoId && si.status === 'in_stock');
    if (fsoRolls.length === 0) return;
    setSelectedStockRolls(prev => {
      const existingIds = new Set(prev.map(r => r.id));
      const toAdd = fsoRolls.filter(r => !existingIds.has(r.id));
      return [...prev, ...toAdd];
    });
  };

  const clearStockRollsInFso = (fsoId) => {
    const fsoRollIds = new Set(stockItems.filter(si => si.fso_id === fsoId).map(r => r.id));
    setSelectedStockRolls(prev => prev.filter(r => !fsoRollIds.has(r.id)));
  };

  const handleScanOrTypeFsoRoll = (fsoId, rawVal) => {
    const q = cleanScannerInput(rawVal).toLowerCase();
    if (!q) return;
    const fsoRolls = stockItems.filter(si => si.fso_id === fsoId && si.status === 'in_stock');
    const found = fsoRolls.find(r =>
      String(r.original_roll_id || '').toLowerCase() === q ||
      String(r.roll_id || '').toLowerCase() === q ||
      String(r.piece_no || '').toLowerCase() === q
    );

    if (found) {
      if (!selectedStockRolls.some(r => r.id === found.id)) {
        setSelectedStockRolls(prev => [...prev, found]);
        setSuccessMsg(`Roll ${found.original_roll_id || found.roll_id} selected`);
        setTimeout(() => setSuccessMsg(''), 2000);
      } else {
        setError(`Roll ${found.original_roll_id || found.roll_id} is already selected`);
        setTimeout(() => setError(''), 2000);
      }
    } else {
      setError(`Roll "${rawVal}" not found in this FSO (or already allotted)`);
      setTimeout(() => setError(''), 2000);
    }
    setFsoRollSearch(prev => ({ ...prev, [fsoId]: '' }));
  };

  // ─── Allot Rolls to New Order ───
  const handleAllotRolls = async () => {
    if (selectedStockRolls.length === 0 || !allotTargetOrderId) {
      setError('Please select rolls and a target order');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const targetOrder = orders.find(o => o.id === allotTargetOrderId);
      if (!targetOrder) throw new Error('Target order not found');

      // Update each stock item
      for (const stockRoll of selectedStockRolls) {
        await supabase
          .from('fabric_stock_inventory')
          .update({
            status: 'allotted',
            allotted_order_id: allotTargetOrderId,
            allotted_order_number: targetOrder.order_number,
            allotted_design_no: targetOrder.design_no,
            allotted_design_name: targetOrder.design_name,
            allotted_at: new Date().toISOString()
          })
          .eq('id', stockRoll.id);
      }

      // Update FSO status
      const fsoIds = [...new Set(selectedStockRolls.map(r => r.fso_id))];
      for (const fsoId of fsoIds) {
        const { data: remaining } = await supabase
          .from('fabric_stock_inventory')
          .select('id')
          .eq('fso_id', fsoId)
          .eq('status', 'in_stock');

        const newStatus = (!remaining || remaining.length === 0) ? 'fully_allotted' : 'partially_allotted';
        await supabase
          .from('fabric_stock_orders')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', fsoId);
      }

      setSuccessMsg(`${selectedStockRolls.length} rolls allotted to Order ${targetOrder.order_number}`);
      setSelectedStockRolls([]);
      setAllotTargetOrderId('');
      setShowAllotModal(false);
      await fetchFsoList();
      await fetchStats();
      if (selectedFso) await fetchStockItems(selectedFso.id);
    } catch (err) {
      console.error('Error allotting rolls:', err);
      setError('Failed to allot rolls: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Toggle stock roll selection for allotment ───
  const toggleStockRollSelection = (roll) => {
    const exists = selectedStockRolls.find(r => r.id === roll.id);
    if (exists) {
      setSelectedStockRolls(prev => prev.filter(r => r.id !== roll.id));
    } else {
      setSelectedStockRolls(prev => [...prev, roll]);
    }
  };

  // ─── FSO Status Badge ───
  const getFsoStatusBadge = (status) => {
    const map = {
      active: { label: 'Active', bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
      partially_allotted: { label: 'Partially Allotted', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
      fully_allotted: { label: 'Fully Allotted', bg: '#dcfce7', color: '#166534', border: '#86efac' },
      closed: { label: 'Closed', bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' }
    };
    const s = map[status] || map.active;
    return (
      <span style={{
        fontSize: '0.7rem', fontWeight: '700',
        padding: '2px 8px', borderRadius: '6px',
        backgroundColor: s.bg, color: s.color,
        border: `1px solid ${s.border}`
      }}>{s.label}</span>
    );
  };

  // ─── Filtered FSO list ───
  const filteredFsoList = useMemo(() => {
    if (!searchTerm) return fsoList;
    const term = searchTerm.toLowerCase();
    return fsoList.filter(fso =>
      fso.fso_number?.toLowerCase().includes(term) ||
      fso.source_order_number?.toLowerCase().includes(term) ||
      fso.design_name?.toLowerCase().includes(term) ||
      fso.design_no?.toLowerCase().includes(term)
    );
  }, [fsoList, searchTerm]);

  // ─────────────────────────────────────────────
  // RENDER: Hub
  // ─────────────────────────────────────────────
  if (view === 'hub') {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#800000', margin: 0, marginBottom: '0.3rem' }}>
            Fabric Stock Inventory
          </h1>
          <p style={{ color: 'var(--text-muted-current)', fontSize: '0.85rem', margin: 0 }}>
            Store leftover fabric rolls and allot them to new orders
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <HubCard
            icon={Plus}
            title="Create Fabric Stock Order"
            subtitle="Store leftover greige or processed rolls from completed orders"
            accent="#059669"
            stat={stats.totalFsos}
            onClick={() => { setView('create_fso'); fetchOrders(); }}
          />
          <HubCard
            icon={Package}
            title="View Stock Orders"
            subtitle="Browse all Fabric Stock Orders and manage inventory"
            accent="#2563eb"
            stat={`${stats.totalInStock} rolls in stock`}
            onClick={() => { setView('fso_list'); fetchFsoList(); }}
          />
          <HubCard
            icon={ArrowRight}
            title="Allot Stock to Orders"
            subtitle="Assign leftover rolls from stock to new/repeat orders"
            accent="#7c3aed"
            stat={`${stats.totalAllotted} allotted`}
            onClick={() => { setView('allot'); fetchFsoList(); fetchOrders(); }}
          />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: Create FSO
  // ─────────────────────────────────────────────
  if (view === 'create_fso') {
    return (
      <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setView('hub')} style={{
            border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center'
          }}>
            <ArrowLeft size={20} color="#800000" />
          </button>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#800000', margin: 0 }}>
              Create Fabric Stock Order
            </h1>
            <p style={{ color: 'var(--text-muted-current)', fontSize: '0.8rem', margin: 0 }}>
              Select an order and scan/select leftover rolls to store in stock
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.82rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={16} /> {error}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.82rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}

        {/* Source Order Selection */}
        <div style={{
          backgroundColor: 'white', borderRadius: '14px', border: '1px solid var(--border-current)',
          padding: '1.25rem', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '0.75rem', color: '#800000' }}>
            1. Select Source Order & Stock Details
          </h3>
          <select
            value={selectedSourceOrderId}
            onChange={(e) => handleSelectSourceOrder(e.target.value)}
            style={{
              width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--border-current)',
              borderRadius: '8px', fontSize: '0.85rem', backgroundColor: 'white'
            }}
          >
            <option value="">-- Select Completed/Dispatched Order --</option>
            {orders.map(o => (
              <option key={o.id} value={o.id}>
                {o.order_number} — {o.design_name || o.design_no || 'N/A'}
              </option>
            ))}
          </select>
          
          {selectedSourceOrderId && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', marginBottom: '0.35rem', color: '#374151' }}>
                  Stock Order Design Name *
                </label>
                <input
                  type="text"
                  value={customDesignName}
                  onChange={(e) => setCustomDesignName(e.target.value)}
                  placeholder="Enter Design Name for Stock Order..."
                  style={{
                    width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--border-current)',
                    borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', marginBottom: '0.35rem', color: '#374151' }}>
                  Stock Order Design No
                </label>
                <input
                  type="text"
                  value={customDesignNo}
                  onChange={(e) => setCustomDesignNo(e.target.value)}
                  placeholder="Enter Design No..."
                  style={{
                    width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--border-current)',
                    borderRadius: '8px', fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>
          )}

          {sourceOrder && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
              <strong>Original Order Qty:</strong> {fmtNum(sourceOrder.total_quantity)} m
            </div>
          )}
        </div>

        {/* Roll Scanning & Selection */}
        {selectedSourceOrderId && (
          <>
            {/* Step 2: Roll Selection with 2 Tabs */}
            <div style={{
              backgroundColor: 'white', borderRadius: '14px', border: '1px solid var(--border-current)',
              padding: '1.25rem', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)'
            }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '0.75rem', color: '#800000' }}>
                2. Select Rolls from Stock
              </h3>

              {/* Sub-Tabs: Greige Rolls & Processed Rolls */}
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border-current)', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveRollTab('greige')}
                  style={{
                    padding: '0.6rem 1.25rem', border: 'none', background: 'none', cursor: 'pointer',
                    fontWeight: '800', fontSize: '0.85rem',
                    color: activeRollTab === 'greige' ? '#1e40af' : 'var(--text-muted-current)',
                    borderBottom: activeRollTab === 'greige' ? '3px solid #1e40af' : '3px solid transparent',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>Greige Rolls</span>
                  <span style={{
                    fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px',
                    backgroundColor: activeRollTab === 'greige' ? '#dbeafe' : '#f3f4f6',
                    color: activeRollTab === 'greige' ? '#1e40af' : 'var(--text-muted-current)',
                    fontWeight: '800'
                  }}>
                    {availableGreigeRolls.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRollTab('processed')}
                  style={{
                    padding: '0.6rem 1.25rem', border: 'none', background: 'none', cursor: 'pointer',
                    fontWeight: '800', fontSize: '0.85rem',
                    color: activeRollTab === 'processed' ? '#7c3aed' : 'var(--text-muted-current)',
                    borderBottom: activeRollTab === 'processed' ? '3px solid #7c3aed' : '3px solid transparent',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>Processed Rolls</span>
                  <span style={{
                    fontSize: '0.72rem', padding: '2px 8px', borderRadius: '10px',
                    backgroundColor: activeRollTab === 'processed' ? '#f3e8ff' : '#f3f4f6',
                    color: activeRollTab === 'processed' ? '#7c3aed' : 'var(--text-muted-current)',
                    fontWeight: '800'
                  }}>
                    {availableProcessedRolls.length}
                  </span>
                </button>
              </div>

              {/* Scanner Input */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <QrCode size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)' }} />
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={handleScanRoll}
                    placeholder={`Scan ${activeRollTab === 'greige' ? 'greige' : 'processed'} roll barcode / QR...`}
                    style={{
                      width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                      border: '1px solid var(--border-current)', borderRadius: '8px',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              {/* Current Tab Rolls List */}
              {(() => {
                const currentTabRolls = activeRollTab === 'greige' ? availableGreigeRolls : availableProcessedRolls;

                const selectAllTabRolls = () => {
                  const otherTabRolls = rollsToAdd.filter(r => r.roll_type !== activeRollTab);
                  setRollsToAdd([...otherTabRolls, ...currentTabRolls]);
                };

                const clearTabRolls = () => {
                  setRollsToAdd(prev => prev.filter(r => r.roll_type !== activeRollTab));
                };

                return (
                  <>
                    {/* Bulk Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <button onClick={selectAllTabRolls} style={{
                        padding: '0.4rem 0.75rem', border: '1px solid #059669', borderRadius: '6px',
                        background: 'none', color: '#059669', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                      }}>Select All {activeRollTab === 'greige' ? 'Greige' : 'Processed'} ({currentTabRolls.length})</button>
                      <button onClick={clearTabRolls} style={{
                        padding: '0.4rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '6px',
                        background: 'none', color: 'var(--text-muted-current)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                      }}>Clear {activeRollTab === 'greige' ? 'Greige' : 'Processed'}</button>
                    </div>

                    <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-current)', borderRadius: '8px' }}>
                      {currentTabRolls.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted-current)', fontSize: '0.82rem' }}>
                          No available {activeRollTab === 'greige' ? 'greige' : 'processed'} rolls found for this order
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--border-current)' }}>
                              <th style={{ padding: '0.5rem', textAlign: 'center', width: '40px' }}>✓</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Roll ID</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>{activeRollTab === 'greige' ? 'WVOF' : 'POF'}</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Qty (m)</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentTabRolls.map((roll, idx) => {
                              const isSelected = rollsToAdd.find(r => r.id === roll.id);
                              return (
                                <tr
                                  key={roll.id + '-' + idx}
                                  onClick={() => toggleRollSelection(roll)}
                                  style={{
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f3f4f6',
                                    backgroundColor: isSelected ? (activeRollTab === 'greige' ? 'rgba(30, 64, 175, 0.06)' : 'rgba(124, 58, 237, 0.06)') : 'transparent',
                                    transition: 'background-color 0.15s'
                                  }}
                                >
                                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    <input type="checkbox" checked={!!isSelected} readOnly style={{ accentColor: activeRollTab === 'greige' ? '#1e40af' : '#7c3aed' }} />
                                  </td>
                                  <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: '700', color: '#800000' }}>
                                    {roll.id}
                                  </td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <span style={{
                                      fontSize: '0.68rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                                      backgroundColor: roll.roll_type === 'greige' ? '#dbeafe' : '#f3e8ff',
                                      color: roll.roll_type === 'greige' ? '#1e40af' : '#7c3aed'
                                    }}>
                                      {roll.roll_type === 'greige' ? 'GREIGE' : 'PROCESSED'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                    {roll.wvof_number || roll.pof_number || '—'}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>
                                    {fmtNum(roll.actual_qty || roll.qty || roll.meters || 0)}
                                  </td>
                                  <td style={{ padding: '0.5rem' }}>
                                    {(() => {
                                      const st = getFormattedRollStatus(roll, activeRollTab, dispatchedRollIdsSet);
                                      return (
                                        <span style={{
                                          fontSize: '0.68rem', fontWeight: '800', padding: '2px 7px', borderRadius: '4px',
                                          backgroundColor: st.bg, color: st.color, display: 'inline-block'
                                        }}>
                                          {st.label}
                                        </span>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Notes */}
            <div style={{
              backgroundColor: 'white', borderRadius: '14px', border: '1px solid var(--border-current)',
              padding: '1.25rem', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)'
            }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '0.75rem', color: '#800000' }}>
                3. Notes (Optional)
              </h3>
              <textarea
                value={fsoNotes}
                onChange={(e) => setFsoNotes(e.target.value)}
                placeholder="Add notes about this stock order..."
                rows={3}
                style={{
                  width: '100%', padding: '0.6rem 0.75rem',
                  border: '1px solid var(--border-current)', borderRadius: '8px',
                  fontSize: '0.85rem', resize: 'vertical'
                }}
              />
            </div>

            {/* Summary & Create */}
            <div style={{
              backgroundColor: 'white', borderRadius: '14px', border: '1px solid var(--border-current)',
              padding: '1.25rem', boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800' }}>Selected Rolls: </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '900', color: '#059669' }}>{rollsToAdd.length}</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted-current)', marginLeft: '1rem' }}>
                    Total: {fmtNum(rollsToAdd.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || r.meters || 0), 0))} m
                  </span>
                </div>
              </div>
              <button
                onClick={handleCreateFso}
                disabled={loading || rollsToAdd.length === 0}
                style={{
                  width: '100%', padding: '0.75rem 1.5rem',
                  backgroundColor: rollsToAdd.length === 0 ? '#d1d5db' : '#800000',
                  color: 'white', border: 'none', borderRadius: '10px',
                  fontSize: '0.9rem', fontWeight: '800',
                  cursor: rollsToAdd.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Archive size={18} />}
                Create Fabric Stock Order ({rollsToAdd.length} rolls)
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // RENDER: FSO List
  // ─────────────────────────────────────────────
  if (view === 'fso_list' || view === 'allot') {
    const isAllotMode = view === 'allot';

    return (
      <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setView('hub')} style={{
            border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center'
          }}>
            <ArrowLeft size={20} color="#800000" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#800000', margin: 0 }}>
              {isAllotMode ? 'Allot Stock to Orders' : 'Fabric Stock Orders'}
            </h1>
            <p style={{ color: 'var(--text-muted-current)', fontSize: '0.8rem', margin: 0 }}>
              {isAllotMode ? 'Select rolls from stock orders to allot to new orders' : 'All Fabric Stock Orders'}
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.82rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Info size={16} /> {error}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontSize: '0.82rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} /> {successMsg}
          </div>
        )}

        {/* Sticky Allot bar at bottom */}
        {isAllotMode && selectedStockRolls.length > 0 && (
          <div style={{
            position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
            width: '90%', maxWidth: '800px', zIndex: 1000,
            backgroundColor: '#4c1d95', color: 'white', borderRadius: '16px',
            padding: '0.85rem 1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: '1px solid #7c3aed'
          }}>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: '900' }}>
                {selectedStockRolls.length} Roll(s) Selected
              </div>
              <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>
                Total Quantity: <strong>{fmtNum(selectedStockRolls.reduce((sum, r) => sum + parseFloat(r.meters || 0), 0))} m</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                onClick={() => setSelectedStockRolls([])}
                style={{
                  padding: '0.5rem 0.85rem', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white',
                  border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                Clear Selection
              </button>
              <button
                onClick={() => setShowAllotModal(true)}
                style={{
                  padding: '0.65rem 1.4rem', backgroundColor: '#10b981', color: 'white',
                  border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '0.88rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)'
                }}
              >
                <ArrowRight size={18} /> Allot to Order
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by FSO number, order, or design..."
              style={{
                width: '100%', padding: '0.6rem 0.75rem 0.6rem 2.25rem',
                border: '1px solid var(--border-current)', borderRadius: '8px',
                fontSize: '0.85rem'
              }}
            />
          </div>
        </div>

        {/* FSO Cards */}
        {filteredFsoList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
            <Package size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.9rem' }}>No Fabric Stock Orders found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredFsoList.map(fso => {
              const isExpanded = expandedFso[fso.id];
              return (
                <div key={fso.id} style={{
                  backgroundColor: 'white', borderRadius: '14px', border: '1px solid var(--border-current)',
                  boxShadow: 'var(--shadow-sm)', overflow: 'hidden'
                }}>
                  {/* FSO Header */}
                  <div
                    onClick={async () => {
                      const nextState = !isExpanded;
                      setExpandedFso(prev => ({ ...prev, [fso.id]: nextState }));
                      if (nextState) {
                        await fetchStockItems(fso.id);
                      }
                    }}
                    style={{
                      padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem',
                      borderBottom: isExpanded ? '1px solid var(--border-current)' : 'none'
                    }}
                  >
                    {isExpanded ? <ChevronDown size={18} color="#800000" /> : <ChevronRight size={18} color="#800000" />}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '800', color: '#800000', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                          {fso.fso_number}
                        </span>
                        {getFsoStatusBadge(fso.status)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted-current)', marginTop: '0.25rem' }}>
                        Source: {fso.source_order_number || '—'} &nbsp;|&nbsp;
                        Design: {fso.design_name || '—'} ({fso.design_no || '—'}) &nbsp;|&nbsp;
                        {fso.total_rolls} rolls &nbsp;|&nbsp; {fmtNum(fso.total_meters)} m &nbsp;|&nbsp;
                        {formatDate(fso.created_at)}
                      </div>
                    </div>
                    {/* Delete FSO Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFso(fso);
                      }}
                      title="Delete Fabric Stock Order"
                      style={{
                        padding: '0.35rem 0.65rem', border: '1px solid #fecaca', borderRadius: '6px',
                        backgroundColor: '#fff5f5', color: '#dc2626', fontSize: '0.75rem', fontWeight: '700',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Trash2 size={13} /> Delete FSO
                    </button>
                  </div>

                  {/* FSO Detail */}
                  {isExpanded && (
                    <div style={{ padding: '1rem 1.25rem' }}>
                      {/* Allot Mode Controls for FSO */}
                      {isAllotMode && (
                        <div style={{
                          backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
                          padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap',
                          alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
                            <QrCode size={18} color="#7c3aed" />
                            <input
                              type="text"
                              value={fsoRollSearch[fso.id] || ''}
                              onChange={(e) => setFsoRollSearch(prev => ({ ...prev, [fso.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleScanOrTypeFsoRoll(fso.id, fsoRollSearch[fso.id] || '');
                                }
                              }}
                              placeholder="Scan / Type Roll ID to select..."
                              style={{
                                flex: 1, padding: '0.45rem 0.75rem', border: '1px solid var(--border-current)',
                                borderRadius: '6px', fontSize: '0.82rem', fontFamily: 'monospace'
                              }}
                            />
                            <button
                              onClick={() => handleScanOrTypeFsoRoll(fso.id, fsoRollSearch[fso.id] || '')}
                              style={{
                                padding: '0.45rem 0.85rem', backgroundColor: '#7c3aed', color: 'white',
                                border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer'
                              }}
                            >
                              Select
                            </button>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => selectAllStockRollsInFso(fso.id)}
                              style={{
                                padding: '0.4rem 0.85rem', backgroundColor: '#e0e7ff', color: '#3730a3',
                                border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer'
                              }}
                            >
                              Select All In-Stock Rolls
                            </button>
                            <button
                              onClick={() => clearStockRollsInFso(fso.id)}
                              style={{
                                padding: '0.4rem 0.85rem', backgroundColor: '#f1f5f9', color: '#64748b',
                                border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
                              }}
                            >
                              Deselect FSO Rolls
                            </button>
                          </div>
                        </div>
                      )}

                      {stockItems.filter(si => si.fso_id === fso.id).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)', fontSize: '0.82rem' }}>
                          <Loader size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />
                          Loading rolls...
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--border-current)' }}>
                              {isAllotMode && <th style={{ padding: '0.5rem', textAlign: 'center', width: '40px' }}>✓</th>}
                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Roll ID</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>WVOF / POF</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Meters</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                              {!isAllotMode && <th style={{ padding: '0.5rem', textAlign: 'left' }}>Allotted To</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {stockItems.filter(si => si.fso_id === fso.id).map((item, idx) => {
                              const isItemSelected = selectedStockRolls.find(r => r.id === item.id);
                              const isInStock = item.status === 'in_stock';
                              return (
                                <tr
                                  key={item.id}
                                  onClick={() => isAllotMode && isInStock && toggleStockRollSelection(item)}
                                  style={{
                                    cursor: isAllotMode && isInStock ? 'pointer' : 'default',
                                    borderBottom: '1px solid #f3f4f6',
                                    backgroundColor: isItemSelected ? 'rgba(124, 58, 237, 0.06)' : 'transparent',
                                    opacity: isAllotMode && !isInStock ? 0.5 : 1
                                  }}
                                >
                                  {isAllotMode && (
                                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                      {isInStock && <input type="checkbox" checked={!!isItemSelected} readOnly style={{ accentColor: '#7c3aed' }} />}
                                    </td>
                                  )}
                                  <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: '700', color: '#800000' }}>
                                    {item.original_roll_id}
                                  </td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <span style={{
                                      fontSize: '0.68rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                                      backgroundColor: item.roll_type === 'greige' ? '#dbeafe' : '#f3e8ff',
                                      color: item.roll_type === 'greige' ? '#1e40af' : '#7c3aed'
                                    }}>
                                      {item.roll_type === 'greige' ? 'GREIGE' : 'PROCESSED'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                    {item.original_wvof_number || item.original_pof_number || '—'}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>
                                    {fmtNum(item.meters)}
                                  </td>
                                  <td style={{ padding: '0.5rem' }}>
                                    <span style={{
                                      fontSize: '0.68rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                                      backgroundColor: item.status === 'in_stock' ? '#dcfce7' : item.status === 'allotted' ? '#fef3c7' : '#f3f4f6',
                                      color: item.status === 'in_stock' ? '#166534' : item.status === 'allotted' ? '#92400e' : '#6b7280'
                                    }}>
                                      {item.status === 'in_stock' ? 'In Stock' : item.status === 'allotted' ? 'Allotted' : item.status}
                                    </span>
                                  </td>
                                  {!isAllotMode && (
                                    <td style={{ padding: '0.5rem', fontSize: '0.75rem' }}>
                                      {item.allotted_order_number ? (
                                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#7c3aed' }}>
                                          {item.allotted_order_number}
                                        </span>
                                      ) : '—'}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Allotment Modal */}
        {showAllotModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{
              backgroundColor: 'white', borderRadius: '18px', padding: '2rem',
              maxWidth: '500px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: '900', color: '#800000', margin: 0 }}>
                  Allot Rolls to Order
                </h2>
                <button onClick={() => setShowAllotModal(false)} style={{
                  border: 'none', background: 'none', cursor: 'pointer'
                }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
                <strong>{selectedStockRolls.length}</strong> roll(s) selected &nbsp;|&nbsp;
                <strong>{fmtNum(selectedStockRolls.reduce((sum, r) => sum + parseFloat(r.meters || 0), 0))}</strong> m total
              </div>

              {/* Searchable Target Order Dropdown */}
              <div style={{ marginBottom: '1.25rem', position: 'relative' }} ref={targetOrderDropdownRef}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', marginBottom: '0.4rem', color: '#800000' }}>
                  Select Target Order
                </label>

                {/* Dropdown Selector Input */}
                <div
                  onClick={() => setIsTargetOrderDropdownOpen(prev => !prev)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    border: `1.5px solid ${isTargetOrderDropdownOpen ? '#7c3aed' : 'var(--border-current, #d1d5db)'}`,
                    borderRadius: '10px',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    boxShadow: isTargetOrderDropdownOpen ? '0 0 0 3px rgba(124, 58, 237, 0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {allotTargetOrderId ? (() => {
                    const selected = orders.find(o => o.id === allotTargetOrderId);
                    return selected ? (
                      <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: '800', fontFamily: 'monospace', color: '#800000', fontSize: '0.88rem', marginRight: '0.5rem' }}>
                          {selected.order_number}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#374151' }}>
                          Design: {selected.design_name || '—'} ({selected.design_no || '—'})
                        </span>
                        {selected.pi_numbers && (
                          <span style={{ fontSize: '0.75rem', color: '#7c3aed', marginLeft: '0.5rem', fontWeight: '600' }}>
                            (PI #: {selected.pi_numbers})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Select Target Order...</span>
                    );
                  })() : (
                    <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>Select Target Order...</span>
                  )}
                  <ChevronDown
                    size={18}
                    style={{
                      color: '#6b7280',
                      transform: isTargetOrderDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                      marginLeft: '0.5rem'
                    }}
                  />
                </div>

                {/* Dropdown Menu Overlay */}
                {isTargetOrderDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    zIndex: 10000,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {/* Search Field inside Dropdown */}
                    <div style={{ padding: '0.6rem', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb' }}>
                      <div style={{ position: 'relative' }}>
                        <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input
                          type="text"
                          value={targetOrderSearch}
                          onChange={(e) => setTargetOrderSearch(e.target.value)}
                          placeholder="Type Order #, Design Name/No, PI #..."
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            padding: '0.45rem 2rem 0.45rem 2rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.82rem',
                            outline: 'none'
                          }}
                        />
                        {targetOrderSearch && (
                          <X
                            size={14}
                            onClick={(e) => { e.stopPropagation(); setTargetOrderSearch(''); }}
                            style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', cursor: 'pointer' }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Scrollable Order Options */}
                    <div style={{ maxHeight: '210px', overflowY: 'auto' }}>
                      {filteredTargetOrders.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
                          No matching orders found
                        </div>
                      ) : (
                        filteredTargetOrders.map(o => {
                          const isSelected = allotTargetOrderId === o.id;
                          return (
                            <div
                              key={o.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAllotTargetOrderId(o.id);
                                setIsTargetOrderDropdownOpen(false);
                              }}
                              style={{
                                padding: '0.65rem 0.85rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f9fafb',
                                backgroundColor: isSelected ? '#f0fdf4' : 'transparent',
                                transition: 'background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '800', fontFamily: 'monospace', color: '#800000', fontSize: '0.88rem' }}>
                                  {o.order_number}
                                </span>
                                {isSelected && <CheckCircle size={16} color="#166534" />}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: '0.2rem' }}>
                                Design: <strong>{o.design_name || '—'}</strong> ({o.design_no || '—'})
                              </div>
                              {o.pi_numbers && (
                                <div style={{ fontSize: '0.72rem', color: '#7c3aed', marginTop: '0.1rem', fontWeight: '600' }}>
                                  PI #: {o.pi_numbers}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {allotTargetOrderId && (() => {
                const target = orders.find(o => o.id === allotTargetOrderId);
                return target ? (
                  <div style={{
                    backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px',
                    padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8rem'
                  }}>
                    <strong>Selected Target Order:</strong> {target.order_number}<br />
                    <strong>Design:</strong> {target.design_name} ({target.design_no})
                    {target.pi_numbers && <div><strong>PI Number(s):</strong> {target.pi_numbers}</div>}
                  </div>
                ) : null;
              })()}

              <button
                onClick={handleAllotRolls}
                disabled={loading || !allotTargetOrderId}
                style={{
                  width: '100%', padding: '0.75rem',
                  backgroundColor: !allotTargetOrderId ? '#d1d5db' : '#7c3aed',
                  color: 'white', border: 'none', borderRadius: '10px',
                  fontSize: '0.9rem', fontWeight: '800',
                  cursor: !allotTargetOrderId ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                {loading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={18} />}
                Confirm Allotment
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default fallback
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted-current)' }}>
      <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  );
}
