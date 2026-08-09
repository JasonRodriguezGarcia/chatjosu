import express from "express";
import cors from 'cors';
import {
  findAssociationsForHelpchat,
} from "./services/helpchat-association-service.js";
import {
  classifyHelpchatTag,
} from "./services/helpchat-gemini-service.js";
// import { tags } from "./data/tags.js";
import dotenv from 'dotenv';
dotenv.config();
import pool from './db-pg.js';

const SCHEMA_NAME = process.env.SCHEMA_NAME;
const GEMINI_MODEL = process.env.GEMINI_MODEL;

if (!GEMINI_MODEL || !/^[A-Za-z0-9._-]+$/.test(GEMINI_MODEL)) {
  throw new Error(
    "GEMINI_MODEL must contain only letters, numbers, dots, underscores, and hyphens."
  );
}

const GEMINI_GENERATE_CONTENT_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/` +
  `${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
if (!SCHEMA_NAME || !/^[A-Za-z0-9_]+$/.test(SCHEMA_NAME)) {
  throw new Error("SCHEMA_NAME must contain only letters, numbers, and underscores.");
}

const app = express();
const PORT = process.env.PORT || 5000;

function positiveIntegerEnv(name, fallback) {
    const raw = process.env[name];

    if (raw === undefined || raw === "") {
        return fallback;
    }

    const value = Number(raw);

    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(
            `${name} must be a positive integer.`
        );
    }

    return value;
}

const HELPCHAT_AI_TIMEOUT_MS =
    positiveIntegerEnv(
        "HELPCHAT_AI_TIMEOUT_MS",
        12000
    );

const HELPCHAT_STORE_INPUT_MESSAGE =
    String(
        process.env.HELPCHAT_STORE_INPUT_MESSAGE ||
        "false"
    ).toLowerCase() === "true";

const HELPCHAT_JSON_LIMIT =
    process.env.HELPCHAT_JSON_LIMIT?.trim() ||
    "16kb";

const HELPCHAT_RATE_LIMIT_WINDOW_MS =
    positiveIntegerEnv(
        "HELPCHAT_RATE_LIMIT_WINDOW_MS",
        60000
    );

const HELPCHAT_RATE_LIMIT_MAX =
    positiveIntegerEnv(
        "HELPCHAT_RATE_LIMIT_MAX",
        20
    );

const allowedOriginsValue = process.env.ALLOWED_ORIGINS?.trim();
if (!allowedOriginsValue) {
  throw new Error("ALLOWED_ORIGINS is required.");
}

const ALLOWED_ORIGINS = allowedOriginsValue
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (ALLOWED_ORIGINS.length === 0) {
  throw new Error("ALLOWED_ORIGINS must contain at least one origin.");
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is required.");
}

app.locals.GEMINI_API_KEY = GEMINI_API_KEY;

//
// functions
//
async function datos() {
    try {
        const result = await pool.query(`
            SELECT DISTINCT
                t.tag_id,
                t.descripcion
            FROM ${SCHEMA_NAME}.tags AS t
            JOIN ${SCHEMA_NAME}.association_tags AS at
              ON at.tag_id = t.tag_id
            JOIN ${SCHEMA_NAME}.associations AS a
              ON a.association_id = at.association_id
             AND a.active = TRUE
            ORDER BY t.descripcion;
        `)
        
        console.log("Datos tags: result.rows")
        return result.rows

    } catch (err) {
        console.error('Error recuperando datos iniciales:', err.message);
        throw err;
    }
}

async function tagSaving(tagText, inputMessage, userId = null) {
    if (!tagText) {
        console.warn("No se recibió un tag válido; no se guardará histórico.");
        return null;
    }

    const normalizedTagText = tagText.trim().toLocaleUpperCase("es-ES");

    const tag = tags.find((candidate) =>
        candidate.descripcion
            .trim()
            .toLocaleUpperCase("es-ES") === normalizedTagText
    );

    if (!tag) {
        console.warn("Tag desconocido; no se guardará histórico:", tagText);
        return null;
    }

    const response = await pool.query(
        `
        INSERT INTO ${SCHEMA_NAME}.tags_historico
            (fecha, input_message, tag_id, user_id)
        VALUES
            (current_timestamp, $1, $2, $3)
        RETURNING tags_historico_id;
        `,
        [inputMessage, tag.tag_id, userId]
    );

    const historyId = response.rows[0].tags_historico_id;

    console.log("Tag guardado:", {
        historyId,
        tagId: tag.tag_id,
        descripcion: tag.descripcion,
    });

    return {
        historyId,
        tagId: tag.tag_id,
        descripcion: tag.descripcion,
    };
}


