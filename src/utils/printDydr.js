import { supabase } from '../lib/supabase';

/**
 * Reusable utility to trigger printing a Dyed Yarn Delivery Receipt (DYDR)
 * by opening a styled document in a new tab/window and invoking the print dialog.
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
  if (!partner) {
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
    if (!partnerId && formId) {
      try {
        const { data: wof } = await supabase
          .from('warping_order_forms')
          .select('partner_id')
          .eq('id', formId)
          .maybeSingle();
        if (wof?.partner_id) {
          partnerId = wof.partner_id;
        } else {
          const { data: wev } = await supabase
            .from('weaving_orders')
            .select('partner_id')
            .eq('id', formId)
            .maybeSingle();
          if (wev?.partner_id) {
            partnerId = wev.partner_id;
          } else {
            const { data: dof } = await supabase
              .from('dyeing_order_forms')
              .select('dyeing_unit_id')
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
    let docNo = dydr.doc_no || dydr.dof_number;
    if (!docNo && dydr.remarks) {
      const match = dydr.remarks.match(/(WOF|DOF|WEV)\S+/);
      if (match) docNo = match[0];
    }

    if (!partnerId && docNo) {
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

    // Fallback 3: Resolve partner_id by parsing partner name from document number or using partner_name directly
    let partnerName = dydr.partner_name;
    if (!partnerName && docNo) {
      const parts = docNo.split('/');
      if (parts.length > 4 && parts[3] === 'JB') {
        partnerName = parts[4];
      }
    }

    if (!partnerId && partnerName) {
      try {
        const { data: partnerData } = await supabase
          .from('master_partners')
          .select('id')
          .ilike('partner_name', partnerName)
          .maybeSingle();
        if (partnerData?.id) {
          partnerId = partnerData.id;
        }
      } catch (e) {
        console.error('Fallback 3 error:', e);
      }
    }

    if (!partnerId && dydr.dyeing_unit_id) {
      partnerId = dydr.dyeing_unit_id;
    }

    if (partnerId) {
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
  }
  const items = dydr.items || [];
  const totalQty = items.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);

  // Grouped by colour and count
  const getFormatCount = (id) => {
    const yc = yarnCounts.find(y => y.id === id);
    return yc ? [yc.count_value, yc.spec, yc.spec1].filter(Boolean).join(' ') : '—';
  };

  const groupedByColourAndCount = items.reduce((acc, i) => {
    const countId = i.yarn_count_id;
    const yc = i.yarn_count;
    const countDisplay = yc ? [yc.count_value, yc.spec, yc.spec1].filter(Boolean).join(' ') : getFormatCount(countId);
    const key = `${i.colour}_${countDisplay}`;
    if (!acc[key]) {
      acc[key] = {
        colour: i.colour,
        countDisplay: countDisplay,
        qty: 0
      };
    }
    acc[key].qty += parseFloat(i.quantity_kg || 0);
    return acc;
  }, {});
  const summaryRows = Object.values(groupedByColourAndCount);

  const printTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const printDateStr = dydr.delivered_date 
    ? new Date(dydr.delivered_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });



  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>DYDR - ${dydr.dydr_number || 'Receipt'}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Arial', sans-serif; color: #111; background: white; padding: 24px; font-size: 13px; line-height: 1.4; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #800000; padding-bottom: 12px; margin-bottom: 20px; }
          .logo-area { display: flex; alignItems: center; gap: 12px; }
          .logo-img { max-height: 60px; max-width: 200px; object-fit: contain; }
          .title-area { text-align: right; }
          .title { margin: 0; font-size: 1.4rem; font-weight: 800; color: #800000; text-transform: uppercase; }
          .subtitle { margin: 2px 0 0 0; font-size: 1.1rem; font-weight: 700; color: #111; font-family: monospace; }
          .meta-info { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; }
          .card-title { margin: 0 0 8px 0; font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
          .info-row { display: flex; gap: 8px; margin-bottom: 4px; }
          .info-label { color: #555; min-width: 130px; flex-shrink: 0; }
          .info-value { font-weight: 600; }
          .table-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #800000; border-bottom: 1px solid #800000; padding-bottom: 4px; margin: 20px 0 8px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #800000; color: white; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: 700; }
          td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
          tr:nth-child(even) td { background: #f9fafb; }
          .grand-total { background-color: #f3f4f6 !important; border-top: 2px solid #800000; font-weight: 800; }
          .grand-total td { font-size: 12px; }
          .summary-header { background: #fdf8f8; color: #800000; border-bottom: 2px solid #800000; }
          .summary-header th { background: transparent; color: #800000; }
          .remarks { margin-top: 20px; padding: 10px; background-color: #fdfdfd; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 11px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
          .sig-box { text-align: center; }
          .sig-line { width: 180px; border-top: 1px solid #000; padding-top: 6px; margin-top: 40px; }
          .sig-name { margin: 0; font-weight: 600; font-size: 12px; }
          .sig-title { margin: 2px 0 0 0; font-size: 10px; color: #666; }
          @media print {
            body { padding: 0; }
            @page { margin: 1.5cm; size: A4; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            <img class="logo-img" src="/logo.png" alt="Company Logo" onerror="this.style.display='none'; document.getElementById('fallback-title').style.display='block';" />
            <div id="fallback-title" style="display: none;">
              <h2 style="margin: 0; color: #800000; font-size: 1.4rem; font-weight: 900;">ANTIGRAVITY TEXTILES</h2>
              <p style="margin: 2px 0 0 0; font-size: 11px; color: #555;">Fabric Manufacturing ERP</p>
            </div>
          </div>
          <div class="title-area">
            <h1 class="title">DYED YARN DELIVERY RECEIPT</h1>
            <p class="subtitle">${dydr.dydr_number || '—'}</p>
            <p style="margin-top: 4px; font-size: 11px; color: #666;">Date: ${printDateStr} &nbsp;·&nbsp; Time: ${printTimeStr}</p>
            ${dydr.eway_bill_no && dydr.eway_bill_status === 'generated' ? `
              <p style="margin-top: 4px; font-size: 11px; font-weight: 800; color: #166534; font-family: monospace;">
                E-WAY BILL: ${dydr.eway_bill_no}
              </p>
            ` : ''}
          </div>
        </div>

        <div class="meta-info">
          <div class="card">
            <p class="card-title">Delivery Details</p>
            <div class="info-row">
              <span class="info-label">${
                dydr.target_process === 'weaving' 
                  ? 'Weaving Order' 
                  : dydr.target_process === 'redyeing'
                  ? 'Dyeing Order (DOF)'
                  : 'Warping Form (WOF)'
              }:</span>
              <span class="info-value">${dydr.doc_no || '—'}</span>
            </div>
            ${dydr.machine_name ? `
              <div class="info-row">
                <span class="info-label">Machine No / Name:</span>
                <span class="info-value">${dydr.machine_name}</span>
              </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">Delivered By:</span>
              <span class="info-value">${dydr.delivered_by || '—'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Vehicle No:</span>
              <span class="info-value">${dydr.vehicle_no || 'In-House Delivery'}</span>
            </div>
          </div>

          <div class="card">
            <p class="card-title">Delivery To (Partner)</p>
            ${partner ? `
              <div class="info-row">
                <span class="info-label">Name:</span>
                <span class="info-value">${partner.partner_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Address:</span>
                <span class="info-value" style="white-space: pre-wrap;">${partner.address || '—'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">GSTIN:</span>
                <span class="info-value">${partner.gstin || '—'}</span>
              </div>
            ` : `
              <div class="info-row">
                <span class="info-value" style="color: #888; font-style: italic;">No partner details resolved</span>
              </div>
            `}
          </div>

          <div class="card">
            <p class="card-title">Linked Order Info</p>
            <div class="info-row">
              <span class="info-label">Order No:</span>
              <span class="info-value" style="color: #800000;">${dydr.order_no || '—'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Design Spec:</span>
              <span class="info-value">${dydr.design_no || '—'} ${dydr.design_name ? `/ ${dydr.design_name}` : ''}</span>
            </div>
          </div>
        </div>

        <h3 class="table-title">Allocated Lot Details</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 50px;">S.No</th>
              <th>Colour</th>
              <th>Yarn Count</th>
              <th>Lot Number</th>
              <th>Warehouse Location</th>
              <th style="text-align: right; width: 120px;">Quantity (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => {
              const yc = item.yarn_count;
              const countDisplay = yc ? [yc.count_value, yc.spec, yc.spec1].filter(Boolean).join(' ') : getFormatCount(item.yarn_count_id);
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td style="font-weight: 700; color: #800000;">${item.colour || '—'}</td>
                  <td>${countDisplay}</td>
                  <td style="font-weight: 600;">${item.lot_number || '—'}</td>
                  <td>${item.location_name || '—'}</td>
                  <td style="text-align: right; font-weight: 700;">${parseFloat(item.quantity_kg || 0).toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
            <tr class="grand-total">
              <td colspan="5" style="text-align: right;">GRAND TOTAL:</td>
              <td style="text-align: right; color: #800000;">${totalQty.toFixed(2)} kg</td>
            </tr>
          </tbody>
        </table>

        <h3 class="table-title">Total Quantity by Colour & Count</h3>
        <table>
          <thead>
            <tr class="summary-header">
              <th>Colour</th>
              <th>Yarn Count</th>
              <th style="text-align: right; width: 150px;">Total Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows.map(row => `
              <tr>
                <td style="font-weight: 700; color: #800000;">${row.colour}</td>
                <td>${row.countDisplay}</td>
                <td style="text-align: right; font-weight: 700; color: #047857;">${row.qty.toFixed(2)} kg</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${dydr.remarks ? `
          <div class="remarks">
            <strong>Remarks:</strong> ${dydr.remarks}
          </div>
        ` : ''}

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line">
              <p class="sig-name">${dydr.delivered_by || '—'}</p>
              <p class="sig-title">Delivered By</p>
            </div>
          </div>
          <div class="sig-box">
            <div class="sig-line">
              <p class="sig-name">&nbsp;</p>
              <p class="sig-title">Received By / Signature</p>
            </div>
          </div>
          <div class="sig-box">
            <div class="sig-line">
              <p class="sig-name">&nbsp;</p>
              <p class="sig-title">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  
  // Timeout ensures images/styles load before print dialog opens
  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
}
