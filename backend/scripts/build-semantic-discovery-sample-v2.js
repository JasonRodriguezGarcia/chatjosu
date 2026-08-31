import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  classifyAssociationRelevance,
} from "./lib/association-relevance-v1.js";

const ROOT = process.cwd();

const SOURCE_ID =
  "euskadi_registro_asociaciones";

const RAW_PATH = path.join(
  ROOT,
  "data/acquisition",
  SOURCE_ID,
  "raw/asociaciones.json"
);

const OUTPUT_DIR = path.join(
  ROOT,
  "data/curation/semantic/discovery"
);

const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  "euskadi-sample-v2.jsonl"
);

const REPORT_PATH = path.join(
  OUTPUT_DIR,
  "euskadi-sample-v2.report.json"
);

const V1_PATH = path.join(
  OUTPUT_DIR,
  "euskadi-sample-v1.jsonl"
);

const TARGET = 1200;

const RELEVANCE_STATUSES = [
  "direct_relevance",
  "contextual_relevance",
  "needs_review",
  "out_of_scope",
];

/*
 * Categorías especialmente útiles para
 * HelpChat o suficientemente raras como
 * para que no queramos depender del azar.
 */
const PRIORITY_GOAL_TYPES = new Set([
  "Ayuda a Enfermos",
  "Ayuda a Minusválidos",
  "Ayuda a Disminuídos Psíquicos",
  "Ayuda a Ancianos",
  "Ayuda a Drogadictos",
  "Ayuda a Alcohólicos",
  "De Padres de Enfermos",
  "Ayuda a Grupos Marginados",
  "Ayuda a Otros Colectivos",
  "Promoción del Menor",
  "Promoción de la Mujer",
  "Promoción de Empleo",
  "Tercera Edad",
  "Otros Colectivos",
  "Familiarista",
  "De Divorciados-as",
  "De Viudos-as",
  "Madres Solteras",
  "Ayuda a Accid/Gru. Rescate",
  "Consumidores",
]);

function clean(value) {
  const text =
    String(value ?? "").trim();

  return text || null;
}

function canonicalTerritory(value) {
  const text =
    clean(value);

  if (!text) {
    return "UNKNOWN";
  }

  const normalized =
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleUpperCase("es-ES");

  if (
    normalized === "BIZKAIA"
  ) {
    return "BIZKAIA";
  }

  if (
    normalized === "GIPUZKOA"
  ) {
    return "GIPUZKOA";
  }

  if (
    normalized === "ARABA/ALAVA" ||
    normalized === "ARABA" ||
    normalized === "ALAVA"
  ) {
    return "ALAVA";
  }

  return normalized;
}

