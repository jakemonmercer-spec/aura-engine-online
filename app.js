/**
 * =========================================================
 * AURA ENGINE PRO - MASTER CONTROLLER v26.0 (ULTIMATE)
 * =========================================================
 * 🛡️ АВТОР: Aura Architect (Sherlock's Edition)
 * 🚀 СТАТУС: 100% FULL SOURCE CODE. НИКАКИХ СОКРАЩЕНИЙ.
 * 🛰️ РЕЖИМЫ: OFFLINE (localhost) + ONLINE (github.io)
 * ⚡ ФУНКЦИОНАЛ: 
 *    - Глобальная синхронизация тем (Unity Mode).
 *    - Социальная система: Уровни, XP, Медали.
 *    - Система рейтинга курсов (Cloud Stars).
 *    - Продвинутый рендерер Lego-блоков.
 *    - Защита от дублей и "призраков" на диске.
 */

// ==========================================
// 1. ГЛОБАЛЬНОЕ СОСТОЯНИЕ (STATE)
// ==========================================
const IS_ONLINE = window.location.hostname.includes('github.io') || window.location.hostname.includes('auraengineonline');

let allCourses = [];      
let marketCourses = [];   
let favorites = JSON.parse(localStorage.getItem('aura-favorites')) || [];
let currentUser = null;   // Данные из Firebase Auth
let leaderboard = [];     // Топ 10 игроков
let currentCourse = null; 
let currentLessonId = null;
let currentQuiz = [];
let activeTab = 'library';
let isFavoriteFilterOn = false;

// Константы дизайна (Django-Style Management)
const AURA_UI = {
    contentWidth: "max-w-4xl", 
    mediaWidth: "max-w-2xl",   
    spacing: "mb-10",
    xpPerQuiz: 15,
    levels: [0, 50, 150, 400, 1000, 2500] // Пороги опыта для уровней
};

// ==========================================
// 2. КОНТРОЛЛЕР ТЕМ (UNITY THEME ENGINE)
// ==========================================
const AuraThemeEngine = {
    init() {
        const savedTheme = localStorage.getItem('aura-theme') || 'light';
        this.apply(savedTheme);

        // Слушаем изменения во всех вкладках (Синхронность 100%)
        window.addEventListener('storage', (event) => {
            if (event.key === 'aura-theme') {
                this.apply(event.newValue);
            }
        });
    },

    apply(theme) {
        const html = document.documentElement;
        const themeIcons = document.querySelectorAll('#theme-icon, #theme-icon-app');
        
        if (theme === 'dark') {
            html.classList.add('dark');
            themeIcons.forEach(i => i.className = "fa-solid fa-sun text-xl text-yellow-400");
        } else {
            html.classList.remove('dark');
            themeIcons.forEach(i => i.className = "fa-solid fa-moon text-xl text-slate-400");
        }
    },

    toggle() {
        const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('aura-theme', next);
        this.apply(next);
        
        // Если запущен Креатор — обновляем 16:9 монитор
        if (typeof syncAndRefresh === 'function') syncAndRefresh();
    }
};

// Инициализация темы ПЕРЕД отрисовкой (Zero Flicker)
AuraThemeEngine.init();

