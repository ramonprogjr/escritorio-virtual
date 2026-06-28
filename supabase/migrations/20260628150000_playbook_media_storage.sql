-- Mídia de playbook (PDF/áudio/imagem): ficheiros no Storage para anexar aos agentes.
-- Bucket público (leitura) para URLs estáveis; escrita via service_role na API.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'playbook-media',
  'playbook-media',
  true,
  26214400,
  ARRAY[
    'application/pdf',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/mp3',
    'audio/x-m4a',
    'image/png',
    'image/jpeg',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "playbook_media_select_public" ON storage.objects;
CREATE POLICY "playbook_media_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'playbook-media');

-- Upload/update/delete: usar SUPABASE_SERVICE_ROLE_KEY na API Next.js (contorna RLS).
