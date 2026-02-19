import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { AgentPromptProfile } from "@/types/aiPrompt";

export interface AIPrompt {
  id: string;
  user_id: string;
  name: string;
  category: string;
  system_prompt: string;
  begin_message?: string | null;
  state_prompts?: Record<string, any> | null;
  tools_config?: Record<string, any> | null;
  agent_profile?: Partial<AgentPromptProfile> | null;
  welcome_messages?: string[] | null;
  call_type?: string | null;
  call_goal?: string | null;
  tone?: string | null;
  status?: string | null;
  is_active: boolean;
  is_template: boolean;
  usage_count?: number;
  created_at: string;
  updated_at?: string;
  form_data?: Record<string, any> | null; // Structured form data for auto-filling agent creation form
}

export const useAIPrompts = () => {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPrompts();
    } else {
      setPrompts([]);
      setLoading(false);
    }
  }, [user]);

  const fetchPrompts = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching prompts:", error);
        setPrompts([]);
      } else {
        setPrompts(data || []);
      }
    } catch (error: any) {
      console.error("Error fetching prompts:", error);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  };

  const createPrompt = async (promptData: Partial<AIPrompt>): Promise<AIPrompt | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("ai_prompts")
        .insert({
          ...promptData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await fetchPrompts();
      return data;
    } catch (error: any) {
      console.error("Error creating prompt:", error);
      throw error;
    }
  };

  const updatePrompt = async (id: string, updates: Partial<AIPrompt>): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("ai_prompts")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      await fetchPrompts();
      return true;
    } catch (error: any) {
      console.error("Error updating prompt:", error);
      return false;
    }
  };

  const deletePrompt = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Soft delete
      const { error } = await supabase
        .from("ai_prompts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      await fetchPrompts();
      return true;
    } catch (error: any) {
      console.error("Error deleting prompt:", error);
      return false;
    }
  };

  const getUserPrompts = (): AIPrompt[] => {
    return prompts;
  };

  const getActivePrompts = (): AIPrompt[] => {
    return prompts.filter(p => p.is_active && p.status === "ready");
  };

  return {
    prompts,
    loading,
    createPrompt,
    updatePrompt,
    deletePrompt,
    getUserPrompts,
    getActivePrompts,
    refetch: fetchPrompts,
  };
};
