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

  const toggleMode = () => {
    setIsRegisterMode((prev) => !prev);
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-