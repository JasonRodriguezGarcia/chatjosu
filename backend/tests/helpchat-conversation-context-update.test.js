import assert from "node:assert/strict";
import test from "node:test";

import {
  createProvinceMatcher,
} from "../helpchat/conversation-context-enricher-v1.js";

import {
  persistResolvedActiveNeed,
  preferContextResolution,
  resolveSingleActiveOperationalTag,
  updateConversationContextV1,
} from "../helpchat/conversation-context-update-v1.js";

const PROVINCES = [
  {
    province_key: "GUIPUZCOA",
    name: "Gipuzkoa",
  },
  {
    province_key: "BURGOS",
    name: "Burgos",
  },
];

const TAGS = [
  {
    tag_id: 4,
    descripcion: "ALZHEIMER",
  },
  {
    tag_id: 16,
    descripcion:
      "ENFERMEDAD NEUROLÓGICA PARCKINSON",
  },
];

const provinceMatcher =
  createProvinceMatcher(
    PROVINCES
  );

function context({
  relationship = "madre",
  province = "Gipuzkoa",
  activeNeeds = ["ALZHEIMER"],
} = {}) {
  return {
    version: 1,
    subject: {
      relationship,
    },
    activeNeeds,
    currentGoal: null,
    facts: [],
    constraints: [],
    territory: {
      province,
      municipality: null,
    },
    resourcesShown: [],
  };
}

test(
  "follow-up Ella vive en Burgos actualiza territorio",
  () => {
    const result =
      updateConversationContextV1({
        conversationContext:
          context(),
        inputMessage:
          "Ella vive en Burgos",
        selectedProvince:
          "Gipuzkoa",
        provinceMatcher,
      });

    assert.equal(
      result.context
        .territory.province,
      "Burgos"
    );

    assert.equal(
      result.contextOnlyCandidate,
      true
    );
  }
);

test(
  "corrección territorial conserva necesidad previa",
  () => {
    const result =
      updateConversationContextV1({
        conversationContext:
          context({
            province: "Burgos",
          }),
        inputMessage:
          "Perdón, vive en Gipuzkoa",
        selectedProvince:
          "Burgos",
        provinceMatcher,
      });

    assert.equal(
      result.context
        .territory.province,
      "Gipuzkoa"
    );

    assert.deepEqual(
      result.context.activeNeeds,
      ["ALZHEIMER"]
    );

    assert.equal(
      result.contextOnlyCandidate,
      true
    );
  }
);

test(
  "corrección de relación sustituye madre por tía",
  () => {
    const result =
      updateConversationContextV1({
        conversationContext:
          context(),
        inputMessage:
          "Perdón, no es mi madre, es mi tía",
        selectedProvince:
          "Gipuzkoa",
        provinceMatcher,
      });

    assert.equal(
      result.context
        .subject.relationship,
      "tía"
    );

    assert.deepEqual(
      result.context.activeNeeds,
      ["ALZHEIMER"]
    );

    assert.equal(
      result.contextOnlyCandidate,
      true
    );
  }
);

test(
  "turno único atribuye Burgos al padre",
  () => {
    const result =
      updateConversationContextV1({
        conversationContext: null,
        inputMessage:
          "Mi padre tiene Parkinson, vive solo y casi no puede salir de casa en Burgos",
        selectedProvince:
          "Gipuzkoa",
        provinceMatcher,
      });

    assert.equal(
      result.context
        .subject.relationship,
      "padre"
    );

    assert.equal(
      result.context
        .territory.province,
      "Burgos"
    );

    assert.equal(
      result.contextOnlyCandidate,
      false
    );
  }
);

test(
  "resolución persiste necesidad activa",
  () => {
    const result =
      persistResolvedActiveNeed({
        conversationContext:
          context({
            activeNeeds: [],
          }),
        tag: TAGS[0],
      });

    assert.deepEqual(
      result.activeNeeds,
      ["ALZHEIMER"]
    );
  }
);

test(
  "resuelve una única necesidad operativa previa",
  () => {
    const tag =
      resolveSingleActiveOperationalTag({
        conversationContext:
          context(),
        tags: TAGS,
      });

    assert.equal(
      tag?.descripcion,
      "ALZHEIMER"
    );
  }
);

test(
  "context-only reutiliza necesidad si router aclara",
  () => {
    const update =
      updateConversationContextV1({
        conversationContext:
          context(),
        inputMessage:
          "Ella vive en Burgos",
        selectedProvince:
          "Gipuzkoa",
        provinceMatcher,
      });

    const result =
      preferContextResolution({
        understanding: {
          status:
            "needs_clarification",
          tag: null,
          provider: "embedding",
        },
        contextUpdate: update,
        activeTag: TAGS[0],
      });

    assert.equal(
      result.status,
      "resolved"
    );

    assert.equal(
      result.tag.descripcion,
      "ALZHEIMER"
    );

    assert.equal(
      result.provider,
      "context"
    );

    assert.equal(
      result.context
        .territory.province,
      "Burgos"
    );
  }
);

test(
  "nueva necesidad explícita anchor gana al contexto previo",
  () => {
    const update =
      updateConversationContextV1({
        conversationContext:
          context(),
        inputMessage:
          "Perdón, vive en Burgos y tiene Parkinson",
        selectedProvince:
          "Gipuzkoa",
        provinceMatcher,
      });

    const anchor = {
      status: "resolved",
      tag: TAGS[1],
      context:
        update.context,
      provider: "anchor",
    };

    const result =
      preferContextResolution({
        understanding: anchor,
        contextUpdate: update,
        activeTag: TAGS[0],
      });

    assert.equal(
      result.tag.descripcion,
      "ENFERMEDAD NEUROLÓGICA PARCKINSON"
    );

    assert.equal(
      result.provider,
      "anchor"
    );
  }
);
