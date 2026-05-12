const express = require('express');
const router = express.Router();
const { fetchFromTMDB } = require('../utils/tmdb');
const { authenticateOptional } = require('../middleware/auth');
const Favorite = require('../models/Favorite');

async function addFavoriteFlags(movies, userId) {
  if (!userId || !movies.length) return movies;
  try {
    const movieIds = movies.map(m => m.id);
    const favs = await Favorite.find({ userId, movieId: { $in: movieIds } });
    const favSet = new Set(favs.map(f => f.movieId));
    return movies.map(m => ({ ...m, isFavorite: favSet.has(m.id) }));
  } catch (e) {
    console.error('addFavoriteFlags error:', e);
    return movies; // не ломаем из-за избранного
  }
}

router.get('/popular', authenticateOptional, async (req, res, next) => {
  try {
    const data = await fetchFromTMDB('/movie/popular', { page: req.query.page || 1 });
    data.results = await addFavoriteFlags(data.results, req.userId);
    res.json(data);
  } catch (err) {
    next(err); // передаём в центральный обработчик
  }
});

router.get('/now_playing', authenticateOptional, async (req, res, next) => {
  try {
    const data = await fetchFromTMDB('/movie/now_playing', { page: req.query.page || 1 });
    data.results = await addFavoriteFlags(data.results, req.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/mood', authenticateOptional, async (req, res, next) => {
  const moodGenres = {
    comedy: '35', drama: '18', romance: '10749', mystery: '9648',
    action: '28', horror: '27', scifi: '878'
  };
  const genre = moodGenres[req.query.mood] || '35';
  try {
    const data = await fetchFromTMDB('/discover/movie', {
      with_genres: genre,
      sort_by: 'popularity.desc',
      page: req.query.page || 1
    });
    data.results = await addFavoriteFlags(data.results, req.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/search', authenticateOptional, async (req, res, next) => {
  try {
    const data = await fetchFromTMDB('/search/movie', {
      query: req.query.query,
      page: req.query.page || 1
    });
    data.results = await addFavoriteFlags(data.results, req.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const movie = await fetchFromTMDB(`/movie/${req.params.id}`);
    const videos = await fetchFromTMDB(`/movie/${req.params.id}/videos`);
    const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
    res.json({ movie, trailer });
  } catch (err) {
    next(err);
  }
});

module.exports = router;