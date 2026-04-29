export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function secondsToDecimalHours(totalSeconds: number) {
  return Number((Math.max(0, totalSeconds) / 3600).toFixed(2));
}

export function calculateAmountCents(durationSeconds: number, hourlyRateCents: number) {
  return Math.round((Math.max(0, durationSeconds) * hourlyRateCents) / 3600);
}

export function calculateTotalAmountCents(
  lineItems: Array<{ durationSeconds: number; hourlyRateCents: number }>
): number {
  return lineItems.reduce(
    (sum, item) => sum + calculateAmountCents(item.durationSeconds, item.hourlyRateCents),
    0
  );
}

export function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(cents / 100);
}

export function formatDollarsInput(cents: number) {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export function parseDollarsToCents(value: string) {
  const normalized = value.replace(/[$,\s]/g, "");
  const match = normalized.match(/^(?:(\d+)(?:\.(\d{0,2}))?|\.(\d{1,2}))$/);

  if (!match) return null;

  const dollars = match[1] ?? "0";
  const cents = match[2] ?? match[3] ?? "";
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}
