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
            await ref.set({ 
                name: currentUser.displayName, 
                xp: 0, 
                avatar: currentUser.photoURL, 
                lastSeen: new Date().toISOString() 
            });
        }
    }, // Оставляем одну скобку здесь

    async addXP(pts) {
        if (!IS_ONLINE || !currentUser) return;
        try {
            await window.auraCloudDB.collection('users').doc(currentUser.uid).update({
                xp: window.firebase.firestore.FieldValue.increment(pts)
            });
            console.log(`🏆 Начислено ${pts} XP!`);
        } catch (e) {
            console.error("Ошибка начисления XP:", e);
        }
    },
 loadLeaderboard() {
        const cont = document.getElementById('leaderboard-container');
        if (!cont || !window.auraCloudDB) return;

        // Используем onSnapshot вместо get() для живой связи
        window.auraCloudDB.collection('users')
            .orderBy('xp', 'desc')
            .limit(5)
            .onSnapshot((snap) => {
                cont.innerHTML = snap.docs.map((doc, i) => {
                    const u = doc.data();
                    return `
                        <div class="flex items-center justify-between p-4 bg-white/5 rounded-3xl border border-white/5 mb-2 animate-fade">
                            <div class="flex items-center gap-3">
                                <span class="opacity-30 font-black text-[10px]">#${i + 1}</span>
                                <img src="${u.avatar || 'https://ui-avatars.com/api/?name='+u.name}" class="w-8 h-8 rounded-full border border-aura-primary/20">
                                <span class="text-xs font-bold truncate w-24 md:w-auto">${u.name}</span>
                            </div>
                            <span class="xp-text text-[10px]">${u.xp} XP</span>
                        </div>`;
                }).join('');
            });
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
        
    },
    // Сохранение пройденного урока в Облако
    async saveProgressToCloud(courseId, lessonId) {
        if (!currentUser || !window.auraCloudDB) return;
        const ref = window.auraCloudDB.collection('users').doc(currentUser.uid);
        
        try {
            // Используем arrayUnion, чтобы добавить ID урока в массив, не затирая старые
            await ref.set({
                progress: {
                    [courseId]: window.firebase.firestore.FieldValue.arrayUnion(lessonId)
                }
            }, { merge: true });
            console.log("☁️ Прогресс синхронизирован с облаком");
        } catch (e) {
            console.error("Ошибка синхронизации:", e);
        }
    },

    // Загрузка всего прогресса при входе
    async loadCloudProgress() {
        if (!currentUser || !window.auraCloudDB) return null;
        const doc = await window.auraCloudDB.collection('users').doc(currentUser.uid).get();
        if (doc.exists && doc.data().progress) {
            return doc.data().progress;
        }
        return {};
    }
};


// Настройка ИИ для работы ПРЯМО в браузере (без сервера)
const GEMINI_KEY = "AIzaSyD8q-cw7yAQbrakqIWVQjldhOlezPQAuYQ"; // Твой ключ

