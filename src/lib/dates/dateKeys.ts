const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_TIME_ZONE = "UTC";

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function getUserTimeZone() {
  if (typeof window === "undefined") {
    return FALLBACK_TIME_ZONE;
  }

  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timeZone && isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
}

function resolveTimeZone(timeZone?: string | null) {
  const trimmed = timeZone?.trim();
  return trimmed && isValidTimeZone(trimmed) ? trimmed : getUserTimeZone();
}

function dateKeyParts(dateKey: string) {
  assertDateKey(dateKey);
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.get("year")),
    Number(values.get("month")) - 1,
    Number(values.get("day")),
    Number(values.get("hour")),
    Number(values.get("minute")),
    Number(values.get("second"))
  );

  return localAsUtc - date.getTime();
}

export function dateToDateKey(date: Date, timeZone = getUserTimeZone()) {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format date key.");
  }

  return `${year}-${month}-${day}`;
}

export function isDateKey(value: string) {
  return DATE_KEY_PATTERN.test(value);
}

export function assertDateKey(value: string) {
  if (!isDateKey(value)) {
    throw new Error(`Invalid date key: ${value}`);
  }

  return value;
}

export function todayDateKey(timeZone = getUserTimeZone()) {
  return dateToDateKey(new Date(), timeZone);
}

export function addDays(dateKey: string, days: number) {
  const { year, month, day } = dateKeyParts(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function compareDateKeys(left: string, right: string) {
  assertDateKey(left);
  assertDateKey(right);
  return left.localeCompare(right);
}

export function dateKeyToDate(dateKey: string, timeZone = getUserTimeZone()) {
  const { year, month, day } = dateKeyParts(dateKey);
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let utcMillis = localMidnightAsUtc;

  for (let i = 0; i < 4; i += 1) {
    const nextUtcMillis =
      localMidnightAsUtc - getTimeZoneOffsetMs(new Date(utcMillis), resolvedTimeZone);

    if (Math.abs(nextUtcMillis - utcMillis) < 1) {
      return new Date(nextUtcMillis);
    }

    utcMillis = nextUtcMillis;
  }

  return new Date(utcMillis);
}
