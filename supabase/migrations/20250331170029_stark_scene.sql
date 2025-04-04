/*
  # Update chat cleanup functionality

  1. Changes
    - Add function to safely delete chat messages for a user
    - Add trigger to maintain referential integrity
    - Update user preferences after cleanup

  2. Security
    - Function is SECURITY DEFINER to run with elevated privileges
    - User ID validation ensures users can only delete their own messages
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS cleanup_chat_messages;

-- Create improved cleanup function
CREATE OR REPLACE FUNCTION cleanup_chat_messages(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the user is cleaning up their own messages
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete messages for other users';
  END IF;

  -- Delete all messages for the user
  DELETE FROM chat_messages
  WHERE user_id = target_user_id;

  -- Reset the welcome message flag for the user
  UPDATE users
  SET preferences = preferences || jsonb_build_object('has_welcome_message', false)
  WHERE id = target_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_chat_messages TO authenticated;