import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Public endpoint called directly by Meta, with no Supabase session — it
// cannot use verify_jwt. Authenticity is instead established two ways:
// the GET handshake requires knowing WHATSAPP_WEBHOOK_VERIFY_TOKEN, and
// every POST body must carry a valid X-Hub-Signature-256 HMAC computed
// with the Meta App Secret. Reject anything that fails either check.

// Client phone numbers are stored bare (no country code) in the DB; Meta's
// `from` field on incoming messages is E.164-style with the country code.
// Mirrors (inverts) the toMetaPhone() helper in send-whatsapp/index.ts.
function fromMetaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
}

async function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const expectedHex = signatureHeader.slice('sha256='.length)

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const macHex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')

  if (macHex.length !== expectedHex.length) return false
  let diff = 0
  for (let i = 0; i < macHex.length; i++) diff |= macHex.charCodeAt(i) ^ expectedHex.charCodeAt(i)
  return diff === 0
}

// A status can only ever move forward along this order — out-of-order
// webhook delivery (Meta doesn't guarantee ordering) must not regress an
// already-"read" row back down to "delivered".
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 1 }

serve(async (req) => {
  // Meta's one-time subscription handshake when you save the Callback URL.
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN')) {
      return new Response(challenge ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const rawBody = await req.text()
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET')
  const signatureOk = appSecret && await verifySignature(rawBody, req.headers.get('x-hub-signature-256'), appSecret)
  if (!signatureOk) {
    return new Response('Invalid signature', { status: 401 })
  }

  // From here on, always return 200 — Meta retries (and eventually disables
  // the subscription) on non-2xx responses, so a single bad event inside the
  // payload must not fail the whole delivery. Errors are logged, not thrown.
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('EVENT_RECEIVED', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {}

      for (const status of value.statuses ?? []) {
        try {
          const newStatus = status.status as string
          if (!(newStatus in STATUS_RANK)) continue

          const { data: existing } = await supabase
            .from('whatsapp_sent_messages')
            .select('id, status')
            .eq('wamid', status.id)
            .maybeSingle()
          if (!existing) continue

          const currentRank = STATUS_RANK[existing.status] ?? 0
          if (STATUS_RANK[newStatus] < currentRank) continue

          await supabase
            .from('whatsapp_sent_messages')
            .update({ status: newStatus })
            .eq('id', existing.id)
        } catch (err) {
          console.error('whatsapp-webhook: failed to process status update', err)
        }
      }

      for (const message of value.messages ?? []) {
        try {
          const localPhone = fromMetaPhone(message.from as string)
          const text = message.text?.body ?? `[Unsupported message type: ${message.type}]`

          // A phone can belong to more than one firm's client list (this app
          // shares one Meta number across all tenants) — file the message
          // into every firm that actually has this person as a client rather
          // than guessing a single owner.
          const { data: matches } = await supabase
            .from('clients')
            .select('id, firm_id')
            .eq('phone', localPhone)
          if (!matches || matches.length === 0) continue

          const rows = matches.map((client: { id: string; firm_id: string }) => ({
            firm_id: client.firm_id,
            client_id: client.id,
            phone: localPhone,
            message: text,
            is_read: false,
            received_at: new Date(Number(message.timestamp) * 1000).toISOString(),
          }))
          await supabase.from('whatsapp_received_messages').insert(rows)
        } catch (err) {
          console.error('whatsapp-webhook: failed to process incoming message', err)
        }
      }
    }
  }

  return new Response('EVENT_RECEIVED', { status: 200 })
})
