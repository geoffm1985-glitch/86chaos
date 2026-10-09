import React from 'react';
import {render,screen,fireEvent,waitFor,renderHook,act} from '@testing-library/react';
import {AttendancePolicyReview,HistorySourceReview,TrainingFollowUpPanel} from './IntelligenceReviewPanels';
import ItemSalesHistoryReview from './ItemSalesHistoryReview';
import VendorCatalogReview from './VendorCatalogReview';
import {useOperationalHistory} from '../hooks/useOperationalHistory';
import {secureFetch} from '../core/appCore';
import {invoiceReviewRequest} from './InvoiceReviewTools';
jest.mock('../core/appCore',()=>({T:{card:'card',input:'input',btn:'button',btnAlt:'button'},hasAnyPermission:(user,keys)=>user?.isOwner || keys.some(key=>user?.permissions?.[key]),secureFetch:jest.fn()}));
jest.mock('./InvoiceReviewTools',()=>({invoiceReviewRequest:jest.fn()}));
const owner={id:'owner',restaurantId:'r1',isOwner:true};
const result=body=>({ok:true,json:async()=>({ok:true,...body})});
beforeEach(()=>jest.clearAllMocks());

test('history pagination requires explicit clicks and preserves incomplete/undated status',()=>{
  const load=jest.fn();render(<HistorySourceReview history={{sources:{prep:{data:[{}],scanned:100,undated:2,complete:false,nextCursor:'next'}},load}} sources={[{key:'prep',label:'Prep history'}]}/>);
  expect(load).not.toHaveBeenCalled();expect(screen.getByText(/2 records have no usable timestamp/)).toBeTruthy();expect(screen.getByText(/Coverage incomplete/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Load more prep history'}));expect(load).toHaveBeenCalledWith('prep',false);
});
test('history scan limit disables further scans without implying a complete window',()=>{
  render(<HistorySourceReview history={{sources:{prep:{data:[],scanned:2000,truncated:true,complete:false}},load:jest.fn()}} sources={[{key:'prep',label:'Prep history'}]}/>);
  expect(screen.getByRole('button').disabled).toBe(true);expect(screen.getByText(/cannot be called complete/)).toBeTruthy();
});

test('exhausted history with undated records can be explicitly refreshed after source repair',()=>{
  const load=jest.fn();render(<HistorySourceReview history={{sources:{prep:{resolved:true,data:[],scanned:1,undated:1,complete:false,nextCursor:''}},load}} sources={[{key:'prep',label:'Prep history'}]}/>);
  fireEvent.click(screen.getByRole('button',{name:'Refresh prep history'}));expect(load).toHaveBeenCalledWith('prep',true);expect(screen.getByText(/Coverage incomplete/)).toBeTruthy();
});

test('history accessibility names follow retry/refresh state despite the automatic label guard',()=>{
  const load=jest.fn(),sources=[{key:'prep',label:'Prep history'}];
  const {rerender}=render(<HistorySourceReview history={{sources:{},load}} sources={sources}/>);
  const button=screen.getByRole('button',{name:'Load prep history'});
  // The production guard supplies a label only when the component omits one.
  if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label','Open Load prep history');
  rerender(<HistorySourceReview history={{sources:{prep:{resolved:true,error:'Offline',complete:false}},load}} sources={sources}/>);
  fireEvent.click(screen.getByRole('button',{name:'Retry prep history'}));expect(load).toHaveBeenCalledWith('prep',false);
  rerender(<HistorySourceReview history={{sources:{prep:{resolved:true,data:[],complete:true}},load}} sources={sources}/>);
  expect(screen.getByRole('button',{name:'Refresh prep history'})).toBeTruthy();
});
test('paged hook retains prior rows through failure and retries the same cursor',async()=>{
  secureFetch.mockResolvedValueOnce(result({source:'prep',data:[{id:'one'}],nextCursor:'one',scanned:100,undated:0,hasMore:true})).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(result({source:'prep',data:[{id:'two'}],nextCursor:'',scanned:102,undated:0,hasMore:false}));
  const {result:hook}=renderHook(()=>useOperationalHistory(owner,true));expect(secureFetch).not.toHaveBeenCalled();
  await act(async()=>hook.current.load('prep'));expect(hook.current.sources.prep.complete).toBe(false);
  await act(async()=>hook.current.load('prep'));expect(hook.current.sources.prep.data).toEqual([{id:'one'}]);expect(hook.current.sources.prep.error).toBe('Offline');
  await act(async()=>hook.current.load('prep'));expect(hook.current.sources.prep.data.map(row=>row.id)).toEqual(['one','two']);expect(hook.current.sources.prep.complete).toBe(true);
  expect(JSON.parse(secureFetch.mock.calls[2][1].body).after).toBe('one');
});
test('old-workspace history responses are discarded after a workspace switch',async()=>{
  let resolve;secureFetch.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  const {result:hook,rerender}=renderHook(({user})=>useOperationalHistory(user,true),{initialProps:{user:owner}});
  let pending;act(()=>{pending=hook.current.load('prep');});rerender({user:{...owner,restaurantId:'r2'}});
  await act(async()=>{resolve(result({data:[{id:'private'}],hasMore:false,undated:0}));await pending;});expect(hook.current.sources).toEqual({});
});
test('attendance policy saves only on explicit approval and keeps revision evidence',async()=>{
  const onSaved=jest.fn();secureFetch.mockResolvedValue(result({policy:{enabled:true,approvedAt:'new'}}));
  render(<AttendancePolicyReview appUser={owner} policy={{enabled:false,approvedAt:'prior',graceMinutes:5,maxOpenBreakMinutes:30,timeZone:'UTC'}} onSaved={onSaved}/>);
  expect(secureFetch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('checkbox'));fireEvent.change(screen.getByLabelText('Start/end grace minutes'),{target:{value:'10'}});fireEvent.click(screen.getByRole('button',{name:'Approve attendance review policy'}));
  await waitFor(()=>expect(onSaved).toHaveBeenCalled());const body=JSON.parse(secureFetch.mock.calls[0][1].body);expect(body.expectedApprovedAt).toBe('prior');expect(body.approved).toBe(true);expect(body.policy.graceMinutes).toBe('10');expect(body.policy.enabled).toBe(true);
});
test('bulk recipe import requires a reviewed current serving conversion before approval',async()=>{
  const recipe={id:'sauce',restaurantId:'r1',title:'Sauce',batchYieldQuantity:10,batchYieldUnit:'lb',batchYieldPercent:80,costingApprovedAt:'yield-v1'};
  secureFetch.mockResolvedValue(result({imported:1,duplicates:0}));render(<ItemSalesHistoryReview appUser={owner} recipes={[recipe]} onImported={jest.fn()} addToast={jest.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Review item sales history'}));fireEvent.change(screen.getByLabelText('Item sales CSV'),{target:{value:'date,item,quantity,sourceId,lineId\n2026-10-02,Sauce,16,source,one'}});fireEvent.click(screen.getByRole('button',{name:'Preview and match rows'}));
  const approve=screen.getByRole('button',{name:'Approve 1 reviewed sales rows'});expect(approve.disabled).toBe(true);fireEvent.change(screen.getByLabelText('Servings per batch for sales row 1'),{target:{value:'16'}});expect(approve.disabled).toBe(true);fireEvent.click(screen.getByRole('checkbox'));expect(approve.disabled).toBe(false);expect(secureFetch).not.toHaveBeenCalled();fireEvent.click(approve);
  await waitFor(()=>expect(secureFetch).toHaveBeenCalledTimes(1));const conversion=JSON.parse(secureFetch.mock.calls[0][1].body).rows[0].servingConversion;expect(conversion.reviewed).toBe(true);expect(conversion.costingApprovedAt).toBe('yield-v1');expect(conversion.yieldPercent).toBe(80);
});
test('catalog CSV preview never writes until the reviewed rows are approved',async()=>{
  invoiceReviewRequest.mockImplementation(async(user,body)=>body.action==='vendor-catalog-list'?{products:[],nextCursor:null}:{imported:1});
  render(<VendorCatalogReview appUser={owner} vendors={[{id:'vendor',name:'Vendor'}]}/>);fireEvent.change(screen.getByLabelText('Catalog vendor'),{target:{value:'vendor'}});await waitFor(()=>expect(invoiceReviewRequest).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Vendor catalog CSV'),{target:{value:'sku,name,packSize,purchaseUnit,unitPrice,sourceUrl\nSKU-1,Flour,1/10 LB,CS,20,https://vendor.example/flour'}});fireEvent.click(screen.getByRole('button',{name:'Preview catalog evidence'}));expect(invoiceReviewRequest.mock.calls.every(([,body])=>body.action==='vendor-catalog-list')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Approve 1 catalog rows'}));await waitFor(()=>expect(invoiceReviewRequest.mock.calls.some(([,body])=>body.action==='vendor-catalog-import')).toBe(true));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Approve 1 catalog rows'})).toBeNull());
  await waitFor(()=>expect(screen.queryByText('Loading catalog evidence…')).toBeNull());
  const body=invoiceReviewRequest.mock.calls.find(([,body])=>body.action==='vendor-catalog-import')[1];expect(body.approved).toBe(true);expect(body.rows[0].packSize).toBe('1/10 LB');expect(body.restaurantId).toBeUndefined();
});
test('catalog is hidden from unauthorized roles and discarded across workspace changes',async()=>{
  invoiceReviewRequest.mockResolvedValue({products:[{id:'one',code:'PRIVATE',name:'Old workspace product',packSize:'1/10 LB',active:true}],nextCursor:null});
  const {rerender}=render(<VendorCatalogReview appUser={owner} vendors={[{id:'vendor',name:'Vendor'}]}/>);fireEvent.change(screen.getByLabelText('Catalog vendor'),{target:{value:'vendor'}});await screen.findByText(/Old workspace product/);
  rerender(<VendorCatalogReview appUser={{...owner,restaurantId:'r2'}} vendors={[]}/>);expect(screen.queryByText(/Old workspace product/)).toBeNull();
  rerender(<VendorCatalogReview appUser={{restaurantId:'r2',permissions:{hr:true}}} vendors={[]}/>);expect(screen.queryByTestId('vendor-catalog-review')).toBeNull();
});
test('training completion UI explicitly preserves incomplete-history limits',()=>{
  render(<TrainingFollowUpPanel rows={[{id:'group',employeeName:'Alex',completed:2,total:2,completedAt:'2026-10-05',observedDays:4,evidenceIds:['one'],repeatedEvidenceIds:[],reason:'Historical evidence is incomplete; no effectiveness claim is available.'}]}/>);
  expect(screen.getByText(/2\/2 checklist items complete/)).toBeTruthy();expect(screen.getByText(/no effectiveness claim/)).toBeTruthy();
});
