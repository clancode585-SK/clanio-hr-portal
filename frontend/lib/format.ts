/** Backend se aane wali date/time ko table me dikhane layak banata hai */

/** "2026-09-21 09:00:00" ya ISO → "09:00" */
export function clockOf(value: unknown): string | undefined {
  if (!value) return undefined;

  const text = String(value);
  const match = /[T ](\d{2}:\d{2})/.exec(text);

  if (match) return match[1];

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime())
    ? undefined
    : parsed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** ISO ya "2026-09-21" → "21 Sep 2026" */
export function dateOf(value: unknown, fallback = "-"): string {
  if (!value) return fallback;

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
