// Modèle et paramètres fixés ici, côté serveur : le navigateur n'envoie que
// les messages, pour que la clé API ne puisse pas servir à appeler un autre
// modèle ou à générer des réponses illimitées.
const MODEL = "claude-sonnet-5-5";
const MAX_TOKENS = 16000;

// Format de la synthèse, garanti par l'API (sorties structurées) : plus de
// JSON tronqué ou mal formé. Les clés correspondent à renderDiagram().
const liste = { type: "array", items: { type: "string" } };
const SCHEMA = {
  type: "object",
  properties: {
    passion_points: liste,
    mission_points: liste,
    vocation_points: liste,
    profession_points: liste,
    intersections: {
      type: "object",
      properties: {
        passion_mission: { type: "string" },
        mission_vocation: { type: "string" },
        vocation_profession: { type: "string" },
        profession_passion: { type: "string" },
      },
      required: ["passion_mission", "mission_vocation", "vocation_profession", "profession_passion"],
      additionalProperties: false,
    },
    pistes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titre: { type: "string" },
          description: { type: "string" },
          pourquoi_toi: { type: "string" },
          premier_pas: { type: "string" },
          comment_tester: { type: "string" },
        },
        required: ["titre", "description", "pourquoi_toi", "premier_pas", "comment_tester"],
        additionalProperties: false,
      },
    },
    ikigai: { type: "string" },
    tensions: liste,
    plan_30_jours: {
      type: "array",
      items: {
        type: "object",
        properties: {
          semaine: { type: "integer" },
          action: { type: "string" },
          resultat_attendu: { type: "string" },
        },
        required: ["semaine", "action", "resultat_attendu"],
        additionalProperties: false,
      },
    },
    prochaine_action: { type: "string" },
    questions_a_approfondir: liste,
  },
  required: [
    "passion_points", "mission_points", "vocation_points", "profession_points",
    "intersections", "pistes", "ikigai", "tensions", "plan_30_jours",
    "prochaine_action", "questions_a_approfondir",
  ],
  additionalProperties: false,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async function (event) {

  // Gestion du preflight CORS (OPTIONS)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  // Refuser les méthodes autres que POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let messages;
  try {
    messages = JSON.parse(event.body || "{}").messages;
  } catch (err) {
    messages = null;
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      statusCode: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Requête invalide : messages manquants" }),
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        // Si le modèle refuse la demande, l'API bascule seule sur un modèle de secours
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // "medium" : une vraie réflexion sur les recoupements, tout en restant
        // sous la limite de 60 s des fonctions Netlify synchrones
        output_config: {
          effort: "medium",
          format: { type: "json_schema", schema: SCHEMA },
        },
        fallbacks: "default",
        messages,
      }),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
