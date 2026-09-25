'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const route=require('./pos-bridge/v1/mappings.js');
test('mapping cursors bind tenant scope and never imply completeness without evidence',()=>{const fake={id:'m1',get:key=>key==='updatedAt'?'2026-09-18T00:00:00.000Z':undefined};const cursor=route._test.encodeCursor(fake,'scope-a');assert.deepEqual(route._test.decodeCursor(cursor,'scope-a'),{scopeId:'scope-a',updatedAt:'2026-09-18T00:00:00.000Z',id:'m1'});assert.throws(()=>route._test.decodeCursor(cursor,'scope-b'),error=>error.statusCode===400);});
