import { PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';

export const MAX_COVER_SIZE = 5 * 1024 * 1024;

export function detectCoverType(buffer: Buffer): string {
  if (buffer.length > MAX_COVER_SIZE) {
    throw new PayloadTooLargeException('A capa deve ter até 5 MB.');
  }
  if (buffer.length >= 4 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return 'image/jpeg';
  }
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'image/png';
  }
  if (buffer.length >= 20 && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16))) {
    return 'image/webp';
  }
  throw new UnsupportedMediaTypeException('A capa deve estar em formato JPG, PNG ou WebP.');
}
