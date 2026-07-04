import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// The magic headers that fix the browser block!
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_RECIPIENTS = 200

// Client phone numbers are stored as bare 10-digit Indian mobile numbers
// (e.g. "7507327755"), but Meta's Graph API needs the full E.164-style
// number with country code (e.g. "917507327755") to route the message and
// match it against the sandbox's verified-recipient list. This is applied
// only at the point of calling Meta — the client-ownership lookup above
// matches against the DB's raw (un-prefixed) format and must stay that way.
function toMetaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 ? `91${digits}` : digits
}

serve(async (req) => {
  // 1. Handle CORS Preflight request from the React Browser
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { templateName, languageCode, recipients } = await req.json()

    if (!templateName || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('templateName and at least one recipient are required.')
    }
    if (recipients.length > MAX_RECIPIENTS) {
      throw new Error(`Cannot send to more than ${MAX_RECIPIENTS} recipients in one request.`)
    }

    // Authenticate the caller and scope sends to phone numbers that are
    // actually clients of their own firm. Without this, any authenticated
    // user could call this function directly (bypassing the app's UI) and
    // dispatch WhatsApp templates to arbitrary phone numbers using the
    // firm's Meta credentials — verify_jwt only proves the request carries
    // a valid Supabase session, not that these are the caller's clients.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header.')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated.')

    const requestedPhones = [...new Set(recipients.map((r: { phone: string }) => r.phone))]
    // RLS (clients_all: firm_id = get_my_firm_id()) automatically scopes this
    // to the caller's own firm's clients. Matches against the DB's raw phone
    // format (no country code) — do not normalize requestedPhones here.
    const { data: ownClients, error: clientsError } = await supabase
      .from('clients')
      .select('phone')
      .in('phone', requestedPhones)

    if (clientsError) throw new Error('Unable to verify recipients.')

    const allowedPhones = new Set((ownClients ?? []).map((c: { phone: string }) => c.phone))
    const authorizedRecipients = recipients.filter((r: { phone: string }) => allowedPhones.has(r.phone))
    const rejectedPhones = recipients
      .map((r: { phone: string }) => r.phone)
      .filter((phone: string) => !allowedPhones.has(phone))

    if (authorizedRecipients.length === 0) {
      throw new Error('None of the requested phone numbers belong to a client of your firm.')
    }

    // Grabbing the secrets you set in the dashboard
    const META_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    // Send one templated message per recipient, with that recipient's own
    // compiled parameter values filled into the template's body placeholders.
    const sentResults = await Promise.all(
      authorizedRecipients.map(async (recipient: { phone: string; parameters?: string[] }) => {
        const { phone, parameters } = recipient

        const template: Record<string, unknown> = {
          name: templateName,
          language: { code: languageCode || 'en_US' },
        }
        if (parameters && parameters.length > 0) {
          template.components = [{
            type: 'body',
            parameters: parameters.map((text) => ({ type: 'text', text: String(text) })),
          }]
        }

        const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${META_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toMetaPhone(phone),
            type: 'template',
            template,
          })
        });

        const body = await response.json()
        if (!response.ok || body.error) {
          return { phone, success: false, error: body.error?.message ?? `Meta API error (${response.status})` }
        }
        // Meta's own id for this specific message (the "wamid") — the webhook
        // receiver needs this to match a later delivery/read status update
        // back to this row, since it has no other stable shared key.
        return { phone, success: true, wamid: body.messages?.[0]?.id as string | undefined }
      })
    );

    // Report rejected (non-client) phone numbers as explicit failures so the
    // caller can see they weren't silently dropped.
    const rejectedResults = rejectedPhones.map((phone: string) => ({
      phone,
      success: false,
      error: 'Not a client of your firm — message not sent.',
    }))

    const results = [...sentResults, ...rejectedResults]
    const allSucceeded = results.every((r) => r.success)

    // Success response with CORS headers included
    return new Response(JSON.stringify({ success: allSucceeded, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    // Error response with CORS headers included
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
