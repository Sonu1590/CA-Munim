-- Add row-level security policies for WhatsApp message templates (BUG-WA-01).

-- Add user_id column if it doesn't exist
ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

-- Add foreign key to auth.users
ALTER TABLE public.message_templates
  ADD CONSTRAINT fk_message_templates_user_id
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable row-level security
ALTER TABLE public.message_templates
  ENABLE ROW LEVEL SECURITY;

-- Create policies for user-owned templates
CREATE POLICY "Users can select their own templates"
  ON public.message_templates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
  ON public.message_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON public.message_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON public.message_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
