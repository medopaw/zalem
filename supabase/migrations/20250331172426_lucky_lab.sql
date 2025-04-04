/*
  # Fix orphaned messages

  1. Changes
    - Create function to migrate orphaned messages to new threads
    - Add NOT NULL constraint to thread_id column
    - Clean up migration function after use

  2. Security
    - Function runs with SECURITY DEFINER
    - Only processes messages without thread_id
*/

-- Function to migrate orphaned messages
CREATE OR REPLACE FUNCTION migrate_orphaned_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user record;
  v_thread_id uuid;
BEGIN
  -- Process each user with orphaned messages
  FOR v_user IN 
    SELECT DISTINCT user_id 
    FROM chat_messages 
    WHERE thread_id IS NULL
  LOOP
    -- Create a new thread for this user's messages
    INSERT INTO chat_threads (
      title,
      created_by,
      created_at,
      updated_at
    ) 
    VALUES (
      '历史对话',
      v_user.user_id,
      (SELECT MIN(created_at) FROM chat_messages WHERE user_id = v_user.user_id AND thread_id IS NULL),
      (SELECT MAX(created_at) FROM chat_messages WHERE user_id = v_user.user_id AND thread_id IS NULL)
    )
    RETURNING id INTO v_thread_id;

    -- Update orphaned messages to use the new thread
    UPDATE chat_messages
    SET thread_id = v_thread_id
    WHERE user_id = v_user.user_id
    AND thread_id IS NULL;
  END LOOP;
END;
$$;

-- Execute the migration
SELECT migrate_orphaned_messages();

-- Drop the migration function
DROP FUNCTION migrate_orphaned_messages();

-- Add NOT NULL constraint to thread_id
ALTER TABLE chat_messages
ALTER COLUMN thread_id SET NOT NULL;