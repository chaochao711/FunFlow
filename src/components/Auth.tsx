// src/components/Auth.tsx
import { useState } from 'react';
import { supabase } from '../services/supabase';
import { Mail, Lock, LogIn, UserPlus, CheckCircle, AlertCircle } from 'lucide-react';

export default function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    let result;
    if (isLogin) {
      result = await supabase.auth.signInWithPassword({ email, password });
      if (!result.error) {
        onAuthSuccess();
      }
    } else {
      result = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            created_at: new Date().toISOString(),
          }
        }
      });
      
      if (!result.error) {
        setSuccess('注册成功！正在跳转登录...');
        setTimeout(() => {
          setIsLogin(true);
          setSuccess('');
          setPassword('');
        }, 2000);
      }
    }

    if (result.error) {
      setError(result.error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 w-full max-w-md shadow-xl border border-zinc-200 dark:border-zinc-800">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 animate-bounce">🐟</div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">FunFlow</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">快乐生产力工具</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1 text-sm text-zinc-600 dark:text-zinc-400">
              <Mail size={16} /> 邮箱
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
              required
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1 text-sm text-zinc-600 dark:text-zinc-400">
              <Lock size={16} /> 密码
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6位"
              className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-sm flex items-center gap-2">
              <CheckCircle size={16} />
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                {isLogin ? '登录' : '注册'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setSuccess('');
            }}
            className="w-full text-center text-sm text-violet-600 dark:text-violet-400 hover:underline transition-all"
          >
            {isLogin ? '没有账号？立即注册' : '已有账号？去登录'}
          </button>
        </form>

        {/* 演示账号提示 */}
        <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-center">
          <p className="text-xs text-zinc-400">演示账号：demo@example.com / 123456</p>
        </div>
      </div>
    </div>
  );
}