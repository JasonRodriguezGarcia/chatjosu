export function createTesterFeedbackAnalysisRepositoryV1({
  pool,
  schemaName = "copilot_ong",
} = {}) {
  if (!pool?.query) {
    throw new Error(
      "pool es obligatorio."
    );
  }

  const schema =
    String(schemaName || "")
      .trim();

  if (
    !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(
      schema,
    )
  ) {
    throw new Error(
      "schemaName no válido."
    );
  }

  async function requeueStale({
    staleAfterSeconds = 300,
  } = {}) {
    const result =
      await pool.query(
        `
        UPDATE ${schema}.helpchat_test_feedback_analysis
        SET
          status = 'pending',
          locked_at = NULL,
          next_attempt_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP,
          error_message =
            COALESCE(
              error_message,
              'STALE_ANALYSIS_LEASE'
            )
        WHERE
          status = 'analyzing'
          AND locked_at IS NOT NULL
          AND locked_at <
            CURRENT_TIMESTAMP
            - ($1 * INTERVAL '1 second')
        RETURNING
          feedback_id,
          status,
          attempts;
        `,
        [
          staleAfterSeconds,
        ],
      );

    return result.rows;
  }

  async function claimNext() {
    const result =
      await pool.query(
        `
        WITH candidate AS (
          SELECT feedback_id
          FROM ${schema}.helpchat_test_feedback_analysis
          WHERE
            status = 'pending'
            AND next_attempt_at <= CURRENT_TIMESTAMP
          ORDER BY feedback_id
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE ${schema}.helpchat_test_feedback_analysis AS analysis
        SET
          status = 'analyzing',
          attempts = analysis.attempts + 1,
          locked_at = CURRENT_TIMESTAMP,
          started_at = COALESCE(
            analysis.started_at,
            CURRENT_TIMESTAMP
          ),
          updated_at = CURRENT_TIMESTAMP,
          error_message = NULL
        FROM candidate
        WHERE
          analysis.feedback_id =
            candidate.feedback_id
        RETURNING
          analysis.feedback_id,
          analysis.status,
          analysis.attempts,
          analysis.locked_at,
          analysis.started_at;
        `,
      );

    return (
      result.rows[0] ||
      null
    );
  }

  async function loadFeedbackSnapshot(
    feedbackId,
  ) {
    const feedbackResult =
      await pool.query(
        `
        SELECT
          f.feedback_id,
          f.session_id,
          f.snapshot_through_turn_id,
          f.category,
          f.reason_text,
          f.expected_text,
          f.reason_source,
          f.anchor_turn_ids,
          f.review_status,
          f.created_at
        FROM ${schema}.helpchat_test_feedback AS f
        WHERE f.feedback_id = $1
        LIMIT 1;
        `,
        [feedbackId],
      );

    const feedback =
      feedbackResult.rows[0];

    if (!feedback) {
      return null;
    }

    const turnsResult =
      await pool.query(
        `
        WITH snapshot AS (
          SELECT sequence
          FROM ${schema}.helpchat_test_turns
          WHERE
            session_id = $1
            AND turn_id = $2
          LIMIT 1
        )
        SELECT
          t.turn_id,
          t.sequence,
          t.input_message,
          t.assistant_message,
          t.controlled_reply,
          t.context_before,
          t.context_after,
          t.runtime_metadata
        FROM ${schema}.helpchat_test_turns AS t
        CROSS JOIN snapshot
        WHERE
          t.session_id = $1
          AND t.sequence <= snapshot.sequence
        ORDER BY t.sequence;
        `,
        [
          feedback.session_id,
          feedback.snapshot_through_turn_id,
        ],
      );

    return {
      feedback,
      turns:
        turnsResult.rows,
    };
  }

  async function complete({
    feedbackId,
    status = "analyzed",
    provider,
    model,
    analysis,
  }) {
    const result =
      await pool.query(
        `
        UPDATE ${schema}.helpchat_test_feedback_analysis
        SET
          status = $2,
          provider = $3,
          model = $4,
          analysis = $5::jsonb,
          completed_at = CURRENT_TIMESTAMP,
          locked_at = NULL,
          updated_at = CURRENT_TIMESTAMP,
          error_message = NULL
        WHERE
          feedback_id = $1
          AND status = 'analyzing'
        RETURNING
          feedback_id,
          status,
          attempts,
          provider,
          model,
          analysis,
          completed_at;
        `,
        [
          feedbackId,
          status,
          provider || null,
          model || null,
          JSON.stringify(
            analysis ?? null,
          ),
        ],
      );

    return (
      result.rows[0] ||
      null
    );
  }

  async function releaseForRetry({
    feedbackId,
    errorMessage,
    retryDelaySeconds = 30,
  }) {
    const result =
      await pool.query(
        `
        UPDATE ${schema}.helpchat_test_feedback_analysis
        SET
          status = 'pending',
          next_attempt_at =
            CURRENT_TIMESTAMP
            + ($2 * INTERVAL '1 second'),
          locked_at = NULL,
          updated_at = CURRENT_TIMESTAMP,
          error_message = $3
        WHERE
          feedback_id = $1
          AND status = 'analyzing'
        RETURNING
          feedback_id,
          status,
          attempts,
          next_attempt_at,
          error_message;
        `,
        [
          feedbackId,
          retryDelaySeconds,
          errorMessage || null,
        ],
      );

    return (
      result.rows[0] ||
      null
    );
  }

  async function fail({
    feedbackId,
    errorMessage,
  }) {
    const result =
      await pool.query(
        `
        UPDATE ${schema}.helpchat_test_feedback_analysis
        SET
          status = 'failed',
          locked_at = NULL,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP,
          error_message = $2
        WHERE
          feedback_id = $1
          AND status = 'analyzing'
        RETURNING
          feedback_id,
          status,
          attempts,
          error_message,
          completed_at;
        `,
        [
          feedbackId,
          errorMessage || null,
        ],
      );

    return (
      result.rows[0] ||
      null
    );
  }

  return {
    requeueStale,
    claimNext,
    loadFeedbackSnapshot,
    complete,
    releaseForRetry,
    fail,
  };
}
