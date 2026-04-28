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

export function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(cents / 100);
}
