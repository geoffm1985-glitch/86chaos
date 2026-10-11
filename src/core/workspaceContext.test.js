import { withSelectedWorkspaceContext } from './workspaceContext';
test('account-only refresh preserves the selected workspace and permission identity',()=>{
 const profile={id:'owner',authUid:'owner',isOwner:true,permissions:{schedule:true}};
 const next=withSelectedWorkspaceContext(profile,'selected');
 expect(next.restaurantId).toBe('selected');expect(next.id).toBe('owner');expect(next.permissions).toBe(profile.permissions);expect(profile.restaurantId).toBeUndefined();
});
test('workspace switch replaces stale profile context',()=>{expect(withSelectedWorkspaceContext({id:'staff',restaurantId:'old',isAdmin:false},'new')).toEqual({id:'staff',restaurantId:'new',isAdmin:false});});
test('clearing a workspace cannot retain stale tenant context or grant permissions',()=>{expect(withSelectedWorkspaceContext({restaurantId:'old',permissions:{}},'')).toEqual({restaurantId:'',permissions:{}});});
test('missing account stays missing',()=>{expect(withSelectedWorkspaceContext(null,'selected')).toBeNull();});
