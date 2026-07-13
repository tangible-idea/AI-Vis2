import { createClient } from "@/lib/supabase/server";
import { RedeemForm } from "./redeem-form";

export const metadata = { title: "Redeem your code" };

/**
 * Lifetime-code redemption (AppSumo campaigns). Fully self-service: sign
 * in or create an account, enter the code, plan activates instantly.
 * Internal partner details are never surfaced.
 */
export default async function RedeemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <RedeemForm signedIn={!!user} email={user?.email ?? null} />;
}
