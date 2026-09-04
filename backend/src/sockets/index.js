const db = require('../config/db');
const { uploadWishImage } = require('../config/minio');

function setupSocketIO(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Allow display clients to request a sync of current wishes (lightweight metadata only)
    socket.on('request_all_wishes', async (callback) => {
      try {
        const result = await db.query(
          'SELECT id, color, guest_name, created_at FROM wishes ORDER BY created_at ASC'
        );
        const formatted = result.rows.map((row) => ({
          id: row.id,
          color: row.color,
          guestName: row.guest_name,
          createdAt: row.created_at,
        }));
        if (typeof callback === 'function') {
          callback({ success: true, wishes: formatted });
        }
      } catch (err) {
        console.error('[Socket] Error fetching wishes for sync:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    // Optional direct socket submission
    socket.on('submit_wish', async (payload, callback) => {
      try {
        const { imageData, color = '#f43f5e', guestName = 'Guest' } = payload;
        if (!imageData || !imageData.startsWith('data:image')) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Invalid Base64 imageData' });
          }
          return;
        }

        const insertQuery = `
          INSERT INTO wishes (image_data, color, guest_name)
          VALUES ($1, $2, $3)
          RETURNING id, color, guest_name, created_at;
        `;
        const result = await db.query(insertQuery, ['pending', color, guestName]);
        const wish = result.rows[0];

        // Process image buffer and upload to MinIO
        try {
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
          const objectName = `wishes/${wish.id}.${ext}`;
          await uploadWishImage(objectName, imageBuffer, contentType);
          await db.query('UPDATE wishes SET image_data = $1 WHERE id = $2', [
            `minio:${objectName}`,
            wish.id,
          ]);
        } catch (uploadErr) {
          console.error('[MinIO] Socket upload error:', uploadErr.message);
          await db.query('UPDATE wishes SET image_data = $1 WHERE id = $2', [imageData, wish.id]);
        }

        const formatted = {
          id: wish.id,
          color: wish.color,
          guestName: wish.guest_name,
          createdAt: wish.created_at,
        };

        // Broadcast lightweight wish to everyone
        io.emit('new_wish', formatted);

        if (typeof callback === 'function') {
          callback({ success: true, wish: formatted });
        }
      } catch (err) {
        console.error('[Socket] Error handling submit_wish:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message });
        }
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected (${socket.id}): ${reason}`);
    });
  });
}

module.exports = setupSocketIO;
