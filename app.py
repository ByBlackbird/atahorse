"""
Atahorse v3 - AI Destekli Kişiselleştirilmiş Eğitim Platformu
Freemium Model + Admin Panel + Kaynakça + Slayt + Çoklu Dil
"""

import os
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
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
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

# === LOGIN ===
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.login_message = _("Lütfen önce giriş yapın.")
login_manager.login_message_category = "warning"

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "atahorse.db")

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
    def __init__(self, id, username, email, full_name, learning_style, brain_lobe, plan, is_admin, courses_used, onboarded):
        self.id = id; self.username = username; self.email = email
        self.full_name = full_name; self.learning_style = learning_style
        self.brain_lobe = brain_lobe; self.plan = plan; self.is_admin = is_admin
        self.courses_used = courses_used; self.onboarded = onboarded

@login_manager.user_loader
def load_user(user_id):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    u = c.fetchone(); conn.close()
    if u:
        return User(u["id"], u["username"], u["email"], u["full_name"],
                    u["learning_style"], u["brain_lobe"], u["plan"],
                    u["is_admin"], u["courses_used"], u["onboarded"])
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
def ollama_chat(prompt, model="llama3", system_prompt=None):
    try:
        payload = {"model": model, "prompt": prompt, "stream": False,
                   "options": {"temperature": 0.7, "num_predict": 4000}}
        if system_prompt: payload["system"] = system_prompt
        r = requests.post("http://localhost:11434/api/generate", json=payload, timeout=180)
        if r.status_code == 200:
            return r.json().get("response", "")
        return None
    except Exception as e:
        print(f"Ollama hatası: {e}")
        return None

