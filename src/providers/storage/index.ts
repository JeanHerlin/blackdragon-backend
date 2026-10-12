import env from '../../config/env';
import LocalStorageProvider from './LocalStorageProvider';
import CloudinaryStorageProvider from './CloudinaryStorageProvider';

// Static 'uploads/' files are served from the API's own root, not under '/api' (see
// app.ts: express.static('/uploads', ...) is mounted before the '/api' router) — strip
// the '/api' suffix apiPublicUrl otherwise carries.
const apiRootUrl = env.apiPublicUrl.replace(/\/api\/?$/, '');

const storageProvider =
  env.storageProvider === 'cloudinary' ? new CloudinaryStorageProvider(env.cloudinary) : new LocalStorageProvider(apiRootUrl);

export default storageProvider;
