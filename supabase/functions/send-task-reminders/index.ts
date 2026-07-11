import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// How far ahead to remind. A task stays eligible every day from now until
// this many days before its due date (not an exact-date match) so a failed
// send — e.g. Meta rejects the template — gets retried on the next run
// instead of being skipped forever once it falls outside a single day's window.
const REMINDER_WINDOW_DAYS = 3

// Deno edge functions run in UTC regardless of the business's IST
// timezone. Shifting by the IST offset before extracting a calendar date
// (rather than using the runtime's local getters/toISOString(), both of
// which are UTC-anchored here) makes "today" match the IST calendar date
// even in the ~5.5-hour window right at IST midnight (18:30 UTC), where
// UTC and IST disagree on what day it is.
function istDateString(d: Date): string {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// Mirrors toMetaPhone() in send-whatsapp/index.ts — duplicated rather than
// shared, since each edge function is a standalone Deno deployable.
function toMetaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 ? `91${digits}` : digits
}

// Mirrors the "Deadline Reminder (General)" default template in
// src/data/WhatsappApi.ts — duplicated for the same reason as toMetaPhone.
// Only the variables a scheduled reminder can actually know are filled in.
function buildReminderMessage(clientName: string, firmName: string, taskType: string, dueDate: string): { text: string; parameters: string[] } {
  const dueDateFormatted = new Date(dueDate).toLocaleDateString("en-IN")
  const text = `Hello ${clientName}, This is a reminder from ${firmName} that your ${taskType} is due on ${dueDateFormatted}. Please share the required documents at the earliest so we can file on time.`
  return { text, parameters: [clientName, firmName, taskType, dueDateFormatted] }
}

// Email fallback (ISSUES.md "Also missing: Email fallback for the minority
// of clients not reachable on WhatsApp") — same content as the WhatsApp
// reminder, reformatted as a subject+body message.
function buildReminderEmail(clientName: string, firmName: string, taskType: string, dueDate: string): { subject: string; text: string; html: string } {
  const dueDateFormatted = new Date(dueDate).toLocaleDateString("en-IN")
  const subject = `Reminder: ${taskType} due ${dueDateFormatted}`
  const text = `Hello ${clientName},\n\nThis is a reminder from ${firmName} that your ${taskType} is due on ${dueDateFormatted}. Please share the required documents at the earliest so we can file on time.\n\n— ${firmName}`
  const html = `<p>Hello ${clientName},</p><p>This is a reminder from ${firmName} that your <strong>${taskType}</strong> is due on <strong>${dueDateFormatted}</strong>. Please share the required documents at the earliest so we can file on time.</p><p>— ${firmName}</p>`
  return { subject, text, html }
}

// Resend, for the same reason the WhatsApp send below calls Meta's REST API
// directly: a plain fetch from Deno needs no SDK. Silently unavailable
// (not an error) until RESEND_API_KEY/RESEND_FROM_EMAIL secrets are set —
// mirrors errorMonitoring.ts's opt-in pattern for Sentry.
async function sendReminderEmail(
  apiKey: string,
  fromEmail: string,
  to: string,
  firmName: string,
  clientName: string,
  taskType: string,
  dueDate: string,
): Promise<{ success: boolean; error?: string; messageId?: string; subject: string; text: string }> {
  const { subject, text, html } = buildReminderEmail(clientName, firmName, taskType, dueDate)
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to, subject, text, html }),
    })
    const body = await response.json()
    if (!response.ok) {
      return { success: false, error: body?.message ?? `Resend responded ${response.status}`, subject, text }
    }
    return { success: true, messageId: body?.id, subject, text }
  } catch (err) {
    return { success: false, error: String(err), subject, text }
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Forbidden', { status: 403 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const todayStr = istDateString(now)
  const windowEndStr = istDateString(windowEnd)

  // Every firm's tasks in one pass — this is a scheduled system job, not a
  // per-user request, so it deliberately runs without firm scoping and
  // instead reads reminder_sent_at to avoid ever double-sending.
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, firm_id, client_id, task_type, custom_name, due_date, clients(name, phone, email), firms(name)')
    .is('reminder_sent_at', null)
    .neq('status', 'completed')
    .gte('due_date', todayStr)
    .lte('due_date', windowEndStr)

  if (tasksError) {
    return new Response(JSON.stringify({ error: tasksError.message }), { status: 500 })
  }

  const META_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')
  const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL')

  let sent = 0
  let failed = 0
  let emailSent = 0
  let emailFailed = 0
  let skippedNoContact = 0

  for (const task of tasks ?? []) {
    const client = (task as any).clients
    const firm = (task as any).firms
    const firmName = firm?.name ?? 'your CA'
    const taskLabel = task.task_type === 'Custom' ? (task.custom_name ?? 'Custom filing') : task.task_type

    if (!client?.phone && !client?.email) {
      skippedNoContact++
      continue
    }

    let delivered = false

    if (client.phone) {
      const { text, parameters } = buildReminderMessage(client.name, firmName, taskLabel, task.due_date)

      try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${META_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toMetaPhone(client.phone),
            type: 'template',
            template: {
              name: 'deadline_reminder_general',
              language: { code: 'en_US' },
              components: [{ type: 'body', parameters: parameters.map((p) => ({ type: 'text', text: p })) }],
            },
          }),
        })
        const body = await response.json()
        const success = response.ok && !body.error
        const wamid = success ? body.messages?.[0]?.id : null

        await supabase.from('whatsapp_sent_messages').insert({
          client_id: task.client_id,
          phone: client.phone,
          template_name: 'Deadline Reminder (Automated)',
          message: text,
          status: success ? 'sent' : 'failed',
          wamid,
        })

        if (success) {
          delivered = true
          sent++
        } else {
          console.error(`send-task-reminders: Meta send failed for task ${task.id}`, body.error)
          failed++
        }
      } catch (err) {
        console.error(`send-task-reminders: unexpected error for task ${task.id}`, err)
        failed++
      }
    }

    // Email fallback: only when WhatsApp wasn't available (no phone) or the
    // send above didn't succeed, and only when a provider is configured.
    if (!delivered && client.email && RESEND_API_KEY && RESEND_FROM_EMAIL) {
      const emailResult = await sendReminderEmail(RESEND_API_KEY, RESEND_FROM_EMAIL, client.email, firmName, client.name, taskLabel, task.due_date)

      await supabase.from('email_sent_messages').insert({
        firm_id: task.firm_id,
        client_id: task.client_id,
        email: client.email,
        subject: emailResult.subject,
        message: emailResult.text,
        status: emailResult.success ? 'sent' : 'failed',
        provider_message_id: emailResult.messageId ?? null,
      })

      if (emailResult.success) {
        delivered = true
        emailSent++
      } else {
        console.error(`send-task-reminders: email fallback failed for task ${task.id}`, emailResult.error)
        emailFailed++
      }
    }

    if (delivered) {
      await supabase.from('tasks').update({ reminder_sent_at: new Date().toISOString() }).eq('id', task.id)
    }
  }

  return new Response(JSON.stringify({ scanned: tasks?.length ?? 0, sent, failed, emailSent, emailFailed, skippedNoContact }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
