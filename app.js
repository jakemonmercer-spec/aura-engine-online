/**
 * =========================================================
 * AURA ENGINE PRO - MASTER CORE v23.0 (SOCIAL UNITY)
 * =========================================================
 * 🛡️ АВТОР: Aura Architect (Sherlock's Strategic Edition)
 * 🚀 ЦЕЛЬ: Социальное взаимодействие в онлайне.
 * 🛰️ ОСОБЕННОСТЬ: 
 *    - Модуль AuraSocial: Аккаунты, Рейтинги, XP.
 *    - Полная изоляция: Социалка не мешает оффлайн-работе.
 *    - 100% Full Source Code.
 */

// 1. ГЛОБАЛЬНОЕ СОСТОЯНИЕ
const IS_ONLINE = window.location.hostname.includes('github.io') || window.location.hostname.includes('auraengineonline');

let allCourses = [];      
let marketCourses = [];   
let favorites = JSON.parse(localStorage.getItem('aura-favorites')) || [];
let currentUser = null;   // Данные профиля из Firebase Auth
let leaderboard = [];     // Топ игроков
let currentCourse = null; 
let currentLessonId = null;
let currentQuiz = [];
let activeTab = 'library';

const AURA_CONFIG = {
    contentWidth: "max-w-4xl", 
    mediaWidth: "max-w-2xl",   
    spacing: "mb-10"
};

// 2. ЯДРО ТЕМЫ
const AuraThemeEngine = {
    init() {
        const savedTheme = localStorage.getItem('aura-theme') || 'light';
        this.apply(savedTheme);
        window.addEventListener('storage', (e) => {
            if (e.key === 'aura-theme') this.apply(e.newValue);
        });
    },
    apply(theme) {
        const html = document.documentElement;
        const icons = document.querySelectorAll('#theme-icon');
        if (theme === 'dark') {
            html.classList.add('dark');
            icons.forEach(i => i.className = "fa-solid fa-sun text-xl text-yellow-400");
        } else {
            html.classList.remove('dark');
            icons.forEach(i => i.className = "fa-solid fa-moon text-xl text-slate-400");
        }
    },
    toggle() {
        const isDark = document.documentElement.classList.toggle('dark');
        const next = isDark ? 'light' : 'dark';
        localStorage.setItem('aura-theme', next);
        this.apply(next);
        if (typeof syncAndRefresh === 'function') syncAndRefresh();
    }
};
AuraThemeEngine.init();

// 3. МОДУЛЬ AURA SOCIAL (ОНЛАЙН ВЗАИМОДЕЙСТВИЕ)
const AuraSocial = {
    async init() {
        if (!IS_ONLINE || !window.firebase) return;

        // Следим за авторизацией
        window.firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                currentUser = user;
                console.log("👤 Авторизован:", user.displayName);
                this.syncUserProfile();
                this.updateUI();
            } else {
                currentUser = null;
                this.updateUI();
            }
        });

        this.loadLeaderboard();
    },

    async login() {
        const provider = new window.firebase.auth.GoogleAuthProvider();
        try {
            await window.firebase.auth().signInWithPopup(provider);
        } catch (err) { console.error("Login Fail"); }
    },

    async logout() {
        await window.firebase.auth().signOut();
        location.reload();
    },

    async syncUserProfile() {
        if (!currentUser) return;
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
        if (!IS_ONLINE || !currentUser) return;
        const userRef = window.auraCloudDB.collection('users').doc(currentUser.uid);
        await userRef.update({
            xp: window.firebase.firestore.FieldValue.increment(points),
            completedTotal: window.firebase.firestore.FieldValue.increment(1)
        });
        console.log(`+${points} XP получено в облако!`);
    },

    async loadLeaderboard() {
        if (!IS_ONLINE) return;
        const snapshot = await window.auraCloudDB.collection('users')
            .orderBy('xp', 'desc')
            .limit(10)
            .get();
        leaderboard = snapshot.docs.map(doc => doc.data());
        this.renderLeaderboard();
    },

    updateUI() {
        const authBtn = document.getElementById('auth-btn-container');
        if (!authBtn) return;

        if (currentUser) {
            authBtn.innerHTML = `
                <div class="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10">
                    <img src="${currentUser.photoURL}" class="w-8 h-8 rounded-full border-2 border-aura-primary">
                    <div class="hidden md:block">
                        <p class="text-[10px] font-black uppercase leading-none">${currentUser.displayName}</p>
                        <p class="text-[8px] text-aura-primary font-bold">Level 1 Student</p>
                    </div>
                    <button onclick="AuraSocial.logout()" class="text-slate-500 hover:text-red-500 transition-all ml-2">
                        <i class="fa-solid fa-sign-out-alt"></i>
                    </button>
                </div>`;
        } else {
            authBtn.innerHTML = `
                <button onclick="AuraSocial.login()" class="bg-white text-slate-900 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-aura-primary hover:text-white transition-all shadow-xl">
                    Войти в Hub
                </button>`;
        }
    },

    renderLeaderboard() {
        const container = document.getElementById('leaderboard-container');
        if (!container) return;
        container.innerHTML = leaderboard.map((u, i) => `
            <div class="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 mb-2">
                <div class="flex items-center gap-4">
                    <span class="text-xs font-black opacity-30">#${i+1}</span>
                    <img src="${u.avatar}" class="w-8 h-8 rounded-full">
                    <span class="text-xs font-bold">${u.name}</span>
                </div>
                <span class="text-xs font-black text-aura-primary">${u.xp} XP</span>
            </div>
        `).join('');
    }
};

