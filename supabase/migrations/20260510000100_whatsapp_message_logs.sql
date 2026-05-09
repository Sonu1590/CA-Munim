-- Outbound and inbound WhatsApp logs for WhatsApp Center (Status / Inbox tabs).
-- Run via Supabase SQL editor or `supabase db push` once your CLI is configured.

CREATE TABLE IF NOT EXISTS public.whatsapp_sent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  template_name TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  fail_reason TEXT
);

CREATE TABLE IF NOT EXISTS public.whatsapp_received_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  message TEXT DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS whatsapp_sent_messages_client_sent_idx
  ON public.whatsapp_sent_messages (client_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_received_messages_received_idx
  ON public.whatsapp_received_messages (received_at DESC);

ALTER TABLE public.whatsapp_sent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_received_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_whatsapp_sent_own_firm" ON public.whatsapp_sent_messages;
CREATE POLICY "staff_manage_whatsapp_sent_own_firm"
  ON public.whatsapp_sent_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      INNER JOIN public.clients c
        ON c.id = whatsapp_sent_messages.client_id
       AND c.firm_id = s.firm_id
      WHERE s.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff s
      INNER JOIN public.clients c
        ON c.id = whatsapp_sent_messages.client_id
       AND c.firm_id = s.firm_id
      WHERE s.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "staff_manage_whatsapp_received_own_firm" ON public.whatsapp_received_messages;
CREATE POLICY "staff_manage_whatsapp_received_own_firm"
  ON public.whatsapp_received_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.staff s
      INNER JOIN public.clients c
        ON c.id = whatsapp_received_messages.client_id
       AND c.firm_id = s.firm_id
      WHERE s.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.staff s
      INNER JOIN public.clients c
        ON c.id = whatsapp_received_messages.client_id
       AND c.firm_id = s.firm_id
      WHERE s.auth_user_id = auth.uid()
    )
  );
