// Şablon içerik bankası (TR/EN/RU). AI sağlayıcı yokken veya bir modül üretimi başarısız olduğunda
// devreye giren deterministik içerik. Türkçe ek sorunlarını önlemek için değişkenler tırnak içinde.
import type { Level, Locale } from '../types';
import type { Beat } from './methods';

type F2 = (t: string, f: string) => string;
type Arche = { title: (t: string) => string; summary: (t: string) => string; objectives: (t: string) => string[]; sections: string[]; task: { title: string; steps: (t: string) => string[] } };
type Check = { q: F2; options: string[] | ((t: string, f: string) => string[]); explain: string };

export interface Bank {
  title: (t: string, l: Level) => string;
  subtitle: (t: string, profile: string, method: string) => string;
  objectives: (t: string) => string[];
  prereq: Record<Level, string[]>;
  levelName: Record<Level, string>;
  levelLine: Record<Level, string>;
  archetypes: Arche[];
  meb: Arche[];
  mebOverview: { sections: string[]; summary: (u: string) => string; objectives: (u: string) => string[]; task: { title: string; steps: (u: string) => string[] } };
  beats: Record<Beat, F2>;
  analyticTitle: string;
  holisticTitle: string;
  analytic: F2[];
  metaphors: F2[];
  example: F2;
  checks: Check[];
  keyPoint: F2[];
  slide: { module: (n: number) => string; section: (n: number) => string; task: string; recap: string; recapTitle: string; taskHighlight: string; notesIntro: F2; notesSection: F2; notesTask: (task: string) => string; notesRecap: string };
  sources: (t: string) => { title: string; url: string; note: string }[];
}

const q = (s: string) => `“${s}”`;

