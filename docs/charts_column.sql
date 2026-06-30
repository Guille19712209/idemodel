-- Migración: columna `models.charts` (jsonb) — gráficos guardados de "Values in graphics".
-- Guarda config de vista VIVA (no datos): [{ id, name, type, valueMode, title, filter }].
-- Sin RLS nueva: escritura gobernada por la policy UPDATE de `models` (can_write_model =
-- owner|writer); reader la lee vía SELECT. Idempotente.

ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS charts jsonb NOT NULL DEFAULT '[]'::jsonb;
