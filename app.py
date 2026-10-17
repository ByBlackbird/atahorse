"""
Atahorse v3 - AI Destekli Kişiselleştirilmiş Eğitim Platformu
Freemium Model + Admin Panel + Kaynakça + Slayt + Çoklu Dil
"""

import os
import random
import sqlite3
import json
import datetime
from io import BytesIO

from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_file
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_babel import Babel, gettext as _
from werkzeug.security import generate_password_hash, check_password_hash
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import requests

app = Flask(__name__)
app.secret_key = "atahorse_secret_key_2026_guvenli_anahtar"

# === BABEL ===
app.config['BABEL_DEFAULT_LOCALE'] = 'tr'
app.config['BABEL_TRANSLATION_DIRECTORIES'] = 'translations'

def get_locale():
    lang = session.get('lang')
    if lang in ['tr', 'en', 'ru']:
        return lang
    return request.accept_languages.best_match(['tr', 'en', 'ru']) or 'tr'

babel = Babel(app, locale_selector=get_locale)

@app.context_processor
def inject_locale():
    return dict(get_locale=get_locale)

@app.route('/set-language/<lang>')
def set_language(lang):
    if lang in ['tr', 'en', 'ru']:
        session['lang'] = lang
    return redirect(request.referrer or url_for('index'))

# === YARDIMCI: ÇEVİRİ DICTIONARY (template disi kullanim) ===
TRANSLATIONS = {
    'tr': {
        'free_plan': 'Ücretsiz Plan', 'premium_plan': 'Premium Plan',
        'courses_remaining': 'kalan ücretsiz kurs', 'upgrade': 'Premium\'a Yükselt',
        'sources': 'Kaynaklar', 'slideshow': 'Slayt Gösterisi', 'reading_mode': 'Okuma Modu',
        'slides_of': 'slayt', 'press_nav': 'Ok tuşları veya butonlarla gezinin',
        'popular_courses': 'Trend Kurslar', 'certified_learners': 'Sertifika Alan Öğrenciler',
        'take_test_now': 'Analizi Başlat', 'create_first_course': 'İlk Kursunu Oluştur',
        'explore_courses': 'Kursları Keşfet', 'step': 'Adım',
        'admin_panel': 'Yönetici Paneli', 'revenue': 'Gelir', 'members': 'Üyeler',
        'completion_rate': 'Tamamlanma Oranı', 'active_courses': 'Aktif Kurs',
        'free_users': 'Ücretsiz Üye', 'premium_users': 'Premium Üye',
        'recent_payments': 'Son Ödemeler', 'user_mgmt': 'Kullanıcı Yönetimi',
        'platform_analytics': 'Platform Analizleri', 'no_data': 'Henüz veri yok',
        'plan': 'Plan', 'joined': 'Katılım', 'actions': 'İşlemler',
        'make_premium': 'Premium Yap', 'make_free': 'Ücretsiz Yap',
        'course_catalog': 'Kurs Kataloğu', 'completed_by': 'tamamlayan',
        'back_to_dashboard': 'Panele Dön',
    },
    'en': {
        'free_plan': 'Free Plan', 'premium_plan': 'Premium Plan',
        'courses_remaining': 'free courses remaining', 'upgrade': 'Upgrade to Premium',
        'sources': 'Sources', 'slideshow': 'Slideshow', 'reading_mode': 'Reading Mode',
        'slides_of': 'slides', 'press_nav': 'Navigate with arrow keys or buttons',
        'popular_courses': 'Trending Courses', 'certified_learners': 'Certified Learners',
        'take_test_now': 'Start Analysis', 'create_first_course': 'Create Your First Course',
        'explore_courses': 'Explore Courses', 'step': 'Step',
        'admin_panel': 'Admin Panel', 'revenue': 'Revenue', 'members': 'Members',
        'completion_rate': 'Completion Rate', 'active_courses': 'Active Courses',
        'free_users': 'Free Users', 'premium_users': 'Premium Users',
        'recent_payments': 'Recent Payments', 'user_mgmt': 'User Management',
        'platform_analytics': 'Platform Analytics', 'no_data': 'No data yet',
        'plan': 'Plan', 'joined': 'Joined', 'actions': 'Actions',
        'make_premium': 'Make Premium', 'make_free': 'Make Free',
        'course_catalog': 'Course Catalog', 'completed_by': 'completed by',
        'back_to_dashboard': 'Back to Dashboard',
    },
    'ru': {
        'free_plan': 'Бесплатный План', 'premium_plan': 'Премиум План',
        'courses_remaining': 'бесплатных курсов осталось', 'upgrade': 'Перейти на Премиум',
        'sources': 'Источники', 'slideshow': 'Слайд-шоу', 'reading_mode': 'Режим Чтения',
        'slides_of': 'слайдов', 'press_nav': 'Навигация стрелками или кнопками',
        'popular_courses': 'Популярные Курсы', 'certified_learners': 'Сертифицированные Студенты',
        'take_test_now': 'Начать Анализ', 'create_first_course': 'Создать Первый Курс',
        'explore_courses': 'Исследовать Курсы', 'step': 'Шаг',
        'admin_panel': 'Панель Администратора', 'revenue': 'Доход', 'members': 'Участники',
        'completion_rate': 'Процент Завершения', 'active_courses': 'Активные Курсы',
        'free_users': 'Бесплатные Пользователи', 'premium_users': 'Премиум Пользователи',
        'recent_payments': 'Последние Платежи', 'user_mgmt': 'Управление Пользователями',
        'platform_analytics': 'Аналитика Платформы', 'no_data': 'Пока нет данных',
        'plan': 'План', 'joined': 'Присоединился', 'actions': 'Действия',
        'make_premium': 'Сделать Премиум', 'make_free': 'Сделать Бесплатным',
        'course_catalog': 'Каталог Курсов', 'completed_by': 'завершили',
        'back_to_dashboard': 'Назад к Панели',
    }
}

def tr(key):
    lang = session.get('lang', 'tr')
    return TRANSLATIONS.get(lang, TRANSLATIONS['tr']).get(key, key)

@app.context_processor
def inject_tr():
    return dict(tr=tr)

# === OGRENME TEMALARI (bilimsel temelli) ===
# Renk, ogrenme stiline gore bilissel yuk ve kodlama arastirmalarina gore ayarlanir;
# kullanici istedigi temayi secebilir ("auto" = stilime gore otomatik).
THEMES = {
    "auto":    {"style": "karma",      "name": "Otomatik (Stilime Göre)",
                "desc": "Öğrenme stilini testten çıkan sonuca göre otomatik eşleştirir. Stilin değişirse tema da onunla birlikte değişir."},
    "sade":    {"style": "isitsel",    "name": "Sade & Sakin",
                "desc": "İşitsel öğrenenler için: görsel sadelik dışsal bilişsel yükü azaltır (Sweller), dikkat kulağa ve iç sesine yönelir. Az renk, çok boşluk."},
    "canli":   {"style": "gorsel",     "name": "Canlı & Görsel",
                "desc": "Görsel öğrenenler için: renk kodlama ve güçlü kontrast, bilginin uzun süreli belleğe kodlanmasını destekler."},
    "dinamik": {"style": "kinestetik", "name": "Dinamik & Enerjik",
                "desc": "Kinestetik öğrenenler için: yüksek enerji ve oyunlaştırma hissi, aktif denemeyi (Kolb) ve motivasyonu destekler."},
    "dengeli": {"style": "karma",      "name": "Dengeli",
                "desc": "Karma profiller için bilimsel varsayılan: nötr zemin üzerinde dengeli vurgular, hiçbir kanalı yormaz."},
}

def effective_theme(user):
    """Kullanicinin goruntulenecek temasini dondurur. 'auto'/bos ise stile gore esler."""
    t = (getattr(user, "theme", None) or "").strip()
    if t and t != "auto" and t in THEMES:
        return t
    return {"gorsel": "canli", "isitsel": "sade", "kinestetik": "dinamik"}.get(
        getattr(user, "learning_style", "karma") or "karma", "dengeli")

@app.context_processor
def inject_theme():
    if current_user.is_authenticated:
        return dict(theme=effective_theme(current_user), themes=THEMES,
                    user_theme=(current_user.theme or "auto"))
    return dict(theme="dengeli", themes=THEMES, user_theme="auto")

@app.route("/theme", methods=["POST"])
@login_required
def set_theme():
    t = (request.form.get("theme") or "").strip()
    if t not in THEMES:
        flash(_("Geçersiz tema."), "error")
        return redirect(request.referrer or url_for("index"))
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE users SET theme=? WHERE id=?", (t, current_user.id))
    conn.commit(); conn.close()
    flash(_("Öğrenme teman güncellendi."), "success")
    return redirect(request.referrer or url_for("index"))

