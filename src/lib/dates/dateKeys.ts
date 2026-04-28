const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getAppTimeZone() {
  return process.env.TIMER_TIME_ZONE ?? "UTC";
}

export function dateToDateKey(date: Date, timeZone = getAppTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
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

export function todayDateKey() {
  return dateToDateKey(new Date());
}

export function addDays(dateKey: string, days: number) {
  assertDateKey(dateKey);
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function compareDateKeys(left: string, right: string) {
  assertDateKey(left);
  assertDateKey(right);
  return left.localeCompare(right);
}

export function dateKeyToDate(dateKey: string) {
  assertDateKey(dateKey);
  return new Date(`${dateKey}T00:00:00.000Z`);
}
