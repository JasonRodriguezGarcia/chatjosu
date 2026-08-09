-- Catálogo territorial oficial de España.
-- Fuente de códigos y denominaciones:
-- Instituto Nacional de Estadística (INE),
-- Relación de provincias con sus códigos.
--
-- province_key mantiene la convención canónica interna de HelpChat.
-- ine_code preserva la identidad territorial oficial.

ALTER TABLE copilot_ong.provinces
    ADD COLUMN IF NOT EXISTS ine_code CHAR(2);

CREATE UNIQUE INDEX IF NOT EXISTS
    provinces_ine_code_uidx
ON copilot_ong.provinces (ine_code)
WHERE ine_code IS NOT NULL;

WITH official_provinces (
    ine_code,
    province_key,
    name
) AS (
VALUES
    ('01', 'ALAVA', 'Araba/Álava'),
    ('02', 'ALBACETE', 'Albacete'),
    ('03', 'ALICANTE', 'Alicante/Alacant'),
    ('04', 'ALMERIA', 'Almería'),
    ('05', 'AVILA', 'Ávila'),
    ('06', 'BADAJOZ', 'Badajoz'),
    ('07', 'ILLES BALEARS', 'Balears, Illes'),
    ('08', 'BARCELONA', 'Barcelona'),
    ('09', 'BURGOS', 'Burgos'),
    ('10', 'CACERES', 'Cáceres'),
    ('11', 'CADIZ', 'Cádiz'),
    ('12', 'CASTELLON', 'Castellón/Castelló'),
    ('13', 'CIUDAD REAL', 'Ciudad Real'),
    ('14', 'CORDOBA', 'Córdoba'),
    ('15', 'A CORUNA', 'Coruña, A'),
    ('16', 'CUENCA', 'Cuenca'),
    ('17', 'GIRONA', 'Girona'),
    ('18', 'GRANADA', 'Granada'),
    ('19', 'GUADALAJARA', 'Guadalajara'),
    ('20', 'GUIPUZCOA', 'Gipuzkoa'),
    ('21', 'HUELVA', 'Huelva'),
    ('22', 'HUESCA', 'Huesca'),
    ('23', 'JAEN', 'Jaén'),
    ('24', 'LEON', 'León'),
    ('25', 'LLEIDA', 'Lleida'),
    ('26', 'LA RIOJA', 'Rioja, La'),
    ('27', 'LUGO', 'Lugo'),
    ('28', 'MADRID', 'Madrid'),
    ('29', 'MALAGA', 'Málaga'),
    ('30', 'MURCIA', 'Murcia'),
    ('31', 'NAVARRA', 'Navarra'),
    ('32', 'OURENSE', 'Ourense'),
    ('33', 'ASTURIAS', 'Asturias'),
    ('34', 'PALENCIA', 'Palencia'),
    ('35', 'LAS PALMAS', 'Palmas, Las'),
    ('36', 'PONTEVEDRA', 'Pontevedra'),
    ('37', 'SALAMANCA', 'Salamanca'),
    ('38', 'SANTA CRUZ DE TENERIFE', 'Santa Cruz de Tenerife'),
    ('39', 'CANTABRIA', 'Cantabria'),
    ('40', 'SEGOVIA', 'Segovia'),
    ('41', 'SEVILLA', 'Sevilla'),
    ('42', 'SORIA', 'Soria'),
    ('43', 'TARRAGONA', 'Tarragona'),
    ('44', 'TERUEL', 'Teruel'),
    ('45', 'TOLEDO', 'Toledo'),
    ('46', 'VALENCIA', 'Valencia/València'),
    ('47', 'VALLADOLID', 'Valladolid'),
    ('48', 'VIZCAYA', 'Bizkaia'),
    ('49', 'ZAMORA', 'Zamora'),
    ('50', 'ZARAGOZA', 'Zaragoza'),
    ('51', 'CEUTA', 'Ceuta'),
    ('52', 'MELILLA', 'Melilla')
)
INSERT INTO copilot_ong.provinces (
    province_key,
    name,
    source,
    ine_code,
    updated_at
)
SELECT
    province_key,
    name,
    'ine_province_codes_2026',
    ine_code,
    CURRENT_TIMESTAMP
FROM official_provinces
ON CONFLICT (province_key)
DO UPDATE SET
    name = EXCLUDED.name,
    source = EXCLUDED.source,
    ine_code = EXCLUDED.ine_code,
    updated_at = CURRENT_TIMESTAMP;

-- NACIONAL es un scope, nunca una provincia.
-- La auditoría previa confirmó cero referencias.
DELETE FROM copilot_ong.provinces
WHERE province_key = 'NACIONAL'
  AND NOT EXISTS (
      SELECT 1
      FROM copilot_ong.associations
      WHERE province_key = 'NACIONAL'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM copilot_ong.province_neighbors
      WHERE province_key = 'NACIONAL'
         OR neighbor_key = 'NACIONAL'
  );
