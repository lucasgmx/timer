import { jsonError } from "@/lib/firebase/auth";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      return jsonError(new Error("reCAPTCHA is not configured on this server."));
    }

    const body = await request.json();
    const { token } = bodySchema.parse(body);

    const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });

    const result = await verifyRes.json() as {
      success: boolean;
      score?: number;
      action?: string;
      "error-codes"?: string[];
    };

    if (!result.success || (result.score !== undefined && result.score < 0.5)) {
      throw new Response("reCAPTCHA verification failed.", { status: 403 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
