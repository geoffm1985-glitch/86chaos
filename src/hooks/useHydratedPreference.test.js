import {renderHook,act} from '@testing-library/react';
import {useHydratedPreference} from './useHydratedPreference';
const normalize=value=>value==='es'?'es':'en';
test('a saved Spanish preference hydrates a form opened before the profile arrives',()=>{
 const {result,rerender}=renderHook(({remote})=>useHydratedPreference(remote,normalize),{initialProps:{remote:undefined}});
 expect(result.current[0]).toBe('en');rerender({remote:'es'});expect(result.current[0]).toBe('es');
});
test('late profile language cannot overwrite an unsaved edit or failed save',()=>{
 const {result,rerender}=renderHook(({remote})=>useHydratedPreference(remote,normalize),{initialProps:{remote:undefined}});
 act(()=>result.current[1]('es'));rerender({remote:'en'});expect(result.current[0]).toBe('es');
});
test('after successful persistence later remote changes can hydrate the form',()=>{
 const {result,rerender}=renderHook(({remote})=>useHydratedPreference(remote,normalize),{initialProps:{remote:'en'}});
 act(()=>result.current[1]('es'));rerender({remote:'es'});act(()=>result.current[2]());rerender({remote:'en'});expect(result.current[0]).toBe('en');
});
