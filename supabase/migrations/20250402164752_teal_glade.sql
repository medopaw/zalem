/*
  # Fix task_assignees policies

  1. Changes
    - Replace recursive policy with direct task ownership check
    - Add policy for task owners to manage assignees
    - Add policy for assignees to view their assignments
    
  2. Security
    - Prevents infinite recursion in RLS policies
    - Maintains proper access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage task assignees" ON task_assignees;

-- Create new policies
CREATE POLICY "Task owners can manage assignees"
ON task_assignees
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tasks
    WHERE tasks.id = task_assignees.task_id
    AND tasks.created_by = auth.uid()
  )
);

CREATE POLICY "Users can view their assignments"
ON task_assignees
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
);