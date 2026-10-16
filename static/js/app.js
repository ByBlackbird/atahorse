// IEARN - Ana JavaScript Dosyası

document.addEventListener('DOMContentLoaded', () => {
    // Flash mesajlarını otomatik kapat
    const flashes = document.querySelectorAll('.flash');
    flashes.forEach(flash => {
        setTimeout(() => {
            flash.style.opacity = '0';
            flash.style.transform = 'translateY(-10px)';
            setTimeout(() => flash.remove(), 300);
        }, 5000);
    });

    // SVG gradient tanımını ekle (sertifika progress halkası için)
    if (!document.getElementById('svg-gradient-defs')) {
        const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgDefs.setAttribute('width', '0');
        svgDefs.setAttribute('height', '0');
        svgDefs.id = 'svg-gradient-defs';
        svgDefs.innerHTML = `
            <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#2563eb"/>
                    <stop offset="100%" style="stop-color:#7c3aed"/>
                </linearGradient>
            </defs>
        `;
        document.body.appendChild(svgDefs);
    }

    // Ollama durumunu kontrol et (dashboard sayfasında)
    const ollamaStatusEl = document.querySelector('.status-card i.fa-robot');
    if (ollamaStatusEl) {
        checkOllamaStatus();
    }
});

function checkOllamaStatus() {
    fetch('/api/ollama-status')
        .then(r => r.json())
        .then(data => {
            const statusCard = document.querySelector('.status-card:has(i.fa-robot)');
            const statusValue = statusCard?.querySelector('.status-value');
            if (statusValue) {
                statusValue.textContent = data.available ? 'Aktif' : 'Pasif';
            }
            if (statusCard) {
                if (data.available) {
                    statusCard.classList.remove('status-warning');
                } else {
                    statusCard.classList.add('status-warning');
                }
            }
        })
        .catch(() => {});
}

// Form doğrulama
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let valid = true;

    inputs.forEach(input => {
        if (!input.value.trim()) {
            valid = false;
            input.style.borderColor = '#dc2626';
        } else {
            input.style.borderColor = '';
        }
    });

    return valid;
}

// Tüm formlara doğrulama ekle
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', (e) => {
        if (!validateForm(form)) {
            e.preventDefault();
        }
    });
});

// Smooth scroll
function smoothScroll(target) {
    document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
}

// Kopyala fonksiyonu
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Kopyalandı!', 'success');
    });
}

// Toast bildirim
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `flash flash-${type}`;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;animation:slideDown 0.3s ease;';
    toast.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
