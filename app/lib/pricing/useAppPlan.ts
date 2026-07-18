import { useSyncExternalStore } from 'react';

import {
  getAppPlan,
  subscribeAppPlan,
  type AppPlanId,
} from '@/app/lib/pricing/planEntitlements';

export function useAppPlan(): AppPlanId | null {
  return useSyncExternalStore(subscribeAppPlan, getAppPlan, () => null);
}
