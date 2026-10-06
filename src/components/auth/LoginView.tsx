import React, { useState } from 'react';
import { UserCheck } from 'lucide-react';
import { UserSession } from '../../types/diet';

interface LoginViewProps {
  onLogin: (session: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const session: UserSession = {
      userId: encodeURIComponent(name.trim()),
      userName: name.trim(),
    };
    localStorage.setItem('min_diet_session', JSON.stringify(session));
    onLogin(session);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
        <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <UserCheck className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-800 mb-1">민다이어트</h1>
        <p className="text-xs text-slate-400 mb-6">사용자 이름을 입력하여 시작하세요</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="이름 (예: 신민수)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-center"
            autoFocus
          />
          <button
            type="submit"
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition-all shadow-sm"
          >
            시작하기
          </button>
        </form>
      </div>
    </div>
  );
};