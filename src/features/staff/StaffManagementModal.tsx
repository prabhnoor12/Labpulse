import React, { useState } from 'react';
import { KeyRound, Power, ShieldCheck, UserPlus, X } from 'lucide-react';
import type { StaffUser } from '@/services/apiClient';

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: StaffUser[];
  onCreate: (input: { name: string; email: string; password: string; role: StaffUser['role'] }) => Promise<void>;
  onUpdate: (id: string, input: { name?: string; password?: string; role?: StaffUser['role']; active?: boolean }) => Promise<void>;
}

const roles: StaffUser['role'][] = ['PATHOLOGIST', 'TECHNICIAN', 'RECEPTIONIST', 'VIEWER'];

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({ isOpen, onClose, users, onCreate, onUpdate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffUser['role']>('TECHNICIAN');
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const createStaff = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onCreate({ name, email, password, role });
      setName('');
      setEmail('');
      setPassword('');
      setRole('TECHNICIAN');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the staff account.');
    } finally {
      setLoading(false);
    }
  };

  const updateStaff = async (id: string, input: { role?: StaffUser['role']; active?: boolean; password?: string }) => {
    setLoading(true);
    setError(null);
    try {
      await onUpdate(id, input);
      if (input.password) setResetPasswords((previous) => ({ ...previous, [id]: '' }));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to update the staff account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="Staff management">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-black text-slate-900">Staff accounts</h2>
              <p className="text-xs text-slate-500">Assign least-privilege access to your laboratory team.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close staff management"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 p-5">
          {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{error}</div>}

          <form onSubmit={createStaff} className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-900"><UserPlus className="h-4 w-4" /> Add staff member</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" autoComplete="name" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
              <input required minLength={12} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password (12+)" autoComplete="new-password" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
              <select value={role} onChange={(event) => setRole(event.target.value as StaffUser['role'])} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">
                {roles.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <button type="submit" disabled={loading} className="mt-3 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50">Create staff account</button>
          </form>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">Existing staff ({users.length})</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-2">Staff member</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Reset password</th></tr></thead>
                <tbody className="divide-y divide-slate-200">
                  {users.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">No staff accounts yet.</td></tr> : users.map((user) => (
                    <tr key={user.id} className={user.active ? '' : 'bg-slate-50 text-slate-400'}>
                      <td className="px-3 py-3"><div className="font-bold text-slate-900">{user.name}</div><div className="text-[11px] text-slate-500">{user.email}</div></td>
                      <td className="px-3 py-3"><select value={user.role} disabled={!user.active || loading} onChange={(event) => void updateStaff(user.id, { role: event.target.value as StaffUser['role'] })} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold"><option value="PATHOLOGIST">PATHOLOGIST</option><option value="TECHNICIAN">TECHNICIAN</option><option value="RECEPTIONIST">RECEPTIONIST</option><option value="VIEWER">VIEWER</option></select></td>
                      <td className="px-3 py-3"><button type="button" disabled={loading} onClick={() => void updateStaff(user.id, { active: !user.active })} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${user.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}><Power className="h-3 w-3" />{user.active ? 'Active' : 'Inactive'}</button></td>
                      <td className="px-3 py-3"><div className="flex gap-1"><input type="password" minLength={12} value={resetPasswords[user.id] || ''} onChange={(event) => setResetPasswords((previous) => ({ ...previous, [user.id]: event.target.value }))} placeholder="New password" className="w-32 rounded border border-slate-300 px-2 py-1 text-[11px]" /><button type="button" disabled={loading || !resetPasswords[user.id] || !user.active} onClick={() => void updateStaff(user.id, { password: resetPasswords[user.id] })} className="rounded bg-slate-800 px-2 py-1 text-white disabled:opacity-40" title="Reset password"><KeyRound className="h-3 w-3" /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
