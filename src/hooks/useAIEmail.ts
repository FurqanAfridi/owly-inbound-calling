import { useState } from "react";
import { toast } from "./use-toast";

interface GenerateTemplateOptions {
  name: string;
  description?: string;
  emailType: "follow-up" | "thank-you" | "appointment" | "custom";
  tone: "professional" | "friendly" | "casual" | "formal";
}

interface GenerateEmailOptions {
  leadInfo?: {
    contact_name?: string;
    phone_number?: string;
    company_name?: string;
    call_date?: string;
  };
  emailType: "follow-up" | "thank-you" | "appointment" | "custom";
  tone: "professional" | "friendly" | "casual" | "formal";
}

interface GeneratedContent {
  subject: string;
  body: string;
}

// Mock AI generation - in production, this would call an actual AI API
const generateWithAI = async (
  prompt: string,
  type: string,
  tone: string
): Promise<GeneratedContent> => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Mock responses based on type and tone
  const responses: Record<string, Record<string, GeneratedContent>> = {
    "follow-up": {
      professional: {
        subject: "Follow-up: Thank you for your interest",
        body: "Dear {{contact_name}},\n\nThank you for taking the time to speak with us. We appreciate your interest in our services.\n\nWe would like to follow up on our conversation and answer any questions you may have.\n\nPlease feel free to reach out to us at your convenience.\n\nBest regards,\n{{company_name}}",
      },
      friendly: {
        subject: "Following up on our conversation",
        body: "Hi {{contact_name}},\n\nIt was great talking with you! I wanted to follow up and see if you have any questions about what we discussed.\n\nI'm here to help, so don't hesitate to reach out.\n\nLooking forward to hearing from you!\n\nBest,\n{{company_name}}",
      },
      casual: {
        subject: "Quick follow-up",
        body: "Hey {{contact_name}},\n\nJust wanted to check in after our call. Let me know if you need anything!\n\nThanks,\n{{company_name}}",
      },
      formal: {
        subject: "Follow-up Communication",
        body: "Dear {{contact_name}},\n\nI am writing to follow up on our recent conversation. I trust this message finds you well.\n\nWe remain at your disposal should you require any additional information or clarification.\n\nYours sincerely,\n{{company_name}}",
      },
    },
    "thank-you": {
      professional: {
        subject: "Thank you for your time",
        body: "Dear {{contact_name}},\n\nThank you for taking the time to speak with us today. We truly appreciate your interest and the opportunity to discuss how we can assist you.\n\nWe look forward to the possibility of working together.\n\nBest regards,\n{{company_name}}",
      },
      friendly: {
        subject: "Thanks for the great conversation!",
        body: "Hi {{contact_name}},\n\nThanks so much for taking the time to chat with us! It was really great talking with you.\n\nWe're excited about the possibility of working together and would love to continue the conversation.\n\nTalk soon!\n\nBest,\n{{company_name}}",
      },
      casual: {
        subject: "Thanks!",
        body: "Hey {{contact_name}},\n\nThanks for the call! Really enjoyed chatting with you.\n\nLet's keep in touch!\n\nThanks,\n{{company_name}}",
      },
      formal: {
        subject: "Expression of Gratitude",
        body: "Dear {{contact_name}},\n\nI wish to express my sincere gratitude for the time you dedicated to our conversation. Your insights were most valuable.\n\nWe remain committed to providing you with the highest level of service.\n\nRespectfully yours,\n{{company_name}}",
      },
    },
    appointment: {
      professional: {
        subject: "Appointment Confirmation",
        body: "Dear {{contact_name}},\n\nThis email confirms your upcoming appointment with us.\n\nWe look forward to meeting with you and discussing your needs in detail.\n\nIf you need to reschedule, please let us know at least 24 hours in advance.\n\nBest regards,\n{{company_name}}",
      },
      friendly: {
        subject: "Looking forward to our meeting!",
        body: "Hi {{contact_name}},\n\nJust confirming our upcoming appointment! We're really looking forward to meeting with you.\n\nIf anything comes up and you need to reschedule, just give us a call.\n\nSee you soon!\n\nBest,\n{{company_name}}",
      },
      casual: {
        subject: "Appointment reminder",
        body: "Hey {{contact_name}},\n\nQuick reminder about our appointment. Looking forward to it!\n\nLet me know if you need to change anything.\n\nThanks,\n{{company_name}}",
      },
      formal: {
        subject: "Appointment Confirmation and Details",
        body: "Dear {{contact_name}},\n\nThis correspondence serves to confirm your scheduled appointment. We anticipate a productive meeting.\n\nShould you require any modifications to the scheduled time, please notify us at your earliest convenience.\n\nYours faithfully,\n{{company_name}}",
      },
    },
    custom: {
      professional: {
        subject: "Regarding our conversation",
        body: "Dear {{contact_name}},\n\nI am writing to you regarding our recent conversation. We appreciate the opportunity to connect with you.\n\nPlease let us know if you have any questions or require further information.\n\nBest regards,\n{{company_name}}",
      },
      friendly: {
        subject: "Reaching out",
        body: "Hi {{contact_name}},\n\nJust wanted to reach out after our conversation. Hope you're doing well!\n\nFeel free to get in touch if you need anything.\n\nBest,\n{{company_name}}",
      },
      casual: {
        subject: "Quick note",
        body: "Hey {{contact_name}},\n\nJust wanted to touch base after our call. Let me know if you need anything!\n\nThanks,\n{{company_name}}",
      },
      formal: {
        subject: "Further to our discussion",
        body: "Dear {{contact_name}},\n\nFurther to our recent discussion, I am writing to provide you with additional information.\n\nWe remain available to address any queries you may have.\n\nYours sincerely,\n{{company_name}}",
      },
    },
  };

  return responses[type]?.[tone] || responses["follow-up"]["professional"];
};

export const useAIEmail = () => {
  const [generating, setGenerating] = useState(false);

  const generateTemplate = async (
    options: GenerateTemplateOptions
  ): Promise<GeneratedContent | null> => {
    setGenerating(true);
    try {
      const prompt = `Generate an email template for: ${options.name}. Type: ${options.emailType}, Tone: ${options.tone}`;
      const result = await generateWithAI(prompt, options.emailType, options.tone);
      return result;
    } catch (error: any) {
      console.error("Error generating template:", error);
      toast({
        title: "Error",
        description: "Failed to generate email template",
        variant: "destructive",
      });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const generateEmail = async (
    options: GenerateEmailOptions
  ): Promise<GeneratedContent | null> => {
    setGenerating(true);
    try {
      const prompt = `Generate an email. Type: ${options.emailType}, Tone: ${options.tone}`;
      const result = await generateWithAI(prompt, options.emailType, options.tone);

      // Replace placeholders with actual values
      if (options.leadInfo) {
        Object.keys(options.leadInfo).forEach((key) => {
          const value = options.leadInfo?.[key as keyof typeof options.leadInfo] || "";
          result.subject = result.subject.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, "g"),
            value
          );
          result.body = result.body.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, "g"),
            value
          );
        });
      }

      return result;
    } catch (error: any) {
      console.error("Error generating email:", error);
      toast({
        title: "Error",
        description: "Failed to generate email",
        variant: "destructive",
      });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return {
    generateTemplate,
    generateEmail,
    generating,
  };
};
