# QA 13.1.11 - Employee Quick Start

## Goal
Make sure the Employee Quick Start only goes away permanently after the employee clicks through every step and clicks Finish.

## Test 1 - Skip is temporary
1. Log in as a new employee with `onboardingComplete` false/missing.
2. Confirm Employee Quick Start opens.
3. Click **Skip for now**.
4. Confirm the tour closes.
5. Refresh the page in the same browser session.
6. Confirm it does not immediately pop back up in that same session.
7. Log out, close the browser, or clear session storage.
8. Log back in as the same employee.
9. Confirm the tour appears again.

Expected: Skip does not save permanent completion.

## Test 2 - X/close is temporary
1. Log in as a new employee with `onboardingComplete` false/missing.
2. Close the tour with the X/modal close.
3. Confirm it closes for the session.
4. Start a fresh session.
5. Confirm it appears again.

Expected: closing does not save permanent completion.

## Test 3 - Finish is permanent
1. Log in as a new employee with `onboardingComplete` false/missing.
2. Click through every step with Next.
3. Click **Finish** on the final step.
4. Refresh the page.
5. Log out and log back in.
6. Confirm Employee Quick Start does not auto-open again.

Expected: Finish saves `onboardingComplete: true` and the tour stays gone.

## Test 4 - Help Center restart still works
1. Open Help Center.
2. Click **Restart Employee Tour**.
3. Confirm the tour opens even if already completed.

Expected: manual restart still works for training.
