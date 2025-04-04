/*
  # Fix Chat Messages RLS Policies

  1. Changes
    - Add INSERT policy for chat messages
    - Add DELETE policy for chat messages
    - Update SELECT policy to handle both direct user messages and thread messages

  2. Security
    - Users can only insert messages they own
    - Users can only delete their own messages
    - Users can read messages they own or from threads they own
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read thread messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;

-- Enable RLS if not already enabled
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Add comprehensive SELECT policy
CREATE POLICY "Users can read messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      thread_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM chat_threads
        WHERE id = chat_messages.thread_id
        AND created_by = auth.uid()
      )
    )
  );

-- Add INSERT policy
CREATE POLICY "Users can insert messages"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- Add DELETE policy
CREATE POLICY "Users can delete messages"
  ON chat_messages
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    (
      thread_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM chat_threads
        WHERE id = chat_messages.thread_id
        AND created_by = auth.uid()
      )
    )
  );