/**
 * =========================================================
 * AURA ENGINE PRO - UNIVERSAL MASTER CORE v28.0
 * =========================================================
 * 🛡️ АВТОР: Aura Architect
 * 🚀 СТАТУС: 100% FULL SOURCE CODE.
 * 🛰️ РЕЖИМЫ: Localhost (Node.js) / Online (GitHub + Firestore)
 * ⚡ FIX: Кнопка чата, Магазин, Глобальные темы.
 */

// 1. КОНФИГУРАЦИЯ И ДЕТЕКЦИЯ
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

const AURA_CONFIG = {
    contentWidth: "max-w-4xl", 
    mediaWidth: "max-w-2xl",   
    spacing: "mb-10",
    xpPerQuiz: 15
};

// 2. ГЛОБАЛЬНЫЙ КОНТРОЛЛЕР ТЕМ (Django-Style Unity)
const AuraThemeEngine = {
    init() {
        const savedTheme = localStorage.getItem('aura-theme') || 'light';
        this.apply(savedTheme);
        // Синхронизация между всеми вкладками
        window.addEventListener('storage', (e) => {
            if (e.key === 'aura-theme') this.apply(e.newValue);
        });
    },

    apply(theme) {
        const html = document.documentElement;
        if (theme === 'dark') html.classList.add('dark');
        else html.classList.remove('dark');
        
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

// 3. СОЦИАЛЬНЫЙ МОДУЛЬ (Online Only)
const AuraSocial = {
    async init() {
        if (!IS_ONLINE || !window.firebase) return;
        try {
            window.firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    currentUser = user;
                    await this.syncUserProfile();
                    this.updateUI();
                } else {
                    currentUser = null;
                    this.updateUI();
                }
            });
            this.loadLeaderboard();
        } catch (e) { console.error("Social System Error"); }
    },

    async login() {
        const provider = new window.firebase.auth.GoogleAuthProvider();
        try { await window.firebase.auth().signInWithPopup(provider); } 
        catch (e) { alert("Ошибка авторизации. Проверьте домен в Firebase!"); }
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
        this.loadLeaderboard();
    },

    async loadLeaderboard() {
        const snap = await window.auraCloudDB.collection('users').orderBy('xp', 'desc').limit(5).get();
        leaderboard = snap.docs.map(doc => doc.data());
        this.renderLeaderboard();
    },

    updateUI() {
        const btn = document.getElementById('auth-btn-container');
        if (!btn) return;
        if (currentUser) {
            btn.innerHTML = `<div class="flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/10 animate-fade">
                <img src="${currentUser.photoURL}" class="w-8 h-8 rounded-full border border-aura-primary">
                <span class="text-[10px] font-black uppercase hidden md:block">${currentUser.displayName}</span>
                <button onclick="AuraSocial.logout()" class="text-slate-500 hover:text-red-500 ml-2"><i class="fa-solid fa-power-off"></i></button>
            </div>`;
        } else {
            btn.innerHTML = `<button onclick="AuraSocial.login()" class="bg-aura-primary text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-xl">Войти в Hub</button>`;
        }
    },

    renderLeaderboard() {
        const cont = document.getElementById('leaderboard-container');
        if (cont) {
            cont.innerHTML = leaderboard.map((u, i) => `
                <div class="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 mb-2">
                    <div class="flex items-center gap-4">
                        <span class="text-[10px] font-black opacity-30">#${i+1}</span>
                        <img src="${u.avatar}" class="w-8 h-8 rounded-full">
                        <span class="text-xs font-bold uppercase">${u.name}</span>
                    </div>
                    <span class="text-[10px] font-black text-aura-primary">${u.xp} XP</span>
                </div>`).join('');
        }
    }
};

