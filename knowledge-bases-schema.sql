-- ============================================
-- Knowledge Bases Database Schema
-- ============================================
-- This file contains the database tables for managing reusable knowledge bases
-- Run this in your Supabase SQL Editor

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. KNOWLEDGE BASES TABLE
-- ============================================
-- Main table for storing knowledge base configurations
CREATE TABLE IF NOT EXISTS public.knowledge_bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic Information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- 2. KNOWLEDGE BASE FAQs TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_base_faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
    
    -- FAQ Content
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100),
    priority INTEGER DEFAULT 0, -- Higher priority FAQs appear first
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Ordering
    display_order INTEGER DEFAULT 0
);

-- ============================================
-- 3. KNOWLEDGE BASE DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
    
    -- Document Information
    name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50), -- pdf, txt, doc, docx, etc.
    file_url TEXT NOT NULL,
    file_size BIGINT, -- Size in bytes
    storage_path TEXT, -- Path in Supabase Storage
    
    -- Metadata
    description TEXT,
    
    -- Timestamps
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ============================================
-- 4. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_user_id ON public.knowledge_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_status ON public.knowledge_bases(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_deleted_at ON public.knowledge_bases(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_created_at ON public.knowledge_bases(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_faqs_kb_id ON public.knowledge_base_faqs(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_kb_faqs_deleted_at ON public.knowledge_base_faqs(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_kb_faqs_priority ON public.knowledge_base_faqs(priority DESC, display_order ASC);

CREATE INDEX IF NOT EXISTS idx_kb_docs_kb_id ON public.knowledge_base_documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_deleted_at ON public.knowledge_base_documents(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_documents ENABLE ROW LEVEL SECURITY;

-- Knowledge Bases Policies
CREATE POLICY "Users can view their own knowledge bases"
    ON public.knowledge_bases FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own knowledge bases"
    ON public.knowledge_bases FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own knowledge bases"
    ON public.knowledge_bases FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own knowledge bases"
    ON public.knowledge_bases FOR DELETE
    USING (auth.uid() = user_id);

-- FAQs Policies
CREATE POLICY "Users can view FAQs of their knowledge bases"
    ON public.knowledge_base_faqs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.knowledge_bases
            WHERE knowledge_bases.id = knowledge_base_faqs.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create FAQs for their knowledge bases"
    ON public.knowledge_base_faqs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.knowledge_bases
            WHERE knowledge_bases.id = knowledge_base_faqs.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update FAQs of their knowledge bases"
    ON public.knowledge_base_faqs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.knowledge_bases
            WHERE knowledge_bases.id = knowledge_base_faqs.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete FAQs of their knowledge bases"
    ON public.knowledge_base_faqs FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.knowledge_bases
            WHERE knowledge_bases.id = knowledge_base_faqs.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

-- Documents Policies
CREATE POLICY "Users can view documents of their knowledge bases"
    ON public.knowledge_base_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.knowledge_bases
            WHERE knowledge_bases.id = knowledge_base_documents.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create documents for their knowledge bases"
    ON public.knowledge_base_documents FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.knowledge_bases
            WHERE knowledge_bases.id = knowledge_base_documents.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update documents of their knowledge bases"
    ON public.knowledge_base_documents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.knowledge_bases
            WHERE knowledge_bases.id = knowledge_base_documents.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete documents of their knowledge bases"
    ON public.knowledge_base_documents FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.knowledge_bases
            WHERE knowledge_bases.id = knowledge_base_documents.knowledge_base_id
            AND knowledge_bases.user_id = auth.uid()
        )
    );

-- ============================================
-- 6. FUNCTIONS & TRIGGERS
-- ============================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_knowledge_bases_updated_at
    BEFORE UPDATE ON public.knowledge_bases
    FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_base_updated_at();

CREATE TRIGGER update_kb_faqs_updated_at
    BEFORE UPDATE ON public.knowledge_base_faqs
    FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_base_updated_at();

CREATE TRIGGER update_kb_docs_updated_at
    BEFORE UPDATE ON public.knowledge_base_documents
    FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_base_updated_at();

-- ============================================
-- 7. UPDATE VOICE_AGENTS TABLE
-- ============================================
-- Add knowledge_base_id reference to voice_agents
ALTER TABLE public.voice_agents 
ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES public.knowledge_bases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_voice_agents_kb_id ON public.voice_agents(knowledge_base_id);

-- ============================================
-- END OF SCHEMA
-- ============================================
