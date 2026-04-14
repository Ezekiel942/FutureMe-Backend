export interface BurnoutInsight {
  type: 'burnout';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export const analyzeBurnout = async (): Promise<BurnoutInsight | null> => {
  // Placeholder: safe default returns null (no burnout detected)
  return null;
};
