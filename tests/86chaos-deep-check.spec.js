// 15.0.88 Playwright watcher patch
// Keep failing on real crashes/errors, but ignore expected browser cancellations
// caused by fast tab navigation, Vercel preview internals, and Firestore long-poll listeners.

function isExpectedAbort(request) {
  const url = request.url();
  const failure = request.failure()?.errorText || '';

  if (failure !== 'net::ERR_ABORTED') return false;

  return (
    url.includes('/.well-known/vercel/jwe') ||
    url.includes('/api/whoami') ||
    url.includes('/api/presence-heartbeat') ||
    url.includes('/api/workspace-memberships') ||
    url.includes('/recaptcha/enterprise/clr') ||
    url.includes('firebasestorage.googleapis.com') ||
    /firestore\.googleapis\.com\/google\.firestore\.v1\.Firestore\/(Listen|Write)\/channel/.test(url) ||
    url.startsWith(`${APP_URL}/?tab=`) ||
    /\/static\/js\/.*\.chunk\.js$/.test(url)
  );
}

function watchForProblems(page, problems) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      problems.push({
        type: 'console-error',
        text: msg.text(),
        url: page.url(),
      });
    }
  });

  page.on('pageerror', (error) => {
    problems.push({
      type: 'page-crash',
      text: error.message,
      url: page.url(),
    });
  });

  page.on('requestfailed', (request) => {
    if (isExpectedAbort(request)) return;

    problems.push({
      type: 'request-failed',
      requestUrl: request.url(),
      failure: request.failure()?.errorText,
      pageUrl: page.url(),
    });
  });

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();

    if (status >= 500) {
      problems.push({
        type: 'server-error',
        status,
        requestUrl: url,
        pageUrl: page.url(),
      });
    }
  });

  page.on('dialog', async (dialog) => {
    problems.push({
      type: 'popup-dialog',
      message: dialog.message(),
      url: page.url(),
    });

    await dialog.dismiss().catch(() => {});
  });
}

async function readManagerBriefMath(page) {
  const mathLocator = page.getByTestId('manager-brief-math-summary-global');
  await expect(mathLocator).toBeAttached({ timeout: 30000 });
  const text = await mathLocator.innerText();
  expect(text).toMatch(/\d+\s+On Schedule\s+\d+\s+Clocked In\s+\d+\s+Needs Eyes/i);
  return text;
}