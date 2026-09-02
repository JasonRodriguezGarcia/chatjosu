-- 009_tags_v2.sql
-- Taxonomía de etiquetas v2 (D3 + D5). Idempotente: seguro de re-ejecutar.
-- Sin BEGIN/COMMIT: se aplica / hace dry-run dentro de una transacción externa.

-- D3.1 tag_key en tags (única, nullable; legacy sin key)
ALTER TABLE copilot_ong.tags
    ADD COLUMN IF NOT EXISTS tag_key TEXT UNIQUE;

-- D3.2 54 needs v2 (tag_ids 35..88 en orden del JSON)
UPDATE copilot_ong.tags
SET tag_key = 'TDAH'
WHERE tag_key = 'TDHA'
  AND NOT EXISTS (
    SELECT 1
    FROM copilot_ong.tags AS existing
    WHERE existing.tag_key = 'TDAH'
  );

INSERT INTO copilot_ong.tags (descripcion, tag_key)
VALUES
    ('Alzheimer y demencias', 'ALZHEIMER'),
    ('Parkinson', 'PARKINSON'),
    ('Esclerosis lateral amiotrófica (ELA)', 'ELA'),
    ('Esclerosis múltiple', 'ESCLEROSIS_MULTIPLE'),
    ('Enfermedades neuromusculares', 'ENFERMEDADES_NEUROMUSCULARES'),
    ('Daño cerebral adquirido', 'DANO_CEREBRAL_ADQUIRIDO'),
    ('Neurofibromatosis', 'NEUROFIBROMATOSIS'),
    ('Cáncer', 'CANCER'),
    ('Cáncer infantil', 'CANCER_INFANTIL'),
    ('Diabetes', 'DIABETES'),
    ('Enfermedad renal', 'ENFERMEDAD_RENAL'),
    ('Fibrosis quística', 'FIBROSIS_QUISTICA'),
    ('Celiaquía', 'CELIAQUIA'),
    ('Hemofilia y coagulopatías', 'HEMOFILIA'),
    ('Linfedema y lipedema', 'LINFEDEMA_LIPEDEMA'),
    ('Artritis y espondilitis', 'ARTRITIS_ESPONDILITIS'),
    ('Psoriasis y artritis psoriásica', 'PSORIASIS'),
    ('Lupus', 'LUPUS'),
    ('Fibromialgia y fatiga crónica', 'FIBROMIALGIA_FATIGA_CRONICA'),
    ('Crohn y colitis ulcerosa', 'CROHN_COLITIS'),
    ('Espina bífida e hidrocefalia', 'ESPINA_BIFIDA_HIDROCEFALIA'),
    ('Sensibilidad química múltiple', 'SENSIBILIDAD_QUIMICA'),
    ('Hepatitis', 'HEPATITIS'),
    ('Retinosis pigmentaria', 'RETINOSIS_PIGMENTARIA'),
    ('Autismo', 'AUTISMO'),
    ('TDAH', 'TDAH'),
    ('Dislexia y dificultades de lectoescritura', 'DISLEXIA'),
    ('Discapacidad', 'DISCAPACIDAD'),
    ('Discapacidad intelectual', 'DISCAPACIDAD_INTELECTUAL'),
    ('Discapacidad auditiva y sordera', 'DISCAPACIDAD_AUDITIVA'),
    ('Parálisis cerebral', 'PARALISIS_CEREBRAL'),
    ('Salud mental', 'SALUD_MENTAL'),
    ('Trastornos de la conducta alimentaria', 'TRASTORNOS_ALIMENTARIOS'),
    ('Trastorno bipolar', 'TRASTORNO_BIPOLAR'),
    ('Alcoholismo', 'ALCOHOLISMO'),
    ('Adicciones a sustancias', 'ADICCIONES_DROGAS'),
    ('Ludopatía y adicción al juego', 'LUDOPATIA'),
    ('Exclusión social', 'EXCLUSION_SOCIAL'),
    ('Pobreza y necesidades básicas', 'POBREZA_NECESIDADES_BASICAS'),
    ('Personas sin hogar', 'SIN_HOGAR'),
    ('Inserción laboral', 'INSERCION_LABORAL'),
    ('Inmigración, refugio y asilo', 'INMIGRACION_REFUGIO'),
    ('Violencia de género', 'VIOLENCIA_GENERO'),
    ('Acoso laboral', 'ACOSO_LABORAL'),
    ('Acoso escolar', 'ACOSO_ESCOLAR'),
    ('Soledad no deseada', 'SOLEDAD_NO_DESEADA'),
    ('Dependencia y apoyo a la autonomía', 'DEPENDENCIA'),
    ('Personas presas y reinserción', 'PERSONAS_PRESAS'),
    ('Acogimiento familiar', 'ACOGIMIENTO_FAMILIAR'),
    ('Adopción y familias adoptivas', 'ADOPCION'),
    ('Mediación y crisis familiar', 'MEDIACION_FAMILIAR'),
    ('Personas mayores', 'PERSONAS_MAYORES'),
    ('Discapacidad física', 'DISCAPACIDAD_FISICA'),
    ('Adicciones comportamentales', 'ADICCIONES_COMPORTAMENTALES')
