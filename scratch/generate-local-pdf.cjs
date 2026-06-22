const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');

async function generateDofPdf(
  record, 
  dyeingUnitName, 
  creatorName, 
  ordersData, 
  countsMap
) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const obliqueFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const primaryColor = rgb(127/255, 29/255, 29/255); // #7f1d1d (maroon)
  const textColor = rgb(0.1, 0.1, 0.1);
  const mutedTextColor = rgb(0.4, 0.4, 0.4);
  const gridColor = rgb(0.9, 0.9, 0.9);

  // ── 1. Company Logo & QR Code Header ──
  // Load Logo
  let logoImage = null;
  const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      const logoBytes = fs.readFileSync(logoPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch (err) {
      console.error("Failed to embed local logo:", err);
    }
  }

  // Draw Logo
  if (logoImage) {
    const dims = logoImage.scaleToFit(140, 45); // Keep it same size as printed
    page.drawImage(logoImage, {
      x: 50,
      y: 755 + (45 - dims.height) / 2,
      width: dims.width,
      height: dims.height,
    });
  } else {
    page.drawText("ASHOK TEXTILES", { x: 50, y: 780, size: 16, font: boldFont, color: primaryColor });
    page.drawText("Fabric Manufacturing ERP", { x: 50, y: 765, size: 8, font, color: mutedTextColor });
  }

  // Generate QR Code
  let qrImage = null;
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(record.dof_number, { margin: 1, width: 100 });
    const base64Data = qrCodeDataUrl.split(",")[1];
    const qrPngBytes = Buffer.from(base64Data, 'base64');
    qrImage = await pdfDoc.embedPng(qrPngBytes);
  } catch (err) {
    console.error("Failed to generate/embed QR code:", err);
  }

  // Draw QR Code & Header Details
  if (qrImage) {
    page.drawImage(qrImage, { x: 500, y: 753, width: 45, height: 45 });
  }

  // Right-aligned header details relative to QR code
  const titleX = qrImage ? 490 : 545;
  const titleW = boldFont.widthOfTextAtSize("DYEING ORDER FORM", 13);
  page.drawText("DYEING ORDER FORM", { x: titleX - titleW, y: 780, size: 13, font: boldFont, color: primaryColor });
  
  const dofW = boldFont.widthOfTextAtSize(record.dof_number, 10);
  page.drawText(record.dof_number, { x: titleX - dofW, y: 767, size: 10, font: boldFont, color: textColor });
  
  const createdDate = record.created_at ? new Date(record.created_at) : new Date();
  const dateStr = createdDate.toLocaleDateString("en-IN", { day: '2-digit', month: 'long', year: 'numeric' });
  const dateValStr = `Date: ${dateStr}`;
  const dateValW = font.widthOfTextAtSize(dateValStr, 8);
  page.drawText(dateValStr, { x: titleX - dateValW, y: 755, size: 8, font, color: mutedTextColor });

  // Maroon divider under header
  page.drawLine({ start: { x: 50, y: 740 }, end: { x: 545, y: 740 }, thickness: 2.5, color: primaryColor });

  // ── 2. Metadata Grid (Dyeing Unit Details & Document Details) ──
  let y = 725;
  const boxHeight = 85;
  
  // Draw Background cards
  page.drawRectangle({ x: 50, y: y - boxHeight, width: 240, height: boxHeight, borderColor: gridColor, borderWidth: 1 });
  page.drawRectangle({ x: 305, y: y - boxHeight, width: 240, height: boxHeight, borderColor: gridColor, borderWidth: 1 });

  // Left Card (DYEING UNIT DETAILS)
  page.drawText("DYEING UNIT DETAILS", { x: 58, y: y - 12, size: 8, font: boldFont, color: mutedTextColor });
  
  page.drawText("Dyeing Unit Name:", { x: 58, y: y - 27, size: 8.5, font, color: mutedTextColor });
  page.drawText(dyeingUnitName, { x: 155, y: y - 27, size: 8.5, font: boldFont, color: textColor });
  
  page.drawText("Expected Delivery:", { x: 58, y: y - 39, size: 8.5, font, color: mutedTextColor });
  const deliveryDateStr = record.expected_delivery_date
    ? new Date(record.expected_delivery_date).toLocaleDateString("en-IN", { day: '2-digit', month: 'long', year: 'numeric' })
    : "Not set";
  page.drawText(deliveryDateStr, { x: 155, y: y - 39, size: 8.5, font: boldFont, color: textColor });

  // Right Card (DOCUMENT DETAILS)
  page.drawText("DOCUMENT DETAILS", { x: 313, y: y - 12, size: 8, font: boldFont, color: mutedTextColor });
  
  page.drawText("Prepared By:", { x: 313, y: y - 27, size: 8.5, font, color: mutedTextColor });
  page.drawText(creatorName, { x: 405, y: y - 27, size: 8.5, font: boldFont, color: textColor });
  
  page.drawText("Prepared On:", { x: 313, y: y - 39, size: 8.5, font, color: mutedTextColor });
  const preparedOnStr = record.created_at ? new Date(record.created_at).toLocaleString("en-IN") : new Date().toLocaleString("en-IN");
  page.drawText(preparedOnStr, { x: 405, y: y - 39, size: 8.5, font: boldFont, color: textColor });
  
  page.drawText("Linked Orders:", { x: 313, y: y - 51, size: 8.5, font, color: mutedTextColor });
  const linkedOrdersStr = ordersData.map(o => o.order_number).join(', ') || '-';
  let linkedOrdersShort = linkedOrdersStr;
  if (linkedOrdersShort.length > 22) {
    linkedOrdersShort = linkedOrdersShort.substring(0, 19) + "...";
  }
  page.drawText(linkedOrdersShort, { x: 405, y: y - 51, size: 8.5, font: boldFont, color: textColor });
  
  page.drawText("Approval Status:", { x: 313, y: y - 63, size: 8.5, font, color: mutedTextColor });
  page.drawText((record.status || "pending").toUpperCase(), { x: 405, y: y - 63, size: 8.5, font: boldFont, color: textColor });
  
  page.drawText("Yarn Status:", { x: 313, y: y - 75, size: 8.5, font, color: mutedTextColor });
  function getYarnStatusText(status) {
    switch (status) {
      case 'pending':
      case 'rejected':
      case 'approved':           return 'GREIGE NOT SENT';
      case 'partially_sent':      return 'GREIGE PARTIALLY SENT';
      case 'fully_sent':         return 'GREIGE SENT';
      case 'partially_received': return 'PARTIALLY RECEIVED';
      case 'received':           return 'FULLY RECEIVED';
      default:                   return (status || 'greige_not_sent').toUpperCase().replace(/_/g, ' ');
    }
  }
  page.drawText(getYarnStatusText(record.status), { x: 405, y: y - 75, size: 8.5, font: boldFont, color: textColor });

  y -= (boxHeight + 15);

  // ── 3. Linked Orders Table ──
  if (ordersData && ordersData.length > 0) {
    page.drawText("LINKED ORDERS", { x: 50, y, size: 9, font: boldFont, color: primaryColor });
    y -= 12;
    
    // Header Row
    page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 16, color: primaryColor });
    page.drawText("Order No.", { x: 55, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText("Design No.", { x: 155, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText("Design Name", { x: 265, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText("Buyer", { x: 415, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
    
    y -= 18;

    // Data Rows
    for (let i = 0; i < ordersData.length; i++) {
      const o = ordersData[i];
      if (i % 2 === 0) {
        page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 15, color: rgb(0.98, 0.98, 0.98) });
      }
      page.drawText(o.order_number || "-", { x: 55, y, size: 8, font: boldFont });
      page.drawText(o.design_no || "-", { x: 155, y, size: 8, font });
      page.drawText(o.design_name || "-", { x: 265, y, size: 8, font });
      page.drawText(o.buyer || "-", { x: 415, y, size: 8, font });

      page.drawLine({ start: { x: 50, y: y - 4 }, end: { x: 545, y: y - 4 }, thickness: 0.5, color: gridColor });
      y -= 15;
    }
    y -= 10;
  }

  // ── 4. Yarn Allocation Details Table ──
  page.drawText("YARN ALLOCATION DETAILS", { x: 50, y, size: 9, font: boldFont, color: primaryColor });
  y -= 12;

  // Header Row
  page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 16, color: primaryColor });
  page.drawText("Order No.", { x: 55, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("Type", { x: 145, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("Yarn Count", { x: 205, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("Colour", { x: 325, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  
  // Right aligned headers
  const baseHeaderW = boldFont.widthOfTextAtSize("Base Qty (kg)", 8);
  page.drawText("Base Qty (kg)", { x: 455 - baseHeaderW, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  
  const excessHeaderW = boldFont.widthOfTextAtSize("Excess %", 8);
  page.drawText("Excess %", { x: 490 - excessHeaderW, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  
  const totalHeaderW = boldFont.widthOfTextAtSize("Total Qty (kg)", 8);
  page.drawText("Total Qty (kg)", { x: 540 - totalHeaderW, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });

  y -= 18;

  const allocations = record.yarn_allocations || [];
  const ordersMap = new Map();
  if (ordersData) {
    ordersData.forEach(o => ordersMap.set(o.id, o.order_number));
  }

  let grandTotal = 0;
  for (let i = 0; i < allocations.length; i++) {
    const a = allocations[i];
    const orderNo = ordersMap.get(a.orderId) || a.orderNo || "N/A";
    const countVal = countsMap.get(a.countId) || a.yarnLabel || "N/A";
    const typeStr = a.type || "N/A";
    const colourStr = a.colour || "N/A";
    const baseKg = parseFloat(a.base_kg || 0).toFixed(2);
    const excessPct = `${a.excess_pct || 0}%`;
    const totalKg = parseFloat(a.total_kg || 0).toFixed(2);
    grandTotal += parseFloat(a.total_kg || 0);

    if (i % 2 === 0) {
      page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 15, color: rgb(0.98, 0.98, 0.98) });
    }

    page.drawText(orderNo, { x: 55, y, size: 8, font: boldFont });
    page.drawText(typeStr, { x: 145, y, size: 8, font });
    page.drawText(countVal, { x: 205, y, size: 8, font });
    page.drawText(colourStr, { x: 325, y, size: 8, font });

    const wBase = font.widthOfTextAtSize(baseKg, 8);
    page.drawText(baseKg, { x: 455 - wBase, y, size: 8, font });

    const wExcess = font.widthOfTextAtSize(excessPct, 8);
    page.drawText(excessPct, { x: 490 - wExcess, y, size: 8, font });

    const wTotal = font.widthOfTextAtSize(totalKg, 8);
    page.drawText(totalKg, { x: 540 - wTotal, y, size: 8, font });

    page.drawLine({ start: { x: 50, y: y - 4 }, end: { x: 545, y: y - 4 }, thickness: 0.5, color: gridColor });
    y -= 15;
  }

  // Grand Total Row
  page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 16, color: rgb(0.95, 0.95, 0.95) });
  page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: 545, y: y + 12 }, thickness: 1.5, color: primaryColor });
  
  page.drawText("GRAND TOTAL:", { x: 325, y, size: 8.5, font: boldFont, color: textColor });
  
  const grandTotalStr = `${grandTotal.toFixed(2)} kg`;
  const grandTotalW = boldFont.widthOfTextAtSize(grandTotalStr, 8.5);
  page.drawText(grandTotalStr, { x: 540 - grandTotalW, y, size: 8.5, font: boldFont, color: primaryColor });
  
  y -= 25;

  // ── 5. Count & Colour Summary + Count Summary side by side ──
  if (record.summary && record.summary.length > 0) {
    const summaryY = y;
    
    // Left Box: Count & Colour Wise Summary
    page.drawText("COUNT & COLOUR WISE SUMMARY", { x: 50, y: summaryY, size: 9, font: boldFont, color: primaryColor });
    y -= 12;
    
    page.drawRectangle({ x: 50, y: y - 4, width: 260, height: 14, color: primaryColor });
    page.drawText("Yarn Count", { x: 53, y: y, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText("Colour", { x: 163, y: y, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    
    const leftTotalHeaderW = boldFont.widthOfTextAtSize("Total (kg)", 7.5);
    page.drawText("Total (kg)", { x: 307 - leftTotalHeaderW, y, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    
    y -= 15;
    for (let i = 0; i < record.summary.length; i++) {
      const s = record.summary[i];
      const label = s.yarnLabel || countsMap.get(s.countId) || "N/A";
      
      if (i % 2 === 0) {
        page.drawRectangle({ x: 50, y: y - 4, width: 260, height: 12, color: rgb(0.98, 0.98, 0.98) });
      }

      page.drawText(label, { x: 53, y, size: 7.5, font });
      page.drawText(s.colour || "-", { x: 163, y, size: 7.5, font });
      
      const valStr = parseFloat(s.total_kg || 0).toFixed(2);
      const valW = font.widthOfTextAtSize(valStr, 7.5);
      page.drawText(valStr, { x: 307 - valW, y, size: 7.5, font });
      
      page.drawLine({ start: { x: 50, y: y - 4 }, end: { x: 310, y: y - 4 }, thickness: 0.5, color: gridColor });
      y -= 12;
    }

    // Total row for Left Summary
    page.drawRectangle({ x: 50, y: y - 4, width: 260, height: 14, color: rgb(0.95, 0.95, 0.95) });
    page.drawText("Total:", { x: 163, y, size: 7.5, font: boldFont, color: textColor });
    const totalSumValStr = record.summary.reduce((s, r) => s + parseFloat(r.total_kg || 0), 0).toFixed(2);
    const totalSumValW = boldFont.widthOfTextAtSize(totalSumValStr, 7.5);
    page.drawText(totalSumValStr, { x: 307 - totalSumValW, y, size: 7.5, font: boldFont, color: primaryColor });
    y -= 15;

    // Right Box: Count Wise Summary
    let rightY = summaryY;
    page.drawText("COUNT WISE SUMMARY", { x: 325, y: rightY, size: 9, font: boldFont, color: primaryColor });
    rightY -= 12;
    
    page.drawRectangle({ x: 325, y: rightY - 4, width: 220, height: 14, color: primaryColor });
    page.drawText("Yarn Count", { x: 328, y: rightY, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    
    const rightTotalHeaderW = boldFont.widthOfTextAtSize("Total (kg)", 7.5);
    page.drawText("Total (kg)", { x: 542 - rightTotalHeaderW, y: rightY, size: 7.5, font: boldFont, color: rgb(1, 1, 1) });
    
    rightY -= 15;
    const countMap = {};
    record.summary.forEach(s => {
      const label = s.yarnLabel || countsMap.get(s.countId) || "N/A";
      if (!countMap[label]) countMap[label] = 0;
      countMap[label] += parseFloat(s.total_kg || 0);
    });
    
    const countSummary = Object.entries(countMap).map(([label, total_kg]) => ({ label, total_kg }));
    for (let i = 0; i < countSummary.length; i++) {
      const c = countSummary[i];
      if (i % 2 === 0) {
        page.drawRectangle({ x: 325, y: rightY - 4, width: 220, height: 12, color: rgb(0.98, 0.98, 0.98) });
      }

      page.drawText(c.label, { x: 328, y: rightY, size: 7.5, font });
      
      const valStr = parseFloat(c.total_kg || 0).toFixed(2);
      const valW = font.widthOfTextAtSize(valStr, 7.5);
      page.drawText(valStr, { x: 542 - valW, y: rightY, size: 7.5, font });
      
      page.drawLine({ start: { x: 325, y: rightY - 4 }, end: { x: 545, y: rightY - 4 }, thickness: 0.5, color: gridColor });
      rightY -= 12;
    }

    // Total row for Right Summary
    page.drawRectangle({ x: 325, y: rightY - 4, width: 220, height: 14, color: rgb(0.95, 0.95, 0.95) });
    page.drawText("Grand Total:", { x: 328, y: rightY, size: 7.5, font: boldFont, color: textColor });
    const grandSumValStr = countSummary.reduce((s, c) => s + c.total_kg, 0).toFixed(2);
    const grandSumValW = boldFont.widthOfTextAtSize(grandSumValStr, 7.5);
    page.drawText(grandSumValStr, { x: 542 - grandSumValW, y: rightY, size: 7.5, font: boldFont, color: primaryColor });
    rightY -= 15;

    // Unify Y coordinate to the lowest point
    y = Math.min(y, rightY) - 10;
  }

  // ── 6. Status Banner ──
  const status = record.status || "pending";
  if (status === "pending") {
    page.drawRectangle({ 
      x: 50, 
      y: y - 40, 
      width: 495, 
      height: 40, 
      color: rgb(254/255, 243/255, 199/255), 
      borderColor: rgb(252/255, 211/255, 75/255), 
      borderWidth: 1 
    });
    page.drawText("APPROVAL PENDING", { x: 65, y: y - 18, size: 9, font: boldFont, color: rgb(146/255, 64/255, 14/255) });
    page.drawText("This Dyeing Order Form has been submitted and is awaiting approval from the Managing Partner.", { x: 65, y: y - 32, size: 7.5, font, color: rgb(120/255, 53/255, 15/255) });
  } else if (status === "rejected") {
    page.drawRectangle({ 
      x: 50, 
      y: y - 40, 
      width: 495, 
      height: 40, 
      color: rgb(254/255, 226/255, 226/255), 
      borderColor: rgb(252/255, 165/255, 165/255), 
      borderWidth: 1 
    });
    page.drawText("REJECTED", { x: 65, y: y - 18, size: 9, font: boldFont, color: rgb(153/255, 27/255, 27/255) });
    const rejectReason = record.approval_notes ? ` Reason: ${record.approval_notes}` : "";
    page.drawText(`This Dyeing Order Form was not approved.${rejectReason}`, { x: 65, y: y - 32, size: 7.5, font, color: rgb(127/255, 29/255, 29/255) });
  } else {
    page.drawRectangle({ 
      x: 50, 
      y: y - 40, 
      width: 495, 
      height: 40, 
      color: rgb(220/255, 252/255, 231/255), 
      borderColor: rgb(134/255, 239/255, 172/255), 
      borderWidth: 1 
    });
    page.drawText("APPROVED", { x: 65, y: y - 18, size: 9, font: boldFont, color: rgb(22/255, 101/255, 52/255) });
    page.drawText("This Dyeing Order Form has been approved by the Managing Partner.", { x: 65, y: y - 32, size: 7.5, font, color: rgb(22/255, 101/255, 52/255) });
  }

  y -= 55;

  // ── 7. Signature Block ──
  if (y < 90) {
    y = 90;
  }
  
  // Left: Prepared By
  page.drawLine({ start: { x: 50, y: y }, end: { x: 200, y: y }, thickness: 1, color: mutedTextColor });
  page.drawText(creatorName || "Merchandiser", { x: 50, y: y - 15, size: 8, font: boldFont, color: textColor });
  page.drawText("Prepared By", { x: 50, y: y - 25, size: 7.5, font, color: mutedTextColor });
  const createdDateStr = createdDate.toLocaleDateString("en-IN", { day: '2-digit', month: 'long', year: 'numeric' });
  page.drawText(createdDateStr, { x: 50, y: y - 35, size: 7.5, font, color: mutedTextColor });

  // Right: Managing Partner
  if (status === "approved") {
    page.drawLine({ start: { x: 395, y: y }, end: { x: 545, y: y }, thickness: 1, color: mutedTextColor });
    page.drawText("APPROVED - VIJAYAKUMAR", { x: 395, y: y - 15, size: 8, font: boldFont, color: rgb(22/255, 101/255, 52/255) });
    page.drawText("Managing Partner", { x: 395, y: y - 25, size: 7.5, font, color: mutedTextColor });
    const approvedDateStr = record.updated_at ? new Date(record.updated_at).toLocaleDateString("en-IN", { day: '2-digit', month: 'long', year: 'numeric' }) : dateStr;
    page.drawText(approvedDateStr, { x: 395, y: y - 35, size: 7.5, font, color: mutedTextColor });
  } else if (status === "rejected") {
    page.drawLine({ start: { x: 395, y: y }, end: { x: 545, y: y }, thickness: 1, color: mutedTextColor });
    page.drawText("REJECTED - VIJAYAKUMAR", { x: 395, y: y - 15, size: 8, font: boldFont, color: rgb(153/255, 27/255, 27/255) });
    page.drawText("Managing Partner", { x: 395, y: y - 25, size: 7.5, font, color: mutedTextColor });
    const rejectedDateStr = record.updated_at ? new Date(record.updated_at).toLocaleDateString("en-IN", { day: '2-digit', month: 'long', year: 'numeric' }) : dateStr;
    page.drawText(rejectedDateStr, { x: 395, y: y - 35, size: 7.5, font, color: mutedTextColor });
  } else {
    page.drawLine({ start: { x: 395, y: y }, end: { x: 545, y: y }, thickness: 1, color: mutedTextColor, lineDashPattern: [3, 3] });
    page.drawText("VIJAYAKUMAR", { x: 395, y: y - 15, size: 8, font: boldFont, color: textColor });
    page.drawText("Managing Partner", { x: 395, y: y - 25, size: 7.5, font, color: mutedTextColor });
    page.drawText("Approval Signature / Date", { x: 395, y: y - 35, size: 7.5, font: obliqueFont, color: rgb(0.6, 0.6, 0.6) });
  }

  return await pdfDoc.save();
}

async function run() {
  const mockRecord = {
    id: 'e312f2c9-6fb4-4cd7-959c-7c08798bb2ef',
    dof_number: 'AT/2026/DOF/00008',
    created_at: new Date('2026-06-11T14:55:00+05:30'),
    dyeing_unit_id: 'some-dyeing-unit',
    expected_delivery_date: '2026-06-13',
    status: 'pending',
    yarn_allocations: [
      {
        orderId: 'order-1',
        orderNo: 'AT/2026/S/00005',
        type: 'Warp',
        countId: 'count-1',
        yarnLabel: '30s - Cotton - BCI',
        colour: 'PINK',
        base_kg: 30.00,
        excess_pct: 3,
        total_kg: 30.90
      },
      {
        orderId: 'order-1',
        orderNo: 'AT/2026/S/00005',
        type: 'Weft',
        countId: 'count-1',
        yarnLabel: '30s - Cotton - BCI',
        colour: 'BLACK',
        base_kg: 30.00,
        excess_pct: 3,
        total_kg: 30.90
      }
    ],
    summary: [
      {
        countId: 'count-1',
        yarnLabel: '30s - Cotton - BCI',
        colour: 'PINK',
        total_kg: 30.90
      },
      {
        countId: 'count-1',
        yarnLabel: '30s - Cotton - BCI',
        colour: 'BLACK',
        total_kg: 30.90
      }
    ]
  };

  const ordersData = [
    {
      id: 'order-1',
      order_number: 'AT/2026/S/00005',
      design_no: 'test',
      design_name: '3',
      buyer: 'AIRE'
    }
  ];

  const countsMap = new Map([
    ['count-1', '30s - Cotton - BCI']
  ]);

  const pdfBytes = await generateDofPdf(
    mockRecord,
    'ANNAMALAI',
    'Madhanraj',
    ordersData,
    countsMap
  );

  const outputPath = path.join(__dirname, 'test.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  console.log('PDF written successfully to:', outputPath);
}

run().catch(console.error);
