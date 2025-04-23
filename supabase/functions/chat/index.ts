import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import OpenAI from "npm:openai@4.28.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

Deno.serve(async (req) => {
  // Always add CORS headers
  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/json");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers,
    });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get DeepSeek API key from system_settings
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "deepseek_api_key")
      .single();

    if (settingsError || !settings?.value) {
      console.error("Settings error:", settingsError);
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers }
      );
    }

    // Parse request body
    let messages: ChatMessage[];
    try {
      const body = await req.json();
      messages = body.messages;

      if (!Array.isArray(messages)) {
        return new Response(
          JSON.stringify({ error: "Invalid messages format" }),
          { status: 400, headers }
        );
      }

      // Ensure system message is present
      if (!messages.some(msg => msg.role === "system")) {
        messages.unshift({
          role: "system",
          content: "You are a helpful assistant."
        });
      }

      // Note: In a future update, we should import the SIMPLE_SYSTEM_PROMPT from a shared constants file
      // This would require setting up a shared package or using a monorepo structure
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers }
      );
    }

    console.log("Processing request with messages:", messages);

    // Initialize OpenAI client with DeepSeek configuration
    const openai = new OpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: settings.value,
      dangerouslyAllowBrowser: true
    });

    // Call DeepSeek API using OpenAI SDK
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    console.log("Received response from DeepSeek:", completion);

    return new Response(
      JSON.stringify(completion),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Edge function error:", error);

    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("Error details:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers }
    );
  }
});
