import { Role } from '../types';

/**
 * What each role is called on screen.
 *
 * This lived in two places — the header and the settings page — and the second
 * copy was missed when the guardian role was added, so a parent was shown the
 * raw word "guardian". One map, imported by both.
 */
export const ROLE_LABEL: Record<Role | string, string> = {
    admin: 'مدير النظام',
    assistant_admin: 'مساعد إدارة',
    teacher: 'كادر تعليمي',
    student: 'طالب',
    guardian: 'ولي أمر',
};

/** The label for a role, falling back to the raw value for anything unknown. */
export function roleLabel(role?: string): string {
    return (role && ROLE_LABEL[role]) || role || '';
}
