/**
 * Pure reorder helpers for low-stock supplier messages.
 * Template only, Roman-script Hinglish only, zero AI calls.
 */

export interface ReorderItemInput {
  name: string;
  stock_qty: number;
  reorder_level: number;
  unit: string;
}

/**
 * Calculates suggested reorder quantity according to the business rule:
 * suggested_qty = max(reorder_level * 2 - stock, reorder_level)
 */
export function calculateSuggestedReorderQty(
  stock: number,
  reorderLevel: number
): number {
  const current = Number(stock || 0);
  const reorder = Number(reorderLevel || 5);
  return Math.max(reorder * 2 - current, reorder);
}

/**
 * Formats low-stock items into an editable Roman-Hinglish supplier message.
 */
export function buildSupplierReorderMessage(
  shopName: string,
  items: Array<{
    name: string;
    currentStock: number;
    suggestedQty: number;
    unit: string;
  }>
): string {
  const effectiveShop = (shopName || "").trim() || "Dukaan";
  const lines = items.map((it) => {
    return `- ${it.name}: ${it.suggestedQty} ${it.unit} (Abhi stock: ${it.currentStock} ${it.unit})`;
  });

  return [
    `Namaste ji, ${effectiveShop} ke liye naya stock order bhejna hai:`,
    "",
    ...lines,
    "",
    "Kripya ye delivery jaldi bhej dijiye. DukaanAI",
  ].join("\n");
}

/**
 * Generates a wa.me link for WhatsApp order dispatch.
 * If phone is omitted or empty, returns https://wa.me/?text=[encoded]
 */
export function buildWhatsAppReorderLink(
  phone: string | null | undefined,
  message: string
): string {
  const encodedText = encodeURIComponent(message || "");
  const cleanPhone = (phone || "").replace(/[^\d]/g, "");

  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }

  return `https://wa.me/?text=${encodedText}`;
}
