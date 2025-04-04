/*
  # Add Chat Threads Support

  1. New Tables
    - `chat_threads`
      - `id` (uuid, primary key)
      - `title` (text) - Thread title
      - `created_by` (uuid) - User who created the thread
      - `created_at` (timestamptz) - Thread creation time
      - `updated_at` (timestamptz) - Last message time
      - `is_archived` (boolean) - Soft delete flag
      - `metadata` (jsonb) - Additional thread metadata

  2. Changes to Existing Tables
    - Add `thread_id` to `chat_messages`
    - Add indexes for performance
    - Update RLS policies

  3. Security
    - Enable RLS on new tables
    - Add policies for thread access
    - Maintain existing message security
*/

-- Drop existing cleanup function to avoid conflicts
DROP FUNCTION IF EXISTS cleanup_chat_messages(uuid);

-- Create chat_threads table
CREATE TABLE IF NOT EXISTS chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  is_archived boolean DEFAULT false NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  
  -- Add a GiST index for full text search on title
  CONSTRAINT valid_title CHECK (char_length(title) <= 255)
);

-- Add thread_id to chat_messages
ALTER TABLE chat_messages 
ADD COLUMN thread_id uuid REFERENCES chat_threads(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX chat_threads_created_by_idx ON chat_threads(created_by);
CREATE INDEX chat_threads_created_at_idx ON chat_threads(created_at DESC);
CREATE INDEX chat_threads_updated_at_idx ON chat_threads(updated_at DESC);
CREATE INDEX chat_messages_thread_id_idx ON chat_messages(thread_id);
CREATE INDEX chat_messages_created_at_idx ON chat_messages(created_at);

-- Enable RLS
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for chat_threads
CREATE POLICY "Users can view their own threads"
  ON chat_threads
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create threads"
  ON chat_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own threads"
  ON chat_threads
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Update chat_messages policies
DROP POLICY IF EXISTS "Users can read all messages" ON chat_messages;
CREATE POLICY "Users can read thread messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_threads
      WHERE id = chat_messages.thread_id
      AND created_by = auth.uid()
    )
  );

-- Create function to update thread's updated_at timestamp
CREATE OR REPLACE FUNCTION update_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_threads
  SET updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update thread timestamp
CREATE TRIGGER update_thread_timestamp
  AFTER INSERT OR UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_timestamp();

-- Create function to create a new thread
CREATE OR REPLACE FUNCTION create_chat_thread(p_title text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  -- Create new thread
  INSERT INTO chat_threads (
    title,
    created_by
  ) VALUES (
    COALESCE(p_title, '新对话'),
    auth.uid()
  )
  RETURNING id INTO v_thread_id;
  
  RETURN v_thread_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_chat_thread TO authenticated;

-- Create new cleanup function with thread support
CREATE OR REPLACE FUNCTION cleanup_chat_messages(target_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the user owns the thread
  IF NOT EXISTS (
    SELECT 1 FROM chat_threads
    WHERE id = target_thread_id
    AND created_by = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Cannot delete messages from threads you do not own';
  END IF;

  -- Delete all messages in the thread
  DELETE FROM chat_messages
  WHERE thread_id = target_thread_id;

  -- Update thread metadata
  UPDATE chat_threads
  SET 
    updated_at = now(),
    metadata = metadata || jsonb_build_object('last_cleared_at', now())
  WHERE id = target_thread_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_chat_messages TO authenticated;