# === LOGIN ===
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.login_message = _("Lütfen önce giriş yapın.")
login_manager.login_message_category = "warning"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "atahorse.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        learning_style TEXT DEFAULT 'karma',
        brain_lobe TEXT DEFAULT 'karma',
        plan TEXT DEFAULT 'free',
        is_admin INTEGER DEFAULT 0,
        courses_used INTEGER DEFAULT 0,
        onboarded INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")

    c.execute("""CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        topic TEXT NOT NULL,
        level TEXT NOT NULL,
        learning_style TEXT NOT NULL,
        content TEXT NOT NULL,
        modules TEXT,
        sources TEXT,
        progress INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        certificate_issued INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id))""")

    c.execute("""CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        course_id INTEGER NOT NULL,
        certificate_code TEXT UNIQUE NOT NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (course_id) REFERENCES courses (id))""")

    c.execute("""CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'TRY',
        payment_type TEXT DEFAULT 'subscription',
        description TEXT,
        status TEXT DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id))""")


    c.execute("""CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        questions TEXT NOT NULL,
        answers TEXT,
        score INTEGER,
        max_score INTEGER,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses (id),
        FOREIGN KEY (user_id) REFERENCES users (id))""")

    c.execute("""CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        filename TEXT NOT NULL,
        stored TEXT NOT NULL,
        mime TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses (id),
        FOREIGN KEY (user_id) REFERENCES users (id))""")

    # --- GOC: eski veritabanlarına yeni kolonlar (gorev durumu, mod secimi, zihin haritasi, AI onayi) ---
    for mig in [
        "ALTER TABLE courses ADD COLUMN tasks_state TEXT",
        "ALTER TABLE courses ADD COLUMN mode_override TEXT",
        "ALTER TABLE courses ADD COLUMN mindmap TEXT",
        "ALTER TABLE courses ADD COLUMN ai_approved INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN streak INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN last_active TEXT",
        "ALTER TABLE users ADD COLUMN theme TEXT",
    ]:
        try:
            c.execute(mig)
        except sqlite3.OperationalError:
            pass

    conn.commit()

    # Varsayilan admin olustur (ilk kurulumda)
    c.execute("SELECT id FROM users WHERE is_admin = 1")
    if not c.fetchone():
        admin_hash = generate_password_hash("admin123")
        c.execute("""INSERT OR IGNORE INTO users (username, email, password_hash, full_name, is_admin, plan)
                     VALUES ('admin', 'admin@atahorse.local', ?, 'Site Yoneticisi', 1, 'premium')""", (admin_hash,))
        conn.commit()
        print("👤 Varsayılan admin oluşturuldu → kullanıcı: admin | şifre: admin123")
    conn.close()
    print("✅ Veritabanı başlatıldı.")

class User(UserMixin):
    def __init__(self, id, username, email, full_name, learning_style, brain_lobe, plan, is_admin, courses_used, onboarded, theme=None):
        self.id = id; self.username = username; self.email = email
        self.full_name = full_name; self.learning_style = learning_style
        self.brain_lobe = brain_lobe; self.plan = plan; self.is_admin = is_admin
        self.courses_used = courses_used; self.onboarded = onboarded
        self.theme = theme

@login_manager.user_loader
def load_user(user_id):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    u = c.fetchone(); conn.close()
    if u:
        # NULL alanlari varsayilanlara normalize et — 500 hatasini onler
        return User(u["id"], u["username"], u["email"], u["full_name"] or u["username"],
                    u["learning_style"] or "karma", u["brain_lobe"] or "karma",
                    u["plan"] or "free", u["is_admin"] or 0,
                    u["courses_used"] if u["courses_used"] is not None else 0,
                    u["onboarded"] or 0, u["theme"] if "theme" in u.keys() else None)
    return None

def admin_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            flash(_("Bu sayfaya erişim yetkiniz yok."), "danger")
            return redirect(url_for("index"))
        return f(*args, **kwargs)
    return decorated

# === AI ENTEGRASYONU ===
# OLLAMA_URL ile uzak sunucu/cloud da kullanilabilir (varsayilan: yerel).
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_API_KEY = os.environ.get("OLLAMA_API_KEY", "").strip()

def _ollama_headers():
    return {"Authorization": f"Bearer {OLLAMA_API_KEY}"} if OLLAMA_API_KEY else {}

def ollama_chat(prompt, model=None, system_prompt=None):
    try:
        model = model or os.environ.get("OLLAMA_MODEL", "llama3")
        payload = {"model": model, "prompt": prompt, "stream": False,
                   "options": {"temperature": 0.7, "num_predict": 4000}}
        if system_prompt: payload["system"] = system_prompt
        r = requests.post(f"{OLLAMA_URL}/api/generate", json=payload,
                          headers=_ollama_headers(), timeout=180)
        if r.status_code == 200:
            return r.json().get("response", "")
        return None
    except Exception as e:
        print(f"Ollama hatası: {e}")
        return None

def ollama_available():
    try:
        return requests.get(f"{OLLAMA_URL}/api/tags", headers=_ollama_headers(), timeout=5).status_code == 200
    except:
        return False

def search_web(query, max_results=5):
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            return [{"title": r.get("title",""), "href": r.get("href",""), "body": r.get("body","")}
                    for r in ddgs.text(query, max_results=max_results)]
    except Exception as e:
        print(f"Arama hatası: {e}")
        return []

# === KURS ÜRETİMİ (kaynakça dahil) ===
def generate_course_content(topic, level, learning_style, brain_lobe, lang='tr'):
    lang_names = {'tr': 'Türkçe', 'en': 'English', 'ru': 'Русский'}
    content_lang = lang_names.get(lang, 'Türkçe')

    web_sources = []
    for q in [f"{topic} {level} guide", f"{topic} fundamentals", f"{topic} best practices"]:
        web_sources.extend(search_web(q, max_results=3))

    sources = [{"title": s["title"], "url": s["href"]} for s in web_sources[:8]]
    sources_text = "\n".join([f"- {s['title']}: {s['body'][:200]}" for s in web_sources[:5]])

    system_prompt = f"""Sen Atahorse platformunun uzman AI eğitim asistanısın.
Kullanıcının öğrenme stiline uygun, KANITA DAYALI (bilimsel öğrenme araştırmalarına uygun) eğitim içeriği oluşturuyorsun.
İçerik {content_lang} dilinde olmalı. JSON formatında yanıt ver."""

    prompt = f"""KONU: {topic} | SEVİYE: {level} | STİL: {learning_style} | LOB: {brain_lobe} | DİL: {content_lang}

WEB KAYNAKLARI:
{sources_text}

Şu JSON formatında yanıt ver (başka metin ekleme):
{{
    "title": "kurs başlığı",
    "description": "2-3 cümlelik açıklama",
    "modules": [
        {{"title": "Modül başlığı",
         "content": "Detaylı konu anlatımı. ## ile alt başlıklar oluştur; paragraflar, örnekler ve listeler kullan.",
         "duration": "45 dk",
         "tasks": ["görev 1", "görev 2", "görev 3"]}}
    ]
}}

BİLİMSEL ÖĞRENME TASARIMI — içeriği üretirken şu kurallara kesinlikle uy:
1. DİKKAT ÇENGELİ: Her modülün content alanı, merak uyandıran kısa bir soru veya çarpıcı bir gerçekle başlasın (duyusal kayıt → dikkat geçişi).
2. ÇALIŞMA BELLEĞİ SINIRI: Çalışma belleği aynı anda 4-7 parça bilgi tutar (Bilişsel Yük Teorisi). Her ## alt başlığı altında en fazla 3-4 kısa paragraf olsun; gereksiz tekrar ve uzun cümlelerden kaçın.
3. AYRINTILANDIRMA: Her modülde en az bir "Neden?" veya "Nasıl?" sorusunu yanıtlayan bir bölüm olsun (elaborative interrogation — yeni bilgiyi eski bilgiyle bağlar).
4. AKTİF GERİ ÇAĞIRMA: Her modülün sonuna "Kendini Sına:" başlığı altında 2-3 soru ekle (cevaplarını hemen altında tek cümleyle ver).
5. ARAYA EKLEME: Modüller birbirini referans göstersin; tasks listesinde biri önceki modülle karışık pratik olsun.
6. ARALIKLI TEKRAR: Son modül, tüm kursun ana hatlarını listeleyen kısa bir tekrar özetiyle bitsin.
7. STİL UYUMU: Görsel stil → şemalar/listeler ağırlıklı; işitsel stil → akıcı anlatım ve ritim; kinestetik stil → adım adım uygulama talimatları.
En az 5 modül üret."""

    response = ollama_chat(prompt, system_prompt=system_prompt)
    if response:
        try:
            start = response.find("{"); end = response.rfind("}") + 1
            if start != -1 and end != 0:
                data = json.loads(response[start:end])
                data["sources"] = sources
                return data
        except Exception as e:
            print(f"JSON parse hatası: {e}")

    fallback = generate_fallback_course(topic, level, lang)
    fallback["sources"] = sources
    return fallback

def generate_fallback_course(topic, level, lang='tr'):
    mods = []
    for i in range(1, 6):
        if lang == 'en':
            titles = ["Introduction & Basics", "Core Principles", "Advanced Techniques", "Practical Application", "Assessment & Next Steps"]
            body = f"# {titles[i-1]}\n\n## Overview\nKey concepts of {topic} at {level} level.\n\n## Key Points\n- Fundamental concept one\n- Important principle two\n- Practical application three\n\n## Example\nA real-world scenario demonstrating {topic} in action."
            tasks = ["Read and summarize", "Practice exercise", "Self-quiz"]
            dur = "45 min"
        elif lang == 'ru':
            titles = ["Введение и Основы", "Основные Принципы", "Продвинутые Техники", "Практическое Применение", "Оценка и Следующие Шаги"]
            body = f"# {titles[i-1]}\n\n## Обзор\nКлючевые концепции {topic} на уровне {level}.\n\n## Ключевые Моменты\n- Основная концепция\n- Важный принцип\n- Практическое применение\n\n## Пример\nРеальный сценарий применения {topic}."
            tasks = ["Прочитать и резюмировать", "Практическое упражнение", "Самотест"]
            dur = "45 мин"
        else:
            titles = ["Giriş ve Temeller", "Temel Prensipler", "İleri Teknikler", "Pratik Uygulama", "Değerlendirme ve Sonraki Adımlar"]
            body = f"# {titles[i-1]}\n\n## Genel Bakış\n{topic} konusunun {level} seviyesinde temel kavramları.\n\n## Temel Noktalar\n- Temel kavram bir\n- Önemli prensip iki\n- Pratik uygulama üç\n\n## Örnek\n{topic} konusunun gerçek hayattaki bir uygulaması."
            tasks = ["Okuyup özetle", "Alıştırma yap", "Kendi kendine test"]
            dur = "45 dk"
        mods.append({"title": f"{i}. {titles[i-1]}", "content": body, "duration": dur, "tasks": tasks})

    if lang == 'en':
        return {"title": f"{topic} - {level.title()} Course", "description": f"Comprehensive {level} course on {topic}.", "modules": mods, "sources": []}
    elif lang == 'ru':
        return {"title": f"{topic} - Курс ({level})", "description": f"Всесторонний курс по {topic} уровня {level}.", "modules": mods, "sources": []}
    return {"title": f"{topic} - {level.title()} Eğitimi", "description": f"{topic} konusunda kapsamlı {level} seviyesi eğitim.", "modules": mods, "sources": []}

