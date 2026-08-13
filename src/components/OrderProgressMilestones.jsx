import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Clock, FileText, Zap, Layers, SlidersHorizontal, Package, Truck, Search, Send, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function OrderProgressMilestones({
  order,
  existingPIs = [],
  orderDofs = [],
  allDyrrs = [],
  orderWofs = [],
  orderSofs = [],
  orderWvofs = [],
  orderPofs = [],
  orderBills = [],
  totalWeavedQty = 0,
  totalDispatchedQty = 0
}) {
  const [hoveredMilestone, setHoveredMilestone] = useState(null);
  const [dyeingStats, setDyeingStats] = useState({ sentKg: 0, receivedKg: 0 });
  const [productionStats, setProductionStats] = useState({
    warpedQty: 0,
    sizedQty: 0,
    weavedQty: 0,
    wofCompleted: false,
    sofCompleted: false,
    wvofCompleted: false,
    hasWof: false,
    hasSof: false,
    hasWvof: false
  });

  const [piList, setPiList] = useState(existingPIs || []);

  useEffect(() => {
    async function fetchPIs() {
      if (!order?.id) return;
      try {
        const orderIdStr = String(order.id);
        const orderNoStr = order.order_number ? String(order.order_number) : null;
        const { data } = await supabase
          .from('proforma_invoices')
          .select('id, order_id, order_ids, items');
        const matched = (data || []).filter(pi => 
          pi.order_id === orderIdStr ||
          (Array.isArray(pi.order_ids) && (pi.order_ids.includes(orderIdStr) || (orderNoStr && pi.order_ids.includes(orderNoStr)))) ||
          (Array.isArray(pi.items) && pi.items.some(it => 
            it.order_id === orderIdStr || it.orderId === orderIdStr || 
            (orderNoStr && (it.order_number === orderNoStr || it.order_no === orderNoStr))
          ))
        );
        setPiList(matched);
      } catch (err) {
        console.error("Error fetching PIs for milestones:", err);
      }
    }
    fetchPIs();
  }, [order?.id, existingPIs]);

  useEffect(() => {
    async function fetchDyeingTotals() {
      if (!order?.id) return;
      try {
        const orderIdStr = String(order.id);
        const orderNoStr = order.order_number ? String(order.order_number) : null;
        const orderIdsArray = Array.from(new Set([orderIdStr, orderNoStr].filter(Boolean)));

        // 1. Fetch DOFs linked to this order
        let dofData = orderDofs || [];
        if (!Array.isArray(dofData) || dofData.length === 0) {
          const { data: rawDofs, error: dofErr } = await supabase
            .from('dyeing_order_forms')
            .select('id, status, dof_number, yarn_allocations, order_ids');
          if (dofErr) console.error("Error querying DOFs:", dofErr);
          dofData = (rawDofs || []).filter(d => {
            if (!d) return false;
            if (Array.isArray(d.order_ids) && d.order_ids.some(id => orderIdsArray.includes(String(id)))) return true;
            if (Array.isArray(d.yarn_allocations) && d.yarn_allocations.some(a => orderIdsArray.includes(String(a.orderId || a.order_id)))) return true;
            return false;
          });
        }
        const dofIds = Array.from(new Set((dofData || []).map(d => d.id).filter(Boolean)));

        let totalSentKg = 0;
        let totalReceivedKg = 0;

        if (dofIds.length > 0) {
          // 2. Fetch Greige Yarn Deliveries (GYDR) for these DOFs via receipt header
          const { data: gydrReceipts, error: gydrErr } = await supabase
            .from('greige_yarn_delivery_receipts')
            .select('id, dof_id, greige_yarn_delivery_items(id, quantity_kg)')
            .in('dof_id', dofIds);
          
          if (!gydrErr && gydrReceipts) {
            gydrReceipts.forEach(r => {
              const items = Array.isArray(r.greige_yarn_delivery_items) ? r.greige_yarn_delivery_items : [];
              items.forEach(item => {
                totalSentKg += parseFloat(item.quantity_kg || 0);
              });
            });
          }

          // 3. Fetch Dyed Yarn Receipts (DYRR) for these DOFs via receipt header
          const { data: dyrrReceipts, error: dyrrErr } = await supabase
            .from('dyed_yarn_receipts')
            .select('id, dof_id, source_type, dyed_yarn_receipt_items(id, quantity_kg, is_excess)')
            .in('dof_id', dofIds);
          
          if (!dyrrErr && dyrrReceipts) {
            dyrrReceipts.forEach(r => {
              if (r.source_type === 'production') return; // Skip production returns
              const items = Array.isArray(r.dyed_yarn_receipt_items) ? r.dyed_yarn_receipt_items : [];
              items.forEach(item => {
                if (!item.is_excess) {
                  totalReceivedKg += parseFloat(item.quantity_kg || 0);
                }
              });
            });
          }
        }

        // Deduct returns if any
        const { data: returnData } = await supabase
          .from('greige_yarn_receipts')
          .select('total_weight')
          .eq('receipt_type', 'production')
          .eq('order_id', order.id);
        const returnTotal = (returnData || []).reduce((sum, r) => sum + parseFloat(r.total_weight || 0), 0);
        let netSentKg = Math.max(0, totalSentKg - returnTotal);

        // Fallbacks: If items table sums returned 0 but DOFs are marked sent/received, sum yarn_allocations
        if (netSentKg === 0 && dofData.some(d => d.status === 'fully_sent' || d.status === 'received' || d.status === 'partially_sent' || d.status === 'partially_received')) {
          dofData.forEach(dof => {
            if (dof.status === 'fully_sent' || dof.status === 'received' || dof.status === 'partially_sent' || dof.status === 'partially_received') {
              (dof.yarn_allocations || []).forEach(alloc => {
                if (!alloc.orderId || orderIdsArray.includes(String(alloc.orderId || alloc.order_id))) {
                  netSentKg += parseFloat(alloc.total_kg || alloc.kg || alloc.required_qty || 0);
                }
              });
            }
          });
        }

        if (totalReceivedKg === 0 && dofData.some(d => d.status === 'received')) {
          dofData.forEach(dof => {
            if (dof.status === 'received') {
              (dof.yarn_allocations || []).forEach(alloc => {
                if (!alloc.orderId || orderIdsArray.includes(String(alloc.orderId || alloc.order_id))) {
                  totalReceivedKg += parseFloat(alloc.total_kg || alloc.kg || alloc.required_qty || 0);
                }
              });
            }
          });
        }

        setDyeingStats({
          sentKg: netSentKg,
          receivedKg: totalReceivedKg
        });
      } catch (err) {
        console.error("Error fetching dyeing stats for progress bar:", err);
      }
    }

    async function fetchProductionTotals() {
      if (!order?.id) return;
      try {
        // 1. Fetch WOFs
        const { data: wofsData, error: wofErr } = await supabase
          .from('warping_order_forms')
          .select('id, qty, status')
          .eq('order_id', order.id);
        if (wofErr) console.error("Error fetching WOFs:", wofErr);

        const combinedWofs = [...(orderWofs || []), ...(wofsData || [])];
        const uniqueWofsMap = new Map();
        combinedWofs.forEach(w => {
          if (w && w.id && !uniqueWofsMap.has(w.id)) {
            uniqueWofsMap.set(w.id, w);
          }
        });
        const wofs = Array.from(uniqueWofsMap.values());
        const totalWarped = wofs.reduce((sum, w) => sum + parseFloat(w.qty || 0), 0);

        // 2. Fetch SOFs
        const { data: sofsData, error: sofErr } = await supabase
          .from('sizing_order_forms')
          .select('id, qty, status')
          .eq('order_id', order.id);
        if (sofErr) console.error("Error fetching SOFs:", sofErr);

        const combinedSofs = [...(orderSofs || []), ...(sofsData || [])];
        const uniqueSofsMap = new Map();
        combinedSofs.forEach(s => {
          if (s && s.id && !uniqueSofsMap.has(s.id)) {
            uniqueSofsMap.set(s.id, s);
          }
        });
        const sofs = Array.from(uniqueSofsMap.values());
        const totalSized = sofs.reduce((sum, s) => sum + parseFloat(s.qty || 0), 0);

        // 3. Fetch WVOFs
        const { data: wvofsData, error: wvofErr } = await supabase
          .from('weaving_orders')
          .select('id, production_logs, status')
          .eq('order_id', order.id);
        if (wvofErr) console.error("Error fetching WVOFs:", wvofErr);

        const combinedWvofs = [...(orderWvofs || []), ...(wvofsData || [])];
        const uniqueWvofsMap = new Map();
        combinedWvofs.forEach(wv => {
          if (wv && wv.id && !uniqueWvofsMap.has(wv.id)) {
            uniqueWvofsMap.set(wv.id, wv);
          }
        });
        const wvofs = Array.from(uniqueWvofsMap.values());
        let totalWeaved = 0;
        wvofs.forEach(wv => {
          const logs = Array.isArray(wv.production_logs) ? wv.production_logs : [];
          logs.forEach(log => {
            totalWeaved += parseFloat(log.qty || log.meters || 0);
          });
        });

        setProductionStats({
          warpedQty: totalWarped,
          sizedQty: totalSized,
          weavedQty: totalWeaved,
          wofCompleted: wofs.some(w => w.status === 'completed'),
          sofCompleted: sofs.some(s => s.status === 'completed'),
          wvofCompleted: wvofs.some(w => w.status === 'completed'),
          hasWof: wofs.length > 0,
          hasSof: sofs.length > 0,
          hasWvof: wvofs.length > 0
        });
      } catch (err) {
        console.error("Error fetching production stats for progress bar:", err);
      }
    }

    fetchDyeingTotals();
    fetchProductionTotals();
  }, [order?.id, orderDofs, orderWofs, orderSofs, orderWvofs]);

  const milestonesData = useMemo(() => {
    if (!order) return [];

    const specs = order.technical_specs || {};
    const targetProdQty = Number(specs.production_quantity || order.total_quantity || 0);
    const targetOrderQty = Number(order.total_quantity || 0);

    // 1. START
    const startStatus = 'completed';
    const startInfo = {
      title: 'START',
      label: 'Order Created',
      icon: Play,
      status: startStatus,
      completedQty: targetOrderQty,
      targetQty: targetOrderQty,
      unit: 'Mtrs',
      note: `Created on ${new Date(order.created_at).toLocaleDateString()}`
    };

    // 2. PI & PO
    const hasPI = (existingPIs && existingPIs.length > 0) || (piList && piList.length > 0);
    const hasPO = Boolean(order.buyer_po_number || order.buyer_po_file_url);
    let piPoStatus = 'not_started';
    if (hasPI && hasPO) {
      piPoStatus = 'completed';
    } else if (hasPI || hasPO) {
      piPoStatus = 'in_progress';
    }
    const piPoInfo = {
      title: 'PI & PO',
      label: 'PI & Buyer PO',
      icon: FileText,
      status: piPoStatus,
      completedQty: (hasPI ? 1 : 0) + (hasPO ? 1 : 0),
      targetQty: 2,
      unit: 'Docs',
      note: `PI: ${hasPI ? 'Created' : 'Pending'} | PO: ${hasPO ? (order.buyer_po_number || 'Uploaded') : 'Pending'}`
    };

    // 3. DYEING
    let totalGreigeYarnReqKg = (order.yarn_requirements || []).reduce((sum, yr) => {
      return sum + parseFloat(yr.kg || yr.required_qty || yr.weight || yr.total_kg || 0);
    }, 0);

    if (totalGreigeYarnReqKg === 0) {
      (orderDofs || []).forEach(dof => {
        const items = Array.isArray(dof.dof_items) ? dof.dof_items : [];
        items.forEach(item => {
          totalGreigeYarnReqKg += parseFloat(item.required_qty || item.quantity_kg || 0);
        });
        (dof.yarn_allocations || []).forEach(alloc => {
          if (!alloc.orderId || alloc.orderId === order.id || alloc.order_id === order.id) {
            totalGreigeYarnReqKg += parseFloat(alloc.total_kg || alloc.kg || alloc.required_qty || 0);
          }
        });
      });
    }

    const totalSentYarnKg = dyeingStats.sentKg;
    const totalReceivedDyedYarnKg = dyeingStats.receivedKg;

    let dyeingStatus = 'not_started';
    if (orderDofs.length === 0 && totalGreigeYarnReqKg === 0) {
      dyeingStatus = 'completed'; // Greige order or no dyeing required
    } else if (totalGreigeYarnReqKg > 0 && totalReceivedDyedYarnKg >= totalGreigeYarnReqKg - 0.1) {
      dyeingStatus = 'completed';
    } else if (totalReceivedDyedYarnKg > 0 || totalSentYarnKg > 0 || orderDofs.length > 0) {
      dyeingStatus = 'in_progress';
    }

    const dyeingInfo = {
      title: 'DYEING',
      label: 'Dyed Yarn',
      icon: Zap,
      status: dyeingStatus,
      completedQty: totalReceivedDyedYarnKg,
      sentQty: totalSentYarnKg,
      targetQty: totalGreigeYarnReqKg,
      unit: 'Kgs',
      note: orderDofs.length === 0 && totalGreigeYarnReqKg === 0 ? 'No Yarn Dyeing Required' : `${totalReceivedDyedYarnKg.toLocaleString()} / ${totalGreigeYarnReqKg.toLocaleString()} Kgs Received`
    };

    // 4. WARPING
    let totalWarpedQty = productionStats.warpedQty;
    if (totalWarpedQty === 0) {
      (orderWofs || []).forEach(wof => {
        totalWarpedQty += parseFloat(wof.qty || wof.total_warped_meters || wof.target_warp_meters || wof.qty_meters || 0);
      });
    }

    let warpingStatus = 'not_started';
    if ((targetProdQty > 0 && totalWarpedQty >= targetProdQty - 0.1) || productionStats.wofCompleted || (orderWofs || []).some(w => w.status === 'completed')) {
      warpingStatus = 'completed';
    } else if (totalWarpedQty > 0 || productionStats.hasWof || (orderWofs || []).length > 0) {
      warpingStatus = 'in_progress';
    }

    const warpingInfo = {
      title: 'WARPING',
      label: 'Warp Production',
      completedLabel: 'Warped Qty',
      icon: Layers,
      status: warpingStatus,
      completedQty: totalWarpedQty,
      targetQty: targetProdQty,
      unit: 'Mtrs',
      note: `${totalWarpedQty.toLocaleString()} / ${targetProdQty.toLocaleString()} Mtrs Warped`
    };

    // 5. SIZING
    let totalSizedQty = productionStats.sizedQty;
    if (totalSizedQty === 0) {
      (orderSofs || []).forEach(sof => {
        totalSizedQty += parseFloat(sof.qty || sof.total_sized_meters || sof.sizing_length_meters || sof.qty_meters || 0);
      });
    }

    let sizingStatus = 'not_started';
    if ((targetProdQty > 0 && totalSizedQty >= targetProdQty - 0.1) || productionStats.sofCompleted || (orderSofs || []).some(s => s.status === 'completed')) {
      sizingStatus = 'completed';
    } else if (totalSizedQty > 0 || productionStats.hasSof || (orderSofs || []).length > 0) {
      sizingStatus = 'in_progress';
    }

    const sizingInfo = {
      title: 'SIZING',
      label: 'Sizing Process',
      completedLabel: 'Sized Qty',
      icon: SlidersHorizontal,
      status: sizingStatus,
      completedQty: totalSizedQty,
      targetQty: targetProdQty,
      unit: 'Mtrs',
      note: `${totalSizedQty.toLocaleString()} / ${targetProdQty.toLocaleString()} Mtrs Sized`
    };

    // 6. WEAVING
    let totalWeavedMeters = Math.max(totalWeavedQty || 0, productionStats.weavedQty || 0);
    if (totalWeavedMeters === 0) {
      (orderWvofs || []).forEach(wv => {
        const logs = Array.isArray(wv.production_logs) ? wv.production_logs : [];
        logs.forEach(log => {
          totalWeavedMeters += parseFloat(log.qty || log.meters || 0);
        });
      });
    }

    let weavingStatus = 'not_started';
    if ((targetProdQty > 0 && totalWeavedMeters >= targetProdQty - 0.1) || productionStats.wvofCompleted || (orderWvofs || []).some(wv => wv.status === 'completed')) {
      weavingStatus = 'completed';
    } else if (totalWeavedMeters > 0 || productionStats.hasWvof || (orderWvofs || []).length > 0) {
      weavingStatus = 'in_progress';
    }

    const weavingInfo = {
      title: 'WEAVING',
      label: 'Loom Weaving',
      completedLabel: 'Weaved Qty',
      icon: Package,
      status: weavingStatus,
      completedQty: totalWeavedMeters,
      targetQty: targetProdQty,
      unit: 'Mtrs',
      note: `${totalWeavedMeters.toLocaleString()} / ${targetProdQty.toLocaleString()} Mtrs Weaved`
    };

    // 7. PROCESSING
    const orderIdStr = String(order.id);
    const orderNoStr = order.order_number ? String(order.order_number) : null;

    const thisOrderPofs = (orderPofs || []).filter(pof => {
      if (!pof) return false;
      if (pof.order_id === orderIdStr || pof.order_id === orderNoStr) return true;
      if (Array.isArray(pof.order_ids) && (pof.order_ids.includes(orderIdStr) || (orderNoStr && pof.order_ids.includes(orderNoStr)))) return true;
      const rolls = Array.isArray(pof.fabric_rolls) ? pof.fabric_rolls : [];
      if (rolls.some(r => r && (r.order_number === orderNoStr || r.order_id === orderIdStr || r.allotted_order_id === orderIdStr))) return true;
      const rxRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
      if (rxRolls.some(r => r && (r.order_number === orderNoStr || r.order_id === orderIdStr || r.allotted_order_id === orderIdStr))) return true;
      return false;
    });

    let totalPofQty = 0;
    let totalPofReceivedQty = 0;
    thisOrderPofs.forEach(pof => {
      if (pof.is_rewash) return;
      const rolls = Array.isArray(pof.fabric_rolls) ? pof.fabric_rolls : [];
      let pofSentQty = 0;
      if (rolls.length > 0) {
        rolls.forEach(r => {
          if (!r.order_number || r.order_number === orderNoStr || r.order_id === orderIdStr || r.allotted_order_id === orderIdStr) {
            pofSentQty += parseFloat(r.actual_qty || r.qty || r.actual_meters || r.meters || 0);
          }
        });
      } else {
        pofSentQty += parseFloat(pof.total_qty || pof.total_meters || pof.sent_qty || pof.qty || 0);
      }
      totalPofQty += pofSentQty;

      const rxRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
      let pofRxSum = 0;
      rxRolls.forEach(r => {
        if (!r.order_number || r.order_number === orderNoStr || r.order_id === orderIdStr || r.allotted_order_id === orderIdStr) {
          pofRxSum += parseFloat(r.actual_qty || r.qty || r.actual_meters || r.meters || 0);
        }
      });
      if (pofRxSum === 0 && rolls.length > 0) {
        rolls.forEach(r => {
          if (r.status === 'received_from_processing' || r.isProcessed) {
            if (!r.order_number || r.order_number === orderNoStr || r.order_id === orderIdStr || r.allotted_order_id === orderIdStr) {
              pofRxSum += parseFloat(r.actual_qty || r.qty || r.actual_meters || r.meters || 0);
            }
          }
        });
      }
      totalPofReceivedQty += pofRxSum;
    });

    let processingStatus = 'not_started';
    if (targetProdQty > 0 && (totalPofReceivedQty >= targetProdQty - 0.1 || totalPofQty >= targetProdQty - 0.1)) {
      processingStatus = 'completed';
    } else if (totalPofQty > 0 || totalPofReceivedQty > 0 || thisOrderPofs.length > 0) {
      processingStatus = 'in_progress';
    }

    const processingInfo = {
      title: 'PROCESSING',
      label: 'Fabric Processing',
      completedLabel: 'POF Received Qty',
      icon: Truck,
      status: processingStatus,
      completedQty: totalPofReceivedQty > 0 ? totalPofReceivedQty : totalPofQty,
      sentQty: totalPofQty,
      receivedQty: totalPofReceivedQty,
      targetQty: targetProdQty,
      unit: 'Mtrs',
      note: `${(totalPofReceivedQty > 0 ? totalPofReceivedQty : totalPofQty).toLocaleString()} / ${targetProdQty.toLocaleString()} Mtrs Processed`
    };

    // 8. INSPECTION (Washed Inspection)
    let totalInspectedQty = 0;
    (orderWvofs || []).forEach(wv => {
      const rolls = Array.isArray(wv.fabric_rolls) ? wv.fabric_rolls : [];
      rolls.forEach(r => {
        if (r.washed_inspected === true || r.washed_inspected === 'true' || r.washed_inspected === 1 || r.washed_inspected_at) {
          totalInspectedQty += parseFloat(r.washed_actual_qty || r.actual_qty || r.qty || 0);
        }
      });
    });
    thisOrderPofs.forEach(pof => {
      const rxRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
      rxRolls.forEach(r => {
        const isWashedInspected = Boolean(
          r.washed_inspected === true ||
          r.washed_inspected === 'true' ||
          r.washed_inspected === 1 ||
          r.washed_inspected_at ||
          r.washed_inspector_1 ||
          (r.washed_actual_qty !== undefined && r.washed_actual_qty !== null && parseFloat(r.washed_actual_qty) > 0)
        );
        if (isWashedInspected) {
          totalInspectedQty += parseFloat(r.washed_actual_qty || r.actual_qty || r.qty || 0);
        }
      });
    });

    let inspectionStatus = 'not_started';
    if (targetProdQty > 0 && totalInspectedQty >= targetProdQty - 0.1) {
      inspectionStatus = 'completed';
    } else if (totalInspectedQty > 0) {
      inspectionStatus = 'in_progress';
    }

    const inspectionInfo = {
      title: 'INSPECTION',
      label: 'Washed Inspection',
      completedLabel: 'Washed Inspected Qty',
      icon: Search,
      status: inspectionStatus,
      completedQty: totalInspectedQty,
      targetQty: targetProdQty,
      unit: 'Mtrs',
      note: `${totalInspectedQty.toLocaleString()} / ${targetProdQty.toLocaleString()} Mtrs Washed Inspected`
    };

    // 9. DISPATCH
    let actualDispatchedQty = totalDispatchedQty || 0;
    if (actualDispatchedQty === 0 && (orderBills || []).length > 0) {
      const orderIdStr = String(order.id);
      const orderNoStr = order.order_number ? String(order.order_number) : null;
      (orderBills || []).forEach(b => {
        const items = Array.isArray(b.items) ? b.items : [];
        items.forEach(i => {
          if (i.order_id === orderIdStr || i.order_id === orderNoStr || i.order_number === orderNoStr) {
            actualDispatchedQty += parseFloat(i.qty || i.meters || i.dispatched_qty || 0);
          }
        });
      });
    }

    let dispatchStatus = 'not_started';
    if (targetOrderQty > 0 && actualDispatchedQty >= targetOrderQty - 0.1) {
      dispatchStatus = 'completed';
    } else if (actualDispatchedQty > 0) {
      dispatchStatus = 'in_progress';
    }

    const dispatchInfo = {
      title: 'DISPATCH',
      label: 'Order Dispatch',
      completedLabel: 'Dispatched Qty',
      icon: Send,
      status: dispatchStatus,
      completedQty: actualDispatchedQty,
      targetQty: targetOrderQty,
      unit: 'Mtrs',
      note: `${actualDispatchedQty.toLocaleString()} / ${targetOrderQty.toLocaleString()} Mtrs Dispatched`
    };

    return [
      startInfo,
      piPoInfo,
      dyeingInfo,
      warpingInfo,
      sizingInfo,
      weavingInfo,
      processingInfo,
      inspectionInfo,
      dispatchInfo
    ];
  }, [order, existingPIs, orderDofs, allDyrrs, orderWofs, orderSofs, orderWvofs, orderPofs, orderBills, totalWeavedQty, totalDispatchedQty]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return {
          bg: '#16a34a',
          lightBg: '#dcfce7',
          border: '#22c55e',
          text: '#15803d',
          badgeText: 'Completed'
        };
      case 'in_progress':
        return {
          bg: '#eab308',
          lightBg: '#fef9c3',
          border: '#ca8a04',
          text: '#a16207',
          badgeText: 'In Progress'
        };
      default:
        return {
          bg: '#94a3b8',
          lightBg: '#f1f5f9',
          border: '#cbd5e1',
          text: '#64748b',
          badgeText: 'Not Started'
        };
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      borderRadius: '16px',
      padding: '1.25rem 1.5rem 1.5rem 1.5rem',
      marginBottom: '1.25rem',
      boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 4px 10px -2px rgba(15, 23, 42, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
      position: 'relative',
      overflow: 'visible'
    }}>
      <style>{`
        @keyframes livePulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        @keyframes ringPulse {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }

        @keyframes tooltipFadeIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(6px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .milestone-node-clean {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .milestone-node-clean:hover {
          transform: translateY(-4px) !important;
        }
      `}</style>

      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '0.85rem',
        borderBottom: '1px solid #f1f5f9'
      }}>
        {/* Title & Live Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '3px 10px',
            borderRadius: '20px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              animation: 'livePulse 2s infinite'
            }} />
            <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#047857', letterSpacing: '0.06em' }}>LIVE</span>
          </div>

          <h3 style={{
            fontSize: '0.88rem',
            fontWeight: '800',
            color: '#0f172a',
            letterSpacing: '0.03em',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            REAL-TIME ORDER PROGRESS
          </h3>

          <span style={{
            fontSize: '0.7rem',
            color: '#64748b',
            backgroundColor: '#f8fafc',
            padding: '3px 10px',
            borderRadius: '12px',
            fontWeight: '700',
            border: '1px solid #e2e8f0'
          }}>
            9 Milestones
          </span>
        </div>

        {/* Overall Progress Meter & Legend */}
        {(() => {
          const completedCount = milestonesData.filter(m => m.status === 'completed').length;
          const inProgressCount = milestonesData.filter(m => m.status === 'in_progress').length;
          const overallPct = Math.round(((completedCount + inProgressCount * 0.5) / milestonesData.length) * 100);

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {/* Mini Overall Progress Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#ffffff', padding: '0.35rem 0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall</span>
                <div style={{ width: '80px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${overallPct}%`,
                    height: '100%',
                    backgroundColor: '#10b981',
                    borderRadius: '3px',
                    transition: 'width 0.6s ease'
                  }} />
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: '850', color: '#0f172a' }}>{overallPct}%</span>
              </div>

              {/* Status Legend Pills */}
              <div style={{ display: 'flex', gap: '0.65rem', fontSize: '0.68rem', fontWeight: '700' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#047857', backgroundColor: '#f0fdf4', padding: '3px 9px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }}></span> Completed ({completedCount})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#b45309', backgroundColor: '#fffbeb', padding: '3px 9px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span> In Progress ({inProgressCount})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', backgroundColor: '#f8fafc', padding: '3px 9px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#cbd5e1' }}></span> Pending ({milestonesData.length - completedCount - inProgressCount})
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Modern Sleek Progress Timeline Track & Nodes */}
      <div style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '0.25rem 0.5rem 0 0.5rem'
      }}>
        {/* Background Track Line */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '3.5%',
          right: '3.5%',
          height: '4px',
          backgroundColor: '#e2e8f0',
          borderRadius: '2px',
          zIndex: 0
        }} />

        {milestonesData.map((m, idx) => {
          const style = getStatusColor(m.status);
          const IconComp = m.icon;
          const isHovered = hoveredMilestone === idx;

          // Connecting line status
          const nextMilestone = milestonesData[idx + 1];
          const isLineActive = nextMilestone && (nextMilestone.status === 'completed' || nextMilestone.status === 'in_progress');
          const isCurrentCompleted = m.status === 'completed';

          const completed = Number(m.completedQty || 0);
          const target = Number(m.targetQty || 0);
          const balance = Math.max(0, target - completed);
          const pct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : (m.status === 'completed' ? 100 : 0);

          return (
            <div
              key={m.title}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                zIndex: isHovered ? 100 : 1
              }}
              onMouseEnter={() => setHoveredMilestone(idx)}
              onMouseLeave={() => setHoveredMilestone(null)}
            >
              {/* Active Progress Connector Segment to Next Node */}
              {idx < milestonesData.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    width: '100%',
                    height: '4px',
                    borderRadius: '2px',
                    backgroundColor: (isLineActive || isCurrentCompleted) ? '#10b981' : 'transparent',
                    transition: 'background-color 0.4s ease',
                    zIndex: 0
                  }}
                />
              )}

              {/* Clean Minimalist Milestone Node Badge */}
              <div
                className="milestone-node-clean"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 2,
                  ...(m.status === 'completed' ? {
                    backgroundColor: '#10b981',
                    boxShadow: isHovered
                      ? '0 6px 16px rgba(16, 185, 129, 0.4)'
                      : '0 3px 10px rgba(16, 185, 129, 0.25)',
                    border: '3px solid #ffffff'
                  } : m.status === 'in_progress' ? {
                    backgroundColor: '#ffffff',
                    boxShadow: isHovered
                      ? '0 6px 16px rgba(245, 158, 11, 0.4)'
                      : '0 2px 8px rgba(245, 158, 11, 0.2)',
                    border: '3px solid #f59e0b',
                    animation: 'ringPulse 2s infinite'
                  } : {
                    backgroundColor: '#f8fafc',
                    boxShadow: isHovered ? '0 4px 10px rgba(0,0,0,0.08)' : 'none',
                    border: '2px solid #cbd5e1'
                  })
                }}
              >
                {m.status === 'completed' ? (
                  <CheckCircle2 size={20} color="#ffffff" />
                ) : m.status === 'in_progress' ? (
                  <Clock size={19} color="#d97706" />
                ) : (
                  <IconComp size={18} color="#94a3b8" />
                )}
              </div>

              {/* Node Step Info (Number & Title) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginTop: '0.55rem',
                gap: '0.12rem'
              }}>
                <span style={{
                  fontSize: '0.6rem',
                  fontWeight: '700',
                  color: m.status === 'completed' ? '#059669' : m.status === 'in_progress' ? '#d97706' : '#94a3b8',
                  backgroundColor: m.status === 'completed' ? '#ecfdf5' : m.status === 'in_progress' ? '#fffbeb' : '#f1f5f9',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  border: `1px solid ${m.status === 'completed' ? '#a7f3d0' : m.status === 'in_progress' ? '#fde68a' : '#e2e8f0'}`
                }}>
                  {String(idx + 1).padStart(2, '0')}
                </span>

                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: m.status === 'completed' ? '800' : m.status === 'in_progress' ? '800' : '600',
                  color: m.status === 'completed' ? '#0f172a' : m.status === 'in_progress' ? '#b45309' : '#64748b',
                  textAlign: 'center',
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                  marginTop: '0.15rem'
                }}>
                  {m.title}
                </span>

                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: '600',
                  color: m.status === 'completed' ? '#10b981' : m.status === 'in_progress' ? '#f59e0b' : '#94a3b8'
                }}>
                  {pct}%
                </span>
              </div>

              {/* Hover Tooltip Card */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    marginBottom: '12px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    padding: '0.85rem 1.1rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    boxShadow: '0 15px 30px -5px rgba(15, 23, 42, 0.4), 0 0 1px rgba(255,255,255,0.2)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 999,
                    minWidth: '220px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    animation: 'tooltipFadeIn 0.18s ease-out'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <IconComp size={15} color="#38bdf8" />
                      <strong style={{ fontSize: '0.82rem', color: '#f8fafc', fontWeight: '800' }}>{m.label} ({m.title})</strong>
                    </div>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: '800',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      backgroundColor: style.lightBg,
                      color: style.text
                    }}>
                      {style.badgeText}
                    </span>
                  </div>

                  {m.title === 'DYEING' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Greige Yarn Req (Target):</span> <strong style={{ color: '#f8fafc' }}>{target.toLocaleString()} {m.unit}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sent to Dyeing:</span> <strong style={{ color: '#60a5fa' }}>{Number(m.sentQty || 0).toLocaleString()} {m.unit}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Received from Dyeing:</span> <strong style={{ color: '#4ade80' }}>{completed.toLocaleString()} {m.unit}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Balance Qty:</span> <strong style={{ color: balance > 0 ? '#facc15' : '#94a3b8' }}>{balance.toLocaleString()} {m.unit}</strong></div>
                    </div>
                  ) : m.title === 'PROCESSING' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Target (Production Qty):</span> <strong style={{ color: '#f8fafc' }}>{target.toLocaleString()} {m.unit}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sent to Processing (POF Qty):</span> <strong style={{ color: '#60a5fa' }}>{Number(m.sentQty || 0).toLocaleString()} {m.unit}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Received from Processing:</span> <strong style={{ color: '#4ade80' }}>{Number(m.receivedQty || 0).toLocaleString()} {m.unit}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Balance Qty:</span> <strong style={{ color: balance > 0 ? '#facc15' : '#94a3b8' }}>{balance.toLocaleString()} {m.unit}</strong></div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#cbd5e1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Target ({m.unit === 'Mtrs' ? 'Production Qty' : 'Target Qty'}):</span> <strong style={{ color: '#f8fafc' }}>{target.toLocaleString()} {m.unit}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{m.completedLabel || 'Completed Qty'}:</span> <strong style={{ color: '#4ade80' }}>{completed.toLocaleString()} {m.unit}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Balance Qty:</span> <strong style={{ color: balance > 0 ? '#facc15' : '#94a3b8' }}>{balance.toLocaleString()} {m.unit}</strong></div>
                    </div>
                  )}

                  {/* Tooltip Progress Bar */}
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dashed rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                      <span style={{ color: '#94a3b8' }}>Completion</span>
                      <strong style={{ color: '#38bdf8' }}>{pct}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#38bdf8', borderRadius: '3px' }} />
                    </div>
                  </div>

                  {/* Tooltip Pointer Arrow */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      borderWidth: '6px',
                      borderStyle: 'solid',
                      borderColor: '#0f172a transparent transparent transparent'
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
