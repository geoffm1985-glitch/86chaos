# QA 13.1.15 - Schedule Builder Overwrite

1. Deploy to staging.
2. Log in as Super Admin.
3. Go to System Administrator -> Forensics.
4. Run Emergency Schedule Rescue and type REINJECT JULY.
5. Confirm the result says draft shifts were loaded.
6. Open Time Clock & Schedule -> Schedule Builder.
7. Change the calendar/month to July 2026.
8. Confirm the old July shifts are gone.
9. Confirm the July PDF shifts are present as unpublished/draft shifts.
10. Click Publish Schedule.
11. Open Full Schedule and confirm the republished July schedule appears.
12. Run the rescue a second time and confirm it does not duplicate shifts.
