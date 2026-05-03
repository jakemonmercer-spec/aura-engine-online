/**
 * =========================================================
 * AURA ENGINE PRO - MASTER CONTROLLER v25.0 (UNITY)
 * =========================================================
 * 🛡️ АВТОР: Aura Architect
 * 🚀 СТАТУС: 100% FULL SOURCE CODE. НИКАКИХ СОКРАЩЕНИЙ.
 * 🛰️ РЕЖИМЫ: 
 *    - OFFLINE: Работа через Node.js API (localhost)
 *    - ONLINE: Работа напрямую через Firebase SDK (GitHub Pages)
 * ⚡ ФУНКЦИОНАЛ: 
 *    - Global Theme Unity: Синхронная смена тем во всех вкладках.
 *    - Social Hub: Авторизация, XP за квизы, Глобальный рейтинг.
 *    - Smart Renderer: Отрисовка уроков из блоков (Online) или iFrame (Offline).
 *    - Quiz Engine PRO: Полная поддержка 4 вариантов (0-3).
 */

// ==========================================
// 1. ГЛОБАЛЬНОЕ СОСТОЯНИЕ И ДЕТЕКЦИЯ
// ==========================================
const IS_ONLINE = window.location.hostname.includes('github.io') || window.location.hostname.includes('auraengineonline');

let allCourses = [];      
let marketCourses = [];   
let favorites = JSON.parse(localStorage.getItem('aura-favorites')) || [];
let currentUser = null;   // Профиль из Firebase Auth
let leaderboard = [];     // Топ игроков
let currentCourse = null; 
let currentLessonId = null;
let currentQuiz = [];
let activeTab = 'library';
let isFavoriteFilterOn = false;

const AURA_CONFIG = {
    contentWidth: "max-w-4xl", 
    mediaWidth: "max-w-2xl",   
    spacing: "mb-10"
};

// ==========================================
// 2. ЯДРО СИНХРОНИЗАЦИИ ТЕМ (UNITY)
// ==========================================
const AuraThemeEngine = {
    init() {
        const savedTheme = localStorage.getItem('aura-theme') || 'light';
        this.apply(savedTheme);

        // Синхронизация между вкладками через событие storage
        window.addEventListener('storage', (event) => {
            if (event.key === 'aura-theme') {
                this.apply(event.newValue);
            }
        });
    },

    apply(theme) {
        const html = document.documentElement;
        if (theme === 'dark') {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }
        
        // Обновляем все иконки темы на странице
        const icons = document.querySelectorAll('#theme-icon, #theme-icon-app');
        icons.forEach(icon => {
            if (theme === 'dark') {
                icon.className = "fa-solid fa-sun text-xl text-yellow-400";
            } else {
                icon.className = "fa-solid fa-moon text-xl text-slate-400";
            }
        });
    },

    toggle() {
        const isDark = document.documentElement.classList.contains('dark');
        const nextTheme = isDark ? 'light' : 'dark';
        localStorage.setItem('aura-theme', nextTheme);
        this.apply(nextTheme);
        
        // Если открыт Креатор — оповещаем Live Monitor
        if (typeof syncAndRefresh === 'function') syncAndRefresh();
    }
};

// Запуск двигателя тем мгновенно
AuraThemeEngine.init();

