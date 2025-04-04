/*
  # Clear all chat messages

  1. Changes
    - Deletes all messages from the chat_messages table
    - Safe operation as messages can be recreated
    
  2. Security
    - No changes to RLS policies
    - Idempotent operation
*/

DELETE FROM chat_messages;