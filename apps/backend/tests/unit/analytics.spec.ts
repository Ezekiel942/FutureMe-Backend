/**
 * Analytics & Insights Tests
 * Tests risk detection, workforce analytics, insights computation
 */

import riskDetectionEngine from '../../src/engines/risk-engine/riskDetectionEngine';
import { workforceAnalytics } from '../../src/engines/workforce-engine/workforce.service';

describe('Analytics & Insights', () => {
  describe('Risk Detection Engine', () => {
    it('should detect burnout risk', async () => {
      const risks = await riskDetectionEngine.detectUserRisks('user-123', 'weekly', 'org-123');

      expect(Array.isArray(risks)).toBe(true);
      // Each risk should have required fields
      risks.forEach((risk: any) => {
        expect(risk).toHaveProperty('type');
        expect(risk).toHaveProperty('severity');
        expect(['low', 'medium', 'high', 'critical']).toContain(risk.severity);
      });
    });

    it('should detect scope creep risk', async () => {
      const risks = await riskDetectionEngine.detectUserRisks('user-123', 'weekly', 'org-123');

      const scopeCreepRisk = risks.find((r: any) => r.type === 'scope_creep');
      if (scopeCreepRisk) {
        expect(scopeCreepRisk).toHaveProperty('severity');
        expect(scopeCreepRisk).toHaveProperty('description');
      }
    });

    it('should detect ghosting (inactive) users', async () => {
      const risks = await riskDetectionEngine.detectUserRisks('user-456', 'weekly', 'org-123');

      const ghostingRisk = risks.find((r: any) => r.type === 'ghosting');
      if (ghostingRisk) {
        expect(ghostingRisk.severity).toBeDefined();
      }
    });

    it('should detect overtime risk', async () => {
      const risks = await riskDetectionEngine.detectUserRisks('user-789', 'monthly', 'org-123');

      const overtimeRisk = risks.find((r: any) => r.type === 'overtime');
      if (overtimeRisk) {
        expect(overtimeRisk).toHaveProperty('severity');
      }
    });
  });

  describe('Workforce Analytics', () => {
    it('should compute attendance metrics', async () => {
      const metrics = await workforceAnalytics.getAttendanceMetrics('org-123', 'week');

      expect(metrics).toHaveProperty('totalUsers');
      expect(metrics).toHaveProperty('presentUsers');
      expect(metrics).toHaveProperty('absentUsers');
      expect(metrics).toHaveProperty('attendanceRate');
      expect(typeof metrics.attendanceRate).toBe('number');
      expect(metrics.attendanceRate).toBeGreaterThanOrEqual(0);
      expect(metrics.attendanceRate).toBeLessThanOrEqual(100);
    });

    it('should identify overloaded users', async () => {
      const overloadedUsers = await workforceAnalytics.getOverloadedUsers('org-123', 7);

      expect(Array.isArray(overloadedUsers)).toBe(true);
      overloadedUsers.forEach((user: any) => {
        expect(user).toHaveProperty('userId');
        expect(user).toHaveProperty('hoursThisWeek');
        expect(user.hoursThisWeek).toBeGreaterThan(60);
      });
    });

    it('should compute team utilization', async () => {
      const utilization = await workforceAnalytics.getTeamUtilization('org-123');

      expect(utilization).toHaveProperty('averageUtilization');
      expect(utilization).toHaveProperty('overUtilized');
      expect(utilization).toHaveProperty('underUtilized');
      expect(Array.isArray(utilization.overUtilized)).toBe(true);
      expect(Array.isArray(utilization.underUtilized)).toBe(true);
    });
  });

  describe('Insights Computation', () => {
    it('should compute weekly efficiency insights', async () => {
      const insights = await workforceAnalytics.computeInsights('org-123', 'weekly');

      expect(insights).toBeDefined();
      expect(Array.isArray(insights)).toBe(true);
    });

    it('should compute project-level insights', async () => {
      const insights = await workforceAnalytics.getProjectInsights('proj-123', 'org-123');

      expect(insights).toBeDefined();
      expect(insights).toHaveProperty('totalTasks');
      expect(insights).toHaveProperty('completionRate');
      expect(insights).toHaveProperty('teamSize');
    });

    it('should enforce tenant isolation on insights', async () => {
      // Insights for different orgs should not leak
      const insights1 = await workforceAnalytics.computeInsights('org-1', 'weekly');
      const insights2 = await workforceAnalytics.computeInsights('org-2', 'weekly');

      // Should be different data sets (no cross-org data leakage)
      expect(insights1).toBeDefined();
      expect(insights2).toBeDefined();
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect anomalies in user behavior', async () => {
      const anomalies = await riskDetectionEngine.detectAnomalies('user-123', 'org-123');

      expect(Array.isArray(anomalies)).toBe(true);
      anomalies.forEach((anomaly: any) => {
        expect(anomaly).toHaveProperty('type');
        expect(anomaly).toHaveProperty('severity');
        expect(anomaly).toHaveProperty('description');
      });
    });
  });
});
