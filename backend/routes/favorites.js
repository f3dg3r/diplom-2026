const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Favorite = require('../models/Favorite');
const { fetchFromTMDB } = require('../utils/tmdb');

// Получить список ID избранного
router.get('/', auth, async (req, res) => {
  const favs = await Favorite.find({ userId: req.userId });
  res.json(favs.map(f => f.movieId));
});

// Добавить
router.post('/', auth, async (req, res) => {
  try {
    const { movieId } = req.body;
    if (!movieId) return res.status(400).json({ error: 'movieId required' });
    await Favorite.create({ userId: req.userId, movieId });
    res.status(201).json({ message: 'Added to favorites' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Already in favorites' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Удалить
router.delete('/:movieId', auth, async (req, res) => {
  await Favorite.deleteOne({ userId: req.userId, movieId: req.params.movieId });
  res.json({ message: 'Removed from favorites' });
});

module.exports = router;