async function callGeminiDirect(message, context) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`;
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
    let imgSrc = b.data.url || '';
    // Если мы онлайн и путь локальный (media/...) — это значит, что в онлайне картинки нет.
    // Мы можем вывести заглушку или оригинальную ссылку, если она сохранилась.
    if (IS_ONLINE && imgSrc.startsWith('media/')) {
        return `<div class="${mW} mx-auto ${space} py-10 border-2 border-dashed border-white/5 rounded-3xl text-center">
                    <i class="fa-solid fa-image opacity-20 text-4xl"></i>
                    <p class="text-[8px] uppercase mt-2 opacity-30">Медиа доступно только в Desktop версии</p>
                </div>`;
    }
    return `<div class="${mW} mx-auto ${space} group animate-fade"><img src="${imgSrc}" class="w-full rounded-[2.5rem] shadow-2xl border dark:border-white/5"></div>`;
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

    grid.innerHTML = courses.map(course => {
        // Расчет прогресса
        const done = (course.completedLessons) ? [...new Set(course.completedLessons)].length : 0;
        const total = (course.lessons && course.lessons.length > 0) ? course.lessons.length : 1;
        const prc = Math.round((done / total) * 100) || 0;

        return `
            <div class="course-card bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm animate-fade">
                <div onclick="handleCourseClick('${course.id}')" class="cursor-pointer">
                    <div class="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 shadow-inner">
                        <i class="fa-solid fa-graduation-cap text-2xl"></i>
                    </div>
                    <h3 class="text-2xl font-black dark:text-white mb-2 uppercase tracking-tighter leading-none">
                        ${course.title || 'Без названия'}
                    </h3>
                    <p class="text-[10px] font-black uppercase text-slate-400 mb-6">
                        Автор: ${course.author || 'Aura Expert'}
                    </p>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
                        <div class="bg-indigo-600 h-full transition-all duration-1000" style="width: ${prc}%"></div>
                    </div>
                </div>
            </div>`;
    }).join('');
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
            <div class="absolute top-6 right-8">
                <span class="bg-indigo-100 dark:bg-indigo-900/50 text-aura-indigo text-[8px] font-black px-3 py-1 rounded-full uppercase border border-indigo-200 dark:border-indigo-800">Cloud Market</span>
            </div>
            <div class="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl mb-8 flex items-center justify-center text-slate-300 text-4xl group-hover:text-aura-primary transition-all shadow-inner">
                <i class="fa-solid fa-cloud-arrow-down"></i>
            </div>
            <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase tracking-tighter">${c.title || 'Новый курс'}</h3>
            <p class="text-[10px] font-black uppercase text-slate-400 mb-10 italic">${c.author || '...'}</p>
            <button onclick="handleMarketAction('${c.id}', '${c.folder}')" class="w-full py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl">
                ${IS_ONLINE ? 'Открыть превью' : 'Скачать оффлайн'}
            </button>
        </div>`).join(''); // <-- ВАЖНО: закрыли map и превратили в строку
} // <-- ВАЖНО: закрыли функцию

