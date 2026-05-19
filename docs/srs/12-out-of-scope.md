# 12. Out of Scope

The following are not required by current behavior. They may surface as future work but are not part of the current SRS:

## Student Identity

- Public student account registration. The app uses anonymous sessions and free-text names per attempt.
- Persistent student profiles across sessions.
- Social sign-in for students.
- Per-student attempt history visible to the student.

## Payments and Commerce

- Paid exams or subscriptions.
- Promo codes, coupons, or refunds.
- Marketplace for question packs.

## Offline and Native

- Offline exam mode (the app requires Supabase to round-trip every answer).
- Native iOS/Android applications.
- Tablet-specific layouts beyond responsive web.
- PWA install prompts and service workers.

## Proctoring

- Live proctor dashboard with webcam streams.
- ID verification flows.
- Voice or audio detection.
- Per-question screen recording.

The current anti-cheat (Wake Lock + Page Visibility + selection blocking) is not a substitute for human proctoring.

## Integration

- LMS integration (Moodle, Canvas, Google Classroom).
- SCORM or xAPI export.
- SSO (SAML, LDAP, Active Directory).
- Calendar integrations.
- Webhooks to external systems.

## Notifications

- Email notifications to students about results.
- Email digests to admins about activity.
- SMS or push notifications.
- In-app notification center beyond toasts.

## Advanced Admin

- Granular role hierarchy beyond `admin` and `super_admin`.
- Per-tab or per-action audit logs visible to admins.
- Bulk question import beyond what the question modal supports today.
- Bulk export of historical results to CSV/Excel from the admin UI.

These can be implemented via direct database queries by the operator if needed.

## Analytics and Reporting

- Long-term cohort analysis.
- Item analysis (per-question difficulty curves over time).
- Custom dashboard builder.
- Scheduled report email digests.

## Internationalization

- UI translations beyond the current Bahasa Indonesia + English mix.
- Per-question localization.
- Right-to-left layouts.

## Accessibility

- Screen reader audit certification.
- WCAG AA conformance statement.
- Keyboard-only navigation contracts.

The app aims to be reasonable on these axes but does not guarantee certified compliance.