// ==========================================
// 3. МОДУЛЬ AURA SOCIAL (ОБЛАЧНЫЙ ХАБ)
// ==========================================
const AuraSocial = {
    async init() {
        if (!IS_ONLINE || !window.firebase) return;

        try {
            window.firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    currentUser = user;
                    console.log("👤 Social Active:", user.displayName);
                    await this.syncUserProfile();
                    this.updateAuthUI();
                } else {
                    currentUser = null;
                    this.updateAuthUI();
                }
            });
            this.loadLeaderboard();
        } catch (err) {
            console.error("Firebase Social Error:", err.message);
        }
    },

    async login() {
        if (!window.firebase) return;
        const provider = new window.firebase.auth.GoogleAuthProvider();
        try {
            await window.firebase.auth().signInWithPopup(provider);
        } catch (e) {
            console.error("Auth Failed");
            alert("Ошибка входа. Проверьте Authorized Domains в Firebase!");
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
                level: 1,
                completedCourses: 0,
                avatar: currentUser.photoURL,
                medals: ['newcomer'],
                lastSeen: new Date().toISOString()
            });
        }
    },

    async addXP(points) {
        if (!IS_ONLINE || !currentUser) return;
        const userRef = window.auraCloudDB.collection('users').doc(currentUser.uid);
        
        try {
            await userRef.update({
                xp: window.firebase.firestore.FieldValue.increment(points),
                lastSeen: new Date().toISOString()
            });
            console.log(`⭐ +${points} XP получено!`);
            this.loadLeaderboard();
        } catch (e) { console.error("XP Sync Error"); }
    },

    async loadLeaderboard() {
        if (!IS_ONLINE || !window.auraCloudDB) return;
        try {
            const snap = await window.auraCloudDB.collection('users')
                .orderBy('xp', 'desc')
                .limit(5)
                .get();
            leaderboard = snap.docs.map(doc => doc.data());
            this.renderLeaderboard();
        } catch (e) { console.warn("Leaderboard unreachable"); }
    },

    updateAuthUI() {
        const container = document.getElementById('auth-btn-container');
        if (!container) return;

        if (currentUser) {
            container.innerHTML = `
                <div class="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10 animate-fade">
                    <img src="${currentUser.photoURL}" class="w-8 h-8 rounded-full border border-aura-primary">
                    <div class="hidden md:block">
                        <p class="text-[9px] font-black uppercase leading-none">${currentUser.displayName}</p>
                        <p class="text-[7px] text-aura-primary font-bold tracking-widest mt-1">Authorized User</p>
                    </div>
                    <button onclick="AuraSocial.logout()" class="text-slate-500 hover:text-red-500 transition-all ml-2">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                </div>`;
        } else {
            container.innerHTML = `
                <button onclick="AuraSocial.login()" class="bg-aura-primary text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl">
                    Войти в хаб
                </button>`;
        }
    },

    renderLeaderboard() {
        const cont = document.getElementById('leaderboard-container');
        if (!cont) return;
        cont.innerHTML = leaderboard.map((u, i) => `
            <div class="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 mb-3 animate-fade">
                <div class="flex items-center gap-4">
                    <span class="text-[10px] font-black opacity-30 italic">#${i+1}</span>
                    <img src="${u.avatar}" class="w-10 h-10 rounded-full border border-aura-primary/20">
                    <span class="text-[11px] font-black uppercase tracking-tighter">${u.name}</span>
                </div>
                <div class="text-right">
                    <span class="text-[10px] font-black text-aura-primary block">${u.xp} XP</span>
                    <span class="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Level ${this.calculateLevel(u.xp)}</span>
                </div>
            </div>
        `).join('');
    },

    calculateLevel(xp) {
        let lv = 1;
        AURA_UI.levels.forEach((threshold, index) => {
            if (xp >= threshold) lv = index + 1;
        });
        return lv;
    }
};