// 4. ЯДРО РЕНДЕРИНГА
const AuraRenderer = {
    generateHTML: function(input) {
        if (typeof input === 'string' && input.trim().length > 0) {
            return `<div class="${AURA_CONFIG.contentWidth} mx-auto animate-fade shadow-sm p-2">${input}</div>`;
        }
        if (Array.isArray(input) && input.length > 0) {
            return input.map(b => this.renderBlock(b)).join('\n');
        }
        return '<div class="py-20 text-center opacity-20 font-black uppercase tracking-widest text-slate-500">Контент еще не создан</div>';
    },

    renderBlock: function(b) {
        if (!b || !b.data) return '';
        const space = AURA_CONFIG.spacing, cW = AURA_CONFIG.contentWidth, mW = AURA_CONFIG.mediaWidth;

        switch(b.type) {
            case 'hero':
                return `<header class="text-center mb-16 animate-fade">
                    <h1 class="space-font text-5xl font-black text-aura-primary dark:text-indigo-400 uppercase tracking-tighter mb-4 drop-shadow-2xl">${b.data.title || ''}</h1>
                    <p class="text-slate-600 dark:text-slate-400 italic text-lg max-w-2xl mx-auto">${b.data.sub || ''}</p>
                    <div class="h-1.5 w-24 bg-aura-primary mx-auto mt-6 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.5)]"></div>
                </header>`;
            case 'text':
                return `<div class="${cW} mx-auto ${space} text-slate-800 dark:text-slate-300 text-lg leading-relaxed font-medium">${b.data.p || ''}</div>`;
            case 'image':
                return `<div class="${mW} mx-auto ${space} group animate-fade"><div class="relative overflow-hidden rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 transition-all hover:border-aura-primary/30"><img src="${b.data.url || ''}" class="w-full h-auto block"></div></div>`;
            case 'video':
                return `<div class="${mW} mx-auto ${space} animate-fade"><div class="relative overflow-hidden rounded-[2.5rem] shadow-2xl bg-black border border-white/10"><video controls class="w-full h-auto"><source src="${b.data.url || ''}" type="video/mp4"></video></div></div>`;
            case 'glass':
                return `<div class="${cW} mx-auto ${space}"><div class="glass-card p-10 rounded-[3rem] border border-slate-200 dark:border-white/10 relative overflow-hidden shadow-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md"><div class="glass-title text-aura-primary dark:text-indigo-400 font-black flex items-center gap-4 mb-4"><i class="fa-solid ${b.data.icon || 'fa-bolt'} text-2xl"></i><span class="uppercase tracking-widest text-xl">${b.data.title || ''}</span></div><div class="text-slate-700 dark:text-slate-300 text-lg leading-relaxed">${b.data.p || ''}</div></div></div>`;
            case 'list':
                const items = b.data.items ? b.data.items.split('\n') : [];
                return `<div class="${cW} mx-auto ${space}"><ul class="aura-list space-y-4">${items.map(i => `<li class="flex items-start gap-4 bg-slate-100 dark:bg-white/5 p-4 rounded-2xl border border-slate-200 dark:border-white/5 hover:border-aura-primary/20 transition-all"><i class="fa-solid fa-circle-check text-green-500 mt-1"></i><span class="font-semibold text-slate-800 dark:text-slate-200">${i}</span></li>`).join('')}</ul></div>`;
            case 'quote':
                return `<div class="${cW} mx-auto ${space}"><blockquote class="aura-quote relative border-l-8 border-aura-primary bg-indigo-50 dark:bg-white/5 p-8 rounded-r-3xl"><p class="text-2xl font-medium italic text-slate-800 dark:text-slate-100">${b.data.text || ''}</p><span class="block mt-6 text-aura-primary font-black uppercase tracking-[0.2em] text-xs">— ${b.data.author || ''}</span></blockquote></div>`;
            case 'quiz':
                return `<div class="${cW} mx-auto mt-20 animate-fade text-center"><div class="quiz-notif bg-gradient-to-tr from-aura-primary to-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl"><i class="fa-solid fa-vial-circle-check mb-4 text-4xl"></i><div class="font-black tracking-[0.4em] uppercase text-sm">Проверка знаний</div><div class="text-[10px] opacity-80 mt-2 uppercase tracking-widest">${b.data.questions ? b.data.questions.length : 0} вопросов</div></div></div>`;
            default: return '';
        }
    }
};