// ==========================================
// 3. МОДУЛЬ AURA SOCIAL (ОНЛАЙН ВЗАИМОДЕЙСТВИЕ)
// ==========================================
const AuraSocial = {
    async init() {
        if (!IS_ONLINE || !window.firebase) return;

        try {
            // Следим за состоянием входа
            window.firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    currentUser = user;
                    console.log("👤 Aura Social: Авторизован ->", user.displayName);
                    await this.syncUserProfile();
                    this.updateUI();
                } else {
                    currentUser = null;
                    this.updateUI();
                }
            });
            this.loadLeaderboard();
        } catch (e) {
            console.error("Firebase Auth initialization failed");
        }
    },

    async login() {
        if (!window.firebase) return;
        const provider = new window.firebase.auth.GoogleAuthProvider();
        try {
            await window.firebase.auth().signInWithPopup(provider);
        } catch (err) {
            console.error("Login Error:", err.message);
            if (err.code === "auth/operation-not-allowed") {
                alert("Ошибка: Google Auth не включен в Firebase Console!");
            }
        }
    },

    async logout() {
        if (!window.firebase) return;
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
                completedTotal: 0,
                avatar: currentUser.photoURL,
                lastSeen: new Date().toISOString()
            });
        }
    },

    async addXP(points) {
        if (!IS_ONLINE || !currentUser || !window.auraCloudDB) return;
        const userRef = window.auraCloudDB.collection('users').doc(currentUser.uid);
        try {
            await userRef.update({
                xp: window.firebase.firestore.FieldValue.increment(points),
                completedTotal: window.firebase.firestore.FieldValue.increment(1)
            });
            console.log(`⭐ +${points} XP начислено в облако.`);
            this.loadLeaderboard(); // Обновляем топ
        } catch (e) {
            console.error("XP sync failed");
        }
    },

    async loadLeaderboard() {
        if (!IS_ONLINE || !window.auraCloudDB) return;
        try {
            const snapshot = await window.auraCloudDB.collection('users')
                .orderBy('xp', 'desc')
                .limit(5)
                .get();
            leaderboard = snapshot.docs.map(doc => doc.data());
            this.renderLeaderboard();
        } catch (e) {
            console.warn("Leaderboard fetch failed");
        }
    },

    updateUI() {
        const authBtn = document.getElementById('auth-btn-container');
        if (!authBtn) return;

        if (currentUser) {
            authBtn.innerHTML = `
                <div class="flex items-center gap-3 bg-white/5 p-1.5 pr-4 rounded-2xl border border-white/10 animate-fade">
                    <img src="${currentUser.photoURL}" class="w-9 h-9 rounded-full border-2 border-aura-primary">
                    <div class="hidden md:block text-left">
                        <p class="text-[10px] font-black uppercase leading-none dark:text-white">${currentUser.displayName}</p>
                        <p class="text-[8px] text-aura-primary font-bold uppercase tracking-widest mt-1">Student Pro</p>
                    </div>
                    <button onclick="AuraSocial.logout()" class="text-slate-500 hover:text-red-500 transition-all ml-2">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                </div>`;
        } else {
            authBtn.innerHTML = `
                <button onclick="AuraSocial.login()" class="bg-aura-primary text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-indigo-500/20">
                    Войти в Hub
                </button>`;
        }
    },

    renderLeaderboard() {
        const container = document.getElementById('leaderboard-container');
        if (!container) return;
        container.innerHTML = leaderboard.map((u, i) => `
            <div class="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 mb-3 shadow-sm animate-fade">
                <div class="flex items-center gap-4">
                    <span class="text-[10px] font-black opacity-30">#${i+1}</span>
                    <img src="${u.avatar}" class="w-10 h-10 rounded-full border border-aura-primary/20">
                    <span class="text-xs font-black uppercase tracking-tighter">${u.name}</span>
                </div>
                <div class="text-right">
                    <span class="text-[10px] font-black text-aura-primary block">${u.xp} XP</span>
                    <span class="text-[7px] font-bold text-slate-400 uppercase tracking-widest">${u.completedTotal} Модулей</span>
                </div>
            </div>
        `).join('');
    }
};

