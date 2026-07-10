# Data Retention Setup, Super-Easy Version

Do this in the TEST project first. Do not start with production.

## Part 1: Create the archive bucket

1. Open Google Cloud Console.
2. At the very top, select project `chaos-test-d1601`.
3. Open Cloud Storage.
4. Click Buckets.
5. Click Create.
6. Use a name like:

   `chaos-test-d1601-retention-archive`

   Bucket names must be unique. Add a short number at the end if Google says the name is taken.
7. Pick the same general location as the existing Firebase Storage bucket.
8. Choose Standard storage.
9. Turn on uniform access if Google asks.
10. Finish creating the bucket.

## Part 2: Tell the functions the bucket name

Inside the app folder, create this file:

`functions/.env.chaos-test-d1601`

Put one line in it:

```text
RETENTION_ARCHIVE_BUCKET=chaos-test-d1601-retention-archive
```

Use the exact bucket name you created. Do not write `gs://`.

## Part 3: Open PowerShell in the app folder

In File Explorer:

1. Open the unzipped 86 Chaos folder.
2. Click the address bar.
3. Type `powershell`.
4. Press Enter.

## Part 4: Install the Firebase command tool

Run:

```powershell
npm install -g firebase-tools
```

Then run:

```powershell
firebase login
```

A browser opens. Sign into the Google account that owns the testing Firebase project.

## Part 5: Select the TEST Firebase project

Run:

```powershell
firebase use chaos-test-d1601
```

If it says the project is not configured, run:

```powershell
firebase use --add
```

Choose `chaos-test-d1601`, give it the alias `testing`, then run:

```powershell
firebase use testing
```

## Part 6: Install and check the retention code

Run:

```powershell
npm --prefix functions install
npm --prefix functions run build
```

The second command must finish without a red error.

## Part 7: Deploy to TESTING

Run:

```powershell
firebase deploy --only firestore:rules,firestore:indexes,functions
```

This deploys the retention functions. It does not deploy the React website to Vercel.

## Part 8: Check that it worked

1. Open Firebase Console for `chaos-test-d1601`.
2. Open Functions.
3. Confirm these functions exist:
   - `purgeTransientOperationalData`
   - `purgeExpiredAiUploads`
   - `archiveExpiredTimeClockData`
   - `purgeExpiredTimeClockArchives`
   - `hardDeleteExpiredWorkspaces`
4. Open Google Cloud Console.
5. Open Cloud Scheduler.
6. Confirm a daily scheduler job exists for each function.

## Part 9: Test before production

Use fake records and a fake restaurant only. Follow `QA_15_0_44_CHECKLIST.md`.

The most important test is this:

- Put an old fake time punch in testing.
- Run the archive job.
- Confirm the archive file exists.
- Open/decompress the file.
- Only then confirm the Firestore punch was removed.

## Part 10: Production later

After testing passes:

1. Create a second archive bucket under project `cheers-34b8d`.
2. Create `functions/.env.cheers-34b8d` with that production bucket name.
3. Switch Firebase CLI to `cheers-34b8d`.
4. Run the same deploy command.
5. Deploy the normal app through Vercel for the menu and workspace UI changes.

## Important warning about Cloud Storage deletion

Google Cloud Storage may keep a deleted object in soft-delete recovery for several extra days, depending on the bucket setting. That is separate from 86 Chaos. Do not turn soft delete off on the main app bucket until you understand the effect on every file in that bucket.
