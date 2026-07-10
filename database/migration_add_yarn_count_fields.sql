-- Migration: Add new columns to master_yarn_counts
ALTER TABLE master_yarn_counts
  ADD COLUMN IF NOT EXISTS spec    TEXT,
  ADD COLUMN IF NOT EXISTS spec1   TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT;
