/*
  # Clear chat messages with security

  1. Changes
    - Adds a function to safely clear chat messages for a specific user
    - Adds a policy to ensure users can only clear their own messages
    
  2. Security
    - Function is marked as SECURITY DEFINER to run with elevated privileges
    - Checks user authentication and ownership before deletion
    - Safe operation with error handling
*/

-- Create function to safely clear chat messages
CREATE OR REPLACE FUNCTION clear_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete messages for the authenticated user
  DELETE FROM chat_messages
  WHERE user_id = auth.uid();
END;
$$;

-- Add policy for clearing messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_messages' 
    AND policyname = 'Users can delete their own messages'
  ) THEN
    CREATE POLICY "Users can delete their own messages"
      ON chat_messages
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;