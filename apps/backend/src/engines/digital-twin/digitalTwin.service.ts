import { AppDataSource } from '@config/database';
import { CompanySimulation } from '../../database/models/CompanySimulation.model';
import { SimulationResult } from '../../database/models/SimulationResult.model';
import { WorkforceModel } from '../../database/models/WorkforceModel.model';

/**
 * Digital Twin Service
 *
 * Manages workforce simulation scenarios and learning models.
 * The digital twin simulates "what-if" scenarios for workforce optimization.
 */

export const createSimulation = async (
  tenantId: string,
  scenarioType: string,
  parameters: Record<string, any>
) => {
  const simulation = new CompanySimulation();
  simulation.tenantId = tenantId;
  simulation.scenarioType = scenarioType;
  simulation.parametersJson = parameters;

  return await simulation.save();
};

export const getSimulationsByTenant = async (tenantId: string) => {
  return await CompanySimulation.find({
    where: { tenantId },
    order: { createdAt: 'DESC' },
  });
};

export const runSimulation = async (
  simulationId: string,
  predictedProductivityChange: number,
  predictedCompletionChange: number,
  predictedCostChange: number
) => {
  const result = new SimulationResult();
  result.simulationId = simulationId;
  result.predictedProductivityChange = predictedProductivityChange;
  result.predictedCompletionChange = predictedCompletionChange;
  result.predictedCostChange = predictedCostChange;

  return await result.save();
};

export const getSimulationResults = async (simulationId: string) => {
  return await SimulationResult.find({
    where: { simulationId },
    order: { generatedAt: 'DESC' },
  });
};

export const updateWorkforceModel = async (
  tenantId: string,
  averageProductivity: number,
  averageTaskDuration: number,
  teamUtilization: number,
  burnoutIndex: number
) => {
  let model = await WorkforceModel.findOne({ where: { tenantId } });

  if (!model) {
    model = new WorkforceModel();
    model.tenantId = tenantId;
  }

  model.averageProductivity = averageProductivity;
  model.averageTaskDuration = averageTaskDuration;
  model.teamUtilization = teamUtilization;
  model.burnoutIndex = burnoutIndex;

  return await model.save();
};

export const getWorkforceModel = async (tenantId: string) => {
  return await WorkforceModel.findOne({ where: { tenantId } });
};

export const getWorkforceModelsByTenant = async (tenantId: string) => {
  return await WorkforceModel.find({ where: { tenantId } });
};

export default {
  createSimulation,
  getSimulationsByTenant,
  runSimulation,
  getSimulationResults,
  updateWorkforceModel,
  getWorkforceModel,
  getWorkforceModelsByTenant,
};