# === PDF SERTİFİKA ===
def generate_quiz(course, modules, lang='tr'):
    """Kurs modullerinden 5 soruluk degerlendirme uretir.
    Donus: [{question, options[4], correct_index}] veya None."""
    module_titles = [m.get("title","") for m in modules[:8]]
    prompt = (
        f"Kurs: {course['title']}\nKonu: {course['topic']}\nSeviye: {course['level']}\n"
        f"Moduller: {', '.join(module_titles)}\n\n"
        "Bu kurs icin 5 coktan secmeli degerlendirme sorusu uret. "
        "Sorular AKTIF GERI CAAGIRMA (active recall) prensibine uygun olsun: "
        "ogrencinin bilgiyi zihinden cagirmasini gerektirsin; acik uclu dusundurup seceneklerle dogrulasin. "
        "Dogrudan tanim ezberi yerine uygulama ve kavrama sorulari agirlikli olsun. "
        "Her sorunun 4 secenegi ve dogru cevabin indeksi (0-3) olsun. "
        "Yalnizca gecerli JSON dondur, format:\n"
        '[{"question":"...","options":["a","b","c","d"],"correct_index":0}, ...]'
    )
    try:
        raw = ollama_chat(prompt, system_prompt="Sen bir egitim degerlendirme uzmanisin. Sadece JSON dondur.")
        start = raw.find("["); end = raw.rfind("]") + 1
        if start == -1 or end == 0:
            return None
        data = json.loads(raw[start:end])
        quiz = []
        for q in data[:5]:
            if "question" in q and isinstance(q.get("options"), list) and len(q["options"]) >= 2:
                opts = [str(o) for o in q["options"]][:4]
                ci = int(q.get("correct_index", 0))
                ci = max(0, min(ci, len(opts) - 1))
                quiz.append({"question": str(q["question"]), "options": opts, "correct_index": ci})
        return quiz if len(quiz) >= 3 else None
    except Exception:
        return None

def generate_fallback_quiz(course, modules, lang='tr'):
    """Ollama kapaliysa devreye girer: kurs verilerinden 5 coktan secmeli soru uretir.
    Hicbir ogrenci quizsiz kalmaz. Donus: [{question, options[4], correct_index}]"""
    def _cget(key, default=""):
        try:
            return course[key]
        except Exception:
            return default
    topic = (_cget("topic") or _cget("title") or "Konu").strip()
    level = (_cget("level") or "beginner").lower()
    titles = [m.get("title", "") for m in modules if m.get("title")]
    if not titles:
        titles = [topic]
    distractors_pool = [
        "Veri Analizi ve Gorsellestirme", "Liderlik ve Ekip Yonetimi",
        "Finansal Okuryazarlik", "Dijital Pazarlama Stratejileri",
        "Proje Yonetimi Temelleri", "Iletisim ve Sunum Becerileri",
        "Yapay Zeka Uygulamalari", "Girisimcilik ve Inovasyon",
        "Is Surecleri Otomasyonu", "Kullanici Deneyimi Tasarimi",
    ]
    pool = [d for d in distractors_pool if d.lower() not in " ".join(titles).lower()]

    def mk_opts(correct, wrongs):
        opts = [correct] + [w for w in wrongs if w and w != correct][:3]
        if len(opts) < 4:
            return None
        random.shuffle(opts)
        return {"options": opts, "correct_index": opts.index(correct)}

    L = {
        'tr': {
            'q_mod': f"Bu kursun {{i}}. modulunun adi hangisidir?",
            'q_topic': "Bu kursun ana ogrenme konusu asagidakilerden hangisidir?",
            'q_level': "Bu kurs hangi zorluk seviyesinde hazirlanmistir?",
            'q_count': "Bu kurs toplam kac ogrenme modulunden olusmaktadir?",
            'q_first': "Kursun ilk modulu hangi konuyla baslamaktadir?",
            'lv': {'beginner': 'Baslangic', 'intermediate': 'Orta', 'advanced': 'Ileri', 'expert': 'Uzman'},
            'nums': ['Iki', 'Uc', 'Dort', 'Bes', 'Alti', 'Yedi', 'Sekiz', 'Dokuz', 'On'],
        },
        'en': {
            'q_mod': "What is the name of module {{i}} in this course?",
            'q_topic': "What is the main learning topic of this course?",
            'q_level': "At which difficulty level is this course prepared?",
            'q_count': "How many learning modules does this course consist of in total?",
            'q_first': "Which topic does the first module of the course start with?",
            'lv': {'beginner': 'Beginner', 'intermediate': 'Intermediate', 'advanced': 'Advanced', 'expert': 'Expert'},
            'nums': ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'],
        },
        'ru': {
            'q_mod': "Как называется модуль {{i}} этого курса?",
            'q_topic': "Какова основная тема обучения этого курса?",
            'q_level': "На каком уровне сложности подготовлен этот курс?",
            'q_count': "Из скольких учебных модулей состоит этот курс?",
            'q_first': "С какой темы начинается первый модуль курса?",
            'lv': {'beginner': 'Начальный', 'intermediate': 'Средний', 'advanced': 'Продвинутый', 'expert': 'Эксперт'},
            'nums': ['Два', 'Три', 'Четыре', 'Пять', 'Шесть', 'Семь', 'Восемь', 'Девять', 'Десять'],
        },
    }
    T = L.get(lang, L['tr'])
    used_wrong = []
    quiz = []

    def wrongs(n):
        picks = [p for p in pool if p not in used_wrong][:n]
        used_wrong.extend(picks)
        return picks

    def add(question, correct, wlist):
        base = mk_opts(correct, wlist)
        if base and question.strip():
            base["question"] = question.strip()
            quiz.append(base)

    if len(titles) >= 2:
        idx = min(1, len(titles) - 1)
        add(T['q_mod'].replace("{i}", str(idx + 1)), titles[idx], wrongs(3))
    add(T['q_topic'], topic, wrongs(3))
    lv_correct = T['lv'].get(level, T['lv']['beginner'])
    lv_wrong = [v for k, v in T['lv'].items() if v != lv_correct]
    add(T['q_level'], lv_correct, lv_wrong[:3])
    n = len(titles)
    if 2 <= n <= 10:
        num_word = T['nums'][n - 2] if n - 2 < len(T['nums']) else str(n)
        add(T['q_count'], num_word, [w for w in T['nums'] if w != num_word][:3])
    first_title = titles[0]
    first_key = first_title.split(":")[-1].strip() if ":" in first_title else first_title
    add(T['q_first'], first_key, wrongs(3))

    while len(quiz) < 3 and len(titles) > 2:
        idx = len(quiz) % len(titles)
        add(T['q_mod'].replace("{i}", str(idx + 1)), titles[idx], wrongs(3))
    random.shuffle(quiz)
    return quiz[:5] if len(quiz) >= 3 else None

def _cert_fonts():
    """DejaVuSans bulunursa UTF-8 (Turkce) fontlari kaydeder, yoksa None doner."""
    found = {}
    for key, fname in (("reg", "DejaVuSans.ttf"), ("bold", "DejaVuSans-Bold.ttf"),
                       ("oblique", "DejaVuSans-Oblique.ttf")):
        for d in ("/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/dejavu",
                  os.path.join(BASE_DIR, "static", "fonts")):
            p = os.path.join(d, fname)
            if os.path.isfile(p):
                found[key] = p
                break
    if not found.get("reg"):
        return None
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        reg = found["reg"]
        if reg not in _cert_fonts._registered:
            pdfmetrics.registerFont(TTFont("DejaVu", reg))
            _cert_fonts._registered.add(reg)
        if found.get("bold") and found["bold"] not in _cert_fonts._registered:
            pdfmetrics.registerFont(TTFont("DejaVu-Bold", found["bold"]))
            _cert_fonts._registered.add(found["bold"])
        if found.get("oblique") and found["oblique"] not in _cert_fonts._registered:
            pdfmetrics.registerFont(TTFont("DejaVu-Oblique", found["oblique"]))
            _cert_fonts._registered.add(found["oblique"])
        from reportlab.lib.fonts import addMapping
        addMapping("DejaVu", 0, 0, "DejaVu")
        addMapping("DejaVu", 1, 0, "DejaVu-Bold")
        addMapping("DejaVu", 0, 1, "DejaVu-Oblique")
        addMapping("DejaVu", 1, 1, "DejaVu-Bold")
        return {"reg": "DejaVu", "bold": "DejaVu-Bold", "oblique": "DejaVu-Oblique"}
    except Exception:
        return None
