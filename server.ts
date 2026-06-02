import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

app.use(express.json({ limit: "1mb" }));

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment variables.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// --- Request validation ---------------------------------------------------
const DAY_SLOTS = 17;
const MAX_SHIFTS = 200;

const isShiftArray = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length <= MAX_SHIFTS &&
  value.every((s) => s !== null && typeof s === "object");

const isTargetsArray = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length === DAY_SLOTS &&
  value.every((n) => typeof n === "number" && Number.isFinite(n));

// Send a structured 500 without leaking stack traces to the client.
const sendModelError = (res: express.Response, label: string, err: any) => {
  console.error(`${label} Error:`, err?.message || err);
  res.status(500).json({ error: err?.message || "AI service error." });
};

// --- Shared response schema fragments -------------------------------------
const MEAL_SCHEMA = {
  type: Type.OBJECT,
  required: ["start", "duration"],
  properties: {
    start: { type: Type.NUMBER, description: "Start of lunch decimal hour." },
    duration: { type: Type.NUMBER, description: "Meal duration, typically 1 or 0.5." },
  },
} as const;

// Shift shape used by the chat and audit endpoints.
const SHIFT_INPUT_SCHEMA = {
  type: Type.OBJECT,
  required: ["name", "role", "start", "duration"],
  properties: {
    name: { type: Type.STRING },
    role: { type: Type.STRING },
    type: { type: Type.STRING, enum: ["FT", "PT"] },
    start: { type: Type.NUMBER },
    duration: { type: Type.NUMBER },
    meal: MEAL_SCHEMA,
  },
} as const;

// API: Check if Gemini is configured
app.get("/api/gemini/status", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY;
  res.json({
    status: hasKey ? "ok" : "missing_key",
    message: hasKey 
      ? "Gemini API key is configured successfully." 
      : "Gemini API key is missing. Define GEMINI_API_KEY in Settings > Secrets."
  });
});

// API: AI Schedule Generator / Optimizer
app.post("/api/gemini/optimize", async (req, res) => {
  const { targets, currentShifts } = req.body || {};

  if (!isTargetsArray(targets)) {
    return res.status(400).json({ error: `targets must be an array of ${DAY_SLOTS} numbers.` });
  }
  if (currentShifts !== undefined && !isShiftArray(currentShifts)) {
    return res.status(400).json({ error: `currentShifts must be an array of at most ${MAX_SHIFTS} shifts.` });
  }

  try {
    const ai = getGeminiClient();

    const systemPrompt = `You are an expert AI Scheduler for general operations.
Your task is to generate and optimize a shift schedule to perfectly match the per-hour staffing targets.
Each hour starts at 5 (5 am) and ends at 22 (10 pm). There are 17 hour slots.
Provide a list of recommended shifts. Try to cover gaps with standard roles: "Cashier", "Supervisor", "Barista", "Stocker", "Digital Shopper", "Baker".
Full-time (FT) shifts should be 8 to 9 hours and have a 1-hour meal (duration: 1) starting around 4 hours after shift start.
Part-time (PT) shifts should be 4 to 6 hours with no meal (duration: 0).
When considering existing shifts, please prioritize keeping them as the foundation and strategically suggesting additional 4-hour part-time (PT) shifts to cover specific gaps, particularly the 1-hour drops in coverage caused by full-time staff lunch breaks.
Maintain realistic shift boundaries (starts >= 5, ends <= 22).
Your output must be structured strictly as JSON matching the requested schema.`;

    const userPrompt = `Targets (17 hours from 5 to 22): ${JSON.stringify(targets)}.
Current active shifts: ${JSON.stringify(currentShifts)}.
Please optimize this schedule by:
1. Keeping or complementing the existing shifts.
2. Identifying the gaps where staffing is below target, especially drops in coverage when full-time employees are taking their 1-hour meal breaks.
3. Suggesting additional 4-hour shifts (PT, duration: 4) with clean start times (e.g., integers or .5 decimals) specifically scheduled to bridge these gaps.
4. Keeping names realistic (e.g., "Sarah Chen", "John Doe", "Alex Rivera", "David Kim", "Emily Wright", "Marcus Aurelius", "Sophia Martinez", "Liam Patel", "Chloe Thompson").
5. Outputting a fully balanced, optimized final schedule of shifts that minimizes under-staffing (red) and unnecessary over-staffing surplus (purple) while matching targets as closely as possible.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["shifts", "reasoning"],
          properties: {
            reasoning: {
              type: Type.STRING,
              description: "A short, helpful summary explaining your scheduling strategy."
            },
            shifts: {
              type: Type.ARRAY,
              description: "The list of suggested shifts.",
              items: {
                type: Type.OBJECT,
                required: ["name", "role", "type", "start", "duration"],
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["FT", "PT"] },
                  start: { 
                    type: Type.NUMBER, 
                    description: "The start decimal hour, between 5 and 21. Supports half-hours (e.g. 8.5)." 
                  },
                  duration: { 
                    type: Type.NUMBER, 
                    description: "Duration of the shift in hours, generally 4 to 8." 
                  },
                  meal: MEAL_SCHEMA
                }
              }
            }
          }
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (err: any) {
    sendModelError(res, "Optimize", err);
  }
});

// API: AI Schedule Builder Chat / Natural Language Sandbox
app.post("/api/gemini/chat", async (req, res) => {
  const { message, currentShifts, targets } = req.body || {};

  if (typeof message !== "string" || message.trim().length === 0 || message.length > 2000) {
    return res.status(400).json({ error: "message must be a non-empty string (max 2000 chars)." });
  }
  if (currentShifts !== undefined && !isShiftArray(currentShifts)) {
    return res.status(400).json({ error: `currentShifts must be an array of at most ${MAX_SHIFTS} shifts.` });
  }
  if (targets !== undefined && !isTargetsArray(targets)) {
    return res.status(400).json({ error: `targets must be an array of ${DAY_SLOTS} numbers.` });
  }

  try {
    const ai = getGeminiClient();

    const systemPrompt = `You are ShiftSync Copilot, a helpful AI schedule builder.
The user is managing a roster of shifts for a business operating from 5 AM to 10 PM.
You can execute mutations to modify the roster based on user natural language commands.
Supported mutations are actions the client will apply:
1. "add_shift": add a new shift (properties: name, role, type: "FT"|"PT", start: number, duration: number, meal?: {start: number, duration: number})
2. "delete_shift": delete a shift by its id
3. "clear_all": clear the schedule completely
4. "set_targets": replace targets with new ones

You can output multiple mutations in order to fulfil the request.
Example: If they say "Add a cashier shift 9am to 5pm called Chloe with 1 hour lunch at 1pm", return:
mutations: [{ type: "add_shift", shift: { name: "Chloe", role: "Cashier", type: "FT", start: 9, duration: 8, meal: { start: 13, duration: 1 } } }].

Your response must be JSON containing a structured message detailing your action and the list of mutations.`;

    const userPrompt = `Message: "${message}"
Current Shifts: ${JSON.stringify(currentShifts)}
Targets: ${JSON.stringify(targets)}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["message", "mutations"],
          properties: {
            message: {
              type: Type.STRING,
              description: "Friendly conversational description of what was completed."
            },
            mutations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["type"],
                properties: {
                  type: { type: Type.STRING, enum: ["add_shift", "delete_shift", "clear_all", "set_targets"] },
                  shift: {
                    ...SHIFT_INPUT_SCHEMA,
                    description: "Parameters for adding a shift"
                  },
                  shiftId: {
                    type: Type.STRING,
                    description: "ID of the shift to delete"
                  },
                  targets: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description: "Modified targets array (17 integers)"
                  }
                }
              }
            }
          }
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (err: any) {
    sendModelError(res, "Chat", err);
  }
});

