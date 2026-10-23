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

export type AdminListItem = {
  id: string;
  user_id: string;
  email: string;
  username: string;
  role: AdminRole;
  status: AdminStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};
