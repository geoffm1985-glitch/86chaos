'use strict';
const Ajv = require('ajv');
const crypto = require('node:crypto');
const { LIMITS } = require('./_pos-bridge-config');

const ID = { type:'string', minLength:1, maxLength:LIMITS.maxIdentifierLength, pattern:'^[A-Za-z0-9][A-Za-z0-9._:@/-]*$' };
const MONEY = { type:'integer', minimum:-2147483648, maximum:2147483647 };
const DATE_TIME = { type:'string', minLength:20, maxLength:35, pattern:'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?Z$' };
const reference = type => ({ type:'object', additionalProperties:false, required:['externalId'], properties:{ externalId:ID, displayName:{type:'string',maxLength:160}, referenceType:{const:type} } });
const discount = { type:'object', additionalProperties:false, required:['discountId','amountCents'], properties:{ discountId:ID, name:{type:'string',maxLength:160}, amountCents:MONEY } };
const tax = { type:'object', additionalProperties:false, required:['taxId','amountCents'], properties:{ taxId:ID, name:{type:'string',maxLength:160}, amountCents:MONEY } };
const tender = { type:'object', additionalProperties:false, required:['tenderId','classification','amountCents','status'], properties:{ tenderId:ID, classification:{enum:['cash','credit','debit','gift_card','house_account','other']}, amountCents:MONEY, status:{enum:['authorized','captured','refunded','voided','declined']} } };
const item = { type:'object', additionalProperties:false, required:['lineId','quantityMilli','unitPriceCents','totalCents','menuReference'], properties:{ lineId:ID, quantityMilli:{type:'integer',minimum:1,maximum:1000000}, unitPriceCents:MONEY, totalCents:MONEY, name:{type:'string',maxLength:200}, menuReference:reference('menu'), discounts:{type:'array',maxItems:20,items:discount}, taxes:{type:'array',maxItems:20,items:tax} } };
const orderSnapshot = { type:'object', additionalProperties:false, required:['orderId','businessDate','status','subtotalCents','discountCents','taxCents','tipCents','totalCents','paymentStatus','items','discounts','taxes','tenders'], properties:{
  orderId:ID, displayNumber:{type:'string',maxLength:64}, businessDate:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}, status:{enum:['open','closed','voided','refunded']}, subtotalCents:MONEY, discountCents:MONEY, taxCents:MONEY, tipCents:MONEY, totalCents:MONEY, refundCents:MONEY, paymentStatus:{enum:['unpaid','partial','paid','refunded','voided']}, employeeReference:reference('employee'), items:{type:'array',maxItems:LIMITS.maxOrderItems,items:item}, discounts:{type:'array',maxItems:50,items:discount}, taxes:{type:'array',maxItems:50,items:tax}, tenders:{type:'array',maxItems:50,items:tender}
} };
const cashSession = { type:'object', additionalProperties:false, required:['cashSessionId','businessDate','status','openingBankCents','cashSalesCents','paidInCents','paidOutCents','dropCents','expectedCashCents'], properties:{ cashSessionId:ID, businessDate:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}, status:{enum:['open','closed']}, openedAt:DATE_TIME, closedAt:DATE_TIME, openingBankCents:MONEY, cashSalesCents:MONEY, paidInCents:MONEY, paidOutCents:MONEY, dropCents:MONEY, expectedCashCents:MONEY, countedCashCents:MONEY, varianceCents:MONEY, employeeReference:reference('employee') } };
const EVENT_TYPES = Object.freeze(['order.opened','order.updated','order.closed','order.voided','order.refunded','cash.session.opened','cash.session.closed']);
const MAX_FUTURE_OCCURRED_AT_MS=5*60*1000;
const envelopeBase = { type:'object', additionalProperties:false, required:['eventId','eventType','schemaVersion','posInstallationId','sourceEntityType','sourceEntityId','sourceEntityVersion','sequence','occurredAt','payload'], properties:{ eventId:ID, eventType:{enum:EVENT_TYPES}, schemaVersion:{const:1}, posInstallationId:ID, sourceEntityType:{enum:['order','cash.session']}, sourceEntityId:ID, sourceEntityVersion:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER}, sequence:{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER}, occurredAt:DATE_TIME, payload:{} } };

