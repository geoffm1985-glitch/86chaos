'use strict';

require('./menuApproval.shared.js');

const menuApproval = globalThis.__86ChaosMenuApprovalShared;
if (!menuApproval) throw new Error('86 Chaos menuApproval failed to initialize.');

module.exports = menuApproval;
