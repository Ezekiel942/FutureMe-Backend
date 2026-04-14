import {
  getRulesByOrganization,
  upsertRules,
  getEffectiveRules,
  deleteRules,
} from '../../database/models/CustomTenantRules.model';
import logger from '@utils/logger';

/**
 * CustomTenantRules Service
 *
 * Manages organization-specific session validation rules.
 * Provides high-level operations for CRUD and validation.
 */

export interface TenantRulesConfig {
  minSessionLength?: number;
  maxDailyHours?: number;
  idleTimeout?: number;
  overtimeThreshold?: number;
}

export interface TenantRulesResponse {
  organizationId: string;
  minSessionLength: number;
  maxDailyHours: number;
  idleTimeout: number;
  overtimeThreshold: number;
  isCustom: boolean;
}

/**
 * Validate tenant rule values.
 * Ensures all values are positive and reasonable.
 */
export const validateRuleValues = (
  config: TenantRulesConfig
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (config.minSessionLength !== undefined) {
    if (config.minSessionLength < 60) {
      errors.push('minSessionLength must be at least 60 seconds (1 minute)');
    }
    if (config.minSessionLength > 3600) {
      errors.push('minSessionLength must not exceed 3600 seconds (1 hour)');
    }
  }

  if (config.maxDailyHours !== undefined) {
    if (config.maxDailyHours < 1) {
      errors.push('maxDailyHours must be at least 1 hour');
    }
    if (config.maxDailyHours > 24) {
      errors.push('maxDailyHours must not exceed 24 hours');
    }
  }

  if (config.idleTimeout !== undefined) {
    if (config.idleTimeout < 5) {
      errors.push('idleTimeout must be at least 5 minutes');
    }
    if (config.idleTimeout > 120) {
      errors.push('idleTimeout must not exceed 120 minutes (2 hours)');
    }
  }

  if (config.overtimeThreshold !== undefined) {
    if (config.overtimeThreshold < 1) {
      errors.push('overtimeThreshold must be at least 1 hour');
    }
    if (config.overtimeThreshold > 24) {
      errors.push('overtimeThreshold must not exceed 24 hours');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Get tenant rules with custom flag.
 * Indicates whether rules are custom or using system defaults.
 */
export const getTenantRules = async (organizationId: string): Promise<TenantRulesResponse> => {
  const customRules = await getRulesByOrganization(organizationId);
  const effectiveRules = await getEffectiveRules(organizationId);

  return {
    organizationId,
    ...effectiveRules,
    isCustom: !!customRules,
  };
};

/**
 * Update tenant rules.
 * Returns validation errors if values are invalid.
 */
export const updateTenantRules = async (
  organizationId: string,
  config: TenantRulesConfig
): Promise<{ success: boolean; errors: string[]; data?: TenantRulesResponse }> => {
  // Validate input
  const validation = validateRuleValues(config);
  if (!validation.valid) {
    logger.warn('Invalid tenant rule values', {
      organizationId,
      config,
      errors: validation.errors,
    });
    return { success: false, errors: validation.errors };
  }

  try {
    // Upsert (create if not exists, update if does)
    await upsertRules(organizationId, config as any);

    // Fetch and return updated rules
    const rules = await getTenantRules(organizationId);

    logger.info('Tenant rules updated', {
      organizationId,
      rules,
    });

    return { success: true, errors: [], data: rules };
  } catch (error) {
    logger.error('Failed to update tenant rules', {
      organizationId,
      error: String(error),
    });
    return {
      success: false,
      errors: ['Failed to save tenant rules'],
    };
  }
};

/**
 * Reset tenant rules to system defaults.
 */
export const resetTenantRules = async (
  organizationId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const deleted = await deleteRules(organizationId);

    if (deleted) {
      logger.info('Tenant rules reset to defaults', { organizationId });
      return { success: true, message: 'Rules reset to system defaults' };
    } else {
      // No custom rules existed, already using defaults
      return { success: true, message: 'Already using system defaults' };
    }
  } catch (error) {
    logger.error('Failed to reset tenant rules', {
      organizationId,
      error: String(error),
    });
    return { success: false, message: 'Failed to reset rules' };
  }
};

export default {
  getTenantRules,
  updateTenantRules,
  resetTenantRules,
  validateRuleValues,
};
