import {
  createSubscription as createSub,
  findSubscriptionById,
  listSubscriptionsByOrg,
} from '../../database/models/Subscription.model';
import { createAudit } from '../../database/models/AuditLog.model';

export interface SubscriptionPlan {
  name: 'free' | 'pro' | 'enterprise';
  monthlyRate: number;
  sessionsPerMonth: number;
  teamMembers: number;
  features: string[];
}

const PLANS: Record<string, SubscriptionPlan> = {
  free: {
    name: 'free',
    monthlyRate: 0,
    sessionsPerMonth: 50,
    teamMembers: 1,
    features: ['basic_tracking', 'local_export'],
  },
  pro: {
    name: 'pro',
    monthlyRate: 29,
    sessionsPerMonth: 500,
    teamMembers: 10,
    features: ['basic_tracking', 'analytics', 'team_management', 'api_access'],
  },
  enterprise: {
    name: 'enterprise',
    monthlyRate: 0, // Custom pricing
    sessionsPerMonth: -1, // Unlimited
    teamMembers: -1, // Unlimited
    features: [
      'basic_tracking',
      'advanced_analytics',
      'team_management',
      'api_access',
      'sso',
      'audit_logs',
      'dedicated_support',
    ],
  },
};

export const getPlanDetails = (planName: string): SubscriptionPlan | null => {
  return PLANS[planName] || null;
};

export const createSubscription = async (organizationId: string, plan: string, actor?: string) => {
  const planDetails = PLANS[plan];
  if (!planDetails) {
    const err: any = new Error(`Invalid plan: ${plan}`);
    err.status = 400;
    throw err;
  }

  const subscription = await createSub({
    organizationId,
    plan,
    status: 'active',
  } as any);

  // Log the subscription creation
  await logAudit({
    actorId: actor,
    action: 'subscription.created',
    resourceType: 'subscription',
    resourceId: subscription.id,
    meta: { plan },
  });

  return subscription;
};

export const upgradeSubscription = async (
  subscriptionId: string,
  newPlan: string,
  actor?: string
) => {
  const subscription = await findSubscriptionById(subscriptionId);
  if (!subscription) {
    const err: any = new Error('Subscription not found');
    err.status = 404;
    throw err;
  }

  const planDetails = PLANS[newPlan];
  if (!planDetails) {
    const err: any = new Error(`Invalid plan: ${newPlan}`);
    err.status = 400;
    throw err;
  }

  const oldPlan = subscription.plan;
  subscription.plan = newPlan;
  const updated = await subscription.save();

  // Log the upgrade
  await logAudit({
    actorId: actor,
    action: 'subscription.upgraded',
    resourceType: 'subscription',
    resourceId: subscription.id,
    meta: { oldPlan, newPlan },
  });

  return updated;
};

export const cancelSubscription = async (subscriptionId: string, actor?: string) => {
  const subscription = await findSubscriptionById(subscriptionId);
  if (!subscription) {
    const err: any = new Error('Subscription not found');
    err.status = 404;
    throw err;
  }

  subscription.status = 'cancelled';
  subscription.endedAt = new Date().toISOString();
  const updated = await subscription.save();

  // Log the cancellation
  await logAudit({
    actorId: actor,
    action: 'subscription.cancelled',
    resourceType: 'subscription',
    resourceId: subscription.id,
    meta: { plan: subscription.plan },
  });

  return updated;
};

export const getSubscriptionsByOrg = async (organizationId: string) => {
  return listSubscriptionsByOrg(organizationId);
};

export const logAudit = async (audit: {
  actorId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  meta?: any;
}) => {
  return createAudit(audit);
};

export default {
  getPlanDetails,
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
  getSubscriptionsByOrg,
  logAudit,
};