_cert_fonts._registered = set()

def generate_certificate_pdf(user_name, course_title, cert_code, date_str, lang='tr', level='beginner'):
    """Profesyonel sertifika: orta eksende hizali, altin at muhurlu, QR kodlu."""
    buffer = BytesIO()
    W, H = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=landscape(A4))

    NAVY = colors.HexColor('#1E1B4B')
    PURPLE = colors.HexColor('#5B2DE6')
    AMBER = colors.HexColor('#F5B942')
    AMBER_D = colors.HexColor('#D97706')
    GOLD_L = colors.HexColor('#FCD34D')
    INK = colors.HexColor('#232338')
    GRAY = colors.HexColor('#5b5b70')
    IVORY = colors.HexColor('#FDFCF8')
    WHITE = colors.white

    texts = {
        'tr': {'sub': 'KISISELLESTIRILMIS AI EGITIM PLATFORMU', 'type': 'BASARI SERTIFIKASI',
               't1': 'Bu belge,', 't2': 'adli kisinin asagidaki egitimi basariyla tamamladigini onaylar.',
               'date': 'Tarih', 'no': 'Sertifika No', 'level_lbl': 'Zorluk Seviyesi',
               'verify': 'Dogrulama', 'sign': 'Atahorse AI Egitim Platformu', 'scan': 'Sertifikayi dogrulamak icin QR kodu okutun'},
        'en': {'sub': 'PERSONALIZED AI EDUCATION PLATFORM', 'type': 'CERTIFICATE OF COMPLETION',
               't1': 'This certificate confirms that', 't2': 'has successfully completed the following course.',
               'date': 'Date', 'no': 'Certificate No', 'level_lbl': 'Difficulty Level',
               'verify': 'Verify at', 'sign': 'Atahorse AI Education Platform', 'scan': 'Scan the QR code to verify this certificate'},
        'ru': {'sub': 'PLATFORM PERSONALIZED AI EDUCATION', 'type': 'CERTIFICATE OF COMPLETION',
               't1': 'This certificate confirms that', 't2': 'has successfully completed the following course.',
               'date': 'Date', 'no': 'Certificate No', 'level_lbl': 'Difficulty Level',
               'verify': 'Verify at', 'sign': 'Atahorse AI Education Platform', 'scan': 'Scan the QR code to verify this certificate'}
    }
    t = texts.get(lang, texts['tr'])
    # UTF-8 font (DejaVu) bulunursa gercek Turkce karakterler kullanilir;
    # bulunamazsa eski davranis: ASCII cevirimi + Helvetica.
    F = _cert_fonts() or {"reg": "Helvetica", "bold": "Helvetica-Bold", "oblique": "Helvetica-BoldOblique"}
    if F["reg"] != "Helvetica":
        t_utf8 = {
            'tr': {'sub': 'KİŞİSELLEŞTİRİLMİŞ AI EĞİTİM PLATFORMU', 'type': 'BAŞARI SERTİFİKASI',
                   't1': 'Bu belge,', 't2': 'adlı kişinin aşağıdaki eğitimi başarıyla tamamladığını onaylar.',
                   'date': 'Tarih', 'no': 'Sertifika No', 'level_lbl': 'Zorluk Seviyesi',
                   'verify': 'Doğrulama', 'sign': 'Atahorse AI Eğitim Platformu',
                   'scan': 'Sertifikayı doğrulamak için QR kodu okutun'},
            'en': texts['en'],
            'ru': {'sub': 'ПЕРСОНАЛИЗИРОВАННАЯ AI-ПЛАТФОРМА ОБРАЗОВАНИЯ', 'type': 'СЕРТИФИКАТ ОБ ОКОНЧАНИИ',
                   't1': 'Настоящий сертификат подтверждает, что', 't2': 'успешно завершил(а) следующий курс.',
                   'date': 'Дата', 'no': '№ сертификата', 'level_lbl': 'Уровень сложности',
                   'verify': 'Проверить:', 'sign': 'Atahorse AI — образовательная платформа',
                   'scan': 'Отсканируйте QR-код для проверки сертификата'},
        }
        t = t_utf8.get(lang, t_utf8['tr'])
    else:
        # Turkce karakterleri ASCII'ye cevir (Helvetica WinAnsi Turkce desteklemez)
        tr_map = str.maketrans('ğĞşŞıİçÇöÖüÜ', 'gGsSiIcCoOuU')
        user_name = user_name.translate(tr_map)
        course_title = course_title.translate(tr_map)
    lv = (level or 'beginner').lower()
    lv_map = {
        'beginner':     {'tr': 'BAŞLANGIÇ' if F["reg"] != "Helvetica" else 'BASLANGIC', 'en': 'BEGINNER',     'col': AMBER,  'txt': colors.HexColor('#1a1206')},
        'intermediate': {'tr': 'ORTA',      'en': 'INTERMEDIATE', 'col': PURPLE, 'txt': WHITE},
        'advanced':     {'tr': 'İLERİ' if F["reg"] != "Helvetica" else 'ILERI',      'en': 'ADVANCED',     'col': NAVY,   'txt': AMBER},
    }
    lv_info = lv_map.get(lv, lv_map['beginner'])
    lv_name = lv_info.get(lang, lv_info['en'])

    # --- zemin ---
    c.setFillColor(IVORY)
    c.rect(0, 0, W, H, stroke=0, fill=1)

    # --- cift cerceve ---
    c.setStrokeColor(NAVY); c.setLineWidth(3)
    c.rect(24, 24, W-48, H-48)
    c.setStrokeColor(AMBER); c.setLineWidth(1.2)
    c.rect(32, 32, W-64, H-64)
    c.setStrokeColor(AMBER); c.setLineWidth(3)
    for cxx, cyy, dx, dy in [(24,24,1,1),(W-24,24,-1,1),(24,H-24,1,-1),(W-24,H-24,-1,-1)]:
        c.line(cxx, cyy, cxx+26*dx, cyy)
        c.line(cxx, cyy, cxx, cyy+26*dy)

    cx = W / 2

    # --- logo ---
    try:
        logo = ImageReader(os.path.join(BASE_DIR, 'static', 'img', 'logo.png'))
        c.drawImage(logo, cx-26, H-108, width=52, height=52, mask='auto')
    except Exception:
        pass

    # --- marka (kucuk, sade) ---
    c.setFillColor(NAVY)
    c.setFont(F['bold'], 15)
    c.drawCentredString(cx, H-126, "ATAHORSE.AI")
    c.setFillColor(GRAY)
    c.setFont(F['reg'], 7.5)
    c.drawCentredString(cx, H-138, t['sub'])

    # --- sertifika tipi rozeti ---
    c.setFillColor(AMBER)
    c.roundRect(cx-140, H-184, 280, 28, 6, stroke=0, fill=1)
    c.setFillColor(colors.HexColor('#1a1206'))
    c.setFont(F['bold'], 13)
    c.drawCentredString(cx, H-175, t['type'])

    # --- metinler: orta eksende hizali, temiz punto hiyerarsisi ---
    c.setFillColor(GRAY)
    c.setFont(F['reg'], 11)
    c.drawCentredString(cx, H-228, t['t1'])

    c.setFillColor(NAVY)
    c.setFont(F['bold'], 34)
    c.drawCentredString(cx, H-264, user_name)

    c.setStrokeColor(AMBER); c.setLineWidth(1.6)
    c.line(cx-150, H-278, cx+150, H-278)

    c.setFillColor(GRAY)
    c.setFont(F['reg'], 11)
    c.drawCentredString(cx, H-300, t['t2'])

    c.setFillColor(INK)
    c.setFont(F['bold'], 20)
    title = course_title if len(course_title) <= 60 else course_title[:57] + '...'
    c.drawCentredString(cx, H-330, title)

    # --- seviye rozeti (orta eksende, kurs adinin altinda) ---
    bw, bh = 150, 44
    bx, by = cx-bw/2, H-396
    c.setFillColor(lv_info['col'])
    c.roundRect(bx, by, bw, bh, 8, stroke=0, fill=1)
    c.setFillColor(lv_info['txt'])
    c.setFont(F['reg'], 7.5)
    c.drawCentredString(cx, by+29, t['level_lbl'].upper())
    c.setFont(F['bold'], 12)
    c.drawCentredString(cx, by+13, lv_name)

    # --- marka imzasi (orta eksende) ---
    c.setFillColor(NAVY)
    c.setFont(F['oblique'], 17)
    c.drawCentredString(cx, 132, "Atahorse")
    c.setFillColor(GRAY)
    c.setFont(F['reg'], 8)
    c.drawCentredString(cx, 118, t['sign'])

    # --- tarih + bireysel sertifika no (tek ortali satir) ---
    c.setFillColor(INK)
    c.setFont(F['bold'], 10)
    c.drawCentredString(cx, 94, f"{t['date']}: {date_str}   |   {t['no']}: {cert_code}")
    c.setFont(F['reg'], 8.5)
    c.setFillColor(AMBER_D)
    c.drawCentredString(cx, 76, f"{t['verify']}: atahorse.ai/verify/{cert_code}")

    # --- QR kod (sol alt: dogrulama) ---
    try:
        import qrcode
        qr = qrcode.QRCode(border=1, box_size=4)
        qr.add_data(f"https://atahorse.ai/verify/{cert_code}")
        qr.make()
        qr_img = qr.make_image(fill_color="#1E1B4B", back_color="white")
        qr_buf = BytesIO(); qr_img.save(qr_buf, format="PNG"); qr_buf.seek(0)
        c.drawImage(ImageReader(qr_buf), 64, 56, width=72, height=72)
        c.setFillColor(GRAY)
        c.setFont(F['reg'], 7)
        c.drawCentredString(100, 44, t['scan'])
    except Exception:
        pass

    # --- altin at muhuru (sag alt: onay) ---
    sx, sy = W-112, 92
    c.setStrokeColor(AMBER_D); c.setLineWidth(2.2)
    c.circle(sx, sy, 40, stroke=1, fill=0)
    c.setStrokeColor(GOLD_L); c.setLineWidth(1)
    c.circle(sx, sy, 36, stroke=1, fill=0)
    c.setFillColor(AMBER)
    c.circle(sx, sy, 30, stroke=0, fill=1)
    try:
        logo2 = ImageReader(os.path.join(BASE_DIR, 'static', 'img', 'logo.png'))
        c.drawImage(logo2, sx-19, sy-13, width=38, height=38, mask='auto')
    except Exception:
        c.setFillColor(colors.HexColor('#1a1206'))
        c.setFont(F['bold'], 14)
        c.drawCentredString(sx, sy-5, "AI")
    c.setFillColor(AMBER_D)
    c.setFont(F['bold'], 8.5)
    c.drawCentredString(sx, sy-48, "ONAYLI")

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