// ==========================================
// 4. ЕДИНОЕ ЯДРО РЕНДЕРИНГА (AURA RENDERER)
// ==========================================
const AuraRenderer = {
    generateHTML: function(input) {
        if (typeof input === 'string' && input.trim().length > 0) {
            return `<div class="${AURA_CONFIG.contentWidth} mx-auto animate-fade p-2">${input}</div>`;
        }
        if (Array.isArray(input) && input.length > 0) {
            return input.map(b => this.renderBlock(b)).join('\n');
        }
        return '<div class="py-20 text-center opacity-20 font-black uppercase tracking-widest text-slate-500 italic">Контент не создан</div>';
    },

    renderBlock: function(b) {
        if (!b || !b.data) return '';
        const space = AURA_CONFIG.spacing;
        const cWidth = AURA_CONFIG.contentWidth;
        const mWidth = AURA_CONFIG.mediaWidth;

        switch(b.type) {
            case 'hero':
                return `<header class="text-center mb-16 animate-fade">
                    <h1 class="space-font text-5xl font-black text-aura-primary dark:text-indigo-400 uppercase tracking-tighter mb-4">${b.data.title || ''}</h1>
                    <p class="text-slate-500 dark:text-slate-400 italic text-lg max-w-2xl mx-auto">${b.data.sub || ''}</p>
                    <div class="h-1.5 w-24 bg-aura-primary mx-auto mt-6 rounded-full shadow-lg"></div>
                </header>`;
            case 'text':
                return `<div class="${cWidth} mx-auto ${space} text-slate-700 dark:text-slate-300 text-lg leading-relaxed font-medium">${b.data.p || ''}</div>`;
            case 'image':
                return `<div class="${mWidth} mx-auto ${space} group animate-fade"><img src="${b.data.url || ''}" class="w-full rounded-[2.5rem] shadow-2xl border dark:border-white/5"></div>`;
            case 'video':
                return `<div class="${mWidth} mx-auto ${space} animate-fade"><video controls class="w-full rounded-[2.5rem] shadow-2xl bg-black border dark:border-white/10"><source src="${b.data.url || ''}" type="video/mp4"></video></div>`;
            case 'glass':
                return `<div class="${cWidth} mx-auto ${space}"><div class="glass-card p-10 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md"><div class="glass-title text-aura-primary dark:text-indigo-400 font-black flex items-center gap-4 mb-4"><i class="fa-solid ${b.data.icon || 'fa-bolt'} text-2xl"></i><span class="uppercase tracking-widest text-xl">${b.data.title || ''}</span></div><div class="text-slate-700 dark:text-slate-300 text-lg leading-relaxed">${b.data.p || ''}</div></div></div>`;
            case 'list':
                const items = b.data.items ? b.data.items.split('\n') : [];
                return `<div class="${cWidth} mx-auto ${space}"><ul class="aura-list space-y-4">${items.map(i => `<li class="flex items-center gap-4 bg-slate-100 dark:bg-white/5 p-4 rounded-2xl"><i class="fa-solid fa-circle-check text-green-500"></i><span class="font-semibold text-slate-800 dark:text-slate-200">${i}</span></li>`).join('')}</ul></div>`;
            case 'quote':
                return `<div class="${cWidth} mx-auto ${space}"><blockquote class="aura-quote relative border-l-8 border-aura-primary bg-indigo-50 dark:bg-white/5 p-8 rounded-r-3xl"><p class="text-2xl font-medium italic text-slate-800 dark:text-slate-100">${b.data.text || ''}</p><span class="block mt-6 text-aura-primary font-black uppercase tracking-[0.2em] text-xs">— ${b.data.author || ''}</span></blockquote></div>`;
            case 'quiz':
                return `<div class="${cWidth} mx-auto mt-20 text-center"><div class="quiz-notif bg-gradient-to-tr from-aura-primary to-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl"><i class="fa-solid fa-vial-circle-check mb-4 text-4xl"></i><div class="font-black uppercase text-sm tracking-widest">Knowledge Check</div><div class="text-[10px] opacity-80 mt-2 uppercase tracking-widest">${b.data.questions ? b.data.questions.length : 0} вопросов подготовлено</div></div></div>`;
            default: return '';
        }
    }
};

// ==========================================
// 5. API И СИНХРОНИЗАЦИЯ (HYBRID)
// ==========================================
async function syncSystemData() {
    try {
        if (IS_ONLINE) {
            // Режим GitHub Pages: работаем напрямую с Firebase SDK
            const snapshot = await window.auraCloudDB.collection('courses').get();
            marketCourses = snapshot.docs.map(doc => doc.data());
            allCourses = []; // В онлайне библиотека пуста до логина
        } else {
            // Режим Localhost: работаем через Node.js сервер
            const [libRes, markRes] = await Promise.all([
                fetch('/api/courses'),
                fetch('/api/market')
            ]);
            allCourses = await libRes.json();
            marketCourses = await markRes.json();
            updateGlobalStats();
        }
    } catch (err) { 
        console.error("Aura Sync Error: API or Cloud disconnected"); 
    }
}

function updateGlobalStats() {
    const statC = document.getElementById('stat-total-courses');
    const statL = document.getElementById('stat-total-lessons');
    const statP = document.getElementById('stat-overall-percent');
    
    if (!statC || !statL || !statP) return;

    let total = 0, done = 0;
    allCourses.forEach(c => {
        total += c.lessons.length;
        done += [...new Set(c.completedLessons)].length;
    });
    
    const prc = total > 0 ? Math.round((done / total) * 100) : 0;
    statC.innerText = allCourses.length;
    statL.innerText = done;
    statP.innerText = prc + '%';
}

