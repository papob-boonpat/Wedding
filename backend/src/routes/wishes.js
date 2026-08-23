const express = require('express');
const router = express.Router();
const db = require('../config/db');

module.exports = function (io) {
  // Health check endpoint for k8s probes
  router.get('/health', async (req, res) => {
    try {
      await db.query('SELECT 1');
      return res.status(200).json({ status: 'ok', uptime: process.uptime() });
    } catch (err) {
      return res.status(500).json({ status: 'unhealthy', error: err.message });
    }
  });

  // Get all wishes (for display page initial load)
  router.get('/wishes', async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, image_data, color, guest_name, created_at FROM wishes ORDER BY created_at ASC'
      );
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
      console.error('[API] Error fetching wishes:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch wishes' });
    }
  });

  // Submit a new wish
  router.post('/wishes', async (req, res) => {
    try {
      const { imageData, color = '#f43f5e', guestName = 'Guest' } = req.body;

      if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or missing Base64 imageData',
        });
      }

      const insertQuery = `
        INSERT INTO wishes (image_data, color, guest_name)
        VALUES ($1, $2, $3)
        RETURNING id, image_data, color, guest_name, created_at;
      `;
      const values = [imageData, color, guestName];
      const result = await db.query(insertQuery, values);
      const newWish = result.rows[0];

      // Broadcast immediately via Socket.io to all connected display screens
      io.emit('new_wish', {
        id: newWish.id,
        imageData: newWish.image_data,
        color: newWish.color,
        guestName: newWish.guest_name,
        createdAt: newWish.created_at,
      });

      console.log(`[API] Saved & emitted new wish #${newWish.id}`);
      res.status(201).json({ success: true, data: newWish });
    } catch (err) {
      console.error('[API] Error saving wish:', err);
      res.status(500).json({ success: false, error: 'Failed to save wish' });
    }
  });

  return router;
};