# ================= ROTALAR =================

def _member_home():
    """Uyelik sonrasi ana sayfa: kurslar, seri, kota, blueprint."""
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM courses WHERE user_id = ? ORDER BY created_at DESC", (current_user.id,))
    courses = c.fetchall()
    conn.close()
    streak = touch_streak(current_user.id)
    remaining = max(0, FREE_COURSE_LIMIT - (current_user.courses_used or 0)) if current_user.plan == 'free' else None
    bp = cognitive_blueprint(current_user.learning_style, current_user.brain_lobe)
    # Yapilacaklar: tum aktif kurslardan tamamlanmamis gorevler
    todo = []
    for course in courses:
        if course["completed"]:
            continue
        try:
            mods = json.loads(course["modules"]) if course["modules"] else []
        except Exception:
            mods = []
        try:
            tstate = json.loads(course["tasks_state"]) if course["tasks_state"] else {}
        except Exception:
            tstate = {}
        for mi, m in enumerate(mods):
            for ti, t in enumerate(m.get("tasks") or []):
                st = tstate.get(str(mi), {}).get(str(ti), False)
                if st is not True:
                    todo.append({"course_id": course["id"], "title": course["title"],
                                 "mi": mi, "task": t, "pending": st == "pending"})
    return render_template("home.html", courses=courses,
                           ollama_status=ollama_available(),
                           remaining=remaining, free_limit=FREE_COURSE_LIMIT,
                           blueprint_title=bp[0], blueprint_desc=bp[1], streak=streak,
                           todo=todo[:10])

@app.route("/")
def index():
    # Uye giris yaptiysa landing yerine uyelik ana sayfasini goster
    if current_user.is_authenticated:
        if not current_user.onboarded:
            return redirect(url_for("onboarding"))
        return _member_home()
    conn = get_db(); c = conn.cursor()
    c.execute("""SELECT courses.*, users.full_name as author FROM courses
                 LEFT JOIN users ON courses.user_id = users.id
                 WHERE courses.completed = 1 ORDER BY courses.id DESC LIMIT 6""")
    popular = c.fetchall()
    stats = {
        'learners': conn.execute("SELECT COUNT(*) FROM users WHERE is_admin = 0").fetchone()[0],
        'certificates': conn.execute("SELECT COUNT(*) FROM certificates").fetchone()[0],
        'courses': conn.execute("SELECT COUNT(*) FROM courses").fetchone()[0],
    }
    conn.close()
    return render_template("index.html", popular=popular, stats=stats)

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username","").strip()
        email = request.form.get("email","").strip()
        password = request.form.get("password","").strip()
        full_name = request.form.get("full_name","").strip()
        if not all([username, email, password]):
            flash(_("Tüm zorunlu alanları doldurun."), "danger")
            return redirect(url_for("register"))
        conn = get_db(); c = conn.cursor()
        c.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
        if c.fetchone():
            flash(_("Bu kullanıcı adı veya e-posta zaten kullanılıyor."), "danger")
            conn.close(); return redirect(url_for("register"))
        c.execute("INSERT INTO users (username,email,password_hash,full_name) VALUES (?,?,?,?)",
                  (username, email, generate_password_hash(password), full_name))
        conn.commit(); conn.close()
        flash(_("Kayıt başarılı! Şimdi giriş yapabilirsiniz."), "success")
        return redirect(url_for("login"))
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username","").strip()
        password = request.form.get("password","").strip()
        conn = get_db(); c = conn.cursor()
        c.execute("SELECT * FROM users WHERE username = ?", (username,))
        u = c.fetchone(); conn.close()
        if u and check_password_hash(u["password_hash"], password):
            login_user(User(u["id"],u["username"],u["email"],u["full_name"] or u["username"],
                            u["learning_style"] or "karma", u["brain_lobe"] or "karma",
                            u["plan"] or "free", u["is_admin"] or 0,
                            u["courses_used"] if u["courses_used"] is not None else 0,
                            u["onboarded"] or 0, u["theme"] if "theme" in u.keys() else None))
            touch_streak(u["id"])
            # Onboarding: ilk giris → analiz
            if not u["onboarded"]:
                return redirect(url_for("onboarding"))
            flash(_("Hoş Geldin") + f", {u['full_name'] or u['username']}!", "success")
            return redirect(url_for("index"))
        flash(_("Kullanıcı adı veya şifre hatalı."), "danger")
    return render_template("login.html")

@app.route("/onboarding")
@login_required
def onboarding():
    return render_template("onboarding.html")

@app.route("/onboarding/complete")
@login_required
def onboarding_complete():
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE users SET onboarded = 1 WHERE id = ?", (current_user.id,))
    conn.commit(); conn.close()
    return redirect(url_for("dashboard"))

@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash(_("Çıkış yapıldı."), "info")
    return redirect(url_for("index"))

# === FREEMIUM ===
FREE_COURSE_LIMIT = 3

def cognitive_blueprint(style, lobe):
    """Kullanicinin ogrenme stili + beyin lobuna gore Bilişsel Kimlik metni."""
    combos = {
        ("gorsel", "left"):   (_("Analitik Zihin Mimarı"), _("Kavram haritaları ve yapılandırılmış şemalarla %60 daha hızlı öğrenir.")),
        ("gorsel", "right"):  (_("Görsel Hikâye Anlatıcısı"), _("Büyük resmi görselleştirerek hatırlar; diyagramlar ve renk kodları en güçlü silahıdır.")),
        ("isitsel", "left"):  (_("Sistematik Dinleyici"), _("Adım adım sesli anlatım ve ritmik tekrarlarla detaylı bilgiyi işler.")),
        ("isitsel", "right"): (_("Sezgisel Dinleyici"), _("Sohbet havasında anlatılan konuları konuşarak ve dinleyerek içselleştirir.")),
        ("kinestetik", "left"): (_("Uygulayıcı Mühendis"), _("Her kuralı hemen deneyerek öğrenir; kontrol listeleri ve mikro görevlerle parlar.")),
        ("kinestetik", "right"): (_("Deneyimsel Kaşif"), _("Gerçek hayat vakaları ve projeler aracılığıyla öğrenir; teoriyi uygulamada sever.")),
    }
    return combos.get((style, lobe), ( _("Dengeli Bilişsel Profil"), _("Görsel, işitsel ve kinestetik yolların hepsini kullanarak esnek öğrenirsin.") ))

@app.route("/dashboard")
@login_required
def dashboard():
    if not current_user.onboarded:
        return redirect(url_for("onboarding"))
    return _member_home()

@app.route("/profilim")
@login_required
def profilim():
    if not current_user.onboarded:
        return redirect(url_for("onboarding"))
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM users WHERE id = ?", (current_user.id,))
    me = c.fetchone()
    # Kurs istatistikleri
    c.execute("SELECT COUNT(*) FROM courses WHERE user_id=?", (current_user.id,))
    course_total = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM courses WHERE user_id=? AND completed=1", (current_user.id,))
    course_done = c.fetchone()[0]
    c.execute("SELECT AVG(progress) FROM courses WHERE user_id=?", (current_user.id,))
    avg_prog = c.fetchone()[0] or 0
    c.execute("SELECT COUNT(*) FROM certificates WHERE user_id=?", (current_user.id,))
    cert_count = c.fetchone()[0]
    # Gorev onay orani
    c.execute("SELECT tasks_state, modules FROM courses WHERE user_id=?", (current_user.id,))
    task_total = task_done = 0
    for row in c.fetchall():
        try:
            tstate = json.loads(row["tasks_state"]) if row["tasks_state"] else {}
            mods = json.loads(row["modules"]) if row["modules"] else []
        except Exception:
            continue
        for mi2, m in enumerate(mods):
            for ti2 in range(len(m.get("tasks") or [])):
                task_total += 1
                if tstate.get(str(mi2), {}).get(str(ti2), False) is True:
                    task_done += 1
    # Onerilen kurslar: toplulugun tamamladigi, bende olmayan
    c.execute("""SELECT courses.*, users.full_name as author FROM courses
                 LEFT JOIN users ON courses.user_id = users.id
                 WHERE courses.completed = 1 AND courses.user_id != ?
                 ORDER BY courses.id DESC LIMIT 4""", (current_user.id,))
    recommended = c.fetchall()
    conn.close()
    bp = cognitive_blueprint(current_user.learning_style, current_user.brain_lobe)
    return render_template("profilim.html", me=me,
                           course_total=course_total, course_done=course_done,
                           avg_prog=round(avg_prog), cert_count=cert_count,
                           task_total=task_total, task_done=task_done,
                           blueprint_title=bp[0], blueprint_desc=bp[1],
                           recommended=recommended)


