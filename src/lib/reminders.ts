// Phone normalization and reminder templates for DukaanAI
// Rule: Pure Roman Hinglish, no Devanagari characters, no AI calls.

import { STRINGS } from "./strings";

/**
 * Normalizes an Indian phone number string to 12 digits with country code 91.
 * Supports:
 * - 10 digits: "9876543210" -> "919876543210"
 * - Leading zero: "09876543210" -> "919876543210"
 * - Full with country code: "+91 98765 43210" -> "919876543210"
 * - With punctuation/spaces: "+91-98765-43210" -> "919876543210"
 * Returns null if the number is invalid or cannot be parsed into a 10-digit Indian mobile.
 */
export function normalizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Keep only digits
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Exactly 10 digits (standard Indian mobile format without country code)
  if (digits.length === 10) {
    // Standard Indian mobile starts with 6, 7, 8, or 9
    return `91${digits}`;
  }

  // 11 digits starting with 0 (e.g. 09876543210)
  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }

  // 12 digits starting with 91 (e.g. 919876543210)
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  // 13 or 14 digits starting with 0091 or similar international prefix
  if (digits.startsWith("0091") && digits.length === 14) {
    return digits.slice(2);
  }

  // If longer than 10 digits, check if the last 10 digits form a plausible mobile number
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      return `91${last10}`;
    }
  }

  return null;
}

export interface ReminderParams {
  customerName: string;
  udharAmount: number;
  shopName?: string | null;
}

/**
 * Builds a polite Hinglish payment reminder message from a strict template.
 * E.g.: "Namaste Ramesh ji, aapka Rs 300 udhar baaki hai. Please jaldi bhej dijiye. - Sharma Kirana Store"
 * No AI is used; deterministic and instant.
 */
export function buildReminderMessage({
  customerName,
  udharAmount,
  shopName,
}: ReminderParams): string {
  const cleanName = (customerName || "Customer").trim();
  // Prevent duplicate "ji ji" if customer name already includes honorific
  const nameWithHonorific = /\bji\b/i.test(cleanName)
    ? cleanName
    : `${cleanName} ji`;

  const amountNumber = Math.max(0, Math.round(Number(udharAmount) || 0));
  const formattedAmount = amountNumber.toLocaleString("en-IN");
  const cleanShopName = (shopName || "").trim() || "Kirana Store";

  return `${STRINGS.reminders.templateSalutation} ${nameWithHonorific}, ${STRINGS.reminders.templateBody} ${formattedAmount} ${STRINGS.reminders.templateDue} ${STRINGS.reminders.templateSignoff} ${cleanShopName}`;
}

/**
 * Builds a wa.me WhatsApp direct link with pre-filled reminder text.
 * Returns null if the phone number is missing or invalid.
 */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string
): string | null {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
