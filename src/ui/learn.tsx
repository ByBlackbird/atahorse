// Öğrenme yüzeyinin ortak parçaları (v4): seri, günlük hedef, seviye.
// Yormayan oyunlaştırma: can/ceza yok; hedefi kullanıcı seçer (10–50 XP); kaçırılan gün suçlamaz, davet eder.
import { useState } from 'react';
import { LuFlame, LuTarget, LuCheck, LuZap, LuPencil, LuLock, LuStar, LuChevronRight } from 'react-icons/lu';
import type { ReactNode } from 'react';
import { trpc } from '../lib/trpc';
import { useI18n } from '../i18n/index';
import { Bar, Ring, cx } from './kit';

const todayKey = () => new Date().toISOString().slice(0, 10);

export function StreakCard({ streak, longest, days }: { streak: number; longest: number; days: { day: string; xp: number }[] }) {
  const { t } = useI18n();
  const week = days.slice(-7);
  const today = todayKey();
  const didToday = (week.find((d) => d.day === today)?.xp ?? 0) > 0;
  return (
    <section className="card p-5" aria-label={t('streak_n', { n: streak })}>
      <div className="flex items-center gap-3">
        <span className={cx('grid h-12 w-12 place-items-center rounded-2xl text-2xl', streak ? 'bg-gold-soft text-gold' : 'bg-surface-2 text-ink-3')}><LuFlame aria-hidden /></span>
        <div>
          <p className="text-2xl font-extrabold tabular-nums tracking-tight">{streak} <span className="text-base font-bold text-ink-2">{t('v4_days')}</span></p>
          <p className="text-xs font-semibold text-ink-3">{didToday ? t('v4_streak_safe') : t('v4_streak_invite')}</p>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1.5">
        {week.map((d) => {
          const on = d.xp > 0;
          const wd = new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
          return (
            <li key={d.day} className="flex flex-col items-center gap-1">
              <span className={cx('text-[11px] font-bold', d.day === today ? 'text-ink' : 'text-ink-3')}>{wd}</span>
              <span className={cx('grid h-8 w-8 place-items-center rounded-full text-sm', on ? 'bg-gold text-on-gold' : 'border-2 border-line bg-surface-2 text-ink-3', d.day === today && !on && 'border-gold')}>
                {on ? <LuCheck aria-hidden /> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {longest > streak && <p className="mt-3 text-xs text-ink-3">{t('v4_longest', { n: longest })}</p>}
    </section>
  );
}

const GOALS = [10, 20, 30, 50] as const;
export function DailyGoalCard({ goal, days }: { goal: number; days: { day: string; xp: number }[] }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [edit, setEdit] = useState(false);
  const set = trpc.profile.settings.useMutation({ onSuccess: () => { void utils.profile.dashboard.invalidate(); setEdit(false); } });
  const xp = days.find((d) => d.day === todayKey())?.xp ?? 0;
  const done = xp >= goal;
  return (
    <section className="card p-5" aria-label={t('v4_goal')}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-extrabold tracking-tight"><LuTarget className="text-accent" aria-hidden /> {t('v4_goal')}</h2>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEdit((e) => !e)} aria-label={t('v4_goal_edit')} aria-expanded={edit}><LuPencil /></button>
      </div>
      {edit ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {GOALS.map((g) => (
            <button key={g} className={cx('btn btn-sm', g === goal ? 'btn-accent' : 'btn-outline')} disabled={set.isPending} onClick={() => set.mutate({ dailyGoal: g })}>
              {g} XP <span className="text-xs font-semibold opacity-80">· {t(`v4_goal_${g}`)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-4">
          <Ring value={xp / goal} size={64} stroke={8} color={done ? 'var(--c-gold)' : 'var(--c-accent)'}>
            {done ? <LuCheck className="text-xl text-gold" aria-hidden /> : <LuZap className="text-xl text-accent" aria-hidden />}
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold tabular-nums">{Math.min(xp, goal)} / {goal} XP</p>
            <Bar value={xp / goal} className="mt-2" color={done ? 'bg-gold' : 'bg-accent'} />
            <p className="mt-2 text-xs text-ink-3">{done ? t('v4_goal_done') : t('v4_goal_left', { n: goal - xp })}</p>
          </div>
        </div>
      )}
    </section>
  );
}

export type LessonState = 'done' | 'current' | 'open' | 'locked';

/**
 * Kurs içeriği satırı (v5): dairesel patika düğümleri yerine düz müfredat listesi.
 * Neden: durum (tamam/şimdi/açık/kilitli) satırın solunda, başlık ve süre ortada, eylem sağda —
 * oyun haritası değil, okunur bir içindekiler. Tek dokunuş hedefi tüm satırdır (≥56px).
 */
export function LessonRow({ n, title, meta, state, quiz, onOpen, action }: {
  n: number; title: string; meta?: string; state: LessonState; quiz?: boolean; onOpen?: () => void; action?: ReactNode;
}) {
  const { t } = useI18n();
  const Lead = state === 'done' ? <LuCheck aria-hidden /> : state === 'locked' ? <LuLock aria-hidden /> : quiz ? <LuStar aria-hidden /> : <span>{n}</span>;
  const body = (
    <>
      <span className="lesson-lead" aria-hidden>{Lead}</span>
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate font-semibold', state === 'locked' && 'text-ink-3')}>{title}</span>
        {meta && <span className="block text-xs text-ink-3">{meta}</span>}
      </span>
      {action ?? (state === 'current'
        ? <span className="btn btn-sm btn-pink pointer-events-none shrink-0">{quiz ? t('v4_quiz_go') : t('v4_start')}</span>
        : state === 'done' ? <span className="shrink-0 text-xs font-semibold text-ink-3">{t('v4_done')}</span>
        : state === 'open' ? <LuChevronRight className="shrink-0 text-ink-3" aria-hidden /> : null)}
    </>
  );
  const label = `${title}${state === 'locked' ? ` — ${t('v4_locked')}` : state === 'done' ? ` — ${t('v4_done')}` : ''}`;
  return (
    <li>
      {onOpen
        ? <button type="button" className="lesson-row" data-state={state} onClick={onOpen} aria-label={label} aria-current={state === 'current' ? 'step' : undefined}>{body}</button>
        : <div className="lesson-row" data-state={state}>{body}</div>}
    </li>
  );
}