@app.route("/pricing")
def pricing():
    return render_template("pricing.html")

# === SIMÜLE ÖDEME (gerçek ödeme sonraki sprint) ===
@app.route("/upgrade", methods=["GET","POST"])
@login_required
def upgrade():
    if request.method == "POST":
        plan = request.form.get("plan","monthly")
        prices = {'monthly': 199, 'yearly': 1499, 'course': 49, 'certificate': 29}
        amount = prices.get(plan, 199)
        desc_map = {'monthly':'Aylık Premium','yearly':'Yıllık Premium','course':'Ek Kurs Hakkı','certificate':'Sertifika Paketi'}
        conn = get_db(); c = conn.cursor()
        c.execute("INSERT INTO payments (user_id,amount,payment_type,description) VALUES (?,?,?,?)",
                  (current_user.id, amount, plan, desc_map.get(plan, plan)))
        if plan in ('monthly','yearly'):
            c.execute("UPDATE users SET plan = 'premium' WHERE id = ?", (current_user.id,))
        elif plan == 'course':
            c.execute("UPDATE users SET courses_used = MAX(0, courses_used - 1) WHERE id = ?", (current_user.id,))
        conn.commit(); conn.close()
        flash(f"✅ {desc_map.get(plan,plan)} aktif! (Simüle ödeme - gerçek entegrasyon yakında)", "success")
        return redirect(url_for("dashboard"))
    return render_template("upgrade.html")

@app.route("/learning-test", methods=["GET", "POST"])
@login_required
def learning_test():
    if request.method == "POST":
        answers = request.form
        v = a = k = l = r = 0
        for key, val in answers.items():
            if key.startswith("q"):
                if val == "visual": v += 1
                elif val == "auditory": a += 1
                elif val == "kinesthetic": k += 1
            elif key.startswith("b"):
                if val == "left": l += 1
                elif val == "right": r += 1
        style = "gorsel" if v >= max(a,k) else ("isitsel" if a >= max(v,k) else "kinestetik")
        lobe = "sol" if l > r else ("sag" if r > l else "karma")
        conn = get_db(); c = conn.cursor()
        c.execute("UPDATE users SET learning_style=?, brain_lobe=?, onboarded=1 WHERE id=?",
                  (style, lobe, current_user.id))
        conn.commit(); conn.close()
        flash(_("Öğrenme stiliniz belirlendi!") + f" Stil: {style.upper()}, Lob: {lobe.upper()}", "success")
        # Onboarding akisi: testten sonra kurs olusturmaya yonlendir
        if request.args.get('onboarding'):
            return redirect(url_for("generate_course"))
        return redirect(url_for("dashboard"))
    onboarding = request.args.get('onboarding') == '1'
    return render_template("learning_test.html", onboarding=onboarding)

@app.route("/skip-test")
@login_required
def skip_test():
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE users SET learning_style='karma', brain_lobe='karma', onboarded=1 WHERE id=?",
              (current_user.id,))
    conn.commit(); conn.close()
    flash(_("Test atlandı."), "info")
    return redirect(url_for("dashboard"))

@app.route("/generate-course", methods=["GET", "POST"])
@login_required
def generate_course():
    # Freemium kontrolu
    if current_user.plan == 'free' and current_user.courses_used >= FREE_COURSE_LIMIT:
        flash(tr('courses_remaining') + ": 0 — " + tr('upgrade'), "warning")
        return redirect(url_for("pricing"))

    if request.method == "POST":
        topic = request.form.get("topic","").strip()
        level = request.form.get("level","orta")
        if not topic:
            flash(_("Lütfen bir konu girin."), "danger")
            return redirect(url_for("generate_course"))
        conn = get_db(); c = conn.cursor()
        c.execute("SELECT learning_style, brain_lobe FROM users WHERE id=?", (current_user.id,))
        prefs = c.fetchone(); conn.close()
        style = prefs["learning_style"] if prefs else "karma"
        lobe = prefs["brain_lobe"] if prefs else "karma"
        lang = session.get('lang','tr')

        flash(_("AI kursunuzu oluşturuyor..."), "info")
        data = generate_course_content(topic, level, style, lobe, lang)

        conn = get_db(); c = conn.cursor()
        c.execute("""INSERT INTO courses (user_id,title,topic,level,learning_style,content,modules,sources)
                     VALUES (?,?,?,?,?,?,?,?)""",
                  (current_user.id, data["title"], topic, level, style, data["description"],
                   json.dumps(data["modules"], ensure_ascii=False),
                   json.dumps(data.get("sources", []), ensure_ascii=False)))
        cid = c.lastrowid
        c.execute("UPDATE users SET courses_used = courses_used + 1 WHERE id=?", (current_user.id,))
        conn.commit(); conn.close()
        flash(_("Kursunuz başarıyla oluşturuldu!"), "success")
        return redirect(url_for("view_course", course_id=cid))
    bp = cognitive_blueprint(current_user.learning_style, current_user.brain_lobe)
    return render_template("course_generator.html", blueprint_title=bp[0], blueprint_desc=bp[1])

def touch_streak(user_id):
    """Gun serisini gunceller: bugun ilk ziyaretse arttirir, kesinti varsa sifirlar."""
    today = datetime.date.today()
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT streak, last_active FROM users WHERE id=?", (user_id,))
    row = c.fetchone()
    streak = row["streak"] or 0
    last = row["last_active"]
    if last != today.isoformat():
        yesterday = (today - datetime.timedelta(days=1)).isoformat()
        streak = (streak + 1) if last == yesterday else 1
        c.execute("UPDATE users SET streak=?, last_active=? WHERE id=?", (streak, today.isoformat(), user_id))
        conn.commit()
    conn.close()
    return streak

@app.route("/course/<int:course_id>")
@login_required
def view_course(course_id):
    streak = touch_streak(current_user.id)
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM courses WHERE id=? AND user_id=?", (course_id, current_user.id))
    course = c.fetchone()
    if not course:
        conn.close()
        flash(_("Kurs bulunamadı."), "danger")
        return redirect(url_for("dashboard"))
    modules = json.loads(course["modules"]) if course["modules"] else []
    sources = json.loads(course["sources"]) if course["sources"] else []
    try: tasks_state = json.loads(course["tasks_state"]) if course["tasks_state"] else {}
    except Exception: tasks_state = {}
    try: mindmap = json.loads(course["mindmap"]) if course["mindmap"] else []
    except Exception: mindmap = []

    # Kilitli moduller: onceki modulun tum gorevleri bitmeden acilmaz
    def module_done(mi):
        tasks = modules[mi].get("tasks", []) if mi < len(modules) else []
        if not tasks: return True
        return all(tasks_state.get(str(mi), {}).get(str(ti), False) is True for ti in range(len(tasks)))
    locked = [False] + [not module_done(i - 1) for i in range(1, len(modules))]

    # Degerlendirme durumu (sertifika hedefi paneli icin)
    c.execute("SELECT id FROM quizzes WHERE course_id=? AND user_id=? AND status='graded'", (course_id, current_user.id))
    quiz_ok = c.fetchone() is not None
    c.execute("SELECT id FROM submissions WHERE course_id=? AND user_id=?", (course_id, current_user.id))
    sub_ok = c.fetchone() is not None
    assessment_done = quiz_ok or sub_ok
    all_tasks_done = all(module_done(i) for i in range(len(modules)))
    conn.close()

    # Anlik pekistirme kartlari (Duolingo tarzi): her modul icin 2 secenekli mini soru
    import random as _rnd
    def clean_title(t):
        import re as _re
        return _re.sub(r'^\d+\.\s*', '', (t or '')).strip()
    reviews = []
    for i, m in enumerate(modules):
        correct = clean_title(m.get("title"))[:60]
        others = [clean_title(mm.get("title"))[:60] for j, mm in enumerate(modules) if j != i and clean_title(mm.get("title"))]
        if not correct: correct = (course["topic"] or "")[:60]
        if not correct: continue
        distractor = _rnd.choice(others) if others else (course["topic"] or "Başka bir konu")[:60]
        opts = [correct, distractor]
        _rnd.shuffle(opts)
        reviews.append({"mi": i, "question": _("Bu modülde hangi kavram işleniyor?"), "options": opts,
                        "correct_index": opts.index(correct)})

    return render_template("course_view.html", course=course, modules=modules, sources=sources,
                           tasks_state=tasks_state, mindmap=mindmap,
                           locked=locked, streak=streak, reviews=reviews,
                           all_tasks_done=all_tasks_done, assessment_done=assessment_done)

@app.route("/api/update-progress/<int:course_id>", methods=["POST"])
@login_required
def update_progress(course_id):
    data = request.get_json()
    conn = get_db(); c = conn.cursor()
    # completed asla geriye alinmasin (ilerleme kaydi tamamlanmisi sifirlamasin)
    c.execute("""UPDATE courses SET progress=?,
                 completed = CASE WHEN completed=1 THEN 1 ELSE ? END
                 WHERE id=? AND user_id=?""",
              (data.get("progress",0), data.get("completed",0), course_id, current_user.id))
    conn.commit(); conn.close()
    return jsonify({"success": True})

