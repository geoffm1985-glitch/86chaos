import React from 'react';
import {render,act} from '@testing-library/react';
import PrepActionBar from './PrepActionBar';

test('prep dock clearance follows measured bar height, resizing and unmount',()=>{
  let height=84,resize;
  const box=jest.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({height}));
  const disconnect=jest.fn();global.ResizeObserver=class{constructor(callback){resize=callback;}observe(){}disconnect(){disconnect();}};
  const root=document.documentElement;
  const {unmount}=render(<PrepActionBar><button>Print labels</button></PrepActionBar>);
  expect(root.style.getPropertyValue('--chaos-prep-action-bar-height')).toBe('84px');
  height=136;act(()=>resize());expect(root.style.getPropertyValue('--chaos-prep-action-bar-height')).toBe('136px');
  unmount();expect(root.style.getPropertyValue('--chaos-prep-action-bar-height')).toBe('');expect(disconnect).toHaveBeenCalled();
  box.mockRestore();delete global.ResizeObserver;
});