// 4. ЕДИНОЕ ЯДРО РЕНДЕРИНГА (AURA RENDERER)
const AuraRenderer = {
    generateHTML: function(input) {
        if (typeof input === 'string' && input.trim().length > 0) {
            return `<div class="${AURA_CONFIG.contentWidth} mx-auto animate-fade p-2">${input}</div>`;
        }
        if (Array.isArray(input) && input.length > 0) {
            return input.map(b => this.renderBlock(b)).join('\n');
        }
        return '<div class="py-40 text-center opacity-20 font-black uppercase">Контент пуст</div>';
    },

    renderBlock: function(b) {
        if (!b || !b.data) return '';
        const space = AURA_CONFIG.spacing, cW = AURA_CONFIG.contentWidth, mW = AURA_CONFIG.mediaWidth;
        switch(b.type) {
            case 'hero':
                return `<header class="text-center mb-16 animate-fade">
                    <h1 class="space-font text-5xl font-black text-aura-primary dark:text-indigo-400 uppercase tracking-tighter mb-4">${b.data.title || ''}</h1>
                    <p class="text-slate-500 italic text-lg max-w-2xl mx-auto">${b.data.sub || ''}</p>
                    <div class="h-1.5 w-24 bg-aura-primary mx-auto mt-6 rounded-full shadow-lg"></div>
                </header>`;
            case 'text':
                return `<div class="${cW} mx-auto ${space} text-slate-700 dark:text-slate-300 text-lg leading-relaxed">${b.data.p || ''}</div>`;
            case 'image':
                return `<div class="${mW} mx-auto ${space} animate-fade"><img src="${b.data.url || ''}" class="w-full rounded-[2.5rem] shadow-2xl border dark:border-white/5"></div>`;
            case 'video':
                return `<div class="${mW} mx-auto ${space} animate-fade"><video controls class="w-full rounded-[2.5rem] bg-black border dark:border-white/10"><source src="${b.data.url || ''}" type="video/mp4"></video></div>`;
            case 'glass':
                return `<div class="${cW} mx-auto ${space}"><div class="glass-card p-10 rounded-[3rem] border border-slate-200 dark:border-white/10 shadow-xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-md"><div class="glass-title text-aura-primary dark:text-indigo-400 font-black flex items-center gap-4 mb-4"><i class="fa-solid ${b.data.icon || 'fa-bolt'} text-2xl"></i><span class="uppercase tracking-widest text-xl">${b.data.title || ''}</span></div><div class="text-slate-700 dark:text-slate-300 text-lg leading-relaxed">${b.data.p || ''}</div></div></div>`;
            case 'list':
                const items = b.data.items ? b.data.items.split('\n') : [];
                return `<div class="${cW} mx-auto ${space}"><ul class="aura-list space-y-4">${items.map(i => `<li class="flex items-center gap-4 bg-slate-100 dark:bg-white/5 p-4 rounded-2xl"><i class="fa-solid fa-circle-check text-green-500"></i><span class="dark:text-slate-200">${i}</span></li>`).join('')}</ul></div>`;
            case 'quote':
                return `<div class="${cW} mx-auto ${space}"><blockquote class="aura-quote relative border-l-8 border-aura-primary bg-indigo-50 dark:bg-white/5 p-8 rounded-r-3xl"><p class="text-2xl font-medium italic dark:text-slate-100">${b.data.text || ''}</p><span class="block mt-6 text-aura-primary font-black uppercase text-xs">— ${b.data.author || ''}</span></blockquote></div>`;
            case 'quiz':
                return `<div class="${cW} mx-auto mt-20 text-center animate-fade"><div class="quiz-notif bg-gradient-to-tr from-aura-primary to-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl"><i class="fa-solid fa-vial-circle-check mb-4 text-4xl"></i><div class="font-black uppercase text-sm tracking-widest">Проверка знаний</div><div class="text-[10px] opacity-80 mt-2 uppercase tracking-widest">${b.data.questions ? b.data.questions.length : 0} вопросов</div></div></div>`;
            default: return '';
        }
    }
};

// 5. API СИНХРОНИЗАЦИЯ (Hybrid Bridge)
async function syncSystemData() {
    try {
        if (IS_ONLINE) {
            console.log("🛰️ Подключение к Firestore...");
            const snapshot = await window.auraCloudDB.collection('courses').get();
            marketCourses = snapshot.docs.map(doc => doc.data());
            console.log("📦 Загружено курсов из облака:", marketCourses.length);
            allCourses = []; 
        } else {
            const [libRes, markRes] = await Promise.all([fetch('/api/courses'), fetch('/api/market')]);
            allCourses = await libRes.json();
            marketCourses = await markRes.json();
            updateGlobalStats();
        }
    } catch (err) { console.error("Aura API Offline"); }
}

