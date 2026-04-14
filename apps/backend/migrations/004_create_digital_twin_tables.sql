-- Migration: create digital twin engine tables for workforce simulation

-- Company Simulations table
CREATE TABLE IF NOT EXISTS company_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR NOT NULL,
  "scenario_type" VARCHAR NOT NULL,
  "parameters_json" JSONB NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_simulations_tenant_id ON company_simulations("tenant_id");
CREATE INDEX IF NOT EXISTS idx_company_simulations_scenario_type ON company_simulations("scenario_type");

-- Simulation Results table
CREATE TABLE IF NOT EXISTS simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "simulation_id" UUID NOT NULL REFERENCES company_simulations(id) ON DELETE CASCADE,
  "predicted_productivity_change" DECIMAL(5,2) NOT NULL, -- percentage change
  "predicted_completion_change" DECIMAL(5,2) NOT NULL, -- percentage change
  "predicted_cost_change" DECIMAL(5,2) NOT NULL, -- percentage change
  "generated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulation_results_simulation_id ON simulation_results("simulation_id");

-- Workforce Models table (learning data)
CREATE TABLE IF NOT EXISTS workforce_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" VARCHAR NOT NULL,
  "average_productivity" DECIMAL(5,2) NOT NULL, -- hours per day
  "average_task_duration" DECIMAL(5,2) NOT NULL, -- hours per task
  "team_utilization" DECIMAL(5,2) NOT NULL, -- percentage
  "burnout_index" DECIMAL(5,2) NOT NULL, -- 0-100 scale
  "last_updated" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workforce_models_tenant_id ON workforce_models("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS idx_workforce_models_tenant_unique ON workforce_models("tenant_id");