// API: Schedule Audit / Health Check
app.post("/api/gemini/audit", async (req, res) => {
  const { shifts, targets } = req.body || {};

  if (!isShiftArray(shifts)) {
    return res.status(400).json({ error: `shifts must be an array of at most ${MAX_SHIFTS} shifts.` });
  }
  if (!isTargetsArray(targets)) {
    return res.status(400).json({ error: `targets must be an array of ${DAY_SLOTS} numbers.` });
  }

  try {
    const ai = getGeminiClient();

    const systemPrompt = `You are a compliance and coverage auditor for retail and hospitality scheduling.
Your job is to audit the active scheduling blocks against the daily staffing targets (17 slots, 5am to 10pm) and standards:
1. Hourly Gaps: Look for hours where Scheduled count is less than Target.
2. Meal breaks: Any full-time shift (FT, duration >= 8h) MUST have a meal break. If it is missing, or scheduled outside the shift's active hours, trigger a warning.
3. Fatigue: Any shift duration greater than 10 hours is a fatigue warning.
Calculate a general healthScore (0 to 100) based on coverage and warnings.
For each problem, present a clear, action-oriented correction. Where possible, attach a structured suggestedAction the user can apply immediately:
- "add_shift" with a "shift" object to cover a gap.
- "delete_shift" with a "shiftId" to remove a redundant shift.
- "adjust_shift" with a "shiftId" and a partial "shift" object to fix timing or meal placement.`;

    const userPrompt = `Shifts to audit: ${JSON.stringify(shifts)}.
Targets: ${JSON.stringify(targets)}.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["healthScore", "findings", "recommendations"],
          properties: {
            healthScore: { 
              type: Type.INTEGER, 
              description: "Overall schedule score (0 to 100) representing adequacy & compliance." 
            },
            findings: {
              type: Type.ARRAY,
              description: "Audit findings (gaps, meal violations, overtime, etc.).",
              items: {
                type: Type.OBJECT,
                required: ["type", "severity", "message"],
                properties: {
                  type: { 
                    type: Type.STRING, 
                    enum: ["gap", "meal_violation", "fatigue", "overstaffing", "other"] 
                  },
                  severity: { type: Type.STRING, enum: ["critical", "warning", "info"] },
                  message: { type: Type.STRING, description: "Visual descriptions of the warning." },
                  hour: { type: Type.NUMBER, description: "Hour slot where the problem occurs (optional)." },
                  suggestedAction: {
                    type: Type.OBJECT,
                    description: "Optional structure to auto-apply a correction directly to the schedule.",
                    required: ["type"],
                    properties: {
                      type: { type: Type.STRING, enum: ["add_shift", "delete_shift", "adjust_shift"] },
                      shiftId: { type: Type.STRING, description: "Target shift id for delete_shift or adjust_shift." },
                      shift: SHIFT_INPUT_SCHEMA
                    }
                  }
                }
              }
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "General written advice to optimize operations."
            }
          }
        }
      }
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (err: any) {
    sendModelError(res, "Audit", err);
  }
});

// Vite & Static file servicing configuration
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express custom server running on http://0.0.0.0:${PORT}`);
  });
};

startServer();
