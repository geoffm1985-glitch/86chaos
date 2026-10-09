import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NativeNotificationConnection from './NativeNotificationConnection';
import { nativePush } from '../core/nativePush';
jest.mock('../core/nativePush',()=>({nativePush:{permission:jest.fn()}}));
beforeEach(()=>jest.clearAllMocks());
test('Android Settings can connect without the browser Notification API and only claims connected after saving',async()=>{
  nativePush.permission.mockResolvedValue('granted');const connect=jest.fn().mockResolvedValue(true);
  render(<NativeNotificationConnection onConnect={connect}/>);
  await screen.findByText('Allowed on this phone');fireEvent.click(screen.getByRole('button',{name:'Connect Device'}));
  await screen.findByText('Connected on this phone');expect(connect).toHaveBeenCalledTimes(1);
});
test('granted permission with a failed token save never reports connected',async()=>{
  nativePush.permission.mockResolvedValue('granted');const connect=jest.fn().mockResolvedValue(false);
  render(<NativeNotificationConnection onConnect={connect}/>);await screen.findByText('Allowed on this phone');
  fireEvent.click(screen.getByRole('button',{name:'Connect Device'}));await waitFor(()=>expect(connect).toHaveBeenCalled());
  await waitFor(()=>expect(screen.getByRole('button',{name:'Connect Device'}).disabled).toBe(false));expect(screen.queryByText('Connected on this phone')).toBeNull();
});
test('denied permission shows phone settings guidance',async()=>{
  nativePush.permission.mockResolvedValue('denied');render(<NativeNotificationConnection onConnect={jest.fn()}/>);
  await screen.findByText('Blocked: allow notifications in Android Settings');expect(screen.getByRole('button',{name:'Connect Device'})).toBeTruthy();
});
