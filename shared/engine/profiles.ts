// 6 bilişsel profil = teslim tercihi (3) × düşünme üslubu (2).
// Tasarım ilkesi (kanıta dayalı): profil, kursun HANGİ KAPIDAN açılacağını ve metodun başlangıç
// noktasını seçer; içeriği asla tek kanala hapsetmez. Her kurs üç modu ve ikili kodlamayı
// (analitik + bütüncül kutu) herkese sunar. Bkz. science.ts → "no-meshing" ilkesi.
import type { LearnMode, Locale, MethodKey, Modality, ProfileKey, Reasoning, VisualType } from '../types';

export type L10n = Record<Locale, string>;

export interface CognitiveProfile {
  key: ProfileKey;
  modality: Modality;
  reasoning: Reasoning;
  name: L10n;
  tagline: L10n;
  entryMode: LearnMode;
  defaultMethod: MethodKey;
  /** Analitik kutu mu önce gelsin, bütüncül mü? */
  boxOrder: ['analytic', 'holistic'] | ['holistic', 'analytic'];
  visuals: VisualType[];
  /** LLM'e giden teslim yönergesi (İngilizce, model-dostu). */
  directive: string;
}

export const PROFILES: Record<ProfileKey, CognitiveProfile> = {
  'visual-analytic': {
    key: 'visual-analytic', modality: 'visual', reasoning: 'analytic',
    name: { tr: 'Analitik Zihin Mimarı', en: 'Analytic Architect', ru: 'Аналитический архитектор' },
    tagline: {
      tr: 'Önce yapıyı görür, sonra parçaları yerine oturtursun.',
      en: 'You see the structure first, then slot the parts in.',
      ru: 'Сначала видите структуру, затем расставляете детали.',
    },
    entryMode: 'slides', defaultMethod: 'first_principles',
    boxOrder: ['analytic', 'holistic'], visuals: ['flow', 'pyramid', 'bars'],
    directive: 'Lead with structure: hierarchies, cause→effect chains, step lists and comparison tables. Every section must name the underlying mechanism before examples.',
  },
  'visual-holistic': {
    key: 'visual-holistic', modality: 'visual', reasoning: 'holistic',
    name: { tr: 'Görsel Hikâye Anlatıcısı', en: 'Visual Storyteller', ru: 'Визуальный рассказчик' },
    tagline: {
      tr: 'Büyük resmi bir sahne gibi kurar, ayrıntıyı oraya asarsın.',
      en: 'You build the big picture like a scene, then hang details on it.',
      ru: 'Вы строите общую картину как сцену и вешаете на неё детали.',
    },
    entryMode: 'slides', defaultMethod: 'case_study',
    boxOrder: ['holistic', 'analytic'], visuals: ['orbit', 'network', 'cycle'],
    directive: 'Open each section with a vivid spatial metaphor or scene, then map it precisely to the formal concept. Prefer diagrams described in words that a learner could sketch.',
  },
  'auditory-analytic': {
    key: 'auditory-analytic', modality: 'auditory', reasoning: 'analytic',
    name: { tr: 'Sistematik Dinleyici', en: 'Systematic Listener', ru: 'Системный слушатель' },
    tagline: {
      tr: 'Soru-cevap ritmiyle, adım adım ikna olarak öğrenirsin.',
      en: 'You learn through a question-and-answer rhythm, convinced step by step.',
      ru: 'Вы учитесь в ритме вопрос-ответ, шаг за шагом.',
    },
    entryMode: 'podcast', defaultMethod: 'socratic',
    boxOrder: ['analytic', 'holistic'], visuals: ['pyramid', 'flow', 'bars'],
    directive: 'Write in a lecture rhythm suitable for listening: pose a precise question, answer it in short sentences, signal transitions explicitly ("first", "therefore").',
  },
  'auditory-holistic': {
    key: 'auditory-holistic', modality: 'auditory', reasoning: 'holistic',
    name: { tr: 'Sezgisel Dinleyici', en: 'Intuitive Listener', ru: 'Интуитивный слушатель' },
    tagline: {
      tr: 'Sohbet eder gibi, benzetmelerle kavrarsın.',
      en: 'You grasp ideas conversationally, through analogies.',
      ru: 'Вы понимаете через беседу и аналогии.',
    },
    entryMode: 'podcast', defaultMethod: 'feynman',
    boxOrder: ['holistic', 'analytic'], visuals: ['cycle', 'orbit', 'network'],
    directive: 'Explain like a smart friend talking: plain words, one everyday analogy per concept, then a one-line precise definition. Sentences must read well aloud.',
  },
  'kinesthetic-analytic': {
    key: 'kinesthetic-analytic', modality: 'kinesthetic', reasoning: 'analytic',
    name: { tr: 'Uygulayıcı Mühendis', en: 'Hands-on Engineer', ru: 'Инженер-практик' },
    tagline: {
      tr: 'Yaparak, deneyerek ve ölçerek öğrenirsin.',
      en: 'You learn by doing, testing and measuring.',
      ru: 'Вы учитесь, делая, проверяя и измеряя.',
    },
    entryMode: 'read', defaultMethod: 'retrieval',
    boxOrder: ['analytic', 'holistic'], visuals: ['bars', 'flow', 'pyramid'],
    directive: 'Keep theory minimal and immediately actionable. Each section: worked example first, then a faded practice step the learner completes. Use numbered procedures.',
  },
  'kinesthetic-holistic': {
    key: 'kinesthetic-holistic', modality: 'kinesthetic', reasoning: 'holistic',
    name: { tr: 'Deneyimsel Kâşif', en: 'Experiential Explorer', ru: 'Исследователь-практик' },
    tagline: {
      tr: 'Senaryonun içine girer, keşfederek öğrenirsin.',
      en: 'You step into the scenario and learn by exploring.',
      ru: 'Вы входите в сценарий и учитесь через открытие.',
    },
    entryMode: 'read', defaultMethod: 'case_study',
    boxOrder: ['holistic', 'analytic'], visuals: ['network', 'cycle', 'orbit'],
    directive: 'Place the learner inside a realistic scenario with a decision to make. Let concepts emerge from consequences, then name them formally.',
  },
};

