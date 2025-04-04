/*
  # Clear All Chat Data

  1. Changes
    - Delete all messages from chat_messages table
    - Delete all threads from chat_threads table
    - Reset user preferences related to chat
    
  2. Security
    - Safe operation as it only deletes chat data
    - Maintains table structure and relationships
    - Preserves user accounts and other system data
*/

-- Delete all chat messages first (due to foreign key constraints)
DELETE FROM chat_messages;

-- Delete all chat threads
DELETE FROM chat_threads;

-- Reset user preferences related to chat
UPDATE users
SET preferences = preferences - 'has_welcome_message';