function hashScore(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function descriptionBucket(text) {
  const size =
    String(text ?? "").length;

  if (size === 0) {
    return "empty";
  }

  if (size < 250) {
    return "short";
  }

  if (size < 1000) {
    return "medium";
  }

  return "long";
}

function relevanceFor(row) {
  return classifyAssociationRelevance({
    name:
      clean(
        row.recName ||
        row.documentName
      ),

    categories: [
      row.asoSection,
      row.asoSorting,
      row.asoGoalType,
    ],

    text: [
      row.documentDescription &&
      row.documentDescription !==
        row.recName
        ? row.documentDescription
        : null,
      row.recGoal,
    ],
  });
}

function semanticText(row) {
  return [
    clean(row.documentDescription),
    clean(row.recGoal),
  ]
    .filter(Boolean)
    .filter(
      (value, index, array) =>
        array.indexOf(value) === index
    )
    .join("\n\n") || null;
}

const raw =
  JSON.parse(
    fs.readFileSync(
      RAW_PATH,
      "utf8"
    )
  );

const records =
  raw.map(
    (row, index) => {
      const recordId =
        clean(row.recNumRec);

      const candidateId =
        recordId
          ? `${SOURCE_ID}:${recordId}`
          : `${SOURCE_ID}:row-${index}`;

      const relevance =
        relevanceFor(row);

      const description =
        semanticText(row);

      return {
        candidate_id:
          candidateId,

        source_record_id:
          recordId,

        source_row_index:
          index,

        name:
          clean(
            row.recName ||
            row.documentName
          ),

        description,

        source_categories: {
          section:
            clean(row.asoSection),

          sorting:
            clean(row.asoSorting),

          goal_type:
            clean(row.asoGoalType),
        },

        scope:
          clean(row.asoScope),

        territory:
          canonicalTerritory(
            row.territory
          ),

        municipality:
          clean(row.municipality),

        deterministic_relevance:
          relevance,

        discovery_strata: {
          relevance:
            relevance.status,

          territory:
            canonicalTerritory(
              row.territory
            ),

          sorting:
            clean(row.asoSorting)
            ?? "UNKNOWN",

          goal_type:
            clean(row.asoGoalType)
            ?? "UNKNOWN",

          description_length:
            descriptionBucket(
              description
            ),
        },
      };
    }
  );

const selected = [];
const selectedIds =
  new Set();

function add(row, reason) {
  if (!row) {
    return false;
  }

  if (
    selectedIds.has(
      row.candidate_id
    )
  ) {
    return false;
  }

  selectedIds.add(
    row.candidate_id
  );

  selected.push({
    ...row,
    discovery_selection_reason:
      reason,
  });

  return true;
}

function ordered(rows, salt) {
  return [...rows].sort(
    (a, b) =>
      hashScore(
        `${salt}:${a.candidate_id}`
      ).localeCompare(
        hashScore(
          `${salt}:${b.candidate_id}`
        )
      )
  );
}

/*
 * Phase 1.
 *
 * Todos los goal types oficiales,
 * intentando cubrir las cuatro clases
 * deterministas.
 */
const goalTypes =
  [
    ...new Set(
      records.map(
        row =>
          row.discovery_strata
            .goal_type
      )
    ),
  ].sort();

for (const goal of goalTypes) {
  const goalRows =
    records.filter(
      row =>
        row.discovery_strata
          .goal_type === goal
    );

  for (
    const status
    of RELEVANCE_STATUSES
  ) {
    const candidates =
      ordered(
        goalRows.filter(
          row =>
            row
              .deterministic_relevance
              .status === status
        ),
        `goal:${goal}:${status}`
      );

    if (candidates.length) {
      add(
        candidates[0],
        "goal_type_relevance_coverage"
      );
    }
  }
}

/*
 * Phase 2.
 *
 * Refuerzo de categorías de especial
 * valor HelpChat / rareza.
 *
 * Buscamos combinación:
 * goal + relevance + territory +
 * description length.
 */
const priorityRows =
  records.filter(
    row =>
      PRIORITY_GOAL_TYPES.has(
        row.discovery_strata
          .goal_type
      )
  );

const priorityCells =
  new Map();

for (const row of priorityRows) {
  const key = [
    row.discovery_strata
      .goal_type,
    row.discovery_strata
      .relevance,
    row.discovery_strata
      .territory,
    row.discovery_strata
      .description_length,
  ].join("|");

  if (
    !priorityCells.has(key)
  ) {
    priorityCells.set(
      key,
      []
    );
  }

  priorityCells
    .get(key)
    .push(row);
}

for (
  const [key, rows]
  of [...priorityCells.entries()]
    .sort(
      (a, b) =>
        a[0].localeCompare(
          b[0]
        )
    )
) {
  const candidates =
    ordered(
      rows,
      `priority:${key}`
    );

  add(
    candidates[0],
    "priority_goal_diversity"
  );

  if (
    selected.length >= 600
  ) {
    break;
  }
}

/*
 * Phase 3.
 *
 * Balance aproximado de 300 por
 * relevancia determinista.
 */
for (
  const status
  of RELEVANCE_STATUSES
) {
  const current =
    selected.filter(
      row =>
        row
          .deterministic_relevance
          .status === status
    ).length;

  const needed =
    Math.max(
      0,
      300 - current
    );

  if (!needed) {
    continue;
  }

  const candidates =
    ordered(
      records.filter(
        row =>
          row
            .deterministic_relevance
            .status === status &&
          !selectedIds.has(
            row.candidate_id
          )
      ),
      `balance:${status}`
    );

  for (
    const row of candidates.slice(
      0,
      needed
    )
  ) {
    add(
      row,
      "relevance_balance"
    );
  }
}

/*
 * Phase 4.
 *
 * Si por superposición de phases
 * faltasen filas, completar sin sesgo
 * adicional mediante hash estable.
 */
if (
  selected.length < TARGET
) {
  const remaining =
    ordered(
      records.filter(
        row =>
          !selectedIds.has(
            row.candidate_id
          )
      ),
      "final-fill"
    );

  for (const row of remaining) {
    add(
      row,
      "stable_fill"
    );

    if (
      selected.length >= TARGET
    ) {
      break;
    }
  }
}

/*
 * Si el enriquecimiento de categorías
 * hubiese superado 1200, conservamos
 * toda la cobertura de Phase 1 primero
 * y truncamos establemente el resto.
 *
 * Con el registro actual no debería
 * ocurrir, pero dejamos el contrato
 * explícito.
 */
let finalRows = selected;

if (
  finalRows.length > TARGET
) {
  const mandatory =
    finalRows.filter(
      row =>
        row.discovery_selection_reason ===
        "goal_type_relevance_coverage"
    );

  const mandatoryIds =
    new Set(
      mandatory.map(
        row =>
          row.candidate_id
      )
    );

  const optional =
    ordered(
      finalRows.filter(
        row =>
          !mandatoryIds.has(
            row.candidate_id
          )
      ),
      "truncate"
    );

  finalRows = [
    ...mandatory,
    ...optional.slice(
      0,
      Math.max(
        0,
        TARGET -
        mandatory.length
      )
    ),
  ];
}

finalRows =
  ordered(
    finalRows,
    "final-order"
  );

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);