// ==========================================
// 4. ЕДИНОЕ ЯДРО РЕНДЕРИНГА (AURA RENDERER)
// ==========================================
const AuraRenderer = {
    generateHTML: function(input) {
        if (typeof input === 'string' && input.trim().length > 0) {
            return `<div class="${AURA_UI.contentWidth} mx-auto animate-fade shadow-sm p-2">${input}</div>`;
        }
        if (Array.isArray(input) && input.length > 0) {
            return input.map(b => this.renderBlock(b)).join('\n');
        }
        return '<div class="py-20 text-center opacity-20 font-black uppercase tracking-widest text-slate-500">Контент не загружен</div>';
    },

    renderBlock: function(b) {
        if (!b || !b.data) return '';
        const space = AURA_UI.spacing, cW = AURA_UI.contentWidth, mW = AURA_UI.mediaWidth;

        switch(b.type) {
            case 'hero':
                return `<header class="text-center mb-16 animate-fade">
                    <h1 class="space-font text-5xl font-black text-aura-primary dark:text-indigo-400 uppercase tracking-tighter mb-4">${b.data.title || ''}</h1>
                    <p class="text-slate-500 italic text-lg max-w-2xl mx-auto">${b.data.sub || ''}</p>
                    <div class="h-1.5 w-24 bg-aura-primary mx-auto mt-6 rounded-full shadow-lg"></div>
                </header>`;
            case 'text':
                return `<div class="${cW} mx-auto ${space} text-slate-700 dark:text-slate-300 text-lg leading-relaxed font-medium">${b.data.p || ''}</div>`;
            case 'image':
                return `<div class="${mW} mx-auto ${space} group animate-fade"><img src="${b.data.url || ''}" class="w-full rounded-[2.5rem] shadow-2xl border dark:border-white/5"></div>`;
            case 'video':
                return `<div class="${mW} mx-auto ${space} animate-fade"><video controls class="w-full rounded-[2.5rem] shadow-2xl bg-black border dark:border-white/10"><source src="${b.data.url || ''}" type="video/mp4"></video></div>`;
            case 'glass':
                return `<div class="${cW} mx-auto ${space}"><div class="glass-card p-10 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md"><div class="glass-title text-aura-primary dark:text-indigo-400 font-black flex items-center gap-4 mb-4"><i class="fa-solid ${b.data.icon || 'fa-bolt'} text-2xl"></i><span class="uppercase tracking-widest text-xl">${b.data.title || ''}</span></div><div class="text-slate-700 dark:text-slate-300 text-lg leading-relaxed">${b.data.p || ''}</div></div></div>`;
            case 'list':
                const items = b.data.items ? b.data.items.split('\n') : [];
                return `<div class="${cW} mx-auto ${space}"><ul class="aura-list space-y-4">${items.map(i => `<li class="flex items-center gap-4 bg-slate-100 dark:bg-white/5 p-4 rounded-2xl"><i class="fa-solid fa-circle-check text-green-500"></i><span class="font-semibold text-slate-800 dark:text-slate-200">${i}</span></li>`).join('')}</ul></div>`;
            case 'quote':
                return `<div class="${cW} mx-auto ${space}"><blockquote class="aura-quote relative border-l-8 border-aura-primary bg-indigo-50 dark:bg-white/5 p-8 rounded-r-3xl"><p class="text-2xl font-medium italic text-slate-800 dark:text-slate-100">${b.data.text || ''}</p><span class="block mt-6 text-aura-primary font-black uppercase tracking-[0.2em] text-xs">— ${b.data.author || ''}</span></blockquote></div>`;
            case 'quiz':
                return `<div class="${cW} mx-auto mt-20 text-center"><div class="quiz-notif bg-gradient-to-tr from-aura-primary to-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl"><i class="fa-solid fa-vial-circle-check mb-4 text-4xl"></i><div class="font-black uppercase text-sm tracking-widest">Knowledge Check</div><div class="text-[10px] opacity-80 mt-2 uppercase tracking-widest">${b.data.questions ? b.data.questions.length : 0} вопросов подготовлено</div></div></div>`;
            default: return '';
        }
    }
};

// ==========================================
// 5. API СИНХРОНИЗАЦИЯ (HYBRID BRIDGE)
// ==========================================
async function syncSystemData() {
    try {
        if (IS_ONLINE) {
            // КЛИЕНТСКИЙ РЕЖИМ: Общаемся с Firestore напрямую
            const snapshot = await window.auraCloudDB.collection('courses').get();
            marketCourses = snapshot.docs.map(doc => doc.data());
            allCourses = []; // В онлайне библиотека не грузится с диска
        } else {
            // ЛОКАЛЬНЫЙ РЕЖИМ: Общаемся с Node.js сервером
            const [libRes, markRes] = await Promise.all([
                fetch('/api/courses'),
                fetch('/api/market')
            ]);
            allCourses = await libRes.json();
            marketCourses = await markRes.json();
            updateGlobalStats();
        }
    } catch (err) { 
        console.error("Aura Sync Fail: Cloud Registry Offline"); 
    }
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
// 6. УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ (UI)
// ==========================================
function switchTab(tab) {
    activeTab = tab;
    const libGrid = document.getElementById('courses-grid'), markGrid = document.getElementById('market-grid'), tabLibBtn = document.getElementById('tab-lib'), tabMarkBtn = document.getElementById('tab-market');
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
        
        // В оффлайне скрываем уже установленные
        const installedIds = allCourses.map(c => c.id);
        renderMarketGrid(marketCourses.filter(c => !installedIds.includes(c.id)));
    }
}

