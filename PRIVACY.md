# Privacy Notes

This repair pass reduces local and client-side exposure by limiting cached session data and routing crash reports through the server report endpoint. The app should avoid storing wages, private notes, phone numbers, email addresses, or push tokens in browser storage unless strictly necessary for the signed-in session.

Crash reports and audit logs are operational records. Restrict read access to authorized administrators and avoid including secrets, passwords, service account details, or unnecessary personal data.
