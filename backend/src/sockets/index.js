const db = require('../config/db');

function setupSocketIO(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Allow display clients to request a sync of current wishes
    socket.on('request_all_wishes', async (callback) => {
      try {
        const result = await db.query(
          'SELECT id, image_data, color, guest_name, created_at FROM wishes ORDER BY created_at ASC'
        );
        const formatted = result.rows.map((row) => ({
          id: row.id,
          imageData: row.image_data,
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
          RETURNING id, image_data, color, guest_name, created_at;
        `;
        const result = await db.query(insertQuery, [imageData, color, guestName]);
        const wish = result.rows[0];

        const formatted = {
          id: wish.id,
          imageData: wish.image_data,
          color: wish.color,
          guestName: wish.guest_name,
          createdAt: wish.created_at,
        };

        // Broadcast to everyone (including sender or display pages)
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
