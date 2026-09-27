import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildAssociationFunctionEvidenceGateV1,
  FUNCTION_EVIDENCE_GATED_KEYS_V1,
} from "../scripts/lib/association-function-evidence-gate-v1.js";

function keys(result) {
  return new Set(
    result.candidates.map(
      row => row.key
    )
  );
}

test(
  "gate soporta exactamente las funciones del vocabulario canónico",
  () => {
    const input =
      JSON.parse(
        fs.readFileSync(
          "data/curation/semantic/discovery/euskadi-single-benchmark-6-v2.json",
          "utf8"
        )
      );

    assert.deepEqual(
      new Set(
        FUNCTION_EVIDENCE_GATED_KEYS_V1
      ),
      new Set(
        input.allowed.functions
      )
    );
  }
);

test(
  "difusión musical no inventa funciones asistenciales",
  () => {
    const result =
      buildAssociationFunctionEvidenceGateV1({
        description:
          "Promoción y difusión de la música Jazz.",
      });

    assert.deepEqual(
      [...keys(result)],
      []
    );
  }
);

test(
  "orientar y asesorar producen evidencia funcional",
  () => {
    const result =
      buildAssociationFunctionEvidenceGateV1({
        description:
          "Orientar a personas migrantes y asesorar a sus asociaciones.",
      });

    const found =
      keys(result);

    assert.ok(
      found.has(
        "ORIENTACION"
      )
    );

    assert.ok(
      found.has(
        "ASESORAMIENTO"
      )
    );
  }
);

test(
  "investigación explícita produce candidato",
  () => {
    const result =
      buildAssociationFunctionEvidenceGateV1({
        description:
          "Investigación del trastorno mental severo y estudios epidemiológicos.",
      });

    assert.ok(
      keys(result).has(
        "INVESTIGACION"
      )
    );
  }
);

test(
  "ocio genérico no equivale a ocio inclusivo",
  () => {
    const result =
      buildAssociationFunctionEvidenceGateV1({
        description:
          "Organizar actividades de ocio y tiempo libre.",
      });

    assert.equal(
      keys(result).has(
        "OCIO_INCLUSIVO"
      ),
      false
    );
  }
);

test(
  "funciones sociales explícitas se detectan",
  () => {
    const result =
      buildAssociationFunctionEvidenceGateV1({
        description:
          "Ofrecemos apoyo psicológico, ayuda económica, "
          + "atención domiciliaria, transporte adaptado, "
          + "defensa de derechos y recaudación de fondos.",
      });

    const found =
      keys(result);

    for (const key of [
      "APOYO_PSICOLOGICO",
      "AYUDA_ECONOMICA",
      "ATENCION_DOMICILIARIA",
      "TRANSPORTE",
      "DEFENSA_DERECHOS",
      "RECAUDACION_FONDOS",
    ]) {
      assert.ok(
        found.has(key),
        key
      );
    }
  }
);
