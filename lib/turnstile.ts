const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify a Cloudflare Turnstile token.
 *
 * Fails closed: a missing secret, a network error, or a rejected token all
 * return false. Earlier copies of this returned true when the secret was
 * unset, which silently disabled bot protection on a misconfigured deploy.
 *
 * @param label Route name, for log lines.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  label: string,
): Promise<boolean> {
  if (!token) return false;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error(`TURNSTILE_SECRET_KEY is missing (${label})`);
    return false;
  }

  try {
    const body = new URLSearchParams();
    body.append("secret", secret);
    body.append("response", token);

    const res = await fetch(SITEVERIFY_URL, { method: "POST", body });
    const data = await res.json();

    if (data.success !== true) {
      console.error(`Turnstile verification failed (${label}):`, data["error-codes"]);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Turnstile fetch error (${label}):`, error);
    return false;
  }
}