// ==========================================
// 6. УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ (UI)
// ==========================================
function switchTab(tab) {
    activeTab = tab;
    const libGrid = document.getElementById('courses-grid');
    const markGrid = document.getElementById('market-grid');
    const tabLibBtn = document.getElementById('tab-lib');
    const tabMarkBtn = document.getElementById('tab-market');

    if (!libGrid || !markGrid) return;

    if (tab === 'library') {
        libGrid.classList.remove('hidden');
        markGrid.classList.add('hidden');
        if (tabLibBtn) tabLibBtn.className = "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-aura-primary text-white shadow-lg";
        if (tabMarkBtn) tabMarkBtn.className = "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all text-slate-400 hover:text-aura-primary";
        renderLibraryGrid(allCourses);
    } else {
        libGrid.classList.add('hidden');
        markGrid.classList.remove('hidden');
        if (tabMarkBtn) tabMarkBtn.className = "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all bg-aura-primary text-white shadow-lg";
        if (tabLibBtn) tabLibBtn.className = "px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all text-slate-400 hover:text-aura-primary";
        
        // Фильтруем: не показываем в магазине то, что уже установлено (в оффлайне)
        const installedIds = allCourses.map(c => c.id);
        renderMarketGrid(marketCourses.filter(c => !installedIds.includes(c.id)));
    }
}

