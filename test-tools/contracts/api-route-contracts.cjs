'use strict';
module.exports=Object.freeze({
  recognizedWrappers:Object.freeze({handler:{moduleSuffix:'/api/_pos-bridge-route.js',properties:['error']}}),
  recognizedGuards:Object.freeze({method:{moduleSuffix:'/api/_pos-bridge-route.js',property:'method'},readBoundedJson:{moduleSuffix:'/api/_pos-bridge-route.js',property:'body'}}),
  bodyRequired:Object.freeze([
    'safe-write.js','schedule-publish.js','daily-close.js',
    'pos-bridge/v1/events.js','pos-bridge/v1/installations.js','pos-bridge/v1/mappings.js','pos-bridge/v1/reconciliation.js','pos-bridge/v1/token.js'
  ]),
  adapters:Object.freeze({
    'version.js':{kind:'public',reviewed:true,methods:['GET'],reason:'Immutable deployment identity.'},
    'build-identity.js':{kind:'public',reviewed:true,methods:['GET'],reason:'Immutable source and deployment identity.'},
    'privacy.js':{kind:'public',reviewed:true,methods:['GET'],reason:'Public legal document.'},
    'quickbooks-webhook.js':{kind:'webhook',reviewed:true,reason:'Provider signature-verified webhook.'},
    'mfa-recovery-code.js':{kind:'recovery-code',reviewed:true,reason:'Rate-limited, hashed, transactional one-time recovery credential.'},
    'shift4-callback.js':{kind:'oauth-callback',reviewed:true,reason:'Single-use state plus current initiator revalidation.'},
    'dispatch-reminders.js':{kind:'cron',reviewed:true},
    'firestore-backup-watchdog.js':{kind:'cron',reviewed:true},
    'firestore-backup.js':{kind:'cron',reviewed:true},
    'weekly-maintenance.js':{kind:'cron',reviewed:true},
    'schedule-restore-utils.js':{kind:'deny-only',reviewed:true}
  })
});
