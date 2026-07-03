import { createFileRoute } from "@tanstack/react-router";

const USERS = [
  "jerin@animatech.solutions",
  "anand@animatech.solutions",
  "sankar@animatech.solutions",
];
const DEFAULT_PASSWORD = "ATS@2026";

export const Route = createFileRoute("/api/public/bootstrap-users")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: Array<{ email: string; status: string }> = [];

        for (const email of USERS) {
          try {
            // Check if user exists
            const { data: existing } = await supabaseAdmin.auth.admin.listUsers({
              page: 1,
              perPage: 200,
            });
            const found = existing?.users.find((u) => u.email === email);
            if (found) {
              results.push({ email, status: "exists" });
              continue;
            }
            const { error } = await supabaseAdmin.auth.admin.createUser({
              email,
              password: DEFAULT_PASSWORD,
              email_confirm: true,
              user_metadata: { must_change_password: true },
            });
            results.push({ email, status: error ? `error: ${error.message}` : "created" });
          } catch (e) {
            results.push({ email, status: `error: ${(e as Error).message}` });
          }
        }

        return Response.json({ ok: true, results });
      },
      GET: async () => Response.json({ ok: true, hint: "POST to bootstrap users" }),
    },
  },
});
