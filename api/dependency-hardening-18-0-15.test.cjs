'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {modernOptions}=require('../scripts/modern-dev-server.cjs');
test('modern development options preserve before/after middleware ordering and restrict the local host',()=>{
  const order=[],after={use:fn=>order.push(['registered-after',fn])},handler=()=>{};
  const options=modernOptions({https:false,http2:false,allowedHosts:'all',onBeforeSetupMiddleware:()=>order.push('before'),onAfterSetupMiddleware:server=>server.app.use(handler),proxy:{'/api':{target:'http://127.0.0.1:3001'}}},{localOnly:true,routerFactory:()=>after});
  assert.equal(options.onBeforeSetupMiddleware,undefined);assert.equal(options.https,undefined);assert.equal(options.server,'http');assert.deepEqual(options.allowedHosts,['127.0.0.1','localhost']);assert.equal(Array.isArray(options.proxy),true);
  const list=options.setupMiddlewares([{name:'build',middleware:handler}],{app:{use(){throw new Error('after middleware registered too early');}}});
  assert.equal(order[0],'before');assert.equal(list[0].name,'build');assert.equal(list[1].middleware,after);
});
test('patched proxy trust cannot treat an unrelated IPv4 client as a trusted IPv6 subnet',()=>{
  const proxyaddr=require('proxy-addr'),trust=proxyaddr.compile('::ffff:10.0.0.0/8');
  assert.equal(trust('192.0.2.123',0),false);
  const req={socket:{remoteAddress:'192.0.2.123'},headers:{'x-forwarded-for':'10.0.0.1'}};
  assert.equal(proxyaddr(req,trust),'192.0.2.123');
});
test('patched shell quoting rejects a line terminator after a comment without executing shell text',()=>{
  const {quote}=require('shell-quote');
  for(const terminator of ['\n','\r','\u2028','\u2029'])assert.throws(()=>quote(['echo','ok',{comment:'review'},`record${terminator}unexpected`]),TypeError);
});
test('maintained selector parser preserves nested selectors and serialization escapes executable HTML',()=>{
  const parser=require('postcss-selector-parser'),serialize=require('serialize-javascript');
  const input=':is(.kitchen, .bar) > [data-role="cook"]:not([disabled])';
  assert.equal(parser().processSync(input),input);
  assert.doesNotMatch(serialize({note:'</script><script>alert(1)</script>'}),/<\/script>/i);
});

test('untrusted telemetry metadata is bounded before shared Firebase request authorization',()=>{
  const {assertTelemetryHeaderBudget}=require('./_request-context-limits.cjs');
  assert.doesNotThrow(()=>assertTelemetryHeaderBudget({baggage:'k=v'}));
  for(const header of ['baggage','traceparent','tracestate'])assert.throws(()=>assertTelemetryHeaderBudget({[header]:'x'.repeat(8193)}),error=>error.statusCode===413);
  const {getRequestedProjectId}=require('./_firebase-project-admin');
  assert.throws(()=>getRequestedProjectId({headers:{baggage:'x'.repeat(8193)}}),error=>error.code==='request_context_too_large');
});
test('maintained UUID namespace generation checks the caller-provided buffer bounds',()=>{
  const uuid=require('uuid');
  const result=uuid.v5('86chaos',uuid.v5.DNS);assert.equal(uuid.validate(result),true);assert.equal(result,uuid.v5('86chaos',uuid.v5.DNS));
  assert.throws(()=>uuid.v5('86chaos',uuid.v5.DNS,new Uint8Array(1)));
});
