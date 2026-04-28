import { jsonError } from "@/lib/firebase/auth";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const apiKey = process.env.RECAPTCHA_API_KEY;
    const projectId = process.env.RECAPTCHA_PROJECT_ID;
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    if (!apiKey || !projectId || !siteKey) {
      return jsonError(new Error("reCAPTCHA is not configured on this server."));
    }

    const body = await request.json();
    const { token } = bodySchema.parse(body);

    const assessmentRes = await fetch(
      `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: { token, siteKey, expectedAction: "login" },
        }),
      }
    );

    if (!assessmentRes.ok) {
      throw new Response("reCAPTCHA assessment request failed.", { status: 502 });
    }

    const result = await assessmentRes.json() as {
      tokenProperties?: { valid: boolean; action?: string };
      riskAnalysis?: { score: number };
    };

    const valid = result.tokenProperties?.valid === true;
    const score = result.riskAnalysis?.score ?? 0;

    if (!valid || score < 0.5) {
      throw new Response("reCAPTCHA verification failed.", { status: 403 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
