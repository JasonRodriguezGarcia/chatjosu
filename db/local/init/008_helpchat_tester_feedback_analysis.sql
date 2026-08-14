CREATE TABLE IF NOT EXISTS copilot_ong.helpchat_test_feedback_analysis (
    feedback_id BIGINT PRIMARY KEY
        REFERENCES copilot_ong.helpchat_test_feedback(feedback_id)
        ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'analyzing',
                'analyzed',
                'insufficient_evidence',
                'invalid_scope',
                'failed'
            )
        ),

    attempts INTEGER NOT NULL DEFAULT 0
        CHECK (attempts >= 0),

    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    locked_at TIMESTAMPTZ,

    provider TEXT,
    model TEXT,

    analysis JSONB,

    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
    helpchat_test_feedback_analysis_pending_idx
ON copilot_ong.helpchat_test_feedback_analysis (
    status,
    next_attempt_at,
    feedback_id
);

CREATE OR REPLACE FUNCTION
    copilot_ong.enqueue_helpchat_test_feedback_analysis()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO
        copilot_ong.helpchat_test_feedback_analysis (
            feedback_id,
            status
        )
    VALUES (
        NEW.feedback_id,
        'pending'
    )
    ON CONFLICT (feedback_id)
    DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
    helpchat_test_feedback_enqueue_analysis
ON copilot_ong.helpchat_test_feedback;

CREATE TRIGGER
    helpchat_test_feedback_enqueue_analysis
AFTER INSERT
ON copilot_ong.helpchat_test_feedback
FOR EACH ROW
EXECUTE FUNCTION
    copilot_ong.enqueue_helpchat_test_feedback_analysis();

-- Backfill: los feedback ya existentes también deben analizarse.
INSERT INTO
    copilot_ong.helpchat_test_feedback_analysis (
        feedback_id,
        status
    )
SELECT
    f.feedback_id,
    'pending'
FROM
    copilot_ong.helpchat_test_feedback f
ON CONFLICT (feedback_id)
DO NOTHING;
