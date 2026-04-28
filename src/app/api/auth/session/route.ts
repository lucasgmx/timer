import { getAuthenticatedUser, jsonError } from "@/lib/firebase/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    return Response.json(user);
  } catch (error) {
    return jsonError(error);
  }
}