// ==========================================
// 7. ИНТЕРАКТИВНЫЙ ПЛЕЕР
// ==========================================
async function openCourse(dataRaw) {
    currentCourse = JSON.parse(decodeURIComponent(dataRaw));
    
    if (IS_ONLINE) {
        // Сначала берем локальный прогресс
        const local = localStorage.getItem('aura_progress_' + currentCourse.id);
        currentCourse.completedLessons = local ? JSON.parse(local) : [];

        // Если ученик вошел в Google — подтягиваем данные из облака
        if (currentUser) {
            const cloudProgress = await AuraSocial.loadCloudProgress();
            if (cloudProgress && cloudProgress[currentCourse.id]) {
                // Склеиваем локальный и облачный прогресс (чтобы ничего не потерять)
                const merged = [...new Set([...currentCourse.completedLessons, ...cloudProgress[currentCourse.id]])];
                currentCourse.completedLessons = merged;
                // Обновляем локалку свежими данными из облака
                localStorage.setItem('aura_progress_' + currentCourse.id, JSON.stringify(merged));
            }
        }
    }

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
    // Используем '==' вместо '===' чтобы не зависеть от того, строка это или число
    const lesson = currentCourse.lessons.find(l => l.id == id);
    if (!lesson) {
        console.error("Урок не найден:", id);
        return;
    }
    currentLessonId = id; 
    currentQuiz = lesson.quiz || [];
    
    const titleEl = document.getElementById('player-lesson-title');
    if (titleEl) titleEl.innerText = lesson.title;
    
    renderLessonsSidebar();
    
    const container = document.getElementById('content-container');
    if (!container) return;

    if (IS_ONLINE) {
        // ОНЛАЙН: Прямой рендеринг блоков в обертку стилей
        container.innerHTML = `
            <div class="aura-content-body">
                ${AuraRenderer.generateHTML(lesson.blocks || lesson.htmlBody || "Контент недоступен")}
            </div>`;
        // Прокручиваем наверх при смене урока
        container.scrollTop = 0;
    } else {
        // ОФФЛАЙН (Localhost): Загрузка через iframe
        const url = `/content/user/${encodeURIComponent(currentCourse.folder)}/${encodeURIComponent(lesson.content)}`;
        container.innerHTML = `<iframe id="content-frame" src="${url}" class="w-full h-full border-none bg-white dark:bg-slate-900 animate-fade"></iframe>`;
        
        // Синхронизация темы для iframe
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
    const tag = document.getElementById('lesson-status-tag');
    if (!btn) return;

    const isDone = currentCourse.completedLessons ? currentCourse.completedLessons.includes(currentLessonId) : false;
    if (tag) tag.classList.toggle('hidden', !isDone);

    // Если в уроке есть тест — меняем кнопку
    if (currentQuiz && currentQuiz.length > 0) {
        btn.innerHTML = `<span>ПРОЙТИ ТЕСТ</span> <i class="fa-solid fa-vial"></i>`;
        // При клике открываем модалку (функция handleCompleteAction ниже)
        btn.onclick = () => handleCompleteAction();
    } else {
        btn.innerHTML = `<span>ЗАВЕРШИТЬ УРОК</span> <i class="fa-solid fa-check-circle"></i>`;
        btn.onclick = () => handleCompleteAction();
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
        // 1. Быстрое сохранение в браузере (чтобы сразу отобразилась галочка)
        localStorage.setItem('aura_progress_' + currentCourse.id, JSON.stringify(currentCourse.completedLessons));
        
        // 2. Если залогинен — отправляем в Firestore навсегда
        if (currentUser) {
            await AuraSocial.saveProgressToCloud(currentCourse.id, currentLessonId);
            await AuraSocial.addXP(AURA_UI.xpPerQuiz || 15);
            showXPPopup(15);
        }
    } else {
        // ОФФЛАЙН РЕЖИМ (Node.js)
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
    if (!chat) return;

    if (chat.classList.contains('hidden')) {
        chat.classList.remove('hidden');
        const box = document.getElementById('chat-messages');
        if (box) box.scrollTop = box.scrollHeight;
    } else {
        chat.classList.add('hidden');
    }
}



async function sendChatMessage() {
    const input = document.getElementById('chat-input'), box = document.getElementById('chat-messages');
    if (!input || !input.value.trim() || !box) return;

    const userText = input.value;
    // Рисуем сообщение пользователя
    box.innerHTML += `<div class="flex justify-end mb-4"><div class="chat-bubble-user text-sm">${userText}</div></div>`;
    input.value = ''; 
    box.scrollTop = box.scrollHeight;

    // Показываем, что ИИ думает
    const typingId = 'typing-' + Date.now();
    box.innerHTML += `<div id="${typingId}" class="flex justify-start mb-4 animate-pulse"><div class="chat-bubble-ai italic">Aura AI думает...</div></div>`;
    box.scrollTop = box.scrollHeight;

    try {
        const context = document.getElementById('player-lesson-title')?.innerText || "Общая тема";
        
        // !!! ВАЖНО: ВОТ ЭТУ СТРОКУ ТЫ ПРОПУСТИЛ !!!
        const reply = await callGeminiDirect(userText, context); 
        
        // Теперь, когда ответ получен, удаляем индикатор загрузки
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        // Рисуем красивый бабл от ИИ
        box.innerHTML += `
            <div class="flex justify-start mb-4 animate-slideUp">
                <div class="chat-bubble-ai shadow-md leading-relaxed text-sm">
                    ${reply.replace(/\n/g, '<br>')} 
                </div>
            </div>`;
    } catch (e) {
        console.error("Ошибка чата:", e);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.innerText = "Ошибка ИИ. Проверьте ключ или интернет.";
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

/**
 * ЛОГИКА ФИНАЛЬНОЙ КНОПКИ (ТЕСТ ИЛИ ЗАВЕРШЕНИЕ)
 */
function handleCompleteAction() {
    if (currentQuiz && currentQuiz.length > 0) {
        // Если есть вопросы — открываем модалку теста
        showQuiz();
    } else {
        // Если теста нет — просто сохраняем прогресс
        saveLessonProgress();
        alert("🎉 Урок пройден! Прогресс сохранен.");
        location.href = 'market.html';
    }
}

/**
 * ОТРИСОВКА ТЕСТА В МОДАЛКЕ
 */
function showQuiz() {
    const cont = document.getElementById('quiz-questions-container');
    const modal = document.getElementById('quiz-modal');
    if (!cont || !modal) return;

    cont.innerHTML = currentQuiz.map((q, i) => `
        <div class="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2.5rem] mb-6 border border-slate-100 dark:border-white/5 shadow-sm animate-fade">
            <h4 class="text-lg font-black mb-6 dark:text-white leading-tight">
                <span class="text-aura-primary mr-2">#${i + 1}</span> ${q.question}
            </h4>
            <div class="grid gap-3">
                ${q.options.map((opt, oi) => `
                    <label class="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 rounded-2xl cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all border border-slate-100 dark:border-white/5">
                        <input type="radio" name="q-${i}" value="${oi}" class="w-5 h-5 accent-indigo-600">
                        <span class="font-bold text-sm text-slate-700 dark:text-slate-200">${opt}</span>
                    </label>`).join('')}
            </div>
        </div>`).join('');
    
    modal.classList.remove('hidden');
}

function showXPPopup(pts) {
    const popup = document.createElement('div');
    popup.className = "fixed top-10 left-1/2 -translate-x-1/2 z-[1000] bg-gradient-to-r from-aura-primary to-indigo-600 text-white px-8 py-4 rounded-full font-black shadow-2xl animate-slideUp flex items-center gap-3";
    popup.innerHTML = `<i class="fa-solid fa-bolt text-yellow-400"></i> +${pts} XP ПОЛУЧЕНО!`;
    
    document.body.appendChild(popup);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        popup.classList.add('opacity-0', 'transition-all', 'duration-500');
        setTimeout(() => popup.remove(), 500);
    }, 3000);
}

function handleCompleteAction() {
    if (currentQuiz && currentQuiz.length > 0) {
        // Открываем модалку теста
        document.getElementById('quiz-modal')?.classList.remove('hidden');
        showQuiz(); // Вызываем отрисовку вопросов
    } else {
        // Просто завершаем урок
        saveLessonProgress();
        showXPPopup(10); // Показываем уведомление
    }
}

// Отрисовка вопросов в модальном окне
function showQuiz() {
    const cont = document.getElementById('quiz-questions-container');
    if (!cont) return;
    
    cont.innerHTML = currentQuiz.map((q, i) => `
        <div class="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2.5rem] mb-6 border border-slate-100 dark:border-white/5 animate-fade">
            <h4 class="text-lg font-black mb-6 dark:text-white leading-tight">
                <span class="text-aura-primary mr-2">#${i + 1}</span> ${q.question}
            </h4>
            <div class="grid gap-3">
                ${q.options.map((opt, oi) => `
                    <label class="flex items-center gap-4 p-4 bg-white dark:bg-slate-700 rounded-2xl cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all border border-slate-100 dark:border-white/5">
                        <input type="radio" name="q-${i}" value="${oi}" class="w-5 h-5 accent-indigo-600">
                        <span class="font-bold text-sm text-slate-700 dark:text-slate-200">${opt}</span>
                    </label>`).join('')}
            </div>
        </div>`).join('');
}

// ==========================================
// 11. ГЛОБАЛЬНЫЕ ЭКСПОРТЫ (ДЛЯ HTML)
// ==========================================
// ==========================================
// 11. ГЛОБАЛЬНЫЕ ЭКСПОРТЫ (ДЛЯ HTML КНОПОК)
// ==========================================
window.AuraRenderer = AuraRenderer;
window.AuraSocial = AuraSocial;
window.toggleTheme = () => AuraThemeEngine.toggle();
window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.handleCourseClick = handleCourseClick; // Тот самый фикс SyntaxError
window.loadLesson = loadLesson;
window.showQuiz = showQuiz;
window.closeQuiz = () => document.getElementById('quiz-modal').classList.add('hidden');
window.validateQuiz = validateQuiz;
window.handleCompleteAction = handleCompleteAction;
window.handleMarketAction = handleMarketAction;
window.showXPPopup = showXPPopup;
