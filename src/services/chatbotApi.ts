import { platformKnowledge } from "@/data/platform-knowledge";

const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API || process.env.REACT_APP_OPENAI_API_KEY;

// Get system prompt from environment variable or use default
// Always includes platform knowledge base for accurate answers
const getSystemPrompt = (): string => {
    const envPrompt = process.env.REACT_APP_CHATBOT_SYSTEM_PROMPT;
    
    // Base prompt - either from env or default
    let basePrompt: string;
    if (envPrompt) {
        basePrompt = envPrompt.replace(/\\n/g, '\n');
    } else {
        // Default system prompt
        basePrompt = `You are a helpful AI assistant for DNAI, an AI-powered voice automation platform. 
You help users learn about features like voice agents, inbound numbers, knowledge bases, call schedules, and leads.
Be professional, concise, and helpful. If you don't know the answer, suggest contacting support.`;
    }
    
    // Always append platform knowledge base for accurate answers
    return `${basePrompt}

Use the following platform knowledge base to answer user questions accurately:

${platformKnowledge}

When answering questions:
- Reference specific features and workflows from the knowledge base
- Provide step-by-step instructions when applicable
- Be concise but thorough
- If the answer isn't in the knowledge base, suggest contacting support`;
};

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface ChatResponse {
    response: string;
    session_id?: string;
    message?: string;
}

export const chatbotApi = {
    sendMessage: async (
        message: string,
        history: ChatMessage[],
        sessionId: string,
        userId: string | null
    ): Promise<ChatResponse> => {
        if (!OPENAI_API_KEY) {
            throw new Error("OpenAI API key is not configured.");
        }

        try {
            const systemPrompt = getSystemPrompt();

            const messages: ChatMessage[] = [
                { role: "system", content: systemPrompt },
                ...history
            ];

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: messages,
                    temperature: 0.7,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;

            if (!content) {
                throw new Error("No response from AI assistant");
            }

            return {
                response: content,
                session_id: sessionId
            };
        } catch (error: any) {
            console.error("Chatbot API error:", error);
            throw error;
        }
    }
};
