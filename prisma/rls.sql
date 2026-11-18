-- Gaïa — Row Level Security (tables gaia_* only).
-- Extracted verbatim from Promethe prisma/rls.sql (Features-promethe, head b859140).
-- Apply in the Supabase SQL editor AFTER `npx prisma db push`.
-- Pattern: user_id = auth.uid()::text — auth.uid() returns uuid, app ids are text (cuid),
-- so the ::text cast is mandatory (Promethe fix e2f1d57).
-- NOTE: these policies only take effect when requests run as the Supabase
-- authenticated role with a JWT whose sub is the app user id. The Next.js
-- server uses the service/pooler connection (DATABASE_URL) and enforces
-- userId scoping in code (src/server/gaia.ts); RLS is a defence-in-depth
-- layer for direct Supabase access, exactly as in Promethe.

-- Gaïa — workspace de notes
-- ═════════════════════════════════════════════════════════════════════════════
-- Modèle trades : une policy par opération, scoping par user_id = auth.uid()::text.
-- Les lignes en corbeille (deleted_at non nul) restent scopées au propriétaire ;
-- le filtre deleted_at est appliqué par le code serveur (src/server/gaia.ts).

-- gaia_notes
ALTER TABLE gaia_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gaia_notes_select ON gaia_notes;
CREATE POLICY gaia_notes_select ON gaia_notes
  FOR SELECT
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_notes_insert ON gaia_notes;
CREATE POLICY gaia_notes_insert ON gaia_notes
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_notes_update ON gaia_notes;
CREATE POLICY gaia_notes_update ON gaia_notes
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_notes_delete ON gaia_notes;
CREATE POLICY gaia_notes_delete ON gaia_notes
  FOR DELETE
  USING (user_id = auth.uid()::text);

-- gaia_folders
ALTER TABLE gaia_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gaia_folders_select ON gaia_folders;
CREATE POLICY gaia_folders_select ON gaia_folders
  FOR SELECT
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_folders_insert ON gaia_folders;
CREATE POLICY gaia_folders_insert ON gaia_folders
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_folders_update ON gaia_folders;
CREATE POLICY gaia_folders_update ON gaia_folders
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_folders_delete ON gaia_folders;
CREATE POLICY gaia_folders_delete ON gaia_folders
  FOR DELETE
  USING (user_id = auth.uid()::text);

-- gaia_tags
ALTER TABLE gaia_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gaia_tags_select ON gaia_tags;
CREATE POLICY gaia_tags_select ON gaia_tags
  FOR SELECT
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_tags_insert ON gaia_tags;
CREATE POLICY gaia_tags_insert ON gaia_tags
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_tags_update ON gaia_tags;
CREATE POLICY gaia_tags_update ON gaia_tags
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_tags_delete ON gaia_tags;
CREATE POLICY gaia_tags_delete ON gaia_tags
  FOR DELETE
  USING (user_id = auth.uid()::text);

-- gaia_templates
ALTER TABLE gaia_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gaia_templates_select ON gaia_templates;
CREATE POLICY gaia_templates_select ON gaia_templates
  FOR SELECT
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_templates_insert ON gaia_templates;
CREATE POLICY gaia_templates_insert ON gaia_templates
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_templates_update ON gaia_templates;
CREATE POLICY gaia_templates_update ON gaia_templates
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_templates_delete ON gaia_templates;
CREATE POLICY gaia_templates_delete ON gaia_templates
  FOR DELETE
  USING (user_id = auth.uid()::text);

-- gaia_versions
ALTER TABLE gaia_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gaia_versions_select ON gaia_versions;
CREATE POLICY gaia_versions_select ON gaia_versions
  FOR SELECT
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_versions_insert ON gaia_versions;
CREATE POLICY gaia_versions_insert ON gaia_versions
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_versions_update ON gaia_versions;
CREATE POLICY gaia_versions_update ON gaia_versions
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS gaia_versions_delete ON gaia_versions;
CREATE POLICY gaia_versions_delete ON gaia_versions
  FOR DELETE
  USING (user_id = auth.uid()::text);
