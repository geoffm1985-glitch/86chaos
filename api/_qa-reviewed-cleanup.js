'use strict';
// Only called after the QA endpoint has authenticated the operator and verified
// the exact current-run restaurant. Never traverse arbitrary child collections.
async function reviewedQaCleanupRefs({db,restaurant,runId,vendors=[]}) {
  const data=restaurant.data();
  if(!restaurant.exists || data.qaOwned!==true || data.qaRunId!==runId)throw new Error('Current-run QA restaurant ownership is required.');
  const refs=[];
  const collect=async(collection,tenantRequired)=>{
    const result=await collection.limit(901).get();
    if(result.docs.length>900)throw new Error('Reviewed QA cleanup exceeds its bounded document limit.');
    for(const document of result.docs){if(tenantRequired && document.data().restaurantId!==restaurant.id)throw new Error('Reviewed QA child has a conflicting workspace identity.');refs.push(document.ref);}
  };
  for(const name of ['demandItemHistory','demandImportLines'])await collect(restaurant.ref.collection(name),false);
  for(const ref of vendors){const vendor=await ref.get();if(!vendor.exists)continue;const row=vendor.data();if(row.restaurantId!==restaurant.id || row.qaOwned!==true || row.qaRunId!==runId)throw new Error('Current-run QA vendor ownership is required.');await collect(ref.collection('catalogProducts'),true);}
  await collect(db.collection('shifts').where('restaurantId','==',restaurant.id).where('source','==','demand_forecast_review'),true);
  return refs;
}
module.exports={reviewedQaCleanupRefs};
