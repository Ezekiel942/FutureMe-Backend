import { Request, Response } from 'express';
import tenantRulesService from '../../modules/tenant/customTenantRules.service';

const success = (res: Response, data: unknown) => res.json({ success: true, data });
const fail = (res: Response, message: string, code?: string, status = 400) =>
  res.status(status).json({ success: false, message, code });

export const getTenantRules = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const organizationId = (user as any).organizationId;
    if (!organizationId) return fail(res, 'Organization not found in token', 'NO_ORG', 400);

    const data = await tenantRulesService.getTenantRules(organizationId);
    success(res, data);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to fetch tenant settings', err?.code, err?.status || 500);
  }
};

export const updateTenantRules = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const organizationId = (user as any).organizationId;
    if (!organizationId) return fail(res, 'Organization not found in token', 'NO_ORG', 400);

    const config = req.body;
    const result = await tenantRulesService.updateTenantRules(organizationId, config);

    if (!result.success) {
      return fail(res, 'Invalid tenant settings', 'INVALID_RULES', 400);
    }

    success(res, result.data);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to update tenant settings', err?.code, err?.status || 500);
  }
};

export const resetTenantRules = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 'UNAUTHORIZED', 401);

    const organizationId = (user as any).organizationId;
    if (!organizationId) return fail(res, 'Organization not found in token', 'NO_ORG', 400);

    const result = await tenantRulesService.resetTenantRules(organizationId);
    success(res, result);
  } catch (err: any) {
    fail(res, err?.message || 'Failed to reset tenant settings', err?.code, err?.status || 500);
  }
};
