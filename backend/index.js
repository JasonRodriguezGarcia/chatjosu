import express from "express";
import cors from 'cors';
import {
  fileURLToPath,
  pathToFileURL,
} from "node:url";
import { isIP } from "node:net";
import path from "node:path";
import { existsSync } from "node:fs";
import {
  findAssociationsForHelpchat,
} from "./services/helpchat-association-service.js";
import {
  classifyHelpchatTag,
} from "./services/helpchat-gemini-service.js";
import {
  createHelpchatEmbeddingService,
} from "./services/helpchat-embedding-service.js";
import {
  createHelpchatSemanticClassifier,
} from "./services/helpchat-semantic-classifier.js";
import {
  createHelpchatUnderstandingRouter,
} from "./services/helpchat-understanding-router.js";
import {
  createProvinceMatcher,
} from "./helpchat/conversation-context-enricher-v1.js";
import {
  canonicalizeHelpchatLocation,
  createProvinceResolver,
  projectProvinceCatalog,
} from "./helpchat/territory-contract-v1.js";
import {
  persistResolvedActiveNeed,
  persistResolvedActiveNeeds,
  preferContextResolution,
  resolveSingleActiveOperationalTag,
  updateConversationContextV1,
} from "./helpchat/conversation-context-update-v1.js";
import {
  mergeMultiNeedSearchResults,
  resolveMultipleNeeds,
} from "./helpchat/multi-need-v1.js";
import {
createHelpchatLocationResolver,
helpchatClientIp,
normalizeCloudflareLocation,
} from "./services/helpchat-location-service.js";
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

const BACKEND_HOST =
    process.env.BACKEND_HOST?.trim() ||
    "127.0.0.1";

const SERVE_FRONTEND =
    String(
        process.env.SERVE_FRONTEND ||
        "false"
    ).toLowerCase() === "true";

const FRONTEND_DIST_PATH =
    fileURLToPath(
        new URL(
            "../frontend/dist/",
            import.meta.url
        )
    );

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

const HELPCHAT_EMBEDDING_BASE_URL =
    process.env.HELPCHAT_EMBEDDING_BASE_URL?.trim() ||
    "http://127.0.0.1:11434";

const HELPCHAT_EMBEDDING_MODEL =
    process.env.HELPCHAT_EMBEDDING_MODEL?.trim() ||
    "nomic-embed-text";

const HELPCHAT_EMBEDDING_TIMEOUT_MS =
    positiveIntegerEnv(
        "HELPCHAT_EMBEDDING_TIMEOUT_MS",
        3000
    );

const HELPCHAT_EMBEDDING_KEEP_ALIVE =
    process.env.HELPCHAT_EMBEDDING_KEEP_ALIVE?.trim() ||
    "30m";

const HELPCHAT_SEMANTIC_MIN_SCORE =
    Number(
        process.env.HELPCHAT_SEMANTIC_MIN_SCORE ||
        "0.62"
    );

const HELPCHAT_SEMANTIC_MIN_MARGIN =
    Number(
        process.env.HELPCHAT_SEMANTIC_MIN_MARGIN ||
        "0.05"
    );

if (
    !Number.isFinite(HELPCHAT_SEMANTIC_MIN_SCORE) ||
    HELPCHAT_SEMANTIC_MIN_SCORE < 0 ||
    HELPCHAT_SEMANTIC_MIN_SCORE > 1
) {
    throw new Error(
        "HELPCHAT_SEMANTIC_MIN_SCORE must be between 0 and 1."
    );
}

if (
    !Number.isFinite(HELPCHAT_SEMANTIC_MIN_MARGIN) ||
    HELPCHAT_SEMANTIC_MIN_MARGIN < 0 ||
    HELPCHAT_SEMANTIC_MIN_MARGIN > 1
) {
    throw new Error(
        "HELPCHAT_SEMANTIC_MIN_MARGIN must be between 0 and 1."
    );
}

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

const HELPCHAT_TRUST_CLOUDFLARE =
    String(
        process.env
            .HELPCHAT_TRUST_CLOUDFLARE ||
        "false"
    ).toLowerCase() === "true";

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
app.locals.classifyHelpchatTag =
    classifyHelpchatTag;

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

const helpchatProvinceRows =
    (
        await pool.query(
            `
            SELECT
              province_key,
              name
            FROM ${SCHEMA_NAME}.provinces
            ORDER BY name
            `
        )
    ).rows;

const helpchatProvinceMatcher =
    createProvinceMatcher(
        helpchatProvinceRows
    );

const helpchatProvinceResolver =
    createProvinceResolver(
        helpchatProvinceRows
    );

const helpchatProvinceCatalog =
    projectProvinceCatalog(
        helpchatProvinceRows
    );

