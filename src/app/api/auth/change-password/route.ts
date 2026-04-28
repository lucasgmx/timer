import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  newPassword: z.string().min(8).max(128)
});

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const body: unknown = await request.json();
    const { newPassword } = schema.parse(body);
    await adminAuth().updateUser(user.uid, { password: newPassword });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
