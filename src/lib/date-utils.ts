/**
 * Date and time utilities for DukaanAI.
 * All "Today" calculations in DukaanAI strictly follow the Asia/Kolkata (IST = UTC+5:30) time zone.
 */

export interface IstDayRange {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  istDateString: string; // YYYY-MM-DD in IST
}

/**
 * Returns the exact start and end UTC timestamps for the current day in Asia/Kolkata (IST).
 * IST is UTC+05:30 (+330 minutes) with no daylight saving time.
 * Midnight IST = 00:00:00 IST = 18:30:00.000 UTC of previous UTC day.
 * End of day IST = 23:59:59.999 IST = 18:29:59.999 UTC of current UTC day.
 *
 * @param referenceDate Optional reference date (defaults to current time)
 */
export function getIstDayRange(referenceDate: Date = new Date()): IstDayRange {
  // Format reference date into parts using Asia/Kolkata timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(referenceDate);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  // IST offset is fixed at +5 hours 30 minutes (+19,800,000 ms)
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

  // Start of day in IST is 00:00:00.000 IST
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS;
  const start = new Date(startUtcMs);

  // End of day in IST is 23:59:59.999 IST
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000 - 1;
  const end = new Date(endUtcMs);

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const istDateString = `${year}-${mm}-${dd}`;

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    istDateString,
  };
}

/**
 * Checks whether a given date or ISO string falls within today's day range in Asia/Kolkata.
 */
export function isTodayInIst(dateInput: Date | string, referenceDate?: Date): boolean {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const { start, end } = getIstDayRange(referenceDate);
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}
