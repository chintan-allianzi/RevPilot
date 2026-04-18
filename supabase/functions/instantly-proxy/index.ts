import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { endpoint, method, body, instantlyApiKey, version } =
      await req.json();

    if (!endpoint || !instantlyApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint or instantlyApiKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl =
      version === "v2"
        ? "https://api.instantly.ai/api/v2/"
        : "https://api.instantly.ai/api/v1/";

    const url = new URL(`${baseUrl}${endpoint}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (version === "v2") {
      headers["Authorization"] = `Bearer ${instantlyApiKey}`;
    } else {
      url.searchParams.set("api_key", instantlyApiKey);
    }

    const fetchMethod = (method || "POST").toUpperCase();
    const fetchOptions: RequestInit = { method: fetchMethod, headers };
    if (body && fetchMethod !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), fetchOptions);
    const data = await response.json();

    return new Response(
      JSON.stringify({ status: response.status, ok: response.ok, data }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
