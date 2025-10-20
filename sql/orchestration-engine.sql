-- Orchestration Engine Tables
-- Created: October 20, 2025
-- Purpose: Enable autonomous AI-to-AI workflow coordination via TAO Bridge

-- Workflows table: Tracks customer workflow requests
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  request_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'in_progress', 'completed', 'failed', 'cancelled')),
  assigned_to TEXT CHECK (assigned_to IN ('aria', 'kai', 'human')),
  result_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT workflows_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Workflow tasks table: Individual tasks within a workflow
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('analyze', 'generate_image', 'generate_video', 'generate_lipsync', 'process', 'review', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT NOT NULL CHECK (assigned_to IN ('aria', 'kai', 'human')),
  input_data JSONB DEFAULT '{}'::jsonb,
  output_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  error_message TEXT,
  depends_on UUID REFERENCES workflow_tasks(id) ON DELETE SET NULL,
  execution_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT workflow_tasks_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_assigned_to ON workflows(assigned_to);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_workflow_id ON workflow_tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_status ON workflow_tasks(status);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_assigned_to ON workflow_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_execution_order ON workflow_tasks(workflow_id, execution_order);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_tasks_updated_at BEFORE UPDATE ON workflow_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_tasks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own workflows
CREATE POLICY workflows_user_policy ON workflows
  FOR ALL
  USING (user_id = auth.uid());

-- Users can only see tasks for their workflows
CREATE POLICY workflow_tasks_user_policy ON workflow_tasks
  FOR ALL
  USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE user_id = auth.uid()
    )
  );

-- Service role can access all workflows (for API operations)
CREATE POLICY workflows_service_policy ON workflows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY workflow_tasks_service_policy ON workflow_tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE workflows IS 'Tracks customer workflow requests coordinated by Aria and Kai via TAO Bridge';
COMMENT ON TABLE workflow_tasks IS 'Individual tasks within workflows, assigned to Aria or Kai for execution';
