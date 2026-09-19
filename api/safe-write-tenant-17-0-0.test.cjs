'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const safeWrite=require('./safe-write.js');const {protectServerOwnedFields,verifyExistingTargetOwnership}=safeWrite._test;
function fakeDb(row){return{collection(){return{doc(){return{async get(){return row?{exists:true,data:()=>row}:{exists:false,data:()=>({})}}}}}}};}
test('generic writes deny foreign existing targets without existence detail',async()=>{await assert.rejects(()=>verifyExistingTargetOwnership(fakeDb({restaurantId:'tenant-b'}),'tasks','foreign','tenant-a'),error=>error.statusCode===403&&error.message==='The requested record is unavailable.');});
test('generic writes preserve server-owned tenant and creation fields',()=>{const result=protectServerOwnedFields({restaurantId:'tenant-b',createdBy:'attacker',name:'updated',revision:99},{restaurantId:'tenant-a',createdBy:'owner',createdAt:'before',revision:4});assert.deepEqual(result,{restaurantId:'tenant-a',createdBy:'owner',createdAt:'before',name:'updated',revision:4});});