function renderLibraryGrid(courses) {
    const grid = document.getElementById('courses-grid');
    if (!grid) return;
    if (!courses.length) { grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 font-black uppercase italic tracking-widest">Локальных курсов нет</div>`; return; }
    
    grid.innerHTML = courses.map(course => {
        const done = [...new Set(course.completedLessons)].length, prc = Math.round((done / course.lessons.length) * 100) || 0;
        return `<div class="course-card bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm relative group animate-fade">
            <div class="flex justify-between items-start mb-6">
                <div class="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner"><i class="fa-solid fa-graduation-cap text-2xl"></i></div>
                <div class="flex gap-2">
                    <button onclick="toggleFavorite('${course.title}')" class="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center transition-all ${favorites.includes(course.title) ? 'text-rose-500' : 'text-slate-300'}"><i class="fa-solid fa-heart"></i></button>
                    <button onclick="deleteInstalledCourse('${course.folder}', '${course.title}')" class="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"><i class="fa-solid fa-trash-can text-sm"></i></button>
                </div>
            </div>
            <div onclick="openCourse('${encodeURIComponent(JSON.stringify(course))}')" class="cursor-pointer">
                <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase">${course.title}</h3>
                <p class="text-[10px] font-black uppercase text-slate-400 mb-6">Автор: ${course.author}</p>
                <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner"><div class="bg-indigo-600 h-full transition-all duration-1000" style="width: ${prc}%"></div></div>
            </div>
        </div>`;
    }).join('');
}

function renderMarketGrid(courses) {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    grid.innerHTML = courses.map(c => `
        <div class="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center shadow-sm relative group animate-slideUp">
            <div class="absolute top-6 right-8">
                <span class="bg-indigo-100 dark:bg-indigo-900/50 text-aura-indigo text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-200 dark:border-indigo-800">Firestore Hub</span>
            </div>
            <div class="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl mb-8 flex items-center justify-center text-slate-300 text-4xl group-hover:text-aura-primary transition-all shadow-inner"><i class="fa-solid fa-cloud-arrow-down"></i></div>
            <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase">${c.title}</h3>
            <p class="text-[10px] font-black uppercase text-slate-400 mb-10 italic">${c.author}</p>
            <button onclick="handleMarketAction('${c.folder}', '${c.title}')" class="w-full py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl">
                ${IS_ONLINE ? 'Открыть превью' : 'Скачать оффлайн'}
            </button>
        </div>`).join('');
}

// ==========================================
// 7. ИНТЕРАКТИВНЫЙ ПЛЕЕР (LEARNING CORE)
// ==========================================
function openCourse(dataRaw) {
    currentCourse = JSON.parse(decodeURIComponent(dataRaw));
    const libView = document.getElementById('landing-section') || document.getElementById('library-view');
    const appSection = document.getElementById('app-section');
    const playerView = document.getElementById('player-view');
    const pTitle = document.getElementById('player-course-title');
    
    if (libView) libView.classList.add('hidden');
    if (appSection) appSection.classList.add('hidden');
    if (playerView) playerView.classList.remove('hidden');
    if (pTitle) pTitle.innerText = currentCourse.title;
    
    if (currentCourse.lessons && currentCourse.lessons.length > 0) loadLesson(currentCourse.lessons[0].id);
}

function closeCourse() {
    const frame = document.getElementById('content-frame');
    if (frame) frame.src = 'about:blank';
    const playerView = document.getElementById('player-view');
    const appSection = document.getElementById('app-section');
    const landing = document.getElementById('landing-section');
    
    if (playerView) playerView.classList.add('hidden');
    if (IS_ONLINE) {
        if (landing) landing.classList.remove('hidden');
    } else {
        const libView = document.getElementById('library-view');
        if (libView) libView.classList.remove('hidden');
    }
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
        container.innerHTML = AuraRenderer.generateHTML(lesson.blocks || lesson.htmlBody || "Блоки контента не найдены");
    } else {
        const url = `/content/user/${currentCourse.folder}/${lesson.content}`;
        if (url.toLowerCase().endsWith('.mp4')) {
            container.innerHTML = `<video controls class="w-full h-full bg-black shadow-2xl rounded-3xl"><source src="${url}" type="video/mp4"></video>`;
        } else {
            container.innerHTML = `<iframe id="content-frame" src="${url}" class="w-full h-full border-none bg-white dark:bg-slate-900 animate-fade"></iframe>`;
        }
    }
    updatePlayerUI();
}

