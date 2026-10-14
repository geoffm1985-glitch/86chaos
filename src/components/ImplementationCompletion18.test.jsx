import React from 'react';
import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {ShiftChangeReview} from './ShiftChangeReview';
import {FoodSafetyAuditReview} from './FoodSafetyAuditReview';
import {TrainingCompetencyReview} from './TrainingCompetencyReview';
import {secureFetch,downloadCsvRows} from '../core/appCore';
import {invoiceReviewRequest} from './InvoiceReviewTools';
jest.mock('../core/appCore',()=>({T:{card:'card',input:'input',btn:'button',btnAlt:'button'},secureFetch:jest.fn(),downloadCsvRows:jest.fn(),getToday:jest.fn(()=> '2026-10-13')}));
jest.mock('./InvoiceReviewTools',()=>({invoiceReviewRequest:jest.fn()}));
const employee={id:'employee',authUid:'employee',restaurantId:'r',permissions:{}};
const owner={id:'manager',restaurantId:'r',isOwner:true};
const event={id:'event',version:'version',after:{date:'2026-10-13',startTime:'09:00',endTime:'17:00',role:'Cook',employeeName:'Employee'},before:null,publishedAt:'2026-10-12',current:true,recipientUids:['employee'],changedFields:['startTime'],acknowledgments:{}};
const response=body=>({ok:true,json:async()=>({ok:true,...body})});
beforeEach(()=>{jest.clearAllMocks();Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> 'qa_operation_identity_12345'}});});
test('published shift review loads only on request and acknowledgment is explicit and version-bound',async()=>{
  secureFetch.mockResolvedValueOnce(response({rows:[event],complete:true})).mockResolvedValueOnce(response({acknowledgedAt:'2026-10-13T12:00:00Z'}));
  render(<ShiftChangeReview appUser={employee}/>);expect(secureFetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Load published changes'}));await screen.findByRole('button',{name:'I reviewed this published shift'});
  expect(secureFetch).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByRole('button',{name:'I reviewed this published shift'}));
  await screen.findByText(/Acknowledged 2026/);expect(JSON.parse(secureFetch.mock.calls[1][1].body)).toMatchObject({action:'shift-change-acknowledge',version:'version',confirmed:true,restaurantId:'r'});
});
test('superseded publications cannot be acknowledged and provider acceptance is not called delivery',async()=>{
  secureFetch.mockResolvedValue(response({rows:[{...event,current:false,notification:{state:'accepted'}}],complete:true}));
  render(<ShiftChangeReview appUser={owner} workspaceReview/>);fireEvent.click(screen.getByRole('button',{name:'Load published changes'}));
  await screen.findByText(/Provider acceptance does not prove delivery/);expect(screen.queryByRole('button',{name:'I reviewed this published shift'})).toBeNull();
});
test('published shift failure preserves the current review and shows its retry error',async()=>{
  secureFetch.mockResolvedValueOnce(response({rows:[event],complete:true})).mockRejectedValueOnce(new Error('Offline'));
  render(<ShiftChangeReview appUser={employee}/>);fireEvent.click(screen.getByRole('button',{name:'Load published changes'}));
  fireEvent.click(await screen.findByRole('button',{name:'I reviewed this published shift'}));await screen.findByRole('alert');
  expect(screen.getByRole('button',{name:'I reviewed this published shift'})).toBeTruthy();expect(screen.queryByText(/^Acknowledged/)).toBeNull();
});
test('late old-workspace shift evidence is discarded when the workspace changes',async()=>{
  let resolve;secureFetch.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  const {rerender}=render(<ShiftChangeReview appUser={employee}/>);fireEvent.click(screen.getByRole('button',{name:'Load published changes'}));
  rerender(<ShiftChangeReview appUser={{...employee,restaurantId:'other'}}/>);
  await act(async()=>resolve(response({rows:[event],complete:true})));
  expect(screen.queryByText(/Employee/)).toBeNull();expect(screen.getByRole('button',{name:'Load published changes'})).toBeTruthy();
});
test('audit export is disabled until every page is explicitly loaded',async()=>{
  invoiceReviewRequest.mockResolvedValueOnce({rows:[],complete:false,nextCursor:'next'}).mockResolvedValueOnce({rows:[{id:'safe',itemName:'Cooler',status:'Safe',date:'2026-10-13',integrity:'no-closure'}],complete:true,nextCursor:null});
  render(<FoodSafetyAuditReview appUser={owner}/>);expect(invoiceReviewRequest).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Load food safety audit'}));
  await screen.findByText(/More evidence remains/);expect(screen.getByRole('button',{name:'Export complete food safety audit CSV'}).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Load more audit records'}));await screen.findByText(/Window fully loaded/);
  fireEvent.click(screen.getByRole('button',{name:'Export complete food safety audit CSV'}));expect(downloadCsvRows).toHaveBeenCalledTimes(1);expect(invoiceReviewRequest.mock.calls[1][1].cursor).toBe('next');
});
test('food safety closure requires a selected later safe record, verification note and confirmation',async()=>{
  const original={id:'original',itemId:'cooler',itemName:'Cooler',status:'Attention',temp:49,timestamp:'2026-10-13T10:00:00Z'},later={...original,id:'later',status:'Safe',temp:39,timestamp:'2026-10-13T10:15:00Z'};
  invoiceReviewRequest.mockResolvedValueOnce({rows:[original,later],complete:true}).mockResolvedValueOnce({closure:{closedAt:'now',note:'Verified corrective action'}});
  render(<FoodSafetyAuditReview appUser={owner}/>);fireEvent.click(screen.getByRole('button',{name:'Load food safety audit'}));
  fireEvent.click(await screen.findByRole('button',{name:'Review closure for Cooler'}));expect(screen.getByRole('button',{name:'Save reviewed closure'}).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Later safe check'),{target:{value:'later'}});fireEvent.change(screen.getByLabelText('Manager closure note'),{target:{value:'Verified corrective action'}});fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button',{name:'Save reviewed closure'}));await screen.findByText(/Closed now/);
  expect(invoiceReviewRequest.mock.calls[1][1]).toMatchObject({action:'food-safety-close',logId:'original',followUpLogId:'later',expectedTimestamp:original.timestamp,confirmed:true});
});
test('competency is distinct from completed tasks and saves only after observed verification',async()=>{
  invoiceReviewRequest.mockResolvedValue({id:'review',review:{employeeName:'Employee',station:'Grill',roleName:'Cook',note:'Observed safe workflow',evidence:[{id:'task'}],reviewedAt:'now',reviewedBy:'manager'}});
  render(<TrainingCompetencyReview appUser={owner} manager users={[{id:'employee',name:'Employee'}]} roles={[{id:'cook',name:'Cook'}]} tasks={[{id:'task',userId:'employee',title:'Procedure',completed:true,completedAt:'then'}]}/>);
  fireEvent.click(screen.getByText('Record observed competency'));fireEvent.change(screen.getByLabelText('Competency employee'),{target:{value:'employee'}});fireEvent.change(screen.getByLabelText('Competency role'),{target:{value:'cook'}});fireEvent.change(screen.getByLabelText('Competency station'),{target:{value:'Grill'}});fireEvent.change(screen.getByLabelText('Competency verification note'),{target:{value:'Observed safe workflow'}});
  expect(screen.getByRole('button',{name:'Save competency review'}).disabled).toBe(true);
  const checks=screen.getAllByRole('checkbox');fireEvent.click(checks[0]);fireEvent.click(checks[1]);fireEvent.click(screen.getByRole('button',{name:'Save competency review'}));
  await waitFor(()=>expect(invoiceReviewRequest).toHaveBeenCalled());expect(invoiceReviewRequest.mock.calls[0][1]).toMatchObject({confirmed:true,evidence:[{id:'task',completedAt:'then'}],roleId:'cook',station:'Grill'});
});
test('employees can review their competency evidence but cannot open the manager verification form',()=>{
  render(<TrainingCompetencyReview appUser={employee} manager={false} users={[]} roles={[]} tasks={[]}/>);expect(screen.queryByText('Record observed competency')).toBeNull();expect(screen.getByRole('button',{name:'Load competency reviews'})).toBeTruthy();
});

test('food safety audit defaults to the app local day at the UTC date boundary',()=>{
  jest.useFakeTimers('modern');jest.setSystemTime(new Date('2026-10-14T00:30:00Z'));
  try {render(<FoodSafetyAuditReview appUser={owner}/>);expect(screen.getByLabelText('Audit start date').value).toBe('2026-10-13');expect(screen.getByLabelText('Audit end date').value).toBe('2026-10-13');}
  finally {jest.useRealTimers();}
});
