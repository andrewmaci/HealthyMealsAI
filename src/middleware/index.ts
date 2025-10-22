import { defineMiddleware } from "astro:middleware";

import { DEFAULT_USER_ID, supabaseClient } from "../db/supabase.client.ts";

const createDefaultSession = () => ({
  user: {
    id: DEFAULT_USER_ID,
  },
});

export const onRequest = defineMiddleware((context, next) => {
  context.locals.supabase = supabaseClient;

  if (!context.locals.session?.user?.id) {
    context.locals.session = createDefaultSession();
  }

  return next();
});
