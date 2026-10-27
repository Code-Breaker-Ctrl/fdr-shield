import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, UserCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';

const PRESET_USERS = [
  { label: 'Institution Admin (Dronacharya College)', email: 'inst.admin@dronacharya.edu.in', role: 'institution_admin' },
  { label: 'AICTE Desk Officer (Desk Scrutiny)', email: 'officer@aicte-india.org', role: 'aicte_officer' },
  { label: 'Senior Official (Regulation Bureau)', email: 'senior.official@aicte-india.org', role: 'senior_official' },
  { label: 'Competent Authority (Advisor-I)', email: 'authority@aicte-india.org', role: 'competent_authority' },
  { label: 'System Admin (Portal Super Admin)', email: 'sysadmin@aicte-india.org', role: 'system_admin' },
];

export const LoginModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('inst.admin@dronacharya.edu.in');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Authenticated successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-blue-800 text-white p-6 text-center">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">AICTE FDR Shield Portal</h2>
          <p className="text-xs text-blue-200 mt-1">Official Government Security Deposit Sign-in</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Quick-Select Role Account</Label>
            <div className="space-y-1 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-1.5 bg-slate-50">
              {PRESET_USERS.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => setEmail(u.email)}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded transition ${
                    email === u.email ? 'bg-blue-600 text-white font-medium' : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Email Address</Label>
            <div className="relative">
              <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 text-xs"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Password</Label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 text-xs"
                required
              />
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-1/2 text-xs">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="w-1/2 bg-blue-700 hover:bg-blue-800 text-xs">
              {loading ? 'Verifying...' : 'Sign In'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
