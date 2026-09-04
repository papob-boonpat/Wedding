const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { uploadWishImage, getWishImageStream } = require('../config/minio');

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

  // Get all wishes (optimized: metadata only, no image data to keep RAM minimal)
  router.get('/wishes', async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, color, guest_name, created_at FROM wishes ORDER BY created_at ASC'
      );
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
      console.error('[API] Error fetching wishes:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch wishes' });
    }
  });

  // Get wish image on-demand from MinIO or fallback legacy base64
  router.get('/wishes/:id/image', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await db.query('SELECT image_data FROM wishes WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Wish not found' });
      }

      const rawData = result.rows[0].image_data || '';

      // Check if legacy data URI string in DB (Base64 or UTF-8 SVG)
      if (rawData.startsWith('data:image/')) {
        if (rawData.includes(';base64,')) {
          const parts = rawData.split(';base64,');
          const contentType = parts[0].replace('data:', '');
          const buffer = Buffer.from(parts[1], 'base64');
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(buffer);
        } else if (rawData.startsWith('data:image/svg+xml')) {
          const svgPart = rawData.substring(rawData.indexOf(',') + 1);
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          return res.send(decodeURIComponent(svgPart));
        }
      }

      // Stored in MinIO
      let objectName = `wishes/${id}.webp`;
      if (rawData.startsWith('minio:')) {
        objectName = rawData.replace('minio:', '');
      }

      try {
        const stream = await getWishImageStream(objectName);
        const contentType = objectName.endsWith('.webp')
          ? 'image/webp'
          : objectName.endsWith('.svg')
          ? 'image/svg+xml'
          : 'image/png';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        stream.pipe(res);
      } catch (minioErr) {
        // Fallback attempt with .png if .webp not found
        if (objectName.endsWith('.webp')) {
          try {
            const fallbackStream = await getWishImageStream(`wishes/${id}.png`);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return fallbackStream.pipe(res);
          } catch (e) {}
        }
        console.error('[API] Error streaming from MinIO:', minioErr.message);
        return res.status(404).json({ success: false, error: 'Image not found in storage' });
      }
    } catch (err) {
      console.error('[API] Error retrieving wish image:', err);
      res.status(500).json({ success: false, error: 'Failed to retrieve image' });
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

      // Determine mime type and file extension
      const matches = imageData.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      let contentType = 'image/webp';
      let ext = 'webp';
      let base64String = '';

      if (matches && matches.length === 3) {
        contentType = matches[1];
        base64String = matches[2];
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
        else if (contentType.includes('webp')) ext = 'webp';
      } else {
        base64String = imageData.split(',')[1] || imageData;
      }

      const imageBuffer = Buffer.from(base64String, 'base64');

      // 1. Insert initial record to obtain serial ID
      const insertQuery = `
        INSERT INTO wishes (image_data, color, guest_name)
        VALUES ($1, $2, $3)
        RETURNING id, color, guest_name, created_at;
      `;
      const values = ['pending', color, guestName];
      const result = await db.query(insertQuery, values);
      const newWish = result.rows[0];

      // 2. Upload image to MinIO
      const objectName = `wishes/${newWish.id}.${ext}`;
      try {
        await uploadWishImage(objectName, imageBuffer, contentType);
        // Update database with MinIO reference
        await db.query('UPDATE wishes SET image_data = $1 WHERE id = $2', [
          `minio:${objectName}`,
          newWish.id,
        ]);
        console.log(`[MinIO] Uploaded wish #${newWish.id} image (${objectName}) successfully.`);
      } catch (uploadErr) {
        console.error(`[MinIO] Upload failed for wish #${newWish.id}:`, uploadErr.message);
        // Fallback: save base64 directly in database if MinIO fails
        await db.query('UPDATE wishes SET image_data = $1 WHERE id = $2', [imageData, newWish.id]);
      }

      // 3. Broadcast lightweight payload via Socket.io (no image data)
      io.emit('new_wish', {
        id: newWish.id,
        color: newWish.color,
        guestName: newWish.guest_name,
        createdAt: newWish.created_at,
      });

      console.log(`[API] Saved & emitted lightweight new wish #${newWish.id}`);
      res.status(201).json({ success: true, data: newWish });
    } catch (err) {
      console.error('[API] Error saving wish:', err);
      res.status(500).json({ success: false, error: 'Failed to save wish' });
    }
  });

  return router;
};
