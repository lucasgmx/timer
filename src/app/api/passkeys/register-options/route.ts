import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";
import { getPasskeyConfig } from "@/lib/passkeys/config";
import { storeChallenge } from "@/lib/passkeys/challenges";
import { getUserPasskeys } from "@/lib/passkeys/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const { rpID, rpName } = getPasskeyConfig();

    const existingPasskeys = await getUserPasskeys(user.uid);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.username,
      userID: new TextEncoder().encode(user.uid),
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred"
      },
      excludeCredentials: existingPasskeys.map((p) => ({
        id: p.credentialID,
        transports: p.transports
      }))
    });

    const challengeId = await storeChallenge(options.challenge, "registration", user.uid);

    return Response.json({ options, challengeId });
  } catch (error) {
    return jsonError(error);
  }
}
