import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];

    // Find houses where estimated_return_date <= today and status is not occupied
    const { data: houses, error: fetchError } = await supabase
      .from("houses")
      .select("id, block, number, estimated_return_date, occupancy_status")
      .neq("occupancy_status", "occupied")
      .not("estimated_return_date", "is", null)
      .lte("estimated_return_date", today);

    if (fetchError) throw fetchError;

    if (!houses || houses.length === 0) {
      return new Response(
        JSON.stringify({ message: "No houses to update", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ids = houses.map((h) => h.id);

    const { error: updateError } = await supabase
      .from("houses")
      .update({
        occupancy_status: "occupied",
        is_occupied: true,
        vacancy_reason: null,
        estimated_return_date: null,
      })
      .in("id", ids);

    if (updateError) throw updateError;

    console.log(`Auto-updated ${ids.length} houses to occupied:`, houses.map(h => `Blok ${h.block} No. ${h.number}`));

    return new Response(
      JSON.stringify({
        message: `Updated ${ids.length} houses to occupied`,
        updated: ids.length,
        houses: houses.map((h) => `Blok ${h.block} No. ${h.number}`),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
