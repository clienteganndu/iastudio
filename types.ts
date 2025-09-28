export type Mode = 'create' | 'edit' | 'mockup';

export type CreateFunction = 'free' | 'sticker' | 'text' | 'comic' | 'ultra';
export type EditFunction = 'add-remove' | 'retouch' | 'style' | 'compose' | 'combine' | 'variation' | 'mockup';

export interface ImageFile {
  base64: string;
  mimeType: string;
}
