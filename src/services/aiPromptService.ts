import type { AgentPromptProfile } from "@/types/aiPrompt";

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API || process.env.REACT_APP_OPENAI_API_KEY;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

export interface ExtractionResult {
  extractedProfile: Partial<AgentPromptProfile>;
  missingFields: string[];
}

export interface AgentFormData {
  agentName?: string;
  companyName?: string;
  websiteUrl?: string;
  goal?: string;
  backgroundContext?: string;
  instructionVoice?: string;
  script?: string;
  language?: string;
  timezone?: string;
  agentType?: string;
  tool?: string;
  voice?: string;
  temperature?: number;
  confidence?: number;
  verbosity?: number;
}

export interface PromptGenerationResult {
  status: "success";
  finalPrompt: string;
  welcomeMessages?: string[];
  formData?: AgentFormData;
  agentProfile?: Partial<AgentPromptProfile>;
}

/**
 * Agent A: Document Profile Extractor
 */
export async function extractDocumentProfile(
  documentText: string
): Promise<ExtractionResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/extract-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: documentText }),
    });
    if (!response.ok) throw new Error("Failed to extract profile from document");
    return await response.json();
  } catch (error: any) {
    console.error("Error extracting profile:", error);
    return {
      extractedProfile: {},
      missingFields: ["companyName", "businessIndustry", "agentPurpose", "targetAudience", "callGoal", "services"],
    };
  }
}

/**
 * Agent B: Generate prompt using OpenAI directly from frontend
 */
// Get system prompt from environment variable or use default
const getPromptGenerationSystemPrompt = (): string => {
  const envPrompt = process.env.REACT_APP_AI_PROMPT_GENERATOR_SYSTEM_PROMPT;
  if (envPrompt) {
    return envPrompt.replace(/\\n/g, '\n');
  }
  
  // Default system prompt
  return `You are an expert AI voice agent prompt engineer. Based on the provided company profile, generate a comprehensive, production-ready system prompt for an inbound calling AI voice agent.

IMPORTANT: NEVER ask clarification questions. ALWAYS generate the best possible prompt using the information provided. If some fields are missing, use reasonable professional defaults and make the prompt as complete as possible.

The prompt you generate must be detailed, professional, and cover:
1. Agent identity and role
2. Company background and services
3. Conversation flow and guidelines
4. Objection handling
5. Call goals and success criteria
6. Tone and personality instructions
7. Escalation procedures
8. Data collection requirements
9. Closing procedures

Also generate 5-7 unique welcome/greeting messages the agent can use. Each should be natural, professional, and use {name} as a placeholder for personalization.

Return ONLY a JSON object with this exact structure:
{
  "finalPrompt": "the complete system prompt text",
  "welcomeMessages": ["greeting 1", "greeting 2", ...],
  "status": "success"
}

Always set status to "success". Never return needs_clarification.`;
};

export async function generatePromptFromProfile(
  profile: Partial<AgentPromptProfile>,
  documentText?: string
): Promise<PromptGenerationResult> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured. Please set REACT_APP_OPENAI_API in your .env.local file.");
  }

  const systemPrompt = getPromptGenerationSystemPrompt();

  const userMessage = `Generate a comprehensive voice agent prompt for this company profile:

Company: ${profile.companyName || "Not specified"}
Industry: ${profile.businessIndustry || "Not specified"}
Description: ${profile.businessDescription || "Not specified"}
Agent Purpose: ${profile.agentPurpose || "Not specified"}
Call Type: ${profile.callType || "Not specified"}
Target Audience: ${profile.targetAudience || "Not specified"}
Call Goal: ${profile.callGoal || "Not specified"}
Tone: ${profile.tone || "Friendly"}

Services: ${profile.services?.join(", ") || "Not specified"}

${profile.companyAddress ? `Address: ${profile.companyAddress}` : ""}
${profile.companyWebsite ? `Website: ${profile.companyWebsite}` : ""}
${profile.companyEmail ? `Email: ${profile.companyEmail}` : ""}
${profile.companyPhone ? `Phone: ${profile.companyPhone}` : ""}
${profile.pricingInfo ? `Pricing: ${profile.pricingInfo}` : ""}
${profile.businessHours ? `Business Hours: ${profile.businessHours}` : ""}
${profile.bookingMethod ? `Booking Method: ${profile.bookingMethod}` : ""}
${profile.appointmentRules ? `Appointment Rules: ${profile.appointmentRules}` : ""}
${profile.escalationProcess ? `Escalation: ${profile.escalationProcess}` : ""}
${profile.requiredCustomerFields?.length ? `Required Fields: ${profile.requiredCustomerFields.join(", ")}` : ""}
${profile.faqs?.length ? `FAQs:\n${profile.faqs.map((f, i) => `${i + 1}. ${f}`).join("\n")}` : ""}
${profile.objections?.length ? `Objections:\n${profile.objections.map((o, i) => `${i + 1}. ${o}`).join("\n")}` : ""}
${profile.policies?.length ? `Policies:\n${profile.policies.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : ""}
${profile.languages?.length ? `Languages: ${profile.languages.join(", ")}` : ""}
${documentText ? `\n--- UPLOADED COMPANY DOCUMENT ---\nUse the following document content as additional context to generate a more accurate and detailed prompt:\n\n${documentText}\n--- END OF DOCUMENT ---` : ""}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("No response from OpenAI");

    const parsed = JSON.parse(content);
    return {
      status: "success" as const,
      finalPrompt: parsed.finalPrompt || "",
      welcomeMessages: parsed.welcomeMessages || [],
      formData: parsed.formData || undefined,
      agentProfile: parsed.agentProfile || undefined,
    };
  } catch (error: any) {
    console.error("Error generating prompt:", error);
    throw error;
  }
}

