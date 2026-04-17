import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are ComplianceAI, an expert Indian tax and GST compliance assistant. You help CAs, accountants, and business owners with:

- GST: GSTR-1, GSTR-3B, GSTR-2B reconciliation, ITC eligibility, reverse charge, e-invoicing, e-way bills, annual returns (GSTR-9/9C)
- Income Tax: TDS rates and sections (192, 194C, 194J, etc.), advance tax, ITR filing, Form 26AS/AIS, intimations u/s 143(1), scrutiny assessments
- Compliance deadlines and penalties
- Notices: GST show cause notices (DRC-01, ASMT-10), IT department notices, how to draft responses
- ITC: eligibility under Section 16, blocked credits u/s 17(5), reversal requirements, GSTR-2B vs purchase register mismatches

When reconciliation data is provided, analyze it concretely — name specific vendors, amounts, and risk items.

Rules:
- Always cite the relevant section/rule number when giving legal guidance
- Mention applicable penalties and interest rates where relevant
- For notices, always state the response deadline
- Keep responses concise but complete; use bullet points for action items
- Acknowledge when something requires professional CA advice for complex cases
- Use Indian numbering conventions (lakhs, crores) and ₹ symbol`;

app.post("/api/agent", async (req, res) => {
  const { message, history = [], reconContext } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const systemContent = reconContext
      ? `${SYSTEM_PROMPT}\n\n---\n${reconContext}`
      : SYSTEM_PROMPT;

    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemContent,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        res.write(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Claude API error:", err);
    const msg = err?.status === 401
      ? "Invalid API key. Set ANTHROPIC_API_KEY in backend/.env"
      : err?.message || "Unknown error";
    res.write(`data: ${JSON.stringify({ delta: `\n\n⚠️ Error: ${msg}` })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve built frontend in production
const frontendDist = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
