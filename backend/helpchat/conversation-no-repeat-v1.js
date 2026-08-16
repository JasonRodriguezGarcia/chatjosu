function samePendingClarification(
  beforePending,
  afterPending,
) {
  if (
    !beforePending ||
    !afterPending
  ) {
    return false;
  }

  return (
    beforePending.node ===
      afterPending.node &&
    (
      beforePending.personId ||
      null
    ) ===
      (
        afterPending.personId ||
        null
      ) &&
    (
      beforePending.mode ||
      null
    ) ===
      (
        afterPending.mode ||
        null
      ) &&
    (
      beforePending.dimension ||
      null
    ) ===
      (
        afterPending.dimension ||
        null
      )
  );
}

export function assessNoRepeatV1({
  progress = null,
  beforePending = null,
  afterPending = null,
  clarificationPurpose = null,
  inputInsufficient = false,
  dimensionResolved = false,
} = {}) {
  if (
    progress?.progressed === true
  ) {
    return {
      status: "allow",
      reason:
        "conversation_progressed",
    };
  }

  if (
    !beforePending &&
    !afterPending
  ) {
    return {
      status: "allow",
      reason:
        "no_pending_clarification",
    };
  }

  /*
   * Si el pending cambió pero el detector
   * recibido dice que no hubo progreso,
   * no bloqueamos aquí.
   *
   * Esa incoherencia pertenece a la
   * observabilidad/detector, no debe
   * convertirse en un falso positivo
   * del guard.
   */
  if (
    !samePendingClarification(
      beforePending,
      afterPending,
    )
  ) {
    return {
      status: "allow",
      reason:
        "pending_state_changed",
    };
  }

  /*
   * Una dimensión ya resuelta nunca debe
   * volver a mantener exactamente la misma
   * aclaración pendiente.
   */
  if (dimensionResolved) {
    return {
      status:
        "block_repeat",
      reason:
        "dimension_already_resolved",
    };
  }

  /*
   * Una aclaración opcional no debe
   * convertirse en un bloqueo para el
   * usuario cuando este no puede aportar
   * más información.
   */
  if (
    clarificationPurpose ===
      "optional_refinement" &&
    inputInsufficient
  ) {
    return {
      status:
        "block_repeat",
      reason:
        "optional_refinement_unavailable",
    };
  }

  /*
   * Para una aclaración requerida aún no
   * resuelta, una respuesta claramente
   * insuficiente puede justificar que la
   * aclaración siga pendiente.
   *
   * Esto NO significa que pueda repetirse
   * indefinidamente: esa política temporal
   * queda fuera de V1.
   */
  if (
    clarificationPurpose ===
      "required" &&
    inputInsufficient
  ) {
    return {
      status: "allow",
      reason:
        "required_clarification_still_unresolved",
    };
  }

  /*
   * Si el usuario sí aportó una respuesta
   * material y acabamos exactamente en el
   * mismo estado conversacional, la
   * repetición deja de ser aceptable.
   */
  if (!inputInsufficient) {
    return {
      status:
        "block_repeat",
      reason:
        "informative_answer_did_not_advance",
    };
  }

  /*
   * Política desconocida: conservadora.
   * El guard no inventa una regla de salida.
   */
  return {
    status: "allow",
    reason:
      "no_repeat_rule_not_applicable",
  };
}
