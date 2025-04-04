/*
  # Clear chat messages

  1. Changes
    - Deletes all messages from the chat_messages table
    - Safe operation as we want to clear all messages
    
  2. Security
    - No changes to RLS policies
    - Maintains table structure and relationships
*/

DELETE FROM chat_messages;