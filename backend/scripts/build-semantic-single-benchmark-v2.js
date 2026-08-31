import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const PROBE_PATH = path.join(
  ROOT,
  "data/curation/semantic/discovery/euskadi-probe-24-v1.json"
);

const OUTPUT_PATH = path.join(
  ROOT,
  "data/curation/semantic/discovery/euskadi-single-benchmark-6-v2.json"
);

const input =
  JSON.parse(
    fs.readFileSync(
      PROBE_PATH,
      "utf8"
    )
  );

const wanted = [
  "euskadi_registro_asociaciones:AS.R.P.B.00900",
  "euskadi_registro_asociaciones:AS/G/19482/2015",
  "euskadi_registro_asociaciones:AS/B/01758/1989",
  "euskadi_registro_asociaciones:AS/B/23447/2020",
  "euskadi_registro_asociaciones:AS/A/26924/2026",
  "euskadi_registro_asociaciones:AS/B/22867/2019"
];

const byId =
  new Map(
    input.records.map(
      row => [
        row.candidate_id,
        row
      ]
    )
  );

const records =
  wanted.map(
    id => {
      const row =
        byId.get(id);

      if (!row) {
        throw new Error(
          `MISSING_PROBE_RECORD:${id}`
        );
      }

      const categories =
        row.source_categories ?? {};

      return {
        candidate_id:
          row.candidate_id,

        fields: {
          N1:
            row.name ?? null,

          C1:
            categories.section ?? null,

          C2:
            categories.sorting ?? null,

          C3:
            categories.goal_type ?? null,

          S1:
            row.scope ?? null,

          T1:
            row.territory ?? null,

          M1:
            row.municipality ?? null,

          D1:
            row.description ?? null
        }
      };
    }
  );

const output = {
  format_version: 2,

  allowed:
    input.allowed,

  records
};

fs.writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(
    output,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  `RECORDS=${records.length}`
);

for (const row of records) {
  console.log(
    row.candidate_id,
    "|",
    row.fields.N1
  );
}

console.log(
  `OUTPUT=${path.relative(ROOT, OUTPUT_PATH)}`
);
