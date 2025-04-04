/*
  # Fix orphaned messages migration

  1. Changes
    - Create a new thread for each user's orphaned messages
    - Move orphaned messages into the new thread
    - Add NOT NULL constraint to thread_id

  2. Security
    - Only affects messages without thread_id
    - Preserves message content and order
    - Maintains RLS policies
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
    SELECT 
      '历史对话',
      user_id,
      MIN(created_at),
      MAX(created_at)
    FROM chat_messages
    WHERE user_id = v_user.user_id
    AND thread_id IS NULL
    GROUP BY user_id
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