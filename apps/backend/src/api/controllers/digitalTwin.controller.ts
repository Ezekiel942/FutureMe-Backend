import { Request, Response } from 'express';
import digitalTwinService from '../../engines/digital-twin/digitalTwin.service';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

/**
 * POST /api/v1/digital-twin/simulations
 * Create a new workforce simulation scenario
 */
export const createSimulation = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const { scenarioType, parameters } = req.body;
    const tenantId = (user as any).organizationId;

    if (!scenarioType || !parameters) {
      return fail(res, 'scenarioType and parameters are required', 'MISSING_PARAMS');
    }

    const simulation = await digitalTwinService.createSimulation(tenantId, scenarioType, parameters);
    success(res, simulation);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to create simulation', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/digital-twin/simulations
 * Get all simulations for the tenant
 */
export const getSimulations = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const tenantId = (user as any).organizationId;
    const simulations = await digitalTwinService.getSimulationsByTenant(tenantId);
    success(res, simulations);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch simulations', err?.code, err?.status || 500);
  }
};

/**
 * POST /api/v1/digital-twin/simulations/:simulationId/run
 * Run a simulation and store the results
 */
export const runSimulation = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const { simulationId } = req.params;
    const { predictedProductivityChange, predictedCompletionChange, predictedCostChange } = req.body;

    if (predictedProductivityChange === undefined || predictedCompletionChange === undefined || predictedCostChange === undefined) {
      return fail(res, 'All prediction values are required', 'MISSING_PREDICTIONS');
    }

    const result = await digitalTwinService.runSimulation(
      simulationId,
      predictedProductivityChange,
      predictedCompletionChange,
      predictedCostChange
    );
    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to run simulation', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/digital-twin/simulations/:simulationId/results
 * Get results for a specific simulation
 */
export const getSimulationResults = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const { simulationId } = req.params;
    const results = await digitalTwinService.getSimulationResults(simulationId);
    success(res, results);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch simulation results', err?.code, err?.status || 500);
  }
};

/**
 * PUT /api/v1/digital-twin/workforce-model
 * Update or create workforce learning model
 */
export const updateWorkforceModel = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const { averageProductivity, averageTaskDuration, teamUtilization, burnoutIndex } = req.body;
    const tenantId = (user as any).organizationId;

    if (averageProductivity === undefined || averageTaskDuration === undefined ||
        teamUtilization === undefined || burnoutIndex === undefined) {
      return fail(res, 'All workforce metrics are required', 'MISSING_METRICS');
    }

    const model = await digitalTwinService.updateWorkforceModel(
      tenantId,
      averageProductivity,
      averageTaskDuration,
      teamUtilization,
      burnoutIndex
    );
    success(res, model);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to update workforce model', err?.code, err?.status || 500);
  }
};

/**
 * GET /api/v1/digital-twin/workforce-model
 * Get current workforce learning model
 */
export const getWorkforceModel = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const tenantId = (user as any).organizationId;
    const model = await digitalTwinService.getWorkforceModel(tenantId);

    if (!model) {
      return fail(res, 'Workforce model not found', 'MODEL_NOT_FOUND', 404);
    }

    success(res, model);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch workforce model', err?.code, err?.status || 500);
  }
};

export default {
  createSimulation,
  getSimulations,
  runSimulation,
  getSimulationResults,
  updateWorkforceModel,
  getWorkforceModel,
};