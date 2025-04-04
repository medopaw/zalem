/*
  # Add chat cleanup function

  1. New Function
    - `cleanup_chat_messages(user_id uuid)`: Deletes all chat messages for a specific user

  2. Security
    - Function can only be executed by authenticated users on their own messages
    - RLS policies remain in effect
*/

-- Create function to cleanup chat messages
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
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_chat_messages TO authenticated;