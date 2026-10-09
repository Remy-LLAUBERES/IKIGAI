// Modèle et paramètres fixés ici, côté serveur : le navigateur n'envoie que
// les messages, pour que la clé API ne puisse pas servir à appeler un autre
// modèle ou à générer des réponses illimitées.
const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16000;

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
        // Synthèse simple : réflexion courte, pour répondre vite
        // (les fonctions Netlify sont coupées au bout de quelques secondes)
        output_config: { effort: "low" },
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
