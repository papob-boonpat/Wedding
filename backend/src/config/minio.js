const Minio = require('minio');

const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
const minioPort = parseInt(process.env.MINIO_PORT || '9000', 10);
const minioUseSSL = process.env.MINIO_USE_SSL === 'true';
const minioAccessKey = process.env.MINIO_ACCESS_KEY || 'wedding_minio_admin';
const minioSecretKey = process.env.MINIO_SECRET_KEY || 'wedding_minio_password_123';
const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'wedding-wishes';

const minioClient = new Minio.Client({
  endPoint: minioEndpoint,
  port: minioPort,
  useSSL: minioUseSSL,
  accessKey: minioAccessKey,
  secretKey: minioSecretKey,
});

async function initMinio(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[MinIO] Checking MinIO connection to ${minioEndpoint}:${minioPort} (Attempt ${i + 1}/${retries})...`);
      const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
      if (!bucketExists) {
        console.log(`[MinIO] Bucket "${BUCKET_NAME}" does not exist. Creating...`);
        await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
        console.log(`[MinIO] Bucket "${BUCKET_NAME}" created successfully.`);
      } else {
        console.log(`[MinIO] Bucket "${BUCKET_NAME}" verified.`);
      }
      return;
    } catch (err) {
      console.error(`[MinIO] Connection attempt ${i + 1} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
      if (i < retries - 1) {
        await new Promise((res) => setTimeout(res, delay));
      } else {
        console.error('[MinIO] Warning: Exhausted all MinIO connection retries. Continuing without fatal exit...');
      }
    }
  }
}

async function uploadWishImage(objectName, buffer, contentType = 'image/png') {
  return new Promise((resolve, reject) => {
    minioClient.putObject(
      BUCKET_NAME,
      objectName,
      buffer,
      buffer.length,
      { 'Content-Type': contentType },
      (err, etag) => {
        if (err) return reject(err);
        resolve(etag);
      }
    );
  });
}

async function getWishImageStream(objectName) {
  return await minioClient.getObject(BUCKET_NAME, objectName);
}

module.exports = {
  minioClient,
  BUCKET_NAME,
  initMinio,
  uploadWishImage,
  getWishImageStream,
};