ON CONFLICT (tag_key) DO NOTHING;

-- D3.3 re-key association_tags (solo asociaciones activas)
-- Fase 1: añadir la/s v2 mapeada/s a las asociaciones activas que aún llevan el legacy.
INSERT INTO copilot_ong.association_tags (association_id, tag_id)
SELECT at.association_id, v2.tag_id
FROM (
    VALUES
        (1, 'ACOGIMIENTO_FAMILIAR'),
        (2, 'ALCOHOLISMO'),
        (3, 'AUTISMO'),
        (4, 'ALZHEIMER'),
        (6, 'MEDIACION_FAMILIAR'),
        (9, 'CANCER'),
        (10, 'CANCER_INFANTIL'),
        (12, 'DANO_CEREBRAL_ADQUIRIDO'),
        (13, 'DIABETES'),
        (14, 'CROHN_COLITIS'),
        (15, 'PARKINSON'),
        (15, 'ALZHEIMER'),
        (16, 'PARKINSON'),
        (17, 'SALUD_MENTAL'),
        (18, 'ENFERMEDAD_RENAL'),
        (19, 'ESPINA_BIFIDA_HIDROCEFALIA'),
        (20, 'EXCLUSION_SOCIAL'),
        (21, 'ADOPCION'),
        (22, 'FIBROMIALGIA_FATIGA_CRONICA'),
        (23, 'FIBROMIALGIA_FATIGA_CRONICA'),
        (24, 'INMIGRACION_REFUGIO'),
        (25, 'INSERCION_LABORAL'),
        (27, 'EXCLUSION_SOCIAL'),
        (27, 'INSERCION_LABORAL'),
        (28, 'LUPUS'),
        (29, 'PARALISIS_CEREBRAL'),
        (30, 'INMIGRACION_REFUGIO'),
        (30, 'INSERCION_LABORAL'),
        (31, 'SALUD_MENTAL'),
        (32, 'TRASTORNOS_ALIMENTARIOS'),
        (33, 'TRASTORNO_BIPOLAR'),
        (34, 'DISCAPACIDAD_AUDITIVA')
) AS m(legacy_id, v2_key)
JOIN copilot_ong.association_tags AS at ON at.tag_id = m.legacy_id
JOIN copilot_ong.tags AS v2 ON v2.tag_key = m.v2_key
JOIN copilot_ong.associations AS a ON a.association_id = at.association_id AND a.active = TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM copilot_ong.association_tags AS at2
    WHERE at2.association_id = at.association_id
      AND at2.tag_id = v2.tag_id
)
ON CONFLICT (association_id, tag_id) DO NOTHING;

-- Fase 2: retirar los legacy mapeados de las asociaciones activas.
DELETE FROM copilot_ong.association_tags AS at
USING copilot_ong.associations AS a
WHERE a.association_id = at.association_id
  AND a.active = TRUE
  AND at.tag_id IN (1, 2, 3, 4, 6, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 31, 32, 33, 34);

-- D3.4 eliminar filas de los 3 ids provider (5, 8, 11)
DELETE FROM copilot_ong.association_tags
WHERE tag_id IN (5, 8, 11);

-- D5 columnas de provenance en associations (nullable, backward-compatible)
ALTER TABLE copilot_ong.associations
    ADD COLUMN IF NOT EXISTS source_record_id TEXT,
    ADD COLUMN IF NOT EXISTS record_url TEXT,
    ADD COLUMN IF NOT EXISTS detail_url TEXT,
    ADD COLUMN IF NOT EXISTS relevance_status TEXT,
    ADD COLUMN IF NOT EXISTS resource_role TEXT;
