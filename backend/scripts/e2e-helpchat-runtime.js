import { once } from "node:events";

import {
  app,
  pool,
} from "../index.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(
      `ASSERT_FAIL: ${message}`
    );
  }
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("es-ES");
}

function classifierForTests({
  inputMessage,
  tags,
}) {
  if (
    inputMessage ===
    "TEST_PROVIDER_RATE_LIMIT"
  ) {
    const error = new Error(
      "Proveedor limitado en E2E."
    );

    error.providerStatus = 429;
    error.code =
      "AI_PROVIDER_RATE_LIMITED";
    error.retryAfter = "8";

    throw error;
  }

  const prefix = "TEST_TAG:";

  assert(
    inputMessage.startsWith(prefix),
    "Consulta E2E sin TEST_TAG"
  );

  const requestedTag = normalize(
    inputMessage.slice(prefix.length)
  );

  const tag = tags.find(
    candidate =>
      normalize(candidate.descripcion) ===
      requestedTag
  );

  assert(
    tag,
    `Tag E2E inexistente: ${requestedTag}`
  );

  return Promise.resolve(tag);
}

app.locals.classifyHelpchatTag =
  classifierForTests;

/*
 * El E2E prueba búsqueda y HTTP con BD real,
 * pero no ensucia tags_historico.
 */
app.locals.tagSaving =
  async (tagText) => ({
    historyId: "e2e",
    tagId: null,
    descripcion: tagText,
  });

async function request(baseUrl, {
  tag,
  province,
  rawMessage,
}) {
  const response = await fetch(
    `${baseUrl}/api/v1/helpchat/iacall`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        inputMessage:
          rawMessage ||
          `TEST_TAG:${tag}`,
        selectedProvincia: province,
      }),
    }
  );

  const body = await response.json();

  return {
    status: response.status,
    retryAfter:
      response.headers.get(
        "retry-after"
      ),
    body,
  };
}

async function main() {
  const server = app.listen(
    0,
    "127.0.0.1"
  );

  await once(server, "listening");

  const address = server.address();

  const baseUrl =
    `http://127.0.0.1:${address.port}`;

  try {
    /*
     * LOCAL RICH:
     * mezcla local + vecino + nacional.
     */
    const local = await request(
      baseUrl,
      {
        tag: "SALUD MENTAL",
        province: "Álava",
      }
    );

    assert(
      local.status === 200,
      "LOCAL debe responder 200"
    );

    assert(
      local.body.localCount >= 1,
      "LOCAL sin resultado local"
    );

    assert(
      local.body.associations.some(
        item =>
          item.resultScope === "local"
      ),
      "LOCAL sin resultScope=local"
    );

    console.log("E2E_LOCAL=PASS");

    /*
     * NEIGHBOR.
     */
    const neighbor = await request(
      baseUrl,
      {
        tag: "ALZHEIMER",
        province: "Álava",
      }
    );

    assert(
      neighbor.status === 200,
      "NEIGHBOR debe responder 200"
    );

    assert(
      neighbor.body.fallbackType ===
        "neighbor_province",
      "Fallback vecino incorrecto"
    );

    assert(
      neighbor.body.associations.some(
        item =>
          item.resultScope ===
          "neighbor_province"
      ),
      "NEIGHBOR sin resultScope"
    );

    console.log(
      "E2E_NEIGHBOR=PASS"
    );

    /*
     * NATIONAL.
     */
    const national = await request(
      baseUrl,
      {
        tag: "AUTISMO",
        province: "Almería",
      }
    );

    assert(
      national.status === 200,
      "NATIONAL debe responder 200"
    );

    assert(
      national.body.fallbackType ===
        "national",
      "Fallback nacional incorrecto"
    );

    assert(
      national.body.associations.some(
        item =>
          item.resultScope === "national"
      ),
      "NATIONAL sin resultScope"
    );

    console.log(
      "E2E_NATIONAL=PASS"
    );

    /*
     * NO RESULTS.
     */
    const empty = await request(
      baseUrl,
      {
        tag: "ACOGIMIENTO FAMILIA",
        province: "Albacete",
      }
    );

    assert(
      empty.status === 200,
      "NO_RESULTS debe responder 200"
    );

    assert(
      Array.isArray(
        empty.body.associations
      ) &&
      empty.body.associations.length === 0,
      "NO_RESULTS devolvió recursos"
    );

    console.log(
      "E2E_NO_RESULTS=PASS"
    );

    /*
     * Contrato de proveedor limitado.
     */
    const limited = await request(
      baseUrl,
      {
        province: "Álava",
        rawMessage:
          "TEST_PROVIDER_RATE_LIMIT",
      }
    );

    assert(
      limited.status === 503,
      "Provider 429 debe mapear a 503"
    );

    assert(
      limited.body.code ===
        "AI_PROVIDER_RATE_LIMITED",
      "Código provider incorrecto"
    );

    assert(
      limited.body.providerStatus ===
        429,
      "providerStatus incorrecto"
    );

    assert(
      limited.retryAfter === "8",
      "Retry-After no propagado"
    );

    console.log(
      "E2E_PROVIDER_LIMIT=PASS"
    );

    /*
     * Timings del camino exitoso.
     */
    for (const result of [
      local,
      neighbor,
      national,
      empty,
    ]) {
      assert(
        Number.isFinite(
          result.body.timings
            ?.classificationMs
        ),
        "classificationMs ausente"
      );

      assert(
        Number.isFinite(
          result.body.timings
            ?.searchMs
        ),
        "searchMs ausente"
      );

      assert(
        Number.isFinite(
          result.body.timings
            ?.historyMs
        ),
        "historyMs ausente"
      );

      assert(
        Number.isFinite(
          result.body.timings
            ?.totalMs
        ),
        "totalMs ausente"
      );
    }

    console.log(
      "E2E_TIMINGS=PASS"
    );

    console.log(
      "HELPCHAT_BACKEND_E2E=PASS"
    );
  } finally {
    await new Promise(
      (resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    );

    await pool.end();
  }
}

main().catch(error => {
  console.error(
    "HELPCHAT_BACKEND_E2E=FAIL",
    error
  );

  process.exitCode = 1;
});