const tr: Bank = {
  title: (t, l) => `${t} — ${({ beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' } as const)[l]} Seviye`,
  subtitle: (t, p, m) => `${q(t)} konusu, ${p} profiline göre ${m} ile kurgulandı.`,
  objectives: (t) => [
    `${q(t)} konusunun temel kavramlarını kendi cümlelerinle açıklamak`,
    'Kavramlar arasındaki neden-sonuç ilişkilerini şemaya dökmek',
    'Öğrendiklerini gerçek bir duruma uygulayıp sonucunu değerlendirmek',
  ],
  prereq: {
    beginner: ['Ön bilgi gerekmez; merak yeterli.'],
    intermediate: ['Konunun temel terimlerine aşinalık', 'Haftada 2-3 kısa çalışma oturumu'],
    advanced: ['Alanın temel kavramlarına hâkimiyet', 'Kaynak okuma ve karşılaştırma alışkanlığı'],
  },
  levelName: { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' },
  levelLine: {
    beginner: 'Bu seviyede amaç kavramı doğru tanımak; ayrıntılar sonraki modüllerde gelecek.',
    intermediate: 'Bu seviyede kavramı diğer kavramlarla ilişkilendirmeye ve gerekçelendirmeye odaklan.',
    advanced: 'Bu seviyede sınır durumlarını, istisnaları ve alternatif yaklaşımları sorgula.',
  },
  archetypes: [
    { title: (t) => `${t}: Büyük Resim ve Temeller`, summary: (t) => `${q(t)} nedir, neden önemlidir ve bu kursta hangi yolu izleyeceğiz?`,
      objectives: (t) => [`${q(t)} konusunun kapsamını kendi cümlelerinle tanımlamak`, 'Konunun hayatta ve meslekte nerede karşına çıktığını örneklemek', 'Kişisel öğrenme hedefini netleştirmek'],
      sections: ['Büyük resim', 'Önem ve kullanım alanları', 'Yol haritası ve hedefin'],
      task: { title: 'Başlangıç haritası', steps: (t) => [`${q(t)} hakkında şu an bildiğin 5 şeyi yaz.`, 'Merak ettiğin 3 soruyu not et.', 'Kurs sonunda neyi yapabilmek istediğini tek cümleyle belirle.'] } },
    { title: (t) => `${t}: Temel Kavramlar`, summary: (t) => `${q(t)} alanının kelime dağarcığı ve kavramların birbirine bağlanışı.`,
      objectives: () => ['Anahtar kavramları tanımlamak', 'Kavramlar arası ilişkileri göstermek', 'Sık karıştırılan kavramları ayırt etmek'],
      sections: ['Anahtar kavramlar', 'Kavramlar arası ilişkiler', 'Sık karıştırılanlar'],
      task: { title: 'Kavram sözlüğü', steps: () => ['Bu modüldeki 5 kavramı kendi cümlelerinle tanımla.', 'Her kavram için bir örnek ekle.', 'Karıştırdığın iki kavramın farkını tek cümleyle yaz.'] } },
    { title: (t) => `${t}: Nasıl Çalışır?`, summary: (t) => `${q(t)} içindeki temel mekanizma, adım adım süreç ve onu anlatan modeller.`,
      objectives: () => ['Temel mekanizmayı girdi → kural → sonuç olarak açıklamak', 'Süreci adım adım şemaya dökmek', 'Bir modelin güçlü ve zayıf yanını söylemek'],
      sections: ['Temel mekanizma', 'Adım adım süreç', 'Modeller ve gösterimler'],
      task: { title: 'Süreç şeması', steps: () => ['Süreci 4-6 adımlık bir akış olarak çiz.', 'Her adımın girdisini ve çıktısını yaz.', 'Bir adımı değiştirsen sonucun nasıl değişeceğini tahmin et.'] } },
    { title: (t) => `${t}: Uygulamada`, summary: (t) => `Çözümlü örnekten bağımsız uygulamaya: ${q(t)} gerçek bir durumda.`,
      objectives: () => ['Çözümlü bir örneği adım adım takip etmek', 'Benzer bir problemi destek azaltılarak çözmek', 'Öğreneni gerçek bir bağlama aktarmak'],
      sections: ['Çözümlü örnek', 'Yarım kalan örnek', 'Gerçek hayata aktarma'],
      task: { title: 'Mini uygulama', steps: () => ['Çözümlü örneği adım adım yeniden üret.', 'Benzer yeni bir durumu kendin çöz.', 'Sonucu ve takıldığın yeri not olarak yükle.'] } },
    { title: (t) => `${t}: Hatalar, Sınırlar ve İleri Adımlar`, summary: (t) => `${q(t)} alanında en sık yapılan hatalar, sınır durumları ve uzman bakışı.`,
      objectives: () => ['Sık yapılan hataları ve nedenlerini tanımak', 'Sınır durumlarını fark etmek', 'Alternatif yaklaşımları karşılaştırmak'],
      sections: ['Sık yapılan hatalar', 'Sınır durumları', 'Uzman bakışı'],
      task: { title: 'Hata avı', steps: () => ['Bu alanda sık yapılan 3 hatayı listele.', 'Her birinin nedenini açıkla.', 'Her hata için bir önleme kuralı yaz.'] } },
    { title: (t) => `${t}: Sentez ve Proje`, summary: (t) => `Tüm modülleri birleştiren sentez, karma tekrar ve ${q(t)} için sonraki adımlar.`,
      objectives: () => ['Modüllerin ana fikirlerini tek çerçevede birleştirmek', 'Karma tekrarla bilgiyi pekiştirmek', 'Kişisel bir sonraki adım planlamak'],
      sections: ['Parçaları birleştirmek', 'Karma tekrar', 'Sonraki adımların'],
      task: { title: 'Kapanış projesi', steps: () => ['Tüm modüllerden birer ana fikri tek sayfada birleştir.', 'Bunu kullanarak küçük bir proje ya da sunum hazırla.', 'Projeyi değerlendirme bölümüne yükle.'] } },
  ],
  meb: [
    { title: (u) => `${u}: Kazanımlar ve Ön Bilgi`, summary: (u) => `${q(u)} ünitesinde neleri öğreneceğini ve hangi ön bilgilere dayandığını gör.`,
      objectives: (u) => [`${q(u)} ünitesinin kazanımlarını listelemek`, 'Ön bilgileri yoklamak', 'Ünitenin büyük resmini görmek'],
      sections: ['Ünitenin kazanımları', 'Ön bilgi yoklaması', 'Ünitenin büyük resmi'],
      task: { title: 'Kazanım listesi', steps: () => ['Ünitenin kazanımlarını kendi cümlelerinle yaz.', 'Bildiğin ve bilmediğin kazanımları işaretle.', 'Bilmediklerin için bir soru not et.'] } },
    { title: (u) => `${u}: Temel Kavramlar`, summary: (u) => `${q(u)} ünitesinin temel kavramları ve aralarındaki ilişkiler.`,
      objectives: () => ['Temel kavramları tanımlamak', 'Kavramları örnekle eşleştirmek', 'Sık karıştırılan kavramları ayırt etmek'],
      sections: ['Tanımlar', 'Kavramlar arası ilişkiler', 'Sık karıştırılanlar'],
      task: { title: 'Kavram kartları', steps: () => ['Her kavram için ön yüzü terim, arka yüzü tanım olan bir kart hazırla.', 'Kartlarla kendini sına.', 'Zorlandığın kartları ayır.'] } },
    { title: (u) => `${u}: Çözümlü Örnekler`, summary: (u) => `${q(u)} ünitesinden adım adım çözülmüş örnekler ve çözüm stratejisi.`,
      objectives: () => ['Çözümlü örneği adım adım takip etmek', 'Çözüm stratejisini adlandırmak', 'Stratejiyi yeni soruya taşımak'],
      sections: ['Örnek 1: adım adım', 'Örnek 2: farklı bir bakış', 'Çözüm stratejisi'],
      task: { title: 'Çözümü yeniden üret', steps: () => ['Örneklerden birini kitaba bakmadan yeniden çöz.', 'Her adımın gerekçesini yaz.', 'Benzer bir soru uydur ve çöz.'] } },
    { title: (u) => `${u}: Uygulama ve Problem Çözme`, summary: (u) => `${q(u)} ünitesini günlük hayata ve yeni nesil sorulara taşı.`,
      objectives: () => ['Kazanımı yeni bir bağlamda uygulamak', 'Günlük hayattan örnek bulmak', 'Yeni nesil soruları çözümlemek'],
      sections: ['Bağımsız uygulama', 'Günlük hayatta', 'Yeni nesil soru mantığı'],
      task: { title: 'Soru çözüm seti', steps: () => ['Üniteden 5 soru çöz.', 'Yanlışlarının nedenini yaz.', 'Çözüm fotoğrafını ya da notunu yükle.'] } },
    { title: (u) => `${u}: Sık Yapılan Hatalar`, summary: (u) => `${q(u)} ünitesinde öğrencilerin en sık düştüğü tuzaklar ve önleme yolları.`,
      objectives: () => ['Tipik hataları tanımak', 'Hataların nedenini açıklamak', 'Kendi kontrol listeni oluşturmak'],
      sections: ['Tipik hatalar', 'Hataların kaynağı', 'Kontrol listesi'],
      task: { title: 'Hata defteri', steps: () => ['Kendi yaptığın 3 hatayı yaz.', 'Her birinin nedenini belirt.', 'Sınavda kullanacağın 3 maddelik kontrol listesi hazırla.'] } },
    { title: (u) => `${u}: Karma Tekrar ve Değerlendirme`, summary: (u) => `${q(u)} ünitesinin tamamını karma tekrar ve kendini sınama ile pekiştir.`,
      objectives: () => ['Üniteyi karma sorularla tekrar etmek', 'Eksik kazanımları belirlemek', 'Aralıklı tekrar planı kurmak'],
      sections: ['Karma tekrar', 'Kendini sına', 'Tekrar planın'],
      task: { title: 'Tekrar planı', steps: () => ['3 gün ve 1 hafta sonrası için tekrar zamanı belirle.', 'Eksik kazanımları listele.', 'Ünite özetini tek sayfada yaz.'] } },
  ],
  mebOverview: {
    sections: ['Kazanımlar', 'Temel kavramlar', 'Çözümlü örnek ve uygulama'],
    summary: (u) => `${q(u)} ünitesinin kazanımları, kavramları ve uygulaması.`,
    objectives: (u) => [`${q(u)} ünitesinin kazanımlarını açıklamak`, 'Temel kavramları örnekle eşleştirmek', 'Bir problemi adım adım çözmek'],
    task: { title: 'Ünite özeti', steps: (u) => [`${q(u)} ünitesini 5 cümleyle özetle.`, 'Üniteden 3 soru çöz.', 'Zorlandığın noktayı not et.'] },
  },
  beats: {
    hook: (t, f) => `Bir düşün: yarın ${q(t)} hakkında bir karar vermen gerekse, ${q(f)} başlığında neyi bilmek isterdin? Bu bölüm tam bu soruya cevap veriyor.`,
    define: (t, f) => `Önce zemini netleştirelim. ${q(f)}, ${q(t)} konusunun içinde belirli bir işi gören kavram ya da süreçtir. Neyi kapsadığını ve neyi kapsamadığını ayırt etmek, sonraki her adımın temelidir.`,
    mechanism: (_t, f) => `Peki nasıl çalışır? ${q(f)} genellikle bir girdi alır, onu belirli kurallarla dönüştürür ve gözlenebilir bir sonuç üretir. Bu zinciri — girdi, kural, sonuç — her yeni örnekte yeniden kurmaya çalış; kurabildiğin an, anlamışsın demektir.`,
    example: (t, f) => `Somut bir örnek: ${q(t)} ile yeni tanışan biri ${q(f)} kısmını atlarsa, sonraki adımlarda neden-sonuç bağı kopar ve öğrendikleri birbirinden kopuk notlara dönüşür. Aynı kişi bu adımı tek cümleyle özetleyip ilerlediğinde bağlantı korunur.`,
    question: (t, f) => `Kendine şunu sor: ${q(f)} olmasaydı ${q(t)} içinde ne eksik kalırdı? Cevabı ararken aslında kavramın işlevini tanımlıyorsun — ve bu, ezberlemekten çok daha kalıcıdır.`,
    analogy: (t, f) => `Bir benzetmeyle: ${q(f)}, bir şehrin trafik ışıkları gibidir. Kendisi yolculuk değildir; ama ${q(t)} içindeki akışın düzenli ve güvenli ilerlemesini sağlar.`,
    decompose: (_t, f) => `Konuyu en küçük doğrularına ayıralım: ${q(f)} hakkında kesin bildiğimiz şey nedir, hangi kısmı varsayımdır? Kesin olanları alt alta yazmak, geri kalanını sıfırdan kurmanın en sağlam yoludur.`,
    case: (t, f) => `Bir vaka: Bir ekip ${q(t)} üzerinde çalışırken ${q(f)} adımında hızlanmak için kestirme bir yol seçiyor. İlk sonuçlar iyi görünüyor; birkaç hafta sonra hatalar birikiyor. Ekip geri dönüp bu adımı doğru kurduğunda süreç toparlanıyor. Bu vakadan çıkan ders, adımın neden var olduğudur.`,
    practice: (_t, f) => `Şimdi sıra sende: metne bakmadan ${q(f)} başlığının ana fikrini tek cümleyle yaz, sonra bu bölümle karşılaştır. Eksik kalan kısım, tekrar etmen gereken kısımdır.`,
    recall: (_t, f) => `Kapanış için: ${q(f)} hakkında aklında kalan üç anahtar kelimeyi say. Bu kısa geri çağırma, yeniden okumaktan çok daha kalıcı bir iz bırakır.`,
  },
  analyticTitle: 'Yapı',
  holisticTitle: 'Büyük resim',
  analytic: [
    (_t, f) => `Tanım: ${q(f)} neyi kapsar, neyi kapsamaz — sınırını çiz.`,
    () => 'Mekanizma: girdi → kural → sonuç zincirini kur.',
    (t) => `Bağlantı: ${q(t)} içindeki hangi kavramla doğrudan ilişkili?`,
    () => 'Kontrol: kendi cümlenle tek satırda özetleyebiliyor musun?',
  ],
  metaphors: [
    (t, f) => `${q(f)}, ${q(t)} haritasında bir kavşak gibidir: buradan geçmeden diğer bölgelere giden yolların çoğu açılmaz.`,
    (t, f) => `Bir mutfak düşün: malzemeler hazır ama tarifin sırası yoksa yemek olmaz. ${q(f)}, ${q(t)} içindeki o sıra duygusudur.`,
    (_t, f) => `Bir orkestrada her çalgı kendi partisini çalar; ${q(f)} şefin elindeki ritim gibidir — parçaları aynı müziğe bağlar.`,
    (t, f) => `${q(t)} bir nehirse, ${q(f)} onun yatağıdır: suyu kendisi taşımaz ama nereye ve ne hızla akacağını belirler.`,
    (t, f) => `${q(f)}, iki kıyıyı bağlayan bir köprüdür: bir yanda bildiklerin, öbür yanda ${q(t)} içinde öğreneceklerin.`,
    (t, f) => `Bir bahçede tohum, toprak ve su birlikte çalışır. ${q(f)}, ${q(t)} bahçesinde toprağın rolünü oynar: görünmez ama her şey ona dayanır.`,
  ],
  example: (t, f) => `Uygulama anı: ${q(f)} başlığını hayatından bir durumla eşleştir. Evde, okulda ya da işte ${q(t)} ile karşılaştığın bir anı düşün ve bu adımın orada nasıl göründüğünü iki cümleyle yaz.`,
  checks: [
    { q: (_t, f) => `${q(f)} başlığını gerçekten anladığını en iyi hangisi gösterir?`, options: ['Kendi örneğimle başka birine açıklayabilmem', 'Metni kelimesi kelimesine tekrar edebilmem', 'Başlığın bana tanıdık gelmesi', 'Bölümü iki kez okumuş olmam'], explain: 'Açıklayabilmek (üretmek) tanımaktan daha derin bir işlemdir; tanıdıklık hissi sık sık anlamayla karıştırılır.' },
    { q: (t, f) => `${q(t)} öğrenirken ${q(f)} adımını atlamanın en olası sonucu nedir?`, options: ['Sonraki kavramlar arasındaki neden-sonuç bağının kopması', 'Öğrenmenin hızlanıp kalıcılaşması', 'Hiçbir etkisinin olmaması', 'Konunun kendiliğinden kolaylaşması'], explain: 'Kavramlar birbirine dayanır; temel bir halkayı atlamak sonraki bilgiyi bağlanacak yer olmadan bırakır.' },
    { q: () => 'Bu bölümü bir hafta sonra hatırlamak için en etkili hamle hangisi?', options: ['Birkaç gün arayla kendimi kısa sorularla sınamak', 'Bu akşam üç kez art arda okumak', 'Önemli yerleri fosforlu kalemle çizmek', 'Hiç dönmeden sonraki konuya geçmek'], explain: 'Aralıklı geri çağırma, yeniden okumaya ve işaretlemeye göre uzun süreli hatırlamayı belirgin biçimde artırır.' },
    { q: (_t, f) => `${q(f)} için iyi bir örnek seçerken neye dikkat edilmeli?`, options: ['Kavramın asıl işlevini görünür kılmasına', 'Olabildiğince uzun olmasına', 'Konuyla ilgisiz ama eğlenceli olmasına', 'Teknik terimlerle dolu olmasına'], explain: 'İyi örnek kavramın neden var olduğunu gösterir; önemli olan uzunluk ya da süs değil, işlevdir.' },
    { q: (_t, f) => `${q(f)} hakkında bir iddiayla karşılaştın. İlk soracağın soru ne olmalı?`, options: ['Bu iddianın dayanağı ve kaynağı nedir?', 'Bunu söyleyen kişi ünlü mü?', 'Kulağa hoş geliyor mu?', 'Kaç kişi paylaşmış?'], explain: 'Kanıt kültürü: bir iddiayı kaynağı ve gerekçesiyle değerlendir.' },
    { q: (t) => `${q(t)} konusunda takıldığında hangi strateji en verimlidir?`, options: ['Sorunu küçük parçalara bölüp nerede koptuğunu bulmak', 'Konuyu tamamen bırakmak', 'Aynı paragrafı defalarca okumak', 'Cevabı ezberleyip geçmek'], explain: 'Parçalara bölmek sorunun tam yerini görünür kılar ve hedefli tekrar yapmanı sağlar.' },
  ],
  keyPoint: [
    (_t, f) => `${q(f)}: önce sınırı çiz, sonra mekanizmayı kur.`,
    (t) => `${q(t)} içinde her kavram bir sonrakine zemin hazırlar.`,
    () => 'Açıklayabildiğin şeyi anlamışsındır; tanıdık gelmesi yetmez.',
    () => 'Kısa ve aralıklı geri çağırma, uzun tekrardan daha kalıcıdır.',
  ],
  slide: {
    module: (n) => `MODÜL ${n}`,
    section: (n) => `BÖLÜM ${n}`,
    task: 'UYGULAMA',
    recap: 'ÖZET',
    recapTitle: 'Akılda kalacak üç şey',
    taskHighlight: 'Görevi tamamla, onayla: +20 XP.',
    notesIntro: (t, f) => `Bu modülde ${q(t)} konusunda ${q(f)} başlığına odaklanıyoruz. Önce hedefleri yüksek sesle oku; modül sonunda kendini bunlarla ölçeceksin.`,
    notesSection: (_t, f) => `Bu slaytta ${q(f)} başlığını işliyoruz. Görseldeki ilişkileri kendi cümlelerinle anlat; anlatamadığın yer, tekrar etmen gereken yerdir.`,
    notesTask: (task) => `Şimdi sıra sende: ${task}. Bitirmeden sonraki modüle geçme; öğrenme birikimlidir.`,
    notesRecap: 'Üç maddeyi gözünü kapatıp tekrar et. Sonra quiz ile kendini sına.',
  },
  sources: (t) => [
    { title: `Vikipedi — ${t}`, url: `https://tr.wikipedia.org/w/index.php?search=${encodeURIComponent(t)}`, note: 'Genel bakış; birincil kaynaklara bağlantılar için kaynakçaya bak.' },
    { title: `Khan Academy — ${t}`, url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(t)}`, note: 'Ücretsiz video ve alıştırmalar.' },
    { title: `MIT OpenCourseWare — ${t}`, url: `https://ocw.mit.edu/search/?q=${encodeURIComponent(t)}`, note: 'Üniversite düzeyi ders notları.' },
  ],
};

const en: Bank = {
  title: (t, l) => `${t} — ${({ beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const)[l]}`,
  subtitle: (t, p, m) => `${q(t)}, designed for the ${p} profile using ${m}.`,
  objectives: (t) => [`Explain the core concepts of ${q(t)} in your own words`, 'Map cause-and-effect relationships between concepts', 'Apply what you learn to a real situation and evaluate the result'],
  prereq: {
    beginner: ['No prior knowledge needed; curiosity is enough.'],
    intermediate: ['Familiarity with the basic terms', '2-3 short study sessions per week'],
    advanced: ['Solid grasp of the core concepts', 'Habit of reading and comparing sources'],
  },
  levelName: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
  levelLine: {
    beginner: 'At this level the goal is to recognise the concept correctly; details come in later modules.',
    intermediate: 'At this level, focus on connecting the concept to others and justifying it.',
    advanced: 'At this level, question edge cases, exceptions and alternative approaches.',
  },
  archetypes: [
    { title: (t) => `${t}: The Big Picture`, summary: (t) => `What ${q(t)} is, why it matters, and the path this course takes.`,
      objectives: (t) => [`Define the scope of ${q(t)} in your own words`, 'Give examples of where it shows up in life and work', 'Set your personal learning goal'],
      sections: ['The big picture', 'Why it matters', 'Roadmap and your goal'],
      task: { title: 'Starting map', steps: (t) => [`Write down 5 things you already know about ${q(t)}.`, 'Note 3 questions you are curious about.', 'State in one sentence what you want to be able to do by the end.'] } },
    { title: (t) => `${t}: Core Concepts`, summary: (t) => `The vocabulary of ${q(t)} and how the concepts connect.`,
      objectives: () => ['Define the key concepts', 'Show how they relate', 'Tell commonly confused concepts apart'],
      sections: ['Key concepts', 'How concepts relate', 'Commonly confused'],
      task: { title: 'Concept glossary', steps: () => ['Define the 5 concepts of this module in your own words.', 'Add an example for each.', 'Write the difference between two concepts you confuse in one sentence.'] } },
    { title: (t) => `${t}: How It Works`, summary: (t) => `The core mechanism of ${q(t)}, the step-by-step process and the models that describe it.`,
      objectives: () => ['Explain the mechanism as input → rule → output', 'Diagram the process step by step', 'Name one strength and one weakness of a model'],
      sections: ['Core mechanism', 'Step-by-step process', 'Models and representations'],
      task: { title: 'Process diagram', steps: () => ['Draw the process as a 4-6 step flow.', 'Write the input and output of each step.', 'Predict how the result changes if you alter one step.'] } },
    { title: (t) => `${t}: In Practice`, summary: (t) => `From a worked example to independent practice: ${q(t)} in a real situation.`,
      objectives: () => ['Follow a worked example step by step', 'Solve a similar problem with less support', 'Transfer the learning to a real context'],
      sections: ['Worked example', 'A half-finished example', 'Transfer to real life'],
      task: { title: 'Mini practice', steps: () => ['Reproduce the worked example step by step.', 'Solve a similar new case yourself.', 'Upload the result and where you got stuck as a note.'] } },
    { title: (t) => `${t}: Mistakes, Limits and Next Moves`, summary: (t) => `The most common mistakes in ${q(t)}, edge cases and the expert view.`,
      objectives: () => ['Recognise common mistakes and their causes', 'Notice edge cases', 'Compare alternative approaches'],
      sections: ['Common mistakes', 'Edge cases', 'The expert view'],
      task: { title: 'Bug hunt', steps: () => ['List 3 common mistakes in this field.', 'Explain the cause of each.', 'Write one prevention rule for each mistake.'] } },
    { title: (t) => `${t}: Synthesis and Project`, summary: (t) => `A synthesis of all modules, mixed review and your next steps in ${q(t)}.`,
      objectives: () => ['Combine the main ideas into one frame', 'Consolidate through mixed review', 'Plan a personal next step'],
      sections: ['Putting it together', 'Mixed review', 'Your next steps'],
      task: { title: 'Capstone', steps: () => ['Combine one main idea from each module on a single page.', 'Use it to build a small project or presentation.', 'Upload the project to the assessment section.'] } },
  ],
  meb: [],
  mebOverview: {
    sections: ['Learning outcomes', 'Core concepts', 'Worked example and practice'],
    summary: (u) => `Outcomes, concepts and practice for the unit ${q(u)}.`,
    objectives: (u) => [`Explain the outcomes of ${q(u)}`, 'Match core concepts with examples', 'Solve a problem step by step'],
    task: { title: 'Unit summary', steps: (u) => [`Summarise ${q(u)} in 5 sentences.`, 'Solve 3 questions from the unit.', 'Note where you struggled.'] },
  },
  beats: {
    hook: (t, f) => `Imagine you had to make a decision about ${q(t)} tomorrow: what would you want to know about ${q(f)}? This section answers exactly that.`,
    define: (t, f) => `Let's set the ground first. ${q(f)} is the concept or process that does a specific job inside ${q(t)}. Telling what it covers from what it doesn't is the basis for every next step.`,
    mechanism: (_t, f) => `So how does it work? ${q(f)} usually takes an input, transforms it by certain rules and produces an observable result. Rebuild that chain — input, rule, result — with every new example; the moment you can, you understand it.`,
    example: (t, f) => `A concrete example: someone new to ${q(t)} who skips ${q(f)} loses the cause-and-effect link in later steps, and their notes turn into disconnected facts. When the same person summarises this step in one sentence before moving on, the link holds.`,
    question: (t, f) => `Ask yourself: without ${q(f)}, what would be missing from ${q(t)}? While searching for the answer you are defining the concept's function — which lasts far longer than memorising.`,
    analogy: (t, f) => `An analogy: ${q(f)} is like a city's traffic lights. It is not the journey itself, but it keeps the flow inside ${q(t)} orderly and safe.`,
    decompose: (_t, f) => `Let's break it into its smallest truths: what do we know for certain about ${q(f)}, and what is assumption? Listing the certain parts is the most solid way to rebuild the rest from scratch.`,
    case: (t, f) => `A case: a team working on ${q(t)} takes a shortcut at ${q(f)} to move faster. Early results look fine; weeks later errors pile up. When the team goes back and builds this step properly, the process recovers. The lesson is why the step exists.`,
    practice: (_t, f) => `Your turn: without looking, write the main idea of ${q(f)} in one sentence, then compare it with this section. Whatever is missing is what you need to review.`,
    recall: (_t, f) => `To close: name three keywords you remember about ${q(f)}. This quick retrieval leaves a much stronger trace than rereading.`,
  },
  analyticTitle: 'Structure',
  holisticTitle: 'Big picture',
  analytic: [
    (_t, f) => `Definition: what ${q(f)} covers and what it does not — draw the boundary.`,
    () => 'Mechanism: build the input → rule → result chain.',
    (t) => `Connection: which concept in ${q(t)} is it directly tied to?`,
    () => 'Check: can you summarise it in one line, in your own words?',
  ],
  metaphors: [
    (t, f) => `${q(f)} is a crossroads on the map of ${q(t)}: most roads to other regions open only after you pass it.`,
    (t, f) => `Think of a kitchen: the ingredients are ready, but without the order of the recipe there is no meal. ${q(f)} is that sense of order inside ${q(t)}.`,
    (_t, f) => `In an orchestra each instrument plays its part; ${q(f)} is the conductor's beat that ties the parts into one piece of music.`,
    (t, f) => `If ${q(t)} is a river, ${q(f)} is its bed: it carries no water itself, but decides where and how fast it flows.`,
    (t, f) => `${q(f)} is a bridge between two banks: what you already know on one side, what you will learn in ${q(t)} on the other.`,
    (t, f) => `In a garden, seed, soil and water work together. ${q(f)} plays the soil in the garden of ${q(t)}: invisible, yet everything rests on it.`,
  ],
  example: (t, f) => `Apply it: match ${q(f)} to a moment from your own life. Think of a time at home, school or work when you met ${q(t)}, and write in two sentences how this step looked there.`,
  checks: [
    { q: (_t, f) => `What best shows that you truly understand ${q(f)}?`, options: ['I can explain it to someone else with my own example', 'I can repeat the text word for word', 'The heading feels familiar', 'I have read the section twice'], explain: 'Explaining (producing) is deeper than recognising; the feeling of familiarity is often mistaken for understanding.' },
    { q: (t, f) => `What is the most likely result of skipping ${q(f)} while learning ${q(t)}?`, options: ['The cause-and-effect link between later concepts breaks', 'Learning becomes faster and more durable', 'It has no effect at all', 'The topic becomes easier by itself'], explain: 'Concepts build on each other; skipping a foundational link leaves later knowledge with nothing to attach to.' },
    { q: () => 'Which move best helps you remember this section a week from now?', options: ['Testing myself with short questions a few days apart', 'Rereading it three times tonight', 'Highlighting the important parts', 'Moving on without ever coming back'], explain: 'Spaced retrieval improves long-term retention far more than rereading or highlighting.' },
    { q: (_t, f) => `What matters most when choosing a good example for ${q(f)}?`, options: ['That it makes the concept’s real function visible', 'That it is as long as possible', 'That it is unrelated but fun', 'That it is full of technical terms'], explain: 'A good example shows why the concept exists; function matters, not length or decoration.' },
    { q: (_t, f) => `You meet a claim about ${q(f)}. What should you ask first?`, options: ['What is the evidence and the source?', 'Is the person who said it famous?', 'Does it sound nice?', 'How many people shared it?'], explain: 'Evidence culture: judge a claim by its source and reasoning.' },
    { q: (t) => `When you get stuck on ${q(t)}, which strategy works best?`, options: ['Break the problem into parts and find where it breaks', 'Drop the topic entirely', 'Reread the same paragraph again and again', 'Memorise the answer and move on'], explain: 'Breaking it down shows exactly where the problem is and lets you review in a targeted way.' },
  ],
  keyPoint: [
    (_t, f) => `${q(f)}: draw the boundary first, then build the mechanism.`,
    (t) => `In ${q(t)}, every concept prepares the ground for the next.`,
    () => 'If you can explain it, you understand it; feeling familiar is not enough.',
    () => 'Short, spaced retrieval beats long rereading.',
  ],
  slide: {
    module: (n) => `MODULE ${n}`,
    section: (n) => `SECTION ${n}`,
    task: 'PRACTICE',
    recap: 'RECAP',
    recapTitle: 'Three things to keep',
    taskHighlight: 'Complete the task and confirm it: +20 XP.',
    notesIntro: (t, f) => `In this module we focus on ${q(f)} within ${q(t)}. Read the goals aloud first; you will measure yourself against them at the end.`,
    notesSection: (_t, f) => `This slide covers ${q(f)}. Explain the relationships in the visual in your own words; where you can't, review.`,
    notesTask: (task) => `Your turn: ${task}. Don't move to the next module before finishing; learning is cumulative.`,
    notesRecap: 'Close your eyes and repeat the three points. Then test yourself with the quiz.',
  },
  sources: (t) => [
    { title: `Wikipedia — ${t}`, url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(t)}`, note: 'Overview; follow the references to primary sources.' },
    { title: `Khan Academy — ${t}`, url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(t)}`, note: 'Free videos and exercises.' },
    { title: `MIT OpenCourseWare — ${t}`, url: `https://ocw.mit.edu/search/?q=${encodeURIComponent(t)}`, note: 'University-level course notes.' },
  ],
};

