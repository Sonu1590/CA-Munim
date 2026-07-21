import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// WhatsApp sending in this app always goes through the platform's own Meta
// Cloud API credentials (WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID
// function secrets — see send-whatsapp/index.ts and send-task-reminders/index.ts).
// There is no per-firm WATI/Twilio integration anywhere in this codebase, so
// "testing a connection" means checking those platform credentials still
// work against Meta, not validating anything a firm typed into a form.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Require a real signed-in session (any firm) so this isn't a public,
    // unauthenticated way to probe whether WhatsApp secrets are configured.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header.')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated.')

    const META_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    if (!META_TOKEN || !PHONE_ID) {
      return new Response(JSON.stringify({
        connected: false,
        error: 'WhatsApp is not configured on this deployment yet — contact your administrator.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${PHONE_ID}?fields=verified_name,display_phone_number,quality_rating`,
      { headers: { 'Authorization': `Bearer ${META_TOKEN}` } }
    )
    const body = await response.json()

    if (!response.ok || body.error) {
      return new Response(JSON.stringify({
        connected: false,
        error: body.error?.message ?? `Meta API error (${response.status})`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      connected: true,
      displayPhoneNumber: body.display_phone_number,
      verifiedName: body.verified_name,
      qualityRating: body.quality_rating,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ connected: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
