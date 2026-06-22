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
    const { phoneNumbers, templateName } = await req.json()
    
    // Grabbing the secrets you set in the dashboard
    const META_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    // Loop through the clients and send
    const results = await Promise.all(phoneNumbers.map(async (phone: string) => {
      const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${META_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName, // Usually "hello_world" for sandbox
            language: { code: "en_US" }
          }
        })
      });
      return response.json();
    }));

    // Success response with CORS headers included
    return new Response(JSON.stringify({ success: true, results }), {
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