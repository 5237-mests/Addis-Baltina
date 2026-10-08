# Cloudinary Image Storage Integration

Addis Baltina includes first-class Cloudinary integration for storing and serving optimized product photos and promotional banners across the web, Progressive Web App (PWA), and Telegram Mini App.

---

## 1. Environment Configuration

To enable Cloudinary CDN storage, configure either:

### Option A: Standard 3-Key Configuration
Add the following to your `.env` file (copied from `.env.example`):

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Option B: Cloudinary URL
Alternatively, use the single connection string provided in your Cloudinary Dashboard:

```bash
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
```

---

## 2. Automatic Fallback Mode

If the Cloudinary credentials are not set during local testing or early staging, the application will:
1. Log a clear notice on server startup.
2. Accept image uploads and store them in memory/data URI format.
3. Keep the catalog and admin dashboard functional.
4. Display a status indicator in the Admin Portal: `Cloudinary: Demo Mode` vs `Cloudinary: <cloud_name>`.

---

## 3. Server Endpoints

### Check Cloudinary Status
- **Route**: `GET /api/v1/upload/status`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "configured": true,
      "cloud_name": "addis-baltina",
      "folder": "addis_baltina/products"
    }
  }
  ```

### Upload Image
- **Route**: `POST /api/v1/upload`
- **Request Body**:
  ```json
  {
    "image": "data:image/jpeg;base64,...", // Base64 Data URI or remote image URL
    "folder": "addis_baltina/products",    // Optional destination folder
    "tags": ["addis_baltina", "spices"]    // Optional tags
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "url": "https://res.cloudinary.com/addis-baltina/image/upload/v12345/addis_baltina/products/berbere.jpg",
      "public_id": "addis_baltina/products/berbere",
      "format": "jpg",
      "width": 1200,
      "height": 900,
      "bytes": 248900,
      "provider": "cloudinary"
    }
  }
  ```

### Delete Image
- **Route**: `DELETE /api/v1/upload/:public_id`

---

## 4. Media Optimizations Applied

When images are uploaded to Cloudinary, the following automatic transformations are applied:
- `fetch_format: 'auto'` (`f_auto`): Automatically serves next-generation formats (AVIF, WebP) depending on the user's browser.
- `quality: 'auto:good'` (`q_auto:good`): Intelligent visual quality compression saving up to 70% bandwidth without perceptual loss.
- Secure HTTPS delivery on global CDN.
