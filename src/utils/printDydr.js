import { supabase } from '../lib/supabase';

/**
 * Reusable utility to trigger printing a Dyed Yarn Delivery Receipt (DYDR)
 * by opening a styled document in a new tab/window and invoking the print dialog.
 * Formatted as 2 copies on a single A4 portrait sheet (Top Half & Bottom Half).
 */
export async function printDydr(dydr, yarnCounts = []) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to print receipts.');
    return;
  }

  win.document.write('<html><body><div style="font-family: Arial; padding: 20px; color: #555;">Loading print details...</div></body></html>');

  // Resolve partner details dynamically
  let partner = dydr.partner;
  let partnerId = dydr.partner_id || dydr.dyeing_unit_id;
  const items = dydr.items || [];
  let formId = null;
  let processType = null;

  if (items.length > 0) {
    formId = items[0].production_form_id;
    processType = items[0].process_type;
  } else {
    try {
      const { data: dbItems } = await supabase
        .from('dyed_yarn_delivery_items')
        .select('production_form_id, process_type')
        .eq('delivery_id', dydr.id);
      if (dbItems && dbItems.length > 0) {
        formId = dbItems[0].production_form_id;
        processType = dbItems[0].process_type;
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Fallback 1: Resolve partner_id/dyeing_unit_id by checking production_form_id (formId) in all forms tables
  if (!partner && !partnerId && formId) {
    try {
      const { data: wof } = await supabase
        .from('warping_order_forms')
        .select('partner_id, wof_number, machine_name, wof_type')
        .eq('id', formId)
        .maybeSingle();
      if (wof?.partner_id) {
        partnerId = wof.partner_id;
      } else {
        const { data: wev } = await supabase
          .from('weaving_orders')
          .select('partner_id, weaving_number, machine_name, weaving_type')
          .eq('id', formId)
          .maybeSingle();
        if (wev?.partner_id) {
          partnerId = wev.partner_id;
        } else {
          const { data: dof } = await supabase
            .from('dyeing_order_forms')
            .select('dyeing_unit_id, dof_number')
            .eq('id', formId)
            .maybeSingle();
          if (dof?.dyeing_unit_id) {
            partnerId = dof.dyeing_unit_id;
          }
        }
      }
    } catch (e) {
      console.error('Fallback 1 error:', e);
    }
  }

  // Fallback 2: Resolve partner_id by checking document numbers
  let docNo = dydr.doc_no || dydr.dof_number || dydr.wof_number || dydr.weaving_number;
  if (!docNo && dydr.remarks) {
    const match = dydr.remarks.match(/(WOF|DOF|WEV)\S+/);
    if (match) docNo = match[0];
  }

  if (!partner && !partnerId && docNo) {
    try {
      if (docNo.includes('/WOF/')) {
        const { data: wof } = await supabase
          .from('warping_order_forms')
          .select('partner_id')
          .eq('wof_number', docNo)
          .maybeSingle();
        if (wof?.partner_id) partnerId = wof.partner_id;
      } else if (docNo.includes('/DOF/')) {
        const { data: dof } = await supabase
          .from('dyeing_order_forms')
          .select('dyeing_unit_id')
          .eq('dof_number', docNo)
          .maybeSingle();
        if (dof?.dyeing_unit_id) partnerId = dof.dyeing_unit_id;
      } else {
        const { data: wev } = await supabase
          .from('weaving_orders')
          .select('partner_id')
          .eq('weaving_number', docNo)
          .maybeSingle();
        if (wev?.partner_id) partnerId = wev.partner_id;
      }
    } catch (e) {
      console.error('Fallback 2 error:', e);
    }
  }

  if (!partner && partnerId) {
    try {
      const { data: partnerData } = await supabase
        .from('master_partners')
        .select('*')
        .eq('id', partnerId)
        .maybeSingle();
      partner = partnerData;
    } catch (e) {
      console.error('Partner fetch error:', e);
    }
  }

  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);

  const getFormatCount = (id, rawObj) => {
    if (rawObj?.master_yarn_counts) {
      return [rawObj.master_yarn_counts.count_value, rawObj.master_yarn_counts.spec, rawObj.master_yarn_counts.spec1, rawObj.master_yarn_counts.product_type].filter(Boolean).join(' ');
    }
    if (rawObj?.yarn_count) {
      if (typeof rawObj.yarn_count === 'object') {
        return [rawObj.yarn_count.count_value, rawObj.yarn_count.spec, rawObj.yarn_count.spec1, rawObj.yarn_count.product_type].filter(Boolean).join(' ');
      }
      return String(rawObj.yarn_count);
    }
    const yc = yarnCounts.find(y => y.id === id);
    return yc ? [yc.count_value, yc.spec, yc.spec1, yc.product_type].filter(Boolean).join(' ') : '—';
  };

  const printTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const printDateStr = dydr.delivered_date 
    ? new Date(dydr.delivered_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const receiptNo = dydr.dydr_number || dydr.receiptNumber || '—';
  const targetProcess = dydr.target_process || processType || (docNo?.includes('/WOF/') ? 'warping' : docNo?.includes('/DOF/') ? 'redyeing' : 'weaving');
  const targetLabel = targetProcess === 'weaving' ? 'Weaving (WVOF)' : targetProcess === 'redyeing' ? 'Redyeing (DOF)' : 'Warping (WOF)';
  const partnerName = partner?.partner_name || dydr.partner_name || 'In-House Production';
  const partnerGstin = partner?.gstin || '';
  const vehicleNo = dydr.vehicle_no || 'In-House Handover';
  const deliveredBy = dydr.delivered_by || '—';
  const remarks = dydr.remarks || '';

  const renderSingleCopyHtml = (copyBadge) => `
    <div class="dydr-copy">
      <!-- Header -->
      <div class="header">
        <div class="logo-area">
          <img class="logo-img" src="/logo.png" alt="Ashok Textiles" onerror="this.style.display='none';" />
          <div>
            <div class="company-name">ASHOK TEXTILES</div>
            <div class="company-addr">6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33</div>
            <div class="company-gst">GSTIN: <span style="font-family: monospace;">33AAZFA60686D1Z6</span></div>
          </div>
        </div>
        <div class="title-area">
          <div class="title">DYED YARN DELIVERY RECEIPT (DYDR)</div>
          <div style="margin-top: 2px;">
            <span class="badge">${copyBadge}</span>
          </div>
          <div class="receipt-no">Delivery No: <strong>${receiptNo}</strong></div>
        </div>
      </div>

      <!-- Meta Grid -->
      <div class="meta-grid">
        <div class="meta-card">
          <div class="meta-label">DELIVERY INFO</div>
          <div class="meta-val"><strong>Date:</strong> ${printDateStr}</div>
          <div class="meta-val"><strong>Time:</strong> ${printTimeStr}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">TARGET PROCESS & FORM</div>
          <div class="meta-val"><strong>Process:</strong> <span style="font-weight: 700; color: #7f1d1d;">${targetLabel}</span></div>
          <div class="meta-val"><strong>Form No:</strong> ${docNo || '—'}</div>
          ${dydr.machine_name ? `<div class="meta-val"><strong>Machine:</strong> ${dydr.machine_name}</div>` : ''}
        </div>
        <div class="meta-card">
          <div class="meta-label">DESTINATION / PARTNER</div>
          <div class="meta-val"><strong>Type:</strong> ${partner ? 'Job Work Partner' : 'In-House Production'}</div>
          <div class="meta-val" title="${partnerName}"><strong>Unit/Partner:</strong> ${partnerName}</div>
          ${partnerGstin ? `<div class="meta-val"><strong>GSTIN:</strong> ${partnerGstin}</div>` : ''}
        </div>
        <div class="meta-card">
          <div class="meta-label">LOGISTICS & HANDOVER</div>
          <div class="meta-val"><strong>Delivered By:</strong> ${deliveredBy}</div>
          <div class="meta-val"><strong>Vehicle No:</strong> ${vehicleNo}</div>
        </div>
      </div>

      <!-- Items Table -->
      <table>
        <thead>
          <tr>
            <th style="width: 4%; text-align: center;">#</th>
            <th style="width: 22%;">Order / Design</th>
            <th style="width: 24%;">Yarn Description</th>
            <th style="width: 13%;">Colour</th>
            <th style="width: 9%; text-align: center;">Type</th>
            <th style="width: 10%; text-align: center;">Lot No</th>
            <th style="width: 8%;">From Loc</th>
            <th style="width: 10%; text-align: right;">Qty (kg)</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? `
            <tr>
              <td colspan="8" style="text-align: center; color: #6b7280; padding: 6px;">No yarn items found in delivery receipt.</td>
            </tr>
          ` : items.map((it, idx) => {
            const orderNum = it.orderNo || it.order_no || it.orders?.order_number || dydr.order_no || '—';
            const designNum = it.design || (it.orders ? [it.orders.design_no, it.orders.design_name].filter(Boolean).join(' / ') : '') || [dydr.design_no, dydr.design_name].filter(Boolean).join(' / ') || '—';
            const countDisplay = getFormatCount(it.yarn_count_id, it);
            const yarnType = it.type || it.yarn_type || it.process_type || 'weft';
            const lotNo = it.lot_number || it.lot_no || '—';
            const locName = typeof it.location === 'object' ? it.location?.location_name : (it.location || it.location_name || it.master_locations?.location_name || '—');
            const qty = parseFloat(it.quantity_kg || 0).toFixed(2);
            const isWarp = yarnType.toLowerCase() === 'warp';

            return `
              <tr>
                <td style="text-align: center; color: #64748b; font-size: 8px;">${idx + 1}</td>
                <td>
                  <div style="font-weight: 800; color: #0f172a;">${orderNum}</div>
                  <div style="font-size: 8px; color: #64748b; line-height: 1.1;">${designNum}</div>
                </td>
                <td style="font-weight: 600; color: #1e293b;">${countDisplay}</td>
                <td style="font-weight: 700; color: #7f1d1d; text-transform: uppercase;">${it.colour || '—'}</td>
                <td style="text-align: center;">
                  <span class="type-badge ${isWarp ? 'type-warp' : 'type-weft'}">${yarnType}</span>
                </td>
                <td style="text-align: center; font-weight: 700; font-family: monospace;">${lotNo}</td>
                <td style="color: #334155;">${locName}</td>
                <td style="text-align: right; font-weight: 900; color: #0f172a;">${qty}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr class="grand-total">
            <td colspan="6" style="text-align: right; font-weight: 800; color: #334155;">TOTAL DELIVERED WEIGHT:</td>
            <td colspan="2" style="text-align: right; font-weight: 900; color: #0f172a; border-bottom: 3px double #0f172a; font-size: 11px;">
              ${totalQty.toFixed(2)} <span style="font-size: 9px; font-weight: 700;">kg</span>
            </td>
          </tr>
        </tfoot>
      </table>

      <!-- Signatures Footer -->
      <div class="footer-signatures">
        <div class="sig-box-left">
          <div style="color: #64748b; font-size: 8px; margin-bottom: 16px;">
            Delivered By: <strong>${deliveredBy !== '—' ? deliveredBy : ''}</strong>
          </div>
          <div style="border-top: 1.5px dashed #475569; padding-top: 2px; font-weight: 700; color: #1e293b;">
            Sender / Dispatcher Signature
          </div>
        </div>

        ${remarks ? `
          <div class="sig-box-center">
            <strong>Remarks:</strong> ${remarks}
          </div>
        ` : '<div></div>'}

        <div class="sig-box-right">
          <div style="font-weight: 800; color: #1a1a1a; margin-bottom: 16px; font-size: 9px;">
            For ${partnerName !== 'In-House Production' ? partnerName : 'ASHOK TEXTILES'}
          </div>
          <div style="border-top: 1.5px solid #1a1a1a; padding-top: 2px; font-weight: 700; color: #1e293b; text-align: center;">
            Receiver / Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>DYDR - ${receiptNo}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            color: #111; 
            background: white; 
            font-size: 9px; 
            line-height: 1.25; 
          }
          .page-container {
            width: 100%;
            height: 282mm;
            display: flex;
            flex-direction: column;
            justifyContent: space-between;
            box-sizing: border-box;
            padding: 0;
            margin: 0 auto;
          }
          .dydr-copy {
            height: 136mm;
            max-height: 136mm;
            padding: 3mm 4mm;
            box-sizing: border-box;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justifyContent: space-between;
            page-break-inside: avoid;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            border-bottom: 2px solid #7f1d1d; 
            padding-bottom: 4px; 
            margin-bottom: 5px; 
          }
          .logo-area { display: flex; align-items: center; gap: 8px; }
          .logo-img { height: 36px; object-fit: contain; }
          .company-name { font-size: 14px; font-weight: 900; letter-spacing: 0.5px; color: #1a1a1a; line-height: 1.1; }
          .company-addr { font-size: 8px; color: #4b5563; font-weight: 500; margin-top: 1px; }
          .company-gst { font-size: 8px; color: #111827; font-weight: 700; margin-top: 1px; }
          .title-area { text-align: right; }
          .title { font-size: 11px; font-weight: 900; color: #7f1d1d; text-transform: uppercase; letter-spacing: 0.5px; }
          .badge {
            font-size: 7.5px;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 3px;
            background-color: #fef2f2;
            color: #991b1b;
            border: 1px solid #fecaca;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-block;
          }
          .receipt-no { font-size: 9px; color: #374151; margin-top: 2px; font-weight: 600; }
          .receipt-no strong { color: #7f1d1d; font-family: monospace; font-size: 10px; }

          .meta-grid { 
            display: grid; 
            grid-template-columns: repeat(4, 1fr); 
            gap: 5px; 
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 4px 6px;
            margin-bottom: 5px;
            font-size: 8.5px;
          }
          .meta-card {}
          .meta-label { font-size: 7px; font-weight: 900; color: #64748b; letter-spacing: 0.5px; margin-bottom: 2px; text-transform: uppercase; }
          .meta-val { font-size: 8.5px; color: #0f172a; line-height: 1.25; }

          table { width: 100%; border-collapse: collapse; margin-bottom: 4px; font-size: 8.5px; }
          thead tr { background-color: #f1f5f9; border-top: 1.5px solid #334155; border-bottom: 1.5px solid #334155; }
          th { padding: 3px 5px; text-align: left; font-size: 7.5px; text-transform: uppercase; font-weight: 800; color: #1e293b; border-bottom: 1.5px solid #cbd5e1; }
          td { padding: 3px 5px; border-bottom: 1px solid #e2e8f0; font-size: 8.5px; vertical-align: middle; line-height: 1.2; }
          .grand-total { background-color: #f8fafc; border-top: 1.5px solid #334155; }
          .type-badge {
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 7.5px;
            font-weight: 800;
            text-transform: uppercase;
            display: inline-block;
          }
          .type-warp { background-color: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
          .type-weft { background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }

          .footer-signatures {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 4px;
            margin-top: 2px;
            border-top: 1px solid #e2e8f0;
            font-size: 8px;
          }
          .sig-box-left { min-width: 150px; text-align: left; }
          .sig-box-center { max-width: 220px; text-align: center; color: #4b5563; font-size: 7.5px; font-style: italic; }
          .sig-box-right { min-width: 170px; text-align: right; }

          .print-divider {
            height: 5mm;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 4mm;
            color: #64748b;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 1px;
            margin: 0;
          }
          .divider-line { flex: 1; border-bottom: 1.5px dashed #94a3b8; }
          .divider-text { padding: 0 8px; color: #475569; display: flex; align-items: center; gap: 4px; }

          @media print {
            @page { size: A4 portrait; margin: 5mm 8mm; }
            body { padding: 0; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <!-- Top Half: Original Copy -->
          ${renderSingleCopyHtml('Original / Office Copy')}

          <!-- Cut Line Divider -->
          <div class="print-divider">
            <div class="divider-line"></div>
            <span class="divider-text">✂ CUT HERE ✂</span>
            <div class="divider-line"></div>
          </div>

          <!-- Bottom Half: Duplicate Copy -->
          ${renderSingleCopyHtml('Duplicate / Production Copy')}
        </div>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  
  setTimeout(() => {
    win.print();
    win.close();
  }, 350);
}
