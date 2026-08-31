import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

/**
 * Generates an A4 PDF document for Dyeing Order Form matching the exact layout and details of DyeingFormView.jsx
 */
export async function generateDofPdfBytes(record, dyeingUnitName, creatorName, ordersData = [], countsMap = new Map()) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 Size (points)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(127 / 255, 29 / 255, 29 / 255); // Maroon #7f1d1d
  const textColor = rgb(0.07, 0.07, 0.07);
  const mutedTextColor = rgb(0.4, 0.4, 0.4);
  const gridColor = rgb(0.88, 0.88, 0.88);

  // Helper for formatted yarn name
  const formatYarnName = (countId, fallback) => {
    if (countsMap && countsMap.has(countId)) {
      return countsMap.get(countId);
    }
    return fallback || countId || 'Yarn';
  };

  // Orders lookup map
  const ordersMap = new Map();
  if (Array.isArray(ordersData)) {
    ordersData.forEach(o => ordersMap.set(o.id, o));
  }

  // 1. Company Logo & QR Code Header
  let logoImage = null;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://at-erp.vercel.app';
  const logoUrl = `${origin}/logo.png`;
  try {
    const logoResp = await fetch(logoUrl);
    if (logoResp.ok) {
      const logoBytes = new Uint8Array(await logoResp.arrayBuffer());
      logoImage = await pdfDoc.embedPng(logoBytes);
    }
  } catch (err) {
    console.warn('Could not load logo PNG for PDF, falling back to text:', err);
  }

  // Draw Logo
  if (logoImage) {
    const dims = logoImage.scaleToFit(140, 45);
    page.drawImage(logoImage, {
      x: 50,
      y: 755 + (45 - dims.height) / 2,
      width: dims.width,
      height: dims.height,
    });
  } else {
    page.drawText('ASHOK TEXTILES', { x: 50, y: 780, size: 16, font: boldFont, color: primaryColor });
    page.drawText('Fabric Manufacturing ERP', { x: 50, y: 765, size: 8, font, color: mutedTextColor });
  }

  // Generate QR Code
  let qrImage = null;
  const dofNumStr = record.dof_number || 'DOF';
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(dofNumStr, { margin: 1, width: 100 });
    const base64Data = qrCodeDataUrl.split(',')[1];
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const qrPngBytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      qrPngBytes[i] = binaryString.charCodeAt(i);
    }
    qrImage = await pdfDoc.embedPng(qrPngBytes);
  } catch (err) {
    console.warn('QR code generation failed:', err);
  }

  if (qrImage) {
    page.drawImage(qrImage, { x: 500, y: 753, width: 45, height: 45 });
  }

  // Right-aligned header details
  const titleX = qrImage ? 490 : 545;
  const titleW = boldFont.widthOfTextAtSize('DYEING ORDER FORM', 13);
  page.drawText('DYEING ORDER FORM', { x: titleX - titleW, y: 780, size: 13, font: boldFont, color: primaryColor });

  const dofW = boldFont.widthOfTextAtSize(dofNumStr, 10);
  page.drawText(dofNumStr, { x: titleX - dofW, y: 767, size: 10, font: boldFont, color: textColor });

  const createdDate = record.created_at ? new Date(record.created_at) : new Date();
  const dateStr = createdDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const dateValStr = `Date: ${dateStr}`;
  const dateValW = font.widthOfTextAtSize(dateValStr, 8);
  page.drawText(dateValStr, { x: titleX - dateValW, y: 755, size: 8, font, color: mutedTextColor });

  // Maroon divider under header
  page.drawLine({ start: { x: 50, y: 740 }, end: { x: 545, y: 740 }, thickness: 2.5, color: primaryColor });

  // 2. Metadata Grid (Dyeing Unit Details & Document Details)
  let y = 725;
  const boxHeight = 85;

  page.drawRectangle({ x: 50, y: y - boxHeight, width: 240, height: boxHeight, borderColor: gridColor, borderWidth: 1 });
  page.drawRectangle({ x: 305, y: y - boxHeight, width: 240, height: boxHeight, borderColor: gridColor, borderWidth: 1 });

  // Left Card (DYEING UNIT DETAILS)
  page.drawText('DYEING UNIT DETAILS', { x: 58, y: y - 12, size: 8, font: boldFont, color: mutedTextColor });
  page.drawText('Dyeing Unit Name:', { x: 58, y: y - 27, size: 8.5, font, color: mutedTextColor });
  page.drawText(dyeingUnitName || 'N/A', { x: 155, y: y - 27, size: 8.5, font: boldFont, color: textColor });

  page.drawText('Expected Delivery:', { x: 58, y: y - 39, size: 8.5, font, color: mutedTextColor });
  const deliveryDateStr = record.expected_delivery_date
    ? new Date(record.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Not set';
  page.drawText(deliveryDateStr, { x: 155, y: y - 39, size: 8.5, font: boldFont, color: textColor });

  // Right Card (DOCUMENT DETAILS)
  page.drawText('DOCUMENT DETAILS', { x: 313, y: y - 12, size: 8, font: boldFont, color: mutedTextColor });
  page.drawText('Prepared By:', { x: 313, y: y - 27, size: 8.5, font, color: mutedTextColor });
  page.drawText(creatorName || 'Merchandiser', { x: 405, y: y - 27, size: 8.5, font: boldFont, color: textColor });

  page.drawText('Prepared On:', { x: 313, y: y - 39, size: 8.5, font, color: mutedTextColor });
  const preparedOnStr = record.created_at ? new Date(record.created_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
  page.drawText(preparedOnStr, { x: 405, y: y - 39, size: 8.5, font: boldFont, color: textColor });

  page.drawText('Linked Orders:', { x: 313, y: y - 51, size: 8.5, font, color: mutedTextColor });
  const linkedOrdersStr = ordersData.map(o => o.order_number).join(', ') || '-';
  let linkedOrdersShort = linkedOrdersStr;
  if (linkedOrdersShort.length > 24) {
    linkedOrdersShort = linkedOrdersShort.substring(0, 21) + '...';
  }
  page.drawText(linkedOrdersShort, { x: 405, y: y - 51, size: 8.5, font: boldFont, color: textColor });

  page.drawText('Approval Status:', { x: 313, y: y - 63, size: 8.5, font, color: mutedTextColor });
  page.drawText((record.status || 'pending').toUpperCase(), { x: 405, y: y - 63, size: 8.5, font: boldFont, color: textColor });

  page.drawText('Yarn Status:', { x: 313, y: y - 75, size: 8.5, font, color: mutedTextColor });
  page.drawText('GREIGE NOT SENT', { x: 405, y: y - 75, size: 8.5, font: boldFont, color: textColor });

  y -= (boxHeight + 15);

  // 3. Linked Orders Table
  if (ordersData && ordersData.length > 0) {
    page.drawText('LINKED ORDERS', { x: 50, y, size: 8.5, font: boldFont, color: primaryColor });
    y -= 12;

    // Header Row
    page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 16, color: primaryColor });
    page.drawText('Order No.', { x: 55, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('Design No.', { x: 170, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('Design Name', { x: 280, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('Buyer', { x: 420, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });

    y -= 16;

    // Data Rows
    for (let i = 0; i < ordersData.length; i++) {
      const o = ordersData[i];
      if (i % 2 === 0) {
        page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 14, color: rgb(0.98, 0.98, 0.98) });
      }
      page.drawText(o.order_number || '-', { x: 55, y, size: 8, font: boldFont });
      page.drawText(o.design_no || '-', { x: 170, y, size: 8, font });
      page.drawText(o.design_name || '-', { x: 280, y, size: 8, font });
      page.drawText(o.master_brands?.brand_name || '-', { x: 420, y, size: 8, font });

      page.drawLine({ start: { x: 50, y: y - 4 }, end: { x: 545, y: y - 4 }, thickness: 0.5, color: gridColor });
      y -= 14;
    }
    y -= 10;
  }

  // 4. Yarn Allocation Details Table
  page.drawText('YARN ALLOCATION DETAILS', { x: 50, y, size: 8.5, font: boldFont, color: primaryColor });
  y -= 12;

  // Header Row
  page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 16, color: primaryColor });
  page.drawText('Order No.', { x: 55, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('Type', { x: 140, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('Yarn Count', { x: 190, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('Colour', { x: 330, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });

  const baseHeaderW = boldFont.widthOfTextAtSize('Base Qty (kg)', 8);
  page.drawText('Base Qty (kg)', { x: 435 - baseHeaderW, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });

  const excessHeaderW = boldFont.widthOfTextAtSize('Excess %', 8);
  page.drawText('Excess %', { x: 480 - excessHeaderW, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });

  const totalHeaderW = boldFont.widthOfTextAtSize('Total Qty (kg)', 8);
  page.drawText('Total Qty (kg)', { x: 540 - totalHeaderW, y: y, size: 8, font: boldFont, color: rgb(1, 1, 1) });

  y -= 16;

  const allocations = record.yarn_allocations || [];
  let grandTotal = 0;

  for (let i = 0; i < allocations.length; i++) {
    const a = allocations[i];
    const ord = ordersMap.get(a.orderId);
    const orderNo = ord?.order_number || a.orderNo || a.orderNumber || '-';
    const countVal = formatYarnName(a.countId, a.yarnLabel);
    const typeStr = (a.type || 'Dyeing').charAt(0).toUpperCase() + (a.type || 'Dyeing').slice(1);
    const colourStr = a.colour || 'N/A';
    const baseKg = parseFloat(a.base_kg || 0).toFixed(2);
    const excessPct = `${a.excess_pct || 0}%`;
    const totalKg = parseFloat(a.total_kg || 0).toFixed(2);
    grandTotal += parseFloat(a.total_kg || 0);

    if (i % 2 === 0) {
      page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 14, color: rgb(0.98, 0.98, 0.98) });
    }

    page.drawText(orderNo, { x: 55, y, size: 7.5, font: boldFont });
    page.drawText(typeStr, { x: 140, y, size: 7.5, font });
    
    // Yarn count truncated if too long
    let countShort = countVal;
    if (countShort.length > 24) countShort = countShort.substring(0, 22) + '...';
    page.drawText(countShort, { x: 190, y, size: 7.5, font });
    page.drawText(colourStr, { x: 330, y, size: 7.5, font });

    const wBase = font.widthOfTextAtSize(baseKg, 7.5);
    page.drawText(baseKg, { x: 435 - wBase, y, size: 7.5, font });

    const wExcess = font.widthOfTextAtSize(excessPct, 7.5);
    page.drawText(excessPct, { x: 480 - wExcess, y, size: 7.5, font });

    const wTotal = boldFont.widthOfTextAtSize(totalKg, 7.5);
    page.drawText(totalKg, { x: 540 - wTotal, y, size: 7.5, font: boldFont });

    page.drawLine({ start: { x: 50, y: y - 4 }, end: { x: 545, y: y - 4 }, thickness: 0.5, color: gridColor });
    y -= 14;
  }

  // Grand Total Row
  page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 16, color: rgb(0.95, 0.95, 0.95) });
  page.drawLine({ start: { x: 50, y: y + 12 }, end: { x: 545, y: y + 12 }, thickness: 1.5, color: primaryColor });
  page.drawText('GRAND TOTAL:', { x: 330, y, size: 8, font: boldFont, color: textColor });

  const grandTotalStr = `${grandTotal.toFixed(2)} kg`;
  const grandTotalW = boldFont.widthOfTextAtSize(grandTotalStr, 8.5);
  page.drawText(grandTotalStr, { x: 540 - grandTotalW, y, size: 8.5, font: boldFont, color: primaryColor });

  y -= 25;

  // 5. Count & Colour Wise Summary AND Count Wise Summary (Side by Side)
  if (record.summary && record.summary.length > 0) {
    const summaryStartY = y;

    // LEFT: Count & Colour Wise Summary (Width: 260)
    page.drawText('COUNT & COLOUR WISE SUMMARY', { x: 50, y: summaryStartY, size: 8, font: boldFont, color: primaryColor });
    let leftY = summaryStartY - 12;

    page.drawRectangle({ x: 50, y: leftY - 4, width: 250, height: 14, color: primaryColor });
    page.drawText('Yarn Count', { x: 55, y: leftY, size: 7, font: boldFont, color: rgb(1, 1, 1) });
    page.drawText('Colour', { x: 165, y: leftY, size: 7, font: boldFont, color: rgb(1, 1, 1) });
    const leftHeaderTotalW = boldFont.widthOfTextAtSize('Total (kg)', 7);
    page.drawText('Total (kg)', { x: 295 - leftHeaderTotalW, y: leftY, size: 7, font: boldFont, color: rgb(1, 1, 1) });

    leftY -= 14;
    for (let i = 0; i < record.summary.length; i++) {
      const s = record.summary[i];
      const countLabel = formatYarnName(s.countId, s.yarnLabel);
      let shortLabel = countLabel;
      if (shortLabel.length > 18) shortLabel = shortLabel.substring(0, 16) + '..';

      if (i % 2 === 0) {
        page.drawRectangle({ x: 50, y: leftY - 4, width: 250, height: 12, color: rgb(0.98, 0.98, 0.98) });
      }

      page.drawText(shortLabel, { x: 55, y: leftY, size: 7, font });
      page.drawText(s.colour || '-', { x: 165, y: leftY, size: 7, font });

      const valStr = parseFloat(s.total_kg || 0).toFixed(2);
      const valW = boldFont.widthOfTextAtSize(valStr, 7);
      page.drawText(valStr, { x: 295 - valW, y: leftY, size: 7, font: boldFont });

      page.drawLine({ start: { x: 50, y: leftY - 4 }, end: { x: 300, y: leftY - 4 }, thickness: 0.5, color: gridColor });
      leftY -= 12;
    }

    // Left Total Row
    page.drawRectangle({ x: 50, y: leftY - 4, width: 250, height: 14, color: rgb(0.95, 0.95, 0.95) });
    page.drawText('Total:', { x: 165, y: leftY, size: 7, font: boldFont, color: textColor });
    const leftTotalValStr = record.summary.reduce((acc, r) => acc + parseFloat(r.total_kg || 0), 0).toFixed(2);
    const leftTotalValW = boldFont.widthOfTextAtSize(leftTotalValStr, 7);
    page.drawText(leftTotalValStr, { x: 295 - leftTotalValW, y: leftY, size: 7, font: boldFont, color: primaryColor });
    leftY -= 16;

    // RIGHT: Count Wise Summary (Width: 220)
    page.drawText('COUNT WISE SUMMARY', { x: 320, y: summaryStartY, size: 8, font: boldFont, color: primaryColor });
    let rightY = summaryStartY - 12;

    page.drawRectangle({ x: 320, y: rightY - 4, width: 225, height: 14, color: primaryColor });
    page.drawText('Yarn Count', { x: 325, y: rightY, size: 7, font: boldFont, color: rgb(1, 1, 1) });
    const rightHeaderTotalW = boldFont.widthOfTextAtSize('Total (kg)', 7);
    page.drawText('Total (kg)', { x: 540 - rightHeaderTotalW, y: rightY, size: 7, font: boldFont, color: rgb(1, 1, 1) });

    rightY -= 14;

    // Aggregate count summary
    const countMap = {};
    record.summary.forEach(s => {
      const label = formatYarnName(s.countId, s.yarnLabel);
      if (!countMap[label]) countMap[label] = 0;
      countMap[label] += parseFloat(s.total_kg || 0);
    });
    const countSummary = Object.entries(countMap).map(([label, total_kg]) => ({ label, total_kg }));

    for (let i = 0; i < countSummary.length; i++) {
      const c = countSummary[i];
      let shortLabel = c.label;
      if (shortLabel.length > 24) shortLabel = shortLabel.substring(0, 22) + '..';

      if (i % 2 === 0) {
        page.drawRectangle({ x: 320, y: rightY - 4, width: 225, height: 12, color: rgb(0.98, 0.98, 0.98) });
      }

      page.drawText(shortLabel, { x: 325, y: rightY, size: 7, font: boldFont });

      const valStr = c.total_kg.toFixed(2);
      const valW = boldFont.widthOfTextAtSize(valStr, 7);
      page.drawText(valStr, { x: 540 - valW, y: rightY, size: 7, font: boldFont });

      page.drawLine({ start: { x: 320, y: rightY - 4 }, end: { x: 545, y: rightY - 4 }, thickness: 0.5, color: gridColor });
      rightY -= 12;
    }

    // Right Grand Total Row
    page.drawRectangle({ x: 320, y: rightY - 4, width: 225, height: 14, color: rgb(0.95, 0.95, 0.95) });
    page.drawText('Grand Total:', { x: 325, y: rightY, size: 7, font: boldFont, color: textColor });
    const rightGrandValStr = countSummary.reduce((acc, c) => acc + c.total_kg, 0).toFixed(2);
    const rightGrandValW = boldFont.widthOfTextAtSize(rightGrandValStr, 7);
    page.drawText(rightGrandValStr, { x: 540 - rightGrandValW, y: rightY, size: 7, font: boldFont, color: primaryColor });
    rightY -= 16;

    y = Math.min(leftY, rightY) - 5;
  }

  // 6. Approval Status Banner
  page.drawRectangle({
    x: 50,
    y: y - 36,
    width: 495,
    height: 36,
    color: rgb(254 / 255, 243 / 255, 199 / 255),
    borderColor: rgb(252 / 255, 211 / 255, 75 / 255),
    borderWidth: 1,
  });
  page.drawText('APPROVAL PENDING', { x: 65, y: y - 16, size: 8.5, font: boldFont, color: rgb(146 / 255, 64 / 255, 14 / 255) });
  page.drawText('This Dyeing Order Form has been submitted and is awaiting approval from the Managing Partner.', { x: 65, y: y - 28, size: 7, font, color: rgb(120 / 255, 53 / 255, 15 / 255) });

  y -= 50;
  if (y < 70) y = 70;

  // 7. Signature Block
  // Left: Prepared By
  page.drawLine({ start: { x: 70, y }, end: { x: 210, y }, thickness: 0.75, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(creatorName || 'Madhanraj', { x: 70, y: y - 12, size: 8, font: boldFont, color: textColor });
  page.drawText('Prepared By', { x: 70, y: y - 22, size: 7, font, color: mutedTextColor });

  // Right: Managing Partner
  page.drawLine({ start: { x: 385, y }, end: { x: 525, y }, thickness: 0.75, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('VIJAYAKUMAR', { x: 385, y: y - 12, size: 8, font: boldFont, color: textColor });
  page.drawText('Managing Partner', { x: 385, y: y - 22, size: 7, font, color: mutedTextColor });
  page.drawText('Approval Signature / Date', { x: 385, y: y - 30, size: 6.5, font, color: mutedTextColor });

  return await pdfDoc.save();
}
