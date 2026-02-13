import type { AgentPromptProfile } from "@/types/aiPrompt";

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API || process.env.REACT_APP_OPENAI_API_KEY;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

export interface ExtractionResult {
  extractedProfile: Partial<AgentPromptProfile>;
  missingFields: string[];
}

export interface PromptGenerationResult {
  status: "success";
  finalPrompt: string;
  welcomeMessages?: string[];
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
export async function generatePromptFromProfile(
  profile: Partial<AgentPromptProfile>
): Promise<PromptGenerationResult> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured. Please set REACT_APP_OPENAI_API in your .env.local file.");
  }

  const systemPrompt = `You are an expert AI voice agent prompt engineer. Based on the provided company profile, generate a comprehensive, production-ready system prompt for an inbound calling AI voice agent.

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
${profile.languages?.length ? `Languages: ${profile.languages.join(", ")}` : ""}`;

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
    };
  } catch (error: any) {
    console.error("Error generating prompt:", error);
    throw error;
  }
}

/**
 * Agent C: Prompt Formatter
 */
export async function formatRawPrompt(rawPrompt: string): Promise<string> {
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
            content: `You are an expert prompt formatter. Take the raw, unstructured prompt provided and restructure it into a clear, professional AI voice agent system prompt. Organize it with clear sections, proper formatting, and professional language. Return ONLY the formatted prompt text, no JSON wrapper.`,
          },
          { role: "user", content: rawPrompt },
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) throw new Error("Failed to format prompt");

    const data = await response.json();
    return data.choices[0]?.message?.content || rawPrompt;
  } catch (error: any) {
    console.error("Error formatting prompt:", error);
    return `You are an AI assistant. ${rawPrompt}\n\nPlease respond professionally and helpfully to user queries.`;
  }
}
