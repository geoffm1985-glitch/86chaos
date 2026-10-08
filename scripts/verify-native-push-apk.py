"""Verify the distributed APK includes the native FCM bridge and exact app identity."""
import json
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
with zipfile.ZipFile(sys.argv[1]) as apk:
    plugins = json.loads(apk.read('assets/capacitor.plugins.json'))
    assert any(p.get('classpath') == 'io.capawesome.capacitorjs.plugins.firebase.messaging.FirebaseMessagingPlugin' for p in plugins), 'Native Firebase Messaging plugin missing'
    version = json.loads(apk.read('assets/public/version.json'))
    identity = json.loads(apk.read('assets/public/build-identity.json'))
    package = json.loads((root / 'package.json').read_text())
    manifest = json.loads((root / 'release-source-manifest.json').read_text())
    assert version['version'] == package['version'] == identity['version'], 'APK release identity mismatch'
    assert identity['identityStampStatus'] == 'verified', 'APK source identity is not verified'
    assert identity['sourceHash'] == manifest['sourceHash'], 'APK source does not match the sealed manifest'
    dex = b''.join(apk.read(name) for name in apk.namelist() if name.endswith('.dex'))
    assert b'FirebaseMessagingPlugin' in dex and b'MessagingService' in dex, 'Native push implementation missing from DEX'
    resources = apk.read('resources.arsc')
    services = json.loads((root / 'android/app/google-services.json').read_text())
    app_id = services['client'][0]['client_info']['mobilesdk_app_id']
    assert services['project_info']['project_id'] == 'chaos-test-d1601'
    for value in ['chaos-test-d1601', app_id]:
        assert value.encode() in resources or value.encode('utf-16-le') in resources, 'Testing Firebase resource missing: ' + value
print('Verified native FCM plugin, receiver, testing Firebase resources and sealed APK identity for ' + version['version'])
