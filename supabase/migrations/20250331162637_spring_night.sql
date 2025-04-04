/*
  # Task Management Schema Updates

  1. Changes
    - Add task_assignees table for multiple assignees per task
    - Add task_workload table to track workload per user
    - Add task_schedule table for quarterly and weekly planning
    - Add task_status_history table for status changes
    - Add task_priority_history table for priority changes
    - Add task_risk_history table for risk level changes
    
  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Create task_assignees table
CREATE TABLE IF NOT EXISTS task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'assignee',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Create task_workload table
CREATE TABLE IF NOT EXISTS task_workload (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  workload FLOAT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  quarter_start DATE NOT NULL,
  quarter_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id, week_start)
);

-- Create task_schedule table
CREATE TABLE IF NOT EXISTS task_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('weekly', 'quarterly')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  workload FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, user_id, schedule_type, start_date)
);

-- Create task_status_history table
CREATE TABLE IF NOT EXISTS task_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  old_status task_status,
  new_status task_status NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Create task_priority_history table
CREATE TABLE IF NOT EXISTS task_priority_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  old_priority task_priority,
  new_priority task_priority NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Create task_risk_history table
CREATE TABLE IF NOT EXISTS task_risk_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  old_risk risk_level,
  new_risk risk_level NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_workload ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_priority_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_risk_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read all task assignees"
  ON task_assignees
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage task assignees"
  ON task_assignees
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM task_assignees ta
      WHERE ta.task_id = task_assignees.task_id
      AND ta.user_id = auth.uid()
      AND ta.role = 'owner'
    )
  );

CREATE POLICY "Users can read their task workload"
  ON task_workload
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their task workload"
  ON task_workload
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can read their task schedule"
  ON task_schedule
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their task schedule"
  ON task_schedule
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can read task status history"
  ON task_status_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read task priority history"
  ON task_priority_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can read task risk history"
  ON task_risk_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Create functions for task management
CREATE OR REPLACE FUNCTION calculate_user_workload(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  total_workload FLOAT;
BEGIN
  SELECT COALESCE(SUM(workload), 0)
  INTO total_workload
  FROM task_workload
  WHERE user_id = p_user_id
  AND week_start >= p_start_date
  AND week_end <= p_end_date;
  
  RETURN total_workload;
END;
$$;