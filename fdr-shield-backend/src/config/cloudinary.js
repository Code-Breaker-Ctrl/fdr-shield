const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a file buffer or local file path to Cloudinary
 * @param {Buffer|string} fileInput - Multer buffer or file path
 * @param {string} folder - Subfolder inside Cloudinary (default: 'fdr_shield_documents')
 */
const uploadToCloudinary = (fileInput, folder = 'fdr_shield_documents') => {
  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(fileInput)) {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          format: 'pdf', // Preserves PDF/image inspectability
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(fileInput);
    } else {
      cloudinary.uploader
        .upload(fileInput, {
          folder,
          resource_type: 'auto',
        })
        .then(resolve)
        .catch(reject);
    }
  });
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
};