@app.route("/api/approve-task/<int:course_id>", methods=["POST"])
@login_required
def approve_task(course_id):
    """Gorev onayi: ogrenci isaretler -> AI incelemesi -> onaylanir."""
    data = request.get_json(force=True, silent=True) or {}
    mi, ti = str(data.get("mi", "")), str(data.get("ti", ""))
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT tasks_state FROM courses WHERE id=? AND user_id=?", (course_id, current_user.id))
    row = c.fetchone()
    if not row:
        conn.close(); return jsonify({"ok": False}), 404
    try:
        state = json.loads(row["tasks_state"]) if row["tasks_state"] else {}
    except Exception:
        state = {}
    state.setdefault(mi, {})[ti] = True
    c.execute("UPDATE courses SET tasks_state=? WHERE id=?",
              (json.dumps(state, ensure_ascii=False), course_id))
    conn.commit(); conn.close()
    return jsonify({"ok": True})


@app.route("/api/course-state/<int:course_id>", methods=["POST"])
@login_required
def save_course_state(course_id):
    """Görev durumları, öğrenme modu seçimi ve kişisel zihin haritasını kaydeder."""
    data = request.get_json(force=True, silent=True) or {}
    sets, vals = [], []
    if "tasks" in data:
        sets.append("tasks_state=?"); vals.append(json.dumps(data["tasks"], ensure_ascii=False))
    if "mode" in data:
        sets.append("mode_override=?"); vals.append(str(data["mode"])[:20])
    if "mindmap" in data:
        sets.append("mindmap=?"); vals.append(json.dumps(data["mindmap"], ensure_ascii=False))
    if not sets:
        return jsonify({"success": False}), 400
    conn = get_db(); c = conn.cursor()
    c.execute(f"UPDATE courses SET {', '.join(sets)} WHERE id=? AND user_id=?", vals + [course_id, current_user.id])
    conn.commit(); conn.close()
    return jsonify({"success": True})

@app.route("/api/assist", methods=["POST"])
@login_required
def assist():
    """Bilissel Asistan: Ollama aciksa modul icerigiyle cevap uretir."""
    data = request.get_json(force=True, silent=True) or {}
    action = data.get("action", "")
    course_id = int(data.get("course_id", 0))
    module_idx = int(data.get("module", 0))
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM courses WHERE id=? AND user_id=?", (course_id, current_user.id))
    course = c.fetchone(); conn.close()
    if not course:
        return jsonify({"ok": False, "msg": _("Kurs bulunamadı.")}), 404
    modules = json.loads(course["modules"]) if course["modules"] else []
    if module_idx >= len(modules):
        return jsonify({"ok": False, "msg": _("Modül bulunamadı.")}), 404
    m = modules[module_idx]
    if not ollama_available():
        return jsonify({"ok": False, "msg": _("AI şu an kapalı. Ollama başlatıldığında bu özellik çalışır.")})
    base_prompt = (
        f"Kurs: {course['title']}\nKonu: {course['topic']}\nSeviye: {course['level']}\n"
        f"Modül: {m.get('title')}\nModül içeriği:\n{(m.get('content') or '')[:1600]}\n\n"
    )
    prompts = {
        "explain": base_prompt + "Bu modüldeki kavramları gerçek hayattan 3 somut örnekle açıkla. Kısa, net maddeler halinde yaz.",
        "schema": base_prompt + "Bu modülün kavramlarını hiyerarşik bir şema (ağaç yapısı, madde işaretleriyle) olarak düzenle. Başlık: modül başlığı.",
        "summary": base_prompt + "Bu modülün 30 saniyede okunabilecek kısa bir özetini yaz (3-4 cümle).",
    }
    if action == "branch":
        node = (data.get("node") or "").strip()[:120]
        question = (data.get("question") or "").strip()[:300]
        prompts["branch"] = (
            base_prompt +
            f"Zihin haritası düğümü: '{node}'\nÖğrencinin sorusu: {question}\n\n"
            "Bu düğüm için tam 3 kısa dal başlığı üret. Kurallar: her satırda yalnızca bir dal başlığı olsun; "
            "başlıklar en fazla 6 kelime ve tamamen maddi (isim/ek fiil) olsun; madde işareti, numara veya açıklama yazma; "
            "ders kapsamına girmese de konu öğrenmeye hizmet ediyorsa kullan. Sadece 3 satır başlık döndür."
        )
    if action not in prompts:
        return jsonify({"ok": False, "msg": _("Geçersiz istek.")}), 400
    try:
        text = ollama_chat(prompts[action], system_prompt="Sen sade ve anlaşılır açıklayan bir eğitim asistanısın. Türkçe cevap ver.")
        return jsonify({"ok": True, "text": text})
    except Exception:
        return jsonify({"ok": False, "msg": _("AI yanıtı alınamadı, tekrar dene.")})

@app.route("/api/complete-course/<int:course_id>", methods=["POST"])
@login_required
def complete_course(course_id):
    """Kursu ancak tüm görevler bitince + değerlendirme (AI onayı) tamamlanınca bitirir."""
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM courses WHERE id=? AND user_id=?", (course_id, current_user.id))
    course = c.fetchone()
    if not course:
        conn.close(); return jsonify({"ok": False, "reason": "notfound"}), 404

    # 1) Tüm görevler tamamlanmış olmalı
    tasks_done = True
    try:
        state = json.loads(course["tasks_state"]) if course["tasks_state"] else {}
    except Exception:
        state = {}
    modules = json.loads(course["modules"]) if course["modules"] else []
    for mi, m in enumerate(modules):
        for ti, _t in enumerate(m.get("tasks", [])):
            if state.get(str(mi), {}).get(str(ti), False) is not True:
                tasks_done = False
    if not tasks_done:
        conn.close(); return jsonify({"ok": False, "reason": "tasks"})

    # 2) AI onayı: quiz değerlendirilmiş VEYA dosya gönderimi olmalı
    c.execute("SELECT id FROM quizzes WHERE course_id=? AND user_id=? AND status='graded'",
              (course_id, current_user.id))
    quiz_ok = c.fetchone() is not None
    c.execute("SELECT id FROM submissions WHERE course_id=? AND user_id=?", (course_id, current_user.id))
    sub_ok = c.fetchone() is not None
    if not (quiz_ok or sub_ok):
        conn.close(); return jsonify({"ok": False, "reason": "assessment"})

    c.execute("UPDATE courses SET progress=100, completed=1, ai_approved=1 WHERE id=? AND user_id=?",
              (course_id, current_user.id))
    conn.commit(); conn.close()
    return jsonify({"ok": True})

@app.route("/certificate/<int:course_id>")
@login_required
def certificate(course_id):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM courses WHERE id=? AND user_id=?", (course_id, current_user.id))
    course = c.fetchone()
    if not course:
        conn.close(); flash(_("Kurs bulunamadı."), "danger")
        return redirect(url_for("dashboard"))
    if not course["completed"] or not course["ai_approved"]:
        conn.close()
        flash(_("Sertifika almak için tüm görevleri tamamlayıp AI onayını (değerlendirme) geçmeniz gerekiyor."), "warning")
        return redirect(url_for("view_course", course_id=course_id))
    c.execute("SELECT * FROM certificates WHERE course_id=? AND user_id=?", (course_id, current_user.id))
    existing = c.fetchone()
    if existing:
        code = existing["certificate_code"]
    else:
        code = f"Atahorse-{current_user.id}-{course_id}-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
        c.execute("INSERT INTO certificates (user_id,course_id,certificate_code) VALUES (?,?,?)",
                  (current_user.id, course_id, code))
        c.execute("UPDATE courses SET certificate_issued=1 WHERE id=?", (course_id,))
        conn.commit()
    conn.close()
    pdf = generate_certificate_pdf(current_user.full_name or current_user.username,
                                   course["title"], code,
                                   datetime.datetime.now().strftime("%d.%m.%Y"),
                                   session.get('lang','tr'), level=course["level"])
    # Kisisellestirilmis dosya adi (ASCII guvenli)
    tr_map2 = str.maketrans('ğĞşŞıİçÇöÖüÜ', 'gGsSiIcCoOuU')
    def _fname(s, maxlen=26):
        s = s.translate(tr_map2)
        s = ''.join(ch if ch.isalnum() else '_' for ch in s).strip('_')
        return s[:maxlen]
    fname = f"Atahorse_Sertifika_{_fname(current_user.full_name or current_user.username)}_{_fname(course['title'])}_{code[-6:]}.pdf"
    return send_file(pdf, mimetype="application/pdf", as_attachment=True, download_name=fname)


UPLOAD_DIR = os.path.join(os.path.dirname(DB_PATH), "uploads")
ALLOWED_UPLOADS = {
    "note": {".txt", ".pdf", ".png", ".jpg", ".jpeg", ".md", ".docx"},
    "audio": {".mp3", ".wav", ".ogg", ".m4a"},
}

