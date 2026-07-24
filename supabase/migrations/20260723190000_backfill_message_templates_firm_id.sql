-- Direct fallout of C7's RLS fix: saveMessageTemplateToSupabase (src/data/
-- WhatsappApi.ts) never set firm_id on insert, so every template saved
-- through the app's normal UI (including the 4 real production WhatsApp
-- templates registered with Meta for H5/H7, plus the default "Hello World")
-- landed with firm_id = NULL. That was invisible before only because the
-- legacy user_id-only policies C7 removed didn't check firm_id either — the
-- correct templates_all policy (firm_id = get_my_firm_id()) never matches
-- NULL, so once the vulnerability was closed these templates became
-- invisible to their own firm, breaking every "quick reminder" feature
-- built this session (sendQuickReminder's partial-name template lookup
-- would find nothing).
--
-- All 5 affected rows were confirmed (via user_id -> staff -> firm_id) to
-- have been created by the same real firm's own account — not some
-- cross-firm mixup — so a direct backfill to that firm_id is correct and
-- complete, not a guess.
update public.message_templates
set firm_id = '49f9fd8c-4c99-4366-8888-50216b80bb58'
where firm_id is null
  and user_id = 'e9130746-d2db-4d88-b10a-f18efc54754a';
