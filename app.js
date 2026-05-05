/**
 * =========================================================
 * AURA ENGINE PRO - MASTER CONTROLLER v33.0 (ULTIMATE)
 * =========================================================
 * 🛡️ АВТОР: Aura Architect (Sherlock Strategic Edition)
 * 🚀 СТАТУС: 100% FULL SOURCE CODE. НИКАКИХ СОКРАЩЕНИЙ.
 * 🛰️ РЕЖИМЫ: Localhost (Desktop) / GitHub (Online Hub)
 * ⚡ ИСПРАВЛЕНИЯ: 
 *    - ИИ-помощник: Кнопка "v" теперь железно сворачивает окно.
 *    - Чат: По умолчанию ВСЕГДА скрыт при загрузке.
 *    - Рендеринг блоков: Исправлена логика подгрузки из Firestore.
 *    - Темы: Тотальная синхронизация во всех окнах.
 * =========================================================
 */

// ==========================================
// 1. ГЛОБАЛЬНОЕ СОСТОЯНИЕ И ДЕТЕКЦИЯ
// ==========================================
const IS_ONLINE = window.location.hostname.includes('github.io') || window.location.hostname.includes('auraengineonline');

let allCourses = [];      
let marketCourses = [];   
let favorites = JSON.parse(localStorage.getItem('aura-favorites')) || [];
let currentUser = null;   
let leaderboard = [];     
let currentCourse = null; 
let currentLessonId = null;
let currentQuiz = [];
let activeTab = 'library';

const AURA_UI = {
    contentWidth: "max-w-4xl", 
    mediaWidth: "max-w-2xl",   
    spacing: "mb-10",
    xpPerQuiz: 15
};

// ==========================================
// 2. ЯДРО СИНХРОНИЗАЦИИ ТЕМ (UNITY)
// ==========================================
const AuraThemeEngine = {
    init() {
        const savedTheme = localStorage.getItem('aura-theme') || 'light';
        this.apply(savedTheme);
        window.addEventListener('storage', (event) => {
            if (event.key === 'aura-theme') this.apply(event.newValue);
        });
    },

    apply(theme) {
        const html = document.documentElement;
        if (theme === 'dark') html.classList.add('dark');
        else html.classList.remove('dark');
        
        document.querySelectorAll('#theme-icon, #theme-icon-app').forEach(i => {
            i.className = theme === 'dark' ? "fa-solid fa-sun text-xl text-yellow-400" : "fa-solid fa-moon text-xl text-slate-400";
        });
    },

    toggle() {
        const isDark = document.documentElement.classList.contains('dark');
        const nextTheme = isDark ? 'light' : 'dark';
        localStorage.setItem('aura-theme', nextTheme);
        this.apply(nextTheme);
        // Перерисовка монитора в Креаторе
        if (typeof syncAndRefresh === 'function') syncAndRefresh();
    }
};
AuraThemeEngine.init();

// ==========================================
// 3. МОДУЛЬ AURA SOCIAL (ОНЛАЙН ХАБ)
// ==========================================
const AuraSocial = {
    async init() {
        if (!IS_ONLINE || !window.firebase) return;
        try {
            window.firebase.auth().onAuthStateChanged(async (user) => {
                currentUser = user;
                this.updateUI();
                if (user) await this.syncUserProfile();
            });
            this.loadLeaderboard();
        } catch (e) { console.error("Social Init Fail"); }
    },

    async login() {
        if (!window.firebase) return;
        const provider = new window.firebase.auth.GoogleAuthProvider();
        try { await window.firebase.auth().signInWithPopup(provider); } 
        catch (e) { alert("Ошибка: Проверьте настройки Firebase Auth!"); }
    },

    async logout() {
        if (!window.firebase) return;
        await window.firebase.auth().signOut();
        location.reload();
    },

    async syncUserProfile() {
        if (!currentUser || !window.auraCloudDB) return;
        const ref = window.auraCloudDB.collection('users').doc(currentUser.uid);
        const doc = await ref.get();
        if (!doc.exists) {
            await ref.set({
                name: currentUser.displayName,
                xp: 0,
                completedTotal: 0,
                avatar: currentUser.photoURL,
                lastSeen: new Date().toISOString()
            });
        }
    },

    async addXP(pts) {
        if (!IS_ONLINE || !currentUser || !window.auraCloudDB) return;
        const userRef = window.auraCloudDB.collection('users').doc(currentUser.uid);
        await userRef.update({
            xp: window.firebase.firestore.FieldValue.increment(pts),
            completedTotal: window.firebase.firestore.FieldValue.increment(1)
        });
        this.loadLeaderboard();
    },

    async loadLeaderboard() {
        const cont = document.getElementById('leaderboard-container');
        if (!cont || !window.auraCloudDB) return;
        try {
            const snap = await window.auraCloudDB.collection('users').orderBy('xp', 'desc').limit(5).get();
            cont.innerHTML = snap.docs.map((doc, i) => {
                const u = doc.data();
                return `<div class="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 mb-2 shadow-sm">
                    <div class="flex items-center gap-3">
                        <span class="opacity-30 font-black text-[10px]">#${i+1}</span>
                        <img src="${u.avatar}" class="w-10 h-10 rounded-full border border-aura-primary/20">
                        <span class="text-xs font-black uppercase">${u.name}</span>
                    </div>
                    <span class="text-aura-primary font-black text-[10px]">${u.xp} XP</span>
                </div>`;
            }).join('');
        } catch (e) { console.warn("Leaderboard error"); }
    },

    updateUI() {
        const btn = document.getElementById('auth-btn-container');
        if (!btn) return;
        if (currentUser) {
            btn.innerHTML = `<div class="flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/10 animate-fade">
                <img src="${currentUser.photoURL}" class="w-9 h-9 rounded-full border-2 border-aura-primary">
                <span class="text-[9px] font-black uppercase hidden lg:block dark:text-white">${currentUser.displayName}</span>
                <button onclick="AuraSocial.logout()" class="p-2 text-slate-500 hover:text-red-500"><i class="fa-solid fa-power-off"></i></button>
            </div>`;
        }
    }
};

