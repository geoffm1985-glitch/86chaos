// CRA loads this only in its local development server, never in a deployed build.
module.exports = app => {
  if (process.env.REACT_APP_86CHAOS_YARDMASTER === 'true') {
    require('../scripts/yardmaster-readiness.cjs').installReadiness(app);
  }
};