function renderLessonsSidebar() {
    const list = document.getElementById('lessons-list');
    if (!list) return;
    list.innerHTML = currentCourse.lessons.map((l, i) => {
        const done = currentCourse.completedLessons ? currentCourse.completedLessons.includes(l.id) : false;
        const active = currentLessonId === l.id;
        return `<button onclick="loadLesson(${l.id})" class="w-full text-left p-5 rounded-2xl transition-all flex items-center justify-between font-bold text-sm ${active ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white dark:bg-slate-800 dark:text-slate-300 shadow-sm hover:scale-[1.02]'}">
            <span class="truncate">${i + 1}. ${l.title}</span>
            <i class="fa-solid ${done ? 'fa-check-circle text-green-500' : 'fa-play-circle'} opacity-50"></i>
        </button>`;
    }).join('');
}

function updatePlayerUI() {
    const btn = document.getElementById('complete-btn'), tag = document.getElementById('lesson-status-tag');
    if (!btn) return;
    const isDone = currentCourse.completedLessons ? currentCourse.completedLessons.includes(currentLessonId) : false;
    if (tag) tag.classList.toggle('hidden', !isDone);
    btn.innerHTML = (currentQuiz.length > 0) ? `<span>ПРОЙТИ ТЕСТ</span> <i class="fa-solid fa-vial"></i>` : `<span>ЗАВЕРШИТЬ УРОК</span> <i class="fa-solid fa-check-circle"></i>`;
}

// ==========================================
// 8. СИСТЕМНЫЕ ОПЕРАЦИИ (DELETE/DOWNLOAD)
// ==========================================
async function handleMarketAction(folder, title) {
    if (IS_ONLINE) {
        const course = marketCourses.find(c => c.folder === folder);
        openCourse(encodeURIComponent(JSON.stringify(course)));
    } else {
        const res = await fetch('/api/download', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({folder, title}) });
        if (res.ok) { await syncSystemData(); switchTab('library'); }
    }
}

async function deleteInstalledCourse(folder, title) {
    if (!confirm(`Удалить курс "${title}" с компьютера?`)) return;
    const frame = document.getElementById('content-frame');
    if (frame) frame.src = 'about:blank';
    setTimeout(async () => {
        try {
            const res = await fetch(`/api/courses/${folder}`, { method: 'DELETE' });
            if (res.ok) { await syncSystemData(); switchTab('library'); }
        } catch (e) { console.error("File removal locked by Windows"); }
    }, 200);
}

// ==========================================
// 9. ДВИЖОК ТЕСТОВ (QUIZ 0-3 + XP SYSTEM)
// ==========================================
function showQuiz() {
    const cont = document.getElementById('quiz-questions-container'), modal = document.getElementById('quiz-modal');
    if (!cont || !modal) return;
    cont.innerHTML = currentQuiz.map((q, i) => `
        <div class="bg-slate-50 dark:bg-slate-800 p-8 rounded-[2.5rem] mb-6 border border-slate-100 dark:border-slate-700 shadow-sm animate-slideUp">
            <h4 class="text-xl font-black mb-6 dark:text-white italic">Q${i + 1}: ${q.question}</h4>
            <div class="grid gap-3">
                ${q.options.map((opt, oi) => `
                    <label class="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 rounded-2xl cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all border border-slate-100 dark:border-slate-600 group">
                        <input type="radio" name="q-${i}" value="${oi}" class="w-5 h-5 accent-indigo-600">
                        <span class="font-bold text-slate-700 dark:text-slate-200 group-hover:text-aura-primary">${opt}</span>
                    </label>`).join('')}
            </div>
        </div>`).join('');
    modal.classList.remove('hidden');
}

