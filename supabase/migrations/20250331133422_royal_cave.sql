/*
  # Update user role to admin

  1. Changes
    - Updates the first user's role to 'admin'
    
  2. Security
    - No changes to RLS policies
    - Safe operation as it only affects a single user
*/

UPDATE users 
SET role = 'admin'::user_role 
WHERE id = (
  SELECT id 
  FROM users 
  ORDER BY created_at 
  LIMIT 1
);