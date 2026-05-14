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
// ВРЕМЕННО: Для тестов в VS Code заставляем прогу думать, что она в облаке
const IS_ONLINE = true;

let isFavOnly = false;
let aiChatHistory = []; // Память чата
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
        try { 
            await window.firebase.auth().signInWithPopup(provider); 
        } 
        catch (e) { 
            console.error("Критическая ошибка входа:", e); // Смотрим сюда в F12
            if (e.code === 'auth/unauthorized-domain') {
                alert("Ошибка: Домен 127.0.0.1 не добавлен в Authorized Domains в консоли Firebase!");
            } else {
                alert("Ошибка входа: " + e.message);
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


 
const GEMINI_KEY = "AIzaSyDAgZzEDV5YqSU3komZ4llpQ6Rf2nHr-e4";

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

// --- ДОБАВИТЬ ЭТУ ФУНКЦИЮ (ОБЯЗАТЕЛЬНО) ---
function formatVideoUrl(url) {
    if (!url) return '';
    // Проверяем, является ли ссылка ютубовской
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('watch?v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('embed/')) {
            return url;
        }
        return `https://www.youtube.com/embed/${videoId}`;
    }
    return url; // Если это просто прямая ссылка на .mp4
}

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
        <h1 class="space-font text-6xl font-black text-aura-primary dark:text-indigo-400 uppercase tracking-tighter mb-4 drop-shadow-xl">
            ${b.data.title || ''}
        </h1>
        <p class="text-slate-500 dark:text-slate-400 italic text-xl max-w-2xl mx-auto">
            ${b.data.sub || ''}
        </p>
        <div class="h-2 w-32 bg-aura-primary mx-auto mt-8 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.6)]"></div>
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
         // --- ТОЧЕЧНОЕ ИСПРАВЛЕНИЕ: Плеер видео (YouTube + MP4) ---
// В AuraRenderer.renderBlock замени 'video' на этот код:
function getYoutubeId(url) {
    if (!url) return null;
    // Регулярное выражение для извлечения ID из любых ссылок YouTube
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Теперь внутри case 'video':
// Теперь внутри case 'video':
case 'video':
    const videoId = getYoutubeId(b.data.url);
    if (!videoId) {
        return `<div class="p-10 text-center text-red-500">Ошибка: Некорректная ссылка на видео</div>`;
    }
    
    const playerId = 'yt-' + Math.random().toString(36).substr(2, 9);
    
    setTimeout(() => {
        new YT.Player(playerId, {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: { 'autoplay': 0, 'controls': 1 }
        });
    }, 500);

    return `<div class="max-w-4xl mx-auto mb-10 px-4">
                <div id="${playerId}" class="w-full aspect-video rounded-[2.5rem] overflow-hidden shadow-2xl bg-black"></div>
            </div>`;
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
// --- ТОЧЕЧНАЯ ПРАВКА: Синхронизация Библиотеки и Маркета ---
// --- ТОЧЕЧНАЯ ПРАВКА: Синхронизация Библиотеки и Маркета ---
async function syncSystemData() {
    try {
        if (IS_ONLINE) {
            if (!window.auraCloudDB) return;
            const snapshot = await window.auraCloudDB.collection('courses').get();
            marketCourses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Если юзер залогинен, достаем его прогресс и наполняем "Мои курсы"
            if (currentUser) {
                const cloudProgress = await AuraSocial.loadCloudProgress() || {};
                // Фильтруем: в Библиотеку попадают только те курсы, где есть хоть один пройденный урок
                allCourses = marketCourses.filter(c => cloudProgress[c.id] && cloudProgress[c.id].length > 0);
                
                // Прикрепляем прогресс к каждому объекту курса для рендеринга
                allCourses.forEach(c => {
                    c.completedLessons = cloudProgress[c.id];
                });
            }

            if (activeTab === 'library') renderLibraryGrid(allCourses);
            else renderMarketGrid(marketCourses);
            
            updateGlobalStats(); // Обновляем цифры
        } else {
            // Логика для оффлайна остается прежней
            const [libRes, markRes] = await Promise.all([fetch('/api/courses'), fetch('/api/market')]);
            allCourses = await libRes.json();
            marketCourses = await markRes.json();
            updateGlobalStats();
        }
    } catch (err) { console.error("Ошибка синхронизации:", err); }
}
// --- ТОЧЕЧНАЯ ПРАВКА: Реальный расчет статистики ---
async function updateGlobalStats() {
    const statC = document.getElementById('stat-total-courses');
    const statL = document.getElementById('stat-total-lessons');
    const statP = document.getElementById('stat-overall-percent');
    if (!statC || !statL || !statP) return;

    let totalLessonsCount = 0;
    let doneLessonsCount = 0;

    // Считаем прогресс по всем курсам, которые пользователь открывал
    allCourses.forEach(c => {
        totalLessonsCount += (c.lessons ? c.lessons.length : 0);
        doneLessonsCount += (c.completedLessons ? c.completedLessons.length : 0);
    });

    const percent = totalLessonsCount > 0 ? Math.round((doneLessonsCount / totalLessonsCount) * 100) : 0;

    statC.innerText = allCourses.length; // Сколько курсов в библиотеке
    statL.innerText = doneLessonsCount;  // Сколько всего уроков пройдено
    statP.innerText = percent + '%';     // Общий прогресс
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

// --- ТОЧЕЧНАЯ ПРАВКА: Рендер Библиотеки с прогрессом ---
// --- ТОЧЕЧНАЯ ПРАВКА: Рендер Библиотеки с прогрессом ---
// --- ТОЧЕЧНАЯ ПРАВКА: Расчет процентов % ---
function renderLibraryGrid(courses) {
    const grid = document.getElementById('courses-grid');
    if (!grid) return;
    
    grid.innerHTML = courses.map(course => {
        const totalLessons = course.lessons ? course.lessons.length : 0;
        const completedCount = course.completedLessons ? course.completedLessons.length : 0;
        
        // Математика процентов
        const prc = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

        return `
            <div class="course-card bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-sm animate-fade">
                <div onclick="handleCourseClick('${course.id}')" class="cursor-pointer">
                    <div class="flex justify-between items-start mb-6">
                         <div class="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                            <i class="fa-solid fa-graduation-cap text-2xl"></i>
                        </div>
                        <span class="text-[10px] font-black ${prc === 100 ? 'text-emerald-500' : 'text-aura-primary'}">${prc}%</span>
                    </div>
                    <h3 class="text-2xl font-black dark:text-white mb-2 uppercase tracking-tighter">${course.title}</h3>
                    <p class="text-[10px] font-black uppercase text-slate-400 mb-6">Модулей: ${completedCount} / ${totalLessons}</p>
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

// --- ТОЧЕЧНАЯ ПРАВКА: Маркет с кнопками Избранного ---
function renderMarketGrid(courses) {
    const grid = document.getElementById('market-grid');
    if (!grid) return;
    
    grid.innerHTML = courses.map(c => {
        const isFav = favorites.includes(c.id);
        return `
        <div class="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-white/5 flex flex-col items-center text-center shadow-sm relative group animate-slideUp">
            <!-- Кнопка Избранное -->
            <button onclick="toggleFavorite('${c.id}')" class="absolute top-6 left-8 text-2xl transition-all hover:scale-110 ${isFav ? 'text-red-500' : 'text-slate-300 opacity-50 hover:opacity-100'}">
                <i class="fa-solid fa-heart"></i>
            </button>

            <div class="absolute top-6 right-8">
                <span class="bg-indigo-100 dark:bg-indigo-900/50 text-aura-indigo text-[8px] font-black px-3 py-1 rounded-full uppercase border border-indigo-200 dark:border-indigo-800">Cloud Market</span>
            </div>
            <div class="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl mb-8 flex items-center justify-center text-slate-300 text-4xl group-hover:text-aura-primary transition-all shadow-inner">
                <i class="fa-solid fa-cloud-arrow-down"></i>
            </div>
            <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-2 leading-tight uppercase tracking-tighter">${c.title}</h3>
            <p class="text-[10px] font-black uppercase text-slate-400 mb-10 italic">${c.author || 'Aura Architect'}</p>
            <button onclick="handleMarketAction('${c.id}', '${c.folder}')" class="w-full py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl">
                Открыть превью
            </button>
        </div>`;
    }).join('');
}

// --- ТОЧЕЧНАЯ ПРАВКА: Логика поиска ---
document.addEventListener('input', (e) => {
    if (e.target.id === 'course-search') {
        const query = e.target.value.toLowerCase();
        if (activeTab === 'library') {
            const filtered = allCourses.filter(c => c.title.toLowerCase().includes(query));
            renderLibraryGrid(filtered);
        } else {
            const filtered = marketCourses.filter(c => c.title.toLowerCase().includes(query));
            renderMarketGrid(filtered);
        }
    }
});

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
    console.log("DEBUG: Загрузка урока ID:", id); // Посмотрим в консоль
    
    // 1. Поиск урока (добавим логику приведения к строке)
    const lesson = currentCourse.lessons.find(l => String(l.id) === String(id));
    
    if (!lesson) {
        console.error("❌ Урок не найден! ID:", id, "Доступные уроки:", currentCourse.lessons);
        return; // Здесь функция останавливалась
    }

    currentLessonId = id; 
    currentQuiz = lesson.quiz ||[];
    
    // 2. Обновление заголовков
    const titleEl = document.getElementById('player-lesson-title');
    if (titleEl) titleEl.innerText = lesson.title;
    
    renderLessonsSidebar();
    
    const container = document.getElementById('content-container');
    if (!container) return;

    container.scrollTo(0, 0); 
    
    // 3. Рендеринг (добавили явное удаление overlay)
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('hidden');

    if (IS_ONLINE) {
        container.innerHTML = `<div class="aura-content-body">${AuraRenderer.generateHTML(lesson.blocks || lesson.htmlBody || "Контент недоступен")}</div>`;
    } else {
        const url = `/content/user/${encodeURIComponent(currentCourse.folder)}/${encodeURIComponent(lesson.content)}`;
        container.innerHTML = `<iframe id="content-frame" src="${url}" class="w-full h-full border-none bg-white dark:bg-slate-900 animate-fade"></iframe>`;
    }

    // 4. Принудительный вызов UI (убрали setTimeout, вызываем сразу)
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

// --- ТОЧЕЧНАЯ ПРАВКА: Логика кнопки завершения ---
// --- ТОЧЕЧНОЕ ИСПРАВЛЕНИЕ №1: Появление кнопки Теста ---
// --- ТОЧЕЧНАЯ ПРАВКА: Оживление кнопки теста ---
// --- ТОЧЕЧНОЕ ИСПРАВЛЕНИЕ: Кнопка в футере больше не исчезает ---
function updatePlayerUI() {
    const btn = document.getElementById('complete-btn');
    const tag = document.getElementById('lesson-status-tag');
    
    if (!btn) {
        console.error("❌ Кнопка #complete-btn не найдена в DOM!");
        return;
    }

 btn.classList.remove('hidden');
    btn.style.display = "flex"; 

    const isDone = currentCourse.completedLessons && currentCourse.completedLessons.includes(currentLessonId);
    const hasQuiz = (currentQuiz && currentQuiz.length > 0);

    console.log("DEBUG UI:", { isDone, hasQuiz, currentLessonId });

    // Принудительно задаем видимость
    btn.style.display = "flex"; 
    btn.style.visibility = "visible";

    if (hasQuiz) {
        btn.innerHTML = `<span>ПРОЙТИ ТЕСТ</span> <i class="fa-solid fa-vial"></i>`;
    } else {
        btn.innerHTML = `<span>ЗАВЕРШИТЬ УРОК</span> <i class="fa-solid fa-check-circle"></i>`;
    }

    if (isDone) {
        btn.style.opacity = "0.6";
        btn.innerHTML = `<span>ПРОЙДЕНО (ПОВТОРИТЬ)</span> <i class="fa-solid fa-rotate-right"></i>`;
        if (tag) tag.classList.remove('hidden');
    } else {
        btn.style.opacity = "1";
        if (tag) tag.classList.add('hidden');
    }
}
// ==========================================
// 8. ACTIONS & QUIZ
// ==========================================
async function handleMarketAction(id, folder) {
    if (IS_ONLINE) {
        // Передаем ТОЛЬКО ID, а не весь объект
        location.href = `player.html?id=${id}`;
    } else {
        const res = await fetch('/api/download', { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({folder}) 
        });
        if (res.ok) syncSystemData();
    }
}
async function validateQuiz() {
    let score = 0;
    currentQuiz.forEach((q, i) => {
        const sel = document.querySelector(`input[name="q-${i}"]:checked`);
        if (sel && parseInt(sel.value) === parseInt(q.correct)) score++;
    });

    if (score === currentQuiz.length) { 
        alert("🎉 Поздравляем! Тест пройден на 100%.");
        document.getElementById('quiz-modal').classList.add('hidden'); 
        await saveLessonProgress(); // Сохраняем результат
    } else {
        alert(`Вы ответили правильно на ${score} из ${currentQuiz.length}. Попробуйте еще раз!`);
    }
}

async function saveLessonProgress() {
    if (!currentCourse.completedLessons) currentCourse.completedLessons = [];
    
    if (!currentCourse.completedLessons.includes(currentLessonId)) {
        currentCourse.completedLessons.push(currentLessonId);
        
        if (IS_ONLINE) {
            // 1. Сохраняем локально (для скорости)
            localStorage.setItem('aura_progress_' + currentCourse.id, JSON.stringify(currentCourse.completedLessons));
            
            // 2. Отправляем в Облако (навсегда в аккаунт)
            if (currentUser) {
                await AuraSocial.saveProgressToCloud(currentCourse.id, currentLessonId);
                await AuraSocial.addXP(15); // Даем 15 XP за урок
            }
        }
    }
    
    renderLessonsSidebar();
    updatePlayerUI();
    updateGlobalStats(); 
}
// ==========================================
// 9. ФИКС ЧАТА (КНОПКА "v")
// ==========================================
function toggleChat() {
    const chatWindow = document.getElementById('ai-chat');
    if (!chatWindow) {
        console.error("Элемент чата не найден!");
        return;
    }
    
    if (chatWindow.classList.contains('hidden')) {
        chatWindow.classList.remove('hidden');
        // Авто-скролл вниз при открытии
        const box = document.getElementById('chat-messages');
        if (box) box.scrollTop = box.scrollHeight;
    } else {
        chatWindow.classList.add('hidden');
    }
}



// --- ТОЧЕЧНАЯ ПРАВКА: ИИ с памятью диалога ---
async function sendChatMessage() {
    const input = document.getElementById('chat-input'), box = document.getElementById('chat-messages');
    if (!input || !input.value.trim() || !box) return;

    const userText = input.value;
    input.value = ''; 
    
    // Добавляем сообщение юзера в интерфейс и в ПАМЯТЬ
    box.innerHTML += `<div class="flex justify-end mb-4"><div class="chat-bubble-user text-sm">${userText}</div></div>`;
    aiChatHistory.push({ role: "user", parts: [{ text: userText }] });
    
    box.scrollTop = box.scrollHeight;

    const typingId = 'typing-' + Date.now();
    box.innerHTML += `<div id="${typingId}" class="flex justify-start mb-4 animate-pulse"><div class="chat-bubble-ai italic">Aura AI анализирует...</div></div>`;
    box.scrollTop = box.scrollHeight;

    try {
        const lessonTitle = document.getElementById('player-lesson-title')?.innerText || "Общая тема";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`;
        
        // Отправляем всю историю (последние 10 сообщений), чтобы ИИ помнил контекст
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { parts: [{ text: `Ты — Aura AI Tutor. Тема урока: ${lessonTitle}. Отвечай кратко и профессионально.` }] },
                    ...aiChatHistory.slice(-10) 
                ]
            })
        });

        const data = await response.json();
        const reply = data.candidates[0].content.parts[0].text;
        
        // Добавляем ответ ИИ в ПАМЯТЬ
        aiChatHistory.push({ role: "model", parts: [{ text: reply }] });

        document.getElementById(typingId)?.remove();
        box.innerHTML += `
            <div class="flex justify-start mb-4 animate-slideUp">
                <div class="chat-bubble-ai shadow-md leading-relaxed text-sm">
                    ${reply.replace(/\n/g, '<br>')} 
                </div>
            </div>`;
    } catch (e) {
        if (document.getElementById(typingId)) document.getElementById(typingId).innerText = "Ошибка связи с ядром ИИ.";
    }
    box.scrollTop = box.scrollHeight;
}
// ==========================================
// 10. BOOT
// ==========================================
// 10. BOOT (ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ)
document.addEventListener('DOMContentLoaded', async () => {
    // ПРИНУДИТЕЛЬНО СКРЫВАЕМ ЧАТ ПРИ ЗАГРУЗКЕ
    const chat = document.getElementById('ai-chat');
    if (chat) chat.classList.add('hidden');

    // Инициализируем тему
    AuraThemeEngine.init();

    // Запускаем синхронизацию данных (курсы, маркет)
    await syncSystemData();

    // ЕСЛИ МЫ ОНЛАЙН И В ПЛЕЕРЕ — ГРУЗИМ КУРС ПО ID ИЗ ССЫЛКИ
    if (IS_ONLINE && window.location.pathname.includes('player.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id');

        if (courseId && window.auraCloudDB) {
            console.log("🛰️ Прямая загрузка курса из облака: ", courseId);
            try {
                const doc = await window.auraCloudDB.collection('courses').doc(courseId).get();
                if (doc.exists) {
                    // Используем handleCourseClick, чтобы подтянуть прогресс и открыть плеер
                    const courseData = doc.data();
                    // Добавляем ID в данные, если его там нет
                    courseData.id = doc.id;
                    openCourse(encodeURIComponent(JSON.stringify(courseData)));
                } else {
                    console.error("Курс не найден в Firestore");
                }
            } catch (e) {
                console.error("Ошибка Firebase при авто-загрузке:", e);
            }
        }
    }
    
    // Включаем социальные функции (логин, лидерборд)
    if (IS_ONLINE) {
        AuraSocial.init();
    } else {
        // В оффлайне переключаемся на вкладку библиотеки по умолчанию
        if (document.getElementById('tab-lib')) switchTab('library');
    }
});

