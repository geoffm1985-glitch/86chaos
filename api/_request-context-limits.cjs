'use strict';
const LIMITS=Object.freeze({baggage:8192,traceparent:512,tracestate:512});
function assertTelemetryHeaderBudget(headers={}) {
  for(const [name,limit] of Object.entries(LIMITS)){
    const supplied=headers[name];
    const value=Array.isArray(supplied)?supplied.join(','):String(supplied || '');
    if(Buffer.byteLength(value,'utf8')>limit)throw Object.assign(new Error('Request tracing metadata exceeds the allowed size.'),{statusCode:413,code:'request_context_too_large'});
  }
}
module.exports={LIMITS,assertTelemetryHeaderBudget};
