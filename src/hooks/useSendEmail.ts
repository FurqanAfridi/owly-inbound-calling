import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "./use-toast";
import { convertToHtmlEmail, EmailDesignStyle } from "@/lib/htmlEmail";

interface SendEmailOptions {
  fromEmail: string;
  toEmail: string;
  toPhoneNumber?: string;
  subject: string;
  body: string;
  smtpPassword?: string;
  designStyle?: EmailDesignStyle;
  accentColor?: string;
  companyName?: string;
}

// Get backend URL from environment variable
// This should point to your backend server that handles email sending
const getBackendUrl = () => {
  const envBackendUrl = process.env.REACT_APP_BACKEND_URL;
  
  console.log('[Email Hook] Environment variable REACT_APP_BACKEND_URL:', envBackendUrl);
  
  // If no environment variable is set, use default localhost:3001
  // This assumes your backend server is running on port 3001
  if (!envBackendUrl) {
    console.warn('[Email Hook] REACT_APP_BACKEND_URL is not set. Using default: http://localhost:3001');
    return 'http://localhost:3001';
  }
  
  // Ensure it's a full URL (not relative)
  if (!envBackendUrl.startsWith('http://') && !envBackendUrl.startsWith('https://')) {
    return `http://${envBackendUrl}`;
  }
  return envBackendUrl;
};

export const useSendEmail = () => {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  const sendEmail = async (options: SendEmailOptions): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    if (!options.smtpPassword) {
      return { success: false, error: "SMTP password is required" };
    }

    setSending(true);
    let logData: any = null;

    try {
      // Convert body to HTML email
      const htmlBody = convertToHtmlEmail(
        options.subject,
        options.body,
        {
          previewMode: false,
          style: options.designStyle || "modern",
          accentColor: options.accentColor || "#4F46E5",
          companyName: options.companyName,
        }
      );

      // Create email log entry
      const { data: logDataResult, error: logError } = await supabase
        .from("email_logs")
        .insert({
          user_id: user.id,
          from_email: options.fromEmail,
          to_email: options.toEmail,
          to_phone_number: options.toPhoneNumber || null,
          subject: options.subject,
          body: options.body,
          status: "pending",
        })
        .select()
        .single();

      if (logError) {
        console.error("Error creating email log:", logError);
      } else {
        logData = logDataResult;
      }

      // Get backend URL for email sending
      // The backend uses the user's SMTP credentials from the database to send emails
      const backendUrl = getBackendUrl();
      
      console.log('[Email Hook] Backend URL:', backendUrl);
      
      // Remove trailing slash if present and construct full URL
      const cleanBackendUrl = backendUrl.replace(/\/$/, '');
      const emailEndpoint = `${cleanBackendUrl}/email`;
      
      // Ensure we're using an absolute URL
      if (!emailEndpoint.startsWith('http://') && !emailEndpoint.startsWith('https://')) {
        throw new Error(`Invalid backend URL: ${emailEndpoint}. Must be an absolute URL.`);
      }
      
      // Call backend API to send email using user's SMTP credentials
      // The backend will use the smtp_password to authenticate and send the email
      console.log('[Email Hook] Calling backend endpoint:', emailEndpoint);
      
      const response = await fetch(emailEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_email: options.fromEmail, // User's email from database
          to_email: options.toEmail,
          subject: options.subject,
          body: options.body,
          html_body: htmlBody,
          smtp_password: options.smtpPassword, // SMTP password from database
        }),
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        console.error('[Email Hook] Non-JSON response received:', textResponse.substring(0, 200));
        
        // If we got HTML, it means we hit the wrong endpoint (probably React dev server)
        if (textResponse.trim().startsWith('<!DOCTYPE') || textResponse.trim().startsWith('<html')) {
          throw new Error(
            `Backend server not found at ${emailEndpoint}. ` +
            `Please ensure your backend server is running and REACT_APP_BACKEND_URL is correctly set in .env file. ` +
            `Received HTML response instead of JSON, which suggests the request went to the React dev server instead of the backend.`
          );
        }
        
        throw new Error(`Invalid response from backend: ${textResponse.substring(0, 100)}`);
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to send email");
      }

      // Update log status to sent
      if (logData) {
        await supabase
          .from("email_logs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", logData.id);
      }

      toast({
        title: "Email Sent",
        description: `Email sent successfully to ${options.toEmail}`,
      });

      return { success: true };
    } catch (error: any) {
      console.error("Error sending email:", error);

      // Update log status to failed if log was created
      if (logData) {
        try {
          await supabase
            .from("email_logs")
            .update({
              status: "failed",
              error_message: error.message || "Failed to send email",
            })
            .eq("id", logData.id);
        } catch (logError) {
          console.error("Error updating email log:", logError);
        }
      } else if (options.toEmail) {
        // Try to find the most recent pending log if we don't have logData
        try {
          const { data: logs } = await supabase
            .from("email_logs")
            .select("id")
            .eq("user_id", user.id)
            .eq("to_email", options.toEmail)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (logs) {
            await supabase
              .from("email_logs")
              .update({
                status: "failed",
                error_message: error.message || "Failed to send email",
              })
              .eq("id", logs.id);
          }
        } catch (logError) {
          console.error("Error updating email log:", logError);
        }
      }

      const errorMessage = error.message || "Failed to send email";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      return { success: false, error: errorMessage };
    } finally {
      setSending(false);
    }
  };

  return {
    sendEmail,
    sending,
  };
};
