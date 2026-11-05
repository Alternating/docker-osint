import { getApiKey } from "@/lib/settings";

const UA = "Suron-OSINT/0.1 (self-hosted)";

export interface TwilioResult {
  valid: boolean;
  nationalFormat: string | null;
  lineType: string | null; // mobile / landline / voip, from line_type_intelligence
  carrier: string | null; // carrier/provider name
  callerName: string | null; // CNAM caller name (US only, may be null)
}

export async function twilioLookup(e164: string): Promise<TwilioResult | null> {
  // Returns null when no key configured. Throws on auth/other error.
  // NOTE: the requested Fields are PAID Twilio add-ons (~$0.008/lookup) — only
  // called when a key is set.
  const key = getApiKey("twilio");
  if (!key) return null;

  const idx = key.indexOf(":");
  if (idx < 1 || idx === key.length - 1) {
    throw new Error("Twilio credential must be in the form AccountSID:AuthToken");
  }
  const sid = key.slice(0, idx);
  const token = key.slice(idx + 1);
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(
    e164
  )}?Fields=line_type_intelligence,caller_name`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, "user-agent": UA },
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 401) throw new Error("Twilio rejected the credentials");
  // 404 = number not found; return a not-valid result rather than throwing.
  if (res.status === 404) {
    return {
      valid: false,
      nationalFormat: null,
      lineType: null,
      carrier: null,
      callerName: null,
    };
  }
  if (!res.ok) throw new Error(`Twilio responded ${res.status}`);

  const data = (await res.json()) as {
    valid?: boolean;
    national_format?: string;
    line_type_intelligence?: { type?: string; carrier_name?: string } | null;
    caller_name?: { caller_name?: string } | null;
  };

  return {
    valid: Boolean(data.valid),
    nationalFormat: data.national_format ?? null,
    lineType: data.line_type_intelligence?.type ?? null,
    carrier: data.line_type_intelligence?.carrier_name ?? null,
    callerName: data.caller_name?.caller_name ?? null,
  };
}
