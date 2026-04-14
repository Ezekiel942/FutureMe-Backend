import OpenAIClient from './openai';
import { isRedisAvailable } from '../redis';
import logger from '../../utils/logger';
import { ENV } from '../../config/env';

class AIService {
  private client: typeof OpenAIClient;
  private cache: Map<string, { data: any; expires: number }> = new Map();

  constructor() {
    this.client = OpenAIClient;
  }

  private getCacheKey(method: string, params: any): string {
    return `ai:${method}:${JSON.stringify(params)}`;
  }

  private async getCachedResult(key: string): Promise<any | null> {
    if (isRedisAvailable()) {
      // Redis caching would be implemented here
      // For now, use in-memory cache
      const cached = this.cache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }
    }
    return null;
  }

  private async setCachedResult(key: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    if (isRedisAvailable()) {
      // Redis caching would be implemented here
      this.cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 30000,
    retries: number = 1
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI request timeout')), timeoutMs)
        );

        return await Promise.race([operation(), timeoutPromise]);
      } catch (error: any) {
        logger.warn(`AI operation attempt ${attempt} failed`, {
          error: error.message,
          attempt,
          maxAttempts: retries + 1,
        });

        if (attempt > retries) {
          throw error;
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('AI operation failed after all retries');
  }

  async predictBurnout(userData: any): Promise<any> {
    if (!ENV.AI_ENABLED) {
      return this.fallbackBurnoutPrediction(userData);
    }

    const cacheKey = this.getCacheKey('predictBurnout', userData);
    const cached = await this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.executeWithTimeout(
        () => this.client.predictBurnout(userData),
        30000,
        1
      );

      if (result.success) {
        await this.setCachedResult(cacheKey, result.data);
      }

      return result.data;
    } catch (error: any) {
      logger.error('Burnout prediction failed, using fallback', {
        error: error.message,
        userId: userData.userId,
      });
      return this.fallbackBurnoutPrediction(userData);
    }
  }

  async generateCoaching(userData: any): Promise<any> {
    if (!ENV.AI_ENABLED) {
      return this.fallbackCoaching(userData);
    }

    const cacheKey = this.getCacheKey('generateCoaching', userData);
    const cached = await this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.executeWithTimeout(
        () => this.client.generateCoaching(userData),
        30000,
        1
      );

      if (result.success) {
        await this.setCachedResult(cacheKey, result.data);
      }

      return result.data;
    } catch (error: any) {
      logger.error('Coaching generation failed, using fallback', {
        error: error.message,
        userId: userData.userId,
      });
      return this.fallbackCoaching(userData);
    }
  }

  async analyzeAttendance(attendanceData: any): Promise<any> {
    if (!ENV.AI_ENABLED) {
      return this.fallbackAttendanceAnalysis(attendanceData);
    }

    const cacheKey = this.getCacheKey('analyzeAttendance', attendanceData);
    const cached = await this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.executeWithTimeout(
        () => this.client.analyzeAttendance(attendanceData),
        30000,
        1
      );

      if (result.success) {
        await this.setCachedResult(cacheKey, result.data);
      }

      return result.data;
    } catch (error: any) {
      logger.error('Attendance analysis failed, using fallback', {
        error: error.message,
        userId: attendanceData.userId,
      });
      return this.fallbackAttendanceAnalysis(attendanceData);
    }
  }

  async recommendTaskReassignment(teamData: any): Promise<any> {
    if (!ENV.AI_ENABLED) {
      return this.fallbackTaskReassignment(teamData);
    }

    const cacheKey = this.getCacheKey('recommendTaskReassignment', teamData);
    const cached = await this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.executeWithTimeout(
        () => this.client.recommendTaskReassignment(teamData),
        30000,
        1
      );

      if (result.success) {
        await this.setCachedResult(cacheKey, result.data, 1800); // 30 min cache
      }

      return result.data;
    } catch (error: any) {
      logger.error('Task reassignment failed, using fallback', {
        error: error.message,
        organizationId: teamData.organizationId,
      });
      return this.fallbackTaskReassignment(teamData);
    }
  }

  async simulateManagementDecision(scenarioData: any): Promise<any> {
    if (!ENV.AI_ENABLED) {
      return this.fallbackManagementDecision(scenarioData);
    }

    const cacheKey = this.getCacheKey('simulateManagementDecision', scenarioData);
    const cached = await this.getCachedResult(cacheKey);
    if (cached) return cached;

    try {
      const result = await this.executeWithTimeout(
        () => this.client.simulateManagementDecision(scenarioData),
        30000,
        1
      );

      if (result.success) {
        await this.setCachedResult(cacheKey, result.data, 1800); // 30 min cache
      }

      return result.data;
    } catch (error: any) {
      logger.error('Management decision simulation failed, using fallback', {
        error: error.message,
        organizationId: scenarioData.organizationId,
      });
      return this.fallbackManagementDecision(scenarioData);
    }
  }

  // Fallback methods
  private fallbackBurnoutPrediction(userData: any) {
    return {
      burnoutRisk: 'low',
      probability: 20,
      warningSigns: [],
      recommendations: ['Monitor work patterns', 'Maintain work-life balance'],
    };
  }

  private fallbackCoaching(userData: any) {
    return {
      coachingTips: ['Set clear daily goals', 'Take regular breaks', 'Prioritize important tasks'],
      focusAreas: ['Time management'],
      nextSteps: ['Review weekly progress', 'Adjust work schedule if needed'],
    };
  }

  private fallbackAttendanceAnalysis(attendanceData: any) {
    return {
      attendanceScore: 90,
      insights: ['Regular attendance pattern'],
      trends: ['Consistent work schedule'],
    };
  }

  private fallbackTaskReassignment(teamData: any) {
    return {
      reassignments: [],
      workloadBalance: 'maintained',
    };
  }

  private fallbackManagementDecision(scenarioData: any) {
    return {
      recommendedOption: scenarioData.options?.[0]?.id || null,
      expectedOutcomes: ['Balanced team workload'],
      risks: ['Minimal transition challenges'],
      confidence: 70,
    };
  }
}

export const aiService = new AIService();
export default aiService;
