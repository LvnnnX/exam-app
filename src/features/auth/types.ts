export type AdminRole = 'super_admin' | 'admin';
export type AdminStatus = 'pending' | 'active' | 'rejected';

export type CurrentAdmin = {
  id: string;
  userId: string;
  email: string;
  username: string;
  role: AdminRole;
  status: AdminStatus;
};