export const DEFAULT_PROFILE: ProfileKey = 'visual-analytic';

export const profileOf = (modality: Modality, reasoning: Reasoning): ProfileKey =>
  `${modality}-${reasoning}` as ProfileKey;

export interface ProfileAnswer { axis: 'modality' | 'reasoning'; value: Modality | Reasoning }

/** Test puanlama: her eksende çoğunluk; beraberlikte ilk tercih edilen değer. */
export function scoreProfile(answers: ProfileAnswer[]) {
  const m: Record<Modality, number> = { visual: 0, auditory: 0, kinesthetic: 0 };
  const r: Record<Reasoning, number> = { analytic: 0, holistic: 0 };
  for (const a of answers) {
    if (a.axis === 'modality') m[a.value as Modality]++;
    else r[a.value as Reasoning]++;
  }
  const modTotal = Object.values(m).reduce((s, v) => s + v, 0) || 1;
  const resTotal = r.analytic + r.holistic || 1;
  const modality = (Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]) as Modality;
  const reasoning: Reasoning = r.analytic >= r.holistic ? 'analytic' : 'holistic';
  return {
    modality,
    reasoning,
    key: profileOf(modality, reasoning),
    scores: {
      visual: Math.round((m.visual / modTotal) * 100),
      auditory: Math.round((m.auditory / modTotal) * 100),
      kinesthetic: Math.round((m.kinesthetic / modTotal) * 100),
      analytic: Math.round((r.analytic / resTotal) * 100),
      holistic: Math.round((r.holistic / resTotal) * 100),
    },
  };
}

export interface ProfileQuestion {
  id: string;
  axis: 'modality' | 'reasoning';
  q: L10n;
  options: { value: Modality | Reasoning; label: L10n }[];
}

