import axios from 'axios';
import FormData from 'form-data';
import { env } from './env.js';

const IMGBB_API_URL = 'https://api.imgbb.com/1/upload';

export async function uploadToImgbb(buffer, options = {}) {
  const { name = 'pixel.png', expiration = 0 } = options;

  const form = new FormData();
  form.append('image', buffer.toString('base64'));
  form.append('key', env.IMGBB_API_KEY);
  if (name) form.append('name', name);
  if (expiration) form.append('expiration', expiration);

  try {
    const response = await axios.post(IMGBB_API_URL, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000,
    });

    if (response.data.success) {
      return {
        url: response.data.data.url,
        deleteUrl: response.data.data.delete_url,
        id: response.data.data.id,
        size: response.data.data.size,
        width: response.data.data.width,
        height: response.data.data.height,
      };
    }

    throw new Error(`ImgBB upload failed: ${response.data.error?.message || 'Unknown error'}`);
  } catch (error) {
    if (error.response) {
      throw new Error(`ImgBB API error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`);
    }
    throw new Error(`ImgBB upload error: ${error.message}`);
  }
}

export async function deleteFromImgbb(deleteUrl) {
  try {
    await axios.get(deleteUrl, { timeout: 10000 });
    return true;
  } catch (error) {
    console.warn('Failed to delete from ImgBB:', error.message);
    return false;
  }
}

export default { uploadToImgbb, deleteFromImgbb };