(function() {
  // ---------- НАСТРОЙКИ ----------
  const API_BASE = '/api';               // сервер для авторизации/избранного
  const TMDB_KEY = '611c7d469272e7193dcd150a0b4a8f67';
  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
  const moodGenres = {
    comedy: '35', drama: '18', romance: '10749', mystery: '9648',
    action: '28', horror: '27', scifi: '878'
  };

  let currentUser = JSON.parse(localStorage.getItem('moodmovie_user')) || null;
  let favorites = [];
  let currentPage = { home: 1, mood: 1 };
  let totalPages = { home: 1, mood: 1 };
  let state = { homeCategory: 'popular', mood: 'comedy' };

  // ---------- ИЗБРАННОЕ (сервер) ----------
  async function loadFavoritesFromServer() {
    if (!currentUser) { favorites = []; return; }
    try {
      const res = await fetch(`${API_BASE}/favorites`, {
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (res.ok) favorites = await res.json();
      else favorites = [];
    } catch (e) { favorites = []; }
  }

  async function onUserChanged() {
    await loadFavoritesFromServer();
    refreshCurrentView();
  }

  function refreshCurrentView() {
    const activeView = document.querySelector('.view.active');
    if (!activeView) return;
    if (activeView.id === 'viewHome') loadHomeCategory(state.homeCategory, currentPage.home);
    else if (activeView.id === 'viewMood') loadMoodMovies(state.mood, currentPage.mood);
    else if (activeView.id === 'viewFavorites') loadFavorites();
  }

  function updateAuthUI() {
    const authArea = document.getElementById('authArea');
    if (currentUser) {
      authArea.innerHTML = `
        <div class="user-menu">
          <span>👤 ${currentUser.username}</span>
          <button class="btn" id="favPageBtn"><i class="fas fa-heart"></i> Избранное</button>
          <button class="btn" id="logoutBtn">Выйти</button>
        </div>`;
      document.getElementById('logoutBtn').addEventListener('click', logout);
      document.getElementById('favPageBtn').addEventListener('click', () => showView('viewFavorites'));
    } else {
      authArea.innerHTML = `
        <button class="btn" id="loginBtn">Войти</button>
        <button class="btn btn-primary" id="registerBtn">Регистрация</button>`;
      document.getElementById('loginBtn').addEventListener('click', () => openAuthModal('login'));
      document.getElementById('registerBtn').addEventListener('click', () => openAuthModal('register'));
    }
  }

  function renderPagination(containerId, page, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    container.innerHTML = `
      <button class="btn" ${page <= 1 ? 'disabled' : ''} data-action="prev">← Назад</button>
      <span style="display:flex; align-items:center;">${page} / ${totalPages}</span>
      <button class="btn" ${page >= totalPages ? 'disabled' : ''} data-action="next">Вперёд →</button>`;
    container.querySelector('[data-action="prev"]')?.addEventListener('click', () => onPageChange(page - 1));
    container.querySelector('[data-action="next"]')?.addEventListener('click', () => onPageChange(page + 1));
  }

  function showError(grid, message) {
    grid.innerHTML = `<div class="empty-state">❌ ${message}</div>`;
  }

  // ---------- ФИЛЬМЫ (прямые запросы к TMDB) ----------
  async function loadHomeCategory(category, page = 1) {
    const grid = document.getElementById('homeMoviesGrid');
    const loader = document.getElementById('homeLoading');
    loader.style.display = 'block';
    grid.innerHTML = '';
    try {
      const endpoint = category === 'popular' ? 'popular' : 'now_playing';
      const res = await fetch(`${TMDB_BASE}/movie/${endpoint}?api_key=${TMDB_KEY}&language=ru&page=${page}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.results) throw new Error('Empty response');
      renderMoviesToGrid(data.results, grid);
      currentPage.home = page;
      totalPages.home = data.total_pages || 1;
      state.homeCategory = category;
      renderPagination('homePagination', page, totalPages.home, (p) => loadHomeCategory(category, p));
    } catch (err) {
      showError(grid, err.message);
    } finally {
      loader.style.display = 'none';
    }
  }

  async function loadMoodMovies(mood, page = 1) {
    const grid = document.getElementById('moodMoviesGrid');
    const loader = document.getElementById('moodLoading');
    loader.style.display = 'block';
    grid.innerHTML = '';
    const genre = moodGenres[mood] || '35';
    try {
      const res = await fetch(`${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&language=ru&with_genres=${genre}&sort_by=popularity.desc&page=${page}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.results) throw new Error('Empty response');
      renderMoviesToGrid(data.results, grid);
      currentPage.mood = page;
      totalPages.mood = data.total_pages || 1;
      state.mood = mood;
      renderPagination('moodPagination', page, totalPages.mood, (p) => loadMoodMovies(mood, p));
    } catch (err) {
      showError(grid, err.message);
    } finally {
      loader.style.display = 'none';
    }
  }

  async function searchMovies(query) {
    showView('viewHome');
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('homePagination').innerHTML = '';
    try {
      const res = await fetch(`${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&language=ru&query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      renderMoviesToGrid(data.results || [], document.getElementById('homeMoviesGrid'));
    } catch (err) {
      showError(document.getElementById('homeMoviesGrid'), 'Ошибка поиска');
    }
  }

  // ---------- ПОГОДНЫЙ СЛАЙДЕР (расширенный) ----------
  async function loadWeatherSlider() {
    const slider = document.getElementById('weatherSlider');
    if (!slider) return;

    slider.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

    // 1. Геолокация или Москва по умолчанию
    let latitude, longitude;
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch (geoErr) {
      // Пользователь не дал гео – используем Москву
      console.warn('Геолокация недоступна, показываем погоду для Москвы');
      latitude = 55.7558;
      longitude = 37.6173;
    }

    // 2. Получаем погоду (Open-Meteo)
    let weatherCode;
    try {
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );
      const weatherData = await weatherRes.json();
      weatherCode = weatherData.current_weather.weathercode;
    } catch (e) {
      console.error('Ошибка Open-Meteo', e);
      slider.innerHTML = '<div class="empty-state">Сервис погоды недоступен</div>';
      return;
    }

    // 3. Точный маппинг WMO Weather Codes → жанры TMDB
    function mapWeatherToGenres(code) {
      if ([0, 1].includes(code))       return { genres: '35,10751',        label: 'Ясно ☀️' };
      if ([2, 3].includes(code))       return { genres: '18,10749,9648',  label: 'Облачно ⛅' };
      if ([45, 48].includes(code))     return { genres: '9648,53,27',     label: 'Туман 🌫️' };
      if ([51, 53, 55].includes(code)) return { genres: '10749,18',       label: 'Морось 🌦️' };
      if ([56, 57, 61, 63, 65].includes(code)) return { genres: '53,9648',    label: 'Дождь 🌧️' };
      if ([66, 67, 80, 81, 82].includes(code)) return { genres: '27,53',      label: 'Ливень ⛈️' };
      if ([71, 73, 75, 77, 85, 86].includes(code)) return { genres: '14,10751,12', label: 'Снег ❄️' };
      if ([95, 96, 99].includes(code)) return { genres: '28,27,53',       label: 'Гроза ⚡' };
      return { genres: '28,12', label: 'Местами дождь 🌈' };
    }

    const { genres, label } = mapWeatherToGenres(weatherCode);
    document.querySelector('.weather-slider-title').innerHTML =
      `<i class="fas fa-cloud-sun"></i> Рекомендации по погоде (${label})`;

    // 4. Запрос фильмов у TMDB (сортируем по рейтингу, случайная страница для разнообразия)
    const page = Math.floor(Math.random() * 3) + 1;
    const tmdbRes = await fetch(
      `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&language=ru&with_genres=${genres}&sort_by=vote_average.desc&vote_count.gte=100&page=${page}`
    );
    if (!tmdbRes.ok) {
      slider.innerHTML = '<div class="empty-state">Не удалось загрузить фильмы</div>';
      return;
    }
    const data = await tmdbRes.json();
    let movies = data.results;

    // Добираем, если меньше 15
    if (movies.length < 15) {
      const extraRes = await fetch(
        `${TMDB_BASE}/discover/movie?api_key=${TMDB_KEY}&language=ru&with_genres=${genres.split(',')[0]}&sort_by=popularity.desc&page=1`
      );
      if (extraRes.ok) {
        const extraData = await extraRes.json();
        const extraMovies = extraData.results.slice(0, 20 - movies.length);
        const existingIds = new Set(movies.map(m => m.id));
        movies = movies.concat(extraMovies.filter(m => !existingIds.has(m.id)));
      }
    }

    movies = movies.slice(0, 20); // максимум 20 карточек

    // 5. Рендерим слайдер
    if (movies.length > 0) {
      slider.innerHTML = '';
      movies.forEach(movie => slider.appendChild(createMovieCard(movie, true)));
    } else {
      slider.innerHTML = '<div class="empty-state">Нет фильмов, подходящих погоде</div>';
    }
  }

  // ---------- ИЗБРАННОЕ (сервер) ----------
  async function loadFavorites() {
    const grid = document.getElementById('favMoviesGrid');
    const loader = document.getElementById('favLoading');
    loader.style.display = 'block';
    grid.innerHTML = '';
    try {
      const idsRes = await fetch(`${API_BASE}/favorites`, {
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (!idsRes.ok) throw new Error('Failed to load favorites');
      const ids = await idsRes.json();
      if (!ids.length) {
        grid.innerHTML = '<div class="empty-state">Избранное пусто</div>';
        return;
      }
      const movies = [];
      for (const id of ids) {
        const movieRes = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${TMDB_KEY}&language=ru`);
        if (movieRes.ok) {
          const data = await movieRes.json();
          if (data) movies.push(data);
        }
        await new Promise(r => setTimeout(r, 200));
      }
      if (movies.length) {
        grid.innerHTML = '';
        movies.forEach(movie => grid.appendChild(createMovieCard(movie)));
      } else {
        grid.innerHTML = '<div class="empty-state">Не удалось загрузить избранное</div>';
      }
    } catch (err) {
      showError(grid, 'Ошибка сети');
    } finally {
      loader.style.display = 'none';
    }
  }

  // ---------- КАРТОЧКА ФИЛЬМА ----------
  function createMovieCard(movie, isSlider = false) {
    const card = document.createElement('div');
    card.className = 'movie-card' + (isSlider ? ' slider-card' : '');
    card.dataset.id = movie.id;
    const poster = movie.poster_path ? IMG_BASE + movie.poster_path : 'https://via.placeholder.com/300x450/1e293b/94a3b8?text=Нет+постера';
    const year = movie.release_date ? movie.release_date.slice(0,4) : '—';
    const favClass = isFavorite(movie.id) ? 'active' : '';
    card.innerHTML = `
      <img class="movie-poster" src="${poster}" alt="${movie.title}" loading="lazy">
      <button class="fav-icon ${favClass}" data-movieid="${movie.id}"><i class="fas fa-heart"></i></button>
      <div class="movie-info">
        <div class="movie-title">${movie.title}</div>
        <div class="movie-year">${year}</div>
      </div>`;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.fav-icon')) return;
      openMovieDetails(movie.id);
    });
    card.querySelector('.fav-icon').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(movie.id);
    });
    return card;
  }

  function renderMoviesToGrid(movies, grid) {
    grid.innerHTML = '';
    if (!movies.length) {
      grid.innerHTML = '<div class="empty-state">Фильмы не найдены</div>';
      return;
    }
    movies.forEach(movie => grid.appendChild(createMovieCard(movie)));
  }

  function isFavorite(movieId) { return favorites.includes(movieId); }

  async function toggleFavorite(movieId) {
    if (!currentUser) { alert('Войдите, чтобы добавлять в избранное'); return; }
    const isFav = isFavorite(movieId);
    try {
      if (isFav) {
        await fetch(`${API_BASE}/favorites/${movieId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${currentUser.token}` }
        });
        favorites = favorites.filter(id => id !== movieId);
      } else {
        await fetch(`${API_BASE}/favorites`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentUser.token}`
          },
          body: JSON.stringify({ movieId })
        });
        favorites.push(movieId);
      }
      updateAllFavoriteIcons();
    } catch (err) {
      alert('Ошибка при обновлении избранного');
    }
  }

  function updateAllFavoriteIcons() {
    document.querySelectorAll('.fav-icon').forEach(btn => {
      const movieId = parseInt(btn.dataset.movieid);
      btn.classList.toggle('active', isFavorite(movieId));
    });
  }

  // ---------- ДЕТАЛИ ФИЛЬМА (прямой запрос к TMDB) ----------
  async function openMovieDetails(movieId) {
    const modal = document.getElementById('movieModal');
    const title = document.getElementById('movieTitle');
    const details = document.getElementById('movieDetails');
    modal.classList.add('active');
    title.textContent = 'Загрузка...';
    details.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
    try {
      const [movieRes, videosRes] = await Promise.all([
        fetch(`${TMDB_BASE}/movie/${movieId}?api_key=${TMDB_KEY}&language=ru`),
        fetch(`${TMDB_BASE}/movie/${movieId}/videos?api_key=${TMDB_KEY}`)
      ]);
      const movie = await movieRes.json();
      const videos = await videosRes.json();
      const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
      const trailerEmbed = trailer
        ? `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${trailer.key}" frameborder="0" allowfullscreen style="border-radius:16px; margin-top:15px;"></iframe>`
        : '<p>Трейлер не найден</p>';
      title.textContent = movie.title;
      details.innerHTML = `
        <div style="display:flex; gap:20px; flex-wrap:wrap;">
          <img src="${movie.poster_path ? IMG_BASE + movie.poster_path : 'https://via.placeholder.com/300x450'}" style="width:200px; border-radius:16px;">
          <div style="flex:1;">
            <p><strong>Год:</strong> ${movie.release_date?.slice(0,4) || '—'}</p>
            <p><strong>Рейтинг:</strong> ⭐ ${movie.vote_average?.toFixed(1) || '—'}</p>
            <p><strong>Жанры:</strong> ${movie.genres?.map(g => g.name).join(', ') || '—'}</p>
            <p>${movie.overview || 'Описание отсутствует'}</p>
          </div>
        </div>
        ${trailerEmbed}`;
    } catch (err) {
      details.innerHTML = '<p>Ошибка загрузки</p>';
    }
  }

  function closeMovieModal() {
    document.getElementById('movieModal').classList.remove('active');
    document.getElementById('movieDetails').innerHTML = '';
    document.getElementById('movieTitle').textContent = '';
  }

  // ---------- НАВИГАЦИЯ ----------
  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    if (viewId === 'viewHome') loadHomeCategory(state.homeCategory, currentPage.home);
    else if (viewId === 'viewMood') loadMoodMovies(state.mood, currentPage.mood);
    else if (viewId === 'viewFavorites') loadFavorites();
  }

  // ---------- АВТОРИЗАЦИЯ (сервер) ----------
  function openAuthModal(mode) {
    document.getElementById('authModalTitle').textContent = mode === 'login' ? 'Вход' : 'Регистрация';
    document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
    document.getElementById('switchAuthModeBtn').textContent = mode === 'login' ? 'Регистрация' : 'Вход';
    document.getElementById('authForm').dataset.mode = mode;
    document.getElementById('authError').style.display = 'none';
    document.getElementById('authModal').classList.add('active');
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const mode = document.getElementById('authForm').dataset.mode;
    const errorEl = document.getElementById('authError');
    if (!username || !password) {
      errorEl.textContent = 'Заполните все поля';
      errorEl.style.display = 'block';
      return;
    }
    try {
      const endpoint = mode === 'register' ? 'register' : 'login';
      const res = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка авторизации');
      currentUser = { username: data.username, token: data.token };
      localStorage.setItem('moodmovie_user', JSON.stringify(currentUser));
      await onUserChanged();
      updateAuthUI();
      closeModal(document.getElementById('authModal'));
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  }

  function logout() {
    localStorage.removeItem('moodmovie_user');
    currentUser = null;
    onUserChanged();
    updateAuthUI();
    showView('viewHome');
  }

  function closeModal(modal) {
    modal.classList.remove('active');
    if (modal === document.getElementById('authModal')) document.getElementById('authForm').reset();
  }

  // ---------- ИНИЦИАЛИЗАЦИЯ ----------
  async function init() {
    updateAuthUI();
    if (currentUser) await onUserChanged();
    else await loadFavoritesFromServer();
    loadWeatherSlider();
    loadHomeCategory('popular');
    setupEventListeners();
  }

  function setupEventListeners() {
    document.getElementById('logoLink').addEventListener('click', (e) => {
      e.preventDefault();
      showView('viewHome');
    });
    // Категории home
    document.querySelector('[data-cat="popular"]').addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-cat="popular"]').classList.add('active');
      loadHomeCategory('popular');
    });
    document.querySelector('[data-cat="now_playing"]').addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-cat="now_playing"]').classList.add('active');
      loadHomeCategory('now_playing');
    });
    document.getElementById('goMoodBtn').addEventListener('click', () => showView('viewMood'));
    document.getElementById('backFromMood').addEventListener('click', () => showView('viewHome'));
    document.getElementById('backFromFav').addEventListener('click', () => showView('viewHome'));
    // Настроения
    document.querySelectorAll('#moodButtons .mood-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#moodButtons .mood-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadMoodMovies(btn.dataset.mood);
      });
    });
    // Поиск
    document.getElementById('searchBtn').addEventListener('click', () => {
      const q = document.getElementById('searchInput').value.trim();
      if (q) searchMovies(q);
    });
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const q = document.getElementById('searchInput').value.trim();
        if (q) searchMovies(q);
      }
    });
    // Модальные окна
    document.getElementById('closeMovieModal').addEventListener('click', closeMovieModal);
    document.getElementById('closeAuthModal').addEventListener('click', () => closeModal(document.getElementById('authModal')));
    document.getElementById('switchAuthModeBtn').addEventListener('click', () => {
      const mode = document.getElementById('authForm').dataset.mode === 'login' ? 'register' : 'login';
      openAuthModal(mode);
    });
    document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
    window.addEventListener('click', (e) => {
      if (e.target === document.getElementById('movieModal')) closeMovieModal();
      if (e.target === document.getElementById('authModal')) closeModal(document.getElementById('authModal'));
    });
  }

  init();
})();