// MEB Modu — 5-12. sınıf × 6 temel ders × ünite kataloğu.
// Kaynak: MEB öğretim programları (2018 programları; Türkiye Yüzyılı Maarif Modeli 2024-2025'ten
// itibaren kademeli geçiş). Yayın öncesi ünite adları güncel programla doğrulanmalıdır —
// katalog bu yüzden tek dosyada, veri olarak tutulur.
export const MEB_GRADES = ['5', '6', '7', '8', '9', '10', '11', '12'] as const;
export type MebGrade = (typeof MEB_GRADES)[number];

export interface MebSubject {
  key: string;
  /** Sınıfa göre ders adı (ör. 9-12'de Türk Dili ve Edebiyatı). */
  name: (g: MebGrade) => string;
  units: Partial<Record<MebGrade, string[]>>;
}

const SOSYAL_ALANLAR = ['Birey ve Toplum', 'Kültür ve Miras', 'İnsanlar, Yerler ve Çevreler', 'Bilim, Teknoloji ve Toplum', 'Üretim, Dağıtım ve Tüketim', 'Etkin Vatandaşlık', 'Küresel Bağlantılar'];
const TURKCE_BECERI = ['Sözcükte Anlam', 'Cümlede Anlam', 'Paragrafta Anlam', 'Sözcük Türleri', 'Yazım Kuralları ve Noktalama', 'Metin Türleri ve Söz Sanatları'];

