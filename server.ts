import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini AI
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Smart Categorization endpoint using Gemini
app.post("/api/categorize", async (req, res) => {
  try {
    const { description, amount, type } = req.body;
    if (!description || typeof description !== "string") {
      res.status(400).json({ error: "Description is required" });
      return;
    }

    const ai = getAIClient();
    if (!ai) {
      // Fallback rule-based result if API key is not yet set
      const lower = description.toLowerCase();
      let category = "Miscellaneous";
      let subcategory = "General";
      let suggestedType: "expense" | "income" | "bill" = type || "expense";

      if (lower.includes("starbucks") || lower.includes("coffee") || lower.includes("restaurant") || lower.includes("burger") || lower.includes("pizza") || lower.includes("doordash") || lower.includes("uber eats")) {
        category = "Food & Dining";
        subcategory = "Dining Out";
      } else if (lower.includes("grocery") || lower.includes("walmart") || lower.includes("whole foods") || lower.includes("trader joe") || lower.includes("safeway") || lower.includes("kroger") || lower.includes("costco") || lower.includes("market")) {
        category = "Food & Dining";
        subcategory = "Groceries";
      } else if (lower.includes("uber") || lower.includes("lyft") || lower.includes("gas") || lower.includes("shell") || lower.includes("chevron") || lower.includes("subway") || lower.includes("parking")) {
        category = "Transportation";
        subcategory = "Transit & Fuel";
      } else if (lower.includes("rent") || lower.includes("mortgage") || lower.includes("landlord")) {
        category = "Housing";
        subcategory = "Rent & Mortgage";
        suggestedType = "bill";
      } else if (lower.includes("electric") || lower.includes("water") || lower.includes("utility") || lower.includes("internet") || lower.includes("wifi") || lower.includes("verizon") || lower.includes("at&t")) {
        category = "Utilities";
        subcategory = "Bills";
        suggestedType = "bill";
      } else if (lower.includes("salary") || lower.includes("paycheck") || lower.includes("deposit") || lower.includes("dividend") || lower.includes("freelance") || lower.includes("bonus")) {
        category = "Income";
        subcategory = "Salary & Paycheck";
        suggestedType = "income";
      } else if (lower.includes("netflix") || lower.includes("spotify") || lower.includes("hulu") || lower.includes("disney") || lower.includes("gym") || lower.includes("amazon prime")) {
        category = "Entertainment";
        subcategory = "Subscriptions";
        suggestedType = "bill";
      } else if (lower.includes("amazon") || lower.includes("target") || lower.includes("clothing") || lower.includes("shoes") || lower.includes("apple")) {
        category = "Shopping";
        subcategory = "Retail";
      } else if (lower.includes("doctor") || lower.includes("pharmacy") || lower.includes("cvs") || lower.includes("walgreens") || lower.includes("dentist")) {
        category = "Health & Medical";
        subcategory = "Healthcare";
      }

      res.json({
        category,
        subcategory,
        type: suggestedType,
        tags: [category.toLowerCase().replace(/\s+/g, "-")],
        confidence: 0.85,
        source: "rule-based"
      });
      return;
    }

    const prompt = `You are an automated financial categorization assistant. Analyze this transaction:
Description: "${description}"
${amount ? `Amount: $${amount}` : ""}
${type ? `Specified Type: ${type}` : ""}

Select the most accurate category and subcategory from standard personal finance taxonomies:
Categories:
- Food & Dining (Subcategories: Groceries, Restaurants, Fast Food, Coffee & Snacks, Delivery)
- Transportation (Subcategories: Fuel, Public Transit, Rideshare, Auto Maintenance, Parking & Tolls)
- Housing (Subcategories: Rent, Mortgage, Property Tax, Home Maintenance)
- Utilities (Subcategories: Electricity, Water, Internet, Mobile Phone, Gas)
- Entertainment & Recreation (Subcategories: Subscriptions, Movies & Events, Gaming, Hobbies)
- Shopping (Subcategories: Electronics, Clothing, Household Essentials, Personal Care)
- Health & Wellness (Subcategories: Medical & Pharmacy, Fitness, Insurance, Dental)
- Bills & Obligations (Subcategories: Credit Card Payment, Student Loan, Insurance Premium)
- Income (Subcategories: Salary, Freelance, Investment, Gift, Refund)
- Savings & Investments (Subcategories: Emergency Fund, Retirement, Stocks)
- Miscellaneous (Subcategories: Fees, Other)

Return a valid JSON object with:
{
  "category": "String",
  "subcategory": "String",
  "type": "expense" | "income" | "bill",
  "tags": ["tag1", "tag2"],
  "confidence": 0.95,
  "explanation": "Brief 1-sentence reasoning"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({
      category: parsed.category || "Miscellaneous",
      subcategory: parsed.subcategory || "General",
      type: parsed.type || type || "expense",
      tags: parsed.tags || [],
      confidence: parsed.confidence || 0.9,
      explanation: parsed.explanation || "",
      source: "gemini-ai"
    });
  } catch (error) {
    console.error("Categorization error:", error);
    res.status(500).json({ error: "Failed to categorize transaction" });
  }
});

// Financial Insights & Auto-deduction summary
app.post("/api/insights", async (req, res) => {
  try {
    const { runningBalance, totalBudget, transactions, categoryBudgets } = req.body;
    const ai = getAIClient();

    if (!ai) {
      res.json({
        advice: "Your budget and running balances are tracked. Set up your Gemini API key in Settings for AI insights.",
        status: "normal"
      });
      return;
    }

    const summary = `
Current Running Balance: $${runningBalance}
Monthly Total Budget: $${totalBudget}
Recent Transactions Count: ${transactions?.length || 0}
Category Budgets: ${JSON.stringify(categoryBudgets || {})}
Recent 10 Transactions: ${JSON.stringify((transactions || []).slice(0, 10))}
    `;

    const prompt = `You are a personal automated financial assistant. Review this budget snapshot and provide:
1. A concise 2-sentence summary of budget health (healthy, warning, or critical pacing).
2. 3 concrete action items or tips for the user based on auto-deductions and category spending.
3. Top spending risk area if any.

Data:
${summary}

Return as JSON:
{
  "status": "healthy" | "warning" | "critical",
  "headline": "Short snappy headline",
  "analysis": "2-sentence analysis",
  "recommendations": ["Tip 1", "Tip 2", "Tip 3"],
  "topCategoryRisk": "Category name or 'None'"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("Insights error:", error);
    res.status(500).json({ error: "Failed to generate financial insights" });
  }
});

// Vite middleware / static files setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
