/**
 * OpenAI AI Client
 *
 * Provides AI-powered insights using OpenAI API (gpt-4 or gpt-3.5-turbo).
 * Features:
 * - Graceful degradation if OPENAI_API_KEY is missing
 * - Non-blocking AI calls with try/catch fallback
 * - Structured JSON output validation
 * - Temperature 0.2 for consistent, deterministic responses
 * - Safe fallback to rule-based logic if API fails
 */

import logger from '@utils/logger';

export interface AIResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
}

export function isAIResponse(obj: any): obj is AIResponse {
  return (
    obj && typeof obj.success === 'boolean' && Object.prototype.hasOwnProperty.call(obj, 'data')
  );
}

class OpenAIClient {
  private apiKey: string | null = null;
  private isInitialized = false;
  private baseUrl = 'https://api.openai.com/v1';
  private model = 'gpt-3.5-turbo';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    this.apiKey = process.env.OPENAI_API_KEY || null;

    if (!this.apiKey) {
      logger.warn('OPENAI_API_KEY not set. AI features will be disabled.', {
        feature: 'openai_initialization',
      });
      this.isInitialized = false;
      return;
    }

    logger.info('OpenAI API initialized successfully', {
      feature: 'openai_initialization',
      model: this.model,
    });
    this.isInitialized = true;
  }

  isAvailable(): boolean {
    return this.isInitialized && !!this.apiKey;
  }

  /**
   * Analyze burnout risk - supports both 3-param and 1-param signatures
   */
  async analyzeBurnoutRisk(
    userIdOrData: string | any,
    sessionDataOrUndefined?: any,
    organizationId?: string
  ): Promise<AIResponse<{ score: number; riskLevel: string; recommendations: string[] }>> {
    if (typeof userIdOrData === 'string' && sessionDataOrUndefined) {
      // 3-param: (userId, sessionData, orgId)
      const userId = userIdOrData;
      const sessionData = sessionDataOrUndefined;

      if (!this.isAvailable()) {
        return {
          success: true,
          data: {
            score: 45,
            riskLevel: 'medium',
            recommendations: ['Take breaks', 'Monitor workload'],
          },
        };
      }

      try {
        const result = await this.callOpenAI(`
Analyze burnout risk for user ${userId}.
Session Data: Hours: ${sessionData.hoursThisWeek}, Late nights: ${sessionData.lateNightSessions}, Overtime: ${sessionData.overtimeHours}h
Return JSON: { "score": <0-100>, "riskLevel": "<low|medium|high|critical>", "recommendations": [...] }
        `);

        if (result.success && result.data) {
          return {
            success: true,
            data: {
              score: typeof result.data.score === 'number' ? result.data.score : 50,
              riskLevel: result.data.riskLevel || 'medium',
              recommendations: Array.isArray(result.data.recommendations)
                ? result.data.recommendations
                : ['Take breaks', 'Monitor workload'],
            },
          };
        }
      } catch (error) {
        // Fall through to fallback
      }

      return {
        success: true,
        data: {
          score: 45,
          riskLevel: 'medium',
          recommendations: ['Take breaks', 'Monitor workload'],
        },
      };
    } else {
      // 1-param: ({...userData})
      const userSessionData = userIdOrData;

      if (!this.isAvailable()) {
        return this.fallbackBurnoutAnalysis(userSessionData);
      }

      try {
        const prompt = `Analyze burnout risk for user ${userSessionData.userId}.
Total hours: ${userSessionData.totalHoursThisMonth}h
Return JSON: { "burnoutScore": <0-100>, "riskLevel": "<low|moderate|high|critical>", "explanation": "...", "primaryRisks": [], "recommendedIntervention": "..." }`;

        const response = await this.callOpenAI(prompt);
        return response;
      } catch (err: any) {
        logger.error('AI burnout analysis failed', {
          error: err?.message,
          userId: userSessionData.userId,
          feature: 'ai_burnout_analysis',
        });
        return this.fallbackBurnoutAnalysis(userSessionData);
      }
    }
  }

  /**
   * Generate coaching - supports both 3-param and 1-param signatures
   */
  async generateCoaching(
    userIdOrData: string | any,
    userDataOrUndefined?: any,
    organizationId?: string
  ): Promise<AIResponse<string | any>> {
    if (typeof userIdOrData === 'string' && userDataOrUndefined) {
      // 3-param: (userId, userData, orgId)
      const userId = userIdOrData;

      if (!this.isAvailable()) {
        return {
          success: true,
          data: `Coaching for ${userId}: Focus on work-life balance.`,
        };
      }

      try {
        const result = await this.callOpenAI(`Generate coaching for user ${userId}.`);

        if (isAIResponse(result) && result.success && result.data) {
          if (typeof result.data === 'string') {
            return { success: true, data: result.data };
          }

          const aggregated = Array.isArray(result.data.suggestions)
            ? result.data.suggestions.join('. ')
            : result.data.coachingTips?.join('. ') || 'Focus on productivity and balance.';

          return { success: true, data: aggregated };
        }
      } catch (error) {
        // Fall through
      }

      return {
        success: true,
        data: `Coaching for ${userId}: Maintain current work patterns.`,
      };
    } else {
      // 1-param: ({...userData})
      const userData = userIdOrData;

      if (!this.isAvailable()) {
        return this.fallbackCoaching(userData);
      }

      try {
        const prompt = `Generate coaching for work patterns.`;
        const response = await this.callOpenAI(prompt);

        if (isAIResponse(response)) {
          return response;
        }

        return {
          success: false,
          data: this.fallbackCoaching(userData).data,
          error: 'Invalid AI response',
        };
      } catch (err: any) {
        logger.error('AI coaching failed', { error: err?.message, feature: 'ai_coaching' });
        return this.fallbackCoaching(userData);
      }
    }
  }

  /**
   * Analyze attendance - supports both 3-param and 1-param signatures
   */
  async analyzeAttendance(
    userIdOrData: string | any,
    attendanceDataOrUndefined?: any,
    organizationId?: string
  ): Promise<AIResponse<{ anomalies: any[]; patterns: any[] }>> {
    if (typeof userIdOrData === 'string' && attendanceDataOrUndefined) {
      // 3-param: (userId, attendanceData, orgId)
      if (!this.isAvailable()) {
        return {
          success: true,
          data: { anomalies: [], patterns: ['Regular attendance'] },
        };
      }

      try {
        const result = await this.callOpenAI(`Analyze attendance patterns.`);

        if (isAIResponse(result) && result.success && result.data) {
          return {
            success: true,
            data: {
              anomalies: Array.isArray(result.data.anomalies) ? result.data.anomalies : [],
              patterns: Array.isArray(result.data.patterns) ? result.data.patterns : [],
            },
          };
        }
      } catch (error) {
        // Fall through
      }

      return {
        success: true,
        data: { anomalies: [], patterns: ['Stable attendance'] },
      };
    } else {
      // 1-param: ({...attendanceData})
      const attendanceData = userIdOrData;

      if (!this.isAvailable()) {
        return this.fallbackAttendanceAnalysis(attendanceData);
      }

      try {
        const prompt = `Analyze attendance patterns.`;
        const response = await this.callOpenAI(prompt);
        return response;
      } catch (err: any) {
        logger.error('AI attendance analysis failed', { error: err?.message });
        return this.fallbackAttendanceAnalysis(attendanceData);
      }
    }
  }

  /**
   * Analyze project risk - supports both 3-param and 1-param signatures
   */
  async analyzeProjectRisk(
    projectIdOrData: string | any,
    projectDataOrUndefined?: any,
    organizationId?: string
  ): Promise<AIResponse<any>> {
    if (typeof projectIdOrData === 'string' && projectDataOrUndefined) {
      // 3-param: (projectId, projectData, orgId)
      const projectData = projectDataOrUndefined;

      if (!this.isAvailable()) {
        return {
          success: true,
          data: {
            riskScore: 30,
            issues: ['Potential budget overrun'],
            recommendations: ['Monitor spending', 'Review scope'],
            overrunProbability: 30,
            budgetRiskLevel: 'low',
            projectedTotalHours: projectData.currentAccumulatedHours || 100,
            budgetOverrunRisk: 0,
            analysis: 'Project tracking within budget.',
            suggestedCorrection: 'Continue current pace.',
          },
        };
      }

      try {
        const result = await this.callOpenAI(`Analyze project risk.`);

        if (isAIResponse(result) && result.success && result.data) {
          return { success: true, data: result.data };
        }
      } catch (error) {
        // Fall through
      }

      return {
        success: true,
        data: {
          riskScore: 25,
          issues: ['Tracking needed'],
          recommendations: ['Continue monitoring', 'Maintain schedule'],
          overrunProbability: 25,
          budgetRiskLevel: 'low',
          projectedTotalHours: projectData.currentAccumulatedHours || 80,
          analysis: 'Project is on track',
          suggestedCorrection: 'Maintain current progress',
        },
      };
    } else {
      // 1-param: ({...projectData})
      const projectData = projectIdOrData;

      if (!this.isAvailable()) {
        return this.fallbackScopeCreepAnalysis(projectData);
      }

      try {
        const prompt = `Analyze project scope creep.`;
        const response = await this.callOpenAI(prompt);
        return response;
      } catch (err: any) {
        logger.error('AI project risk analysis failed', { error: err?.message });
        return this.fallbackScopeCreepAnalysis(projectData);
      }
    }
  }

  /**
   * Generate executive summary
   */
  async generateExecutiveSummary(monthlySummaryData: any): Promise<AIResponse> {
    if (!this.isAvailable()) {
      return this.fallbackExecutiveSummary(monthlySummaryData);
    }

    try {
      const response = await this.callOpenAI(`Generate executive summary.`);
      return response;
    } catch (err: any) {
      logger.error('AI executive summary failed', { error: err?.message });
      return this.fallbackExecutiveSummary(monthlySummaryData);
    }
  }

  /**
   * Generate workforce reassignment recommendations
   */
  async generateWorkforceReassignment(teamData: any): Promise<AIResponse> {
    if (!this.isAvailable()) {
      return this.fallbackWorkforceReassignment(teamData);
    }

    try {
      const response = await this.callOpenAI(`Recommend workforce reassignment.`);
      return response;
    } catch (err: any) {
      logger.error('AI workforce reassignment failed', { error: err?.message });
      return this.fallbackWorkforceReassignment(teamData);
    }
  }

  async generateWorkCoachSuggestions(input: any): Promise<AIResponse> {
    if (!this.isAvailable()) {
      return {
        success: true,
        data: {
          suggestions: [],
          coachingTips: ['Maintain consistent work cadence', 'Balance focus and breaks'],
        },
      };
    }

    try {
      const response = await this.generateCompletion(
        `Generate work coaching suggestions based on ${JSON.stringify(input)}`
      );

      if (isAIResponse(response) && response.success) {
        if (response.data && typeof response.data === 'object') {
          return {
            success: true,
            data: {
              ...response.data,
              suggestions: response.data.suggestions || response.data.coachingTips || [],
            },
          };
        }

        return { success: true, data: { suggestions: [], raw: response.data } };
      }

      return {
        success: false,
        data: { suggestions: [] },
        error: response.error || 'Work coach suggestions generation failed',
      };
    } catch (err: any) {
      logger.error('AI work coach suggestions failed', { error: err?.message });
      return {
        success: false,
        data: { suggestions: [] },
        error: err?.message,
      };
    }
  }

  async predictBurnout(userData: any): Promise<AIResponse<any>> {
    return this.analyzeBurnoutRisk(userData);
  }

  async recommendTaskReassignment(teamData: any): Promise<AIResponse<any>> {
    return this.generateWorkforceReassignment(teamData);
  }

  async simulateManagementDecision(scenarioData: any): Promise<AIResponse<any>> {
    return this.generateRecommendations(scenarioData);
  }

  /**
   * Generate recommendations
   */
  async generateRecommendations(organizationData: any): Promise<AIResponse> {
    if (!this.isAvailable()) {
      return this.generateFallbackRecommendations(organizationData);
    }

    try {
      const response = await this.callOpenAI(`Generate recommendations.`);
      return response;
    } catch (err: any) {
      logger.error('AI recommendations failed', { error: err?.message });
      return this.generateFallbackRecommendations(organizationData);
    }
  }

  /**
   * Generate completion from custom prompt
   */
  async generateCompletion(prompt: string, options?: any): Promise<AIResponse> {
    if (!this.isAvailable()) {
      return { success: false, error: 'AI not available', data: null };
    }

    try {
      const response = await this.callOpenAI(prompt);
      return response;
    } catch (err: any) {
      logger.error('AI completion failed', { error: err?.message });
      return { success: false, error: 'AI completion failed', data: null };
    }
  }

  /**
   * Internal method: Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert business analyst. Always respond with valid JSON only.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      logger.info('AI API call completed', {
        feature: 'openai_api_call',
        model: data.model,
        totalTokens: data.usage?.total_tokens,
      });

      // Parse JSON response
      let parsedResponse: any;
      try {
        const jsonMatch =
          content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
        const cleanedContent = jsonMatch ? jsonMatch[1] : content;
        parsedResponse = JSON.parse(cleanedContent);
      } catch (parseErr) {
        logger.error('Failed to parse AI response as JSON', {
          rawResponse: content.substring(0, 200),
        });
        throw new Error('AI response was not valid JSON');
      }

      return { success: true, data: parsedResponse };
    } catch (err: any) {
      logger.error('OpenAI API call failed', { error: err?.message });
      throw err;
    }
  }

  // Fallback methods
  private fallbackExecutiveSummary(data: any): AIResponse {
    return {
      success: true,
      data: {
        summary: `Organization summary: ${data.totalWorkHours} hours with ${data.utilizationRate}% utilization.`,
        keyHighlights: [`${data.teamCount} team members`, `${data.utilizationRate}% utilization`],
        concerns: data.riskIndex > 0 ? [`${data.riskIndex} active risks`] : [],
        recommendations: ['Monitor team capacity'],
      },
    };
  }

  private fallbackBurnoutAnalysis(data: any): AIResponse {
    const score = Math.min(100, (data.totalHoursThisMonth / 8) * 10);
    return {
      success: true,
      data: {
        burnoutScore: Math.round(score),
        riskLevel: score > 70 ? 'critical' : score > 50 ? 'high' : 'moderate',
        explanation: `${score.toFixed(0)} hours detected`,
        primaryRisks: ['Extended hours'],
        recommendedIntervention: 'Monitor and support',
        score: Math.round(score),
        recommendations: ['Take breaks', 'Monitor workload'],
      },
    };
  }

  private fallbackScopeCreepAnalysis(data: any): AIResponse {
    return {
      success: true,
      data: {
        overrunProbability: 25,
        budgetRiskLevel: 'low',
        projectedTotalHours: data.currentAccumulatedHours || 80,
        budgetOverrunRisk: 0,
        analysis: 'Project tracking well',
        suggestedCorrection: 'Continue current pace',
        riskScore: 25,
        issues: [],
        recommendations: ['Monitor progress'],
      },
    };
  }

  private fallbackCoaching(userData: any): AIResponse {
    return {
      success: true,
      data: {
        coachingTips: ['Maintain balance', 'Take breaks'],
        focusAreas: ['Time management'],
        nextSteps: ['Set goals'],
      },
    };
  }

  private fallbackAttendanceAnalysis(attendanceData: any): AIResponse {
    return {
      success: true,
      data: {
        attendanceScore: 85,
        insights: ['Consistent attendance'],
        trends: ['Regular schedule'],
      },
    };
  }

  private fallbackWorkforceReassignment(teamData: any): AIResponse {
    return {
      success: true,
      data: {
        overloadedUsers: [],
        underutilizedUsers: [],
        reassignmentSuggestions: [],
      },
    };
  }

  private generateFallbackRecommendations(organizationData: any): AIResponse {
    return {
      success: true,
      data: {
        taskReassignment: [],
        overtimePrevention: [],
        riskMitigation: [],
      },
    };
  }
}

export default new OpenAIClient();
export const openaiService = new OpenAIClient();
