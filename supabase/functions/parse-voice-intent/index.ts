// Supabase Edge Function: parse-voice-intent
// Language: Deno TypeScript
// Serves: POST endpoint resolving raw voice dictation into structured JSON bookkeeping data

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  text: string;
}

serve(async (req) => {
  // Handle CORS preflight options request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("[parse-voice-intent] Missing GEMINI_API_KEY environment variable.");
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY environment configuration on Edge Function." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed. Use POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse incoming request payload
    const { text }: RequestPayload = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid request payload. Please specify a non-empty 'text' parameter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.info(`[parse-voice-intent] Parsing merchant speech intent: "${text}"`);

    // Strict system prompt for transaction parsing
    const systemPrompt = `You are an advanced bookkeeping parser for Ghanaian retail operations.
Analyze the user's spoken merchant transaction statement and extract parameters into a JSON object matching this schema.

Rules:
1. "product_name": Map to the specific item or service mentioned (e.g., "rice", "oil", "water sachet"). Keep it lowercase.
2. "quantity": Extract the integer value. Default to 1 if no quantity is specified.
3. "payment_status": Output either "Paid" (if bought with cash, money, Momo, cashout, or paid) or "Credit" (if bought on debt, credit, book, trust, or to pay later).
4. "customer_name": Extract the customer's name (e.g., "Kofi", "Ama"). Return null if no person is cited.

Examples:
- "I just sold three bottles of oil for cash" -> {"product_name": "oil", "quantity": 3, "payment_status": "Paid", "customer_name": null}
- "Kofi bought two bags of rice on credit" -> {"product_name": "rice", "quantity": 2, "payment_status": "Credit", "customer_name": "Kofi"}
`;

    // Direct HTTP request to the Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\nUser Input: "${text}"`
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json", // Enforces model to generate JSON output
          responseSchema: {
            type: "OBJECT",
            properties: {
              product_name: { type: "STRING", description: "The name of the item sold, lowercase." },
              quantity: { type: "INTEGER", description: "Integer quantity sold, defaulting to 1." },
              payment_status: { type: "STRING", enum: ["Paid", "Credit"], description: "Paid or Credit status." },
              customer_name: { 
                type: "STRING", 
                nullable: true, 
                description: "Customer name mentioned, or null if unspecified." 
              }
            },
            required: ["product_name", "quantity", "payment_status", "customer_name"]
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[parse-voice-intent] Gemini API error: ${errorText}`);
      throw new Error(`Gemini API responded with status ${response.status}`);
    }

    const responseJson = await response.json();
    const modelOutputText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!modelOutputText) {
      throw new Error("Model generated empty content.");
    }

    // Parse the output to verify it is valid JSON
    const parsedData = JSON.parse(modelOutputText.trim());

    return new Response(
      JSON.stringify(parsedData),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[parse-voice-intent] Request failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
