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

WITH desired_tags (
    ord,
    descripcion,
    tag_key
) AS (
    VALUES
        (1, 'Alzheimer y demencias', 'ALZHEIMER'),
        (2, 'Parkinson', 'PARKINSON'),
        (3, 'Esclerosis lateral amiotrófica (ELA)', 'ELA'),
        (4, 'Esclerosis múltiple', 'ESCLEROSIS_MULTIPLE'),
        (5, 'Enfermedades neuromusculares', 'ENFERMEDADES_NEUROMUSCULARES'),
        (6, 'Daño cerebral adquirido', 'DANO_CEREBRAL_ADQUIRIDO'),
        (7, 'Neurofibromatosis', 'NEUROFIBROMATOSIS'),
        (8, 'Cáncer', 'CANCER'),
        (9, 'Cáncer infantil', 'CANCER_INFANTIL'),
        (10, 'Diabetes', 'DIABETES'),
        (11, 'Enfermedad renal', 'ENFERMEDAD_RENAL'),
        (12, 'Fibrosis quística', 'FIBROSIS_QUISTICA'),
        (13, 'Celiaquía', 'CELIAQUIA'),
        (14, 'Hemofilia y coagulopatías', 'HEMOFILIA'),
        (15, 'Linfedema y lipedema', 'LINFEDEMA_LIPEDEMA'),
        (16, 'Artritis y espondilitis', 'ARTRITIS_ESPONDILITIS'),
        (17, 'Psoriasis y artritis psoriásica', 'PSORIASIS'),
        (18, 'Lupus', 'LUPUS'),
        (19, 'Fibromialgia y fatiga crónica', 'FIBROMIALGIA_FATIGA_CRONICA'),
        (20, 'Crohn y colitis ulcerosa', 'CROHN_COLITIS'),
        (21, 'Espina bífida e hidrocefalia', 'ESPINA_BIFIDA_HIDROCEFALIA'),
        (22, 'Sensibilidad química múltiple', 'SENSIBILIDAD_QUIMICA'),
        (23, 'Hepatitis', 'HEPATITIS'),
        (24, 'Retinosis pigmentaria', 'RETINOSIS_PIGMENTARIA'),
        (25, 'Autismo', 'AUTISMO'),
        (26, 'TDAH', 'TDAH'),
        (27, 'Dislexia y dificultades de lectoescritura', 'DISLEXIA'),
        (28, 'Discapacidad', 'DISCAPACIDAD'),
        (29, 'Discapacidad intelectual', 'DISCAPACIDAD_INTELECTUAL'),
        (30, 'Discapacidad auditiva y sordera', 'DISCAPACIDAD_AUDITIVA'),
        (31, 'Parálisis cerebral', 'PARALISIS_CEREBRAL'),
        (32, 'Salud mental', 'SALUD_MENTAL'),
        (33, 'Trastornos de la conducta alimentaria', 'TRASTORNOS_ALIMENTARIOS'),
        (34, 'Trastorno bipolar', 'TRASTORNO_BIPOLAR'),
        (35, 'Alcoholismo', 'ALCOHOLISMO'),
        (36, 'Adicciones a sustancias', 'ADICCIONES_DROGAS'),
        (37, 'Ludopatía y adicción al juego', 'LUDOPATIA'),
        (38, 'Exclusión social', 'EXCLUSION_SOCIAL'),
        (39, 'Pobreza y necesidades básicas', 'POBREZA_NECESIDADES_BASICAS'),
        (40, 'Personas sin hogar', 'SIN_HOGAR'),
        (41, 'Inserción laboral', 'INSERCION_LABORAL'),
        (42, 'Inmigración, refugio y asilo', 'INMIGRACION_REFUGIO'),
        (43, 'Violencia de género', 'VIOLENCIA_GENERO'),
        (44, 'Acoso laboral', 'ACOSO_LABORAL'),
        (45, 'Acoso escolar', 'ACOSO_ESCOLAR'),
        (46, 'Soledad no deseada', 'SOLEDAD_NO_DESEADA'),
        (47, 'Dependencia y apoyo a la autonomía', 'DEPENDENCIA'),
        (48, 'Personas presas y reinserción', 'PERSONAS_PRESAS'),
        (49, 'Acogimiento familiar', 'ACOGIMIENTO_FAMILIAR'),
        (50, 'Adopción y familias adoptivas', 'ADOPCION'),
        (51, 'Mediación y crisis familiar', 'MEDIACION_FAMILIAR'),
        (52, 'Personas mayores', 'PERSONAS_MAYORES'),
        (53, 'Discapacidad física', 'DISCAPACIDAD_FISICA'),
        (54, 'Adicciones comportamentales', 'ADICCIONES_COMPORTAMENTALES')
)
INSERT INTO copilot_ong.tags (
    descripcion,
    tag_key
)
SELECT
    desired.descripcion,
    desired.tag_key
FROM desired_tags AS desired
WHERE NOT EXISTS (
    SELECT 1
    FROM copilot_ong.tags AS existing
    WHERE existing.tag_key = desired.tag_key
)
ORDER BY desired.ord
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