// 5. API И СИНХРОНИЗАЦИЯ
async function syncSystemData() {
    try {
        if (IS_ONLINE) {
            const snapshot = await window.auraCloudDB.collection('courses').get();
            marketCourses = snapshot.docs.map(doc => doc.data());
        } else {
            const [libRes, markRes] = await Promise.all([fetch('/api/courses'), fetch('/api/market')]);
            allCourses = await libRes.json();
            marketCourses = await markRes.json();
            updateGlobalStats();
        }
    } catch (err) { console.error("Aura API Sync Error"); }
}

function updateGlobalStats() {
    const statC = document.getElementById('stat-total-courses'), statL = document.getElementById('stat-total-lessons'), statP = document.getElementById('stat-overall-percent');
    if (!statC || !statL || !statP) return;
    let total = 0, done = 0;
    allCourses.forEach(c => { total += c.lessons.length; done += [...new Set(c.completedLessons)].length; });
    const prc = total > 0 ? Math.round((done / total) * 100) : 0;
    statC.innerText = allCourses.length; statL.innerText = done; statP.innerText = prc + '%';
}

// 6. UI УЧЕНИКА
function switchTab(tab) {
    activeTab = tab;
    const libGrid = document.getElementById('courses-grid'), markGrid = document.getElementById('market-grid'), tabLibBtn = document.getElementById('tab-lib'), tabMarkBtn = document.getElementById('tab-market');
    if (!libGrid || !markGrid) return;

    if (tab === 'library') {
        libGrid.classList.remove('hidden'); markGrid.classList.add('hidden');
        if (tabLibBtn) tabLibBtn.className = "px-8 py-3 rounded-[1.6rem] font-black text-xs uppercase tracking-widest transition-all bg-aura-primary text-white shadow-lg";
        if (tabMarkBtn) tabMarkBtn.className = "px-8 py-3 rounded-[1.6rem] font-black text-xs uppercase tracking-widest transition-all text-slate-400 hover:text-aura-primary";
        renderLibraryGrid(allCourses);
    } else {
        libGrid.classList.add('hidden'); markGrid.classList.remove('hidden');
        if (tabMarkBtn) tabMarkBtn.className = "px-8 py-3 rounded-[1.6rem] font-black text-xs uppercase tracking-widest transition-all bg-aura-primary text-white shadow-lg";
        if (tabLibBtn) tabLibBtn.className = "px-8 py-3 rounded-[1.6rem] font-black text-xs uppercase tracking-widest transition-all text-slate-400 hover:text-aura-primary";
        const installedIds = allCourses.map(c => c.id);
        renderMarketGrid(marketCourses.filter(c => !installedIds.includes(c.id)));
    }
}

