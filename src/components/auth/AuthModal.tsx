import React, { useState } from 'react';
import { UserCheck, Lock, User, ArrowRight, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { UserSession, AuthUser } from '../../types/diet';
import { registerUserLocal, loginUserLocal, syncAuthToGoogleSheet } from '../../services/storageService';

interface AuthModalProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLoginSuccess }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedId = userId.trim();
    const trimmedPw = password.trim();
    const trimmedName = userName.trim();

    if (!trimmedId) {
      setErrorMessage('아이디를 입력해 주세요.');
      return;
    }
    if (!trimmedPw) {
      setErrorMessage('비밀번호를 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegisterMode) {
        if (!trimmedName) {
          setErrorMessage('이름(닉네임)을 입력해 주세요.');
          setIsSubmitting(false);
          return;
        }

        const regRes = registerUserLocal({
          userId: trimmedId,
          password: trimmedPw,
          userName: trimmedName,
        });

        if (!regRes.success) {
          setErrorMessage(regRes.message || '회원가입에 실패했습니다.');
          setIsSubmitting(false);
          return;
        }

        // 구글 시트 Users 탭 백그라운드 동기화
        syncAuthToGoogleSheet('register', {
          userId: trimmedId,
          password: trimmedPw,
          userName: trimmedName,
        });

        const session: UserSession = {
          userId: trimmedId,
          userName: trimmedName,
        };
        onLoginSuccess(session);
      } else {
        const loginRes = loginUserLocal(trimmedId, trimmedPw);
        if (!loginRes.success || !loginRes.user) {
          setErrorMessage(loginRes.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
          setIsSubmitting(false);
          return;
        }

        // 구글 시트 로그인 기록 백그라운드 동기화
        syncAuthToGoogleSheet('login', {
          userId: trimmedId,
          userName: loginRes.user.userName,
        });

        const session: UserSession = {
          userId: loginRes.user.userId,
          userName: loginRes.user.userName,
        };
        onLoginSuccess(session);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || '처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
          {isRegisterMode ? <UserPlus className="w-7 h-7" /> : <UserCheck className="w-7 h-7" />}
        </div>

        <h1 className="text-xl font-extrabold text-slate-800 mb-1">
          {isRegisterMode ? '민다이어트 계정 등록' : '민다이어트 로그인'}
        </h1>
        <p className="text-xs text-slate-400 mb-5">
          {isRegisterMode
            ? '나만의 계정으로 식단과 건강 데이터를 안전하게 분리 보관하세요'
            : '아이디와 비밀번호를 입력해 나만의 기록을 불러오세요'}
        </p>

        {errorMessage && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs flex items-center gap-1.5 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5 text-left">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">아이디</label>
            <div className="relative">
              <input
                type="text"
                placeholder="아이디 입력"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">비밀번호</label>
            <div className="relative">
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold"
                required
              />
            </div>
          </div>

          {isRegisterMode && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">이름(닉네임)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="예: 신민수"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-semibold"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white rounded-xl text-xs font