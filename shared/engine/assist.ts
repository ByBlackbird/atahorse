// Şablon asistan: AI sağlayıcı yokken veya çağrı başarısız olduğunda aynı sözleşmeyle (AssistResult)
// yanıt üretir. Kaynak her zaman kursun kendi içeriğidir — uydurma bilgi eklenmez.
import type { AssistResult, CourseDoc, Locale, MethodKey, MindNode, Module, Section } from '../types';
import { METHODS } from './methods';
import { buildSlides } from './generate';

const T: Record<Locale, {
  explain: string; summarize: string; diagram: string; reteach: (m: string) => string; slides: string;
  example: string; precise: string; takeaway: string; misconception: string; selfCheck: string; whyQ: string; howQ: string;
  steps: string; recap: string; deck: (n: number) => string;
  suggest: string[];
}> = {
  tr: {
    explain: 'Farklı bir açıdan', summarize: 'Hızlı özet', diagram: 'Kavram şeması', reteach: (m) => `${m} ile yeniden`, slides: 'Sunum destesi',
    example: 'Günlük bir örnekle başlayalım:', precise: 'Şimdi kesin ifadesi:', takeaway: 'Aklında kalsın:',
    misconception: 'En sık karışıklık: bu kavramı tek bir örnekle sınırlı sanmak.', selfCheck: 'Kendine sor:',
    whyQ: 'Bu neden böyle çalışıyor?', howQ: 'Bunu başka bir durumda nasıl kullanırdın?',
    steps: 'Adım adım:', recap: 'Özetle:', deck: (n) => `${n} slaytlık deste hazır — slayt modunda aç.`,
    suggest: ['Gerçek hayat örneği', 'Neden önemli?', 'Sık yapılan hata', 'Nasıl ölçülür?', 'Benzer kavram', 'Karşı örnek'],
  },
  en: {
    explain: 'From a different angle', summarize: 'Quick summary', diagram: 'Concept diagram', reteach: (m) => `Again, with ${m}`, slides: 'Slide deck',
    example: 'Let’s start with an everyday example:', precise: 'Now the precise version:', takeaway: 'Keep in mind:',
    misconception: 'Most common confusion: thinking the concept is limited to a single example.', selfCheck: 'Ask yourself:',
    whyQ: 'Why does it work this way?', howQ: 'How would you use this in another situation?',
    steps: 'Step by step:', recap: 'In short:', deck: (n) => `A ${n}-slide deck is ready — open it in slide mode.`,
    suggest: ['Real-life example', 'Why it matters', 'Common mistake', 'How it is measured', 'Related concept', 'Counter-example'],
  },
  ru: {
    explain: 'С другой стороны', summarize: 'Краткое резюме', diagram: 'Схема понятий', reteach: (m) => `Заново: ${m}`, slides: 'Презентация',
    example: 'Начнём с бытового примера:', precise: 'Теперь точная формулировка:', takeaway: 'Запомните:',
    misconception: 'Частая путаница: считать, что понятие ограничено одним примером.', selfCheck: 'Спросите себя:',
    whyQ: 'Почему это работает именно так?', howQ: 'Как бы вы применили это в другой ситуации?',
    steps: 'Шаг за шагом:', recap: 'Коротко:', deck: (n) => `Готова презентация из ${n} слайдов — откройте режим слайдов.`,
    suggest: ['Пример из жизни', 'Почему это важно', 'Частая ошибка', 'Как это измерить', 'Связанное понятие', 'Контрпример'],
  },
};