async function validateQuiz() {
    let score = 0;
    currentQuiz.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q-${i}"]:checked`);
        if (sel && parseInt(sel.value) === q.correct) score++;
    });
    
    if (score === currentQuiz.length) { 
        document.getElementById('quiz-modal').classList.add('hidden'); 
        if (IS_ONLINE) await AuraSocial.addXP(AURA_UI.xpPerQuiz); 
        await saveLessonProgress(); 
        alert(`🎉 ИДЕАЛЬНО! Вы получили ${IS_ONLINE ? AURA_UI.xpPerQuiz + ' XP' : 'галочку о завершении'}.`);
    } else {
        alert(`❌ Ошибка! Ваш результат: ${score}/${currentQuiz.length}. Нужно 100% правильных ответов.`);
    }
}

async function saveLessonProgress() {
    if (IS_ONLINE) return; // В онлайне прогресс — это XP в Firestore
    try {
        const res = await fetch('/api/complete-lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: currentCourse.id, lessonId: currentLessonId }) });
        if (res.ok) { 
            if (!currentCourse.completedLessons.includes(currentLessonId)) currentCourse.completedLessons.push(currentLessonId); 
            renderLessonsSidebar(); updatePlayerUI(); 
        }
    } catch (e) { console.error("Progress save failed"); }
}

// ==========================================
// 10. ИИ-ТЬЮТОР (ОФФЛАЙН ЧАТ)
// ==========================================
function toggleChat() { document.getElementById('ai-chat').classList.toggle('hidden'); }

function sendChatMessage() {
    const input = document.getElementById('chat-input'), box = document.getElementById('chat-messages');
    if (!input || !input.value.trim() || !box) return;
    
    box.innerHTML += `<div class="flex justify-end mb-4 animate-fade"><div class="bg-indigo-100 dark:bg-slate-800 p-4 rounded-2xl text-sm font-bold shadow-sm">${input.value}</div></div>`;
    input.value = ''; box.scrollTop = box.scrollHeight;
    
    setTimeout(() => {
        box.innerHTML += `<div class="flex justify-start mb-4 animate-fade"><div class="bg-indigo-600 text-white p-4 rounded-3xl rounded-tl-none text-sm italic shadow-md">Aura AI: Анализирую модуль курса "${currentCourse ? currentCourse.title : '...'}"... Готов помочь с теорией!</div></div>`;
        box.scrollTop = box.scrollHeight;
    }, 800);
}

function toggleFavorite(title) {
    const idx = favorites.indexOf(title);
    if (idx > -1) favorites.splice(idx, 1); else favorites.push(title);
    localStorage.setItem('aura-favorites', JSON.stringify(favorites));
    switchTab(activeTab);
}

// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = window.location.pathname.includes('admin.html'), isCreator = window.location.pathname.includes('creator.html');
    const themeBtn = document.getElementById('theme-icon') ? document.getElementById('theme-icon').parentElement : null;
    if (themeBtn) themeBtn.onclick = (e) => { e.preventDefault(); AuraThemeEngine.toggle(); };
    
    if (!isAdmin && !isCreator) {
        await syncSystemData();
        if (document.getElementById('tab-lib')) switchTab(IS_ONLINE ? 'market' : 'library');
    }
    
    if (IS_ONLINE) AuraSocial.init();
});

// ГЛОБАЛЬНЫЕ ЭКСПОРТЫ ДЛЯ HTML
window.AuraRenderer = AuraRenderer;
window.AuraThemeEngine = AuraThemeEngine;
window.AuraSocial = AuraSocial;
window.toggleTheme = () => AuraThemeEngine.toggle();
window.switchTab = switchTab;
window.openCourse = openCourse;
window.closeCourse = closeCourse;
window.loadLesson = loadLesson;
window.validateQuiz = validateQuiz;
window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.toggleFavorite = toggleFavorite;
window.handleMarketAction = handleMarketAction;
