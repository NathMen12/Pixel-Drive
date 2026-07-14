import Jimp from 'jimp';

/**
 * Convert an encrypted buffer to a PNG image using steganography
 * 3 bytes = 1 pixel (RGB)
 * 
 * @param {Buffer} buffer - Encrypted chunk buffer
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function pixelateBuffer(buffer) {
  // Calculate dimensions
  const bytesPerPixel = 3; // RGB
  const pixelsNeeded = Math.ceil(buffer.length / bytesPerPixel);
  const size = Math.ceil(Math.sqrt(pixelsNeeded));

  // Create black image
  const image = new Jimp({
    width: size,
    height: size,
    color: 0x000000FF, // Black opaque
  });

  // Write bytes to pixels
  for (let i = 0; i < buffer.length; i += bytesPerPixel) {
    const x = Math.floor(i / bytesPerPixel) % size;
    const y = Math.floor(i / bytesPerPixel / size);

    const r = buffer[i] || 0;
    const g = buffer[i + 1] || 0;
    const b = buffer[i + 2] || 0;

    // Jimp uses RGBA
    const color = Jimp.rgbaToInt(r, g, b, 255);
    image.setPixelColor(color, x, y);
  }

  // Return PNG buffer
  return image.getBufferAsync(Jimp.MIME_PNG);
}

/**
 * Reverse operation: extract buffer from PNG
 * Used for testing/debugging
 * 
 * @param {Buffer} pngBuffer - PNG buffer
 * @param {number} originalLength - Expected original buffer length
 * @returns {Promise<Buffer>} Extracted buffer
 */
export async function depixelateBuffer(pngBuffer, originalLength) {
  const image = await Jimp.read(pngBuffer);
  const size = image.getWidth();
  const bytesPerPixel = 3;
  const pixelsNeeded = Math.ceil(originalLength / bytesPerPixel);

  const buffer = Buffer.alloc(originalLength);

  for (let i = 0; i < pixelsNeeded; i++) {
    const x = i % size;
    const y = Math.floor(i / size);

    const color = image.getPixelColor(x, y);
    const { r, g, b } = Jimp.intToRGBA(color);

    const offset = i * bytesPerPixel;
    buffer[offset] = r;
    if (offset + 1 < originalLength) buffer[offset + 1] = g;
    if (offset + 2 < originalLength) buffer[offset + 2] = b;
  }

  return buffer;
}

export default {
  pixelateBuffer,
  depixelateBuffer,
};