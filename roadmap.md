# Roadmap

## Design (done)
- [x] Three stage themes, Arabic RTL, shell, student pages, landing, grades

## Backend (done)
- [x] Lovable Cloud: email + Google + Lovable sign-in
- [x] Database: profiles, roles, subjects, lessons, classes, assignments, submissions, quizzes, attempts, notifications, parent links
- [x] Storage buckets: lesson media + assignment submissions
- [x] Auth pages: /auth (sign in/up/forgot), /reset-password
- [x] Student pages protected behind sign-in
- [x] Grade persisted to profile (survives refresh)
- [x] Dashboard/subjects/lessons/classes/assignments/quizzes/progress/profile connected to real data
- [x] Lesson detail page (video + notes + mark complete)
- [x] Quiz taking page + results page (server-side scoring)
- [x] Assignment submit page (file upload)
- [x] Teacher area (subjects, lessons, classes, assignments, quizzes, grading)
- [x] Notifications page
- [x] Parents' area (link by code, follow child's progress)
- [x] Small pages: About, Contact, Privacy, Terms, Arabic 404
- [x] Verified end-to-end in preview (sign-up, grade, content, lesson, quiz, notifications)

## Notes
- Test teacher account exists (teacher role). User should sign up their own account and ask for admin/teacher role grant.
- Assignment file upload and parent linking built but not click-tested in preview.
