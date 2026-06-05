import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Filter, Package, Loader, ChevronRight, ChevronDown,
  FileText, Truck, Download, Layers, CheckCircle2, ClipboardList,
  Printer, X, User, Calendar, MapPin, AlertCircle, RefreshCw, SlidersHorizontal
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function OrderStock() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selected order state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // Details state
  const [dofs, setDofs] = useState([]);
  const [gydi, setGydi] = useState([]);
  const [dyri, setDyri] = useState([]);
  const [dydi, setDydi] = useState([]);
  const [warpingOrders, setWarpingOrders] = useState([]);
  const [weavingOrders, setWeavingOrders] = useState([]);
  const [returns, setReturns] = useState([]);

  // Modal state
  const [activeModal, setActiveModal] = useState(null); // { type, data }

  // Expanded Order State
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('dyeing'); // 'dyeing' | 'warping' | 'weaving'

  // Advanced Filters State
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [selectedOrderNos, setSelectedOrderNos] = useState([]);
  const [selectedDesignNames, setSelectedDesignNames] = useState([]);
  const [selectedDesignNos, setSelectedDesignNos] = useState([]);
  const [selectedOrderTypes, setSelectedOrderTypes] = useState([]);

  // Dependent Filter Option Calculations
  const getFilteredOrders = (excludeField) => {
    return orders.filter(o => {
      if (excludeField !== 'orderNo' && selectedOrderNos.length > 0) {
        if (!selectedOrderNos.includes(o.order_number || '')) return false;
      }
      if (excludeField !== 'designName' && selectedDesignNames.length > 0) {
        if (!selectedDesignNames.includes(o.design_name || '')) return false;
      }
      if (excludeField !== 'designNo' && selectedDesignNos.length > 0) {
        if (!selectedDesignNos.includes(o.design_no || '')) return false;
      }
      if (excludeField !== 'orderType' && selectedOrderTypes.length > 0) {
        if (!selectedOrderTypes.includes(o.order_type || '')) return false;
      }
      return true;
    });
  };

  const uniqueOrderNos = useMemo(() => {
    const data = getFilteredOrders('orderNo');
    return [...new Set(data.map(o => o.order_number).filter(Boolean))].sort();
  }, [orders, selectedDesignNames, selectedDesignNos, selectedOrderTypes]);

  const uniqueDesignNames = useMemo(() => {
    const data = getFilteredOrders('designName');
    return [...new Set(data.map(o => o.design_name).filter(Boolean))].sort();
  }, [orders, selectedOrderNos, selectedDesignNos, selectedOrderTypes]);

  const uniqueDesignNos = useMemo(() => {
    const data = getFilteredOrders('designNo');
    return [...new Set(data.map(o => o.design_no).filter(Boolean))].sort();
  }, [orders, selectedOrderNos, selectedDesignNames, selectedOrderTypes]);

  const uniqueOrderTypes = useMemo(() => {
    const data = getFilteredOrders('orderType');
    return [...new Set(data.map(o => o.order_type).filter(Boolean))].sort();
  }, [orders, selectedOrderNos, selectedDesignNames, selectedDesignNos]);

  const handleToggleExpand = async (order) => {
    if (expandedOrderId === order.id) {
      setExpandedOrderId(null);
      setSelectedOrder(null);
    } else {
      setExpandedOrderId(order.id);
      setActiveSubTab('dyeing');
      await handleSelectOrder(order);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [orderRes, yarnRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, master_brands(brand_name)')
          .order('created_at', { ascending: false }),
        supabase.from('master_yarn_counts').select('*')
      ]);

      setOrders(orderRes.data || []);
      setYarnCounts(yarnRes.data || []);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = async (order) => {
    setSelectedOrder(order);
    setDetailsLoading(true);
    try {
      const [dofRes, gydiRes, dyriRes, dydiRes, warpRes, weaveRes, returnRes] = await Promise.all([
        supabase
          .from('dyeing_order_forms')
          .select('*, dyeing_unit:master_partners(partner_name)')
          .contains('order_ids', [order.id]),
        supabase
          .from('greige_yarn_delivery_items')
          .select('*, receipt:greige_yarn_delivery_receipts(*)')
          .eq('order_id', order.id),
        supabase
          .from('dyed_yarn_receipt_items')
          .select('*, receipt:dyed_yarn_receipts(*), location:master_locations(location_name)')
          .eq('order_id', order.id),
        supabase
          .from('dyed_yarn_delivery_items')
          .select('*, delivery:dyed_yarn_deliveries(*)')
          .eq('order_id', order.id),
        supabase
          .from('warping_orders')
          .select('*')
          .eq('order_id', order.id),
        supabase
          .from('weaving_orders')
          .select('*')
          .eq('order_id', order.id),
        supabase
          .from('greige_yarn_receipts')
          .select('*')
          .eq('receipt_type', 'production')
          .eq('order_id', order.id)
      ]);

      const fetchedDofs = dofRes.data || [];

      // Fallback post-filtering for gydi items that might have null order_id
      const filteredGydi = (gydiRes.data || []).filter(item => {
        if (item.order_id === order.id) return true;
        if (!item.order_id) {
          const allocations = fetchedDofs.flatMap(d => (d.yarn_allocations || []).filter(a => a.orderId === order.id));
          return allocations.some(a => a.countId === item.yarn_count_id && a.colour === item.colour);
        }
        return false;
      });

      setDofs(fetchedDofs);
      setGydi(filteredGydi);
      setDyri(dyriRes.data || []);
      setDydi(dydiRes.data || []);
      setWarpingOrders(warpRes.data || []);
      setWeavingOrders(weaveRes.data || []);
      setReturns(returnRes.data || []);
    } catch (err) {
      console.error('Error fetching order details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const formatYarnCount = (id) => {
    const y = yarnCounts.find(c => c.id === id);
    return y ? `${y.count_value} ${y.material}` : '-';
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Text Search Term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          (o.order_number || '').toLowerCase().includes(search) ||
          (o.design_no || '').toLowerCase().includes(search) ||
          (o.design_name || '').toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }
      // 2. Advanced Filters
      if (selectedOrderNos.length > 0 && !selectedOrderNos.includes(o.order_number || '')) return false;
      if (selectedDesignNames.length > 0 && !selectedDesignNames.includes(o.design_name || '')) return false;
      if (selectedDesignNos.length > 0 && !selectedDesignNos.includes(o.design_no || '')) return false;
      if (selectedOrderTypes.length > 0 && !selectedOrderTypes.includes(o.order_type || '')) return false;

      return true;
    });
  }, [orders, searchTerm, selectedOrderNos, selectedDesignNames, selectedDesignNos, selectedOrderTypes]);

  // Grouped breakdown calculations
  const breakdownData = useMemo(() => {
    if (!selectedOrder) return [];

    const summary = {};

    // 1. Primary order requirements
    const reqs = selectedOrder.yarn_requirements || [];
    reqs.forEach(yr => {
      const key = `${yr.countId}-${yr.color}-${yr.type}`;
      summary[key] = {
        countId: yr.countId,
        colour: yr.color,
        type: yr.type,
        required: parseFloat(yr.kg || 0),
        greigeSent: 0,
        dyedReceived: 0,
        deliveredWarping: 0,
        receivedWarping: 0,
        deliveredWeaving: 0,
        receivedWeaving: 0
      };
    });

    // 2. Add allocations from DOFs if count/color not in original reqs (fallback)
    dofs.forEach(dof => {
      (dof.yarn_allocations || []).forEach(a => {
        if (a.orderId === selectedOrder.id) {
          const key = `${a.countId}-${a.colour}-${a.type}`;
          if (!summary[key]) {
            summary[key] = {
              countId: a.countId,
              colour: a.colour,
              type: a.type,
              required: parseFloat(a.base_kg || a.total_kg || 0),
              greigeSent: 0,
              dyedReceived: 0,
              deliveredWarping: 0,
              receivedWarping: 0,
              deliveredWeaving: 0,
              receivedWeaving: 0
            };
          }
        }
      });
    });

    // 3. Greige Sent (greige_yarn_delivery_items)
    gydi.forEach(item => {
      const key = `${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
      if (summary[key]) {
        summary[key].greigeSent += parseFloat(item.quantity_kg || 0);
      } else {
        summary[key] = {
          countId: item.yarn_count_id,
          colour: item.colour,
          type: item.yarn_type || 'warp',
          required: 0,
          greigeSent: parseFloat(item.quantity_kg || 0),
          dyedReceived: 0,
          deliveredWarping: 0,
          receivedWarping: 0,
          deliveredWeaving: 0,
          receivedWeaving: 0
        };
      }
    });

    // Deduct returns (greige returns from production)
    returns.forEach(ret => {
      const key = `${ret.yarn_count_id}-${ret.colour}-${ret.yarn_type || 'warp'}`;
      if (summary[key]) {
        summary[key].greigeSent = Math.max(0, summary[key].greigeSent - parseFloat(ret.total_weight || 0));
      }
    });

    // 4. Received from Dyeing (dyed_yarn_receipt_items)
    dyri.forEach(item => {
      const key = `${item.yarn_count_id}-${item.colour}-${item.yarn_type || 'warp'}`;
      if (summary[key]) {
        summary[key].dyedReceived += parseFloat(item.quantity_kg || 0);
      } else {
        summary[key] = {
          countId: item.yarn_count_id,
          colour: item.colour,
          type: item.yarn_type || 'warp',
          required: 0,
          greigeSent: 0,
          dyedReceived: parseFloat(item.quantity_kg || 0),
          deliveredWarping: 0,
          receivedWarping: 0,
          deliveredWeaving: 0,
          receivedWeaving: 0
        };
      }
    });

    // 5. Delivered to Warping / Weaving (dyed_yarn_delivery_items)
    dydi.forEach(item => {
      const key = `${item.yarn_count_id}-${item.colour}-${item.process_type === 'warping' ? 'warp' : 'weft'}`;
      if (summary[key]) {
        if (item.process_type === 'warping') {
          summary[key].deliveredWarping += parseFloat(item.quantity_kg || 0);
        } else {
          summary[key].deliveredWeaving += parseFloat(item.quantity_kg || 0);
        }
      } else {
        summary[key] = {
          countId: item.yarn_count_id,
          colour: item.colour,
          type: item.process_type === 'warping' ? 'warp' : 'weft',
          required: 0,
          greigeSent: 0,
          dyedReceived: 0,
          deliveredWarping: item.process_type === 'warping' ? parseFloat(item.quantity_kg || 0) : 0,
          receivedWarping: 0,
          deliveredWeaving: item.process_type === 'weaving' ? parseFloat(item.quantity_kg || 0) : 0,
          receivedWeaving: 0
        };
      }
    });

    // 6. Received from Warping / Weaving (completion status mappings)
    const warpingCompleted = warpingOrders.some(w => w.status === 'completed');
    const weavingCompleted = weavingOrders.some(w => w.status === 'completed');

    Object.keys(summary).forEach(key => {
      const row = summary[key];
      if (warpingCompleted) {
        row.receivedWarping = row.deliveredWarping;
      }
      if (weavingCompleted) {
        row.receivedWeaving = row.deliveredWeaving;
      }
    });

    return Object.values(summary).sort((a, b) => {
      if (a.type === 'warp' && b.type !== 'warp') return -1;
      if (a.type !== 'warp' && b.type === 'warp') return 1;
      return 0;
    });
  }, [selectedOrder, dofs, gydi, dyri, dydi, warpingOrders, weavingOrders, returns]);

  // Extract unique documents
  const associatedDocs = useMemo(() => {
    // 1. DOFs already set in dofs state
    
    // 2. GYDRs
    const gydrSeen = new Set();
    const gydrs = [];
    gydi.forEach(item => {
      if (item.receipt && !gydrSeen.has(item.receipt.id)) {
        gydrSeen.add(item.receipt.id);
        gydrs.push(item.receipt);
      }
    });

    // 3. DYRRs
    const dyrrSeen = new Set();
    const dyrrs = [];
    dyri.forEach(item => {
      if (item.receipt && !dyrrSeen.has(item.receipt.id)) {
        dyrrSeen.add(item.receipt.id);
        dyrrs.push(item.receipt);
      }
    });

    // 4. DYDRs
    const dydrSeen = new Set();
    const dydrs = [];
    dydi.forEach(item => {
      if (item.delivery && !dydrSeen.has(item.delivery.id)) {
        dydrSeen.add(item.delivery.id);
        dydrs.push(item.delivery);
      }
    });

    return {
      dofs,
      gydrs: gydrs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)),
      dyrrs: dyrrs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)),
      dydrs: dydrs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)),
      warping: warpingOrders,
      weaving: weavingOrders
    };
  }, [dofs, gydi, dyri, dydi, warpingOrders, weavingOrders]);

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '1rem' }} className="fade-in">
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/dyed-yarn')} className="btn-icon">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0, color: 'var(--text-current)' }}>
            Order Processing Status
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>
            Track end-to-end processing lifecycle from greige delivery to weaving order status
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '10rem 0' }}>
          <Loader size={40} className="spin" color="var(--color-primary)" />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted-current)' }}>Loading order list...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Search and Filter Controls */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '360px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input 
                type="text" 
                placeholder="Search order, design no..." 
                className="form-input"
                style={{ paddingLeft: '2.3rem', fontSize: '0.85rem' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid var(--border-current)',
                  backgroundColor: isFilterExpanded ? 'var(--color-primary)' : 'transparent',
                  color: isFilterExpanded ? 'white' : 'var(--text-current)',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  height: '38px',
                  boxSizing: 'border-box'
                }}
              >
                <SlidersHorizontal size={16} />
                {isFilterExpanded ? 'Hide Filters' : 'Advanced Filters'}
              </button>
              <div style={{ color: 'var(--text-muted-current)', fontSize: '0.875rem', fontWeight: '500' }}>
                Showing {filteredOrders.length} orders
              </div>
            </div>
          </div>

          {/* Expandable Filter Panel */}
          {isFilterExpanded && (
            <div className="glass-panel fade-in" style={{
              padding: '1.25rem',
              backgroundColor: '#fff',
              border: '1px solid var(--border-current)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem'
              }}>
                <MultiSelectDropdown 
                  label="Order Number"
                  options={uniqueOrderNos}
                  selectedValues={selectedOrderNos}
                  onChange={setSelectedOrderNos}
                  placeholder="All Orders"
                />
                <MultiSelectDropdown 
                  label="Design Spec Name"
                  options={uniqueDesignNames}
                  selectedValues={selectedDesignNames}
                  onChange={setSelectedDesignNames}
                  placeholder="All Design Names"
                />
                <MultiSelectDropdown 
                  label="Design Spec Number"
                  options={uniqueDesignNos}
                  selectedValues={selectedDesignNos}
                  onChange={setSelectedDesignNos}
                  placeholder="All Design Nos"
                />
                <MultiSelectDropdown 
                  label="Order Type"
                  options={uniqueOrderTypes}
                  selectedValues={selectedOrderTypes}
                  onChange={setSelectedOrderTypes}
                  placeholder="All Types"
                />
              </div>

              {(selectedOrderNos.length > 0 || selectedDesignNames.length > 0 || selectedDesignNos.length > 0 || selectedOrderTypes.length > 0) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem' }}>
                  <button 
                    onClick={() => {
                      setSelectedOrderNos([]);
                      setSelectedDesignNames([]);
                      setSelectedDesignNos([]);
                      setSelectedOrderTypes([]);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Orders Table/Accordion List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredOrders.length === 0 ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                No orders found
              </div>
            ) : (
              filteredOrders.map(order => {
                const isExpanded = expandedOrderId === order.id;
                
                return (
                  <div 
                    key={order.id} 
                    className="glass-panel fade-in" 
                    style={{ 
                      padding: 0, 
                      overflow: 'hidden', 
                      border: isExpanded ? '1px solid var(--color-primary)' : '1px solid var(--border-current)',
                      boxShadow: isExpanded ? '0 10px 25px -5px rgba(128, 0, 0, 0.08)' : undefined,
                      transition: 'all 0.2s',
                      borderRadius: '12px'
                    }}
                  >
                    {/* Header Row */}
                    <div 
                      onClick={() => handleToggleExpand(order)}
                      style={{ 
                        padding: '1.25rem 1.5rem', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        backgroundColor: isExpanded ? 'rgba(128, 0, 0, 0.01)' : 'transparent',
                        borderBottom: isExpanded ? '1px solid var(--border-current)' : '1px solid transparent'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', flex: 1 }}>
                        <div style={{ minWidth: '150px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order Number</div>
                          <div style={{ fontSize: '1.05rem', fontWeight: '900', color: 'var(--color-primary)', marginTop: '0.15rem' }}>{order.order_number}</div>
                        </div>

                        <div style={{ minWidth: '200px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Design Spec</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)', marginTop: '0.15rem' }}>{order.design_no} / {order.design_name}</div>
                        </div>

                        <div style={{ minWidth: '150px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Brand / Buyer</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-current)', marginTop: '0.15rem' }}>{order.master_brands?.brand_name || 'Generic'}</div>
                        </div>

                        <div style={{ minWidth: '80px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</div>
                          <span style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: '800', 
                            padding: '0.15rem 0.5rem', 
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            display: 'inline-block',
                            marginTop: '0.2rem',
                            backgroundColor: order.order_type === 'bulk' ? '#e0f2fe' : '#fef3c7',
                            color: order.order_type === 'bulk' ? '#0369a1' : '#b45309'
                          }}>
                            {order.order_type}
                          </span>
                        </div>

                        <div style={{ minWidth: '90px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: '800',
                            textTransform: 'capitalize',
                            display: 'inline-block',
                            marginTop: '0.15rem',
                            color: order.status === 'completed' ? '#10b981' : order.status === 'in_progress' ? '#3b82f6' : '#9ca3af'
                          }}>
                            {order.status}
                          </span>
                        </div>

                        <div style={{ minWidth: '120px' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FOB Date</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-current)', marginTop: '0.15rem' }}>
                            {order.fob_date ? new Date(order.fob_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <button 
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: isExpanded ? 'var(--color-primary)' : 'var(--text-muted-current)',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0.5rem',
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                        }}
                      >
                        <ChevronDown size={22} />
                      </button>
                    </div>

                    {/* Expanded Content Area */}
                    {isExpanded && (
                      <div style={{ padding: '1.5rem', backgroundColor: '#ffffff', borderTop: '1px solid var(--border-current)' }}>
                        {detailsLoading ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
                            <Loader size={32} className="spin" color="var(--color-primary)" />
                            <p style={{ marginTop: '1rem', color: 'var(--text-muted-current)', fontSize: '0.85rem' }}>Fetching order details...</p>
                          </div>
                        ) : (
                          <div className="fade-in">
                            {/* Tabs Header inside Expanded Row */}
                            <div style={{ display: 'flex', borderBottom: '2px solid #eee', marginBottom: '1.5rem', gap: '2rem' }}>
                              {[
                                { key: 'dyeing', label: 'Dyeing Stage' },
                                { key: 'warping', label: 'Warping Stage' },
                                { key: 'weaving', label: 'Weaving Stage' }
                              ].map(tab => (
                                <button
                                  key={tab.key}
                                  onClick={() => setActiveSubTab(tab.key)}
                                  style={{
                                    padding: '0.75rem 0', background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: '0.95rem', fontWeight: '700',
                                    color: activeSubTab === tab.key ? 'var(--color-primary)' : '#666',
                                    borderBottom: activeSubTab === tab.key ? '3px solid var(--color-primary)' : '3px solid transparent',
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>

                            {/* DYEING TAB CONTENT */}
                            {activeSubTab === 'dyeing' && (
                              <div className="fade-in">
                                {/* Warp requirements */}
                                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#1e40af', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Warp Yarn Requirements</h4>
                                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1.5rem' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                        <th style={thStyle}>Count</th>
                                        <th style={thStyle}>Colour</th>
                                        <th style={numericThStyle}>Required (kg)</th>
                                        <th style={numericThStyle}>Greige Sent (kg)</th>
                                        <th style={numericThStyle}>Received Dyed (kg)</th>
                                        <th style={numericThStyle}>Balance to Receive (kg)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {breakdownData.filter(d => d.type === 'warp').length === 0 ? (
                                        <tr>
                                          <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                            No warp yarn requirements defined
                                          </td>
                                        </tr>
                                      ) : (
                                        breakdownData.filter(d => d.type === 'warp').map((row, idx) => {
                                          const balToRec = Math.max(0, row.greigeSent - row.dyedReceived);
                                          return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                              <td style={tdStyle}>{formatYarnCount(row.countId)}</td>
                                              <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{row.colour}</td>
                                              <td style={numericTdStyle}>{row.required.toFixed(2)}</td>
                                              <td style={numericTdStyle}>{row.greigeSent.toFixed(2)}</td>
                                              <td style={numericTdStyle}>{row.dyedReceived.toFixed(2)}</td>
                                              <td style={{ ...numericTdStyle, color: balToRec > 0 ? '#b45309' : '#10b981', fontWeight: '800' }}>
                                                {balToRec.toFixed(2)}
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Weft requirements */}
                                <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0f766e', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weft Yarn Requirements</h4>
                                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '2rem' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                        <th style={thStyle}>Count</th>
                                        <th style={thStyle}>Colour</th>
                                        <th style={numericThStyle}>Required (kg)</th>
                                        <th style={numericThStyle}>Greige Sent (kg)</th>
                                        <th style={numericThStyle}>Received Dyed (kg)</th>
                                        <th style={numericThStyle}>Balance to Receive (kg)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {breakdownData.filter(d => d.type === 'weft').length === 0 ? (
                                        <tr>
                                          <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                            No weft yarn requirements defined
                                          </td>
                                        </tr>
                                      ) : (
                                        breakdownData.filter(d => d.type === 'weft').map((row, idx) => {
                                          const balToRec = Math.max(0, row.greigeSent - row.dyedReceived);
                                          return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                              <td style={tdStyle}>{formatYarnCount(row.countId)}</td>
                                              <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{row.colour}</td>
                                              <td style={numericTdStyle}>{row.required.toFixed(2)}</td>
                                              <td style={numericTdStyle}>{row.greigeSent.toFixed(2)}</td>
                                              <td style={numericTdStyle}>{row.dyedReceived.toFixed(2)}</td>
                                              <td style={{ ...numericTdStyle, color: balToRec > 0 ? '#b45309' : '#10b981', fontWeight: '800' }}>
                                                {balToRec.toFixed(2)}
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Dyeing Associated Documents */}
                                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <FileText size={16} color="var(--color-primary)" /> Dyeing Documents & Receipts
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                                  
                                  {/* DOFs list */}
                                  <div style={docBoxStyle}>
                                    <h5 style={docBoxTitleStyle}>Dyeing Orders (DOF)</h5>
                                    <div style={docListContainerStyle}>
                                      {associatedDocs.dofs.length === 0 ? (
                                        <div style={emptyDocStyle}>No DOFs linked</div>
                                      ) : (
                                        associatedDocs.dofs.map(d => (
                                          <div 
                                            key={d.id} 
                                            onClick={() => setActiveModal({ type: 'dof', data: d })}
                                            style={docItemStyle}
                                            className="hover-lift"
                                          >
                                            <div style={{ fontWeight: '700' }}>{d.dof_number}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                              {d.dyeing_unit?.partner_name} • {d.status}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>

                                  {/* GYDRs list */}
                                  <div style={docBoxStyle}>
                                    <h5 style={docBoxTitleStyle}>Greige Deliveries (GYDR)</h5>
                                    <div style={docListContainerStyle}>
                                      {associatedDocs.gydrs.length === 0 ? (
                                        <div style={emptyDocStyle}>No GYDRs linked</div>
                                      ) : (
                                        associatedDocs.gydrs.map(g => (
                                          <div 
                                            key={g.id} 
                                            onClick={() => setActiveModal({ type: 'gydr', data: g })}
                                            style={docItemStyle}
                                            className="hover-lift"
                                          >
                                            <div style={{ fontWeight: '700' }}>{g.gydr_number}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                              {g.delivered_by} • {new Date(g.created_at).toLocaleDateString()}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>

                                  {/* DYRRs list */}
                                  <div style={docBoxStyle}>
                                    <h5 style={docBoxTitleStyle}>Dyed Receipts (DYRR)</h5>
                                    <div style={docListContainerStyle}>
                                      {associatedDocs.dyrrs.length === 0 ? (
                                        <div style={emptyDocStyle}>No DYRRs linked</div>
                                      ) : (
                                        associatedDocs.dyrrs.map(r => (
                                          <div 
                                            key={r.id} 
                                            onClick={() => setActiveModal({ type: 'dyrr', data: r })}
                                            style={docItemStyle}
                                            className="hover-lift"
                                          >
                                            <div style={{ fontWeight: '700' }}>{r.dyrr_number}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                              {r.received_by} • {new Date(r.created_at).toLocaleDateString()}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* WARPING TAB CONTENT */}
                            {activeSubTab === 'warping' && (
                              <div className="fade-in">
                                {/* Warping Breakdown Table */}
                                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '2rem' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                        <th style={thStyle}>Count</th>
                                        <th style={thStyle}>Colour</th>
                                        <th style={numericThStyle}>Required (kg)</th>
                                        <th style={numericThStyle}>Dyed Received (kg)</th>
                                        <th style={numericThStyle}>Delivered to Warping (kg)</th>
                                        <th style={numericThStyle}>Received from Warping (kg)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {breakdownData.filter(d => d.type === 'warp').length === 0 ? (
                                        <tr>
                                          <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                            No warping stage items defined for this order
                                          </td>
                                        </tr>
                                      ) : (
                                        breakdownData.filter(d => d.type === 'warp').map((row, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={tdStyle}>{formatYarnCount(row.countId)}</td>
                                            <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{row.colour}</td>
                                            <td style={numericTdStyle}>{row.required.toFixed(2)}</td>
                                            <td style={numericTdStyle}>{row.dyedReceived.toFixed(2)}</td>
                                            <td style={numericTdStyle}>{row.deliveredWarping.toFixed(2)}</td>
                                            <td style={{ ...numericTdStyle, color: row.receivedWarping > 0 ? '#047857' : '#6b7280' }}>
                                              {row.receivedWarping.toFixed(2)}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Warping Associated Documents */}
                                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <FileText size={16} color="var(--color-primary)" /> Warping Stage Documents
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                                  
                                  {/* DYDR list for warping */}
                                  <div style={docBoxStyle}>
                                    <h5 style={docBoxTitleStyle}>Dyed Deliveries (DYDR)</h5>
                                    <div style={docListContainerStyle}>
                                      {associatedDocs.dydrs.filter(d => (d.greige_yarn_delivery_items || d.dyed_yarn_delivery_items || []).some(item => item.process_type === 'warping')).length === 0 ? (
                                        <div style={emptyDocStyle}>No DYDRs linked</div>
                                      ) : (
                                        associatedDocs.dydrs.filter(d => (d.greige_yarn_delivery_items || d.dyed_yarn_delivery_items || []).some(item => item.process_type === 'warping')).map(d => (
                                          <div 
                                            key={d.id} 
                                            onClick={() => setActiveModal({ type: 'dydr', data: d })}
                                            style={docItemStyle}
                                            className="hover-lift"
                                          >
                                            <div style={{ fontWeight: '700' }}>{d.dydr_number}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                              {d.delivered_by} • {new Date(d.created_at).toLocaleDateString()}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>

                                  {/* Warping orders list */}
                                  <div style={docBoxStyle}>
                                    <h5 style={docBoxTitleStyle}>Warping Orders</h5>
                                    <div style={docListContainerStyle}>
                                      {associatedDocs.warping.length === 0 ? (
                                        <div style={emptyDocStyle}>No Warping Orders linked</div>
                                      ) : (
                                        associatedDocs.warping.map(w => (
                                          <div 
                                            key={w.id} 
                                            onClick={() => setActiveModal({ type: 'warping', data: w })}
                                            style={docItemStyle}
                                            className="hover-lift"
                                          >
                                            <div style={{ fontWeight: '700' }}>{w.warping_number}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                              Design: {w.design_no} • Status: {w.status}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* WEAVING TAB CONTENT */}
                            {activeSubTab === 'weaving' && (
                              <div className="fade-in">
                                {/* Weaving Breakdown Table */}
                                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '2rem' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                        <th style={thStyle}>Count</th>
                                        <th style={thStyle}>Colour</th>
                                        <th style={thStyle}>Type</th>
                                        <th style={numericThStyle}>Required (kg)</th>
                                        <th style={numericThStyle}>Delivered to Weaving (kg)</th>
                                        <th style={numericThStyle}>Received from Weaving (kg)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {breakdownData.length === 0 ? (
                                        <tr>
                                          <td colSpan="6" style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                            No weaving stage items defined for this order
                                          </td>
                                        </tr>
                                      ) : (
                                        breakdownData.map((row, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={tdStyle}>{formatYarnCount(row.countId)}</td>
                                            <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{row.colour}</td>
                                            <td style={tdStyle}>
                                              <span style={{ 
                                                padding: '0.15rem 0.4rem', 
                                                borderRadius: '4px', 
                                                fontSize: '0.7rem', 
                                                fontWeight: '800',
                                                textTransform: 'uppercase',
                                                backgroundColor: row.type === 'warp' ? '#eff6ff' : '#ecfdf5',
                                                color: row.type === 'warp' ? '#1e40af' : '#047857'
                                              }}>
                                                {row.type}
                                              </span>
                                            </td>
                                            <td style={numericTdStyle}>{row.required.toFixed(2)}</td>
                                            <td style={numericTdStyle}>{row.deliveredWeaving.toFixed(2)}</td>
                                            <td style={{ ...numericTdStyle, color: row.receivedWeaving > 0 ? '#047857' : '#6b7280' }}>
                                              {row.receivedWeaving.toFixed(2)}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                {/* Weaving Associated Documents */}
                                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <FileText size={16} color="var(--color-primary)" /> Weaving Stage Documents
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                                  
                                  {/* DYDR list for weaving */}
                                  <div style={docBoxStyle}>
                                    <h5 style={docBoxTitleStyle}>Dyed Deliveries (DYDR)</h5>
                                    <div style={docListContainerStyle}>
                                      {associatedDocs.dydrs.filter(d => (d.greige_yarn_delivery_items || d.dyed_yarn_delivery_items || []).some(item => item.process_type === 'weaving')).length === 0 ? (
                                        <div style={emptyDocStyle}>No DYDRs linked</div>
                                      ) : (
                                        associatedDocs.dydrs.filter(d => (d.greige_yarn_delivery_items || d.dyed_yarn_delivery_items || []).some(item => item.process_type === 'weaving')).map(d => (
                                          <div 
                                            key={d.id} 
                                            onClick={() => setActiveModal({ type: 'dydr', data: d })}
                                            style={docItemStyle}
                                            className="hover-lift"
                                          >
                                            <div style={{ fontWeight: '700' }}>{d.dydr_number}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                              {d.delivered_by} • {new Date(d.created_at).toLocaleDateString()}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>

                                  {/* Weaving orders list */}
                                  <div style={docBoxStyle}>
                                    <h5 style={docBoxTitleStyle}>Weaving Orders</h5>
                                    <div style={docListContainerStyle}>
                                      {associatedDocs.weaving.length === 0 ? (
                                        <div style={emptyDocStyle}>No Weaving Orders linked</div>
                                      ) : (
                                        associatedDocs.weaving.map(w => (
                                          <div 
                                            key={w.id} 
                                            onClick={() => setActiveModal({ type: 'weaving', data: w })}
                                            style={docItemStyle}
                                            className="hover-lift"
                                          >
                                            <div style={{ fontWeight: '700' }}>{w.weaving_number}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                              Design: {w.design_no} • Status: {w.status}
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Detail Overlay Modals */}
      {activeModal && (
        <DetailViewerModal 
          modal={activeModal} 
          onClose={() => setActiveModal(null)} 
          yarnCounts={yarnCounts}
          gydi={gydi}
          dyri={dyri}
          dydi={dydi}
          formatYarnCount={formatYarnCount}
        />
      )}

    </div>
  );
}

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
    <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '200px' }}>
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
                    backgroundColor: isChecked ? 'rgba(128, 0, 0, 0.05)' : 'transparent',
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

/* Modals Overlay Component */
function DetailViewerModal({ modal, onClose, yarnCounts, gydi, dyri, dydi, formatYarnCount }) {
  const { type, data } = modal;

  const handlePrint = () => {
    window.print();
  };

  // Specific content calculations based on type
  const renderContent = () => {
    switch (type) {
      case 'dof':
        return (
          <div>
            <div style={modalSectionGridStyle}>
              <ModalField label="Dyeing Order Form No" value={data.dof_number} highlight={true} />
              <ModalField label="Dyeing Partner" value={data.dyeing_unit?.partner_name || 'N/A'} />
              <ModalField label="Expected Delivery" value={data.expected_delivery_date ? new Date(data.expected_delivery_date).toLocaleDateString() : 'N/A'} />
              <ModalField label="Status" value={data.status} />
              <ModalField label="Created Date" value={new Date(data.created_at).toLocaleDateString()} />
              <ModalField label="Remarks" value={data.remarks || 'None'} />
            </div>

            <h4 style={modalSubTitleStyle}>Yarn Allocation Specifications</h4>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={thStyle}>Count</th>
                    <th style={thStyle}>Colour</th>
                    <th style={thStyle}>Type</th>
                    <th style={numericThStyle}>Base Qty (kg)</th>
                    <th style={numericThStyle}>Excess %</th>
                    <th style={numericThStyle}>Total Allocated (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.yarn_allocations || []).map((alloc, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={tdStyle}>{formatYarnCount(alloc.countId)}</td>
                      <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{alloc.colour}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800',
                          textTransform: 'uppercase', backgroundColor: alloc.type === 'warp' ? '#eff6ff' : '#ecfdf5',
                          color: alloc.type === 'warp' ? '#1e40af' : '#047857'
                        }}>{alloc.type}</span>
                      </td>
                      <td style={numericTdStyle}>{(alloc.base_kg || 0).toFixed(1)}</td>
                      <td style={numericTdStyle}>{(alloc.excess_percentage || 0).toFixed(0)}%</td>
                      <td style={{ ...numericTdStyle, fontWeight: '700' }}>{(alloc.total_kg || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'gydr':
        // Filter items matching receipt id
        const gydrItems = gydi.filter(item => item.receipt_id === data.id);
        return (
          <div>
            <div style={modalSectionGridStyle}>
              <ModalField label="GYDR Receipt No" value={data.gydr_number} highlight={true} />
              <ModalField label="Delivered By" value={data.delivered_by} />
              <ModalField label="Vehicle No" value={data.vehicle_no || 'N/A'} />
              <ModalField label="Delivery Date" value={new Date(data.created_at).toLocaleDateString()} />
              <ModalField label="DOF Reference" value={data.dof_number} />
              <ModalField label="Remarks" value={data.remarks || 'None'} />
            </div>

            <h4 style={modalSubTitleStyle}>Delivered Greige Yarn Items</h4>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={thStyle}>Count</th>
                    <th style={thStyle}>Colour</th>
                    <th style={thStyle}>Type</th>
                    <th style={numericThStyle}>Quantity (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {gydrItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={tdStyle}>{formatYarnCount(item.yarn_count_id)}</td>
                      <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{item.colour}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800',
                          textTransform: 'uppercase', backgroundColor: item.yarn_type === 'warp' ? '#eff6ff' : '#ecfdf5',
                          color: item.yarn_type === 'warp' ? '#1e40af' : '#047857'
                        }}>{item.yarn_type || 'warp'}</span>
                      </td>
                      <td style={{ ...numericTdStyle, fontWeight: '800', fontSize: '1rem' }}>{(item.quantity_kg || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'dyrr':
        const dyrrItems = dyri.filter(item => item.receipt_id === data.id);
        return (
          <div>
            <div style={modalSectionGridStyle}>
              <ModalField label="DYRR Receipt No" value={data.dyrr_number} highlight={true} />
              <ModalField label="Received By" value={data.received_by || 'N/A'} />
              <ModalField label="Vehicle No" value={data.vehicle_no || 'N/A'} />
              <ModalField label="Received Date" value={data.received_date ? new Date(data.received_date).toLocaleDateString() : 'N/A'} />
              <ModalField label="DOF Reference" value={data.dof_number || 'N/A'} />
              <ModalField label="Remarks" value={data.remarks || 'None'} />
            </div>

            <h4 style={modalSubTitleStyle}>Received Dyed Yarn Items</h4>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={thStyle}>Count</th>
                    <th style={thStyle}>Colour</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Lot Number</th>
                    <th style={thStyle}>Storage Location</th>
                    <th style={numericThStyle}>Bags</th>
                    <th style={numericThStyle}>Cone Wt (kg)</th>
                    <th style={numericThStyle}>Quantity Received (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {dyrrItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={tdStyle}>{formatYarnCount(item.yarn_count_id)}</td>
                      <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{item.colour}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800',
                          textTransform: 'uppercase', backgroundColor: item.yarn_type === 'warp' ? '#eff6ff' : '#ecfdf5',
                          color: item.yarn_type === 'warp' ? '#1e40af' : '#047857'
                        }}>{item.yarn_type || 'warp'}</span>
                      </td>
                      <td style={tdStyle}>{item.lot_number || '-'}</td>
                      <td style={tdStyle}>{item.location?.location_name || '-'}</td>
                      <td style={numericTdStyle}>{item.no_of_bags || '-'}</td>
                      <td style={numericTdStyle}>{item.cone_weight ? item.cone_weight.toFixed(3) : '-'}</td>
                      <td style={{ ...numericTdStyle, fontWeight: '800', fontSize: '1rem', color: '#16a34a' }}>{(item.quantity_kg || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'dydr':
        const dydrItems = dydi.filter(item => item.delivery_id === data.id);
        return (
          <div>
            <div style={modalSectionGridStyle}>
              <ModalField label="DYDR Delivery No" value={data.dydr_number} highlight={true} />
              <ModalField label="Delivered By" value={data.delivered_by || 'N/A'} />
              <ModalField label="Vehicle No" value={data.vehicle_no || 'N/A'} />
              <ModalField label="Delivery Date" value={data.delivered_date ? new Date(data.delivered_date).toLocaleDateString() : 'N/A'} />
              <ModalField label="Remarks" value={data.remarks || 'None'} />
            </div>

            <h4 style={modalSubTitleStyle}>Delivered Dyed Yarn Items</h4>
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={thStyle}>Count</th>
                    <th style={thStyle}>Colour</th>
                    <th style={thStyle}>Process Target</th>
                    <th style={numericThStyle}>Bags</th>
                    <th style={numericThStyle}>Cone Wt (kg)</th>
                    <th style={numericThStyle}>Quantity Sent (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {dydrItems.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={tdStyle}>{formatYarnCount(item.yarn_count_id)}</td>
                      <td style={{ ...tdStyle, fontWeight: '700', color: 'var(--color-primary)' }}>{item.colour}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '800',
                          textTransform: 'uppercase', backgroundColor: item.process_type === 'warping' ? '#fef3c7' : '#f3e8ff',
                          color: item.process_type === 'warping' ? '#d97706' : '#7c3aed'
                        }}>{item.process_type}</span>
                      </td>
                      <td style={numericTdStyle}>{item.no_of_bags || '-'}</td>
                      <td style={numericTdStyle}>{item.cone_weight ? item.cone_weight.toFixed(3) : '-'}</td>
                      <td style={{ ...numericTdStyle, fontWeight: '800', fontSize: '1rem', color: '#dc2626' }}>{(item.quantity_kg || 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'warping':
        return (
          <div>
            <div style={modalSectionGridStyle}>
              <ModalField label="Warping Order No" value={data.warping_number} highlight={true} />
              <ModalField label="Design Number" value={data.design_no || 'N/A'} />
              <ModalField label="Form Status" value={data.status} />
              <ModalField label="Created Date" value={new Date(data.created_at).toLocaleDateString()} />
            </div>
            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#fcfce8', borderRadius: '8px', border: '1px solid #fef08a' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#854d0e', fontWeight: '700', marginBottom: '0.5rem' }}>
                <AlertCircle size={18} /> Process Information
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#713f12', lineHeight: '1.5' }}>
                This warping & sizing form tracks the production layout of warp beams. Sizing receipts and detailed beam layouts are linked to order status. Complete the form in the Warping sizing panel.
              </p>
            </div>
          </div>
        );

      case 'weaving':
        return (
          <div>
            <div style={modalSectionGridStyle}>
              <ModalField label="Weaving Order No" value={data.weaving_number} highlight={true} />
              <ModalField label="Design Number" value={data.design_no || 'N/A'} />
              <ModalField label="Form Status" value={data.status} />
              <ModalField label="Created Date" value={new Date(data.created_at).toLocaleDateString()} />
            </div>
            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#fcfce8', borderRadius: '8px', border: '1px solid #fef08a' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#854d0e', fontWeight: '700', marginBottom: '0.5rem' }}>
                <AlertCircle size={18} /> Process Information
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#713f12', lineHeight: '1.5' }}>
                This weaving form manages the loom schedule. Fabric receipts and inspections details are recorded inside the Weaving production board. Complete loom setup to track receipts.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'dof': return `Dyeing Order Form: ${data.dof_number}`;
      case 'gydr': return `Greige Yarn Delivery Receipt: ${data.gydr_number}`;
      case 'dyrr': return `Dyed Yarn Material Receipt: ${data.dyrr_number}`;
      case 'dydr': return `Dyed Yarn Delivery Receipt: ${data.dydr_number}`;
      case 'warping': return `Warping Order Form: ${data.warping_number}`;
      case 'weaving': return `Weaving Order Form: ${data.weaving_number}`;
      default: return 'Document Detail';
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div className="print-modal-container" style={modalContainerStyle}>
        
        {/* Modal Header */}
        <div className="no-print" style={modalHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>{getTitle()}</h3>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {['gydr', 'dyrr', 'dydr', 'dof'].includes(type) && (
              <button onClick={handlePrint} className="btn" style={{ 
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem', 
                padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: '700', 
                backgroundColor: 'var(--color-primary)', color: '#fff', border: 'none',
                borderRadius: '6px', cursor: 'pointer'
              }}>
                <Printer size={15} /> Print Copy
              </button>
            )}
            <button onClick={onClose} className="btn-icon" style={{ padding: '0.25rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Body */}
        <div id="printable-area" style={modalBodyStyle}>
          
          {/* Logo block (shown when printing) */}
          <div className="print-only" style={{ display: 'none', borderBottom: '3px solid #7f1d1d', paddingBottom: '1rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#1a1a1a' }}>ASHOK TEXTILES</div>
              <div style={{ fontSize: '0.8rem', color: '#7f1d1d', fontWeight: '700', marginLeft: 'auto', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {type === 'dof' ? 'Dyeing Order Form' : type === 'gydr' ? 'Greige Yarn Delivery Receipt' : type === 'dyrr' ? 'Dyed Yarn Receipt' : 'Dyed Yarn Delivery'}
              </div>
            </div>
          </div>

          {renderContent()}

        </div>

      </div>

      <style>{`
        @media print {
          @page { margin: 15mm; }
          body * { visibility: hidden; }
          #printable-area, #printable-area * { visibility: visible; }
          #printable-area {
            position: absolute; left: 0; top: 0; width: 100%; padding: 0;
          }
          .print-only { display: block !important; }
          .no-print { display: none !important; }
          .print-modal-container {
            box-shadow: none !important; border: none !important; position: absolute; left: 0; top: 0; width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function ModalField({ label, value, highlight = false }) {
  return (
    <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ 
        fontSize: highlight ? '1rem' : '0.85rem', 
        fontWeight: '700', 
        color: highlight ? 'var(--color-primary)' : '#334155', 
        marginTop: '0.2rem',
        textTransform: label.toLowerCase() === 'remarks' ? 'none' : 'uppercase'
      }}>{value}</div>
    </div>
  );
}

/* Custom Styles */
const thStyle = {
  padding: '0.85rem 1rem',
  textAlign: 'left',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  fontWeight: '800',
  color: '#475569'
};

const numericThStyle = {
  ...thStyle,
  textAlign: 'right'
};

const tdStyle = {
  padding: '0.85rem 1rem',
  fontSize: '0.8rem',
  color: '#334155',
  fontWeight: '500'
};

const numericTdStyle = {
  ...tdStyle,
  textAlign: 'right',
  fontWeight: '700'
};

const docBoxStyle = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
};

const docBoxTitleStyle = {
  margin: 0,
  fontSize: '0.85rem',
  fontWeight: '800',
  color: '#475569',
  borderBottom: '1px solid #e2e8f0',
  paddingBottom: '0.5rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const docListContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  maxHeight: '180px',
  overflowY: 'auto'
};

const emptyDocStyle = {
  textAlign: 'center',
  fontSize: '0.75rem',
  color: '#94a3b8',
  padding: '1rem 0'
};

const docItemStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  cursor: 'pointer',
  fontSize: '0.8rem',
  color: '#1e293b',
  transition: 'transform 0.15s, border-color 0.15s'
};

/* Modal Specific Styles */
const modalOverlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.65)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '2rem'
};

const modalContainerStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '850px',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  display: 'flex',
  flexDirection: 'column'
};

const modalHeaderStyle = {
  padding: '1rem 1.5rem',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#f8fafc',
  borderTopLeftRadius: '16px',
  borderTopRightRadius: '16px'
};

const modalBodyStyle = {
  padding: '2rem',
  overflowY: 'auto'
};

const modalSubTitleStyle = {
  fontSize: '0.9rem',
  fontWeight: '800',
  color: '#475569',
  margin: '1.5rem 0 0.75rem 0',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const modalSectionGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '1rem',
  marginBottom: '1.5rem'
};
