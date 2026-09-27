import test from "node:test";
import assert from "node:assert/strict";

import {
  enrichConversationContextV1,
  extractRelationship,
} from "../helpchat/conversation-context-enricher-v1.js";

test(
  "extrae relación familiar explícita",
  () => {
    assert.equal(
      extractRelationship(
        "Necesito ayuda para mi madre"
      ),
      "madre"
    );

    assert.equal(
      extractRelationship(
        "Mi tío está perdiendo la cabeza"
      ),
      "tío"
    );
  }
);

test(
  "no inventa relación",
  () => {
    assert.equal(
      extractRelationship(
        "Necesito orientación"
      ),
      null
    );
  }
);

test(
  "enriquece Context V1 con relación y provincia seleccionada",
  () => {
    const context =
      enrichConversationContextV1({
        conversationContext: null,
        inputMessage:
          "Necesito ayuda para mi madre",
        selectedProvince:
          "Burgos",
      });

    assert.equal(
      context.version,
      1
    );

    assert.equal(
      context.subject.relationship,
      "madre"
    );

    assert.equal(
      context.territory.province,
      "Burgos"
    );
  }
);

test(
  "preserva contexto previo no sustituido",
  () => {
    const context =
      enrichConversationContextV1({
        conversationContext: {
          version: 1,
          subject: {
            relationship:
              "padre",
          },
          activeNeeds: [
            "salud mental",
          ],
          currentGoal:
            "buscar apoyo",
          facts: [
            "vive solo",
          ],
          constraints: [],
          territory: {
            province:
              "Gipuzkoa",
            municipality: null,
          },
          resourcesShown: [],
        },

        inputMessage:
          "Seguimos buscando ayuda",

        selectedProvince:
          "Gipuzkoa",
      });

    assert.equal(
      context.subject.relationship,
      "padre"
    );

    assert.deepEqual(
      context.activeNeeds,
      ["salud mental"]
    );

    assert.deepEqual(
      context.facts,
      ["vive solo"]
    );
  }
);

const PROVINCES = [
  {
    province_key: "GUIPUZCOA",
    name: "Gipuzkoa",
  },
  {
    province_key: "BURGOS",
    name: "Burgos",
  },
  {
    province_key: "ALAVA",
    name: "Araba/Álava",
  },
  {
    province_key: "VIZCAYA",
    name: "Bizkaia",
  },
  {
    province_key: "A CORUNA",
    name: "Coruña, A",
  },
];

test(
  "crea matcher desde catálogo canónico",
  async () => {
    const {
      createProvinceMatcher,
    } = await import(
      "../helpchat/conversation-context-enricher-v1.js"
    );

    const matcher =
      createProvinceMatcher(
        PROVINCES
      );

    assert.equal(
      matcher("Burgos"),
      "Burgos"
    );

    assert.equal(
      matcher("Gipuzkoa"),
      "Gipuzkoa"
    );

    assert.equal(
      matcher("Guipuzcoa"),
      "Gipuzkoa"
    );

    assert.equal(
      matcher("Alava"),
      "Araba/Álava"
    );

    assert.equal(
      matcher("Bizkaia"),
      "Bizkaia"
    );

    assert.equal(
      matcher("Vizcaya"),
      "Bizkaia"
    );
  }
);

test(
  "no interpreta artículos o preposiciones como territorio",
  async () => {
    const {
      createProvinceMatcher,
    } = await import(
      "../helpchat/conversation-context-enricher-v1.js"
    );

    const matcher =
      createProvinceMatcher(
        PROVINCES
      );

    assert.equal(
      matcher("A Coruña"),
      "Coruña, A"
    );

    assert.equal(
      matcher("Coruña"),
      "Coruña, A"
    );

    assert.equal(
      matcher(
        "a mi hermano le han detectado una mancha en el pulmón"
      ),
      null
    );
  }
);

test(
  "territorio explícito del destinatario gana al selector",
  async () => {
    const {
      createProvinceMatcher,
    } = await import(
      "../helpchat/conversation-context-enricher-v1.js"
    );

    const matcher =
      createProvinceMatcher(
        PROVINCES
      );

    const context =
      enrichConversationContextV1({
        conversationContext: {
          version: 1,
          subject: {
            relationship: null,
          },
          activeNeeds: [],
          currentGoal: null,
          facts: [],
          constraints: [],
          territory: {
            province: "Gipuzkoa",
            municipality: null,
          },
          resourcesShown: [],
        },

        inputMessage:
          "Pero busco ayuda para mi madre que vive en Burgos",

        selectedProvince:
          "Gipuzkoa",

        provinceMatcher:
          matcher,
      });

    assert.equal(
      context.subject.relationship,
      "madre"
    );

    assert.equal(
      context.territory.province,
      "Burgos"
    );
  }
);

test(
  "ubicación explícita del interlocutor no sustituye territorio por texto",
  async () => {
    const {
      createProvinceMatcher,
    } = await import(
      "../helpchat/conversation-context-enricher-v1.js"
    );

    const matcher =
      createProvinceMatcher(
        PROVINCES
      );

    const context =
      enrichConversationContextV1({
        conversationContext: null,

        inputMessage:
          "Yo vivo en Burgos",

        selectedProvince:
          "Gipuzkoa",

        provinceMatcher:
          matcher,
      });

    assert.equal(
      context.subject.relationship,
      null
    );

    assert.equal(
      context.territory.province,
      "Gipuzkoa"
    );
  }
);

test(
  "mantiene destino previo cuando no aparece uno explícito distinto",
  async () => {
    const {
      createProvinceMatcher,
    } = await import(
      "../helpchat/conversation-context-enricher-v1.js"
    );

    const matcher =
      createProvinceMatcher(
        PROVINCES
      );

    const context =
      enrichConversationContextV1({
        conversationContext: {
          version: 1,
          subject: {
            relationship:
              "madre",
          },
          activeNeeds: [],
          currentGoal: null,
          facts: [],
          constraints: [],
          territory: {
            province: "Burgos",
            municipality: null,
          },
          resourcesShown: [],
        },

        inputMessage:
          "Seguimos buscando opciones",

        selectedProvince:
          "Burgos",

        provinceMatcher:
          matcher,
      });

    assert.equal(
      context.territory.province,
      "Burgos"
    );
  }
);