export const PROFILE_TEST: ProfileQuestion[] = [
  { id: 'm1', axis: 'modality', q: { tr: 'Yeni bir konuya başlarken ilk neye uzanırsın?', en: 'Starting a new topic, what do you reach for first?', ru: 'Начиная новую тему, к чему вы тянетесь первым делом?' }, options: [
    { value: 'visual', label: { tr: 'Bir şema, harita ya da görsel özet', en: 'A diagram, map or visual summary', ru: 'Схема, карта или визуальный обзор' } },
    { value: 'auditory', label: { tr: 'Birinin anlatımı ya da bir podcast', en: 'Someone explaining it, or a podcast', ru: 'Чьё-то объяснение или подкаст' } },
    { value: 'kinesthetic', label: { tr: 'Hemen deneyebileceğim küçük bir görev', en: 'A small task I can try right away', ru: 'Небольшое задание, которое можно сразу попробовать' } },
  ] },
  { id: 'm2', axis: 'modality', q: { tr: 'Bir şeyi hatırlamaya çalışırken zihnine ne gelir?', en: 'When recalling something, what comes to mind?', ru: 'Что приходит на ум, когда вы что-то вспоминаете?' }, options: [
    { value: 'visual', label: { tr: 'Sayfadaki yeri, rengi, düzeni', en: 'Where it was on the page, its layout', ru: 'Место на странице, расположение' } },
    { value: 'auditory', label: { tr: 'Duyduğum cümle, ses tonu', en: 'The sentence I heard, the tone', ru: 'Услышанная фраза, интонация' } },
    { value: 'kinesthetic', label: { tr: 'Onu yaptığım an', en: 'The moment I did it', ru: 'Момент, когда я это делал(а)' } },
  ] },
  { id: 'm3', axis: 'modality', q: { tr: 'Boş 20 dakikan var; nasıl çalışmak istersin?', en: 'You have 20 free minutes; how would you study?', ru: 'У вас 20 свободных минут; как будете учиться?' }, options: [
    { value: 'visual', label: { tr: 'Slaytlara ve grafiklere göz atarak', en: 'Skimming slides and charts', ru: 'Просматривая слайды и графики' } },
    { value: 'auditory', label: { tr: 'Yürürken dinleyerek', en: 'Listening while walking', ru: 'Слушая на прогулке' } },
    { value: 'kinesthetic', label: { tr: 'Soru çözerek, not alarak', en: 'Solving problems, taking notes', ru: 'Решая задачи и делая заметки' } },
  ] },
  { id: 'm4', axis: 'modality', q: { tr: 'Bir yol tarifini nasıl almayı seversin?', en: 'How do you prefer to get directions?', ru: 'Как вы предпочитаете получать маршрут?' }, options: [
    { value: 'visual', label: { tr: 'Haritadan bakarak', en: 'Looking at a map', ru: 'По карте' } },
    { value: 'auditory', label: { tr: 'Sözlü, adım adım', en: 'Spoken, step by step', ru: 'Устно, шаг за шагом' } },
    { value: 'kinesthetic', label: { tr: 'Bir kez gidip yolu yaşayarak', en: 'Walking it once myself', ru: 'Пройдя путь один раз' } },
  ] },
  { id: 'm5', axis: 'modality', q: { tr: 'Bir konuyu başkasına nasıl anlatırsın?', en: 'How do you explain a topic to someone?', ru: 'Как вы объясняете тему другому?' }, options: [
    { value: 'visual', label: { tr: 'Kâğıda çizerek', en: 'Sketching it on paper', ru: 'Рисую на бумаге' } },
    { value: 'auditory', label: { tr: 'Konuşarak, örnek vererek', en: 'Talking it through with examples', ru: 'Рассказываю с примерами' } },
    { value: 'kinesthetic', label: { tr: 'Birlikte yaparak göstererek', en: 'Showing by doing it together', ru: 'Показываю, делая вместе' } },
  ] },
  { id: 'm6', axis: 'modality', q: { tr: 'Sıkıldığında dikkatini en hızlı ne geri getirir?', en: 'When bored, what brings your focus back fastest?', ru: 'Что быстрее всего возвращает внимание?' }, options: [
    { value: 'visual', label: { tr: 'Yeni bir görsel, renk, hareket', en: 'A new visual, color or motion', ru: 'Новая картинка, цвет, движение' } },
    { value: 'auditory', label: { tr: 'Değişen bir ses, bir soru', en: 'A change in voice, a question', ru: 'Смена голоса, вопрос' } },
    { value: 'kinesthetic', label: { tr: 'Ayağa kalkıp bir şey yapmak', en: 'Getting up and doing something', ru: 'Встать и что-то сделать' } },
  ] },
  { id: 'r1', axis: 'reasoning', q: { tr: 'Yeni bir sisteme bakınca önce…', en: 'Looking at a new system, you first…', ru: 'Глядя на новую систему, вы сначала…' }, options: [
    { value: 'analytic', label: { tr: 'Parçalarını ve kurallarını çıkarırım', en: 'Break it into parts and rules', ru: 'Разбираю на части и правила' } },
    { value: 'holistic', label: { tr: 'Bütünün ne işe yaradığını sezerim', en: 'Sense what the whole is for', ru: 'Чувствую, для чего целое' } },
  ] },
  { id: 'r2', axis: 'reasoning', q: { tr: 'İkna olman için hangisi gerekir?', en: 'What convinces you?', ru: 'Что вас убеждает?' }, options: [
    { value: 'analytic', label: { tr: 'Adım adım kanıt', en: 'Step-by-step evidence', ru: 'Пошаговые доказательства' } },
    { value: 'holistic', label: { tr: 'Taşları yerine oturtan bir hikâye', en: 'A story that makes it click', ru: 'История, где всё сходится' } },
  ] },
  { id: 'r3', axis: 'reasoning', q: { tr: 'Not alırken…', en: 'When taking notes…', ru: 'Когда конспектируете…' }, options: [
    { value: 'analytic', label: { tr: 'Başlık, alt başlık, numaralı liste', en: 'Headings, sub-points, numbered lists', ru: 'Заголовки, пункты, нумерация' } },
    { value: 'holistic', label: { tr: 'Oklar, kümeler, serbest bağlantılar', en: 'Arrows, clusters, free links', ru: 'Стрелки, кластеры, связи' } },
  ] },
  { id: 'r4', axis: 'reasoning', q: { tr: 'Bir problemde takılınca…', en: 'When stuck on a problem…', ru: 'Застряв на задаче…' }, options: [
    { value: 'analytic', label: { tr: 'Varsayımlarımı tek tek kontrol ederim', en: 'Check my assumptions one by one', ru: 'Проверяю допущения по одному' } },
    { value: 'holistic', label: { tr: 'Uzaklaşıp benzer bir duruma bakarım', en: 'Step back and look at a similar case', ru: 'Отступаю и ищу похожий случай' } },
  ] },
  { id: 'r5', axis: 'reasoning', q: { tr: 'Bir kitabı hangi sırayla okursun?', en: 'How do you read a book?', ru: 'Как вы читаете книгу?' }, options: [
    { value: 'analytic', label: { tr: 'Baştan sona, sırasıyla', en: 'Front to back, in order', ru: 'По порядку, от начала до конца' } },
    { value: 'holistic', label: { tr: 'Önce göz gezdirir, ilgimi çekene dalarım', en: 'Skim first, dive into what grabs me', ru: 'Сначала пролистываю, потом ныряю' } },
  ] },
  { id: 'r6', axis: 'reasoning', q: { tr: 'Hangi cümle sana daha yakın?', en: 'Which sentence fits you better?', ru: 'Какая фраза вам ближе?' }, options: [
    { value: 'analytic', label: { tr: '“Önce tanımı netleştirelim.”', en: '“Let’s pin down the definition first.”', ru: '«Сначала уточним определение.»' } },
    { value: 'holistic', label: { tr: '“Önce neden önemli olduğunu görelim.”', en: '“Let’s first see why it matters.”', ru: '«Сначала поймём, почему это важно.»' } },
  ] },
];