def ollama_available():
    try:
        return requests.get("http://localhost:11434/api/tags", timeout=5).status_code == 200
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
Kullanıcının öğrenme stiline uygun, kapsamlı eğitim içeriği oluşturuyorsun.
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
         "content": "Detaylı konu anlatımı. Her bölüm için slayt halinde paragraflar kullan. ## ile alt başlıklar oluştur. Örnekler, listeler ekle.",
         "duration": "45 dk",
         "tasks": ["görev 1", "görev 2", "görev 3"]}}
    ]
}}
En az 5 modül, her modül zengin içerikli olsun. Görsel öğrenenler için içeriği yapılandırılmış bölümlere ayır."""

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
def generate_certificate_pdf(user_name, course_title, cert_code, date_str, lang='tr'):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4),
                            rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    texts = {
        'tr': {'sub': 'Kişiselleştirilmiş AI Eğitim Platformu', 'type': 'KATILIM SERTİFİKASI',
               't1': 'Bu sertifika', 't2': 'adlı kişinin aşağıdaki eğitimi başarıyla tamamladığını onaylar.',
               'date': 'Tarih', 'no': 'Sertifika No', 'foot': 'Atahorse AI Eğitim Platformu'},
        'en': {'sub': 'Personalized AI Education Platform', 'type': 'CERTIFICATE OF COMPLETION',
               't1': 'This certificate confirms that', 't2': 'has successfully completed the following course.',
               'date': 'Date', 'no': 'Certificate No', 'foot': 'Atahorse AI Education Platform'},
        'ru': {'sub': 'Платформа Персонализированного AI Образования', 'type': 'СЕРТИФИКАТ О ЗАВЕРШЕНИИ',
               't1': 'Настоящий сертификат подтверждает, что', 't2': 'успешно завершил(а) следующий курс.',
               'date': 'Дата', 'no': '№ Сертификата', 'foot': 'Платформа Atahorse AI'}
    }
    t = texts.get(lang, texts['tr'])
    mk = lambda name, parent, size, color, bold=True: ParagraphStyle(name, parent=styles[parent],
        fontSize=size, textColor=colors.HexColor(color), alignment=TA_CENTER,
        spaceAfter=20 if bold else 10, fontName='Helvetica-Bold' if bold else 'Helvetica')
    story = [Spacer(1, 1.5*cm), Paragraph("Atahorse", mk('T','Heading1',48,'#1a365d')),
             Paragraph(t['sub'], mk('S','Normal',18,'#4a5568',False)),
             Spacer(1, 1*cm), Paragraph(t['type'], mk('CT','Heading2',28,'#744210')),
             Spacer(1, 0.5*cm), Paragraph(t['t1'], mk('x','Normal',14,'#4a5568',False)),
             Spacer(1, 0.3*cm), Paragraph(f"<b>{user_name}</b>", mk('N','Heading2',36,'#2c5282')),
             Spacer(1, 0.3*cm), Paragraph(t['t2'], mk('x2','Normal',14,'#4a5568',False)),
             Spacer(1, 0.5*cm), Paragraph(f"<b>{course_title}</b>", mk('C','Heading3',24,'#2d3748')),
             Spacer(1, 1*cm), Paragraph(f"{t['date']}: {date_str}", mk('d','Normal',14,'#4a5568',False)),
             Spacer(1, 0.3*cm), Paragraph(f"{t['no']}: {cert_code}", mk('c','Normal',12,'#718096',False)),
             Spacer(1, 1*cm), Paragraph(t['foot'], mk('f','Normal',10,'#a0aec0',False))]
    doc.build(story)
    buffer.seek(0)
    return buffer

# ================= ROTALAR =================

@app.route("/")
def index():
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
            login_user(User(u["id"],u["username"],u["email"],u["full_name"],u["learning_style"],
                            u["brain_lobe"],u["plan"],u["is_admin"],u["courses_used"],u["onboarded"]))
            # Onboarding: ilk giris → analiz
            if not u["onboarded"]:
                return redirect(url_for("onboarding"))
            flash(_("Hoş Geldin") + f", {u['full_name'] or u['username']}!", "success")
            return redirect(url_for("dashboard"))
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

@app.route("/dashboard")
@login_required
def dashboard():
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM courses WHERE user_id = ? ORDER BY created_at DESC", (current_user.id,))
    courses = c.fetchall()
    conn.close()
    remaining = max(0, FREE_COURSE_LIMIT - current_user.courses_used) if current_user.plan == 'free' else None
    return render_template("dashboard.html", courses=courses,
                           ollama_status=ollama_available(),
                           remaining=remaining, free_limit=FREE_COURSE_LIMIT)

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
    return render_template("course_generator.html")

@app.route("/course/<int:course_id>")
@login_required
def view_course(course_id):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM courses WHERE id=? AND user_id=?", (course_id, current_user.id))
    course = c.fetchone(); conn.close()
    if not course:
        flash(_("Kurs bulunamadı."), "danger")
        return redirect(url_for("dashboard"))
    modules = json.loads(course["modules"]) if course["modules"] else []
    sources = json.loads(course["sources"]) if course["sources"] else []
    return render_template("course_view.html", course=course, modules=modules, sources=sources)

@app.route("/api/update-progress/<int:course_id>", methods=["POST"])
@login_required
def update_progress(course_id):
    data = request.get_json()
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE courses SET progress=?, completed=? WHERE id=? AND user_id=?",
              (data.get("progress",0), data.get("completed",0), course_id, current_user.id))
    conn.commit(); conn.close()
    return jsonify({"success": True})

@app.route("/certificate/<int:course_id>")
@login_required
def certificate(course_id):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM courses WHERE id=? AND user_id=?", (course_id, current_user.id))
    course = c.fetchone()
    if not course:
        conn.close(); flash(_("Kurs bulunamadı."), "danger")
        return redirect(url_for("dashboard"))
    if not course["completed"]:
        conn.close(); flash(_("Sertifika almak için kursu tamamlamanız gerekiyor."), "warning")
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
                                   datetime.datetime.now().strftime("%d %B %Y"),
                                   session.get('lang','tr'))
    return send_file(pdf, mimetype="application/pdf", as_attachment=True,
                     download_name=f"Atahorse_{course['title'][:30].replace(' ','_')}.pdf")

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
    conn.close()
    return render_template("admin/dashboard.html", total_users=total_users, premium=premium, free=free,
                           total_courses=total_courses, completed=completed, certificates=certificates,
                           revenue=revenue, completion_rate=completion_rate, payments=payments,
                           users=users, all_courses=all_courses, signup_data=signup_data)

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

if __name__ == "__main__":
    print("🚀 Atahorse v3 başlatılıyor...")
    print("📍 http://localhost:5000")
    print("👤 Admin: kullanıcı=admin şifre=admin123")
    print("🌐 İnternet: ngrok http 5000")
    app.run(debug=True, host="0.0.0.0", port=5000)
