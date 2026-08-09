CREATE SCHEMA IF NOT EXISTS copilot_ong;

CREATE TABLE IF NOT EXISTS copilot_ong.provinces (
    province_key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    geocoding_precision TEXT,
    source TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS copilot_ong.municipalities (
    municipality_id BIGSERIAL PRIMARY KEY,
    municipality_key TEXT NOT NULL,
    province_key TEXT NOT NULL REFERENCES copilot_ong.provinces(province_key),
    name TEXT NOT NULL,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    geocoding_precision TEXT,
    source TEXT,
    UNIQUE (province_key, municipality_key)
);

CREATE TABLE IF NOT EXISTS copilot_ong.associations (
    association_id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('Local', 'Provincial', 'Autonómico', 'Nacional', 'Desconocido')),
    province_key TEXT REFERENCES copilot_ong.provinces(province_key),
    municipality_id BIGINT REFERENCES copilot_ong.municipalities(municipality_id),
    address TEXT,
    postal_code TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    description TEXT,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    location_precision TEXT,
    source_sheet TEXT NOT NULL,
    source_row INTEGER NOT NULL,
    source_id TEXT,
    source_quality TEXT,
    content_hash CHAR(64) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS copilot_ong.association_tags (
    association_id BIGINT NOT NULL REFERENCES copilot_ong.associations(association_id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES copilot_ong.tags(tag_id) ON DELETE CASCADE,
    category_source TEXT,
    mapping_source TEXT NOT NULL DEFAULT 'normalized_workbook',
    PRIMARY KEY (association_id, tag_id)
);

CREATE TABLE IF NOT EXISTS copilot_ong.province_neighbors (
    province_key TEXT NOT NULL REFERENCES copilot_ong.provinces(province_key) ON DELETE CASCADE,
    neighbor_key TEXT NOT NULL REFERENCES copilot_ong.provinces(province_key) ON DELETE CASCADE,
    distance_km NUMERIC(8,2),
    source TEXT,
    PRIMARY KEY (province_key, neighbor_key),
    CHECK (province_key <> neighbor_key)
);

CREATE TABLE IF NOT EXISTS copilot_ong.query_metrics (
    query_metric_id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    environment TEXT NOT NULL DEFAULT 'development',
    province_key TEXT,
    municipality_key TEXT,
    tag_id BIGINT REFERENCES copilot_ong.tags(tag_id),
    provider TEXT,
    model TEXT,
    latency_ms INTEGER,
    result_count INTEGER,
    fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
    fallback_level TEXT,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_code TEXT,
    input_message TEXT
);

CREATE INDEX IF NOT EXISTS associations_province_idx
    ON copilot_ong.associations (province_key)
    WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS associations_municipality_idx
    ON copilot_ong.associations (municipality_id)
    WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS association_tags_tag_idx
    ON copilot_ong.association_tags (tag_id, association_id);

CREATE INDEX IF NOT EXISTS query_metrics_demand_idx
    ON copilot_ong.query_metrics (created_at, province_key, tag_id);
