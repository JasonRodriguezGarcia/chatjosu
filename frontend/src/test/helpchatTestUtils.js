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