console.log(
    `Territorios Helpchat cargados: ${helpchatProvinceRows.length}`
);

app.locals.tagSaving = tagSaving;

const helpchatEmbeddingService =
    createHelpchatEmbeddingService({
        baseUrl: HELPCHAT_EMBEDDING_BASE_URL,
        model: HELPCHAT_EMBEDDING_MODEL,
        timeoutMs: HELPCHAT_EMBEDDING_TIMEOUT_MS,
        keepAlive: HELPCHAT_EMBEDDING_KEEP_ALIVE,
    });

const helpchatSemanticClassifier =
    createHelpchatSemanticClassifier({
        embeddingService:
            helpchatEmbeddingService,
        minimumScore:
            HELPCHAT_SEMANTIC_MIN_SCORE,
        minimumMargin:
            HELPCHAT_SEMANTIC_MIN_MARGIN,
    });

const helpchatUnderstandingRouter =
    createHelpchatUnderstandingRouter({
        semanticClassifier:
            helpchatSemanticClassifier,
    });

app.locals.understandHelpchat =
    helpchatUnderstandingRouter.understand;

let helpchatSemanticReady = false;
let helpchatSemanticWarmupError = null;

async function warmHelpchatSemanticRouter() {
    const startedAt =
        performance.now();

    try {
        await helpchatSemanticClassifier.warmup();

        helpchatSemanticReady = true;
        helpchatSemanticWarmupError = null;

        console.log(
            "Helpchat semantic router warm:",
            {
                model:
                    HELPCHAT_EMBEDDING_MODEL,
                durationMs:
                    Number(
                        (
                            performance.now() -
                            startedAt
                        ).toFixed(1)
                    ),
            }
        );

        return true;
    } catch (error) {
        helpchatSemanticReady = false;
        helpchatSemanticWarmupError =
            error?.code ||
            error?.message ||
            "unknown";

        console.warn(
            "Helpchat semantic router warmup failed:",
            helpchatSemanticWarmupError
        );

        return false;
    }
}

app.locals.warmHelpchatSemanticRouter =
    warmHelpchatSemanticRouter;

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
app.get(
    [
        "/api/provincias",
        "/api/v1/helpchat/provincias",
    ],
    (req, res) => {
        return res.json(
            helpchatProvinceCatalog
        );
    }
);

const helpchatLocationResolver =
    createHelpchatLocationResolver();

app.locals.resolveHelpchatLocation =
    helpchatLocationResolver;

app.get(
    "/api/v1/helpchat/location",
    async (req, res) => {
        const ip =
            helpchatClientIp({
                remoteAddress:
                    req.socket
                        ?.remoteAddress,
                cloudflareConnectingIp:
                    req.get(
                        "CF-Connecting-IP"
                    ),
                trustCloudflare:
                    HELPCHAT_TRUST_CLOUDFLARE,
            });

        let location;

        if (
            HELPCHAT_TRUST_CLOUDFLARE &&
            isLoopbackAddress(
                req.socket
                    ?.remoteAddress
            )
        ) {
            location =
                normalizeCloudflareLocation({
                    country:
                        req.get(
                            "CF-IPCountry"
                        ),
                    province:
                        req.get(
                            "CF-Region"
                        ),
                    municipality:
                        req.get(
                            "CF-IPCity"
                        ),
                });
        }

        if (
            !location ||
            !location.province
        ) {
            location =
                await app.locals
                    .resolveHelpchatLocation({
                        ip,
                    });
        }

        location =
            canonicalizeHelpchatLocation({
                location,
                provinceResolver:
                    helpchatProvinceResolver,
            });

        return res.json(
            location
        );
    }
);

const helpchatRateLimitBuckets = new Map();

function isLoopbackAddress(value) {
    const address =
        String(value || "").trim();

    return (
        address === "127.0.0.1" ||
        address === "::1" ||
        address === "::ffff:127.0.0.1"
    );
}

function helpchatClientKey(req) {
    const remoteAddress =
        req.socket?.remoteAddress ||
        "";

    if (
        HELPCHAT_TRUST_CLOUDFLARE &&
        isLoopbackAddress(remoteAddress)
    ) {
        const connectingIp =
            String(
                req.get(
                    "CF-Connecting-IP"
                ) || ""
            ).trim();

        if (isIP(connectingIp)) {
            return `cf:${connectingIp}`;
        }
    }

    return (
        `direct:` +
        (
            remoteAddress ||
            "unknown"
        )
    );
}

