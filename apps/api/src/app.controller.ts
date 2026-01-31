import { Controller, Get, Post, Query } from "@nestjs/common";
import { AppService } from "./app.service";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get("health")
  health() {
    return this.appService.getHealth();
  }

  /**
   * Test endpoint to verify Gemini API connection.
   * Usage: GET /api/test-ai?key=lumira2026
   */
  @Get("test-ai")
  async testAI(@Query("key") key: string) {
    // Simple protection
    if (key !== "lumira2026") {
      return { error: "Invalid key" };
    }

    const apiKey = this.configService.get<string>("GEMINI_API_KEY");
    
    if (!apiKey) {
      return {
        status: "error",
        message: "GEMINI_API_KEY not configured",
        timestamp: new Date().toISOString(),
      };
    }

    const results: Record<string, any> = {
      timestamp: new Date().toISOString(),
      apiKeyPrefix: apiKey.substring(0, 10) + "...",
      models: {},
    };

    const modelsToTest = [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
    ];

    const genAI = new GoogleGenerativeAI(apiKey);

    for (const modelName of modelsToTest) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const startTime = Date.now();
        
        const response = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: 'Réponds uniquement "OK".' }] }],
        });
        
        const text = response.response.text();
        const elapsed = Date.now() - startTime;
        
        results.models[modelName] = {
          status: "✅ OK",
          response: text.substring(0, 50),
          latencyMs: elapsed,
        };
      } catch (error: any) {
        results.models[modelName] = {
          status: "❌ FAILED",
          error: error.message?.substring(0, 100) || "Unknown error",
        };
      }
    }

    // Test JSON mode specifically (used by SCRIBE/GUIDE)
    try {
      const jsonModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        },
      });
      
      const startTime = Date.now();
      const response = await jsonModel.generateContent({
        contents: [{
          role: "user",
          parts: [{ text: 'Génère: {"test": true, "status": "ok"}' }],
        }],
      });
      
      const text = response.response.text();
      JSON.parse(text); // Validate JSON
      
      results.jsonMode = {
        status: "✅ OK",
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      results.jsonMode = {
        status: "❌ FAILED",
        error: error.message?.substring(0, 100) || "Unknown error",
      };
    }

    // Mini Oracle test (simulate SCRIBE prompt)
    try {
      const oracleModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 1024,
        },
      });
      
      const startTime = Date.now();
      const response = await oracleModel.generateContent({
        contents: [{
          role: "user",
          parts: [{
            text: `Tu es Oracle Lumira. Génère un JSON avec:
{
  "archetype": "Le Guide",
  "message": "Un court message spirituel de bienvenue (2 phrases max)",
  "keywords": ["mot1", "mot2", "mot3"]
}`,
          }],
        }],
      });
      
      const text = response.response.text();
      const parsed = JSON.parse(text);
      
      results.oracleTest = {
        status: "✅ OK",
        archetype: parsed.archetype,
        message: parsed.message?.substring(0, 100),
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      results.oracleTest = {
        status: "❌ FAILED",
        error: error.message?.substring(0, 100) || "Unknown error",
      };
    }

    return results;
  }
}
