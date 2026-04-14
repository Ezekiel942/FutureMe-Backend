export interface AnomalyInsight {
  type: 'anomaly';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export const detectAnomaly = async (): Promise<AnomalyInsight | null> => {
  // Placeholder: safe default returns null (no anomaly detected)
  return null;
};
