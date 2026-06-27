import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CLASS_NAMES = [
  "Apple___Apple_scab",
  "Apple___Black_rot",
  "Apple___Cedar_apple_rust",
  "Apple___healthy",
  "Blueberry___healthy",
  "Cherry_(including_sour)___Powdery_mildew",
  "Cherry_(including_sour)___healthy",
  "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
  "Corn_(maize)___Common_rust_",
  "Corn_(maize)___Northern_Leaf_Blight",
  "Corn_(maize)___healthy",
  "Grape___Black_rot",
  "Grape___Esca_(Black_Measles)",
  "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
  "Grape___healthy",
  "Orange___Haunglongbing_(Citrus_greening)",
  "Peach___Bacterial_spot",
  "Peach___healthy",
  "Pepper,_bell___Bacterial_spot",
  "Pepper,_bell___healthy",
  "Potato___Early_blight",
  "Potato___Late_blight",
  "Potato___healthy",
  "Raspberry___healthy",
  "Soybean___healthy",
  "Squash___Powdery_mildew",
  "Strawberry___Leaf_scorch",
  "Strawberry___healthy",
  "Tomato___Bacterial_spot",
  "Tomato___Early_blight",
  "Tomato___Late_blight",
  "Tomato___Leaf_Mold",
  "Tomato___Septoria_leaf_spot",
  "Tomato___Spider_mites Two-spotted_spider_mite",
  "Tomato___Target_Spot",
  "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
  "Tomato___Tomato_mosaic_virus",
  "Tomato___healthy",
];

function getSeverity(className: string): "Low" | "Moderate" | "High" | "Critical" {
  if (className.includes("healthy")) return "Low";
  const critical = ["Late_blight", "Haunglongbing", "Yellow_Leaf_Curl_Virus", "mosaic_virus", "Bacterial_spot"];
  const high = ["Apple_scab", "Black_rot", "Northern_Leaf_Blight", "Leaf_blight", "Leaf_scorch", "Septoria", "Target_Spot", "Spider_mites", "Cercospora"];
  if (critical.some((d) => className.includes(d))) return "Critical";
  if (high.some((d) => className.includes(d))) return "High";
  return "Moderate";
}

function parseCropAndDisease(className: string): { crop: string; disease: string } {
  const parts = className.split("___");
  const crop = parts[0]
    .replace(/_/g, " ")
    .replace(/\(including sour\)/g, "")
    .replace(/\(maize\)/g, "")
    .replace(/,_bell/g, "")
    .trim();
  const disease = parts[1]
    ? parts[1].replace(/_/g, " ").trim()
    : "Healthy";
  return {
    crop: crop === "Pepper" ? "Bell Pepper" : crop,
    disease: disease === "healthy" ? "Healthy" : disease,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid image data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenRouter API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const classList = CLASS_NAMES.map((c) => `- ${c}`).join("\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://crop-disease-inspector.supabase.co",
        "X-Title": "Crop Disease Inspector",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a plant pathologist expert. Analyze the crop image and classify it into exactly one of these disease classes. Respond ONLY with a JSON object, no markdown, no explanation.\n\nValid classes:\n${classList}\n\nRespond in this exact JSON format:\n{"class_name": "<one of the classes above>", "confidence": <integer 0-100>}\n\nThe class_name must be EXACTLY one of the listed classes. The confidence is your confidence in the classification (0-100).`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this crop image into one of the disease classes listed above." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `OpenRouter API error (${response.status}): ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from model" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: { class_name: string; confidence: number };
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(
        JSON.stringify({ error: "Failed to parse model response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!CLASS_NAMES.includes(parsed.class_name)) {
      const closeMatch = CLASS_NAMES.find((c) =>
        c.toLowerCase().includes(parsed.class_name.toLowerCase()) ||
        parsed.class_name.toLowerCase().includes(c.toLowerCase())
      );
      if (closeMatch) {
        parsed.class_name = closeMatch;
      } else {
        return new Response(
          JSON.stringify({ error: "Model returned an invalid class name" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { crop, disease } = parseCropAndDisease(parsed.class_name);
    const severity = getSeverity(parsed.class_name);
    const confidence = Math.min(Math.max(Math.round(parsed.confidence), 0), 99);

    return new Response(
      JSON.stringify({ class_name: parsed.class_name, crop, disease, confidence, severity }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
