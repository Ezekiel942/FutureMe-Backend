import { Router } from 'express';
import {
  createSimulation,
  getSimulations,
  runSimulation,
  getSimulationResults,
  updateWorkforceModel,
  getWorkforceModel,
} from '../controllers/digitalTwin.controller';
import requireAuth from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/v1/digital-twin/simulations:
 *   post:
 *     tags:
 *       - Digital Twin
 *     summary: Create a new workforce simulation scenario
 *     description: |
 *       Creates a digital twin simulation scenario for workforce optimization.
 *       Example scenarios: hiring engineers, changing work policies, team restructuring.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scenarioType
 *               - parameters
 *             properties:
 *               scenarioType:
 *                 type: string
 *                 example: "hire_engineers"
 *               parameters:
 *                 type: object
 *                 example: {"hire_engineers": 2}
 *     responses:
 *       200:
 *         description: Simulation created successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *   get:
 *     tags:
 *       - Digital Twin
 *     summary: Get all simulations for the tenant
 *     description: Retrieves all digital twin simulation scenarios for the organization
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Simulations retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/simulations', requireAuth, createSimulation);
router.get('/simulations', requireAuth, getSimulations);

/**
 * @swagger
 * /api/v1/digital-twin/simulations/{simulationId}/run:
 *   post:
 *     tags:
 *       - Digital Twin
 *     summary: Run a simulation and store results
 *     description: Executes a simulation scenario and stores the predicted outcomes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: simulationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - predictedProductivityChange
 *               - predictedCompletionChange
 *               - predictedCostChange
 *             properties:
 *               predictedProductivityChange:
 *                 type: number
 *                 format: decimal
 *                 example: 15.5
 *               predictedCompletionChange:
 *                 type: number
 *                 format: decimal
 *                 example: -10.2
 *               predictedCostChange:
 *                 type: number
 *                 format: decimal
 *                 example: 25.0
 *     responses:
 *       200:
 *         description: Simulation run successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/simulations/:simulationId/run', requireAuth, runSimulation);

/**
 * @swagger
 * /api/v1/digital-twin/simulations/{simulationId}/results:
 *   get:
 *     tags:
 *       - Digital Twin
 *     summary: Get results for a specific simulation
 *     description: Retrieves all execution results for a simulation scenario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: simulationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Simulation results retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/simulations/:simulationId/results', requireAuth, getSimulationResults);

/**
 * @swagger
 * /api/v1/digital-twin/workforce-model:
 *   put:
 *     tags:
 *       - Digital Twin
 *     summary: Update workforce learning model
 *     description: |
 *       Updates the machine learning model with current workforce metrics.
 *       This data improves future simulation accuracy.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - averageProductivity
 *               - averageTaskDuration
 *               - teamUtilization
 *               - burnoutIndex
 *             properties:
 *               averageProductivity:
 *                 type: number
 *                 format: decimal
 *                 example: 7.5
 *               averageTaskDuration:
 *                 type: number
 *                 format: decimal
 *                 example: 2.3
 *               teamUtilization:
 *                 type: number
 *                 format: decimal
 *                 example: 85.2
 *               burnoutIndex:
 *                 type: number
 *                 format: decimal
 *                 example: 25.0
 *     responses:
 *       200:
 *         description: Workforce model updated successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *   get:
 *     tags:
 *       - Digital Twin
 *     summary: Get current workforce learning model
 *     description: Retrieves the current machine learning model data for workforce predictions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Workforce model retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Workforce model not found
 *       500:
 *         description: Internal server error
 */
router.put('/workforce-model', requireAuth, updateWorkforceModel);
router.get('/workforce-model', requireAuth, getWorkforceModel);

export default router;
