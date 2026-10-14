'use strict';
const {headRef,recordPublication,materialShift}=require('./_shift-change-review.cjs');
const {readWorkspaceMember,inactiveRecord}=require('./_chaos-admin');
async function sendCancellation({db,app,event}) {
  const ref=db.collection('scheduleChangeEvents').doc(event.version);
  for(const uid of event.recipientUids){
    const userSnap=await db.collection('users').doc(uid).get(),user=userSnap.exists?userSnap.data():null;
    const member=user?await readWorkspaceMember(db,uid,user.email,event.restaurantId):null;
    let state='not-authorized',tokens=[];
    if(user&&!inactiveRecord(user)&&member&&!inactiveRecord(member)){
      const account=await app.auth().getUser(uid).catch(()=>null);
      if(account&&!account.disabled){tokens=[...new Set([user.fcmToken,...(Array.isArray(user.fcmTokens)?user.fcmTokens:[]),...(Array.isArray(user.pushTokens)?user.pushTokens:[]).map(row=>typeof row==='string'?row:row?.token)].filter(value=>typeof value==='string'&&value))].slice(0,500);state=user.preferences?.notifSchedule===false?'opted-out':tokens.length?'reserved':'no-token';}
    }
    const reserved=await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);if(!snap.exists||snap.data().notificationReceipts?.[uid])return false;
      tx.update(ref,{notificationReceipts:{...(snap.data().notificationReceipts||{}),[uid]:{state,attemptedAt:new Date().toISOString(),delivered:false}}});return true;
    });
    if(!reserved||state!=='reserved')continue;
    try{const result=await app.messaging().sendEachForMulticast({tokens,notification:{title:'Published shift cancelled',body:'A published shift affecting you was cancelled. Review the change in My Schedule.'},data:{type:'schedule',restaurantId:event.restaurantId,version:event.version,click_action:'/?tab=published'}});state=result.responses?.some(row=>row.success)?'provider-accepted':'provider-rejected';}catch(_){state='ambiguous';}
    await db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists)tx.update(ref,{notificationReceipts:{...(snap.data().notificationReceipts||{}),[uid]:{state,attemptedAt:new Date().toISOString(),delivered:false}}});});
  }
}
async function cancelPublishedRows({db,rows,restaurantId,ctx,app}) {
  let deleted=0;
  for(let offset=0;offset<rows.length;offset+=100){
    const chunk=rows.slice(offset,offset+100);
    const result=await db.runTransaction(async tx=>{
      const records=[];
      for(const row of chunk){const ref=db.collection('shifts').doc(row.id);const [snap,head]=await Promise.all([tx.get(ref),tx.get(headRef(db,restaurantId,row.id))]);records.push({row,ref,snap,head});}
      const events=[];let count=0;
      for(const {row,ref,snap,head} of records){
        if(!snap.exists)continue;const current=snap.data();
        if(!['restaurantId','workspaceId','tenantId'].some(field=>String(current[field]||'').trim()===restaurantId)||['restaurantId','workspaceId','tenantId'].some(field=>String(current[field]||'').trim()!==String(row[field]||'').trim()))throw Object.assign(new Error('The shift workspace changed. Reload before deleting.'),{statusCode:409,code:'shift_workspace_changed'});
        if(current.revision!==row.revision||current.updatedAt!==row.updatedAt||JSON.stringify(materialShift(current))!==JSON.stringify(materialShift(row)))throw Object.assign(new Error('The shift changed after delete review. Reload before deleting.'),{statusCode:409,code:'shift_changed'});
        const previous=head.exists?head.data():null;
        if(previous||current.isPublished===true){
          const before=previous?.after||materialShift(current);
          const event=recordPublication({db,tx,head:previous||{after:before},tenant:restaurantId,shiftId:row.id,shift:{date:before.date,scheduleDateKey:before.date,startTime:before.startTime,endTime:before.endTime,rosterRoleId:before.roleId,rosterRoleNameSnapshot:before.role,location:before.location,authUid:before.authUid,accountUserId:before.authUid,employeeId:before.employeeId,scheduleUserId:before.employeeId,employeeName:before.employeeName,cancelled:true},operationId:`withdraw_${previous?.version||row.id}`,actor:ctx.uid,at:new Date().toISOString()});
          if(event)events.push(event);
        }
        tx.delete(ref);count++;
      }
      return{events,count};
    });
    deleted+=result.count;
    // A committed cancellation remains committed if notification transport fails.
    // The private event records whether delivery was attempted or remains unknown.
    if(app)for(const event of result.events){try{await sendCancellation({db,app,event});}catch(_){}}
  }
  return deleted;
}
module.exports={cancelPublishedRows,sendCancellation};
