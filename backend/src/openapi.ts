export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Doctor Tracker API",
    version: "1.0.0",
    description:
      "Clinical operations API with cookie/JWT auth, rate limits, webhooks, FHIR-lite export, and dashboard analytics.",
  },
  servers: [{ url: "http://127.0.0.1:4821", description: "Local" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "dt_access" },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  paths: {
    "/api/health": {
      get: {
        security: [],
        summary: "Health check",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/auth/login": {
      post: {
        security: [],
        summary: "Login (sets httpOnly cookies + returns access token)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Authenticated" }, "401": { description: "Invalid" }, "429": { description: "Locked/throttled" } },
      },
    },
    "/api/auth/refresh": {
      post: {
        security: [],
        summary: "Rotate refresh token and issue new access token",
        responses: { "200": { description: "Refreshed" }, "401": { description: "Invalid refresh" } },
      },
    },
    "/api/auth/logout": {
      post: {
        security: [],
        summary: "Revoke refresh token and clear cookies",
        responses: { "200": { description: "Signed out" } },
      },
    },
    "/api/auth/verify-email": {
      post: {
        security: [],
        summary: "Verify email with token",
        responses: { "200": { description: "Verified" } },
      },
    },
    "/api/dashboard/stats": {
      get: {
        summary: "Dashboard analytics (Redis/memory cached)",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
          { name: "hospital", in: "query", schema: { type: "string" } },
          { name: "specialization", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Stats payload" } },
      },
    },
    "/api/webhooks": {
      get: { summary: "List webhook subscriptions", responses: { "200": { description: "List" } } },
      post: { summary: "Create webhook subscription", responses: { "201": { description: "Created" } } },
    },
    "/api/fhir/Patient": {
      get: { summary: "FHIR-lite Patient Bundle", responses: { "200": { description: "Bundle" } } },
    },
    "/api/fhir/Practitioner": {
      get: { summary: "FHIR-lite Practitioner Bundle", responses: { "200": { description: "Bundle" } } },
    },
    "/api/fhir/Bundle/$export": {
      get: { summary: "FHIR-lite collection export", responses: { "200": { description: "Bundle" } } },
    },
    "/api/platform/digests/run": {
      post: { summary: "Send activity email digests", responses: { "200": { description: "Sent" } } },
    },
    "/api/doctors": {
      get: { summary: "List doctors", responses: { "200": { description: "Paged list" } } },
      post: { summary: "Create doctor", responses: { "201": { description: "Created" } } },
    },
    "/api/patients": {
      get: { summary: "List patients", responses: { "200": { description: "Paged list" } } },
      post: { summary: "Create patient", responses: { "201": { description: "Created" } } },
    },
    "/api/patients/{id}/ai-summary": {
      get: { summary: "AI-assisted summary of recent notes", responses: { "200": { description: "Summary" } } },
    },
    "/api/patients/{id}/risk-flags": {
      get: { summary: "Computed clinical risk flags", responses: { "200": { description: "Alerts" } } },
    },
    "/api/messages": {
      get: { summary: "Staff inbox/sent", responses: { "200": { description: "Messages" } } },
      post: { summary: "Send internal message", responses: { "201": { description: "Created" } } },
    },
    "/api/telemedicine": {
      get: { summary: "List telemedicine sessions", responses: { "200": { description: "Sessions" } } },
      post: { summary: "Schedule telemedicine session", responses: { "201": { description: "Created" } } },
    },
    "/api/beds/occupancy": {
      get: { summary: "Ward/bed occupancy board", responses: { "200": { description: "Occupancy" } } },
    },
    "/api/invoices": {
      get: { summary: "List visit invoices", responses: { "200": { description: "Invoices" } } },
      post: { summary: "Create invoice for a visit", responses: { "201": { description: "Created" } } },
    },
  },
} as const;
