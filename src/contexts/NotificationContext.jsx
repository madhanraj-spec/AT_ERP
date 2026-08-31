import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

// Helper to format order number with design number and design name
function formatOrderWithDesign(orderNumber, designNo, designName) {
  const parts = [];
  if (designNo) parts.push(`Design #${designNo}`);
  if (designName) parts.push(designName);
  const designStr = parts.length > 0 ? ` [${parts.join(' - ')}]` : '';
  if (!orderNumber && !designStr) return '';
  return `${orderNumber || ''}${designStr}`.trim();
}

// Helper to format production type (In-House vs Job Work, Partner Name, Machine Number)
function formatExecutionLocation(type, partnerName, machineName) {
  const isJobWork = type === 'job_work';
  const parts = [];
  if (isJobWork) {
    parts.push(partnerName ? `Job Work: ${partnerName}` : 'Job Work');
  } else {
    parts.push('In-House');
  }
  if (machineName) {
    parts.push(`Machine #${machineName}`);
  }
  return parts.join(' • ');
}

// Helper to format start and end date range
function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return '';
  const formatSingle = (d) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return d;
    }
  };
  if (startDate && endDate) {
    if (startDate === endDate) return `Date: ${formatSingle(startDate)}`;
    return `Dates: ${formatSingle(startDate)} to ${formatSingle(endDate)}`;
  }
  return `Date: ${formatSingle(startDate || endDate)}`;
}

// Helper to extract clean partner name for dispatch
function extractDispatchPartnerName(dsp) {
  if (dsp.buyer?.brand_name) {
    return dsp.buyer.brand_name;
  }
  if (dsp.billed_to_address) {
    const firstLine = dsp.billed_to_address
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)[0];
    if (firstLine) return firstLine;
  }
  return 'Partner';
}

