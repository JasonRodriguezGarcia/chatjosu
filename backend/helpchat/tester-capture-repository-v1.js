export function createTesterCaptureRepositoryV1({
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

  async function createSession({
    sessionId,
    environment,
    buildRevision,
  }) {
    const result =
      await pool.query(
        `
        INSERT INTO ${schema}.helpchat_test_sessions (
          session_id,
          environment,
          build_revision
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (session_id)
        DO UPDATE SET
          updated_at = CURRENT_TIMESTAMP
        RETURNING
          session_id,
          environment,
          build_revision,
          status;
        `,
        [
          sessionId,
          environment,
          buildRevision,
        ],
      );

    return result.rows[0];
  }

  async function appendTurn({
    sessionId,
    turnId,
    sequence,
    inputMessage,
    assistantMessage,
    controlledReply,
    contextBefore,
    contextAfter,
    runtimeMetadata,
  }) {
    const result =
      await pool.query(
        `
        INSERT INTO ${schema}.helpchat_test_turns (
          turn_id,
          session_id,
          sequence,
          input_message,
          assistant_message,
          controlled_reply,
          context_before,
          context_after,
          runtime_metadata
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb
        )
        ON CONFLICT (turn_id)
        DO NOTHING
        RETURNING
          turn_id,
          session_id,
          sequence;
        `,
        [
          turnId,
          sessionId,
          sequence,
          inputMessage,
          assistantMessage,
          JSON.stringify(
            controlledReply,
          ),
          JSON.stringify(
            contextBefore,
          ),
          JSON.stringify(
            contextAfter,
          ),
          JSON.stringify(
            runtimeMetadata,
          ),
        ],
      );

    if (result.rows[0]) {
      return {
        status:
          "created",
        turn:
          result.rows[0],
      };
    }

    const existing =
      await pool.query(
        `
        SELECT
          turn_id,
          session_id,
          sequence,
          input_message,
          assistant_message,
          controlled_reply,
          context_before,
          context_after,
          runtime_metadata
        FROM ${schema}.helpchat_test_turns
        WHERE turn_id = $1
        LIMIT 1;
        `,
        [turnId],
      );

    const row =
      existing.rows[0];

    if (
      row &&
      row.session_id ===
        sessionId &&
      Number(row.sequence) ===
        Number(sequence) &&
      row.input_message ===
        inputMessage &&
      row.assistant_message ===
        assistantMessage &&
      JSON.stringify(
        row.controlled_reply ?? null
      ) ===
        JSON.stringify(
          controlledReply ?? null
        ) &&
      JSON.stringify(
        row.context_before ?? null
      ) ===
        JSON.stringify(
          contextBefore ?? null
        ) &&
      JSON.stringify(
        row.context_after ?? null
      ) ===
        JSON.stringify(
          contextAfter ?? null
        ) &&
      JSON.stringify(
        row.runtime_metadata ?? null
      ) ===
        JSON.stringify(
          runtimeMetadata ?? null
        )
    ) {
      return {
        status:
          "duplicate",
        turn:
          row,
      };
    }

    throw new Error(
      "TURN_ID_CONFLICT"
    );
  }

  async function createFeedback({
    sessionId,
    snapshotThroughTurnId,
    anchorTurnIds,
    category,
    reasonText,
    expectedText,
    reasonSource,
  }) {
    const requestedTurnIds =
      Array.from(
        new Set([
          snapshotThroughTurnId,
          ...(Array.isArray(
            anchorTurnIds,
          )
            ? anchorTurnIds
            : []),
        ]),
      );

    const existingTurns =
      await pool.query(
        `
        SELECT turn_id
        FROM ${schema}.helpchat_test_turns
        WHERE
          session_id = $1
          AND turn_id = ANY($2::text[]);
        `,
        [
          sessionId,
          requestedTurnIds,
        ],
      );

    const existingIds =
      new Set(
        existingTurns.rows.map(
          (row) =>
            row.turn_id,
        ),
      );

    const missing =
      requestedTurnIds.filter(
        (turnId) =>
          !existingIds.has(
            turnId,
          ),
      );

    if (missing.length > 0) {
      const error =
        new Error(
          "UNKNOWN_FEEDBACK_TURN"
        );

      error.turnIds =
        missing;

      throw error;
    }

    const result =
      await pool.query(
        `
        INSERT INTO ${schema}.helpchat_test_feedback (
          session_id,
          snapshot_through_turn_id,
          category,
          reason_text,
          expected_text,
          reason_source,
          anchor_turn_ids
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb
        )
        RETURNING
          feedback_id,
          session_id,
          snapshot_through_turn_id,
          review_status;
        `,
        [
          sessionId,
          snapshotThroughTurnId,
          category,
          reasonText,
          expectedText,
          reasonSource,
          JSON.stringify(
            anchorTurnIds || [],
          ),
        ],
      );

    return result.rows[0];
  }

  return {
    createSession,
    appendTurn,
    createFeedback,
  };
}
