// Invoice math calculation and GST-style PDF generation using pdf-lib
// Rule: Standard Helvetica font only, ASCII-safe Roman text, zero Devanagari.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { STRINGS } from "./strings";

export interface InvoiceLineItem {
  name: string;
  qty: number;
  unit?: string;
  unit_price: number;
  total?: number;
}

export interface InvoiceMathResult {
  lineItemsSubtotal: number;
  totalAmount: number;
  paidAmount: number;
  udharAmount: number;
  isFullyPaid: boolean;
}

/**
 * Pure calculation for invoice totals, paid amount and pending udhar.
 */
export function calculateInvoiceMath(params: {
  items?: Array<{ qty: number; unit_price: number }>;
  total?: number;
  paid?: number;
}): InvoiceMathResult {
  const lineItemsSubtotal = (params.items || []).reduce(
    (sum, item) => sum + (Number(item.qty || 0) * Number(item.unit_price || 0)),
    0
  );

  const totalAmount =
    params.total !== undefined && params.total !== null
      ? Math.max(0, Number(params.total))
      : Math.max(0, lineItemsSubtotal);

  const paidAmount = Math.max(0, Math.min(totalAmount, Number(params.paid || 0)));
  const udharAmount = Math.max(0, totalAmount - paidAmount);
  const isFullyPaid = udharAmount === 0;

  return {
    lineItemsSubtotal,
    totalAmount,
    paidAmount,
    udharAmount,
    isFullyPaid,
  };
}

/**
 * Standard invoice number formatter from UUID.
 */
export function formatInvoiceNumber(transactionId: string): string {
  const clean = (transactionId || "").replace(/-/g, "");
  return `INV-${clean.slice(0, 8).toUpperCase()}`;
}

/**
 * Sanitizes input text to WinAnsi/ASCII printable range for standard Helvetica fonts.
 * Replaces Rupee symbol '₹' with 'Rs. ' and removes non-ASCII characters.
 */
export function sanitizePdfText(text: string | null | undefined, fallback = "N/A"): string {
  if (!text) return fallback;
  let clean = text.replace(/₹/g, "Rs. ");
  clean = clean.replace(/[^\x20-\x7E]/g, "").replace(/^[\s/|-]+/, "").trim();
  return clean || fallback;
}

export interface InvoiceData {
  transactionId: string;
  dateIst: string;
  shopName: string;
  shopGstin?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  rawInput?: string | null;
  items?: InvoiceLineItem[];
  totalAmount: number;
  paidAmount: number;
}

/**
 * Generates a clean, professional GST-style Tax Invoice PDF using pdf-lib and Helvetica.
 */
