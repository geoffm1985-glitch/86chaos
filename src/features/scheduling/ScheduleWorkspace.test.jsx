import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ScheduleWorkspace } from './ScheduleWorkspace';
import { secureFetch, useLiveCollectionState } from '../../core/appCore';
import { loadScheduleWeekVerified } from './scheduleWorkspaceData';
import { authoredScheduleControlName } from '../../core/authoredControlName';
jest.mock('../../core/appCore',()=>({secureFetch:jest.fn(),useLiveCollectionState:jest.fn()}));
jest.mock('./scheduleWorkspaceData',()=>({loadScheduleWeekVerified:jest.fn()}));
jest.mock('../../components/common',()=>({Modal:({isOpen,title,children,onClose})=>isOpen?<div role="dialog" aria-label={title}><h2>{title}</h2><button onClick={onClose}>Close dialog</button>{children}</div>:null}));
const empty=[];
const users=[{id:'employee_a',name:'Alex',authUid:'employee_a',role:'Cook'},{id:'employee_b',name:'Blair',authUid:'employee_b',role:'Cook'}];
const roles=[{id:'cook_role',name:'Cook'}];
const original={id:'shift_original',restaurantId:'tenant',workspaceId:'tenant',date:'2026-10-20',scheduleDateKey:'2026-10-20',employeeId:'employee_a',authUid:'employee_a',rosterRoleId:'cook_role',role:'Cook',startTime:'16:00',endTime:'21:00',notes:'Dinner',breakMinutes:0,revision:1,updatedAt:'2026-10-14T12:00:00Z',isPublished:false};
const appUser={id:'manager_a',restaurantId:'tenant',permissions:{schedule:true},systemSettings:{timezone:'America/Chicago'}};
function setup(extra={}){return render(<ScheduleWorkspace currentDate="2026-10-20" users={users} roles={roles} shifts={[original]} appUser={appUser} {...extra}/>);}
function desktop(){return within(document.querySelector('.sw-desktop-scroll'));}
function response(results=[],operationId='server_operation_123'){return{ok:true,json:async()=>({ok:true,authoritative:true,operationId,results,events:[]})};}
test('automatic control metadata preserves authored names and edited break details',async()=>{
  setup();fireEvent.click(desktop().getByRole('button',{name:/Edit shift .*Alex/}));
  document.querySelectorAll('button, input, select, textarea').forEach(control=>{
    const name=authoredScheduleControlName(control);
    if(name && !control.hasAttribute('aria-label'))control.setAttribute('aria-label',name);
  });
  expect(screen.getByRole('button',{name:'Monthly & advanced tools',exact:true})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Undo',exact:true})).toBeInTheDocument();
  expect(screen.getByLabelText('Assigned employee',{exact:true})).toBe(screen.getByTestId('shift-editor-employee'));
  const minutes=screen.getByRole('spinbutton',{name:'Break minutes',exact:true});
  fireEvent.change(minutes,{target:{value:'30'}});fireEvent.click(screen.getByLabelText('Paid break',{exact:true}));
  fireEvent.click(screen.getByTestId('shift-editor-save'));
  await waitFor(()=>expect(secureFetch).toHaveBeenCalledTimes(1));
  expect(JSON.parse(secureFetch.mock.calls[0][1].body).changes[0].patch).toMatchObject({breakMinutes:30,paidBreak:true});
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
beforeEach(()=>{sessionStorage.clear();jest.clearAllMocks();useLiveCollectionState.mockImplementation(name=>({data:name==='shifts'?[original]:empty,resolved:true,stale:false,error:null}));secureFetch.mockImplementation(async(url,options)=>{const body=JSON.parse(options.body);const change=body.changes?.[0];const after=change?.kind==='delete'?null:{...original,...change?.patch,revision:2,updatedAt:'2026-10-14T13:00:00Z'};return response([{id:original.id,before:original,after}]);});});
test('an existing shift opens an editor, preserves the scroll container, and saves reviewed values',async()=>{
  setup();const scroll=screen.getByTestId('weekly-schedule-scroll');scroll.scrollLeft=220;scroll.scrollTop=90;
  fireEvent.click(desktop().getByRole('button',{name:/Edit shift .*Alex/}));
  expect(screen.getByRole('dialog',{name:'Edit shift'})).toBeInTheDocument();expect(secureFetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByTestId('shift-editor-notes'),{target:{value:'New dinner notes'}});fireEvent.click(screen.getByTestId('shift-editor-save'));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Edit shift'})).not.toBeInTheDocument());
  const body=JSON.parse(secureFetch.mock.calls[0][1].body);expect(body.changes[0].kind).toBe('update');expect(body.changes[0].patch.notes).toBe('New dinner notes');expect(body.changes[0].expected).toContain('revision');
  expect(screen.getByTestId('weekly-schedule-scroll')).toBe(scroll);expect(scroll.scrollLeft).toBe(220);expect(scroll.scrollTop).toBe(90);expect(screen.getByRole('status')).toHaveTextContent('Saved and verified');
});
test('cancel retains a recoverable draft and no-op Save does not make a network request',async()=>{
  setup();fireEvent.click(desktop().getByRole('button',{name:/Edit shift .*Alex/}));fireEvent.click(screen.getByTestId('shift-editor-save'));
  expect(secureFetch).not.toHaveBeenCalled();
  fireEvent.click(desktop().getByRole('button',{name:/Edit shift .*Alex/}));fireEvent.change(screen.getByTestId('shift-editor-notes'),{target:{value:'Unsaved notes'}});fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
  fireEvent.click(screen.getByRole('button',{name:'Recover unsaved shift draft'}));expect(screen.getByTestId('shift-editor-notes')).toHaveValue('Unsaved notes');expect(secureFetch).not.toHaveBeenCalled();
});
test('delete is secondary and confirmed; cancellation and draft recovery retain history controls',async()=>{
  setup();fireEvent.click(desktop().getByRole('button',{name:/Edit shift .*Alex/}));fireEvent.click(screen.getByRole('button',{name:'Delete shift'}));
  expect(secureFetch).not.toHaveBeenCalled();expect(screen.queryByRole('dialog',{name:'Edit shift'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));await waitFor(()=>expect(secureFetch).toHaveBeenCalledTimes(1));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Undo'})).toBeEnabled());expect(desktop().queryByRole('button',{name:/Edit shift .*Alex/})).not.toBeInTheDocument();await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
test('dragging previews reassignment and requires confirmation before saving',async()=>{
  setup();const card=document.querySelector('.sw-desktop-scroll [data-shift-id="shift_original"]');
  const transfer={setData:jest.fn(),effectAllowed:'',dropEffect:''};fireEvent.dragStart(card,{dataTransfer:transfer});
  const target=document.querySelector('.sw-desktop-scroll [data-date="2026-10-21"][data-employee-id="employee_b"]');fireEvent.dragOver(target,{dataTransfer:transfer});fireEvent.drop(target,{dataTransfer:transfer});
  expect(screen.getByRole('dialog',{name:'Preview moved shifts'})).toBeInTheDocument();expect(secureFetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));await waitFor(()=>expect(secureFetch).toHaveBeenCalledTimes(1));
  const body=JSON.parse(secureFetch.mock.calls[0][1].body);expect(body.changes[0].patch.date).toBe('2026-10-21');expect(body.changes[0].patch.employeeId).toBe('employee_b');expect(body.changes[0].patch.authUid).toBeUndefined();await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
test('mobile day navigation preserves filtering and uses the same complete editor',()=>{
  setup();fireEvent.click(screen.getByText('Filter schedule'));fireEvent.change(screen.getByLabelText('Employee'),{target:{value:'employee_a'}});
  const mobile=within(screen.getByTestId('mobile-schedule-calendar'));fireEvent.click(mobile.getByRole('button',{name:'Next day'}));expect(mobile.getByText(/Wed, Oct 21/)).toBeInTheDocument();expect(screen.getByLabelText('Employee')).toHaveValue('employee_a');
  fireEvent.click(mobile.getByRole('button',{name:/Add shift for Alex/}));expect(screen.getByTestId('shift-editor-date')).toHaveValue('2026-10-21');expect(screen.getByTestId('shift-editor-employee')).toHaveValue('employee_a');expect(screen.getByLabelText('Break minutes')).toBeInTheDocument();
});
test('an uncertain request remains pending and requires an explicit retry of its original identity',async()=>{
  secureFetch.mockRejectedValueOnce(new Error('Network disconnected'));setup();fireEvent.click(desktop().getByRole('button',{name:/Edit shift .*Alex/}));fireEvent.change(screen.getByTestId('shift-editor-notes'),{target:{value:'Interrupted edit'}});fireEvent.click(screen.getByTestId('shift-editor-save'));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Save outcome unknown'));
  const first=JSON.parse(secureFetch.mock.calls[0][1].body);fireEvent.click(screen.getByRole('button',{name:'Review outcome and retry the same saved request'}));await waitFor(()=>expect(secureFetch).toHaveBeenCalledTimes(2));expect(JSON.parse(secureFetch.mock.calls[1][1].body)).toEqual(first);await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Saved and verified'));
});
test('published edits require an explicit reason and confirmation before an authoritative mutation',async()=>{
  useLiveCollectionState.mockImplementation(name=>({data:name==='shifts'?[{...original,isPublished:true,published:true}]:empty,resolved:true,stale:false,error:null}));
  setup({shifts:[{...original,isPublished:true,published:true}]});fireEvent.click(desktop().getByRole('button',{name:/Edit shift .*Alex/}));fireEvent.change(screen.getByTestId('shift-editor-end'),{target:{value:'22:00'}});fireEvent.click(screen.getByTestId('shift-editor-save'));
  expect(secureFetch).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Confirm changes'})).toBeDisabled();fireEvent.change(screen.getByLabelText('Reason for published change'),{target:{value:'Manager approved later closing'}});fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));await waitFor(()=>expect(secureFetch).toHaveBeenCalledTimes(1));expect(JSON.parse(secureFetch.mock.calls[0][1].body).confirmedPublished).toBe(true);await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('verified empty snapshots remove stale shifts instead of presenting them as current',()=>{
  useLiveCollectionState.mockImplementation(()=>({data:empty,resolved:true,stale:false,error:null}));
  setup();expect(desktop().queryByRole('button',{name:/Edit shift .*Alex/})).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Schedule loaded from the server');
});

test('cached snapshots retain a visibly unverified preview and cannot erase a newer server row',()=>{
  useLiveCollectionState.mockImplementation(name=>({data:name==='shifts'?[original]:empty,resolved:true,stale:name==='shifts',error:null}));
  setup({shifts:[{...original,revision:3,notes:'Newer parent snapshot',endTime:'22:00'}]});
  expect(desktop().queryByRole('button',{name:/Edit shift .*21:00/})).not.toBeInTheDocument();
  expect(desktop().getByRole('button',{name:/Edit shift .*22:00/})).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('cached or loading');
});

test('keyboard focus stays within the editor and Move and Reassign focus their fields',()=>{
  setup();fireEvent.click(desktop().getByRole('button',{name:/Edit shift .*Alex/}));
  const close=screen.getByRole('button',{name:'Close dialog'}),last=screen.getByRole('button',{name:'Delete shift'});
  last.focus();fireEvent.keyDown(last,{key:'Tab'});expect(close).toHaveFocus();
  fireEvent.keyDown(close,{key:'Tab',shiftKey:true});expect(last).toHaveFocus();
  fireEvent.click(screen.getByRole('button',{name:'Move',exact:true}));expect(screen.getByTestId('shift-editor-date')).toHaveFocus();
  fireEvent.click(screen.getByRole('button',{name:'Reassign',exact:true}));expect(screen.getByTestId('shift-editor-employee')).toHaveFocus();
});

test('a retried historical receipt cannot resurrect a shift deleted by a newer operation',async()=>{
  secureFetch.mockRejectedValueOnce(new Error('Network disconnected')).mockResolvedValueOnce({ok:true,json:async()=>({ok:true,duplicate:true,operationId:'server_operation_123',results:[{id:original.id,before:original,after:{...original,revision:2}}],currentResults:[{id:original.id,before:original,after:null}],events:[]})});
  setup();fireEvent.click(desktop().getByRole('button',{name:/Edit shift .*Alex/}));fireEvent.change(screen.getByTestId('shift-editor-notes'),{target:{value:'Interrupted notes'}});fireEvent.click(screen.getByTestId('shift-editor-save'));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Save outcome unknown'));
  fireEvent.click(screen.getByRole('button',{name:'Review outcome and retry the same saved request'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(desktop().queryByRole('button',{name:/Edit shift .*Alex/})).not.toBeInTheDocument();
});

test('a confirmed deletion overlay cannot hide a newer legitimate restoration',async()=>{
  let current=original;
  useLiveCollectionState.mockImplementation(name=>({data:name==='shifts'?[current]:empty,resolved:true,stale:false,error:null}));
  const view=setup();fireEvent.click(desktop().getByRole('button',{name:/Edit shift .*Alex/}));fireEvent.click(screen.getByRole('button',{name:'Delete shift'}));fireEvent.click(screen.getByTestId('schedule-confirm-preview'));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(desktop().queryByRole('button',{name:/Edit shift .*Alex/})).not.toBeInTheDocument();
  current={...original,revision:3,updatedAt:'2026-10-14T14:00:00Z',notes:'Restored by another authorized manager'};
  view.rerender(<ScheduleWorkspace currentDate="2026-10-20" users={users} roles={roles} shifts={[current]} appUser={appUser}/>);
  await waitFor(()=>expect(desktop().getByRole('button',{name:/Edit shift .*Alex/})).toBeInTheDocument());
});