function updateGlobalStats() {
    const statC = document.getElementById('stat-total-courses'), statL = document.getElementById('stat-total-lessons'), statP = document.getElementById('stat-overall-percent');
    if (!statC || !statL || !statP) return;
    let total = 0, done = 0;
    allCourses.forEach(c => { total += (c.lessons ? c.lessons.length : 0); done += (c.completedLessons ? [...new Set(c.completedLessons)].length : 0); });
    const prc = total > 0 ? Math.round((done / total) * 100) : 0;
    statC.innerText = allCourses.length; statL.innerText = done; statP.innerText = prc + '%';
}

// 6. UI УПРАВЛЕНИЕ
function switchTab(tab) {
    activeTab = tab;
    const libGrid = document.getElementById('courses-grid'), markGrid = document.getElementById('market-grid');
    const landing = document.getElementById('landing-section'), appSection = document.getElementById('app-section');
    if (!libGrid || !markGrid) return;

    if (tab === 'library') {
        if (landing) landing.classList.add('hidden');
        if (appSection) appSection.classList.remove('hidden');
        libGrid.classList.remove('hidden'); markGrid.classList.add('hidden');
        renderLibraryGrid(allCourses);
    } else {
        if (landing) landing.classList.add('hidden');
        if (appSection) appSection.classList.remove('hidden');
        libGrid.classList.add('hidden'); markGrid.classList.remove('hidden');
        renderMarketGrid(marketCourses);
    }
}

