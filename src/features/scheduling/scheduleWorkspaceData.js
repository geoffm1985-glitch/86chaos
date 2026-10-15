import { collection, getDocsFromServer, limit, query, where } from 'firebase/firestore';
import { db } from '../../core/appCore';
import { shiftDateBy, workspaceActive } from '../../core/scheduleWorkspace';

export async function loadScheduleWeekVerified(restaurantId,monday) {
  const rows=new Map();
  for(const field of ['date','scheduleDateKey']) {
    const snapshot=await getDocsFromServer(query(collection(db,'shifts'),where('restaurantId','==',restaurantId),where(field,'>=',monday),where(field,'<=',shiftDateBy(monday,6)),limit(2001)));
    if(snapshot.metadata?.fromCache || snapshot.metadata?.hasPendingWrites || snapshot.docs.length>2000)throw new Error('The previous week could not be verified completely. Refresh before copying.');
    for(const doc of snapshot.docs){const row={id:doc.id,...doc.data()};if(row.restaurantId!==restaurantId)throw new Error('Schedule workspace identity changed.');if(workspaceActive(row))rows.set(row.id,row);}
  }
  return [...rows.values()];
}
