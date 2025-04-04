/*
  # Add DeepSeek API Key Setting

  1. Changes
    - Ensures the deepseek_api_key setting exists in system_settings table
    - Uses DO block to safely insert only if not exists
    
  2. Security
    - No changes to RLS policies
    - Safe idempotent operation
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_settings WHERE key = 'deepseek_api_key'
  ) THEN
    INSERT INTO system_settings (key, value, is_encrypted)
    VALUES ('deepseek_api_key', '', true);
  END IF;
END $$;