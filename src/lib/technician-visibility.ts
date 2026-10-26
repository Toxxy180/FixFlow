import { isAccountAllowed } from './account-status';

type TechnicianVisibility = {
  active: boolean;
  applicationStatus: string;
  categoryModel: { active: boolean };
  user: { active: boolean; suspendedUntil?: Date | null; role: string } | null;
};

export function isPublicTechnician(technician: TechnicianVisibility) {
  return (
    technician.active &&
    ['APPROVED', 'NONE'].includes(technician.applicationStatus) &&
    technician.categoryModel.active &&
    (!technician.user ||
      (technician.user.role === 'TECHNICIAN' && isAccountAllowed(technician.user)))
  );
}