// ==========================================
// 4. ЕДИНОЕ ЯДРО РЕНДЕРИНГА (AURA RENDERER)
// ==========================================
const AuraRenderer = {
    generateHTML: function(input) {
        if (typeof input === 'string' && input.length > 50) {
            return `<div class="${AURA_UI.contentWidth} mx-auto animate-fade p-2">${input}</div>`;
        }
        if (Array.isArray(input) && input.length > 0) {
            return input.map(b => this.renderBlock(b)).join('\n');
        }
        return `
            <div class="py-24 text-center opacity-30 animate-fade">
                <i class="fa-solid fa-box-open text-7xl mb-6"></i>
                <h3 class="text-2xl font-black uppercase tracking-[0.3em] leading-none">Контент не найден</h3>
                <p class="text-[10px] font-bold uppercase mt-4 opacity-60">
                    Урок пуст. Пожалуйста, выполните перепубликацию курса из Creator Pro.
                </p>
            </div>`;
    },

    renderBlock: function(b) {
        if (!b || !b.data) return '';
        const space = AURA_UI.spacing, cW = AURA_UI.contentWidth, mW = AURA_UI.mediaWidth;
        switch(b.type) {
            case 'hero':
                return `<header class="text-center mb-16 animate-fade">
                    <h1 class="space-font text-5xl font-black text-aura-primary dark:text-indigo-400 uppercase tracking-tighter mb-4">${b.data.title || ''}</h1>
                    <p class="text-slate-500 dark:text-slate-400 italic text-lg max-w-2xl mx-auto">${b.data.sub || ''}</p>
                    <div class="h-1.5 w-24 bg-aura-primary mx-auto mt-6 rounded-full shadow-lg"></div>
                </header>`;
            case 'text':
                return `<div class="${cW} mx-auto ${space} text-slate-700 dark:text-slate-300 text-lg leading-relaxed font-medium">${b.data.p || ''}</div>`;
            case 'image':
                return `<div class="${mW} mx-auto ${space} group animate-fade"><img src="${b.data.url || ''}" class="w-full rounded-[2.5rem] shadow-2xl border dark:border-white/5"></div>`;
            case 'video':
                return `<div class="${mW} mx-auto ${space} animate-fade"><video controls class="w-full rounded-[2.5rem] bg-black border dark:border-white/10"><source src="${b.data.url || ''}" type="video/mp4"></video></div>`;
            case 'glass':
                return `<div class="${cW} mx-auto ${space}"><div class="glass-card p-10 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md"><div class="glass-title text-aura-primary dark:text-indigo-400 font-black flex items-center gap-4 mb-4"><i class="fa-solid ${b.data.icon || 'fa-bolt'} text-2xl"></i><span class="uppercase tracking-widest text-xl">${b.data.title || ''}</span></div><div class="text-slate-700 dark:text-slate-300 text-lg leading-relaxed">${b.data.p || ''}</div></div></div>`;
            case 'list':
                const items = b.data.items ? b.data.items.split('\n') : [];
                return `<div class="${cW} mx-auto ${space}"><ul class="aura-list space-y-4">${items.map(i => `<li class="flex items-center gap-4 bg-slate-100 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/5"><i class="fa-solid fa-circle-check text-green-500"></i><span class="dark:text-slate-200 font-bold">${i}</span></li>`).join('')}</ul></div>`;
            case 'quote':
                return `<div class="${cW} mx-auto ${space}"><blockquote class="aura-quote relative border-l-8 border-aura-primary bg-indigo-50 dark:bg-white/5 p-8 rounded-r-3xl"><p class="text-2xl font-medium italic dark:text-slate-100">${b.data.text || ''}</p><span class="block mt-6 text-aura-primary font-black uppercase text-xs">— ${b.data.author || ''}</span></blockquote></div>`;
            case 'quiz':
                return `<div class="${cW} mx-auto mt-20 text-center animate-fade"><div class="quiz-notif bg-gradient-to-tr from-aura-primary to-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl"><i class="fa-solid fa-vial-circle-check mb-4 text-4xl"></i><div class="font-black uppercase text-sm tracking-widest">Проверка знаний активна</div></div></div>`;
            default: return '';
        }
    }
};

