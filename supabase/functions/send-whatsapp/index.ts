import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// The magic headers that fix the browser block!
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Grabbing the secrets you set in the dashboard
    const META_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    // Send one templated message per recipient, with that recipient's own
    // compiled parameter values filled into the template's body placeholders.
    const results = await Promise.all(
      recipients.map(async (recipient: { phone: string; parameters?: string[] }) => {
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
            to: phone,
            type: 'template',
            template,
          })
        });

        const body = await response.json()
        if (!response.ok || body.error) {
          return { phone, success: false, error: body.error?.message ?? `Meta API error (${response.status})` }
        }
        return { phone, success: true }
      })
    );

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