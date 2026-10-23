// Pure validation shared by the register form (live hint) and the server action.
export const USERNAME_RE = /^[a-z0-9_.]{3,32}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** null = ok. 8-72 chars (bcrypt cap), at least one letter and one digit. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Password minimal 8 karakter';
  if (pw.length > 72) return 'Password maksimal 72 karakter';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password wajib berisi huruf dan angka';
  return null;
}

/** Only same-site admin paths; blocks open redirects like //evil.com or /\evil.com. */
export function safeAdminRedirect(target: string): string {
  return /^\/admin\/[A-Za-z0-9/_-]*$/.test(target) && !target.startsWith('/admin/login') ? target : '/admin/soal';
}
