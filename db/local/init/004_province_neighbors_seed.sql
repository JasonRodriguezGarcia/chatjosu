-- Deprecated territorial seed.
--
-- La versión inicial contenía únicamente:
--   Álava <-> Burgos
--   Álava <-> Navarra
--
-- No se insertan filas aquí deliberadamente.
--
-- Motivo:
-- 005_spain_territorial_catalog.sql crea el catálogo territorial
-- oficial completo antes de que
-- 006_province_neighbors_seed.sql cargue la topología derivada
-- de CNIG/IGN.
--
-- Mantener este fichero como no-op conserva el orden histórico
-- de las migraciones y permite bootstraps limpios.

SELECT 1;
