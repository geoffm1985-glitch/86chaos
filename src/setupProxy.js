// CRA loads this only in its local development server, never in a deployed build.
module.exports = app => {
  if (process.env.REACT_APP_86CHAOS_YARDMASTER === 'true') {
    if(process.env.CHAOS_PIN_LOCAL_RELEASE_IDENTITY==='1')require('../scripts/pin-local-release-runtime.cjs').installRuntimePin(app);
    require('../scripts/yardmaster-readiness.cjs').installReadiness(app);
    require('../scripts/yardmaster-api.cjs').installLocalApi(app);
  }
};
