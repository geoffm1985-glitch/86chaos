"""Verify the distributed APK includes the native FCM bridge and exact app identity."""
import json
import sys
import zipfile
from pathlib import Path
from apk_elf_alignment import verify_apk_elf_alignment

root = Path(__file__).resolve().parent.parent
testing = '--testing' in sys.argv[2:]
expected_project = 'chaos-test-d1601' if testing else 'cheers-34b8d'
expected_hostname = 'testing.86chaos.com' if testing else 'app.86chaos.com'
aligned_libraries = verify_apk_elf_alignment(sys.argv[1])
print('Verified 16 KB LOAD and RELRO alignment for ' + str(len(aligned_libraries)) + ' native libraries')
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
    # Verify the published binary actually contains the new launcher artwork,
    # including adaptive and legacy resources, rather than an earlier APK.
    artwork_path = next((name for name in apk.namelist() if name.startswith('res/') and name.endswith('/chaos86_launcher_artwork.png')), None)
    assert artwork_path, 'Borderless native launcher artwork missing from APK'
    expected_artwork = (root / 'android/app/src/main/res/drawable-nodpi/chaos86_launcher_artwork.png').read_bytes()
    # AAPT may recompress PNG resources; compare the PNG dimensions instead of
    # requiring identical compression bytes.
    compiled_artwork = apk.read(artwork_path)
    assert compiled_artwork.startswith(b'\x89PNG\r\n\x1a\n'), 'Packaged launcher artwork is not a PNG'
    assert compiled_artwork[16:24] == expected_artwork[16:24], 'APK launcher artwork dimensions differ from the reviewed source asset'
    for icon in ['ic_launcher.xml', 'ic_launcher_round.xml']:
        assert any(name.startswith('res/mipmap-anydpi-v26/') and name.endswith('/' + icon) for name in apk.namelist()), 'Adaptive launcher resource missing: ' + icon
        assert any(name.startswith('res/mipmap-anydpi') and not name.startswith('res/mipmap-anydpi-v26/') and name.endswith('/' + icon) for name in apk.namelist()), 'Legacy launcher fallback missing: ' + icon
    dex = b''.join(apk.read(name) for name in apk.namelist() if name.endswith('.dex'))
    assert b'FirebaseMessagingPlugin' in dex and b'MessagingService' in dex, 'Native push implementation missing from DEX'
    assert b'ChaosNativePlugin' in dex and b'startSpeech' in dex and b'documentCreated' in dex, 'Native voice and PDF implementation missing from DEX'
    assert b'LocalNotificationsPlugin' in dex, 'Closed-app device reminders missing from DEX'
    assert not any(b'TestRecognitionService' in apk.read(name) for name in apk.namelist() if name.endswith('.dex')), 'Test speech provider must never ship in the downloadable APK'
    resources = apk.read('resources.arsc')
    capacitor = json.loads(apk.read('assets/capacitor.config.json'))
    assert capacitor['server']['hostname'] == expected_hostname, 'APK local origin does not match its target'
    services = json.loads((root / ('mobile/testing/google-services.json' if testing else 'android/app/google-services.json')).read_text())
    app_id = services['client'][0]['client_info']['mobilesdk_app_id']
    assert services['project_info']['project_id'] == expected_project
    for value in [expected_project, app_id]:
        assert value.encode() in resources or value.encode('utf-16-le') in resources, 'Target Firebase resource missing: ' + value
    if testing:
        assert b'cheers-34b8d' not in resources and 'cheers-34b8d'.encode('utf-16-le') not in resources, 'Production Firebase resources leaked into testing APK'
        target = json.loads(apk.read('assets/public/native-build-target.json'))
        assert target['environment'] == 'testing' and target['firebaseProjectId'] == expected_project
        assert target['apiBaseUrl'] == target['updatedApiBaseUrl'] == 'https://testing.86chaos.com', 'Testing APK API destination mismatch'
        assert target['sourceHash'] == identity['sourceHash'] and target['commit'] == identity['commit'], 'Testing target does not match sealed APK identity'
        assert capacitor['appName'] == '86 Chaos Testing', 'Testing APK must be labeled clearly'
print('Verified native bridges, ' + expected_project + ' Firebase resources and sealed APK identity for ' + version['version'])