// ==========================================
// 5. API СИНХРОНИЗАЦИЯ (HYBRID BRIDGE)
// ==========================================
async function syncSystemData() {
    try {
        if (IS_ONLINE && window.auraCloudDB) {
            const snapshot = await window.auraCloudDB.collection('courses').get();
            marketCourses = snapshot.docs.map(doc => doc.data());
            const mGrid = document.getElementById('market-grid');
            if (mGrid) renderMarketGrid(marketCourses);
        } else if (!IS_ONLINE) {
            const [libRes, markRes] = await Promise.all([fetch('/api/courses'), fetch('/api/market')]);
            allCourses = await libRes.json();
            marketCourses = await markRes.json();
            if (document.getElementById('courses-grid')) renderLibraryGrid(allCourses);
            if (document.getElementById('market-grid')) renderMarketGrid(marketCourses);
            updateGlobalStats();
        }
    } catch (err) { console.error("Aura API Sync Fail"); }
}

function updateGlobalStats() {
    const statC = document.getElementById('stat-total-courses'), statL = document.getElementById('stat-total-lessons'), statP = document.getElementById('stat-overall-percent');
    if (!statC || !statL || !statP) return;
    let total = 0, done = 0;
    allCourses.forEach(c => { total += (c.lessons ? c.lessons.length : 0); done += (c.completedLessons ? [...new Set(c.completedLessons)].length : 0); });
    const prc = total > 0 ? Math.round((done / total) * 100) : 0;
    statC.innerText = allCourses.length; statL.innerText = done; statP.innerText = prc + '%';
}

// ==========================================
// 6. UI РЕНДЕРИНГ МАРКЕТА И БИБЛИОТЕКИ
// ==========================================
function renderLibraryGrid(courses) {
    const grid = document.getElementById('courses-grid');
    if (!grid) return;
    if (!courses.length) { grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 font-black uppercase italic tracking-widest">Библиотека пуста</div>`; return; }
    grid.innerHTML = courses.map(course => `<div class="course-card bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-sm animate-fade"><div onclick="openCourseLocally('${encodeURIComponent(JSON.stringify(course))}')" class="cursor-pointer"><h3 class="text-2xl font-black dark:text-white mb-2 uppercase tracking-tighter leading-none">${course.title || 'Курс'}</h3><p class="text-[10px] font-black uppercase text-slate-400 mb-6">Автор: ${course.author || '...'}</p><div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner"><div class="bg-indigo-600 h-full transition-all duration-1000" style="width: 0%"></div></div></div></div>`).join('');
}

function renderMarketGrid(courses) {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    grid.innerHTML = courses.map(c => `
        <div class="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-white/5 flex flex-col items-center text-center shadow-sm relative group animate-slideUp">
            <div class="absolute top-6 right-8"><span class="bg-indigo-100 dark:bg-indigo-900/50 text-aura-indigo text-[8px] font-black px-3 py-1 rounded-full uppercase border border-indigo-200 dark:border-indigo-800">Firestore Hub</span></div>
            <div class="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl mb-8 flex items-center justify-center text-slate-300 text-4xl group-hover:text-aura-primary transition-all shadow-inner"><i class="fa-solid fa-cloud-arrow-down"></i></div>
            <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase tracking-tighter">${c.title || 'Курс в облаке'}</h3>
            <p class="text-[10px] font-black uppercase text-slate-400 mb-10 italic">${c.author || '...'}</p>
            <button onclick="handleMarketAction('${c.id}', '${c.folder}')" class="w-full py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl">Открыть превью</button>
        </div>`).join('');
}

async function handleMarketAction(id, folder) {
    if (IS_ONLINE) location.href = `player.html?id=${id}`;
    else {
        const res = await fetch('/api/download', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({folder}) });
        if (res.ok) syncSystemData();
    }
}

