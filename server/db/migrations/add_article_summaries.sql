-- Migration: Add article_summaries column to prediction_analysis table
-- Date: 2025-12-02

-- Add article_summaries column if it doesn't exist
ALTER TABLE prediction_analysis 
ADD COLUMN IF NOT EXISTS article_summaries JSONB;

-- Add comment for documentation
COMMENT ON COLUMN prediction_analysis.article_summaries IS 'Key summary points extracted from analyzed news articles using OpenAI';