/**
 * ЛОГИКА ФИНАЛЬНОЙ КНОПКИ (ТЕСТ ИЛИ ЗАВЕРШЕНИЕ)
 */
 

/**
 * ОТРИСОВКА ТЕСТА В МОДАЛКЕ
 */
async function handleCompleteAction() {
    if (currentQuiz && currentQuiz.length > 0) {
        // Если есть тест — открываем модалку (она у тебя уже есть в HTML)
        document.getElementById('quiz-modal').classList.remove('hidden');
        showQuiz(); 
    } else {
        // Если теста нет — просто сохраняем прогресс
        await saveLessonProgress();
        showXPPopup(15);
    }
}

// --- ТОЧЕЧНОЕ ИСПРАВЛЕНИЕ: Отрисовка теста ---
function showQuiz() {
    const cont = document.getElementById('quiz-questions-container');
    if (!cont) return;

    if (!currentQuiz || currentQuiz.length === 0) {
        alert("В этом уроке нет теста.");
        return;
    }

    cont.innerHTML = currentQuiz.map((q, i) => `
        <div class="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2.5rem] mb-6 border border-slate-100 dark:border-white/5 shadow-sm">
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
    
    document.getElementById('quiz-modal')?.classList.remove('hidden');
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

/**
 * ПЕРЕКЛЮЧАТЕЛЬ БОКОВОЙ ПАНЕЛИ (МОБИЛЬНАЯ ВЕРСИЯ)
 */
// Функция открытия/закрытия боковой панели
function toggleSidebar() {
    const sidebar = document.getElementById('player-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
}
// Сделаем её доступной для кнопок в HTML

// Отрисовка вопросов в модальном окне


// --- ТОЧЕЧНАЯ ПРАВКА: Логика сердечек ---
function toggleFavorite(id) {
    if (favorites.includes(id)) {
        favorites = favorites.filter(favId => favId !== id);
    } else {
        favorites.push(id);
    }
    localStorage.setItem('aura-favorites', JSON.stringify(favorites));
    
    // Мгновенно перерисовываем, чтобы сердечко покраснело
    if (activeTab === 'market') renderMarketGrid(marketCourses);
    else syncSystemData(); // Если мы в библиотеке
}
window.toggleFavorite = toggleFavorite;



// --- ТОЧЕЧНАЯ ПРАВКА: Фильтр Избранного ---
// --- ТОЧЕЧНОЕ ИСПРАВЛЕНИЕ: Живой фильтр избранного ---

function toggleFavFilter() {
    isFavOnly = !isFavOnly;
    const btn = document.getElementById('fav-filter-btn');
    
    if (isFavOnly) {
        btn.classList.add('text-rose-500', 'border-rose-500', 'ring-2', 'ring-rose-500/20');
        // Показываем только те курсы, чьи ID есть в массиве favorites
        const filtered = marketCourses.filter(c => favorites.includes(c.id));
        renderMarketGrid(filtered);
    } else {
        btn.classList.remove('text-rose-500', 'border-rose-500', 'ring-2', 'ring-rose-500/20');
        renderMarketGrid(marketCourses);
    }
}
window.toggleFavFilter = toggleFavFilter;
// ==========================================
// 11. ГЛОБАЛЬНЫЕ ЭКСПОРТЫ (ДЛЯ HTML)
// ==========================================
window.toggleSidebar = toggleSidebar;
window.AuraRenderer = AuraRenderer;
window.AuraSocial = AuraSocial;
window.toggleTheme = () => AuraThemeEngine.toggle();
window.toggleChat = toggleChat;
window.sendChatMessage = sendChatMessage;
window.handleCourseClick = handleCourseClick;
window.loadLesson = loadLesson;
window.showQuiz = showQuiz;
window.closeQuiz = () => document.getElementById('quiz-modal').classList.add('hidden');
window.validateQuiz = validateQuiz;
window.handleCompleteAction = handleCompleteAction;
window.handleMarketAction = handleMarketAction;
window.showXPPopup = showXPPopup;
window.closeCourse = closeCourse;