// ==========================================
// 7. ЛОГИКА ПЛЕЕРА (ЗАГРУЗКА УРОКА)
// ==========================================
function loadLesson(id) {
    const lesson = currentCourse.lessons.find(l => l.id === id);
    if (!lesson) return;
    currentLessonId = id; currentQuiz = lesson.quiz || [];
    if (document.getElementById('player-lesson-title')) document.getElementById('player-lesson-title').innerText = lesson.title;
    
    // Рендерим список уроков (сайдбар)
    const list = document.getElementById('lessons-list');
    if (list) {
        list.innerHTML = currentCourse.lessons.map((l, i) => `<button onclick="loadLesson(${l.id})" class="w-full text-left p-5 rounded-2xl transition-all font-bold text-sm ${currentLessonId === l.id ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white dark:bg-slate-800 dark:text-slate-300 shadow-sm'}">${i + 1}. ${l.title}</button>`).join('');
    }

    // Рендерим содержимое (центр)
    const container = document.getElementById('content-container');
    if (container) {
        if (IS_ONLINE) {
            // ОНЛАЙН: Используем рендерер для отрисовки блоков
            container.innerHTML = AuraRenderer.generateHTML(lesson.blocks || lesson.htmlBody || "");
        } else {
            // ОФФЛАЙН: Используем iFrame для локальных файлов
            const url = `/content/user/${currentCourse.folder}/${lesson.content}`;
            container.innerHTML = `<iframe id="content-frame" src="${url}" class="w-full h-full border-none bg-white dark:bg-slate-900 animate-fade"></iframe>`;
        }
    }
    
    // Кнопка прогресса
    const btn = document.getElementById('complete-btn');
    if (btn) btn.innerHTML = (currentQuiz.length > 0) ? `<span>ПРОЙТИ ТЕСТ</span> <i class="fa-solid fa-vial"></i>` : `<span>ЗАВЕРШИТЬ</span> <i class="fa-solid fa-check"></i>`;
}

// ==========================================
// 8. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ЧАТ И КВИЗ)
// ==========================================
function toggleChat() { 
    const chat = document.getElementById('ai-chat');
    if (chat) chat.classList.toggle('hidden'); 
}

function sendChatMessage() {
    const input = document.getElementById('chat-input'), box = document.getElementById('chat-messages');
    if (!input || !input.value.trim() || !box) return;
    box.innerHTML += `<div class="flex justify-end mb-4 animate-fade"><div class="bg-indigo-100 dark:bg-slate-800 p-4 rounded-2xl text-sm font-bold shadow-sm">${input.value}</div></div>`;
    input.value = ''; box.scrollTop = box.scrollHeight;
    setTimeout(() => { 
        box.innerHTML += `<div class="flex justify-start mb-4 animate-fade"><div class="bg-indigo-600 text-white p-4 rounded-3xl rounded-tl-none text-sm italic shadow-md">Aura AI: Анализирую материалы модуля...</div></div>`; 
        box.scrollTop = box.scrollHeight; 
    }, 700);
}

// ==========================================
// 9. ИНИЦИАЛИЗАЦИЯ (BOOT)
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // Принудительно скрываем чат при старте
    const chat = document.getElementById('ai-chat');
    if (chat) chat.classList.add('hidden');

    await syncSystemData();

    // Авто-загрузка курса, если мы в player.html
    if (window.location.pathname.includes('player.html')) {
        const id = new URLSearchParams(window.location.search).get('id');
        if (id && window.auraCloudDB) {
            const doc = await window.auraCloudDB.collection('courses').doc(id).get();
            if (doc.exists) {
                currentCourse = doc.data();
                if (document.getElementById('player-course-title')) document.getElementById('player-course-title').innerText = currentCourse.title;
                loadLesson(currentCourse.lessons[0].id);
            }
        }
    }
    
    if (IS_ONLINE) AuraSocial.init();
});

// ГЛОБАЛЬНЫЕ ЭКСПОРТЫ ДЛЯ HTML
window.AuraRenderer = AuraRenderer;
window.AuraSocial = AuraSocial;
window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.toggleTheme = () => AuraThemeEngine.toggle();
window.validateQuiz = async () => {
    let score = 0;
    currentQuiz.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q-${i}"]:checked`);
        if (sel && parseInt(sel.value) === q.correct) score++;
    });
    if (score === currentQuiz.length) { 
        document.getElementById('quiz-modal').classList.add('hidden'); 
        if (IS_ONLINE) await AuraSocial.addXP(AURA_UI.xpPerQuiz); 
        alert("🎉 Модуль пройден!");
    } else alert("Ошибка в тесте!");
};
window.openCourse = (dataRaw) => {
    currentCourse = JSON.parse(decodeURIComponent(dataRaw));
    if (document.getElementById('player-course-title')) document.getElementById('player-course-title').innerText = currentCourse.title;
    if (currentCourse.lessons && currentCourse.lessons.length > 0) loadLesson(currentCourse.lessons[0].id);
};
