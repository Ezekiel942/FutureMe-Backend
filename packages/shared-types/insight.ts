export interface Insight {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  type: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical' | string;
  data?: any;
  createdAt: string;
}

export interface ProjectRiskPrediction {
  riskLevel: 'low' | 'medium' | 'high';
  predictedDelayDays: number;
  reasons: string[];
  mitigationSteps: string[];
}
