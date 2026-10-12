import { withSelectedWorkspaceContext, operationalReviewBoundary, resolvePersonalPreferences } from './workspaceContext';
test('account-only refresh preserves the selected workspace and permission identity',()=>{
 const profile={id:'owner',authUid:'owner',isOwner:true,permissions:{schedule:true}};
 const next=withSelectedWorkspaceContext(profile,'selected');
 expect(next.restaurantId).toBe('selected');expect(next.id).toBe('owner');expect(next.permissions).toBe(profile.permissions);expect(profile.restaurantId).toBeUndefined();
});
test('workspace switch replaces stale profile context',()=>{expect(withSelectedWorkspaceContext({id:'staff',restaurantId:'old',isAdmin:false},'new')).toEqual({id:'staff',restaurantId:'new',isAdmin:false});});
test('clearing a workspace cannot retain stale tenant context or grant permissions',()=>{expect(withSelectedWorkspaceContext({restaurantId:'old',permissions:{}},'')).toEqual({restaurantId:'',permissions:{}});});
test('missing account stays missing',()=>{expect(withSelectedWorkspaceContext(null,'selected')).toBeNull();});

test('owner aliases and hydrated grants preserve the same operational access',()=>{
 const account={id:'owner',uid:'owner',restaurantId:'one',role:'Owner',isAdmin:true,isOwner:true,accountOwner:true,workspaceOwner:true};
 const member={...account,owner:true,permissions:{settings:true,hr:true,systemAdmin:false}};
 expect(operationalReviewBoundary(member)).toBe(operationalReviewBoundary(account));
 expect(operationalReviewBoundary({...member,isAdmin:false,isOwner:false,accountOwner:false,workspaceOwner:false,owner:false})).not.toBe(operationalReviewBoundary(account));
});
test('staff grant loss still changes the operational boundary',()=>{
 const actor={id:'staff',restaurantId:'one',permissions:{settings:true,hr:true}};
 expect(operationalReviewBoundary({...actor,permissions:{hr:true}})).not.toBe(operationalReviewBoundary(actor));
});
test('account language outranks a stale copied membership preference',()=>{
 expect(resolvePersonalPreferences({preferences:{language:'es'}},{preferences:{language:'en'}})).toEqual({language:'es'});
 expect(resolvePersonalPreferences({},{preferences:{language:'es'}})).toEqual({language:'es'});
});
