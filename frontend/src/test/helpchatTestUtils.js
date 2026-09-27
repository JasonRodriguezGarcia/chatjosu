export const jsonResponse = (
  data,
  { ok = true, status = 200 } = {},
) => ({
  ok,
  status,
  json: async () => data,
});

export const deferred = () => {
  let resolve;
  let reject;

  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    resolve,
    reject,
  };
};

export const provincesResponse = () =>
  jsonResponse([
    { label: "Burgos" },
    { label: "Gipuzkoa" },
  ]);

export const associationResponse = ({
  message = "Respuesta backend heredada",
  associationId = "213",
  name = "Servicios sociales y de dependencia",
} = {}) =>
  jsonResponse({
    message,
    tag: "BIENESTAR SOCIAL",
    requestedProvince: "Burgos",
    resolvedProvince: "Burgos",
    fallbackUsed: false,
    fallbackType: null,
    localCount: 1,
    neighborCount: 0,
    nationalCount: 0,
    durationMs: 1200,
    associations: [
      {
        id: associationId,
        name,
        scope: "Provincial",
        province_key: "BURGOS",
        province: "Burgos",
        municipality: "Miranda de Ebro",
        address: "C/ Condes de Montarco, 2",
        postal_code: null,
        phone: "947 33 03 33",
        email: "info@example.org",
        website:
          "[https://www.fedispa.es/](https://www.fedispa.es/)",
        description: null,
        latitude: null,
        longitude: null,
        location_precision: "Municipio",
        distance_km: null,
      },
    ],
  });

export const conversationContextV1 = ({
  relationship = null,
  activeNeeds = [],
  currentGoal = null,
  facts = [],
  constraints = [],
  province = null,
  municipality = null,
  resourcesShown = [],
} = {}) => ({
  version: 1,
  subject: {
    relationship,
  },
  activeNeeds,
  currentGoal,
  facts,
  constraints,
  territory: {
    province,
    municipality,
  },
  resourcesShown,
});

export const isLocationRequest = (url) =>
  String(url).includes("/api/v1/helpchat/location");

export const locationResponse = ({
  country = "ES",
  province = "Gipuzkoa",
  municipality = "Donostia / San Sebastián",
} = {}) =>
  jsonResponse({
    country,
    province,
    municipality,
    source: "ip",
    confidence: "coarse",
  });

export const isTesterSessionRequest = (url) =>
  String(url).includes(
    "/api/v1/helpchat/tester/sessions",
  );

export const isTesterTurnRequest = (url) =>
  String(url).includes(
    "/api/v1/helpchat/tester/turns",
  );

export const isTesterFeedbackRequest = (url) =>
  String(url).includes(
    "/api/v1/helpchat/tester/feedback",
  );

export const isIacallRequest = (url) =>
  String(url).includes(
    "/api/v1/helpchat/iacall",
  );
