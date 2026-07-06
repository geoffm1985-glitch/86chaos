# 86 Chaos 13.1.7 Message Board Polish

## Changed
- Fixed the Message Board header layout so the title/subtitle no longer crunches into a narrow vertical column beside the search/filter controls.
- Message Board posts now sort strictly newest-first by posted date. Important posts keep their badge but no longer override chronological order.
- Added a Like button to posted messages. Likes are saved on the event document as a `likes` array with user id, name, and timestamp.
- Updated version to 13.1.7.

## Test
- Open Message Board at desktop, tablet, and narrow widths.
- Confirm header stays readable.
- Post three messages and confirm newest is always on top.
- Like and unlike a post with one user.
- Log in as another user and confirm like count updates live.