function renderLibraryGrid(courses) {
    const grid = document.getElementById('courses-grid');
    if (!grid) return;
    if (!courses.length) { grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 font-black uppercase italic tracking-widest">Библиотека пуста</div>`; return; }
    grid.innerHTML = courses.map(course => `<div class="course-card bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm animate-fade"><div onclick="openCourse('${encodeURIComponent(JSON.stringify(course))}')" class="cursor-pointer"><h3 class="text-2xl font-black dark:text-white mb-2 uppercase tracking-tighter">${course.title || 'Без названия'}</h3><p class="text-[10px] font-black uppercase text-slate-400 mb-6">Автор: ${course.author || 'Aura'}</p><div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden"><div class="bg-indigo-600 h-full transition-all duration-1000" style="width: 0%"></div></div></div></div>`).join('');
}

function renderMarketGrid(courses) {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    if (!courses.length) { grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 font-black uppercase italic">Нет курсов в облаке</div>`; return; }
    
    grid.innerHTML = courses.map(c => `
        <div class="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center shadow-sm relative group animate-slideUp">
            <div class="absolute top-6 right-8"><span class="bg-indigo-100 dark:bg-indigo-900/50 text-aura-indigo text-[8px] font-black px-3 py-1 rounded-full uppercase border border-indigo-200 dark:border-indigo-800">Firestore Hub</span></div>
            <div class="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl mb-8 flex items-center justify-center text-slate-300 text-4xl group-hover:text-aura-primary transition-all shadow-inner"><i class="fa-solid fa-cloud-arrow-down"></i></div>
            <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase tracking-tighter">${c.title || 'Новый курс'}</h3>
            <p class="text-[10px] font-black uppercase text-slate-400 mb-10 italic">${c.author || '...'}</p>
            <button onclick="handleMarketAction('${c.folder}', '${c.title}')" class="w-full py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl">
                ${IS_ONLINE ? 'Открыть превью' : 'Скачать оффлайн'}
            </button>
        </div>`).join('');
}

// 7. ПЛЕЕР
function openCourse(dataRaw) {
    currentCourse = JSON.parse(decodeURIComponent(dataRaw));
    const playerView = document.getElementById('player-view'), pTitle = document.getElementById('player-course-title');
    if (playerView) playerView.classList.remove('hidden');
    if (pTitle) pTitle.innerText = currentCourse.title;
    if (currentCourse.lessons && currentCourse.lessons.length > 0) loadLesson(currentCourse.lessons[0].id);
}

function closeCourse() {
    const frame = document.getElementById('content-frame');
    if (frame) frame.src = 'about:blank';
    const playerView = document.getElementById('player-view');
    if (playerView) playerView.classList.add('hidden');
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
        if (url.toLowerCase().endsWith('.mp4')) container.innerHTML = `<video controls class="w-full h-full bg-black"><source src="${url}" type="video/mp4"></video>`;
        else container.innerHTML = `<iframe id="content-frame" src="${url}" class="w-full h-full border-none bg-white dark:bg-slate-900 animate-fade"></iframe>`;
    }
    updatePlayerUI();
}

function renderLessonsSidebar() {
    const list = document.getElementById('lessons-list');
    if (!list) return;
    list.innerHTML = currentCourse.lessons.map((l, i) => {
        const active = currentLessonId === l.id;
        return `<button onclick="loadLesson(${l.id})" class="w-full text-left p-5 rounded-2xl transition-all flex items-center justify-between font-bold text-sm ${active ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white dark:bg-slate-800 dark:text-slate-300 shadow-sm'}">
            <span class="truncate">${i + 1}. ${l.title}</span>
            <i class="fa-solid fa-play-circle opacity-50"></i>
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

// 8. ACTIONS
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
        try {
            const res = await fetch(`/api/courses/${folder}`, { method: 'DELETE' });
            if (res.ok) { await syncSystemData(); switchTab('library'); }
        } catch (e) { console.error("Removal failed"); }
    }, 200);
}

// 9. QUIZ
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
    }
    else alert(`Результат: ${score}/${currentQuiz.length}.`);
}

async function saveLessonProgress() {
    if (IS_ONLINE) return;
    const res = await fetch('/api/complete-lesson', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: currentCourse.id, lessonId: currentLessonId }) });
    if (res.ok) { 
        if (!currentCourse.completedLessons.includes(currentLessonId)) currentCourse.completedLessons.push(currentLessonId); 
        renderLessonsSidebar(); updatePlayerUI(); 
    }
}

// 10. CHAT TOGGLE (FIXED)
function toggleChat() {
    const chat = document.getElementById('ai-chat');
    if (chat) {
        chat.classList.toggle('hidden');
    }
}

function sendChatMessage() {
    const input = document.getElementById('chat-input'), box = document.getElementById('chat-messages');
    if (!input || !input.value.trim() || !box) return;
    box.innerHTML += `<div class="flex justify-end mb-4"><div class="bg-indigo-100 dark:bg-slate-800 p-4 rounded-2xl text-sm font-bold shadow-sm">${input.value}</div></div>`;
    input.value = ''; box.scrollTop = box.scrollHeight;
    setTimeout(() => {
        box.innerHTML += `<div class="flex justify-start mb-4"><div class="bg-indigo-600 text-white p-4 rounded-3xl rounded-tl-none text-sm italic shadow-md">Aura AI: К вашим услугам!</div></div>`;
        box.scrollTop = box.scrollHeight;
    }, 800);
}

function toggleFavorite(title) {
    const idx = favorites.indexOf(title);
    if (idx > -1) favorites.splice(idx, 1); else favorites.push(title);
    localStorage.setItem('aura-favorites', JSON.stringify(favorites));
    switchTab(activeTab);
}

// 11. BOOT
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = window.location.pathname.includes('admin.html'), isCreator = window.location.pathname.includes('creator.html');
    const themeBtn = document.getElementById('theme-icon') ? document.getElementById('theme-icon').parentElement : null;
    if (themeBtn) themeBtn.onclick = (e) => { e.preventDefault(); AuraThemeEngine.toggle(); };
    
    await syncSystemData();
    if (!isAdmin && !isCreator) {
        if (document.getElementById('tab-lib')) switchTab(IS_ONLINE ? 'market' : 'library');
    }
    if (IS_ONLINE) AuraSocial.init();
});

// ГЛОБАЛЬНЫЕ ЭКСПОРТЫ
window.AuraRenderer = AuraRenderer;
window.AuraThemeEngine = AuraThemeEngine;
window.AuraSocial = AuraSocial;
window.toggleTheme = () => AuraThemeEngine.toggle();
window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.switchTab = switchTab;
window.openCourse = openCourse;
window.closeCourse = closeCourse;
window.loadLesson = loadLesson;
window.validateQuiz = validateQuiz;
window.toggleFavorite = toggleFavorite;
window.handleMarketAction = handleMarketAction;
