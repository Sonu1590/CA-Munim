import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Handle CORS for your React frontend
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const { phoneNumbers, templateName } = await req.json()
    
    const META_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
    const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

    // Loop through the array of client phone numbers from your React app
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
            name: templateName, // e.g., "hello_world" for now
            language: { code: "en_US" }
          }
        })
      });
      return response.json();
    }));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