function helpchatRateLimit(req, res, next) {
    const now = Date.now();
    const key = helpchatClientKey(req);

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
            semanticRouter:
                helpchatSemanticReady
                    ? "ready"
                    : "degraded",
            semanticFallback:
                helpchatSemanticReady
                    ? null
                    : "gemini",
            semanticWarmupError:
                helpchatSemanticReady
                    ? null
                    : helpchatSemanticWarmupError,
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

        const contextUpdate =
            updateConversationContextV1({
                conversationContext:
                    req.body?.conversationContext,
                inputMessage,
                selectedProvince:
                    selectedProvincia,
                provinceMatcher:
                    helpchatProvinceMatcher,
            });

        const conversationContext =
            contextUpdate.context;

        const effectiveProvince =
            conversationContext
                ?.territory
                ?.province ||
            selectedProvincia;

        const activeContextTag =
            resolveSingleActiveOperationalTag({
                conversationContext,
                tags,
            });

        let understanding;

        try {
            understanding =
                await app.locals.understandHelpchat({
                    inputMessage,
                    conversationContext,
                });
        } catch (localError) {
            console.warn(
                "Router local no disponible; usando Gemini fallback:",
                localError?.code ||
                localError?.message
            );

            const fallbackTag =
                await app.locals.classifyHelpchatTag({
                    apiKey:
                        app.locals.GEMINI_API_KEY,
                    generateContentUrl:
                        GEMINI_GENERATE_CONTENT_URL,
                    inputMessage,
                    tags,
                    timeoutMs:
                        HELPCHAT_AI_TIMEOUT_MS,
                });

            understanding = {
                status: "resolved",
                tag: fallbackTag,
                resolvedNeeds: [
                    {
                        tag_id:
                            Number(
                                fallbackTag.tag_id
                            ),
                        descripcion:
                            fallbackTag.descripcion,
                        source:
                            "gemini",
                    },
                ],
                context:
                    conversationContext,
                needsClarification: false,
                clarificationQuestion: null,
                provider: "gemini",
                model: GEMINI_MODEL,
                durationMs: null,
                diagnostics: null,
            };
        }

        understanding =
            preferContextResolution({
                understanding,
                contextUpdate,
                activeTag:
                    activeContextTag,
            });

        const classificationMs =
            performance.now() -
            classificationStartedAt;

        if (
            understanding.status ===
                "needs_clarification" ||
            understanding.needsClarification === true
        ) {
            const durationMs =
                Date.now() - startedAt;

            const timings = {
                classificationMs:
                    Number(
                        classificationMs.toFixed(1)
                    ),
                searchMs: 0,
                historyMs: 0,
                totalMs: durationMs,
            };

            console.log(
                "Helpchat necesita aclaración:",
                {
                    provider:
                        understanding.provider,
                    model:
                        understanding.model,
                    missingDimension:
                        understanding.missingDimension ||
                        null,
                    timings,
                }
            );

            return res.json({
                status:
                    "needs_clarification",
                message:
                    understanding.clarificationQuestion,
                tag: null,
                context:
                    understanding.context,
                needsClarification: true,
                clarificationQuestion:
                    understanding.clarificationQuestion,
                requestedProvince:
                    selectedProvincia,
                effectiveProvince,
                resolvedProvince:
                    effectiveProvince,
                fallbackUsed: false,
                fallbackType: null,
                localCount: 0,
                neighborCount: 0,
                nationalCount: 0,
                associations: [],
                provider:
                    understanding.provider,
                model:
                    understanding.model,
                historyId: null,
                durationMs,
                timings,
            });
        }

        const tag =
            understanding.tag;

        if (
            !tag ||
            !tag.tag_id ||
            !tag.descripcion
        ) {
            const error = new Error(
                "El router no devolvió un tag válido."
            );

            error.code =
                "HELPCHAT_INVALID_ROUTER_RESULT";

            throw error;
        }

        const resolvedNeeds =
            await resolveMultipleNeeds({
                inputMessage,
                conversationContext:
                    understanding.context ||
                    conversationContext,
                primaryUnderstanding:
                    understanding,
                understand:
                    app.locals.understandHelpchat,
            });

        if (
            resolvedNeeds.length === 0
        ) {
            resolvedNeeds.push({
                tag_id:
                    Number(
                        tag.tag_id
                    ),
                descripcion:
                    tag.descripcion,
                source:
                    understanding.provider ||
                    null,
            });
        }

        understanding.resolvedNeeds =
            resolvedNeeds;

        understanding.context =
            persistResolvedActiveNeeds({
                conversationContext:
                    understanding.context ||
                    conversationContext,
                tags:
                    resolvedNeeds,
            });

        const searchStartedAt =
            performance.now();

        const searchResults =
            await Promise.all(
                resolvedNeeds.map(
                    (need) =>
                        findAssociationsForHelpchat({
                            pool,
                            schemaName:
                                SCHEMA_NAME,
                            tagId:
                                need.tag_id,
                            selectedProvince:
                                effectiveProvince,
                            limit: 5,
                        })
                )
            );

        const mergedSearch =
            mergeMultiNeedSearchResults({
                resolvedNeeds,
                searchResults,
                limit: 5,
            });

        const primarySearchResult =
            searchResults[0];

        const searchResult = {
            ...primarySearchResult,
            ...mergedSearch,
            resolvedProvince:
                primarySearchResult
                    ?.resolvedProvince ||
                effectiveProvince,
        };

        const searchMs =
            performance.now() -
            searchStartedAt;

        const historyStartedAt =
            performance.now();

        const savedTags =
            await Promise.all(
                resolvedNeeds.map(
                    (need) =>
                        app.locals.tagSaving(
                            need.descripcion,
                            HELPCHAT_STORE_INPUT_MESSAGE
                                ? inputMessage
                                : "[not-stored]"
                        )
                )
            );

        const savedTag =
            savedTags[0] ||
            null;

        const historyMs =
            performance.now() -
            historyStartedAt;

        const associations =
            searchResult.associations;

        const resolvedNeedText =
            understanding.resolvedNeeds
                .map(
                    (need) =>
                        need.descripcion
                )
                .join(", ");

        let message;

        if (associations.length === 0) {
            message =
                `He identificado tu consulta como **${resolvedNeedText}**, ` +
                `pero no he encontrado asociaciones en el catálogo disponible ` +
                `para **${effectiveProvince}** ni recursos nacionales registrados ` +
                `con esta categoría.`;
        } else {
            let localText;

            if (searchResult.localCount > 0) {
                localText =
                    `He encontrado ${searchResult.localCount} opción` +
                    `${searchResult.localCount === 1 ? "" : "es"} ` +
                    `relacionada${searchResult.localCount === 1 ? "" : "s"} ` +
                    `con **${resolvedNeedText}** en **${searchResult.resolvedProvince}**.`;
            } else if (searchResult.fallbackType === "neighbor_province") {
                localText =
                    `No he encontrado opciones registradas en **${effectiveProvince}**, ` +
                    `pero sí recursos relacionados con **${resolvedNeedText}** ` +
                    `en provincias limítrofes disponibles en el catálogo.`;
            } else if (searchResult.fallbackType === "national") {
                localText =
                    `No he encontrado opciones registradas en **${effectiveProvince}**, ` +
                    `pero sí recursos de ámbito nacional relacionados con ` +
                    `**${resolvedNeedText}**.`;
            } else {
                localText =
                    `He encontrado recursos relacionados con **${resolvedNeedText}**.`;
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
            resolvedNeeds:
                understanding.resolvedNeeds
                    .map(
                        (need) =>
                            need.descripcion
                    ),
            requestedProvince: selectedProvincia,
            effectiveProvince,
            resolvedProvince: searchResult.resolvedProvince,
            localCount: searchResult.localCount,
            neighborCount: searchResult.neighborCount,
            nationalCount: searchResult.nationalCount,
            fallbackType: searchResult.fallbackType,
            timings,
        });

        return res.json({
            status: "resolved",
            message,
            tag: tag.descripcion,
            resolvedNeeds:
                understanding.resolvedNeeds,
            context:
                understanding.context,
            needsClarification: false,
            clarificationQuestion: null,
            requestedProvince: selectedProvincia,
            effectiveProvince,
            resolvedProvince: searchResult.resolvedProvince,
            fallbackUsed: searchResult.fallbackUsed,
            fallbackType: searchResult.fallbackType,
            localCount: searchResult.localCount,
            neighborCount: searchResult.neighborCount,
            nationalCount: searchResult.nationalCount,
            associations,
            provider:
                understanding.provider,
            model:
                understanding.model,
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

if (SERVE_FRONTEND) {
    if (!existsSync(FRONTEND_DIST_PATH)) {
        throw new Error(
            `Frontend dist not found: ${FRONTEND_DIST_PATH}`
        );
    }

    app.use(
        express.static(
            FRONTEND_DIST_PATH
        )
    );

    app.use((req, res, next) => {
        if (
            req.method !== "GET" ||
            req.path.startsWith("/api/")
        ) {
            return next();
        }

        return res.sendFile(
            path.join(
                FRONTEND_DIST_PATH,
                "index.html"
            )
        );
    });

    console.log(
        `Frontend dist enabled: ${FRONTEND_DIST_PATH}`
    );
}

export { app, pool };

const isMainModule =
    Boolean(process.argv[1]) &&
    import.meta.url ===
        pathToFileURL(process.argv[1]).href;

// Start Server
if (isMainModule) {
    await warmHelpchatSemanticRouter();

    app.listen(
        PORT,
        BACKEND_HOST,
        () => {
            console.log(
                `Server running on ` +
                `http://${BACKEND_HOST}:${PORT}`
            );
        }
    );
}
