'use strict';
process.env.NODE_ENV=process.env.BABEL_ENV='development';
require('./modern-dev-server.cjs').installModernDevServer();
require('react-scripts/scripts/start');
