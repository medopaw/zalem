/*
  # Add chat_messages table and policies

  1. New Tables
    - `chat_messages`
      - `id` (uuid, primary key)
      - `content` (text)
      - `role` (text)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `chat_messages` table
    - Add policies for:
      - Authenticated users can read all messages
      - Authenticated users can insert their own messages
*/

-- Create chat_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  role text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant'))
);

-- Enable RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$ 
BEGIN
  -- Policy for reading messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_messages' 
    AND policyname = 'Users can read all messages'
  ) THEN
    CREATE POLICY "Users can read all messages"
      ON chat_messages
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- Policy for inserting messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'chat_messages' 
    AND policyname = 'Users can insert their own messages'
  ) THEN
    CREATE POLICY "Users can insert their own messages"
      ON chat_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;