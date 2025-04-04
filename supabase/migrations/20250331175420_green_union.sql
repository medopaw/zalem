/*
  # Fix thread creation and message association

  1. Changes
    - Add unique constraint to ensure one active thread per user
    - Add function to get or create user's active thread
    - Update thread creation function to handle existing threads

  2. Security
    - All functions are security definer
    - RLS policies remain unchanged
*/

-- Add unique constraint for active threads per user
CREATE UNIQUE INDEX unique_active_thread_per_user 
ON chat_threads (created_by)
WHERE (is_archived = false);

-- Function to get or create user's active thread
CREATE OR REPLACE FUNCTION get_or_create_active_thread()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  -- First try to get existing active thread
  SELECT id INTO v_thread_id
  FROM chat_threads
  WHERE created_by = auth.uid()
  AND is_archived = false
  LIMIT 1;
  
  -- If no active thread exists, create one
  IF v_thread_id IS NULL THEN
    INSERT INTO chat_threads (
      title,
      created_by,
      is_archived
    ) VALUES (
      '新对话',
      auth.uid(),
      false
    )
    RETURNING id INTO v_thread_id;
  END IF;
  
  RETURN v_thread_id;
END;
$$;

-- Drop existing create_chat_thread function
DROP FUNCTION IF EXISTS create_chat_thread(text);

-- Create improved thread creation function
CREATE OR REPLACE FUNCTION create_chat_thread(p_title text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_thread_id uuid;
  v_new_thread_id uuid;
BEGIN
  -- Get current active thread
  SELECT id INTO v_old_thread_id
  FROM chat_threads
  WHERE created_by = auth.uid()
  AND is_archived = false;
  
  -- Archive old thread if it exists
  IF v_old_thread_id IS NOT NULL THEN
    UPDATE chat_threads
    SET is_archived = true
    WHERE id = v_old_thread_id;
  END IF;
  
  -- Create new thread
  INSERT INTO chat_threads (
    title,
    created_by,
    is_archived
  ) VALUES (
    COALESCE(p_title, '新对话'),
    auth.uid(),
    false
  )
  RETURNING id INTO v_new_thread_id;
  
  RETURN v_new_thread_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_active_thread TO authenticated;
GRANT EXECUTE ON FUNCTION create_chat_thread TO authenticated;