function renderLibraryGrid(courses) {
    const grid = document.getElementById('courses-grid');
    if (!grid) return;
    if (!courses.length) {
        grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 font-black uppercase italic tracking-widest">Библиотека пуста</div>`;
        return;
    }
    grid.innerHTML = courses.map(course => {
        const done = [...new Set(course.completedLessons)].length;
        const prc = Math.round((done / course.lessons.length) * 100) || 0;
        const isFav = favorites.includes(course.title);
        return `
            <div class="course-card bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm relative group animate-fade">
                <div class="flex justify-between items-start mb-6">
                    <div class="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner"><i class="fa-solid fa-graduation-cap text-2xl"></i></div>
                    <div class="flex gap-2">
                        <button onclick="toggleFavorite('${course.title}')" class="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center transition-all ${isFav ? 'text-rose-500' : 'text-slate-300 dark:text-slate-600'}"><i class="fa-solid fa-heart"></i></button>
                        <button onclick="deleteInstalledCourse('${course.folder}', '${course.title}')" class="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"><i class="fa-solid fa-trash-can text-sm"></i></button>
                    </div>
                </div>
                <div onclick="openCourse('${encodeURIComponent(JSON.stringify(course))}')" class="cursor-pointer">
                    <h3 class="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-2 tracking-tighter uppercase">${course.title}</h3>
                    <p class="text-[10px] font-black uppercase text-slate-400 mb-6">Автор: ${course.author}</p>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
                        <div class="bg-indigo-600 h-full transition-all duration-1000" style="width: ${prc}%"></div>
                    </div>
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
                ${IS_ONLINE ? 'Открыть превью' : 'Скачать в библиотеку'}
            </button>
        </div>`).join('');
}

// ==========================================
// 7. ИНТЕРАКТИВНЫЙ ПЛЕЕР
// ==========================================
function openCourse(dataRaw) {
    currentCourse = JSON.parse(decodeURIComponent(dataRaw));
    const libView = document.getElementById('library-view'), playerView = document.getElementById('player-view'), pTitle = document.getElementById('player-course-title');
    if (libView) libView.classList.add('hidden');
    if (playerView) playerView.classList.remove('hidden');
    if (pTitle) pTitle.innerText = currentCourse.title;
    if (currentCourse.lessons && currentCourse.lessons.length > 0) loadLesson(currentCourse.lessons[0].id);
}

function closeCourse() {
    const frame = document.getElementById('content-frame');
    if (frame) frame.src = 'about:blank';
    const libView = document.getElementById('library-view'), playerView = document.getElementById('player-view');
    if (playerView) playerView.classList.add('hidden');
    if (libView) libView.classList.remove('hidden');
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
        // ОНЛАЙН: Рендерим блоки напрямую из Firestore
        container.innerHTML = AuraRenderer.generateHTML(lesson.blocks || lesson.htmlBody || "Контент недоступен");
    } else {
        // ОФФЛАЙН: Грузим из локального сервера через iframe
        const url = `/content/user/${currentCourse.folder}/${lesson.content}`;
        if (url.toLowerCase().endsWith('.mp4')) {
            container.innerHTML = `<video controls class="w-full h-full bg-black"><source src="${url}" type="video/mp4"></video>`;
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
        return `<button onclick="loadLesson(${l.id})" class="w-full text-left p-5 rounded-2xl transition-all flex items-center justify-between font-bold text-sm ${active ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white dark:bg-slate-800 dark:text-slate-300 shadow-sm'}">
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
// 8. СИСТЕМНЫЕ ОПЕРАЦИИ (DOWNLOAD/DELETE)
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
    if (!confirm(`Удалить "${title}"?`)) return;
    const frame = document.getElementById('content-frame');
    if (frame) frame.src = 'about:blank';
    setTimeout(async () => {
        const res = await fetch(`/api/courses/${folder}`, { method: 'DELETE' });
        if (res.ok) { await syncSystemData(); switchTab('library'); }
    }, 200);
}

// ==========================================
// 9. ДВИЖОК ТЕСТОВ (QUIZ 0-3 + XP SYSTEM)
// ==========================================
function showQuiz() {
    const cont = document.getElementById('quiz-questions-container'), modal = document.getElementById('quiz-modal');
    if (!cont || !modal) return;
    cont.innerHTML = currentQuiz.map((q, i) => `
        <div class="bg-slate-50 dark:bg-slate-800 p-8 rounded-[2.5rem] mb-6 border border-slate-100 dark:border-slate-700 shadow-sm">
            <h4 class="text-xl font-black mb-6 dark:text-white">Q${i + 1}: ${q.question}</h4>
            <div class="grid gap-3">
                ${q.options.map((opt, oi) => `
                    <label class="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 rounded-2xl cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all border border-slate-100 dark:border-slate-600">
                        <input type="radio" name="q-${i}" value="${oi}" class="w-5 h-5 accent-indigo-600">
                        <span class="font-bold text-slate-700 dark:text-slate-200">${opt}</span>
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
        if (IS_ONLINE) await AuraSocial.addXP(10); // В онлайне даем XP
        await saveLessonProgress(); 
    }
    else alert(`Результат: ${score}/${currentQuiz.length}. Для прогресса нужны все верные ответы.`);
}

async function saveLessonProgress() {
    if (IS_ONLINE) return; // В онлайне прогресс пишется в XP
    const res = await fetch('/api/complete-lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: currentCourse.id, lessonId: currentLessonId }) });
    if (res.ok) { 
        if (!currentCourse.completedLessons.includes(currentLessonId)) currentCourse.completedLessons.push(currentLessonId); 
        renderLessonsSidebar(); updatePlayerUI(); 
    }
}

// ==========================================
// 10. ИИ-ТЬЮТОР И ВСПОМОГАТЕЛИ
// ==========================================
function toggleChat() { document.getElementById('ai-chat').classList.toggle('hidden'); }

function sendChatMessage() {
    const input = document.getElementById('chat-input'), box = document.getElementById('chat-messages');
    if (!input || !input.value.trim() || !box) return;
    box.innerHTML += `<div class="flex justify-end mb-4 animate-fade"><div class="bg-indigo-100 dark:bg-slate-800 p-4 rounded-2xl text-sm font-bold shadow-sm">${input.value}</div></div>`;
    input.value = ''; box.scrollTop = box.scrollHeight;
    setTimeout(() => {
        box.innerHTML += `<div class="flex justify-start mb-4 animate-fade"><div class="bg-indigo-600 text-white p-4 rounded-3xl rounded-tl-none text-sm italic shadow-md">Aura AI: Анализирую... Чем могу помочь в изучении курса "${currentCourse ? currentCourse.title : ''}"?</div></div>`;
        box.scrollTop = box.scrollHeight;
    }, 800);
}

function toggleFavorite(title) {
    const idx = favorites.indexOf(title);
    if (idx > -1) favorites.splice(idx, 1); else favorites.push(title);
    localStorage.setItem('aura-favorites', JSON.stringify(favorites));
    switchTab(activeTab);
}

function navigateLesson(dir) {
    const idx = currentCourse.lessons.findIndex(l => l.id === currentLessonId);
    if (dir === 'next' && idx < currentCourse.lessons.length - 1) loadLesson(currentCourse.lessons[idx + 1].id);
    if (dir === 'prev' && idx > 0) loadLesson(currentCourse.lessons[idx - 1].id);
}

// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ DOM
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = window.location.pathname.includes('admin.html');
    const isCreator = window.location.pathname.includes('creator.html');

    // Настройка кнопок темы
    const themeBtn = document.getElementById('theme-icon') ? document.getElementById('theme-icon').parentElement : null;
    if (themeBtn) themeBtn.onclick = (e) => { e.preventDefault(); AuraThemeEngine.toggle(); };

    if (!isAdmin && !isCreator) {
        await syncSystemData();
        if (document.getElementById('tab-lib')) switchTab(IS_ONLINE ? 'market' : 'library');
    }
    
    if (IS_ONLINE) AuraSocial.init();
});

// ГЛОБАЛЬНЫЕ ЭКСПОРТЫ
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