@app.route("/course/<int:course_id>/assessment", methods=["GET", "POST"])
@login_required
def course_assessment(course_id):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM courses WHERE id=? AND user_id=?", (course_id, current_user.id))
    course = c.fetchone()
    if not course:
        conn.close(); flash(_("Kurs bulunamadı."), "danger")
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        action = request.form.get("action", "")

        if action == "quiz":
            c.execute("SELECT * FROM quizzes WHERE course_id=? AND user_id=?", (course_id, current_user.id))
            quiz = c.fetchone()
            if not quiz or quiz["status"] == "graded":
                conn.close()
                return redirect(url_for("course_assessment", course_id=course_id))
            questions = json.loads(quiz["questions"])
            answers = []
            correct = 0
            for i, q in enumerate(questions):
                ans = request.form.get(f"q{i}", "")
                answers.append(ans)
                try:
                    if int(ans) == q["correct_index"]:
                        correct += 1
                except (ValueError, TypeError):
                    pass
            c.execute("""UPDATE quizzes SET answers=?, score=?, max_score=?, status='graded'
                         WHERE id=?""",
                      (json.dumps(answers), correct, len(questions), quiz["id"]))
            conn.commit(); conn.close()
            flash(_("Quiz değerlendirildi:") + f" {correct}/{len(questions)}", "success")
            return redirect(url_for("course_assessment", course_id=course_id))

        if action == "upload":
            kind = request.form.get("kind", "note")
            if kind not in ALLOWED_UPLOADS:
                kind = "note"
            f = request.files.get("file")
            if not f or not f.filename:
                conn.close(); flash(_("Lütfen bir dosya seç."), "danger")
                return redirect(url_for("course_assessment", course_id=course_id))
            ext = os.path.splitext(f.filename)[1].lower()
            if ext not in ALLOWED_UPLOADS[kind]:
                conn.close()
                flash(_("Bu dosya türü desteklenmiyor.") + f" ({ext})", "danger")
                return redirect(url_for("course_assessment", course_id=course_id))
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            safe = f"u{current_user.id}_c{course_id}_{kind}_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
            f.save(os.path.join(UPLOAD_DIR, safe))
            c.execute("""INSERT INTO submissions (course_id,user_id,kind,filename,stored,mime)
                         VALUES (?,?,?,?,?,?)""",
                      (course_id, current_user.id, kind, f.filename, safe, f.mimetype))
            conn.commit(); conn.close()
            flash(_("Dosyan yüklendi! Ekibimiz inceleyecek."), "success")
            return redirect(url_for("course_assessment", course_id=course_id))

    # GET — mevcut quiz / gonderiler
    c.execute("SELECT * FROM quizzes WHERE course_id=? AND user_id=?", (course_id, current_user.id))
    quiz = c.fetchone()
    if not quiz:
        modules_tmp = json.loads(course["modules"]) if course["modules"] else []
        lang_now = session.get('lang','tr')
        # Ollama once dener; kapali/gecersizse fallback quiz devreye girer — hicbir ogrenci quizsiz kalmaz
        qz = generate_quiz(course, modules_tmp, lang_now) or generate_fallback_quiz(course, modules_tmp, lang_now)
        if qz:
            conn.execute('INSERT INTO quizzes (course_id,user_id,questions) VALUES (?,?,?)',
                         (course_id, current_user.id, json.dumps(qz, ensure_ascii=False)))
            conn.commit()
            c.execute("SELECT * FROM quizzes WHERE course_id=? AND user_id=?", (course_id, current_user.id))
            quiz = c.fetchone()
    questions = None
    user_answers = None
    if quiz:
        questions = json.loads(quiz["questions"])
        user_answers = json.loads(quiz["answers"]) if quiz["answers"] else None
    c.execute("""SELECT * FROM submissions WHERE course_id=? AND user_id=?
                 ORDER BY created_at DESC""", (course_id, current_user.id))
    submissions = c.fetchall()
    conn.close()

    conn = get_db(); c = conn.cursor()
    c.execute("SELECT learning_style FROM users WHERE id=?", (current_user.id,))
    style = (c.fetchone() or {"learning_style": "karma"})["learning_style"]
    conn.close()

    return render_template("assessment.html", course=course, quiz=quiz, questions=questions,
                           user_answers=user_answers, submissions=submissions, style=style)

@app.route("/admin/submission/<int:sub_id>/delete", methods=["POST"])
@login_required
@admin_required
def admin_delete_submission(sub_id):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT stored FROM submissions WHERE id=?", (sub_id,))
    row = c.fetchone()
    if row:
        try:
            os.remove(os.path.join(UPLOAD_DIR, row["stored"]))
        except OSError:
            pass
        c.execute("DELETE FROM submissions WHERE id=?", (sub_id,))
        conn.commit()
    conn.close()
    flash(_("Gönderi silindi."), "success")
    return redirect(url_for("admin_dashboard"))


@app.route("/verify/<code>")
def verify_certificate(code):
    """Sertifika doğrulama — herkese açık."""
    conn = get_db(); c = conn.cursor()
    c.execute("""SELECT certificates.*, courses.title as course_title, users.full_name, users.username
                 FROM certificates
                 JOIN courses ON certificates.course_id = courses.id
                 JOIN users ON certificates.user_id = users.id
                 WHERE certificates.certificate_code = ?""", (code,))
    cert = c.fetchone()
    conn.close()
    return render_template("verify.html", cert=cert, code=code)

@app.route("/api/ollama-status")
def ollama_status():
    return jsonify({"available": ollama_available()})

@app.errorhandler(404)
def not_found(e):
    return render_template("index.html", popular=[], stats={'learners':0,'certificates':0,'courses':0}), 404

# ================= ADMIN PANEL =================

@app.route("/admin")
@login_required
@admin_required
def admin_dashboard():
    conn = get_db(); c = conn.cursor()
    total_users = c.execute("SELECT COUNT(*) FROM users WHERE is_admin=0").fetchone()[0]
    premium = c.execute("SELECT COUNT(*) FROM users WHERE plan='premium' AND is_admin=0").fetchone()[0]
    free = total_users - premium
    total_courses = c.execute("SELECT COUNT(*) FROM courses").fetchone()[0]
    completed = c.execute("SELECT COUNT(*) FROM courses WHERE completed=1").fetchone()[0]
    certificates = c.execute("SELECT COUNT(*) FROM certificates").fetchone()[0]
    revenue = c.execute("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='completed'").fetchone()[0]
    completion_rate = round((completed / total_courses * 100) if total_courses else 0, 1)

    c.execute("""SELECT payments.*, users.username FROM payments
                 LEFT JOIN users ON payments.user_id = users.id
                 ORDER BY payments.created_at DESC LIMIT 10""")
    payments = c.fetchall()
    c.execute("SELECT * FROM users WHERE is_admin=0 ORDER BY created_at DESC")
    users = c.fetchall()
    c.execute("""SELECT courses.*, users.username FROM courses
                 LEFT JOIN users ON courses.user_id = users.id ORDER BY courses.id DESC""")
    all_courses = c.fetchall()

    # Son 7 gunluk kayit grafigi
    c.execute("""SELECT date(created_at) as d, COUNT(*) as cnt FROM users
                 WHERE created_at >= date('now','-7 days') AND is_admin=0
                 GROUP BY date(created_at)""")
    signup_data = c.fetchall()

    # Quiz sonuclari ve ogrenci gonderileri
    c.execute("""SELECT quizzes.*, users.username, courses.title as course_title FROM quizzes
                 LEFT JOIN users ON quizzes.user_id = users.id
                 LEFT JOIN courses ON quizzes.course_id = courses.id
                 ORDER BY quizzes.id DESC LIMIT 30""")
    quiz_results = c.fetchall()
    c.execute("""SELECT submissions.*, users.username, courses.title as course_title FROM submissions
                 LEFT JOIN users ON submissions.user_id = users.id
                 LEFT JOIN courses ON submissions.course_id = courses.id
                 ORDER BY submissions.id DESC LIMIT 50""")
    all_submissions = c.fetchall()
    conn.close()
    return render_template("admin/dashboard.html", total_users=total_users, premium=premium, free=free,
                           total_courses=total_courses, completed=completed, certificates=certificates,
                           revenue=revenue, completion_rate=completion_rate, payments=payments,
                           users=users, all_courses=all_courses, signup_data=signup_data,
                           quiz_results=quiz_results, all_submissions=all_submissions)

@app.route("/admin/user/<int:user_id>/plan", methods=["POST"])
@login_required
@admin_required
def admin_toggle_plan(user_id):
    new_plan = request.form.get("plan")
    if new_plan in ("free","premium"):
        conn = get_db(); c = conn.cursor()
        c.execute("UPDATE users SET plan=? WHERE id=? AND is_admin=0", (new_plan, user_id))
        conn.commit(); conn.close()
        flash(f"Kullanıcı planı {new_plan} olarak güncellendi.", "success")
    return redirect(url_for("admin_dashboard"))

# === PRODUCTION: gunicorn altinda da tablolari olustur ===
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
init_db()

@app.route("/admin/change-password", methods=["GET", "POST"])
@login_required
@admin_required
def admin_change_password():
    if request.method == "POST":
        current_pw = request.form.get("current_password", "")
        new_pw = request.form.get("new_password", "")
        confirm_pw = request.form.get("confirm_password", "")
        conn = get_db(); c = conn.cursor()
        row = conn.execute("SELECT password_hash FROM users WHERE id=?", (current_user.id,)).fetchone()
        if not row or not check_password_hash(row["password_hash"], current_pw):
            flash("Mevcut şifre hatalı.", "danger")
        elif len(new_pw) < 8:
            flash("Yeni şifre en az 8 karakter olmalı.", "danger")
        elif new_pw != confirm_pw:
            flash("Yeni şifre tekrarı eşleşmiyor.", "danger")
        elif new_pw == current_pw:
            flash("Yeni şifre mevcut şifreden farklı olmalı.", "danger")
        else:
            c.execute("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(new_pw), current_user.id))
            conn.commit()
            flash("Şifre güncellendi. Yeni şifrenle giriş yapabilirsin.", "success")
        conn.close()
        return redirect(url_for("admin_dashboard"))
    return render_template("admin/change_password.html")

if __name__ == "__main__":
    print("🚀 Atahorse v3 başlatılıyor...")
    print("📍 http://localhost:5000")
    print("👤 Admin: kullanıcı=admin şifre=admin123")
    print("🌐 İnternet: ngrok http 5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
