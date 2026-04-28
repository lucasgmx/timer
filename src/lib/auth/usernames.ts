const DEFAULT_USERNAME_EMAIL_DOMAIN = "timer.local";
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,30}[a-z0-9])?$/;

function configuredDomain() {
  const env: Record<string, string | undefined> =
    typeof process === "undefined" ? {} : process.env;

  return (
    env.NEXT_PUBLIC_TIMER_USERNAME_EMAIL_DOMAIN ??
    env.TIMER_USERNAME_EMAIL_DOMAIN ??
    DEFAULT_USERNAME_EMAIL_DOMAIN
  )
    .trim()
    .toLowerCase();
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function assertValidUsername(value: string) {
  const username = normalizeUsername(value);

  if (!USERNAME_PATTERN.test(username)) {
    throw new Error(
      "Usernames must be 1-32 characters and use only letters, numbers, underscores, or hyphens."
    );
  }

  return username;
}

export function usernameToAuthEmail(
  value: string,
  domain = configuredDomain()
) {
  return `${assertValidUsername(value)}@${domain}`;
}

export function authEmailToUsername(
  value: string | null | undefined,
  domain = configuredDomain()
) {
  const email = value?.trim().toLowerCase();

  if (!email) {
    return null;
  }

  const suffix = `@${domain}`;

  if (!email.endsWith(suffix)) {
    return null;
  }

  const username = email.slice(0, -suffix.length);
  return USERNAME_PATTERN.test(username) ? username : null;
}

export function parseUsernameList(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map(normalizeUsername)
      .filter(Boolean)
      .map(assertValidUsername)
  );
}
