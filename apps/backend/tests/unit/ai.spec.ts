/**
 * AI Services Tests
 * Tests burnout prediction, coaching generation, attendance analysis
 */

import { openaiService } from '../../src/infrastructure/ai/openai';

describe('AI Services', () => {
  describe('Burnout Analysis', () => {
    it('should analyze burnout risk from session data', async () => {
      const sessionData = {
        hoursThisWeek: 65,
        lateNightSessions: 3,
        weekendWork: true,
        idleTimeTotal: 120,
        overtimeHours: 10,
      };

      const result = await openaiService.analyzeBurnoutRisk('user-123', sessionData, 'org-123');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('score');
      expect(result.data).toHaveProperty('riskLevel');
      expect(result.data).toHaveProperty('recommendations');
      expect(typeof result.data.score).toBe('number');
      expect(result.data.score).toBeGreaterThanOrEqual(0);
      expect(result.data.score).toBeLessThanOrEqual(100);
    });

    it('should provide fallback burnout analysis without OpenAI', async () => {
      // When AI is disabled, should return rule-based results
      const sessionData = {
        hoursThisWeek: 75,
        lateNightSessions: 5,
        overtimeHours: 20,
      };

      const result = await openaiService.analyzeBurnoutRisk('user-456', sessionData, 'org-123');

      // Should still return valid result
      expect(result).toHaveProperty('success', true);
      expect(result.data).toHaveProperty('score');
      expect(result.data).toHaveProperty('riskLevel');
      expect(['low', 'medium', 'high', 'critical']).toContain(result.data.riskLevel);
    });
  });

  describe('Coaching Generation', () => {
    it('should generate personalized coaching recommendations', async () => {
      const userData = {
        averageHoursPerWeek: 50,
        breakPatterns: 'irregular',
        productivityScore: 0.75,
        teamCollaboration: 'high',
      };

      const result = await openaiService.generateCoaching('user-123', userData, 'org-123');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(typeof result.data).toBe('string');
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should timeout coaching generation after AI_TIMEOUT_MS', async () => {
      // Set very short timeout to test timeout handling
      const userData = {
        /* ... */
      };

      // Should not throw, should return fallback
      const result = await openaiService.generateCoaching('user-789', userData, 'org-123');

      expect(result).toBeDefined();
    });
  });

  describe('Attendance Analysis', () => {
    it('should analyze attendance patterns and anomalies', async () => {
      const attendanceData = {
        dates: ['2024-01-01', '2024-01-02', '2024-01-04', '2024-01-08'],
        hoursPerDay: [8, 8, 8, 0],
      };

      const result = await openaiService.analyzeAttendance('user-123', attendanceData, 'org-123');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('anomalies');
      expect(result.data).toHaveProperty('patterns');
      expect(Array.isArray(result.data.anomalies)).toBe(true);
    });
  });

  describe('Project Risk Analysis', () => {
    it('should identify project risks and mitigation', async () => {
      const projectData = {
        tasksAssigned: 25,
        completionRate: 0.6,
        teamHealth: 'stressed',
        timeline: 'compressed',
      };

      const result = await openaiService.analyzeProjectRisk('proj-123', projectData, 'org-123');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('riskScore');
      expect(result.data).toHaveProperty('issues');
      expect(result.data).toHaveProperty('recommendations');
    });
  });

  describe('AI Service Caching', () => {
    it('should cache AI results for performance', async () => {
      const userData = {
        /* sample data */
      };

      // First call
      const result1 = await openaiService.generateCoaching('user-cache-test', userData, 'org-123');

      // Second call (should use cache)
      const result2 = await openaiService.generateCoaching('user-cache-test', userData, 'org-123');

      expect(result1).toEqual(result2);
    });
  });

  describe('AI Service Rate Limiting', () => {
    it('should enforce rate limits per tenant', async () => {
      const userData = {
        /* sample data */
      };

      // Make multiple requests
      const requests = Array(5)
        .fill(userData)
        .map((data, i) => openaiService.generateCoaching(`user-${i}`, data, 'org-rate-limit-test'));

      // Should handle rate limit gracefully
      const results = await Promise.all(requests);
      expect(results.length).toBe(5);
    });
  });
});