const datosIniciales = await datos()
const tags = !datosIniciales ? [] : datosIniciales
console.log(`Tags operativos cargados: ${tags.length}`)

// Middleware

// Configurar cors
const corsOptions = {
  origin: ALLOWED_ORIGINS,
};

app.use(cors(corsOptions));
app.use(express.json({
    limit: HELPCHAT_JSON_LIMIT,
}));

// API Route Example
app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from Express!" });
});

// '/api/provincias' es viejo anterior a chat4
// '/api/v1/helpchat/provincias' es nuevo
app.get(['/api/provincias', '/api/v1/helpchat/provincias'], async (req, res) => {
  try {
    const response = await fetch('https://datos.gob.es/apidata/nti/territory/Province?_pageSize=100&_sort=label');
    const data = await response.json();
    // console.log(data.result.items)
    res.json(data.result.items);
  } catch (err) {
    console.log("Error al obtener provincias: ", err.message);
    res.status(500).json({ error: 'Error al obtener provincias' });
  }
});

const helpchatRateLimitBuckets = new Map();

function helpchatRateLimit(req, res, next) {
    const now = Date.now();
    const key = req.ip || "unknown";

    let bucket =
        helpchatRateLimitBuckets.get(key);

    if (
        !bucket ||
        now - bucket.windowStartedAt >=
            HELPCHAT_RATE_LIMIT_WINDOW_MS
    ) {
        bucket = {
            windowStartedAt: now,
            count: 0,
        };

        helpchatRateLimitBuckets.set(
            key,
            bucket
        );
    }

    bucket.count += 1;

    if (
        bucket.count >
        HELPCHAT_RATE_LIMIT_MAX
    ) {
        const remainingMs =
            HELPCHAT_RATE_LIMIT_WINDOW_MS -
            (now - bucket.windowStartedAt);

        res.set(
            "Retry-After",
            String(
                Math.max(
                    1,
                    Math.ceil(remainingMs / 1000)
                )
            )
        );

        return res.status(429).json({
            error:
                "Demasiadas consultas. Inténtalo de nuevo en unos segundos.",
            code: "RATE_LIMITED",
        });
    }

    return next();
}

app.get('/api/health', (req, res) => {
    return res.json({
        status: "ok",
        service: "copilot-ong-backend",
    });
});

app.get('/api/ready', async (req, res) => {
    try {
        await pool.query("SELECT 1");

        return res.json({
            status: "ready",
            database: "ok",
        });
    } catch (error) {
        console.error(
            "Readiness check failed:",
            error.message
        );

        return res.status(503).json({
            status: "not_ready",
            database: "error",
        });
    }
});