export function NotificationProvider({ children }) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState(() => {
    if (!profile?.id) return new Set();
    try {
      const saved = localStorage.getItem(`erp_read_notifications_${profile.id}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Keep readIds in sync when profile changes
  useEffect(() => {
    if (profile?.id) {
      try {
        const saved = localStorage.getItem(`erp_read_notifications_${profile.id}`);
        setReadIds(saved ? new Set(JSON.parse(saved)) : new Set());
      } catch {
        setReadIds(new Set());
      }
    }
  }, [profile?.id]);

  // Persist readIds to localStorage
  const saveReadIds = useCallback((newSet) => {
    if (!profile?.id) return;
    try {
      localStorage.setItem(`erp_read_notifications_${profile.id}`, JSON.stringify(Array.from(newSet)));
    } catch (e) {
      console.error('Failed to save read notifications to localStorage', e);
    }
  }, [profile?.id]);

  const markAsRead = useCallback((id) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, [saveReadIds]);

  const markAllAsRead = useCallback(() => {
    setReadIds(() => {
      const allIds = new Set(notifications.map((n) => n.id));
      saveReadIds(allIds);
      return allIds;
    });
  }, [notifications, saveReadIds]);

  const clearAllNotifications = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  // Main notification fetcher based on role
  const fetchNotifications = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const role = profile.role || 'merchandiser';
      const userId = profile.id;
      const collected = [];

      // Date cutoff: e.g. last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const isoCutoff = thirtyDaysAgo.toISOString();

      // ==========================================
      // 1. ADMIN NOTIFICATIONS
      // ==========================================
      if (role === 'admin') {
        // A. Orders (New orders created)
        const { data: recentOrders } = await supabase
          .from('orders')
          .select('id, order_number, design_name, design_no, created_at, status, merchandiser_name')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(30);

        (recentOrders || []).forEach((ord) => {
          const orderLabel = formatOrderWithDesign(ord.order_number, ord.design_no, ord.design_name);
          collected.push({
            id: `order_${ord.id}`,
            type: 'order',
            category: 'orders',
            title: `New Order: ${orderLabel}`,
            description: `${ord.merchandiser_name ? `Merchandiser: ${ord.merchandiser_name}` : 'New Fabric Order'}`,
            timestamp: ord.created_at,
            route: '/admin/orders',
            status: ord.status,
            priority: 'normal'
          });
        });

        // B. Production Forms (WOF, SOF, WVOF, POF for Admin)
        const { data: adminWofs } = await supabase
          .from('warping_order_forms')
          .select('id, wof_number, wof_type, partner_name, machine_name, start_date, end_date, qty, created_at, order:orders(order_number, design_no, design_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(20);

        (adminWofs || []).forEach((w) => {
          const ordLabel = w.order ? formatOrderWithDesign(w.order.order_number, w.order.design_no, w.order.design_name) : 'Order';
          const locLabel = formatExecutionLocation(w.wof_type, w.partner_name, w.machine_name);
          const dateRange = formatDateRange(w.start_date, w.end_date);

          collected.push({
            id: `admin_wof_${w.id}`,
            type: 'wof',
            category: 'forms',
            title: `Warping Form: ${w.wof_number}`,
            description: `For ${ordLabel} • ${Number(w.qty || 0).toLocaleString()} Mtrs • ${locLabel}${dateRange ? ` • ${dateRange}` : ''}`,
            timestamp: w.created_at,
            route: '/warping-sizing',
            priority: 'normal'
          });
        });

        const { data: adminSofs } = await supabase
          .from('sizing_order_forms')
          .select('id, sof_number, sizing_type, partner_name, machine_name, start_date, end_date, qty, created_at, order:orders(order_number, design_no, design_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(20);

        (adminSofs || []).forEach((s) => {
          const ordLabel = s.order ? formatOrderWithDesign(s.order.order_number, s.order.design_no, s.order.design_name) : 'Order';
          const locLabel = formatExecutionLocation(s.sizing_type, s.partner_name, s.machine_name);
          const dateRange = formatDateRange(s.start_date, s.end_date);

          collected.push({
            id: `admin_sof_${s.id}`,
            type: 'sof',
            category: 'forms',
            title: `Sizing Form: ${s.sof_number}`,
            description: `For ${ordLabel} • ${Number(s.qty || 0).toLocaleString()} Mtrs • ${locLabel}${dateRange ? ` • ${dateRange}` : ''}`,
            timestamp: s.created_at,
            route: '/warping-sizing',
            priority: 'normal'
          });
        });

        const { data: adminWvofs } = await supabase
          .from('weaving_orders')
          .select('id, weaving_number, weaving_type, partner_name, machine_name, start_date, end_date, qty, created_at, order:orders(order_number, design_no, design_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(20);

        (adminWvofs || []).forEach((w) => {
          const ordLabel = w.order ? formatOrderWithDesign(w.order.order_number, w.order.design_no, w.order.design_name) : 'Order';
          const locLabel = formatExecutionLocation(w.weaving_type, w.partner_name, w.machine_name);
          const dateRange = formatDateRange(w.start_date, w.end_date);

          collected.push({
            id: `admin_wvof_${w.id}`,
            type: 'wvof',
            category: 'forms',
            title: `Weaving Form: ${w.weaving_number || 'WVOF'}`,
            description: `For ${ordLabel} • ${Number(w.qty || 0).toLocaleString()} Mtrs • ${locLabel}${dateRange ? ` • ${dateRange}` : ''}`,
            timestamp: w.created_at,
            route: '/weaving',
            priority: 'normal'
          });
        });

        const { data: adminPofs } = await supabase
          .from('processing_orders')
          .select('id, pof_number, partner_name, processes, expected_delivery_date, created_at, fabric_rolls')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(20);

        (adminPofs || []).forEach((p) => {
          const rollOrderLabels = Array.from(
            new Set(
              (p.fabric_rolls || [])
                .map((r) => formatOrderWithDesign(r.order_number, r.design_no, r.design_name))
                .filter(Boolean)
            )
          ).join(', ');

          const deliveryStr = p.expected_delivery_date ? formatDateRange(null, p.expected_delivery_date) : '';

          collected.push({
            id: `admin_pof_${p.id}`,
            type: 'pof',
            category: 'forms',
            title: `Processing Form: ${p.pof_number}`,
            description: `For ${rollOrderLabels || 'Orders'} • Job Work: ${p.partner_name || 'Processing Unit'}${p.processes?.length ? ` (${p.processes.join(', ')})` : ''}${deliveryStr ? ` • ${deliveryStr}` : ''}`,
            timestamp: p.created_at,
            route: '/processing',
            priority: 'normal'
          });
        });

        // C. Approvals: Pending DOF Approvals
        const { data: pendingDofs } = await supabase
          .from('dyeing_order_forms')
          .select('id, dof_number, created_at, status, order_ids, master_partners!dyeing_unit_id(partner_name), profiles!dyeing_order_forms_created_by_fkey(full_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(20);

        (pendingDofs || []).forEach((dof) => {
          collected.push({
            id: `dof_approval_${dof.id}`,
            type: 'approval',
            category: 'approvals',
            title: `DOF Awaiting Approval: ${dof.dof_number}`,
            description: `Submitted by ${dof.profiles?.full_name || 'Merchandiser'} for ${dof.master_partners?.partner_name || 'Dyeing Unit'}`,
            timestamp: dof.created_at,
            route: '/admin/approvals',
            status: 'pending',
            priority: 'high'
          });
        });

        // D. Approvals: Pending Greige Receipt Finance Approvals
        const { data: pendingGreigeReceipts } = await supabase
          .from('greige_yarn_receipts')
          .select('id, receipt_no, total_weight, created_at, finance_approval_status, master_partners!spinning_mill_id(partner_name)')
          .eq('finance_approval_status', 'pending')
          .order('created_at', { ascending: false })
          .limit(20);

        const seenGreigeReceipts = new Set();
        (pendingGreigeReceipts || []).forEach((rcp) => {
          if (!seenGreigeReceipts.has(rcp.receipt_no)) {
            seenGreigeReceipts.add(rcp.receipt_no);
            collected.push({
              id: `greige_appr_${rcp.receipt_no}`,
              type: 'approval',
              category: 'approvals',
              title: `Greige Receipt Approval: ${rcp.receipt_no}`,
              description: `${rcp.master_partners?.partner_name || 'Spinning Mill'} - ${Number(rcp.total_weight || 0).toLocaleString()} kg pending approval`,
              timestamp: rcp.created_at,
              route: '/admin/approvals',
              status: 'pending',
              priority: 'high'
            });
          }
        });

        // E. Approvals: Pending Dyeing Bills
        const { data: pendingDofBills } = await supabase
          .from('dof_bills')
          .select('id, bill_number, partner_name, invoice_number, bill_total, created_at, status')
          .eq('status', 'submitted')
          .order('created_at', { ascending: false })
          .limit(20);

        (pendingDofBills || []).forEach((bill) => {
          collected.push({
            id: `dof_bill_appr_${bill.id}`,
            type: 'approval',
            category: 'approvals',
            title: `Dyeing Bill Approval: ${bill.bill_number}`,
            description: `${bill.partner_name} - Inv #${bill.invoice_number} (₹${Number(bill.bill_total || 0).toLocaleString()})`,
            timestamp: bill.created_at,
            route: '/admin/approvals',
            status: 'pending',
            priority: 'high'
          });
        });

        // F. Approvals: Pending Production Bills (Warping, Sizing, Weaving)
        const { data: pendingProdBills } = await supabase
          .from('production_finance_bills')
          .select('id, bill_number, form_type, partner_name, invoice_number, invoice_total, created_at, status')
          .eq('status', 'awaiting_approval')
          .order('created_at', { ascending: false })
          .limit(20);

        (pendingProdBills || []).forEach((bill) => {
          collected.push({
            id: `prod_bill_appr_${bill.id}`,
            type: 'approval',
            category: 'approvals',
            title: `${(bill.form_type || 'Production').toUpperCase()} Bill Approval: ${bill.bill_number}`,
            description: `${bill.partner_name} - Inv #${bill.invoice_number} (₹${Number(bill.invoice_total || 0).toLocaleString()})`,
            timestamp: bill.created_at,
            route: '/admin/approvals',
            status: 'pending',
            priority: 'high'
          });
        });

        // G. Approvals: Pending Processing Bills
        const { data: pendingProcBills } = await supabase
          .from('processing_finance_bills')
          .select('id, bill_number, partner_name, invoice_total, created_at, status')
          .eq('status', 'submitted_for_approval')
          .order('created_at', { ascending: false })
          .limit(20);

        (pendingProcBills || []).forEach((bill) => {
          collected.push({
            id: `proc_bill_appr_${bill.id}`,
            type: 'approval',
            category: 'approvals',
            title: `Processing Bill Approval: ${bill.bill_number}`,
            description: `${bill.partner_name} (₹${Number(bill.invoice_total || 0).toLocaleString()})`,
            timestamp: bill.created_at,
            route: '/admin/approvals',
            status: 'pending',
            priority: 'high'
          });
        });

        // H. Greige & Dyed Yarn Receipts
        const { data: recentGreige } = await supabase
          .from('greige_yarn_receipts')
          .select('id, receipt_no, total_weight, created_at, master_partners!spinning_mill_id(partner_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(25);

        const seenRecentGreige = new Set();
        (recentGreige || []).forEach((rcp) => {
          if (!seenRecentGreige.has(rcp.receipt_no)) {
            seenRecentGreige.add(rcp.receipt_no);
            collected.push({
              id: `greige_rcp_${rcp.receipt_no}`,
              type: 'greige_receipt',
              category: 'receipts',
              title: `Greige Yarn Received: ${rcp.receipt_no}`,
              description: `From ${rcp.master_partners?.partner_name || 'Vendor'} (${Number(rcp.total_weight || 0).toLocaleString()} kg)`,
              timestamp: rcp.created_at,
              route: '/greige-yarn',
              priority: 'normal'
            });
          }
        });

        // Dyed Yarn Receipts (DYRR)
        const { data: recentDyedRcp } = await supabase
          .from('dyed_yarn_receipts')
          .select('id, dyrr_number, dof_number, created_at, master_partners!dyeing_unit_id(partner_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(25);

        (recentDyedRcp || []).forEach((rcp) => {
          collected.push({
            id: `dyed_rcp_${rcp.id}`,
            type: 'dyed_receipt',
            category: 'receipts',
            title: `Dyed Yarn Received: ${rcp.dyrr_number}`,
            description: `From ${rcp.master_partners?.partner_name || 'Dyeing Partner'}${rcp.dof_number ? ` (DOF: ${rcp.dof_number})` : ''}`,
            timestamp: rcp.created_at,
            route: '/dyed-yarn',
            priority: 'normal'
          });
        });

        // I. Yarn Deliveries: Greige Deliveries (GYDR)
        const { data: recentGreigeDeliveries } = await supabase
          .from('greige_yarn_delivery_receipts')
          .select(`
            id,
            gydr_number,
            dof_number,
            delivered_by,
            vehicle_no,
            created_at,
            items:greige_yarn_delivery_items(quantity_kg)
          `)
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(25);

        (recentGreigeDeliveries || []).forEach((gydr) => {
          const totalKg = (gydr.items || []).reduce((sum, itm) => sum + Number(itm.quantity_kg || 0), 0);
          collected.push({
            id: `gydr_deliv_${gydr.id}`,
            type: 'greige_delivery',
            category: 'deliveries',
            title: `Greige Delivered: ${gydr.gydr_number}`,
            description: `Sent for DOF: ${gydr.dof_number} (${totalKg.toLocaleString()} kg)${gydr.vehicle_no ? ` • Vehicle: ${gydr.vehicle_no}` : ''}`,
            timestamp: gydr.created_at,
            route: '/greige-yarn',
            priority: 'normal'
          });
        });

        // J. Yarn Deliveries: Dyed Yarn Deliveries (DYDR) for WOF and WVOF
        const { data: recentDyedDeliveries } = await supabase
          .from('dyed_yarn_deliveries')
          .select(`
            id,
            dydr_number,
            delivered_date,
            delivered_by,
            vehicle_no,
            created_at,
            items:dyed_yarn_delivery_items(
              quantity_kg,
              process_type,
              order:orders(order_number, design_no, design_name)
            )
          `)
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(25);

        (recentDyedDeliveries || []).forEach((dydr) => {
          const totalKg = (dydr.items || []).reduce((sum, itm) => sum + Number(itm.quantity_kg || 0), 0);
          const processTypes = Array.from(new Set((dydr.items || []).map((i) => i.process_type).filter(Boolean)));
          const processLabel = processTypes.map((p) => (p === 'warping' ? 'WOF (Warping)' : p === 'weaving' ? 'WVOF (Weaving)' : p)).join(', ') || 'Production';

          const linkedOrderLabels = Array.from(
            new Set(
              (dydr.items || [])
                .map((i) => (i.order ? formatOrderWithDesign(i.order.order_number, i.order.design_no, i.order.design_name) : null))
                .filter(Boolean)
            )
          ).join(', ');

          collected.push({
            id: `dydr_deliv_${dydr.id}`,
            type: 'dyed_delivery',
            category: 'deliveries',
            title: `Dyed Yarn Delivered: ${dydr.dydr_number} (${processLabel})`,
            description: `${linkedOrderLabels ? `For ${linkedOrderLabels} • ` : ''}${totalKg.toLocaleString()} kg sent to ${processLabel}${dydr.vehicle_no ? ` • Veh: ${dydr.vehicle_no}` : ''}`,
            timestamp: dydr.created_at,
            route: '/dyed-yarn',
            priority: 'normal'
          });
        });

        // K. Dispatch: Bills & Invoices
        const { data: recentDispatchBills } = await supabase
          .from('dispatch_bills')
          .select(`
            id,
            bill_number,
            bill_date,
            qty,
            amount,
            taxable_value,
            total_bill_price,
            billed_to_address,
            items,
            created_at,
            buyer:master_brands(brand_name)
          `)
          .order('created_at', { ascending: false })
          .limit(30);

        (recentDispatchBills || []).forEach((dsp) => {
          let orderLabels = '';
          if (Array.isArray(dsp.items) && dsp.items.length > 0) {
            const uniqueOrders = Array.from(
              new Set(
                dsp.items
                  .map((i) => formatOrderWithDesign(i.order_number, i.design_no, i.design_name))
                  .filter(Boolean)
              )
            );
            orderLabels = uniqueOrders.join(', ');
          }

          const partnerName = extractDispatchPartnerName(dsp);
          const qtyStr = `${Number(dsp.qty || 0).toLocaleString()} Mtrs`;
          const totalPrice = dsp.total_bill_price || dsp.taxable_value || dsp.amount;
          const amountStr = totalPrice ? ` • ₹${Number(totalPrice).toLocaleString()}` : '';

          collected.push({
            id: `dispatch_bill_${dsp.id}`,
            type: 'dispatch',
            category: 'dispatch',
            title: `Dispatch Bill: ${dsp.bill_number}`,
            description: `To ${partnerName}${orderLabels ? ` • For ${orderLabels}` : ''} • Qty: ${qtyStr}${amountStr}`,
            timestamp: dsp.created_at || dsp.bill_date,
            route: '/dispatch',
            priority: 'normal'
          });
        });
      }

      // ==========================================
      // 2. MERCHANDISER NOTIFICATIONS
      // ==========================================
      else if (role === 'merchandiser') {
        // Fetch order IDs owned by this merchandiser with design_no & design_name
        const { data: myOrders } = await supabase
          .from('orders')
          .select('id, order_number, design_no, design_name')
          .or(`merchandiser_id.eq.${userId},created_by.eq.${userId}`);

        const myOrderIds = (myOrders || []).map((o) => o.id);
        const orderMap = new Map(
          (myOrders || []).map((o) => [
            o.id,
            {
              order_number: o.order_number,
              design_no: o.design_no,
              design_name: o.design_name,
              display: formatOrderWithDesign(o.order_number, o.design_no, o.design_name)
            }
          ])
        );

        // A. DOF Approvals / Status changes
        const { data: myDofs } = await supabase
          .from('dyeing_order_forms')
          .select('id, dof_number, status, approved_at, approval_notes, created_at, order_ids, updated_at')
          .or(`created_by.eq.${userId}`)
          .gte('updated_at', isoCutoff)
          .order('updated_at', { ascending: false })
          .limit(30);

        (myDofs || []).forEach((dof) => {
          if (dof.status === 'approved' || dof.status === 'rejected') {
            const linkedOrdersStr = (dof.order_ids || [])
              .map((id) => orderMap.get(id)?.display)
              .filter(Boolean)
              .join(', ');

            collected.push({
              id: `dof_status_${dof.id}_${dof.status}`,
              type: 'dof',
              category: 'approvals',
              title: `DOF ${dof.status === 'approved' ? 'Approved ✅' : 'Rejected ❌'}: ${dof.dof_number}`,
              description: `Dyeing Order Form ${dof.dof_number} has been ${dof.status}${linkedOrdersStr ? ` for ${linkedOrdersStr}` : ''}${dof.approval_notes ? ` (${dof.approval_notes})` : ''}`,
              timestamp: dof.updated_at || dof.created_at,
              route: `/merchandiser/dyeing-forms/${dof.id}`,
              status: dof.status,
              priority: dof.status === 'approved' ? 'high' : 'urgent'
            });
          }
        });

        if (myOrderIds.length > 0) {
          // B. Warping Order Forms (WOF) created for my orders
          const { data: myWofs } = await supabase
            .from('warping_order_forms')
            .select('id, wof_number, wof_type, partner_name, machine_name, start_date, end_date, order_id, created_at, qty, status')
            .in('order_id', myOrderIds)
            .gte('created_at', isoCutoff)
            .order('created_at', { ascending: false })
            .limit(20);

          (myWofs || []).forEach((wof) => {
            const ordInfo = orderMap.get(wof.order_id);
            const ordDisplay = ordInfo ? ordInfo.display : 'your order';
            const locLabel = formatExecutionLocation(wof.wof_type, wof.partner_name, wof.machine_name);
            const dateRange = formatDateRange(wof.start_date, wof.end_date);

            collected.push({
              id: `wof_${wof.id}`,
              type: 'wof',
              category: 'forms',
              title: `Warping Form: ${wof.wof_number}`,
              description: `For ${ordDisplay} • ${Number(wof.qty || 0).toLocaleString()} Mtrs • ${locLabel}${dateRange ? ` • ${dateRange}` : ''}`,
              timestamp: wof.created_at,
              route: '/warping-sizing',
              priority: 'normal'
            });
          });

          // C. Sizing Order Forms (SOF) created for my orders
          const { data: mySofs } = await supabase
            .from('sizing_order_forms')
            .select('id, sof_number, sizing_type, partner_name, machine_name, start_date, end_date, order_id, created_at, qty, status')
            .in('order_id', myOrderIds)
            .gte('created_at', isoCutoff)
            .order('created_at', { ascending: false })
            .limit(20);

          (mySofs || []).forEach((sof) => {
            const ordInfo = orderMap.get(sof.order_id);
            const ordDisplay = ordInfo ? ordInfo.display : 'your order';
            const locLabel = formatExecutionLocation(sof.sizing_type, sof.partner_name, sof.machine_name);
            const dateRange = formatDateRange(sof.start_date, sof.end_date);

            collected.push({
              id: `sof_${sof.id}`,
              type: 'sof',
              category: 'forms',
              title: `Sizing Form: ${sof.sof_number}`,
              description: `For ${ordDisplay} • ${Number(sof.qty || 0).toLocaleString()} Mtrs • ${locLabel}${dateRange ? ` • ${dateRange}` : ''}`,
              timestamp: sof.created_at,
              route: '/warping-sizing',
              priority: 'normal'
            });
          });

          // D. Weaving Order Forms (WVOF) created for my orders
          const { data: myWvofs } = await supabase
            .from('weaving_orders')
            .select('id, weaving_number, weaving_type, partner_name, machine_name, start_date, end_date, order_id, created_at, qty, status')
            .in('order_id', myOrderIds)
            .gte('created_at', isoCutoff)
            .order('created_at', { ascending: false })
            .limit(20);

          (myWvofs || []).forEach((wvof) => {
            const ordInfo = orderMap.get(wvof.order_id);
            const ordDisplay = ordInfo ? ordInfo.display : 'your order';
            const locLabel = formatExecutionLocation(wvof.weaving_type, wvof.partner_name, wvof.machine_name);
            const dateRange = formatDateRange(wvof.start_date, wvof.end_date);

            collected.push({
              id: `wvof_${wvof.id}`,
              type: 'wvof',
              category: 'forms',
              title: `Weaving Form: ${wvof.weaving_number || 'WVOF'}`,
              description: `For ${ordDisplay} • ${Number(wvof.qty || 0).toLocaleString()} Mtrs • ${locLabel}${dateRange ? ` • ${dateRange}` : ''}`,
              timestamp: wvof.created_at,
              route: '/weaving',
              priority: 'normal'
            });
          });

          // E. Processing Order Forms (POF) created for my orders
          const { data: myPofs } = await supabase
            .from('processing_orders')
            .select('id, pof_number, partner_name, processes, expected_delivery_date, created_at, fabric_rolls')
            .gte('created_at', isoCutoff)
            .order('created_at', { ascending: false })
            .limit(20);

          (myPofs || []).forEach((pof) => {
            const matchedRolls = (pof.fabric_rolls || []).filter((r) => {
              return Array.from(orderMap.values()).some((o) => o.order_number === r.order_number);
            });

            if (matchedRolls.length > 0) {
              const matchedOrderLabels = Array.from(
                new Set(
                  matchedRolls.map((r) =>
                    formatOrderWithDesign(r.order_number, r.design_no, r.design_name)
                  )
                )
              ).join(', ');

              const deliveryStr = pof.expected_delivery_date ? formatDateRange(null, pof.expected_delivery_date) : '';

              collected.push({
                id: `pof_${pof.id}`,
                type: 'pof',
                category: 'forms',
                title: `Processing Form: ${pof.pof_number}`,
                description: `For ${matchedOrderLabels || 'your orders'} • Job Work: ${pof.partner_name || 'Processing Unit'}${pof.processes?.length ? ` (${pof.processes.join(', ')})` : ''}${deliveryStr ? ` • ${deliveryStr}` : ''}`,
                timestamp: pof.created_at,
                route: '/processing',
                priority: 'normal'
              });
            }
          });

          // F. Dyed Yarn Deliveries for my orders (for WOF / WVOF)
          const { data: myDyedDeliveries } = await supabase
            .from('dyed_yarn_delivery_items')
            .select(`
              id,
              quantity_kg,
              process_type,
              created_at,
              order_id,
              delivery:dyed_yarn_deliveries(dydr_number, vehicle_no)
            `)
            .in('order_id', myOrderIds)
            .gte('created_at', isoCutoff)
            .order('created_at', { ascending: false })
            .limit(25);

          (myDyedDeliveries || []).forEach((item) => {
            const ordInfo = orderMap.get(item.order_id);
            const ordDisplay = ordInfo ? ordInfo.display : 'your order';
            const procLabel = item.process_type === 'warping' ? 'Warping (WOF)' : item.process_type === 'weaving' ? 'Weaving (WVOF)' : 'Production';

            collected.push({
              id: `merch_dydr_${item.id}`,
              type: 'dyed_delivery',
              category: 'deliveries',
              title: `Dyed Yarn Delivered for ${procLabel}`,
              description: `DYDR: ${item.delivery?.dydr_number || 'DYDR'} • ${ordDisplay} • ${Number(item.quantity_kg || 0).toLocaleString()} kg dispatched to ${procLabel}`,
              timestamp: item.created_at,
              route: item.process_type === 'weaving' ? '/weaving' : '/warping-sizing',
              priority: 'normal'
            });
          });

          // G. Bills / Invoices created for my orders
          const { data: myPis } = await supabase
            .from('proforma_invoices')
            .select('id, pi_number, buyer_name, total_amount, created_at, order_ids')
            .gte('created_at', isoCutoff)
            .order('created_at', { ascending: false })
            .limit(20);

          (myPis || []).forEach((pi) => {
            const linkedOrderLabels = (pi.order_ids || [])
              .map((id) => orderMap.get(id)?.display)
              .filter(Boolean);

            if (linkedOrderLabels.length > 0) {
              collected.push({
                id: `pi_${pi.id}`,
                type: 'invoice',
                category: 'bills',
                title: `Proforma Invoice: ${pi.pi_number}`,
                description: `For ${pi.buyer_name || 'Buyer'} • Orders: ${linkedOrderLabels.join(', ')} (₹${Number(pi.total_amount || 0).toLocaleString()})`,
                timestamp: pi.created_at,
                route: '/merchandiser/proforma-invoices',
                priority: 'normal'
              });
            }
          });

          // Dispatch Bills for my orders
          const { data: myDispatchBills } = await supabase
            .from('dispatch_bills')
            .select(`
              id,
              bill_number,
              bill_date,
              qty,
              amount,
              taxable_value,
              total_bill_price,
              billed_to_address,
              created_at,
              items,
              buyer:master_brands(brand_name)
            `)
            .order('created_at', { ascending: false })
            .limit(30);

          (myDispatchBills || []).forEach((dsp) => {
            const matchingItems = (dsp.items || []).filter((i) => {
              return myOrderIds.includes(i.order_id) || Array.from(orderMap.values()).some((o) => o.order_number === i.order_number);
            });

            if (matchingItems.length > 0) {
              const matchedOrderLabels = Array.from(
                new Set(
                  matchingItems.map((i) => formatOrderWithDesign(i.order_number, i.design_no, i.design_name)).filter(Boolean)
                )
              ).join(', ');

              const partnerName = extractDispatchPartnerName(dsp);
              const qtyStr = `${Number(dsp.qty || 0).toLocaleString()} Mtrs`;
              const totalPrice = dsp.total_bill_price || dsp.taxable_value || dsp.amount;
              const amountStr = totalPrice ? ` • ₹${Number(totalPrice).toLocaleString()}` : '';

              collected.push({
                id: `dsp_bill_${dsp.id}`,
                type: 'bill',
                category: 'bills',
                title: `Dispatch Bill: ${dsp.bill_number}`,
                description: `To ${partnerName} • For ${matchedOrderLabels || 'your orders'} • Qty: ${qtyStr}${amountStr}`,
                timestamp: dsp.created_at || dsp.bill_date,
                route: '/dispatch',
                priority: 'normal'
              });
            }
          });
        }
      }

      // ==========================================
      // 3. YARN MANAGER NOTIFICATIONS
      // ==========================================
      else if (role === 'yarn' || role === 'greige_yarn' || role === 'dyed_yarn') {
        // A. Greige yarn receipt approvals
        const { data: greigeReceipts } = await supabase
          .from('greige_yarn_receipts')
          .select('id, receipt_no, total_weight, finance_approval_status, created_at, master_partners!spinning_mill_id(partner_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(30);

        const seenYarnGreige = new Set();
        (greigeReceipts || []).forEach((rcp) => {
          if (!seenYarnGreige.has(rcp.receipt_no)) {
            seenYarnGreige.add(rcp.receipt_no);
            const isPending = rcp.finance_approval_status === 'pending';
            collected.push({
              id: `yarn_greige_${rcp.receipt_no}`,
              type: 'approval',
              category: isPending ? 'approvals' : 'receipts',
              title: isPending ? `Receipt Approval Pending: ${rcp.receipt_no}` : `Greige Receipt Logged: ${rcp.receipt_no}`,
              description: `${rcp.master_partners?.partner_name || 'Mill'} - ${Number(rcp.total_weight || 0).toLocaleString()} kg (${rcp.finance_approval_status || 'received'})`,
              timestamp: rcp.created_at,
              route: '/greige-yarn',
              status: rcp.finance_approval_status,
              priority: isPending ? 'high' : 'normal'
            });
          }
        });

        // B. New DOF created
        const { data: newDofs } = await supabase
          .from('dyeing_order_forms')
          .select('id, dof_number, created_at, master_partners!dyeing_unit_id(partner_name), profiles!dyeing_order_forms_created_by_fkey(full_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(20);

        (newDofs || []).forEach((dof) => {
          collected.push({
            id: `yarn_dof_${dof.id}`,
            type: 'dof',
            category: 'dof',
            title: `New DOF Issued: ${dof.dof_number}`,
            description: `Dyeing order by ${dof.profiles?.full_name || 'Merchandiser'} to ${dof.master_partners?.partner_name || 'Dyeing Unit'}`,
            timestamp: dof.created_at,
            route: '/dyed-yarn',
            priority: 'high'
          });
        });

        // C. Dyed Yarn Receipts Logged
        const { data: dyedReceipts } = await supabase
          .from('dyed_yarn_receipts')
          .select('id, dyrr_number, dof_number, created_at, master_partners!dyeing_unit_id(partner_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(25);

        (dyedReceipts || []).forEach((rcp) => {
          collected.push({
            id: `yarn_dyed_rcp_${rcp.id}`,
            type: 'dyed_receipt',
            category: 'receipts',
            title: `Dyed Yarn Received: ${rcp.dyrr_number}`,
            description: `${rcp.master_partners?.partner_name || 'Dyeing Partner'}${rcp.dof_number ? ` (DOF: ${rcp.dof_number})` : ''}`,
            timestamp: rcp.created_at,
            route: '/dyed-yarn',
            priority: 'normal'
          });
        });

        // D. Greige Deliveries (GYDR)
        const { data: yarnGydrs } = await supabase
          .from('greige_yarn_delivery_receipts')
          .select(`
            id,
            gydr_number,
            dof_number,
            delivered_by,
            vehicle_no,
            created_at,
            items:greige_yarn_delivery_items(quantity_kg)
          `)
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(20);

        (yarnGydrs || []).forEach((gydr) => {
          const totalKg = (gydr.items || []).reduce((sum, itm) => sum + Number(itm.quantity_kg || 0), 0);
          collected.push({
            id: `yarn_gydr_${gydr.id}`,
            type: 'greige_delivery',
            category: 'deliveries',
            title: `Greige Dispatched: ${gydr.gydr_number}`,
            description: `Sent for DOF: ${gydr.dof_number} (${totalKg.toLocaleString()} kg)${gydr.vehicle_no ? ` • Veh: ${gydr.vehicle_no}` : ''}`,
            timestamp: gydr.created_at,
            route: '/greige-yarn',
            priority: 'normal'
          });
        });

        // E. Dyed Yarn Deliveries (DYDR)
        const { data: yarnDydrs } = await supabase
          .from('dyed_yarn_deliveries')
          .select(`
            id,
            dydr_number,
            delivered_date,
            delivered_by,
            vehicle_no,
            created_at,
            items:dyed_yarn_delivery_items(
              quantity_kg,
              process_type,
              order:orders(order_number, design_no, design_name)
            )
          `)
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(20);

        (yarnDydrs || []).forEach((dydr) => {
          const totalKg = (dydr.items || []).reduce((sum, itm) => sum + Number(itm.quantity_kg || 0), 0);
          const processTypes = Array.from(new Set((dydr.items || []).map((i) => i.process_type).filter(Boolean)));
          const processLabel = processTypes.map((p) => (p === 'warping' ? 'WOF (Warping)' : p === 'weaving' ? 'WVOF (Weaving)' : p)).join(', ') || 'Production';

          const linkedOrderLabels = Array.from(
            new Set(
              (dydr.items || [])
                .map((i) => (i.order ? formatOrderWithDesign(i.order.order_number, i.order.design_no, i.order.design_name) : null))
                .filter(Boolean)
            )
          ).join(', ');

          collected.push({
            id: `yarn_dydr_${dydr.id}`,
            type: 'dyed_delivery',
            category: 'deliveries',
            title: `Dyed Yarn Dispatched: ${dydr.dydr_number}`,
            description: `${linkedOrderLabels ? `For ${linkedOrderLabels} • ` : ''}${totalKg.toLocaleString()} kg dispatched to ${processLabel}`,
            timestamp: dydr.created_at,
            route: '/dyed-yarn',
            priority: 'normal'
          });
        });
      }

      // ==========================================
      // 4. PRODUCTION MANAGER NOTIFICATIONS
      // ==========================================
      else if (role === 'production' || role === 'warping_sizing' || role === 'weaving') {
        // A. Any order creation
        const { data: allOrders } = await supabase
          .from('orders')
          .select('id, order_number, design_name, design_no, created_at, status')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(30);

        (allOrders || []).forEach((ord) => {
          const orderLabel = formatOrderWithDesign(ord.order_number, ord.design_no, ord.design_name);
          collected.push({
            id: `prod_order_${ord.id}`,
            type: 'order',
            category: 'orders',
            title: `New Order: ${orderLabel}`,
            description: `${ord.design_name || 'New Production Fabric Order'}`,
            timestamp: ord.created_at,
            route: '/production',
            priority: 'normal'
          });
        });

        // B. Dyed Yarn Deliveries for Warping (WOF) and Weaving (WVOF)
        const { data: prodDyedDeliveries } = await supabase
          .from('dyed_yarn_deliveries')
          .select(`
            id,
            dydr_number,
            delivered_date,
            delivered_by,
            vehicle_no,
            created_at,
            items:dyed_yarn_delivery_items(
              quantity_kg,
              process_type,
              order:orders(order_number, design_no, design_name)
            )
          `)
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(25);

        (prodDyedDeliveries || []).forEach((dydr) => {
          const totalKg = (dydr.items || []).reduce((sum, itm) => sum + Number(itm.quantity_kg || 0), 0);
          const processTypes = Array.from(new Set((dydr.items || []).map((i) => i.process_type).filter(Boolean)));
          const processLabel = processTypes.map((p) => (p === 'warping' ? 'WOF (Warping)' : p === 'weaving' ? 'WVOF (Weaving)' : p)).join(', ') || 'Production';

          const linkedOrderLabels = Array.from(
            new Set(
              (dydr.items || [])
                .map((i) => (i.order ? formatOrderWithDesign(i.order.order_number, i.order.design_no, i.order.design_name) : null))
                .filter(Boolean)
            )
          ).join(', ');

          collected.push({
            id: `prod_dydr_${dydr.id}`,
            type: 'dyed_delivery',
            category: 'deliveries',
            title: `Yarn Delivered for ${processLabel}: ${dydr.dydr_number}`,
            description: `${linkedOrderLabels ? `For ${linkedOrderLabels} • ` : ''}${totalKg.toLocaleString()} kg ready for ${processLabel}`,
            timestamp: dydr.created_at,
            route: processTypes.includes('weaving') ? '/weaving' : '/warping-sizing',
            priority: 'high'
          });
        });

        // C. Production bills approvals (Warping, Sizing, Weaving, Processing)
        const { data: prodBills } = await supabase
          .from('production_finance_bills')
          .select('id, bill_number, form_type, partner_name, invoice_number, invoice_total, created_at, status')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(20);

        (prodBills || []).forEach((bill) => {
          const isPending = bill.status === 'awaiting_approval';
          collected.push({
            id: `prod_mgr_bill_${bill.id}`,
            type: 'approval',
            category: 'approvals',
            title: `${(bill.form_type || 'Production').toUpperCase()} Bill: ${bill.bill_number}`,
            description: `${bill.partner_name} - Inv #${bill.invoice_number} (₹${Number(bill.invoice_total || 0).toLocaleString()}) [${bill.status}]`,
            timestamp: bill.created_at,
            route: '/admin/finances',
            status: bill.status,
            priority: isPending ? 'high' : 'normal'
          });
        });

        const { data: procBills } = await supabase
          .from('processing_finance_bills')
          .select('id, bill_number, partner_name, invoice_total, created_at, status')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(20);

        (procBills || []).forEach((bill) => {
          const isPending = bill.status === 'submitted_for_approval';
          collected.push({
            id: `prod_proc_bill_${bill.id}`,
            type: 'approval',
            category: 'approvals',
            title: `Processing Bill: ${bill.bill_number}`,
            description: `${bill.partner_name} (₹${Number(bill.invoice_total || 0).toLocaleString()}) [${bill.status}]`,
            timestamp: bill.created_at,
            route: '/admin/finances',
            status: bill.status,
            priority: isPending ? 'high' : 'normal'
          });
        });

        // D. Production Forms created (WOF, SOF, WVOF, POF)
        const { data: wofs } = await supabase
          .from('warping_order_forms')
          .select('id, wof_number, wof_type, partner_name, machine_name, start_date, end_date, qty, created_at, order:orders(order_number, design_no, design_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(15);

        (wofs || []).forEach((w) => {
          const ordLabel = w.order ? formatOrderWithDesign(w.order.order_number, w.order.design_no, w.order.design_name) : null;
          const locLabel = formatExecutionLocation(w.wof_type, w.partner_name, w.machine_name);
          const dateRange = formatDateRange(w.start_date, w.end_date);

          collected.push({
            id: `prod_wof_${w.id}`,
            type: 'wof',
            category: 'forms',
            title: `Warping Form: ${w.wof_number}`,
            description: `${ordLabel ? `For ${ordLabel} • ` : ''}${Number(w.qty || 0).toLocaleString()} Mtrs • ${locLabel}${dateRange ? ` • ${dateRange}` : ''}`,
            timestamp: w.created_at,
            route: '/warping-sizing',
            priority: 'normal'
          });
        });

        const { data: sofs } = await supabase
          .from('sizing_order_forms')
          .select('id, sof_number, sizing_type, partner_name, machine_name, start_date, end_date, qty, created_at, order:orders(order_number, design_no, design_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(15);

        (sofs || []).forEach((s) => {
          const ordLabel = s.order ? formatOrderWithDesign(s.order.order_number, s.order.design_no, s.order.design_name) : null;
          const locLabel = formatExecutionLocation(s.sizing_type, s.partner_name, s.machine_name);
          const dateRange = formatDateRange(s.start_date, s.end_date);

          collected.push({
            id: `prod_sof_${s.id}`,
            type: 'sof',
            category: 'forms',
            title: `Sizing Form: ${s.sof_number}`,
            description: `${ordLabel ? `For ${ordLabel} • ` : ''}${Number(s.qty || 0).toLocaleString()} Mtrs • ${locLabel}${dateRange ? ` • ${dateRange}` : ''}`,
            timestamp: s.created_at,
            route: '/warping-sizing',
            priority: 'normal'
          });
        });

        const { data: wvofs } = await supabase
          .from('weaving_orders')
          .select('id, weaving_number, weaving_type, partner_name, machine_name, start_date, end_date, qty, created_at, order:orders(order_number, design_no, design_name)')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(15);

        (wvofs || []).forEach((w) => {
          const ordLabel = w.order ? formatOrderWithDesign(w.order.order_number, w.order.design_no, w.order.design_name) : null;
          const locLabel = formatExecutionLocation(w.weaving_type, w.partner_name, w.machine_name);
          const dateRange = formatDateRange(w.start_date, w.end_date);

          collected.push({
            id: `prod_wvof_${w.id}`,
            type: 'wvof',
            category: 'forms',
            title: `Weaving Form: ${w.weaving_number || 'WVOF'}`,
            description: `${ordLabel ? `For ${ordLabel} • ` : ''}${Number(w.qty || 0).toLocaleString()} Mtrs • ${locLabel}${dateRange ? ` • ${dateRange}` : ''}`,
            timestamp: w.created_at,
            route: '/weaving',
            priority: 'normal'
          });
        });

        const { data: pofs } = await supabase
          .from('processing_orders')
          .select('id, pof_number, partner_name, processes, expected_delivery_date, created_at, fabric_rolls')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(15);

        (pofs || []).forEach((p) => {
          const rollOrderLabels = Array.from(
            new Set(
              (p.fabric_rolls || [])
                .map((r) => formatOrderWithDesign(r.order_number, r.design_no, r.design_name))
                .filter(Boolean)
            )
          ).join(', ');

          const deliveryStr = p.expected_delivery_date ? formatDateRange(null, p.expected_delivery_date) : '';

          collected.push({
            id: `prod_pof_${p.id}`,
            type: 'pof',
            category: 'forms',
            title: `Processing Form: ${p.pof_number}`,
            description: `${rollOrderLabels ? `For ${rollOrderLabels} • ` : ''}Job Work: ${p.partner_name || 'Processing Unit'}${p.processes?.length ? ` (${p.processes.join(', ')})` : ''}${deliveryStr ? ` • ${deliveryStr}` : ''}`,
            timestamp: p.created_at,
            route: '/processing',
            priority: 'normal'
          });
        });
      }

      // ==========================================
      // 5. OTHER / FALLBACK
      // ==========================================
      else {
        const { data: recentOrders } = await supabase
          .from('orders')
          .select('id, order_number, design_name, design_no, created_at')
          .gte('created_at', isoCutoff)
          .order('created_at', { ascending: false })
          .limit(20);

        (recentOrders || []).forEach((ord) => {
          const orderLabel = formatOrderWithDesign(ord.order_number, ord.design_no, ord.design_name);
          collected.push({
            id: `gen_order_${ord.id}`,
            type: 'order',
            category: 'orders',
            title: `Order: ${orderLabel}`,
            description: ord.design_name || 'Fabric order created',
            timestamp: ord.created_at,
            route: '/dashboard',
            priority: 'normal'
          });
        });
      }

      // Sort all collected notifications chronologically (newest first)
      collected.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setNotifications(collected);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Initial fetch and Realtime subscriptions
  useEffect(() => {
    fetchNotifications();

    // Setup periodic polling backup (every 45s)
    const interval = setInterval(fetchNotifications, 45000);

    // Setup Supabase Realtime Channel
    const channel = supabase
      .channel('erp_notifications_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dyeing_order_forms' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'greige_yarn_receipts' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dyed_yarn_receipts' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'greige_yarn_delivery_receipts' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dyed_yarn_deliveries' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dof_bills' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_finance_bills' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processing_finance_bills' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warping_order_forms' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sizing_order_forms' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weaving_orders' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'processing_orders' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_bills' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proforma_invoices' }, () => fetchNotifications())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  // Derive unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.has(n.id)).length;
  }, [notifications, readIds]);

  // Derive tabs according to user role
  const categoryTabs = useMemo(() => {
    const role = profile?.role || 'merchandiser';

    if (role === 'admin') {
      return [
        { id: 'all', label: 'All' },
        { id: 'orders', label: 'Orders' },
        { id: 'forms', label: 'Production Forms' },
        { id: 'approvals', label: 'Approvals' },
        { id: 'receipts', label: 'Receipts' },
        { id: 'deliveries', label: 'Deliveries' },
        { id: 'dispatch', label: 'Dispatch' }
      ];
    }

    if (role === 'merchandiser') {
      return [
        { id: 'all', label: 'All' },
        { id: 'approvals', label: 'DOF Approvals' },
        { id: 'forms', label: 'Production Forms' },
        { id: 'deliveries', label: 'Yarn Deliveries' },
        { id: 'bills', label: 'Bills & Invoices' }
      ];
    }

    if (role === 'yarn' || role === 'greige_yarn' || role === 'dyed_yarn') {
      return [
        { id: 'all', label: 'All' },
        { id: 'approvals', label: 'Receipt Approvals' },
        { id: 'dof', label: 'Dyeing Orders (DOF)' },
        { id: 'receipts', label: 'Receipts' },
        { id: 'deliveries', label: 'Deliveries' }
      ];
    }

    if (role === 'production' || role === 'warping_sizing' || role === 'weaving') {
      return [
        { id: 'all', label: 'All' },
        { id: 'orders', label: 'New Orders' },
        { id: 'deliveries', label: 'Yarn Deliveries (WOF/WVOF)' },
        { id: 'forms', label: 'Production Forms' },
        { id: 'approvals', label: 'Bill Approvals' }
      ];
    }

    return [
      { id: 'all', label: 'All' },
      { id: 'orders', label: 'Orders' },
      { id: 'forms', label: 'Forms' },
      { id: 'deliveries', label: 'Deliveries' },
      { id: 'dispatch', label: 'Dispatch' }
    ];
  }, [profile?.role]);

  // Compute badge counts for sidebar links
  const getBadgeCount = useCallback(
    (linkPath, linkName) => {
      if (!profile || !notifications || notifications.length === 0) return 0;
      const role = profile.role || 'merchandiser';
      const path = (linkPath || '').toLowerCase();
      const name = (linkName || '').toLowerCase();

      // 1. Approvals badge (for Admin Approvals)
      if (path.includes('approvals') || name === 'approvals') {
        const pendingApprovals = notifications.filter(
          (n) =>
            n.category === 'approvals' &&
            (n.status === 'pending' ||
              n.status === 'awaiting_approval' ||
              n.status === 'submitted' ||
              n.priority === 'high' ||
              n.priority === 'urgent')
        );
        return pendingApprovals.length;
      }

      // 2. Orders badge (for Admin, Production Manager, Yarn Dept, Merchandiser)
      if (path.includes('orders') || name === 'orders' || (role === 'production' && path === '/production')) {
        const unreadOrders = notifications.filter(
          (n) => n.type === 'order' && !readIds.has(n.id)
        );
        return unreadOrders.length;
      }

      // 3. Yarn Dept specific badges
      if (role === 'yarn' || role === 'greige_yarn' || role === 'dyed_yarn') {
        if (path === '/greige-yarn' || name.includes('greige')) {
          return notifications.filter(
            (n) =>
              (n.type === 'greige_receipt' || n.category === 'approvals') &&
              !readIds.has(n.id)
          ).length;
        }
        if (path === '/dyed-yarn' || name.includes('dyed')) {
          return notifications.filter(
            (n) =>
              (n.type === 'dof' || n.type === 'dyed_receipt') &&
              !readIds.has(n.id)
          ).length;
        }
      }

      return 0;
    },
    [profile, notifications, readIds]
  );

  const value = {
    notifications,
    unreadCount,
    categoryTabs,
    loading,
    readIds,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    refreshNotifications: fetchNotifications,
    isRead: (id) => readIds.has(id),
    getBadgeCount
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
