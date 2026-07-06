import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { planId, cycle } = await req.json()
    if (!planId || (cycle !== 'monthly' && cycle !== 'annual')) {
      throw new Error('planId and a valid cycle ("monthly" or "annual") are required.')
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

    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('firm_id')
      .eq('auth_user_id', user.id)
      .single()
    if (staffError || !staff) throw new Error('Unable to resolve your firm.')

    // Price is looked up server-side from the plan the caller picked — never
    // trust a client-supplied amount for something that charges real money.
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, price_monthly, price_annual')
      .eq('id', planId)
      .eq('is_active', true)
      .single()
    if (planError || !plan) throw new Error('Unknown or inactive plan.')

    // price_annual is already the full discounted yearly total (2 months
    // free baked in), not a monthly rate — do not multiply it again.
    const subtotal = cycle === 'annual' ? plan.price_annual : plan.price_monthly
    const gst = Math.round(subtotal * 0.18)
    const totalRupees = subtotal + gst
    const amountPaise = Math.round(totalRupees * 100)

    const keyId = Deno.env.get('RAZORPAY_KEY_ID')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
    const basicAuth = btoa(`${keyId}:${keySecret}`)

    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        notes: { firm_id: staff.firm_id, plan_id: planId, cycle },
      }),
    })

    const order = await orderResponse.json()
    if (!orderResponse.ok || order.error) {
      throw new Error(order.error?.description ?? `Razorpay order creation failed (${orderResponse.status})`)
    }

    // Service-role client so the insert isn't subject to subscription_payments'
    // read-only RLS policy — this is the only code path allowed to create a row.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { error: insertError } = await supabaseAdmin.from('subscription_payments').insert({
      firm_id: staff.firm_id,
      plan_id: planId,
      cycle,
      amount: amountPaise,
      razorpay_order_id: order.id,
      status: 'created',
    })
    if (insertError) throw new Error('Unable to record the payment attempt.')

    return new Response(
      JSON.stringify({ orderId: order.id, amount: amountPaise, currency: 'INR', keyId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
