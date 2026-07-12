import { useMemo } from 'react';
import { resolveFeatureAccess, resolveSubscription, featureForRoute, featureForFinancialSubtab, getPlanDefinition, featureLabel } from '../lib/featureAccess';
import { FEATURE_KEYS } from '../config/plans';

export const usePlanAccess = (appUser, clientData) => {
  return useMemo(() => {
    const workspace = clientData || {};
    const user = appUser || {};
    const subscription = resolveSubscription(workspace, user);
    const canUse = (featureKey) => resolveFeatureAccess({ workspace, user, featureKey });
    const canRoute = (route) => {
      const featureKey = featureForRoute(route);
      return featureKey ? canUse(featureKey) : { allowed: true, reason: 'no_feature_gate', subscription };
    };
    const canFinancialSubtab = (subTab) => {
      const featureKey = featureForFinancialSubtab(subTab);
      return featureKey ? canUse(featureKey) : { allowed: true, reason: 'no_feature_gate', subscription };
    };
    const plan = getPlanDefinition(subscription.planId);
    return { subscription, plan, canUse, canRoute, canFinancialSubtab, featureLabel, features: FEATURE_KEYS };
  }, [appUser, clientData]);
};

export default usePlanAccess;
