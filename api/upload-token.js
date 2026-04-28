import { handleUpload } from '@vercel/blob/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const ext = '.' + (pathname.split('.').pop() || '').toLowerCase();
        const allowedExts = ['.png', '.jpg', '.jpeg', '.svg', '.pdf', '.zip'];
        if (!allowedExts.includes(ext)) {
          throw new Error('File type not allowed: ' + ext);
        }
        return {
          allowedContentTypes: [
            'image/png',
            'image/jpeg',
            'image/svg+xml',
            'application/pdf',
            'application/zip',
            'application/x-zip-compressed',
            'application/octet-stream',
          ],
          maximumSizeInBytes: 50 * 1024 * 1024,
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('Blob uploaded:', blob.url);
      },
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('upload-token error:', error);
    return res.status(400).json({ error: error?.message || 'Upload error' });
  }
}
