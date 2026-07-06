import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error('razorpay_order_id, razorpay_payment_id and razorpay_signature are required.')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header.')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated.')

    // Confirm this order actually belongs to the caller's own firm before
    // doing anything else — without this, any authenticated user could pass
    // in someone else's order_id/payment_id/signature triple.
    const { data: payment, error: paymentError } = await supabase
      .from('subscription_payments')
      .select('id, firm_id, plan_id, cycle, status')
      .eq('razorpay_order_id', razorpay_order_id)
      .single()
    if (paymentError || !payment) throw new Error('Unknown order.')

    // The one check that actually proves this payment is genuine: Razorpay
    // signs order_id + "|" + payment_id with the key secret, and only
    // Razorpay and us know that secret.
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')!
    const expectedSignature = await hmacHex(`${razorpay_order_id}|${razorpay_payment_id}`, keySecret)
    if (expectedSignature !== razorpay_signature) {
      throw new Error('Payment signature verification failed.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Idempotent: if this payment was already verified (e.g. the client
    // retried after a network blip on the response), don't re-extend the plan.
    if (payment.status === 'paid') {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: updatePaymentError } = await supabaseAdmin
      .from('subscription_payments')
      .update({ status: 'paid', razorpay_payment_id })
      .eq('id', payment.id)
    if (updatePaymentError) throw new Error('Unable to record the completed payment.')

    const { data: plan } = await supabaseAdmin
      .from('subscription_plans')
      .select('name')
      .eq('id', payment.plan_id)
      .single()

    const monthsToAdd = payment.cycle === 'annual' ? 12 : 1
    const expiry = new Date()
    expiry.setMonth(expiry.getMonth() + monthsToAdd)

    const { error: updateFirmError } = await supabaseAdmin
      .from('firms')
      .update({ plan: plan?.name ?? null, plan_expiry: expiry.toISOString().slice(0, 10) })
      .eq('id', payment.firm_id)
    if (updateFirmError) throw new Error('Payment verified, but failed to activate the subscription.')

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
