import "server-only";

export function getPasskeyConfig() {
  const isDev = process.env.NODE_ENV === "development";
  const rpID =
    process.env.PASSKEY_RP_ID ??
    process.env.NEXT_PUBLIC_PASSKEY_RP_ID ??
    (isDev ? "localhost" : "timer.marques.llc");

  const origin =
    process.env.PASSKEY_ORIGIN ??
    process.env.NEXT_PUBLIC_PASSKEY_ORIGIN ??
    (rpID === "localhost" ? "http://localhost:6001" : `https://${rpID}`);

  return { rpID, origin, rpName: "Timer" };
}
