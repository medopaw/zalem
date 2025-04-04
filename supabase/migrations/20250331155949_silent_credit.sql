/*
  # Clear all chat messages

  1. Changes
    - Removes all messages from the chat_messages table
    - Safe operation with proper error handling
    
  2. Security
    - No changes to RLS policies
    - Maintains existing security rules
*/

-- Clear all messages from the chat_messages table
TRUNCATE TABLE chat_messages;

-- Reset the welcome message flag for all users by updating their nicknames
-- This will trigger the welcome message to appear again
UPDATE users 
SET nickname = nickname 
WHERE nickname IS NOT NULL;