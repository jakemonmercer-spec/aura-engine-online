/**
 * =========================================================
 * AURA ENGINE PRO - MASTER CONTROLLER v27.0 (FULL HUB)
 * =========================================================
 * 🛡️ АВТОР: Aura Architect (Sherlock's Edition)
 * 🚀 СТАТУС: 100% FULL SOURCE CODE. НИКАКИХ СОКРАЩЕНИЙ.
 * 🛰️ РЕЖИМЫ: 
 *    - OFFLINE: Работа через Node.js API (localhost)
 *    - ONLINE: Работа напрямую через Firebase SDK (GitHub Pages)
 * ⚡ ИСПРАВЛЕНИЯ: 
 *    - Кнопка чата: Полный фикс сворачивания/разворачивания.
 *    - Магазин: Фикс подгрузки из Firestore (поддержка любых имен полей).
 *    - Темы: Тотальная синхронизация Django-Style.
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

const AURA_UI_CONFIG = {
    contentWidth: "max-w-4xl", 
    mediaWidth: "max-w-2xl",   
    spacing: "mb-10",
    xpPerQuiz: 15
};

// ==========================================
// 2. ЯДРО ТЕМ (DJANGO-STYLE UNITY)
// ==========================================
const AuraThemeEngine = {
    init() {
        const theme = localStorage.getItem('aura-theme') || 'light';
        this.apply(theme);
        window.addEventListener('storage', (e) => {
            if (e.key === 'aura-theme') this.apply(e.newValue);
        });
    },
    apply(theme) {
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        
        const icons = document.querySelectorAll('#theme-icon, #theme-icon-app');
        icons.forEach(i => {
            i.className = theme === 'dark' ? "fa-solid fa-sun text-xl text-yellow-400" : "fa-solid fa-moon text-xl text-slate-400";
        });
    },
    toggle() {
        const isDark = document.documentElement.classList.contains('dark');
        const next = isDark ? 'light' : 'dark';
        localStorage.setItem('aura-theme', next);
        this.apply(next);
        if (typeof syncAndRefresh === 'function') syncAndRefresh();
    }
};
AuraThemeEngine.init();

// ==========================================
// 3. МОДУЛЬ AURA SOCIAL (АККАУНТЫ И XP)
// ==========================================
const AuraSocial = {
    async init() {
        if (!IS_ONLINE || !window.firebase) return;

        window.firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                await this.syncUserProfile();
                this.updateAuthUI();
            } else {
                currentUser = null;
                this.updateAuthUI();
            }
        });
        this.loadLeaderboard();
    },

    async login() {
        if (!window.firebase) return;
        const provider = new window.firebase.auth.GoogleAuthProvider();
        try {
            await window.firebase.auth().signInWithPopup(provider);
        } catch (e) {
            console.error("Auth Fail:", e.message);
            alert("Ошибка входа! Проверьте настройки домена в Firebase Console.");
        }
    },

    async logout() {
        await window.firebase.auth().signOut();
        location.reload();
    },

    async syncUserProfile() {
        if (!currentUser || !window.auraCloudDB) return;
        const userRef = window.auraCloudDB.collection('users').doc(currentUser.uid);
        const doc = await userRef.get();
        if (!doc.exists) {
            await userRef.set({
                name: currentUser.displayName,
                xp: 0,
                avatar: currentUser.photoURL,
                completedTotal: 0,
                lastSeen: new Date().toISOString()
            });
        }
    },

    async addXP(points) {
        if (!IS_ONLINE || !currentUser || !window.auraCloudDB) return;
        const userRef = window.auraCloudDB.collection('users').doc(currentUser.uid);
        await userRef.update({
            xp: window.firebase.firestore.FieldValue.increment(points),
            completedTotal: window.firebase.firestore.FieldValue.increment(1)
        });
        this.loadLeaderboard();
    },

    async loadLeaderboard() {
        if (!IS_ONLINE || !window.auraCloudDB) return;
        const snapshot = await window.auraCloudDB.collection('users').orderBy('xp', 'desc').limit(5).get();
        leaderboard = snapshot.docs.map(doc => doc.data());
        this.renderLeaderboard();
    },

    updateAuthUI() {
        const btn = document.getElementById('auth-btn-container');
        if (!btn) return;
        if (currentUser) {
            btn.innerHTML = `
                <div class="flex items-center gap-3 bg-white/5 p-1.5 pr-4 rounded-2xl border border-white/10 animate-fade">
                    <img src="${currentUser.photoURL}" class="w-8 h-8 rounded-full border-2 border-aura-primary">
                    <div class="hidden md:block text-left">
                        <p class="text-[9px] font-black uppercase leading-none dark:text-white">${currentUser.displayName}</p>
                        <p class="text-[7px] text-aura-primary font-bold uppercase mt-1">Authorized User</p>
                    </div>
                    <button onclick="AuraSocial.logout()" class="text-slate-500 hover:text-red-500 ml-2"><i class="fa-solid fa-power-off"></i></button>
                </div>`;
        } else {
            btn.innerHTML = `<button onclick="AuraSocial.login()" class="bg-aura-primary text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Войти в Hub</button>`;
        }
    },

    renderLeaderboard() {
        const cont = document.getElementById('leaderboard-container');
        if (!cont) return;
        cont.innerHTML = leaderboard.map((u, i) => `
            <div class="flex items-center justify-between p-4 bg-white/5 rounded-3xl border border-white/5 mb-3 animate-fade">
                <div class="flex items-center gap-4">
                    <span class="text-[10px] font-black opacity-30">#${i+1}</span>
                    <img src="${u.avatar}" class="w-10 h-10 rounded-full">
                    <span class="text-[11px] font-black uppercase">${u.name}</span>
                </div>
                <span class="text-[10px] font-black text-aura-primary">${u.xp} XP</span>
            </div>`).join('');
    }
};

// ==========================================
// 4. ЯДРО РЕНДЕРИНГА (AURA RENDERER)
// ==========================================
const AuraRenderer = {
    generateHTML: function(input) {
        if (typeof input === 'string' && input.trim().length > 0) {
            return `<div class="${AURA_UI_CONFIG.contentWidth} mx-auto animate-fade p-2">${input}</div>`;
        }
        if (Array.isArray(input) && input.length > 0) {
            return input.map(b => this.renderBlock(b)).join('\n');
        }
        return '<div class="py-20 text-center opacity-20 font-black uppercase">Контент не создан</div>';
    },

    renderBlock: function(b) {
        if (!b || !b.data) return '';
        const cW = AURA_UI_CONFIG.contentWidth, mW = AURA_UI_CONFIG.mediaWidth, sp = AURA_UI_CONFIG.spacing;

        switch(b.type) {
            case 'hero':
                return `<header class="text-center mb-16 animate-fade">
                    <h1 class="space-font text-5xl font-black text-aura-primary uppercase tracking-tighter mb-4">${b.data.title || ''}</h1>
                    <p class="text-slate-500 italic text-lg max-w-2xl mx-auto">${b.data.sub || ''}</p>
                    <div class="h-1.5 w-24 bg-aura-primary mx-auto mt-6 rounded-full"></div>
                </header>`;
            case 'text':
                return `<div class="${cW} mx-auto ${sp} text-slate-700 dark:text-slate-300 text-lg leading-relaxed">${b.data.p || ''}</div>`;
            case 'image':
                return `<div class="${mW} mx-auto ${sp} group animate-fade"><img src="${b.data.url || ''}" class="w-full rounded-[2.5rem] shadow-2xl border dark:border-white/5"></div>`;
            case 'video':
                return `<div class="${mW} mx-auto ${sp} animate-fade"><video controls class="w-full rounded-[2.5rem] shadow-2xl bg-black border dark:border-white/10"><source src="${b.data.url || ''}" type="video/mp4"></video></div>`;
            case 'glass':
                return `<div class="${cW} mx-auto ${sp}"><div class="glass-card p-10 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md"><div class="glass-title text-aura-primary dark:text-indigo-400 font-black flex items-center gap-4 mb-4"><i class="fa-solid ${b.data.icon || 'fa-bolt'} text-2xl"></i><span class="uppercase tracking-widest text-xl">${b.data.title || ''}</span></div><div class="text-slate-700 dark:text-slate-300 text-lg leading-relaxed">${b.data.p || ''}</div></div></div>`;
            case 'quiz':
                return `<div class="${cW} mx-auto mt-20 text-center"><div class="quiz-notif bg-gradient-to-tr from-aura-primary to-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl"><i class="fa-solid fa-vial-circle-check mb-4 text-4xl"></i><div class="font-black uppercase text-sm tracking-widest">Knowledge Check</div><div class="text-[10px] opacity-80 mt-2 uppercase tracking-widest">${b.data.questions ? b.data.questions.length : 0} вопросов</div></div></div>`;
            default: return '';
        }
    }
};

// ==========================================
// 5. API СИНХРОНИЗАЦИЯ (FIRESTORE FIX)
// ==========================================
async function syncSystemData() {
    try {
        if (IS_ONLINE) {
            const snapshot = await window.auraCloudDB.collection('courses').get();
            marketCourses = snapshot.docs.map(doc => {
                const data = doc.data();
                // ФИКС: Если в базе нет title, используем folder или ID
                return {
                    ...data,
                    title: data.title || data.folder || doc.id,
                    id: data.id || doc.id
                };
            });
            console.log("🛰 Firestore Data Loaded:", marketCourses.length, "courses");
        } else {
            const [libRes, markRes] = await Promise.all([fetch('/api/courses'), fetch('/api/market')]);
            allCourses = await libRes.json();
            marketCourses = await markRes.json();
            updateGlobalStats();
        }
    } catch (err) { console.error("Sync Error"); }
}

function updateGlobalStats() {
    const statC = document.getElementById('stat-total-courses'), statL = document.getElementById('stat-total-lessons'), statP = document.getElementById('stat-overall-percent');
    if (!statC || !statL || !statP) return;
    let total = 0, done = 0;
    allCourses.forEach(c => { total += c.lessons.length; done += [...new Set(c.completedLessons)].length; });
    const prc = total > 0 ? Math.round((done / total) * 100) : 0;
    statC.innerText = allCourses.length; statL.innerText = done; statP.innerText = prc + '%';
}

// ==========================================
// 6. UI УПРАВЛЕНИЯ
// ==========================================
function switchTab(tab) {
    activeTab = tab;
    const libGrid = document.getElementById('courses-grid'), markGrid = document.getElementById('market-grid');
    const tabLibBtn = document.getElementById('tab-lib'), tabMarkBtn = document.getElementById('tab-market');

    if (!libGrid || !markGrid) return;

    if (tab === 'library') {
        libGrid.classList.remove('hidden'); markGrid.classList.add('hidden');
        if (tabLibBtn) tabLibBtn.className = "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-aura-primary text-white shadow-lg";
        if (tabMarkBtn) tabMarkBtn.className = "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all text-slate-400 hover:text-aura-primary";
        renderLibraryGrid(allCourses);
    } else {
        libGrid.classList.add('hidden'); markGrid.classList.remove('hidden');
        if (tabMarkBtn) tabMarkBtn.className = "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-aura-primary text-white shadow-lg";
        if (tabLibBtn) tabLibBtn.className = "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all text-slate-400 hover:text-aura-primary";
        renderMarketGrid(marketCourses);
    }
}

function renderLibraryGrid(courses) {
    const grid = document.getElementById('courses-grid');
    if (!grid) return;
    if (!courses.length) { grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 font-black uppercase italic tracking-widest">Библиотека пуста</div>`; return; }
    grid.innerHTML = courses.map(course => `<div class="course-card bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm animate-fade"><div onclick="openCourse('${encodeURIComponent(JSON.stringify(course))}')" class="cursor-pointer"><h3 class="text-2xl font-black dark:text-white mb-2 uppercase">${course.title}</h3><p class="text-[10px] font-black uppercase text-slate-400 mb-6">${course.author}</p><div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden"><div class="bg-indigo-600 h-full transition-all duration-1000" style="width: 0%"></div></div></div></div>`).join('');
}

function renderMarketGrid(courses) {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    if (!courses.length) {
        grid.innerHTML = `<div class="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-[3rem] border-4 border-dashed border-slate-100 dark:border-slate-800 animate-slideUp">
            <h3 class="text-2xl font-black dark:text-white uppercase italic leading-none">Здесь пусто курсов нету</h3>
        </div>`;
        return;
    }
    grid.innerHTML = courses.map(c => `
        <div class="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center shadow-sm relative group animate-slideUp">
            <div class="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl mb-8 flex items-center justify-center text-slate-300 text-3xl"><i class="fa-solid fa-cloud-arrow-down"></i></div>
            <h3 class="text-2xl font-black dark:text-white mb-2 uppercase">${c.title}</h3>
            <p class="text-[10px] font-black uppercase text-slate-400 mb-8 italic">${c.author}</p>
            <button onclick="handleMarketAction('${c.folder}')" class="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl">
                ${IS_ONLINE ? 'Открыть превью' : 'Скачать оффлайн'}
            </button>
        </div>`).join('');
}

// ==========================================
// 7. ИНТЕРАКТИВНЫЙ ПЛЕЕР (SPA LOGIC)
// ==========================================
function openCourse(dataRaw) {
    currentCourse = JSON.parse(decodeURIComponent(dataRaw));
    const libView = document.getElementById('landing-section'), appSection = document.getElementById('app-section'), playerView = document.getElementById('player-view'), pTitle = document.getElementById('player-course-title');
    if (libView) libView.classList.add('hidden');
    if (appSection) appSection.classList.add('hidden');
    if (playerView) playerView.classList.remove('hidden');
    if (pTitle) pTitle.innerText = currentCourse.title;
    if (currentCourse.lessons && currentCourse.lessons.length > 0) loadLesson(currentCourse.lessons[0].id);
}

function closeCourse() {
    const frame = document.getElementById('content-frame');
    if (frame) frame.src = 'about:blank';
    const playerView = document.getElementById('player-view'), appSection = document.getElementById('app-section'), landing = document.getElementById('landing-section');
    if (playerView) playerView.classList.add('hidden');
    if (IS_ONLINE) { if (landing) landing.classList.remove('hidden'); }
    else { const libView = document.getElementById('library-view'); if (libView) libView.classList.remove('hidden'); }
    syncSystemData().then(() => switchTab(activeTab));
}

function loadLesson(id) {
    const lesson = currentCourse.lessons.find(l => l.id === id);
    if (!lesson) return;
    currentLessonId = id; currentQuiz = lesson.quiz || [];
    if (document.getElementById('player-lesson-title')) document.getElementById('player-lesson-title').innerText = lesson.title;
    renderLessonsSidebar();
    const container = document.getElementById('content-container');
    if (!container) return;

    if (IS_ONLINE) {
        container.innerHTML = AuraRenderer.generateHTML(lesson.blocks || lesson.htmlBody || "Контент недоступен");
    } else {
        const url = `/content/user/${currentCourse.folder}/${lesson.content}`;
        container.innerHTML = `<iframe id="content-frame" src="${url}" class="w-full h-full border-none bg-white dark:bg-slate-900 animate-fade"></iframe>`;
    }
    updatePlayerUI();
}

function renderLessonsSidebar() {
    const list = document.getElementById('lessons-list');
    if (!list) return;
    list.innerHTML = currentCourse.lessons.map((l, i) => `<button onclick="loadLesson(${l.id})" class="w-full text-left p-5 rounded-2xl transition-all font-bold text-sm ${currentLessonId === l.id ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white dark:bg-slate-800 dark:text-slate-300 shadow-sm'}">${i + 1}. ${l.title}</button>`).join('');
}

function updatePlayerUI() {
    const btn = document.getElementById('complete-btn');
    if (btn) btn.innerHTML = (currentQuiz.length > 0) ? `<span>ПРОЙТИ ТЕСТ</span> <i class="fa-solid fa-vial"></i>` : `<span>ЗАВЕРШИТЬ УРОК</span> <i class="fa-solid fa-check-circle"></i>`;
}

// ==========================================
// 8. СВОРАЧИВАНИЕ ЧАТА (FIXED)
// ==========================================
function toggleChat() {
    const chat = document.getElementById('ai-chat');
    if (!chat) return;
    
    if (chat.classList.contains('hidden')) {
        chat.classList.remove('hidden');
        chat.classList.add('animate-slideUp');
    } else {
        chat.classList.add('hidden');
    }
}

// ==========================================
// 9. ИНИЦИАЛИЗАЦИЯ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = window.location.pathname.includes('admin.html'), isCreator = window.location.pathname.includes('creator.html');
    
    // Переопределяем кнопку темы
    const themeBtn = document.getElementById('theme-icon') ? document.getElementById('theme-icon').parentElement : null;
    if (themeBtn) themeBtn.onclick = (e) => { e.preventDefault(); AuraThemeEngine.toggle(); };

    if (!isAdmin && !isCreator) {
        await syncSystemData();
        if (document.getElementById('tab-lib')) switchTab(IS_ONLINE ? 'market' : 'library');
    }
    
    if (IS_ONLINE) AuraSocial.init();
});

// ГЛОБАЛЬНЫЕ ЭКСПОРТЫ
window.AuraSocial = AuraSocial;
window.AuraRenderer = AuraRenderer;
window.toggleTheme = () => AuraThemeEngine.toggle();
window.toggleChat = toggleChat;
window.switchTab = switchTab;
window.openCourse = openCourse;
window.closeCourse = closeCourse;
window.loadLesson = loadLesson;
window.handleMarketAction = async (folder) => {
    const course = marketCourses.find(c => c.folder === folder);
    if (!course) return;
    if (IS_ONLINE) openCourse(encodeURIComponent(JSON.stringify(course)));
    else {
        const res = await fetch('/api/download', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({folder, title: course.title}) });
        if (res.ok) { await syncSystemData(); switchTab('library'); }
    }
};
window.validateQuiz = async () => {
    let score = 0;
    currentQuiz.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q-${i}"]:checked`);
        if (sel && parseInt(sel.value) === q.correct) score++;
    });
    if (score === currentQuiz.length) { 
        document.getElementById('quiz-modal').classList.add('hidden'); 
        if (IS_ONLINE) await AuraSocial.addXP(AURA_UI_CONFIG.xpPerQuiz);
        if (!IS_ONLINE) await fetch('/api/complete-lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: currentCourse.id, lessonId: currentLessonId }) });
        syncSystemData().then(() => { if(!IS_ONLINE) loadLesson(currentLessonId); });
    } else alert(`Ошибка! Нужно ${currentQuiz.length} правильных ответов.`);
};
window.sendChatMessage = () => {
    const input = document.getElementById('chat-input'), box = document.getElementById('chat-messages');
    if (!input || !input.value.trim() || !box) return;
    box.innerHTML += `<div class="flex justify-end mb-4"><div class="bg-indigo-100 dark:bg-slate-800 p-4 rounded-2xl text-sm font-bold shadow-sm">${input.value}</div></div>`;
    input.value = ''; box.scrollTop = box.scrollHeight;
    setTimeout(() => {
        box.innerHTML += `<div class="flex justify-start mb-4"><div class="bg-indigo-600 text-white p-4 rounded-3xl rounded-tl-none text-sm italic shadow-md">Aura AI: Модуль активен. Чем могу помочь?</div></div>`;
        box.scrollTop = box.scrollHeight;
    }, 800);
};