const short = (s: string, n = 4) => s.split(/[:—–(,.]/)[0].trim().split(/\s+/).slice(0, n).join(' ');

export function sectionContext(m: Module, s?: Section) {
  const secs = s ? [s] : m.sections;
  return [
    `Module: ${m.title}`,
    `Summary: ${m.summary}`,
    ...secs.map((x) => `## ${x.heading}\n${x.paragraphs.join('\n')}\nKey points: ${x.analytic.points.join('; ')}\nPicture: ${x.holistic.text}${x.example ? `\nExample: ${x.example}` : ''}`),
  ].join('\n\n').slice(0, 9000);
}

export function templateAssist(
  action: AssistResult['action'], doc: CourseDoc, m: Module, s: Section | undefined, locale: Locale, method?: MethodKey,
): AssistResult {
  const t = T[locale];
  const sec = s ?? m.sections[0];
  switch (action) {
    case 'explain':
      return {
        action, source: 'template', title: `${t.explain}: ${sec.heading}`,
        text: [t.example, sec.example ?? sec.holistic.text, '', t.precise, sec.paragraphs[0], '', t.misconception].join('\n'),
        bullets: sec.analytic.points.slice(0, 3),
      };
    case 'summarize':
      return {
        action, source: 'template', title: `${t.summarize}: ${m.title}`,
        text: `${m.summary} ${m.sections.map((x) => x.analytic.points[0]).join(' ')}`,
        bullets: m.keyPoints.slice(0, 4),
      };
    case 'diagram':
      return {
        action, source: 'template', title: `${t.diagram}: ${m.title}`,
        text: m.summary,
        tree: m.sections.slice(0, 6).map((x) => ({ label: short(x.heading, 5), children: x.analytic.points.slice(0, 4).map((p) => short(p)) })),
      };
    case 'reteach': {
      const key = method ?? doc.method;
      const md = METHODS[key];
      const parts: string[] = [];
      for (const beat of md.flow) {
        if (beat === 'hook' || beat === 'case') parts.push(sec.example ?? sec.holistic.text);
        else if (beat === 'analogy') parts.push(sec.holistic.text);
        else if (beat === 'question') parts.push(`${t.whyQ}`);
        else if (beat === 'define') parts.push(`${t.precise} ${sec.analytic.points[0]}`);
        else if (beat === 'mechanism' || beat === 'decompose') parts.push(`${t.steps} ${sec.analytic.points.map((p, i) => `${i + 1}) ${p}`).join(' ')}`);
        else if (beat === 'example' || beat === 'practice') parts.push(sec.paragraphs[1] ?? sec.paragraphs[0]);
        else if (beat === 'recall') parts.push(`${t.selfCheck} ${sec.check?.q ?? t.howQ}`);
      }
      return {
        action, source: 'template', method: key, title: t.reteach(md.name[locale]),
        text: [...new Set(parts)].join('\n\n'),
        bullets: [md.short[locale]],
      };
    }
    case 'slides': {
      const slides = buildSlides(m, doc.topic, locale, doc.profileKey);
      return { action, source: 'template', title: t.slides, text: t.deck(slides.length), slides };
    }
  }
}

/** Zihin haritası dal önerisi (şablon): önce kursta olup haritada olmayan kavramlar, sonra genel sorular. */
export function templateBranches(doc: CourseDoc, nodes: MindNode[], nodeId: string, locale: Locale): string[] {
  const have = new Set(nodes.map((n) => n.label.toLowerCase()));
  const node = nodes.find((n) => n.id === nodeId);
  const pool: string[] = [];
  const mod = node?.moduleIdx !== undefined ? doc.modules[node.moduleIdx] : undefined;
  if (mod) {
    for (const s of mod.sections) for (const p of s.analytic.points) pool.push(short(p, 5));
    for (const k of mod.keyPoints) pool.push(short(k, 5));
  } else {
    for (const g of doc.glossary) pool.push(g.term);
    for (const m of doc.modules) pool.push(short(m.title.replace(`${doc.topic}: `, ''), 5));
  }
  pool.push(...T[locale].suggest);
  const out: string[] = [];
  for (const p of pool) {
    const k = p.toLowerCase();
    if (p.length >= 2 && !have.has(k) && !out.some((o) => o.toLowerCase() === k)) out.push(p.slice(0, 60));
    if (out.length === 4) break;
  }
  return out;
}
