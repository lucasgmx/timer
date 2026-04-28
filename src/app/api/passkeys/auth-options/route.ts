import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { jsonError } from "@/lib/firebase/auth";
import { usernameToAuthEmail } from "@/lib/auth/usernames";
import { getPasskeyConfig } from "@/lib/passkeys/config";
import { storeChallenge } from "@/lib/passkeys/challenges";
import { getUserPasskeys } from "@/lib/passkeys/store";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  username: z.string().trim().optional()
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const { username } = schema.parse(body);
    const { rpID } = getPasskeyConfig();

    let allowCredentials: { id: string; transports: AuthenticatorTransportFuture[] }[] = [];

    if (username) {
      // Look up user by Firebase Auth email derived from username
      const email = usernameToAuthEmail(username);
      try {
        const { getAuth } = await import("firebase-admin/auth");
        const { getFirebaseAdminApp } = await import("@/lib/firebase/admin");
        const fbUser = await getAuth(getFirebaseAdminApp()).getUserByEmail(email);
        const passkeys = await getUserPasskeys(fbUser.uid);
        allowCredentials = passkeys.map((p) => ({
          id: p.credentialID,
          transports: p.transports as AuthenticatorTransportFuture[]
        }));
        // Store userId in challenge so we can look them up on verify
        const options = await generateAuthenticationOptions({
          rpID,
          allowCredentials,
          userVerification: "preferred"
        });
        const challengeId = await storeChallenge(options.challenge, "authentication", fbUser.uid);
        return Response.json({ options, challengeId });
      } catch {
        // User not found — fall through to discoverable credential flow
      }
    }

    // Discoverable credential (no username or user not found)
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred"
    });
    const challengeId = await storeChallenge(options.challenge, "authentication");
    return Response.json({ options, challengeId });
  } catch (error) {
    return jsonError(error);
  }
}