function renderLibraryGrid(courses) {
    const grid = document.getElementById('courses-grid');
    if (!grid) return;
    if (!courses.length) { grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 font-black uppercase">Пусто</div>`; return; }
    grid.innerHTML = courses.map(course => {
        const done = [...new Set(course.completedLessons)].length, prc = Math.round((done / course.lessons.length) * 100) || 0;
        return `<div class="course-card bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm relative animate-fade">
            <div onclick="openCourse('${encodeURIComponent(JSON.stringify(course))}')" class="cursor-pointer">
                <h3 class="text-2xl font-black text-slate-900 dark:text-white leading-tight mb-2 tracking-tighter uppercase">${course.title}</h3>
                <p class="text-[10px] font-black uppercase text-slate-400 mb-6">${course.author}</p>
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
            <div class="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl mb-8 flex items-center justify-center text-slate-300 text-4xl group-hover:text-aura-primary transition-all shadow-inner"><i class="fa-solid fa-cloud-arrow-down"></i></div>
            <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase">${c.title}</h3>
            <p class="text-[10px] font-black uppercase text-slate-400 mb-10 italic">${c.author}</p>
            <button onclick="handleMarketAction('${c.folder}', '${c.title}')" class="w-full py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl">
                ${IS_ONLINE ? 'Открыть превью' : 'Скачать оффлайн'}
            </button>
        </div>`).join('');
}

// 7. ИНТЕРАКТИВНЫЙ ПЛЕЕР
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
        container.innerHTML = AuraRenderer.generateHTML(lesson.blocks || lesson.htmlBody || "Контент недоступен");
    } else {
        const url = `/content/user/${currentCourse.folder}/${lesson.content}`;
        if (url.toLowerCase().endsWith('.mp4')) container.innerHTML = `<video controls class="w-full h-full bg-black"><source src="${url}" type="video/mp4"></video>`;
        else container.innerHTML = `<iframe id="content-frame" src="${url}" class="w-full h-full border-none bg-white dark:bg-slate-900 animate-fade"></iframe>`;
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
    const btn = document.getElementById('complete-btn');
    if (btn) btn.innerHTML = (currentQuiz.length > 0) ? `<span>ПРОЙТИ ТЕСТ</span> <i class="fa-solid fa-vial"></i>` : `<span>ЗАВЕРШИТЬ УРОК</span> <i class="fa-solid fa-check-circle"></i>`;
}

// 8. ДВИЖОК ТЕСТОВ (XP SYSTEM INTEGRATED)
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
        if (IS_ONLINE) AuraSocial.addXP(10); // Начисляем XP в онлайне
        await saveLessonProgress(); 
    }
    else alert(`Ошибка! Результат: ${score}/${currentQuiz.length}`);
}

async function saveLessonProgress() {
    if (IS_ONLINE) return;
    const res = await fetch('/api/complete-lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: currentCourse.id, lessonId: currentLessonId }) });
    if (res.ok) { 
        if (!currentCourse.completedLessons.includes(currentLessonId)) currentCourse.completedLessons.push(currentLessonId); 
        renderLessonsSidebar(); updatePlayerUI(); 
    }
}

// 9. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = window.location.pathname.includes('admin.html'), isCreator = window.location.pathname.includes('creator.html');
    const themeBtn = document.getElementById('theme-icon') ? document.getElementById('theme-icon').parentElement : null;
    if (themeBtn) themeBtn.onclick = (e) => { e.preventDefault(); AuraThemeEngine.toggle(); };
    if (!isAdmin && !isCreator) { await syncSystemData(); if (document.getElementById('tab-lib')) switchTab(IS_ONLINE ? 'market' : 'library'); }
    if (IS_ONLINE) AuraSocial.init();
});

// ЭКСПОРТЫ
window.AuraRenderer = AuraRenderer;
window.AuraThemeEngine = AuraThemeEngine;
window.AuraSocial = AuraSocial;
window.toggleTheme = () => AuraThemeEngine.toggle();
window.switchTab = switchTab;
window.openCourse = openCourse;
window.closeCourse = closeCourse;
window.loadLesson = loadLesson;
window.validateQuiz = validateQuiz;
window.toggleChat = () => document.getElementById('ai-chat').classList.toggle('hidden');
window.sendChatMessage = () => {
    const input = document.getElementById('chat-input'), box = document.getElementById('chat-messages');
    if (!input || !input.value.trim() || !box) return;
    box.innerHTML += `<div class="flex justify-end mb-4"><div class="bg-indigo-100 dark:bg-slate-800 p-4 rounded-2xl text-sm font-bold shadow-sm">${input.value}</div></div>`;
    input.value = ''; box.scrollTop = box.scrollHeight;
    setTimeout(() => {
        box.innerHTML += `<div class="flex justify-start mb-4"><div class="bg-indigo-600 text-white p-4 rounded-3xl rounded-tl-none text-sm italic shadow-md">Aura AI: Модуль социального взаимодействия активен! Чем могу помочь?</div></div>`;
        box.scrollTop = box.scrollHeight;
    }, 800);
};
