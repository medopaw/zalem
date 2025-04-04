/*
  # Update default thread title

  1. Changes
    - Update create_chat_thread function to use constant default title
    - Update get_or_create_active_thread function to use constant default title
    
  2. Security
    - No changes to RLS policies
    - Safe operation as it only modifies function definitions
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS create_chat_thread(text);
DROP FUNCTION IF EXISTS get_or_create_active_thread();

-- Create improved thread creation function
CREATE OR REPLACE FUNCTION create_chat_thread(p_title text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_thread_id uuid;
  v_new_thread_id uuid;
  v_default_title CONSTANT text := '新对话';
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
    COALESCE(p_title, v_default_title),
    auth.uid(),
    false
  )
  RETURNING id INTO v_new_thread_id;
  
  RETURN v_new_thread_id;
END;
$$;

-- Function to get or create user's active thread
CREATE OR REPLACE FUNCTION get_or_create_active_thread()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id uuid;
  v_default_title CONSTANT text := '新对话';
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
      v_default_title,
      auth.uid(),
      false
    )
    RETURNING id INTO v_thread_id;
  END IF;
  
  RETURN v_thread_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_chat_thread TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_active_thread TO authenticated;