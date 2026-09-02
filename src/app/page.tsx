import { redirect } from "next/navigation";

import { getOptionalUser } from "@/lib/supabase/auth";

/**
 * The front door. Sends you to the day if you're signed in, and to the sign-in
 * page if you're not — rather than bouncing to /today and being redirected a
 * second time, which showed a flash of the wrong destination.
 */
export default async function Home() {
  const user = await getOptionalUser();
  redirect(user ? "/today" : "/login");
}