app.post(
    '/api/v1/helpchat/iacall',
    helpchatRateLimit,
    async (req, res) => {
    const startedAt = Date.now();

    const inputMessage =
        typeof req.body?.inputMessage === "string"
            ? req.body.inputMessage.trim()
            : "";

    const selectedProvincia =
        typeof req.body?.selectedProvincia === "string"
            ? req.body.selectedProvincia.trim()
            : "";

    if (!inputMessage) {
        return res.status(400).json({
            error: "El mensaje no puede estar vacío.",
        });
    }

    if (!selectedProvincia) {
        return res.status(400).json({
            error: "Debe seleccionarse una provincia.",
        });
    }

    try {
        const classificationStartedAt =
            performance.now();

        const tag = await classifyHelpchatTag({
            apiKey: app.locals.GEMINI_API_KEY,
            generateContentUrl: GEMINI_GENERATE_CONTENT_URL,
            inputMessage,
            tags,
            timeoutMs: HELPCHAT_AI_TIMEOUT_MS,
        });

        const classificationMs =
            performance.now() -
            classificationStartedAt;

        const searchStartedAt =
            performance.now();

        const searchResult = await findAssociationsForHelpchat({
            pool,
            schemaName: SCHEMA_NAME,
            tagId: tag.tag_id,
            selectedProvince: selectedProvincia,
            limit: 5,
        });

        const searchMs =
            performance.now() -
            searchStartedAt;

        const historyStartedAt =
            performance.now();

        const savedTag = await tagSaving(
            tag.descripcion,
            HELPCHAT_STORE_INPUT_MESSAGE
                ? inputMessage
                : "[not-stored]"
        );

        const historyMs =
            performance.now() -
            historyStartedAt;

        const associations = searchResult.associations;

        let message;

        if (associations.length === 0) {
            message =
                `He identificado tu consulta como **${tag.descripcion}**, ` +
                `pero no he encontrado asociaciones en el catálogo disponible ` +
                `para **${selectedProvincia}** ni recursos nacionales registrados ` +
                `con esta categoría.`;
        } else {
            let localText;

            if (searchResult.localCount > 0) {
                localText =
                    `He encontrado ${searchResult.localCount} opción` +
                    `${searchResult.localCount === 1 ? "" : "es"} ` +
                    `relacionada${searchResult.localCount === 1 ? "" : "s"} ` +
                    `con **${tag.descripcion}** en **${searchResult.resolvedProvince}**.`;
            } else if (searchResult.fallbackType === "neighbor_province") {
                localText =
                    `No he encontrado opciones registradas en **${selectedProvincia}**, ` +
                    `pero sí recursos relacionados con **${tag.descripcion}** ` +
                    `en provincias limítrofes disponibles en el catálogo.`;
            } else if (searchResult.fallbackType === "national") {
                localText =
                    `No he encontrado opciones registradas en **${selectedProvincia}**, ` +
                    `pero sí recursos de ámbito nacional relacionados con ` +
                    `**${tag.descripcion}**.`;
            } else {
                localText =
                    `He encontrado recursos relacionados con **${tag.descripcion}**.`;
            }

            const lines = associations.map((association, index) => {
                const details = [];

                if (association.municipality) {
                    details.push(association.municipality);
                }

                if (association.phone) {
                    details.push(`Tel.: ${association.phone}`);
                }

                if (association.email) {
                    details.push(`Email: ${association.email}`);
                }

                if (association.website) {
                    details.push(`Web: ${association.website}`);
                }

                return (
                    `${index + 1}. **${association.name}**` +
                    (details.length > 0
                        ? ` — ${details.join(" · ")}`
                        : "")
                );
            });

            message =
                `${localText}\n\n${lines.join("\n")}`;
        }

        const durationMs = Date.now() - startedAt;

        const timings = {
            classificationMs:
                Number(classificationMs.toFixed(1)),
            searchMs:
                Number(searchMs.toFixed(1)),
            historyMs:
                Number(historyMs.toFixed(1)),
            totalMs: durationMs,
        };

        console.log("Helpchat procesado:", {
            tag: tag.descripcion,
            requestedProvince: selectedProvincia,
            resolvedProvince: searchResult.resolvedProvince,
            localCount: searchResult.localCount,
            neighborCount: searchResult.neighborCount,
            nationalCount: searchResult.nationalCount,
            fallbackType: searchResult.fallbackType,
            timings,
        });

        return res.json({
            message,
            tag: tag.descripcion,
            requestedProvince: selectedProvincia,
            resolvedProvince: searchResult.resolvedProvince,
            fallbackUsed: searchResult.fallbackUsed,
            fallbackType: searchResult.fallbackType,
            localCount: searchResult.localCount,
            neighborCount: searchResult.neighborCount,
            nationalCount: searchResult.nationalCount,
            associations,
            provider: "gemini",
            model: GEMINI_MODEL,
            historyId: savedTag?.historyId || null,
            durationMs,
            timings,
        });
    } catch (err) {
        console.error("Error procesando la consulta de IA:", err);

        if (err?.providerStatus) {
            let status = 502;
            let message =
                "El proveedor de IA no pudo clasificar la consulta.";

            if (err.providerStatus === 504) {
                status = 504;
                message =
                    "El proveedor de IA tardó demasiado en responder.";
            } else if (
                err.providerStatus === 429
            ) {
                status = 503;
                message =
                    "El servicio de IA está temporalmente saturado.";
            }

            if (err.retryAfter) {
                res.set(
                    "Retry-After",
                    String(err.retryAfter)
                );
            }

            return res.status(status).json({
                error: message,
                code:
                    err.code ||
                    "AI_PROVIDER_ERROR",
                providerStatus:
                    err.providerStatus,
            });
        }

        return res.status(500).json({
            error: "Error interno al procesar la consulta.",
        });
    }
});

// **OPCIONAL**
// Serve React Frontend 
//app.use(express.static(path.join(__dirname, "../build")));

//app.get("*", (req, res) => {
//  res.sendFile(path.join(__dirname, "../build", "index.html"));
//});
// **END OPCIONAL**

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