export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Palette
  const dark = rgb(0.09, 0.09, 0.11);
  const muted = rgb(0.45, 0.45, 0.50);
  const primary = rgb(0.43, 0.16, 0.88); // Violet theme
  const borderCol = rgb(0.85, 0.85, 0.88);
  const bgShade = rgb(0.96, 0.96, 0.98);
  const amber = rgb(0.80, 0.45, 0.05);
  const green = rgb(0.10, 0.60, 0.30);

  const margin = 40;
  const contentWidth = width - margin * 2;
  let currentY = height - 40;

  // 1. Top Decorative Bar
  page.drawRectangle({
    x: margin,
    y: currentY - 4,
    width: contentWidth,
    height: 4,
    color: primary,
  });
  currentY -= 20;

  // 2. Header: Title & Invoice Meta
  const invoiceNum = formatInvoiceNumber(data.transactionId);
  page.drawText(STRINGS.invoice.taxInvoice, {
    x: margin,
    y: currentY,
    size: 16,
    font: fontBold,
    color: dark,
  });

  const rightMetaX = margin + contentWidth - 170;
  page.drawText(`${STRINGS.invoice.invoiceNumber}: ${invoiceNum}`, {
    x: rightMetaX,
    y: currentY,
    size: 10,
    font: fontBold,
    color: primary,
  });
  currentY -= 14;

  page.drawText(`${STRINGS.invoice.date}: ${sanitizePdfText(data.dateIst)}`, {
    x: rightMetaX,
    y: currentY,
    size: 9,
    font: fontRegular,
    color: muted,
  });

  // Shop details under title
  currentY -= 6;
  const safeShopName = sanitizePdfText(data.shopName, "Dukaan Store");
  page.drawText(safeShopName, {
    x: margin,
    y: currentY,
    size: 13,
    font: fontBold,
    color: dark,
  });
  currentY -= 14;

  const gstinText = data.shopGstin
    ? `GSTIN: ${sanitizePdfText(data.shopGstin)}`
    : `GSTIN: ${STRINGS.invoice.notRegistered}`;
  page.drawText(gstinText, {
    x: margin,
    y: currentY,
    size: 9,
    font: fontRegular,
    color: muted,
  });
  currentY -= 20;

  // 3. Divider
  page.drawLine({
    start: { x: margin, y: currentY },
    end: { x: margin + contentWidth, y: currentY },
    thickness: 1,
    color: borderCol,
  });
  currentY -= 16;

  // 4. Billed To (Customer Details Box)
  page.drawRectangle({
    x: margin,
    y: currentY - 44,
    width: contentWidth,
    height: 44,
    color: bgShade,
    borderColor: borderCol,
    borderWidth: 1,
  });

  page.drawText(STRINGS.invoice.billTo.toUpperCase(), {
    x: margin + 12,
    y: currentY - 14,
    size: 8,
    font: fontBold,
    color: muted,
  });

  const safeCustomerName = sanitizePdfText(data.customerName, STRINGS.invoice.walkInCustomer);
  page.drawText(safeCustomerName, {
    x: margin + 12,
    y: currentY - 28,
    size: 11,
    font: fontBold,
    color: dark,
  });

  const phoneStr = data.customerPhone ? sanitizePdfText(data.customerPhone) : "N/A";
  page.drawText(`Phone: ${phoneStr}`, {
    x: margin + 12,
    y: currentY - 39,
    size: 8,
    font: fontRegular,
    color: muted,
  });

  currentY -= 60;

  // 5. Items Table Header
  const colX = {
    sno: margin + 8,
    desc: margin + 40,
    qty: margin + 300,
    rate: margin + 370,
    total: margin + 440,
  };

  const tableHeaderHeight = 22;
  page.drawRectangle({
    x: margin,
    y: currentY - tableHeaderHeight,
    width: contentWidth,
    height: tableHeaderHeight,
    color: primary,
  });

  const headerY = currentY - 15;
  page.drawText(STRINGS.invoice.serialNo, { x: colX.sno, y: headerY, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(STRINGS.invoice.itemDescription, { x: colX.desc, y: headerY, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(STRINGS.invoice.qty, { x: colX.qty, y: headerY, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(STRINGS.invoice.unitRate, { x: colX.rate, y: headerY, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(STRINGS.invoice.amount, { x: colX.total, y: headerY, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  currentY -= tableHeaderHeight;

  // 6. Items Rows
  const items = data.items && data.items.length > 0
    ? data.items
    : [
        {
          name: STRINGS.invoice.generalGrocery,
          qty: 1,
          unit: "item",
          unit_price: data.totalAmount,
          total: data.totalAmount,
        },
      ];

  const rowHeight = 22;
  items.forEach((item, index) => {
    const isAlt = index % 2 === 1;
    if (isAlt) {
      page.drawRectangle({
        x: margin,
        y: currentY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: bgShade,
      });
    }

    // Border line bottom
    page.drawLine({
      start: { x: margin, y: currentY - rowHeight },
      end: { x: margin + contentWidth, y: currentY - rowHeight },
      thickness: 0.5,
      color: borderCol,
    });

    const itemY = currentY - 15;
    const itemTotal = item.total !== undefined ? item.total : item.qty * item.unit_price;

    page.drawText(String(index + 1), { x: colX.sno, y: itemY, size: 9, font: fontRegular, color: dark });
    page.drawText(sanitizePdfText(item.name).slice(0, 38), { x: colX.desc, y: itemY, size: 9, font: fontBold, color: dark });
    page.drawText(`${item.qty} ${sanitizePdfText(item.unit || "unit")}`.slice(0, 12), { x: colX.qty, y: itemY, size: 9, font: fontRegular, color: dark });
    page.drawText(`Rs. ${Number(item.unit_price).toLocaleString("en-IN")}`, { x: colX.rate, y: itemY, size: 9, font: fontRegular, color: dark });
    page.drawText(`Rs. ${Number(itemTotal).toLocaleString("en-IN")}`, { x: colX.total, y: itemY, size: 9, font: fontBold, color: dark });

    currentY -= rowHeight;
  });

  currentY -= 20;

  // 7. Math & Summary Box
  const math = calculateInvoiceMath({
    items,
    total: data.totalAmount,
    paid: data.paidAmount,
  });

  const summaryBoxWidth = 240;
  const summaryBoxX = margin + contentWidth - summaryBoxWidth;
  const summaryBoxHeight = 85;

  page.drawRectangle({
    x: summaryBoxX,
    y: currentY - summaryBoxHeight,
    width: summaryBoxWidth,
    height: summaryBoxHeight,
    color: bgShade,
    borderColor: borderCol,
    borderWidth: 1,
  });

  let sumY = currentY - 18;
  const sumLabelX = summaryBoxX + 12;
  const sumValX = summaryBoxX + summaryBoxWidth - 80;

  page.drawText(STRINGS.invoice.totalAmount, { x: sumLabelX, y: sumY, size: 9, font: fontBold, color: dark });
  page.drawText(`Rs. ${math.totalAmount.toLocaleString("en-IN")}`, { x: sumValX, y: sumY, size: 9, font: fontBold, color: dark });
  sumY -= 18;

  page.drawText(STRINGS.invoice.paidAmount, { x: sumLabelX, y: sumY, size: 9, font: fontRegular, color: green });
  page.drawText(`Rs. ${math.paidAmount.toLocaleString("en-IN")}`, { x: sumValX, y: sumY, size: 9, font: fontBold, color: green });
  sumY -= 18;

  page.drawText(STRINGS.invoice.udharAmount, { x: sumLabelX, y: sumY, size: 9, font: fontBold, color: math.udharAmount > 0 ? amber : muted });
  page.drawText(`Rs. ${math.udharAmount.toLocaleString("en-IN")}`, { x: sumValX, y: sumY, size: 9, font: fontBold, color: math.udharAmount > 0 ? amber : muted });

  currentY -= summaryBoxHeight + 40;

  // 8. Footer
  page.drawLine({
    start: { x: margin, y: margin + 30 },
    end: { x: margin + contentWidth, y: margin + 30 },
    thickness: 1,
    color: borderCol,
  });

  page.drawText(STRINGS.invoice.footerThankYou, {
    x: margin,
    y: margin + 18,
    size: 8,
    font: fontBold,
    color: primary,
  });

  page.drawText(STRINGS.invoice.footerComputerGenerated, {
    x: margin,
    y: margin + 8,
    size: 7,
    font: fontRegular,
    color: muted,
  });

  return await pdfDoc.save();
}
