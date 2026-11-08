// Başlık biçimi (Title Case) — kullanıcı girdisi ve başlıklar kaydedilirken uygulanır.
// Kurallar: dile duyarlı büyük harf (Türkçe i → İ, ı → I); kısaltmalar ve iç büyük harfli adlar korunur
// (DNA, iPhone, McLaren, COVID-19); bağlaç/edat küçük kalır (ilk ve son kelime hariç); tire ve kesme işaretinden
// sonraki ek küçük kalır (Atatürk'ün), tireli bileşikte her parça büyür (Orta-Doğu). Yalnız boşlukları sadeleştirir.
import type { Locale } from '../types';

const SMALL: Record<Locale, Set<string>> = {
  tr: new Set(['ve', 'ile', 'veya', 'ya', 'da', 'de', 'ki', 'mi', 'mı', 'mu', 'mü', 'için', 'gibi', 'ama', 'fakat', 'hem', 'ne']),
  en: new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'of', 'in', 'on', 'at', 'to', 'by', 'up', 'as', 'via', 'vs', 'per', 'from', 'with', 'into', 'over']),
  ru: new Set(['и', 'в', 'во', 'на', 'с', 'со', 'к', 'ко', 'по', 'о', 'об', 'от', 'до', 'из', 'за', 'для', 'или', 'а', 'но', 'же', 'ли']),
};
const BCP: Record<Locale, string> = { tr: 'tr-TR', en: 'en-US', ru: 'ru-RU' };

/** Kelime "kendi biçimini taşıyor" mu: kısaltma, iç büyük harf ya da rakam/URL içeriyor. */
const keepsShape = (w: string) => /\d|[@/\\.]\w/.test(w) || /^\p{Lu}{2,}/u.test(w) || /\p{Ll}\p{Lu}/u.test(w);

function capWord(word: string, loc: string): string {
  // baştaki noktalama (“, (, « …) korunur
  const m = /^([^\p{L}\p{N}]*)(.*)$/u.exec(word)!;
  const [, lead, core] = m;
  if (!core) return word;
  return lead + core
    .split('-')
    .map((part) => {
      if (!part || keepsShape(part)) return part;
      const apo = part.search(/['’]/);
      const head = apo > 0 ? part.slice(0, apo) : part;
      const tail = apo > 0 ? part.slice(apo) : '';
      return head.charAt(0).toLocaleUpperCase(loc) + head.slice(1).toLocaleLowerCase(loc) + tail.toLocaleLowerCase(loc);
    })
    .join('-');
}

export function titleCase(input: string, locale: Locale = 'tr'): string {
  const loc = BCP[locale];
  const words = input.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!words.length) return '';
  const small = SMALL[locale];
  return words
    .map((w, i) => {
      const bare = w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLocaleLowerCase(loc);
      const afterColon = i > 0 && /[:.!?–—]$/.test(words[i - 1]);
      if (i > 0 && i < words.length - 1 && !afterColon && small.has(bare) && !keepsShape(w)) return w.toLocaleLowerCase(loc);
      return capWord(w, loc);
    })
    .join(' ');
}

/** Kurs belgesinin başlık alanları (kurs, modül, bölüm, görev) — içerik metinlerine dokunmaz. */
export function titleDoc<T extends { title: string; locale: Locale; modules: { title: string; sections: { heading: string }[]; task: { title: string } }[] }>(doc: T): T {
  const L = doc.locale;
  return {
    ...doc,
    title: titleCase(doc.title, L),
    modules: doc.modules.map((m) => ({
      ...m,
      title: titleCase(m.title, L),
      sections: m.sections.map((s) => ({ ...s, heading: titleCase(s.heading, L) })),
      task: { ...m.task, title: titleCase(m.task.title, L) },
    })),
  };
}
