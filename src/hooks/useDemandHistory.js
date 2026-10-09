import { useLiveCollectionState, hasAnyPermission } from '../core/appCore';

export function useDemandHistory(appUser, currentDate, enabled) {
  const canRead = hasAnyPermission(appUser,['sales','salesRead','financialRead','labor','laborRead','wageView','wageEdit']);
  const start = new Date(`${currentDate}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate()-112);
  const state = useLiveCollectionState('sales',appUser?.restaurantId,{
    enabled:Boolean(enabled && canRead && appUser?.restaurantId),
    whereClauses:[['date','>=',start.toISOString().slice(0,10)],['date','<',currentDate]],
    orderByField:'date',orderDirection:'desc',requireServerSnapshot:true,limitCount:400,debugLabel:'intelligence:112-day-sales-history'
  });
  return {...state,allowed:canRead,limit:400};
}