const ajv = new Ajv({ allErrors:true, strict:true, removeAdditional:false });
const validators = new Map(EVENT_TYPES.map(type => {
  const order = type.startsWith('order.');
  const schema = JSON.parse(JSON.stringify(envelopeBase));
  schema.properties.payload = order ? orderSnapshot : cashSession;
  return [type, ajv.compile(schema)];
}));
function depth(value, current=0) { if (!value || typeof value !== 'object') return current; return Object.values(value).reduce((max,v)=>Math.max(max,depth(v,current+1)),current); }
function validationErrors(validate) { return (validate.errors || []).slice(0,12).map(e => ({ path:e.instancePath || '/', keyword:e.keyword, message:e.message })); }
function realCalendarDate(value){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));if(!match)return false;const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);const date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;}
function validUtcTimestamp(value){if(!DATE_TIME.pattern||!new RegExp(DATE_TIME.pattern).test(String(value||'')))return false;const timestamp=Date.parse(String(value));return Number.isFinite(timestamp)&&realCalendarDate(String(value).slice(0,10));}
function validateEvent(event,{nowMs=Date.now()}={}) {
  const bytes = Buffer.byteLength(JSON.stringify(event || {}),'utf8');
  if (bytes > LIMITS.maxEventBytes) return { ok:false, errors:[{path:'/',keyword:'maxBytes',message:'event exceeds maximum size'}] };
  if (depth(event) > LIMITS.maxObjectDepth) return { ok:false, errors:[{path:'/',keyword:'maxDepth',message:'event nesting exceeds maximum depth'}] };
  const validate = validators.get(event?.eventType);
  if (!validate) return { ok:false, errors:[{path:'/eventType',keyword:'enum',message:'unsupported event type'}] };
  const ok = validate(event);
  if (!ok) return { ok:false, errors:validationErrors(validate) };
  if ((event.sourceEntityType === 'order') !== event.eventType.startsWith('order.')) return { ok:false, errors:[{path:'/sourceEntityType',keyword:'contract',message:'entity type does not match event type'}] };
  if (event.payload.orderId && event.payload.orderId !== event.sourceEntityId || event.payload.cashSessionId && event.payload.cashSessionId !== event.sourceEntityId) return { ok:false, errors:[{path:'/payload',keyword:'identity',message:'payload identity does not match envelope'}] };
  const lifecycle={
    'order.opened':['open','unpaid'],
    'order.closed':['closed','paid'],
    'order.voided':['voided','voided'],
    'order.refunded':['refunded','refunded'],
    'cash.session.opened':['open',null],
    'cash.session.closed':['closed',null]
  }[event.eventType];
  if(lifecycle&&(event.payload.status!==lifecycle[0]||(lifecycle[1]&&event.payload.paymentStatus!==lifecycle[1])))return {ok:false,errors:[{path:'/payload/status',keyword:'lifecycle',message:'snapshot lifecycle does not match event type'}]};
  if(event.eventType==='order.refunded'&&(!Number.isInteger(event.payload.refundCents)||event.payload.refundCents<=0))return {ok:false,errors:[{path:'/payload/refundCents',keyword:'lifecycle',message:'refunded order requires positive integer refund cents'}]};
  if(!realCalendarDate(event.payload.businessDate))return {ok:false,errors:[{path:'/payload/businessDate',keyword:'calendar',message:'business date must be a real calendar date'}]};
  if(!validUtcTimestamp(event.occurredAt))return {ok:false,errors:[{path:'/occurredAt',keyword:'timestamp',message:'occurredAt must be a real UTC timestamp'}]};
  if(Date.parse(event.occurredAt)>Number(nowMs)+MAX_FUTURE_OCCURRED_AT_MS)return {ok:false,errors:[{path:'/occurredAt',keyword:'future',message:'occurredAt is unreasonably far in the future'}]};
  for(const field of ['openedAt','closedAt'])if(event.payload[field]!==undefined&&!validUtcTimestamp(event.payload[field]))return {ok:false,errors:[{path:`/payload/${field}`,keyword:'timestamp',message:`${field} must be a real UTC timestamp`}]};
  if(event.payload.openedAt&&event.payload.closedAt&&Date.parse(event.payload.closedAt)<Date.parse(event.payload.openedAt))return {ok:false,errors:[{path:'/payload/closedAt',keyword:'timestampOrder',message:'closedAt cannot precede openedAt'}]};
  return { ok:true, errors:[] };
}
function canonicalize(value) { if (Array.isArray(value)) return value.map(canonicalize); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out,key)=>{out[key]=canonicalize(value[key]);return out;},{}); return value; }
function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }
function hashTuple(label, parts) { const encoded = parts.map(part=>`${Buffer.byteLength(String(part),'utf8')}:${String(part)}`).join('|'); return crypto.createHash('sha256').update(`pos-bridge-hash-v1|${label}|${encoded}`,'utf8').digest('hex'); }
function eventContentHash(event) { return crypto.createHash('sha256').update(canonicalJson(event),'utf8').digest('hex'); }
function entityContentHash(event) { return crypto.createHash('sha256').update(canonicalJson({eventType:event.eventType,sourceEntityType:event.sourceEntityType,sourceEntityId:event.sourceEntityId,sourceEntityVersion:event.sourceEntityVersion,payload:event.payload}),'utf8').digest('hex'); }

module.exports = { EVENT_TYPES, MAX_FUTURE_OCCURRED_AT_MS, validateEvent, realCalendarDate, validUtcTimestamp, canonicalJson, hashTuple, eventContentHash, entityContentHash, schemas:{ orderSnapshot,item,discount,tax,tender,cashSession,employeeReference:reference('employee'),menuReference:reference('menu') } };