const ru: Bank = {
  title: (t, l) => `${t} — ${({ beginner: 'начальный уровень', intermediate: 'средний уровень', advanced: 'продвинутый уровень' } as const)[l]}`,
  subtitle: (t, p, m) => `Курс по теме ${q(t)} для профиля «${p}», метод: ${m}.`,
  objectives: (t) => [`Объяснять ключевые понятия темы ${q(t)} своими словами`, 'Строить схемы причинно-следственных связей', 'Применять знания в реальной ситуации и оценивать результат'],
  prereq: {
    beginner: ['Предварительные знания не нужны — достаточно любопытства.'],
    intermediate: ['Знакомство с базовыми терминами', '2–3 коротких занятия в неделю'],
    advanced: ['Уверенное владение основами', 'Привычка читать и сравнивать источники'],
  },
  levelName: { beginner: 'Начальный', intermediate: 'Средний', advanced: 'Продвинутый' },
  levelLine: {
    beginner: 'На этом уровне цель — правильно распознать понятие; детали будут в следующих модулях.',
    intermediate: 'На этом уровне связывайте понятие с другими и обосновывайте его.',
    advanced: 'На этом уровне исследуйте граничные случаи, исключения и альтернативы.',
  },
  archetypes: [
    { title: (t) => `${t}: общая картина`, summary: (t) => `Что такое ${q(t)}, почему это важно и как устроен курс.`,
      objectives: (t) => [`Определить рамки темы ${q(t)} своими словами`, 'Привести примеры из жизни и работы', 'Сформулировать личную цель обучения'],
      sections: ['Общая картина', 'Почему это важно', 'Маршрут и ваша цель'],
      task: { title: 'Стартовая карта', steps: (t) => [`Запишите 5 вещей, которые уже знаете о ${q(t)}.`, 'Отметьте 3 вопроса, которые вас интересуют.', 'Одним предложением сформулируйте, что хотите уметь в конце.'] } },
    { title: (t) => `${t}: ключевые понятия`, summary: (t) => `Словарь темы ${q(t)} и связи между понятиями.`,
      objectives: () => ['Определить ключевые понятия', 'Показать связи между ними', 'Различать часто путаемые понятия'],
      sections: ['Ключевые понятия', 'Связи между понятиями', 'Что часто путают'],
      task: { title: 'Глоссарий', steps: () => ['Дайте определения 5 понятиям модуля своими словами.', 'Добавьте пример к каждому.', 'Одним предложением опишите разницу между двумя путаемыми понятиями.'] } },
    { title: (t) => `${t}: как это работает`, summary: (t) => `Основной механизм темы ${q(t)}, процесс по шагам и модели.`,
      objectives: () => ['Объяснить механизм как вход → правило → результат', 'Нарисовать процесс по шагам', 'Назвать сильную и слабую сторону модели'],
      sections: ['Основной механизм', 'Процесс по шагам', 'Модели и представления'],
      task: { title: 'Схема процесса', steps: () => ['Нарисуйте процесс из 4–6 шагов.', 'Запишите вход и выход каждого шага.', 'Предскажите, как изменится результат, если изменить один шаг.'] } },
    { title: (t) => `${t}: на практике`, summary: (t) => `От разобранного примера к самостоятельной практике: ${q(t)} в реальной ситуации.`,
      objectives: () => ['Пройти разобранный пример по шагам', 'Решить похожую задачу с меньшей помощью', 'Перенести знания в реальный контекст'],
      sections: ['Разобранный пример', 'Незаконченный пример', 'Перенос в реальную жизнь'],
      task: { title: 'Мини-практика', steps: () => ['Воспроизведите разобранный пример по шагам.', 'Решите похожий случай самостоятельно.', 'Загрузите результат и место, где возникли трудности.'] } },
    { title: (t) => `${t}: ошибки, границы и следующие шаги`, summary: (t) => `Частые ошибки в теме ${q(t)}, граничные случаи и взгляд эксперта.`,
      objectives: () => ['Распознавать частые ошибки и их причины', 'Замечать граничные случаи', 'Сравнивать альтернативные подходы'],
      sections: ['Частые ошибки', 'Граничные случаи', 'Взгляд эксперта'],
      task: { title: 'Охота на ошибки', steps: () => ['Перечислите 3 частые ошибки в этой области.', 'Объясните причину каждой.', 'Сформулируйте правило-профилактику для каждой.'] } },
    { title: (t) => `${t}: синтез и проект`, summary: (t) => `Синтез всех модулей, смешанное повторение и следующие шаги в теме ${q(t)}.`,
      objectives: () => ['Объединить главные идеи в одну схему', 'Закрепить знания смешанным повторением', 'Спланировать следующий шаг'],
      sections: ['Собираем целое', 'Смешанное повторение', 'Ваши следующие шаги'],
      task: { title: 'Итоговый проект', steps: () => ['Соберите по одной главной идее из каждого модуля на одной странице.', 'На её основе сделайте небольшой проект или презентацию.', 'Загрузите проект в раздел оценки.'] } },
  ],
  meb: [],
  mebOverview: {
    sections: ['Результаты обучения', 'Ключевые понятия', 'Разобранный пример и практика'],
    summary: (u) => `Результаты, понятия и практика по разделу ${q(u)}.`,
    objectives: (u) => [`Объяснить результаты раздела ${q(u)}`, 'Сопоставить понятия с примерами', 'Решить задачу по шагам'],
    task: { title: 'Итог раздела', steps: (u) => [`Кратко изложите ${q(u)} в 5 предложениях.`, 'Решите 3 задачи раздела.', 'Отметьте, где было трудно.'] },
  },
  beats: {
    hook: (t, f) => `Представьте, что завтра вам нужно принять решение, связанное с темой ${q(t)}: что бы вы хотели знать о ${q(f)}? Этот раздел отвечает именно на это.`,
    define: (t, f) => `Сначала определимся с основой. ${q(f)} — это понятие или процесс, выполняющий конкретную задачу внутри темы ${q(t)}. Отличать, что входит в него, а что нет, — фундамент каждого следующего шага.`,
    mechanism: (_t, f) => `Как это работает? ${q(f)} обычно получает вход, преобразует его по определённым правилам и даёт наблюдаемый результат. Восстанавливайте цепочку «вход — правило — результат» на каждом новом примере: когда получается, значит, вы поняли.`,
    example: (t, f) => `Конкретный пример: новичок в теме ${q(t)}, пропустивший ${q(f)}, теряет причинно-следственную связь на следующих шагах, и его заметки превращаются в разрозненные факты. Если же он подытожит этот шаг одним предложением, связь сохранится.`,
    question: (t, f) => `Спросите себя: чего не хватало бы в теме ${q(t)} без ${q(f)}? Отвечая, вы определяете функцию понятия — это запоминается гораздо прочнее, чем заучивание.`,
    analogy: (t, f) => `Аналогия: ${q(f)} похоже на светофоры в городе. Это не сама поездка, но благодаря им движение внутри темы ${q(t)} остаётся упорядоченным и безопасным.`,
    decompose: (_t, f) => `Разложим тему на простейшие истины: что мы точно знаем о ${q(f)}, а что является допущением? Выписать достоверное — самый надёжный способ собрать остальное заново.`,
    case: (t, f) => `Кейс: команда, работающая над темой ${q(t)}, срезает путь на шаге ${q(f)}, чтобы ускориться. Первые результаты выглядят хорошо, но через несколько недель накапливаются ошибки. Когда команда возвращается и выстраивает шаг правильно, процесс восстанавливается. Урок — зачем этот шаг нужен.`,
    practice: (_t, f) => `Ваша очередь: не подглядывая, запишите главную мысль раздела ${q(f)} одним предложением и сравните с текстом. То, чего не хватает, и нужно повторить.`,
    recall: (_t, f) => `В завершение назовите три ключевых слова о ${q(f)}, которые запомнили. Такое быстрое припоминание оставляет след прочнее, чем перечитывание.`,
  },
  analyticTitle: 'Структура',
  holisticTitle: 'Общая картина',
  analytic: [
    (_t, f) => `Определение: что входит в ${q(f)}, а что нет — проведите границу.`,
    () => 'Механизм: постройте цепочку вход → правило → результат.',
    (t) => `Связь: с каким понятием темы ${q(t)} это напрямую связано?`,
    () => 'Проверка: можете ли вы подытожить это одной строкой своими словами?',
  ],
  metaphors: [
    (t, f) => `${q(f)} — перекрёсток на карте темы ${q(t)}: большинство дорог открывается только после него.`,
    (t, f) => `Представьте кухню: продукты готовы, но без порядка рецепта блюда не будет. ${q(f)} — это чувство порядка внутри темы ${q(t)}.`,
    (_t, f) => `В оркестре каждый инструмент играет свою партию; ${q(f)} — ритм дирижёра, связывающий партии в одну музыку.`,
    (t, f) => `Если ${q(t)} — река, то ${q(f)} — её русло: само не несёт воды, но решает, куда и как быстро она течёт.`,
    (t, f) => `${q(f)} — мост между двумя берегами: на одном то, что вы знаете, на другом — то, что узнаете в теме ${q(t)}.`,
    (t, f) => `В саду семя, почва и вода работают вместе. ${q(f)} играет роль почвы в саду темы ${q(t)}: незаметна, но всё держится на ней.`,
  ],
  example: (t, f) => `Примените: сопоставьте ${q(f)} с моментом из своей жизни. Вспомните, когда дома, в учёбе или на работе вы сталкивались с темой ${q(t)}, и опишите в двух предложениях, как там выглядел этот шаг.`,
  checks: [
    { q: (_t, f) => `Что лучше всего показывает, что вы действительно поняли ${q(f)}?`, options: ['Я могу объяснить это другому на своём примере', 'Я могу повторить текст слово в слово', 'Заголовок кажется знакомым', 'Я прочитал(а) раздел дважды'], explain: 'Объяснение (воспроизведение) глубже узнавания; чувство знакомости часто путают с пониманием.' },
    { q: (t, f) => `Каков наиболее вероятный итог пропуска ${q(f)} при изучении темы ${q(t)}?`, options: ['Разрыв причинно-следственных связей между следующими понятиями', 'Обучение станет быстрее и прочнее', 'Никакого эффекта', 'Тема станет проще сама собой'], explain: 'Понятия опираются друг на друга; пропуск базового звена оставляет новые знания без опоры.' },
    { q: () => 'Что лучше всего поможет вспомнить этот раздел через неделю?', options: ['Проверять себя короткими вопросами с перерывами в несколько дней', 'Перечитать трижды сегодня вечером', 'Выделить важное маркером', 'Перейти дальше и не возвращаться'], explain: 'Интервальное припоминание улучшает долговременную память намного сильнее, чем перечитывание или выделение.' },
    { q: (_t, f) => `Что важнее всего при выборе хорошего примера для ${q(f)}?`, options: ['Чтобы он показывал реальную функцию понятия', 'Чтобы он был как можно длиннее', 'Чтобы он был забавным, хоть и не по теме', 'Чтобы в нём было много терминов'], explain: 'Хороший пример показывает, зачем существует понятие; важна функция, а не длина или украшения.' },
    { q: (_t, f) => `Вы встретили утверждение о ${q(f)}. Какой вопрос задать первым?`, options: ['Каковы доказательства и источник?', 'Знаменит ли автор?', 'Звучит ли это красиво?', 'Сколько человек поделились этим?'], explain: 'Культура доказательств: оценивайте утверждение по источнику и аргументации.' },
    { q: (t) => `Какая стратегия лучше всего работает, если вы застряли в теме ${q(t)}?`, options: ['Разбить задачу на части и найти место разрыва', 'Полностью бросить тему', 'Перечитывать один абзац снова и снова', 'Заучить ответ и идти дальше'], explain: 'Разбиение показывает точное место проблемы и позволяет повторять целенаправленно.' },
  ],
  keyPoint: [
    (_t, f) => `${q(f)}: сначала граница, затем механизм.`,
    (t) => `В теме ${q(t)} каждое понятие готовит почву для следующего.`,
    () => 'Если можете объяснить — поняли; ощущения знакомости недостаточно.',
    () => 'Короткое интервальное припоминание сильнее долгого перечитывания.',
  ],
  slide: {
    module: (n) => `МОДУЛЬ ${n}`,
    section: (n) => `РАЗДЕЛ ${n}`,
    task: 'ПРАКТИКА',
    recap: 'ИТОГ',
    recapTitle: 'Три вещи, которые стоит запомнить',
    taskHighlight: 'Выполните задание и подтвердите: +20 XP.',
    notesIntro: (t, f) => `В этом модуле мы сосредоточимся на ${q(f)} в теме ${q(t)}. Сначала прочитайте цели вслух; в конце вы оцените себя по ним.`,
    notesSection: (_t, f) => `Этот слайд посвящён ${q(f)}. Объясните связи на схеме своими словами; где не получается — повторите.`,
    notesTask: (task) => `Ваша очередь: ${task}. Не переходите к следующему модулю, не закончив; обучение накопительно.`,
    notesRecap: 'Закройте глаза и повторите три пункта. Затем проверьте себя квизом.',
  },
  sources: (t) => [
    { title: `Википедия — ${t}`, url: `https://ru.wikipedia.org/w/index.php?search=${encodeURIComponent(t)}`, note: 'Обзор; переходите к первоисточникам по ссылкам.' },
    { title: `Khan Academy — ${t}`, url: `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(t)}`, note: 'Бесплатные видео и упражнения.' },
    { title: `MIT OpenCourseWare — ${t}`, url: `https://ocw.mit.edu/search/?q=${encodeURIComponent(t)}`, note: 'Материалы университетского уровня.' },
  ],
};

export const BANKS: Record<Locale, Bank> = { tr, en, ru };