export const MEB_SUBJECTS: MebSubject[] = [
  {
    key: 'matematik',
    name: () => 'Matematik',
    units: {
      '5': ['Doğal Sayılar ve İşlemler', 'Kesirler ve Kesirlerle İşlemler', 'Ondalık Gösterim', 'Yüzdeler', 'Temel Geometrik Kavramlar', 'Üçgenler ve Dörtgenler', 'Veri Toplama ve Değerlendirme', 'Uzunluk, Zaman ve Alan Ölçme'],
      '6': ['Doğal Sayılarla İşlemler', 'Çarpanlar ve Katlar', 'Kümeler', 'Tam Sayılar', 'Kesirlerle ve Ondalık Gösterimle İşlemler', 'Oran', 'Cebirsel İfadeler', 'Açılar, Alan ve Çember'],
      '7': ['Tam Sayılarla İşlemler', 'Rasyonel Sayılar ve İşlemler', 'Cebirsel İfadeler', 'Eşitlik ve Denklem', 'Oran ve Orantı', 'Yüzdeler', 'Doğrular, Açılar ve Çokgenler', 'Çember, Daire ve Veri Analizi'],
      '8': ['Çarpanlar ve Katlar', 'Üslü İfadeler', 'Kareköklü İfadeler', 'Veri Analizi', 'Basit Olayların Olma Olasılığı', 'Cebirsel İfadeler ve Özdeşlikler', 'Doğrusal Denklemler', 'Eşitsizlikler', 'Üçgenler, Eşlik ve Benzerlik', 'Dönüşüm Geometrisi ve Geometrik Cisimler'],
      '9': ['Mantık', 'Kümeler', 'Denklemler ve Eşitsizlikler', 'Üçgenler', 'Veri'],
      '10': ['Sayma ve Olasılık', 'Fonksiyonlar', 'Polinomlar', 'İkinci Dereceden Denklemler', 'Dörtgenler ve Çokgenler', 'Katı Cisimler'],
      '11': ['Trigonometri', 'Analitik Geometri', 'Fonksiyonlarda Uygulamalar', 'Denklem ve Eşitsizlik Sistemleri', 'Çember ve Daire', 'Uzay Geometri', 'Olasılık'],
      '12': ['Üstel ve Logaritmik Fonksiyonlar', 'Diziler', 'Trigonometri', 'Dönüşümler', 'Türev', 'İntegral', 'Çemberin Analitik İncelenmesi'],
    },
  },
  {
    key: 'fen',
    name: (g) => (Number(g) >= 9 ? 'Fizik' : 'Fen Bilimleri'),
    units: {
      '5': ['Güneş, Dünya ve Ay', 'Canlılar Dünyası', 'Kuvvetin Ölçülmesi ve Sürtünme', 'Madde ve Değişim', 'Işığın Yayılması', 'İnsan ve Çevre', 'Elektrik Devre Elemanları'],
      '6': ['Güneş Sistemi ve Tutulmalar', 'Vücudumuzdaki Sistemler', 'Kuvvet ve Hareket', 'Madde ve Isı', 'Ses ve Özellikleri', 'Vücudumuzdaki Sistemler ve Sağlığı', 'Elektriğin İletimi'],
      '7': ['Güneş Sistemi ve Ötesi', 'Hücre ve Bölünmeler', 'Kuvvet ve Enerji', 'Saf Madde ve Karışımlar', 'Işığın Madde ile Etkileşimi', 'Canlılarda Üreme, Büyüme ve Gelişme', 'Elektrik Devreleri'],
      '8': ['Mevsimler ve İklim', 'DNA ve Genetik Kod', 'Basınç', 'Madde ve Endüstri', 'Basit Makineler', 'Enerji Dönüşümleri ve Çevre Bilimi', 'Elektrik Yükleri ve Elektrik Enerjisi'],
      '9': ['Fizik Bilimine Giriş', 'Madde ve Özellikleri', 'Hareket ve Kuvvet', 'Enerji', 'Isı ve Sıcaklık', 'Elektrostatik'],
      '10': ['Elektrik ve Manyetizma', 'Basınç ve Kaldırma Kuvveti', 'Dalgalar', 'Optik'],
      '11': ['Vektörler ve Bağıl Hareket', 'Newton’un Hareket Yasaları', 'İş, Enerji ve İtme-Momentum', 'Tork ve Denge', 'Elektriksel Kuvvet ve Alan', 'Manyetizma ve Elektromanyetik İndüklenme'],
      '12': ['Çembersel Hareket', 'Basit Harmonik Hareket', 'Dalga Mekaniği', 'Atom Fiziğine Giriş ve Radyoaktivite', 'Modern Fizik', 'Modern Fiziğin Teknolojideki Uygulamaları'],
    },
  },
  {
    key: 'turkce',
    name: (g) => (Number(g) >= 9 ? 'Türk Dili ve Edebiyatı' : 'Türkçe'),
    units: {
      '5': TURKCE_BECERI, '6': TURKCE_BECERI, '7': TURKCE_BECERI,
      '8': [...TURKCE_BECERI.slice(0, 4), 'Fiilimsiler ve Cümlenin Ögeleri', 'Anlatım Bozuklukları'],
      '9': ['Edebiyata Giriş', 'Hikâye', 'Şiir', 'Masal ve Fabl', 'Roman', 'Tiyatro', 'Biyografi ve Otobiyografi', 'Mektup ve Günlük'],
      '10': ['Edebiyat Tarihine Giriş', 'Hikâye', 'Şiir', 'Destan ve Efsane', 'Roman', 'Tiyatro', 'Anı ve Gezi Yazısı', 'Haber Metni'],
      '11': ['Edebiyat ve Toplum', 'Hikâye', 'Şiir', 'Makale', 'Sohbet ve Fıkra', 'Roman', 'Tiyatro', 'Eleştiri ve Röportaj'],
      '12': ['Edebiyat, Sanat ve Felsefe', 'Hikâye', 'Şiir', 'Roman', 'Tiyatro', 'Deneme', 'Söylev'],
    },
  },
  {
    key: 'ingilizce',
    name: () => 'İngilizce',
    units: {
      '5': ['Hello!', 'My Town', 'Games and Hobbies', 'My Daily Routine', 'Health', 'Movies', 'Party Time', 'Fitness', 'The Animal Shelter', 'Festivals'],
      '6': ['Life', 'Yummy Breakfast', 'Downtown', 'Weather and Emotions', 'At the Fair', 'Occupations', 'Holidays', 'Bookworms', 'Saving the Planet', 'Democracy'],
      '7': ['Appearance and Personality', 'Sports', 'Biographies', 'Wild Animals', 'Television', 'Celebrations', 'Dreams', 'Public Buildings', 'Environment', 'Planets'],
      '8': ['Friendship', 'Teen Life', 'In the Kitchen', 'On the Phone', 'The Internet', 'Adventures', 'Tourism', 'Chores', 'Science', 'Natural Forces'],
      '9': ['Studying Abroad', 'My Environment', 'Movies', 'Human in Nature', 'Inspirational People', 'Bridging Cultures', 'World Heritage', 'Emergency and Health Problems', 'Invitations and Celebrations', 'Television and Social Media'],
      '10': ['School Life', 'Plans', 'Legendary Figure', 'Traditions', 'Travel', 'Helpful Tips', 'Food and Festivals', 'Digital Era', 'Modern Heroes and Heroines', 'Shopping'],
      '11': ['Future Jobs', 'Hobbies and Skills', 'Hard Times', 'What a Life', 'Back to the Past', 'Open Your Heart', 'Facts about Turkey', 'Sports', 'My Friends', 'Values and Norms'],
      '12': ['Music', 'Friendship', 'Human Rights', 'Coming Soon', 'Psychology', 'Favors', 'News Stories', 'Alternative Energy', 'Technology', 'Manners'],
    },
  },
  {
    key: 'tarih',
    name: (g) => (Number(g) <= 7 ? 'Sosyal Bilgiler' : g === '8' || g === '12' ? 'T.C. İnkılap Tarihi ve Atatürkçülük' : 'Tarih'),
    units: {
      '5': SOSYAL_ALANLAR, '6': SOSYAL_ALANLAR, '7': SOSYAL_ALANLAR,
      '8': ['Bir Kahraman Doğuyor', 'Millî Uyanış: Bağımsızlık Yolunda Atılan Adımlar', 'Ya İstiklal Ya Ölüm!', 'Çağdaş Türkiye Yolunda Adımlar', 'Demokratikleşme Çabaları', 'Atatürk Dönemi Türk Dış Politikası', 'Atatürk’ün Ölümü ve Sonrası'],
      '9': ['Tarih ve Zaman', 'İnsanlığın İlk Dönemleri', 'Orta Çağ’da Dünya', 'İlk ve Orta Çağlarda Türk Dünyası', 'İslam Medeniyetinin Doğuşu', 'Türklerin İslamiyet’i Kabulü ve İlk Türk İslam Devletleri'],
      '10': ['Selçuklu Türkiyesi', 'Beylikten Devlete Osmanlı Siyaseti', 'Savaşçılar ve Askerler', 'Beylikten Devlete Osmanlı Medeniyeti', 'Dünya Gücü Osmanlı', 'Sultan ve Osmanlı Merkez Teşkilatı', 'Klasik Çağda Osmanlı Toplum Düzeni'],
      '11': ['Değişen Dünya Dengeleri Karşısında Osmanlı Siyaseti', 'Değişim Çağında Avrupa ve Osmanlı', 'Uluslararası İlişkilerde Denge Stratejisi', 'Devrimler Çağında Devlet-Toplum İlişkileri', 'Sermaye ve Emek', 'Değişen Gündelik Hayat'],
      '12': ['20. Yüzyıl Başlarında Osmanlı Devleti ve Dünya', 'Millî Mücadele', 'Atatürkçülük ve Türk İnkılabı', 'İki Savaş Arası Dönemde Türkiye ve Dünya', 'II. Dünya Savaşı Sürecinde Türkiye ve Dünya', 'II. Dünya Savaşı Sonrasında Türkiye ve Dünya', 'Toplumsal Devrim Çağında Dünya ve Türkiye', '21. Yüzyılın Eşiğinde Türkiye ve Dünya'],
    },
  },
  {
    key: 'cografya',
    name: () => 'Coğrafya',
    units: {
      '9': ['Doğa ve İnsan', 'Dünya’nın Şekli ve Hareketleri', 'Coğrafi Konum', 'Harita Bilgisi', 'Atmosfer ve Sıcaklık', 'İklim Bilgisi', 'Nüfus ve Yerleşme'],
      '10': ['İç ve Dış Kuvvetler', 'Su Kaynakları', 'Topraklar ve Bitki Örtüsü', 'Nüfus ve Göç', 'Ekonomik Faaliyetler', 'Bölgeler', 'Doğal Afetler'],
      '11': ['Biyoçeşitlilik ve Ekosistem', 'Nüfus Politikaları', 'Türkiye’de Nüfus ve Yerleşme', 'Ekonomik Faaliyetler ve Doğal Kaynaklar', 'Türkiye Ekonomisi', 'Kültür Bölgeleri', 'Çevre Sorunları'],
      '12': ['Ekstrem Doğa Olayları', 'Şehirlerin Fonksiyonları', 'Türkiye’nin İşlevsel Bölgeleri', 'Ulaşım ve Ticaret', 'Turizm', 'Jeopolitik Konum', 'Çevre ve Toplum'],
    },
  },
];

export const mebSubject = (key: string) => MEB_SUBJECTS.find((s) => s.key === key);

export function mebCatalog() {
  return MEB_GRADES.map((g) => ({
    grade: g,
    subjects: MEB_SUBJECTS.map((s) => ({
      key: s.key,
      name: s.name(g),
      units: s.units[g] ?? [],
      available: (s.units[g] ?? []).length > 0,
    })),
  }));
}

export const MEB_SOURCE_NOTE = 'MEB öğretim programları — yayın öncesi güncel programla doğrulanmalıdır.';
