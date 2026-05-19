# Admin Authentication and Access Control Requirements

## FR-ADMIN-001: Admin Login

The system shall show an admin login screen at `/admin` when unauthenticated.

The login form shall accept email + password and authenticate via Supabase Auth.

## FR-ADMIN-002: Admin Auth Loading

The system shall show a loading screen while checking admin auth (`AdminAuthLoadingView`).

## FR-ADMIN-003: Admin Restriction

The system shall enforce admin permissions at three layers:

- Tab visibility (filtered by `canAccessManage`, `canViewSettings`, etc. in the page controller).
- Server actions (token validation + permission check).
- Postgres RLS + RPC `SECURITY DEFINER` functions.

## FR-ADMIN-004: Admin Logout

The system shall let the admin log out from the sidebar logout button.

Logout shall clear the Supabase session and redirect to the login screen.

## FR-ADMIN-005: Admin Signup

The system shall let a new admin self-register at `/admin/signup` by submitting email, password, and username.

The system shall:

- Create a Supabase Auth user.
- Insert a row in `admin_signup_requests` with `status = 'pending'`.
- Block dashboard access for pending users.

## FR-ADMIN-006: Password Recovery

The system shall provide:

- `/admin/forgot-password` — email entry triggers a Supabase password reset email.
- `/admin/reset-password` — handles the reset token from the email link.

## FR-ADMIN-007: Super Admin Approval Flow

The super admin shall view pending signup requests in the Access tab.

The super admin shall be able to:

- Approve a request (creates an `admin_profiles` row with the requested role).
- Reject a request with an optional reason.

## FR-ADMIN-008: Permission Matrix

The super admin shall view and edit per-admin permission toggles in the Access tab matrix.

The matrix shall expose every token defined in `lib/admin-permissions.ts`.

## FR-ADMIN-009: Admin Removal

The super admin shall be able to remove an admin profile.

The system shall require explicit confirmation before deletion.

## FR-ADMIN-010: Theme Persistence

The admin dashboard shall support light and dark themes.

The selected theme shall persist in `localStorage` under `admin-theme` and apply via `html.admin-dark-theme` and `body.admin-dark-theme` class toggles plus inline style overrides on `<html>` and `<body>`.

