import { Request, Response } from 'express';
import * as BillingService from '../../modules/billing/billing.service';
import {
  listSubscriptionsByOrg,
  type Subscription,
} from '../../database/models/Subscription.model';

const success = (res: Response, data: unknown) =>
  res.json({ success: true, data });

const fail = (
  res: Response,
  message: string,
  code?: string,
  status = 400
) =>
  res.status(status).json({ success: false, message, code });

export const getBillingOverview = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user?.organizationId) {
      return fail(res, 'Organization not found', 'ORG_NOT_FOUND', 404);
    }

    const subscriptions: Subscription[] =
      await listSubscriptionsByOrg(user.organizationId);

    const activeSubscription = subscriptions.find(
      (s: Subscription) => s.status === 'active'
    );

    if (!activeSubscription) {
      return success(res, {
        plan: 'free',
        status: 'active',
        details: BillingService.getPlanDetails('free'),
      });
    }

    const planDetails = BillingService.getPlanDetails(
      activeSubscription.plan
    );

    success(res, {
      id: activeSubscription.id,
      plan: activeSubscription.plan,
      status: activeSubscription.status,
      startedAt: activeSubscription.startedAt,
      details: planDetails,
    });
  } catch (err: any) {
    fail(
      res,
      err?.message || 'Failed to fetch billing overview',
      err?.code,
      err?.status || 400
    );
  }
};

export const upgradePlan = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user?.organizationId) {
      return fail(res, 'Organization not found', 'ORG_NOT_FOUND', 404);
    }

    const { subscriptionId, newPlan } = req.body;
    if (!subscriptionId || !newPlan) {
      return fail(res, 'Missing subscriptionId or newPlan', 'INVALID_INPUT', 400);
    }

    const updated = await BillingService.upgradeSubscription(
      subscriptionId,
      newPlan,
      user.id
    );

    success(res, updated);
  } catch (err: any) {
    fail(
      res,
      err?.message || 'Failed to upgrade plan',
      err?.code,
      err?.status || 400
    );
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user?.organizationId) {
      return fail(res, 'Organization not found', 'ORG_NOT_FOUND', 404);
    }

    const { subscriptionId } = req.body;
    if (!subscriptionId) {
      return fail(res, 'Missing subscriptionId', 'INVALID_INPUT', 400);
    }

    const updated = await BillingService.cancelSubscription(
      subscriptionId,
      user.id
    );

    success(res, updated);
  } catch (err: any) {
    fail(
      res,
      err?.message || 'Failed to cancel subscription',
      err?.code,
      err?.status || 400
    );
  }
};

export default {
  getBillingOverview,
  upgradePlan,
  cancelSubscription,
};
