CREATE SCHEMA IF NOT EXISTS copilot_ong;

CREATE TABLE IF NOT EXISTS copilot_ong.tags (
    tag_id BIGSERIAL PRIMARY KEY,
    descripcion TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS copilot_ong.tags_historico (
    tags_historico_id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    input_message TEXT NOT NULL,
    tag_id BIGINT NOT NULL
        REFERENCES copilot_ong.tags(tag_id),
    user_id BIGINT
);

CREATE INDEX IF NOT EXISTS tags_historico_fecha_idx
    ON copilot_ong.tags_historico (fecha);

CREATE INDEX IF NOT EXISTS tags_historico_tag_id_idx
    ON copilot_ong.tags_historico (tag_id);