/**
 * Agent C: Prompt Formatter
 */
// Get prompt formatter system prompt from environment variable or use default
const getPromptFormatterSystemPrompt = (): string => {
  const envPrompt = process.env.REACT_APP_AI_PROMPT_FORMATTER_SYSTEM_PROMPT;
  if (envPrompt) {
    return envPrompt.replace(/\\n/g, '\n');
  }
  
  // Default system prompt - updated to request JSON format
  return `You are an expert prompt formatter. Take the raw, unstructured prompt provided and restructure it into a clear, professional AI voice agent system prompt. Organize it with clear sections, proper formatting, and professional language.\n\nReturn ONLY a JSON object with this exact structure:\n{\n  "formattedPrompt": "The formatted, professional system prompt text",\n  "formData": {\n    "agentName": "Extracted or inferred agent name",\n    "companyName": "Extracted company name",\n    "websiteUrl": "Extracted website URL or empty string",\n    "goal": "Extracted call goal",\n    "backgroundContext": "Extracted background context",\n    "instructionVoice": "Extracted voice instructions",\n    "script": "Same as formattedPrompt",\n    "language": "Extracted language code or 'en-US'",\n    "timezone": "Extracted timezone or 'America/New_York'",\n    "agentType": "Inferred: 'sales', 'support', 'booking', 'billing', 'complaint', or 'general'",\n    "tool": "Inferred: 'crm', 'calendar', 'email', 'sms', or empty string",\n    "voice": "Default 'helena'",\n    "temperature": 0.7,\n    "confidence": 0.8,\n    "verbosity": 0.7\n  },\n  "welcomeMessages": ["Extracted or generated welcome message 1", "message 2", "message 3", "message 4", "message 5"]\n}\n\nExtract all available information from the prompt and structure it properly.`;
};

export interface FormatPromptResult {
  formattedPrompt: string;
  formData?: AgentFormData;
  welcomeMessages?: string[];
}

export async function formatRawPrompt(rawPrompt: string): Promise<FormatPromptResult> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured.");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: getPromptFormatterSystemPrompt(),
          },
          { role: "user", content: rawPrompt },
        ],
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      console.error("Formatter API error:", errorData);
      throw new Error(errorData.error?.message || `Failed to format prompt: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content || !content.trim()) {
      console.error("Formatter: No content in response", data);
      // Fallback: return formatted version of raw prompt
      return {
        formattedPrompt: rawPrompt.trim() ? `You are an AI voice agent assistant.\n\n${rawPrompt}\n\nPlease respond professionally and helpfully to user queries.` : rawPrompt,
        formData: undefined,
        welcomeMessages: [],
      };
    }

    try {
      // Try to parse as JSON (new structured format)
      const parsed = JSON.parse(content);
      console.log("Formatter: Successfully parsed JSON response", parsed);
      
      // Validate that we have at least formattedPrompt
      if (parsed.formattedPrompt && parsed.formattedPrompt.trim()) {
        return {
          formattedPrompt: parsed.formattedPrompt.trim(),
          formData: parsed.formData || undefined,
          welcomeMessages: parsed.welcomeMessages || [],
        };
      } else if (parsed.formattedPrompt) {
        // Empty string formattedPrompt - use content as fallback
        console.warn("Formatter: formattedPrompt is empty, using raw content");
        return {
          formattedPrompt: content.trim() || rawPrompt,
          formData: parsed.formData || undefined,
          welcomeMessages: parsed.welcomeMessages || [],
        };
      } else {
        // If JSON but no formattedPrompt field, check if content itself is the prompt
        console.warn("Formatter: JSON response missing formattedPrompt field");
        // Try to extract prompt from other fields or use content
        const extractedPrompt = parsed.prompt || parsed.text || parsed.content || content;
        return {
          formattedPrompt: extractedPrompt.trim() || rawPrompt,
          formData: parsed.formData || undefined,
          welcomeMessages: parsed.welcomeMessages || [],
        };
      }
    } catch (parseError) {
      // If not JSON, treat as plain text (backward compatibility)
      console.warn("Formatter: Response is not valid JSON, treating as plain text:", parseError);
      console.log("Formatter: Raw content preview:", content.substring(0, 200));
      
      // Clean up the content - remove any markdown code blocks if present
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith('```')) {
        // Remove markdown code blocks
        cleanedContent = cleanedContent.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
      }
      
      return {
        formattedPrompt: cleanedContent || rawPrompt,
        formData: undefined,
        welcomeMessages: [],
      };
    }
  } catch (error: any) {
    console.error("Error formatting prompt:", error);
    // Fallback on error
    return {
      formattedPrompt: `You are an AI assistant. ${rawPrompt}\n\nPlease respond professionally and helpfully to user queries.`,
      formData: undefined,
      welcomeMessages: [],
    };
  }
}
