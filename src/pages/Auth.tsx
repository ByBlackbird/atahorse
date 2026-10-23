import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useRouter } from '../lib/router';
import { trpc, errCode } from '../lib/trpc';
import { useErr, useI18n } from '../i18n/index';
import { ErrorBox, Field, Logo, Spinner } from '../ui/kit';
import { LangSelect, ThemeToggle } from '../app/Shell';

function Frame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="dotgrid grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/"><Logo className="h-7" /></Link>
          <div className="flex items-center gap-1"><LangSelect compact /><ThemeToggle /></div>
        </div>
        <div className="card anim-rise p-6 md:p-8">
          <h1 className="h-display text-2xl">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-2">{sub}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

export function Login() {
  const { t } = useI18n();
  const err = useErr();
  const navigate = useNavigate();
  const { search } = useRouter();
  const utils = trpc.useUtils();
  const [identifier, setId] = useState('');
  const [password, setPw] = useState('');
  const login = trpc.auth.login.useMutation({
    onSuccess: async (u) => {
      utils.auth.me.setData(undefined, u);
      navigate(safeNext(search.get('next')) ?? (u.onboardedAt ? '/panel' : '/profil-testi'), { replace: true });
    },
  });
  const submit = (e: FormEvent) => { e.preventDefault(); login.mutate({ identifier, password }); };
  return (
    <Frame title={t('a_login_t')} sub={t('a_login_s')}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('a_identifier')}><input className="input" autoComplete="username" value={identifier} onChange={(e) => setId(e.target.value)} required /></Field>
        <Field label={t('a_password')}><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPw(e.target.value)} required /></Field>
        {login.error && <ErrorBox>{err(errCode(login.error))}</ErrorBox>}
        <button className="btn btn-primary btn-lg w-full" disabled={login.isPending || !identifier || !password}>
          {login.isPending ? <Spinner className="h-4 w-4" /> : t('a_login_btn')}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">{t('a_no_account')} <Link to="/kayit" className="font-semibold text-brand hover:underline">{t('a_register_btn')}</Link></p>
    </Frame>
  );
}

export function Register() {
  const { t, lang } = useI18n();
  const err = useErr();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [f, setF] = useState({ fullName: '', username: '', email: '', password: '' });
  const reg = trpc.auth.register.useMutation({
    onSuccess: (u) => { utils.auth.me.setData(undefined, u); navigate('/profil-testi', { replace: true }); },
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const valid = /^[a-zA-Z0-9_]{3,24}$/.test(f.username) && /^\S+@\S+\.\S+$/.test(f.email) && f.password.length >= 8;
  return (
    <Frame title={t('a_register_t')} sub={t('a_register_s')}>
      <form onSubmit={(e) => { e.preventDefault(); reg.mutate({ ...f, locale: lang }); }} className="space-y-4" noValidate>
        <Field label={t('a_fullname')}><input className="input" autoComplete="name" value={f.fullName} onChange={set('fullName')} /></Field>
        <Field label={t('a_username')} hint={t('a_username_h')}><input className="input" autoComplete="username" value={f.username} onChange={set('username')} required /></Field>
        <Field label={t('a_email')}><input className="input" type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></Field>
        <Field label={t('a_password')} hint={t('a_password_h')}><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required /></Field>
        {reg.error && <ErrorBox>{err(errCode(reg.error))}</ErrorBox>}
        <button className="btn btn-primary btn-lg w-full" disabled={reg.isPending || !valid}>
          {reg.isPending ? <Spinner className="h-4 w-4" /> : t('a_register_btn')}
        </button>
        <p className="text-xs leading-relaxed text-ink-3">{t('a_terms')}</p>
      </form>
      <p className="mt-6 text-center text-sm text-ink-2">{t('a_have_account')} <Link to="/giris" className="font-semibold text-brand hover:underline">{t('a_login_btn')}</Link></p>
    </Frame>
  );
}
