'use strict';
const json = (res, status, payload) => { res.status(status); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(payload)); };
const queryValue = value => Array.isArray(value) ? value[0] : value;
const restaurantIdFrom = req => String(req.body?.restaurantId || queryValue(req.query?.restaurantId) || '').trim();
const statusFor = error => Number(error?.statusCode || error?.status || (/required|expired|refresh/i.test(String(error?.code || '')) ? 401 : /mismatch|permission|unsupported|unverified/i.test(String(error?.code || '')) ? 403 : /range|state|callback/i.test(String(error?.code || '')) ? 400 : 500));
module.exports = { json, queryValue, restaurantIdFrom, statusFor };
