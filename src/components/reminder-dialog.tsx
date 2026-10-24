"use client";

import { useState } from "react";
import { MessageSquare, Phone, X, ExternalLink, AlertCircle } from "lucide-react";
import { STRINGS } from "@/lib/strings";
import {
  buildReminderMessage,
  buildWhatsAppUrl,
  normalizePhoneNumber,
} from "@/lib/reminders";

interface ReminderCustomer {
  name: string;
  phone: string | null;
  balance: number;
}

interface ReminderDialogModalProps {
  onClose: () => void;
  customer: ReminderCustomer;
  shopName?: string;
}

function ReminderDialogModal({
  onClose,
  customer,
  shopName,
}: ReminderDialogModalProps) {
  const [message, setMessage] = useState(() =>
    buildReminderMessage({
      customerName: customer.name,
      udharAmount: customer.balance,
      shopName: shopName || "Kirana Store",
    })
  );
  const [phone, setPhone] = useState(() => customer.phone || "");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSend = () => {
    setPhoneError(null);
    const normalized = normalizePhoneNumber(phone);

    if (!normalized) {
      setPhoneError(STRINGS.reminders.invalidPhoneAlert);
      return;
    }

    const waUrl = buildWhatsAppUrl(phone, message);
    if (!waUrl) {
      setPhoneError(STRINGS.reminders.invalidPhoneAlert);
      return;
    }

    // Open WhatsApp pre-filled chat in new window/tab
    window.open(waUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  const isMissingPhone = !customer.phone;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="reminder-modal-title"
                className="text-base sm:text-lg font-bold text-foreground leading-tight"
              >
                {STRINGS.reminders.sendReminderTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {STRINGS.reminders.reminderDescription}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label={STRINGS.common.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          {/* Customer & Amount Summary Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
            <div className="flex flex-col">
              <span className="text-muted-foreground">{STRINGS.reminders.customerLabel}:</span>
              <strong className="text-foreground text-sm font-bold">
                {customer.name}
              </strong>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground">{STRINGS.reminders.pendingUdharLabel}:</span>
              <strong className="text-amber-600 dark:text-amber-400 text-sm font-extrabold tabular-nums">
                Rs. {Number(customer.balance || 0).toLocaleString("en-IN")}
              </strong>
            </div>
          </div>

          {/* Missing Phone Alert */}
          {isMissingPhone && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="leading-relaxed">
                {STRINGS.reminders.missingPhoneAlert}
              </p>
            </div>
          )}

          {/* Phone Number Field */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reminder-phone-input"
              className="text-xs font-semibold text-foreground flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <span>{STRINGS.reminders.phoneLabel}</span>
            </label>
            <input
              id="reminder-phone-input"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError(null);
              }}
              placeholder={STRINGS.reminders.phonePlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none min-h-[48px] font-mono"
            />
            {phoneError && (
              <p className="text-xs text-destructive font-medium">
                {phoneError}
              </p>
            )}
          </div>

          {/* Editable Hinglish Message Textarea */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reminder-message-box"
              className="text-xs font-semibold text-foreground"
            >
              {STRINGS.reminders.messageLabel}
            </label>
            <textarea
              id="reminder-message-box"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-background border border-border text-xs sm:text-sm text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none leading-relaxed min-h-[96px]"
            />
            <span className="text-[11px] text-muted-foreground">
              Editable Hinglish message based on store balance.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-border/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 bg-muted/10">
          <button
            type="button"
            id="btn-cancel-reminder"
            onClick={onClose}
            className="px-4 py-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold transition-colors min-h-[48px] cursor-pointer"
          >
            {STRINGS.common.cancel}
          </button>
          <button
            type="button"
            id="btn-confirm-send-whatsapp"
            onClick={handleSend}
            className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{STRINGS.reminders.sendViaWhatsApp}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ReminderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customer: ReminderCustomer | null;
  shopName?: string;
}

export function ReminderDialog({
  isOpen,
  onClose,
  customer,
  shopName,
}: ReminderDialogProps) {
  if (!isOpen || !customer) return null;

  return (
    <ReminderDialogModal
      key={`${customer.name}-${customer.balance}`}
      onClose={onClose}
      customer={customer}
      shopName={shopName}
    />
  );
}
