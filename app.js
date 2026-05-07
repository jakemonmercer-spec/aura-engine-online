/**
 * =========================================================
 * AURA ENGINE PRO - MASTER CORE v31.0 (ULTIMATE)
 * =========================================================
 * 🛡️ АВТОР: Aura Architect (Sherlock's Strategic Fix)
 * 🚀 СТАТУС: 100% FULL SOURCE CODE. НИКАКИХ СОКРАЩЕНИЙ.
 * 🛰️ РЕЖИМЫ: Localhost (Node.js) / Online (GitHub + Firestore)
 * ⚡ FIX: 
 *    - Чат: Принудительно скрыт при старте, фикс кнопки "v".
 *    - Рендерер: Добавлена проверка на наличие htmlBody (если нет блоков).
 *    - Социалка: XP начисление работает.
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
// 2. КОНТРОЛЛЕР ТЕМ (UNITY)
// ==========================================
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
        if (theme === 'dark') html.classList.add('dark');
        else html.classList.remove('dark');
        
        document.querySelectorAll('#theme-icon, #theme-icon-app').forEach(i => {
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
// 3. МОДУЛЬ AURA SOCIAL (ОНЛАЙН)
// ==========================================
const AuraSocial = {
    async init() {
        if (!IS_ONLINE || !window.firebase) return;
        window.firebase.auth().onAuthStateChanged(async (user) => {
            currentUser = user;
            this.updateUI();
            if (user) await this.syncUserProfile();
        });
        this.loadLeaderboard();
    },
    async login() {
        if (!window.firebase) return;
        const provider = new window.firebase.auth.GoogleAuthProvider();
        try { await window.firebase.auth().signInWithPopup(provider); } 
        catch (e) { alert("Включите Google Auth в Firebase Console!"); }
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
            await userRef.set({ name: currentUser.displayName, xp: 0, avatar: currentUser.photoURL, lastSeen: new Date().toISOString() });
        }
    },
    async addXP(pts) {
        if (!IS_ONLINE || !currentUser) return;
        await window.auraCloudDB.collection('users').doc(currentUser.uid).update({
            xp: window.firebase.firestore.FieldValue.increment(pts)
        });
    },
    async loadLeaderboard() {
        const cont = document.getElementById('leaderboard-container');
        if (!cont) return;
        try {
            const snap = await window.auraCloudDB.collection('users').orderBy('xp', 'desc').limit(5).get();
            cont.innerHTML = snap.docs.map((doc, i) => {
                const u = doc.data();
                return `<div class="flex items-center justify-between p-4 bg-white/5 rounded-3xl border border-white/5 mb-2">
                    <div class="flex items-center gap-3">
                        <span class="opacity-30 font-black text-[10px]">#${i+1}</span>
                        <img src="${u.avatar}" class="w-8 h-8 rounded-full border border-aura-primary/20">
                        <span class="text-xs font-bold">${u.name}</span>
                    </div>
                    <span class="text-aura-primary font-black text-[10px]">${u.xp} XP</span>
                </div>`;
            }).join('');
        } catch (e) { cont.innerHTML = "<p class='text-center opacity-20 text-[10px]'>Рейтинг временно недоступен</p>"; }
    },
    updateUI() {
        const btn = document.getElementById('auth-btn-container');
        if (!btn) return;
        if (currentUser) {
            btn.innerHTML = `<div class="flex items-center gap-3 bg-white/5 p-1.5 rounded-2xl border border-white/10 animate-fade">
                <img src="${currentUser.photoURL}" class="w-9 h-9 rounded-full border border-aura-primary">
                <span class="text-[9px] font-black uppercase hidden lg:block text-slate-400">${currentUser.displayName}</span>
                <button onclick="AuraSocial.logout()" class="p-2 text-slate-500 hover:text-red-500"><i class="fa-solid fa-power-off text-sm"></i></button>
            </div>`;
        }
    }
};


// Настройка ИИ для работы ПРЯМО в браузере (без сервера)
const GEMINI_KEY = "AIzaSyD8q-cw7yAQbrakqIWVQjldhOlezPQAuYQ"; // Твой ключ

async function callGeminiDirect(message, context) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: `Ты — Aura AI Tutor. Тема урока: ${context}. Вопрос: ${message}` }] }]
        })
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}
// ==========================================
// 4. ЕДИНОЕ ЯДРО РЕНДЕРИНГА (PRO)
// ==========================================
const AuraRenderer = {
    generateHTML: function(input) {
        // Если пришел HTML-код (строка)
        if (typeof input === 'string' && input.length > 50) {
            return `<div class="${AURA_UI.contentWidth} mx-auto animate-fade p-2">${input}</div>`;
        }
        // Если пришли Lego-блоки (массив)
        if (Array.isArray(input) && input.length > 0) {
            return input.map(b => this.renderBlock(b)).join('\n');
        }
        // Если пусто
        return `
            <div class="py-24 text-center opacity-30 animate-fade">
                <i class="fa-solid fa-ghost text-7xl mb-6"></i>
                <h3 class="text-2xl font-black uppercase tracking-[0.3em] leading-none">Контент не найден</h3>
                <p class="text-[10px] font-bold uppercase mt-4 opacity-60">
                    Шерлок, в Firestore отсутствуют блоки для этого урока. <br>
                    Перепубликуйте курс из Creator Pro.
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
                return `<div class="${cW} mx-auto ${space} text-slate-700 dark:text-slate-300 text-lg leading-relaxed">${b.data.p || ''}</div>`;
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
                return `<div class="${cW} mx-auto mt-20 text-center animate-fade"><div class="quiz-notif bg-gradient-to-tr from-aura-primary to-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl"><i class="fa-solid fa-vial-circle-check mb-4 text-4xl"></i><div class="font-black uppercase text-sm tracking-widest">Knowledge Module Active</div></div></div>`;
            default: return '';
        }
    }
};

// ==========================================
// 5. API СИНХРОНИЗАЦИЯ (Hybrid Bridge)
// ==========================================
async function syncSystemData() {
    try {
        if (IS_ONLINE) {
            console.log("🛰️ Firestore Sync Start...");
            const snapshot = await window.auraCloudDB.collection('courses').get();
            marketCourses = snapshot.docs.map(doc => doc.data());
            const mGrid = document.getElementById('market-grid');
            if (mGrid) renderMarketGrid(marketCourses);
            allCourses = []; 
        } else {
            const [libRes, markRes] = await Promise.all([fetch('/api/courses'), fetch('/api/market')]);
            allCourses = await libRes.json();
            marketCourses = await markRes.json();
            if (document.getElementById('courses-grid')) renderLibraryGrid(allCourses);
            if (document.getElementById('market-grid')) renderMarketGrid(marketCourses);
            updateGlobalStats();
        }
    } catch (err) { console.error("Aura Sync Error"); }
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
// 6. UI УПРАВЛЕНИЕ (МАРКЕТ И БИБЛИОТЕКА)
// ==========================================
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
    if (!courses.length) { 
        grid.innerHTML = `<div class="col-span-full py-20 text-center opacity-30 font-black uppercase italic tracking-widest">Библиотека пуста</div>`; 
        return; 
    }

    grid.innerHTML = courses.map(course => `
        <div class="course-card bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm animate-fade">
            <div onclick="handleCourseClick('${course.id}')" class="cursor-pointer">
                <h3 class="text-2xl font-black dark:text-white mb-2 uppercase tracking-tighter leading-none">
                    ${course.title || 'Курс'}
                </h3>
                <p class="text-[10px] font-black uppercase text-slate-400 mb-6">
                    Автор: ${course.author || '...'}
                </p>
                <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
                    <div class="bg-indigo-600 h-full transition-all duration-1000" style="width: 0%"></div>
                </div>
            </div>
        </div>
    `).join('');
}

function handleCourseClick(courseId) {
    const course = allCourses.find(c => c.id === courseId) || marketCourses.find(c => c.id === courseId);
    if (course) {
        openCourse(encodeURIComponent(JSON.stringify(course)));
    }
}
window.handleCourseClick = handleCourseClick;
function renderMarketGrid(courses) {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    grid.innerHTML = courses.map(c => `
        <div class="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center shadow-sm relative group animate-slideUp">
            <div class="absolute top-6 right-8"><span class="bg-indigo-100 dark:bg-indigo-900/50 text-aura-indigo text-[8px] font-black px-3 py-1 rounded-full uppercase border border-indigo-200 dark:border-indigo-800">Cloud Market</span></div>
            <div class="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl mb-8 flex items-center justify-center text-slate-300 text-4xl group-hover:text-aura-primary transition-all shadow-inner"><i class="fa-solid fa-cloud-arrow-down"></i></div>
            <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase tracking-tighter">${c.title || 'Новый курс'}</h3>
            <p class="text-[10px] font-black uppercase text-slate-400 mb-10 italic">${c.author || '...'}</p>
            <button onclick="handleMarketAction('${c.id}', '${c.folder}')" class="w-full py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl">
                ${IS_ONLINE ? 'Открыть превью' : 'Скачать оффлайн'}
            </button>
        </div>`).join('');
}

// ==========================================
// 7. ИНТЕРАКТИВНЫЙ ПЛЕЕР
// ==========================================
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
    const lesson = currentCourse.lessons.find(l => l.id == id);
    if (!lesson) return;
    
    currentLessonId = id; 
    currentQuiz = lesson.quiz || [];
    
    if (document.getElementById('player-lesson-title')) 
        document.getElementById('player-lesson-title').innerText = lesson.title;
    
    renderLessonsSidebar();
    
    const container = document.getElementById('content-container');
    if (!container) return;

    if (IS_ONLINE) {
        // ОНЛАЙН: Используем ту же обертку, что и в Desktop для aura-content.css
        container.innerHTML = `
            <div class="aura-content-body">
                ${AuraRenderer.generateHTML(lesson.blocks || lesson.htmlBody || "")}
            </div>`;
    } else {
        // ОФФЛАЙН (Localhost):
        const url = `/content/user/${currentCourse.folder}/${lesson.content}`;
        container.innerHTML = `<iframe id="content-frame" src="${url}" class="w-full h-full border-none bg-white dark:bg-slate-900 animate-fade"></iframe>`;
        
        // Прокидываем тему в iframe (как в Desktop)
        setTimeout(() => {
            const frame = document.getElementById('content-frame');
            if (frame && frame.contentWindow) {
                const isDark = document.documentElement.classList.contains('dark');
                frame.contentWindow.document.documentElement.classList.toggle('dark', isDark);
            }
        }, 150);
    }
    updatePlayerUI();
}

function renderLessonsSidebar() {
    const list = document.getElementById('lessons-list');
    if (!list) return;
    list.innerHTML = currentCourse.lessons.map((l, i) => {
        const active = currentLessonId === l.id;
        const done = currentCourse.completedLessons ? currentCourse.completedLessons.includes(l.id) : false;
     return `<button onclick="loadLesson('${l.id}')" class="w-full text-left p-5 rounded-2xl transition-all flex items-center justify-between font-bold text-sm ${active ? 'bg-indigo-600 text-white shadow-xl' : 'bg-white dark:bg-slate-800 dark:text-slate-300 shadow-sm'}">
            <span class="truncate">${i + 1}. ${l.title}</span>
            <i class="fa-solid ${done ? 'fa-check-circle text-green-500' : 'fa-play-circle'} opacity-50"></i>
        </button>`;
    }).join('');
}

function updatePlayerUI() {
    const btn = document.getElementById('complete-btn');
    if (!btn) return;

    if (currentQuiz && currentQuiz.length > 0) {
        btn.innerHTML = `<span>ПРОЙТИ ТЕСТ</span> <i class="fa-solid fa-vial"></i>`;
        btn.onclick = () => { document.getElementById('quiz-modal').classList.remove('hidden'); showQuiz(); };
    } else {
        btn.innerHTML = `<span>ЗАВЕРШИТЬ УРОК</span> <i class="fa-solid fa-check-circle"></i>`;
        btn.onclick = () => saveLessonProgress();
    }
}

// ==========================================
// 8. ACTIONS & QUIZ
// ==========================================
async function handleMarketAction(id, folder) {
    if (IS_ONLINE) location.href = `player.html?id=${id}`;
    else {
        const res = await fetch('/api/download', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({folder}) });
        if (res.ok) syncSystemData();
    }
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
    }
    else alert(`Результат: ${score}/${currentQuiz.length}.`);
}

async function saveLessonProgress() {
    if (!currentCourse.completedLessons) currentCourse.completedLessons = [];
    
    if (!currentCourse.completedLessons.includes(currentLessonId)) {
        currentCourse.completedLessons.push(currentLessonId);
    }
    
    if (IS_ONLINE) {
        // 1. Сохраняем локально для мгновенного отклика
        localStorage.setItem('aura_progress_' + currentCourse.id, JSON.stringify(currentCourse.completedLessons));
        
        // 2. Если залогинен — отправляем XP и статус в Cloud
        if (currentUser) {
            await AuraSocial.addXP(AURA_UI.xpPerQuiz || 10);
            // Можно добавить сохранение прогресса конкретно в коллекцию 'users/uid/progress'
        }
    } else {
        // ОФФЛАЙН (Node.js)
        await fetch('/api/complete-lesson', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ courseId: currentCourse.id, lessonId: currentLessonId }) 
        });
    }
    
    renderLessonsSidebar(); 
    updatePlayerUI();
}

// ==========================================
// 9. ФИКС ЧАТА (КНОПКА "v")
// ==========================================
function toggleChat() { 
    const chat = document.getElementById('ai-chat');
    if (chat) {
        // Если чат открывается, убеждаемся что он не перекрывает всё на мобилках
        chat.classList.toggle('hidden');
        console.log("Чат переключен");
    }
}
window.toggleChat = toggleChat;

async function sendChatMessage() {
    const input = document.getElementById('chat-input'), box = document.getElementById('chat-messages');
    if (!input || !input.value.trim() || !box) return;

    const userText = input.value;
    box.innerHTML += `<div class="flex justify-end mb-4"><div class="chat-bubble-user">${userText}</div></div>`;
    input.value = ''; box.scrollTop = box.scrollHeight;

    const typingId = 'typing-' + Date.now();
    box.innerHTML += `<div id="${typingId}" class="flex justify-start mb-4 animate-pulse"><div class="chat-bubble-ai">Aura AI думает...</div></div>`;

    try {
        const context = document.getElementById('player-lesson-title')?.innerText || "Общая тема";
        const reply = await callGeminiDirect(userText, context);
        
        document.getElementById(typingId).remove();
        box.innerHTML += `<div class="flex justify-start mb-4 animate-slideUp"><div class="chat-bubble-ai">${reply}</div></div>`;
    } catch (e) {
        document.getElementById(typingId).innerText = "Ошибка ИИ. Проверьте ключ или интернет.";
    }
    box.scrollTop = box.scrollHeight;
}

// ==========================================
// 10. BOOT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = window.location.pathname.includes('admin.html'), isCreator = window.location.pathname.includes('creator.html');
    const themeBtn = document.getElementById('theme-icon') ? document.getElementById('theme-icon').parentElement : null;
    if (themeBtn) themeBtn.onclick = (e) => { e.preventDefault(); AuraThemeEngine.toggle(); };
    
    // ПРИНУДИТЕЛЬНО СКРЫВАЕМ ЧАТ ПРИ ЗАГРУЗКЕ
    const chat = document.getElementById('ai-chat');
    if (chat) chat.classList.add('hidden');

    await syncSystemData();

    if (window.location.pathname.includes('player.html')) {
        const id = new URLSearchParams(window.location.search).get('id');
        if (id && window.auraCloudDB) {
            const doc = await window.auraCloudDB.collection('courses').doc(id).get();
            if (doc.exists) openCourse(encodeURIComponent(JSON.stringify(doc.data())));
        }
    }
    
    if (IS_ONLINE) AuraSocial.init();
});

// ГЛОБАЛЬНЫЕ ЭКСПОРТЫ
window.AuraRenderer = AuraRenderer;
window.AuraSocial = AuraSocial;
window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.toggleTheme = () => AuraThemeEngine.toggle();
window.closeCourse = closeCourse;
window.loadLesson = loadLesson;
window.validateQuiz = validateQuiz;
window.handleMarketAction = handleMarketAction;
