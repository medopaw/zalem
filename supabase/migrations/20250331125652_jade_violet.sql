/*
  # Initial Schema Setup

  1. Authentication and Users
    - Enable auth schema
    - Create users table with auth integration
    - Add admin flag for user management
  
  2. Core Tables
    - tasks: Main tasks table
    - task_dependencies: Task dependency relationships
    - task_history: Track all task changes
    - chat_messages: Store all chat interactions
    - report_configs: Report and chart configurations
    - weekly_reports: Weekly report storage
    - system_settings: Store API configurations
  
  3. Security
    - Enable RLS on all tables
    - Set up access policies
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE task_status AS ENUM ('not_started', 'in_progress', 'completed', 'blocked');
CREATE TYPE task_priority AS ENUM ('p0', 'p1', 'p2', 'p3');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  nickname TEXT,
  role user_role DEFAULT 'user',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'not_started',
  priority task_priority DEFAULT 'p2',
  risk_level risk_level DEFAULT 'low',
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  workload FLOAT,
  module TEXT,
  parent_task_id UUID REFERENCES public.tasks(id),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create task dependencies
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, dependent_task_id)
);

-- Create task history
CREATE TABLE IF NOT EXISTS public.task_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES public.users(id),
  chat_message_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create report configs
CREATE TABLE IF NOT EXISTS public.report_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create weekly reports
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create system settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  is_encrypted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can read all users
CREATE POLICY "Users can read all users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own data
CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Tasks are readable by all authenticated users
CREATE POLICY "Tasks are readable by all authenticated users"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (true);

-- Tasks can be created by any authenticated user
CREATE POLICY "Tasks can be created by any authenticated user"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tasks can be updated by any authenticated user
CREATE POLICY "Tasks can be updated by any authenticated user"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- System settings can only be accessed by admins
CREATE POLICY "System settings admin only"
  ON public.system_settings
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- Function to set first user as admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INT;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.users;
  
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, CASE WHEN user_count = 0 THEN 'admin'::user_role ELSE 'user'::user_role END);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert initial system settings
INSERT INTO public.system_settings (key, value, is_encrypted)
VALUES 
  ('ai_api_base_url', '', false),
  ('ai_api_key', '', true);