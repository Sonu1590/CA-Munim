import "@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SendRequest = {
  phoneNumbers?: unknown;
  templateName?: unknown;
  languageCode?: unknown;
};

type SendResult = {
  phone: string;
  success: boolean;
  messageId?: string;
  error?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") ?? "v23.0";

  if (!accessToken || !phoneNumberId) {
    return json({
      error: "WhatsApp is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Edge Function secrets.",
    }, 500);
  }

  let body: SendRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const phoneNumbers = Array.isArray(body.phoneNumbers)
    ? body.phoneNumbers.filter((phone): phone is string => typeof phone === "string")
    : [];
  const templateName = typeof body.templateName === "string" ? body.templateName.trim() : "";
  const languageCode = typeof body.languageCode === "string" ? body.languageCode : "en_US";

  if (phoneNumbers.length === 0 || !templateName) {
    return json({ error: "phoneNumbers and templateName are required." }, 400);
  }

  const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const results: SendResult[] = await Promise.all(phoneNumbers.map(async (originalPhone) => {
    const phone = normalizePhone(originalPhone);
    if (phone.length < 10) {
      return { phone: originalPhone, success: false, error: "Invalid phone number" };
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          phone: originalPhone,
          success: false,
          error: payload?.error?.message ?? `Meta API returned HTTP ${response.status}`,
        };
      }

      return {
        phone: originalPhone,
        success: true,
        messageId: payload?.messages?.[0]?.id,
      };
    } catch (error) {
      return {
        phone: originalPhone,
        success: false,
        error: error instanceof Error ? error.message : "Unable to reach Meta API",
      };
    }
  }));

  return json({
    success: results.every((result) => result.success),
    results,
  });
});
