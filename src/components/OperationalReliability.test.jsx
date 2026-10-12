import React from 'react';
import {render,screen,fireEvent,waitFor,renderHook,act} from '@testing-library/react';
import ItemSalesHistoryReview,{parseItemSalesCsv} from './ItemSalesHistoryReview';
import {AttendancePolicyReview} from './IntelligenceReviewPanels';
import {useOperationalHistory} from '../hooks/useOperationalHistory';
import {secureFetch} from '../core/appCore';
jest.mock('../core/appCore',()=>({hasAnyPermission:(user,keys)=>user?.isOwner || keys.some(key=>user?.permissions?.[key]),secureFetch:jest.fn()}));
const user={id:'owner',restaurantId:'one',isOwner:true};
const salesProps=()=>({appUser:user,recipes:[{id:'recipe',restaurantId:'one',title:'Soup'}],onImported:jest.fn(),addToast:jest.fn()});
const response=body=>({ok:true,json:async()=>({ok:true,...body})});
function preview(){fireEvent.click(screen.getByRole('button',{name:'Review item sales history'}));fireEvent.change(screen.getByLabelText('Item sales CSV'),{target:{value:'date,item,quantity,sourceId,lineId\n2026-10-10,Soup,2,receipt,line'}});fireEvent.click(screen.getByRole('button',{name:'Preview and match rows'}));}
beforeEach(()=>jest.resetAllMocks());
test('duplicate sales CSV headers cannot overwrite reviewed quantities',()=>expect(()=>parseItemSalesCsv('date,item,quantity,sourceId,lineId,quantity\n2026-10-10,Soup,2,r,l,999')).toThrow(/duplicate/));
test('switching workspace clears private sales CSV and mappings',()=>{const props=salesProps(),{rerender}=render(<ItemSalesHistoryReview {...props}/>);preview();rerender(<ItemSalesHistoryReview {...props} appUser={{...user,restaurantId:'two'}}/>);fireEvent.click(screen.getByRole('button',{name:'Review item sales history'}));expect(screen.getByLabelText('Item sales CSV').value).toBe('');expect(screen.queryByLabelText('Recipe for sales row 1')).toBeNull();});
test('switching authenticated identity clears sales review state',()=>{const props=salesProps(),{rerender}=render(<ItemSalesHistoryReview {...props}/>);preview();rerender(<ItemSalesHistoryReview {...props} appUser={{...user,id:'different'}}/>);expect(screen.getByRole('button',{name:'Review item sales history'}).getAttribute('aria-expanded')).toBe('false');});
test('late sales save after workspace switch cannot toast or refresh the new workspace',async()=>{let resolve;secureFetch.mockImplementation(()=>new Promise(done=>{resolve=done;}));const props=salesProps(),{rerender}=render(<ItemSalesHistoryReview {...props}/>);preview();fireEvent.click(screen.getByRole('button',{name:'Approve 1 reviewed sales rows'}));const signal=secureFetch.mock.calls[0][1].signal;rerender(<ItemSalesHistoryReview {...props} appUser={{...user,restaurantId:'two'}}/>);expect(signal.aborted).toBe(true);await act(async()=>resolve(response({imported:1,duplicates:0})));expect(props.onImported).not.toHaveBeenCalled();expect(props.addToast).not.toHaveBeenCalled();});
test('attendance thresholds reset when workspace changes',()=>{const props={appUser:user,policy:{graceMinutes:7,timeZone:'UTC'},onSaved:jest.fn()}, {rerender}=render(<AttendancePolicyReview {...props}/>);fireEvent.change(screen.getByLabelText('Start/end grace minutes'),{target:{value:'99'}});rerender(<AttendancePolicyReview {...props} appUser={{...user,restaurantId:'two'}} policy={{graceMinutes:3,timeZone:'America/Chicago'}}/>);expect(screen.getByLabelText('Start/end grace minutes').value).toBe('3');});
test('late attendance approval does not update another workspace',async()=>{let resolve;secureFetch.mockImplementation(()=>new Promise(done=>{resolve=done;}));const onSaved=jest.fn(),{rerender}=render(<AttendancePolicyReview appUser={user} onSaved={onSaved}/>);fireEvent.click(screen.getByRole('button',{name:'Approve attendance review policy'}));rerender(<AttendancePolicyReview appUser={{...user,restaurantId:'two'}} onSaved={onSaved}/>);await act(async()=>resolve(response({policy:{enabled:true}})));expect(onSaved).not.toHaveBeenCalled();expect(secureFetch.mock.calls[0][1].signal.aborted).toBe(true);});
test('attendance double approval produces one request',async()=>{let resolve;secureFetch.mockImplementation(()=>new Promise(done=>{resolve=done;}));render(<AttendancePolicyReview appUser={user} onSaved={jest.fn()}/>);const button=screen.getByRole('button',{name:'Approve attendance review policy'});fireEvent.click(button);fireEvent.click(button);expect(secureFetch).toHaveBeenCalledTimes(1);await act(async()=>resolve(response({policy:{approvedAt:'new'}})));});
test('attendance failed save preserves draft and revision for retry',async()=>{secureFetch.mockResolvedValueOnce({ok:false,json:async()=>({ok:false,error:'Revision conflict'})}).mockResolvedValueOnce(response({policy:{approvedAt:'new'}}));const onSaved=jest.fn();render(<AttendancePolicyReview appUser={user} policy={{approvedAt:'old'}} onSaved={onSaved}/>);fireEvent.change(screen.getByLabelText('Start/end grace minutes'),{target:{value:'9'}});fireEvent.click(screen.getByRole('button',{name:'Approve attendance review policy'}));await screen.findByText('Revision conflict');expect(onSaved).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Approve attendance review policy'}));await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1));expect(JSON.parse(secureFetch.mock.calls[1][1].body)).toMatchObject({expectedApprovedAt:'old',policy:{graceMinutes:'9'}});});
test('truncated history cannot become complete or continue loading',async()=>{secureFetch.mockResolvedValue(response({data:[],undated:0,hasMore:false,truncated:true}));const {result}=renderHook(()=>useOperationalHistory(user,true));await act(async()=>result.current.load('prep'));expect(result.current.sources.prep.complete).toBe(false);await act(async()=>result.current.load('prep'));expect(secureFetch).toHaveBeenCalledTimes(1);});
test('history pagination deduplicates source IDs and retains newest evidence',async()=>{secureFetch.mockResolvedValueOnce(response({data:[{id:'one',status:'old'}],hasMore:true,nextCursor:'one',undated:0})).mockResolvedValueOnce(response({data:[{id:'one',status:'new'},{id:'two'}],hasMore:false,undated:0}));const {result}=renderHook(()=>useOperationalHistory(user,true));await act(async()=>result.current.load('prep'));await act(async()=>result.current.load('prep'));expect(result.current.sources.prep.data).toEqual([{id:'one',status:'new'},{id:'two'}]);});
test('disabling history aborts outstanding work and discards late results',async()=>{let resolve;secureFetch.mockImplementation(()=>new Promise(done=>{resolve=done;}));const {result,rerender}=renderHook(({enabled})=>useOperationalHistory(user,enabled),{initialProps:{enabled:true}});let pending;act(()=>{pending=result.current.load('prep');});rerender({enabled:false});await act(async()=>{resolve(response({data:[{id:'private'}],undated:0,hasMore:false}));await pending;});expect(result.current.sources).toEqual({});expect(secureFetch.mock.calls[0][1].signal.aborted).toBe(true);});
test('permission changes abort and clear prior operational history',async()=>{secureFetch.mockResolvedValue(response({data:[{id:'private'}],undated:0,hasMore:false}));const {result,rerender}=renderHook(({actor})=>useOperationalHistory(actor,true),{initialProps:{actor:user}});await act(async()=>result.current.load('prep'));rerender({actor:{...user,isOwner:false,permissions:{hr:true}}});expect(result.current.sources).toEqual({});});

test('denied platform flags and reordered grants do not abort an attendance save',async()=>{
 let resolve;secureFetch.mockImplementation(()=>new Promise(done=>{resolve=done;}));const onSaved=jest.fn();
 const actor={...user,permissions:{settings:true,labor:true}}, {rerender}=render(<AttendancePolicyReview appUser={actor} onSaved={onSaved}/>);
 fireEvent.change(screen.getByLabelText('Start/end grace minutes'),{target:{value:'11'}});
 fireEvent.click(screen.getByRole('button',{name:'Approve attendance review policy'}));
 rerender(<AttendancePolicyReview appUser={{...actor,owner:true,accountOwner:true,workspaceOwner:true,isAdmin:true,permissions:{godmode:false,labor:true,settings:true,systemAdmin:false}}} policy={{approvedAt:'hydrated',graceMinutes:5}} onSaved={onSaved}/>);
 expect(secureFetch.mock.calls[0][1].signal.aborted).toBe(false);
 expect(screen.getByLabelText('Start/end grace minutes').value).toBe('11');
 await act(async()=>resolve(response({policy:{approvedAt:'saved',graceMinutes:11}})));expect(onSaved).toHaveBeenCalledTimes(1);
});
test('policy hydration cannot overwrite invalid edits or their rejection',async()=>{
 secureFetch.mockResolvedValue({ok:false,json:async()=>({ok:false,error:'Invalid review minutes'})});
 const {rerender}=render(<AttendancePolicyReview appUser={user} onSaved={jest.fn()}/>);
 fireEvent.change(screen.getByLabelText('Open-break review minutes'),{target:{value:'0'}});
 rerender(<AttendancePolicyReview appUser={user} policy={{approvedAt:'late',maxOpenBreakMinutes:31}} onSaved={jest.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Approve attendance review policy'}));await screen.findByRole('alert');
 expect(screen.getByLabelText('Open-break review minutes').value).toBe('0');
 expect(JSON.parse(secureFetch.mock.calls[0][1].body).policy.maxOpenBreakMinutes).toBe('0');
});
test('unchanged effective permissions preserve a pending history request',async()=>{
 let resolve;secureFetch.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 const actor={...user,permissions:{settings:true,labor:true}};
 const {result,rerender}=renderHook(({actor})=>useOperationalHistory(actor,true),{initialProps:{actor}});
 let pending;act(()=>{pending=result.current.load('prep');});
 rerender({actor:{...actor,owner:true,accountOwner:true,workspaceOwner:true,isAdmin:true,permissions:{labor:true,systemAdmin:false,settings:true,godmode:false}}});
 expect(result.current.loading).toBe(true);expect(secureFetch.mock.calls[0][1].signal.aborted).toBe(false);
 await act(async()=>{resolve(response({data:[],undated:0,hasMore:false}));await pending;});expect(result.current.sources.prep.complete).toBe(true);
});

test('attendance waits for the initial saved policy and its concurrency revision before editing',async()=>{
 secureFetch.mockResolvedValue(response({policy:{approvedAt:'saved'}}));
 const onSaved=jest.fn(),{rerender}=render(<AttendancePolicyReview appUser={user} policyReady={false} onSaved={onSaved}/>);
 expect(screen.queryByLabelText('Start/end grace minutes')).toBeNull();
 expect(screen.queryByRole('button',{name:'Approve attendance review policy'})).toBeNull();
 rerender(<AttendancePolicyReview appUser={user} policyReady policy={{approvedAt:'initial-revision',graceMinutes:11}} onSaved={onSaved}/>);
 fireEvent.change(screen.getByLabelText('Start/end grace minutes'),{target:{value:'12'}});
 fireEvent.click(screen.getByRole('button',{name:'Approve attendance review policy'}));await waitFor(()=>expect(onSaved).toHaveBeenCalled());
 expect(JSON.parse(secureFetch.mock.calls[0][1].body)).toMatchObject({expectedApprovedAt:'initial-revision',policy:{graceMinutes:'12'}});
});
