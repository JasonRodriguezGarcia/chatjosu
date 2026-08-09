-- Fallback territorial inicial de HelpChat.
--
-- Solo se incluyen relaciones verificadas que además existen
-- actualmente en el catálogo normalizado de provincias.
--
-- distance_km permanece NULL deliberadamente: estas relaciones
-- significan provincia limítrofe, no distancia calculada.

INSERT INTO copilot_ong.province_neighbors (
    province_key,
    neighbor_key,
    distance_km,
    source
)
VALUES
    ('ALAVA', 'BURGOS', NULL, 'manual_border_v1'),
    ('BURGOS', 'ALAVA', NULL, 'manual_border_v1'),
    ('ALAVA', 'NAVARRA', NULL, 'manual_border_v1'),
    ('NAVARRA', 'ALAVA', NULL, 'manual_border_v1')
ON CONFLICT (province_key, neighbor_key)
DO UPDATE SET
    distance_km = EXCLUDED.distance_km,
    source = EXCLUDED.source;
