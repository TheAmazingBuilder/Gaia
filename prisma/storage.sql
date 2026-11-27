-- Gaïa — Supabase Storage (Module 3 : File & Document Management).
--
-- Apply in the Supabase SQL editor AFTER `npx prisma db push`
-- (bucket privé `gaia-files` ; les fichiers sont servis uniquement via
-- les routes API Next.js, qui utilisent la service role key côté serveur).
-- La service role contourne RLS ; les policies ci-dessous sont une
-- défense en profondeur pour tout accès direct (anon/authenticated).
-- Aucun accès public : le bucket n'est PAS public.

-- Bucket (idempotent).
INSERT INTO storage.buckets (id, name, public)
VALUES ('gaia-files', 'gaia-files', false)
ON CONFLICT (id) DO NOTHING;

-- storage.objects : lecture/écriture réservées au propriétaire du chemin
-- (<userId>/...). auth.uid()::text = id applicatif (cuid), comme rls.sql.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gaia_files_select ON storage.objects;
CREATE POLICY gaia_files_select ON storage.objects
  FOR SELECT
  USING (bucket_id = 'gaia-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS gaia_files_insert ON storage.objects;
CREATE POLICY gaia_files_insert ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'gaia-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS gaia_files_update ON storage.objects;
CREATE POLICY gaia_files_update ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'gaia-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'gaia-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS gaia_files_delete ON storage.objects;
CREATE POLICY gaia_files_delete ON storage.objects
  FOR DELETE
  USING (bucket_id = 'gaia-files' AND (storage.foldername(name))[1] = auth.uid()::text);