fs.writeFileSync(
  OUTPUT_PATH,
  finalRows
    .map(
      row =>
        JSON.stringify(row)
    )
    .join("\n") +
    "\n",
  "utf8"
);

const countBy = (
  rows,
  getter
) => {
  const counts = {};

  for (const row of rows) {
    const key =
      getter(row);

    counts[key] =
      (
        counts[key]
        ?? 0
      ) + 1;
  }

  return Object.fromEntries(
    Object.entries(counts)
      .sort(
        (a, b) =>
          b[1] - a[1] ||
          a[0].localeCompare(b[0])
      )
  );
};

const v1Ids =
  fs.existsSync(
    V1_PATH
  )
    ? new Set(
        fs.readFileSync(
          V1_PATH,
          "utf8"
        )
          .split(/\r?\n/)
          .filter(Boolean)
          .map(
            line =>
              JSON.parse(line)
                .candidate_id
          )
      )
    : new Set();

const finalIds =
  new Set(
    finalRows.map(
      row =>
        row.candidate_id
    )
  );

let overlap = 0;

for (const id of finalIds) {
  if (v1Ids.has(id)) {
    overlap += 1;
  }
}

const sampledGoalTypes =
  new Set(
    finalRows.map(
      row =>
        row.discovery_strata
          .goal_type
    )
  );

const report = {
  format_version: 1,
  discovery_version: "2.0",
  source_id:
    SOURCE_ID,
  source_rows:
    records.length,
  sample_rows:
    finalRows.length,
  sample_percentage:
    Number(
      (
        finalRows.length /
        records.length *
        100
      ).toFixed(2)
    ),
  relevance:
    countBy(
      finalRows,
      row =>
        row
          .deterministic_relevance
          .status
    ),
  territories:
    countBy(
      finalRows,
      row =>
        row.discovery_strata
          .territory
    ),
  sorting:
    countBy(
      finalRows,
      row =>
        row.discovery_strata
          .sorting
    ),
  description_lengths:
    countBy(
      finalRows,
      row =>
        row.discovery_strata
          .description_length
    ),
  goal_types: {
    source_distinct:
      goalTypes.length,
    sample_distinct:
      sampledGoalTypes.size,
    missing:
      goalTypes.filter(
        value =>
          !sampledGoalTypes.has(
            value
          )
      ),
  },
  selection_reasons:
    countBy(
      finalRows,
      row =>
        row
          .discovery_selection_reason
    ),
  v1_comparison: {
    v1_rows:
      v1Ids.size,
    overlap,
    new_in_v2:
      finalRows.length -
      overlap,
    overlap_percentage:
      finalRows.length
        ? Number(
            (
              overlap /
              finalRows.length *
              100
            ).toFixed(2)
          )
        : 0,
  },
};

fs.writeFileSync(
  REPORT_PATH,
  JSON.stringify(
    report,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  `SOURCE_ROWS=${records.length}`
);

console.log(
  `SAMPLE_ROWS=${finalRows.length}`
);

console.log(
  `GOAL_TYPES=${sampledGoalTypes.size}/${goalTypes.length}`
);

console.log(
  `V1_OVERLAP=${overlap}`
);

console.log(
  `NEW_IN_V2=${finalRows.length - overlap}`
);

console.log(
  `OUTPUT=${path.relative(ROOT, OUTPUT_PATH)}`
);

console.log(
  `REPORT=${path.relative(ROOT, REPORT_PATH)}`
);
