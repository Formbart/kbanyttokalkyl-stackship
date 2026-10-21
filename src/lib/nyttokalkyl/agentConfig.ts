/** Public webhook configuration; never put mail credentials here. */
export const agentWebhookUrl =
  (import.meta.env["VITE_N8N_WEBHOOK_URL"] as string | undefined) ||
  `${(import.meta.env["VITE_N8N_BASE_URL"] as string | undefined) || "https://kontakinte113355.app.n8n.cloud"}/webhook/nyttokalkyl-agent`;