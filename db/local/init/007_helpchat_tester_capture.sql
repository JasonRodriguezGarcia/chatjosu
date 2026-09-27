CREATE TABLE IF NOT EXISTS copilot_ong.helpchat_test_sessions (
    session_id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    environment TEXT NOT NULL DEFAULT 'testing',
    build_revision TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    CHECK (
        status IN (
            'active',
            'completed',
            'archived'
        )
    )
);

CREATE TABLE IF NOT EXISTS copilot_ong.helpchat_test_turns (
    turn_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL
        REFERENCES copilot_ong.helpchat_test_sessions(session_id)
        ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    input_message TEXT NOT NULL,
    assistant_message TEXT NOT NULL,
    controlled_reply JSONB,
    context_before JSONB,
    context_after JSONB,
    runtime_metadata JSONB,
    UNIQUE (session_id, sequence),
    UNIQUE (session_id, turn_id),
    CHECK (sequence > 0)
);

CREATE TABLE IF NOT EXISTS copilot_ong.helpchat_test_feedback (
    feedback_id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL
        REFERENCES copilot_ong.helpchat_test_sessions(session_id)
        ON DELETE CASCADE,
    snapshot_through_turn_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    category TEXT NOT NULL DEFAULT 'other',
    reason_text TEXT NOT NULL,
    expected_text TEXT,
    reason_source TEXT NOT NULL DEFAULT 'text',
    anchor_turn_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_status TEXT NOT NULL DEFAULT 'pending',
    regression_id TEXT,
    FOREIGN KEY (
        session_id,
        snapshot_through_turn_id
    )
        REFERENCES copilot_ong.helpchat_test_turns(
            session_id,
            turn_id
        )
        ON DELETE CASCADE,
    CHECK (
        category IN (
            'not_understood',
            'repeated_question',
            'incorrect_response',
            'wrong_person',
            'wrong_resources',
            'incorrect_inference',
            'conversation_context',
            'other'
        )
    ),
    CHECK (
        reason_source IN (
            'text',
            'speech'
        )
    ),
    CHECK (
        review_status IN (
            'pending',
            'reviewed',
            'promoted',
            'dismissed'
        )
    )
);

CREATE INDEX IF NOT EXISTS helpchat_test_turns_session_idx
    ON copilot_ong.helpchat_test_turns (
        session_id,
        sequence
    );

CREATE INDEX IF NOT EXISTS helpchat_test_feedback_review_idx
    ON copilot_ong.helpchat_test_feedback (
        review_status,
        created_at
    );

CREATE INDEX IF NOT EXISTS helpchat_test_feedback_session_idx
    ON copilot_ong.helpchat_test_feedback (
        session_id,
        created_at
    );
