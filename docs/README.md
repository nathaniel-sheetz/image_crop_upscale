# Frame TV Image Processor - Browser Mode

**Zero installation required!** This standalone version runs entirely in your browser.

## Features

- ✅ **No installation** - Just open `index.html` in a browser
- ✅ **Complete privacy** - Images never leave your device
- ✅ **Works offline** - After first load, works without internet
- ✅ **High quality** - Canvas API with high-quality image smoothing
- ✅ **Free hosting** - Deploy to GitHub Pages, Netlify, Vercel, etc.

## Quick Start

### Local Use

**Option 1: Double-click**
- Simply double-click `index.html`
- Opens in your default browser
- Start processing immediately!

**Option 2: Command line**
```bash
# Windows
start index.html

# Mac
open index.html

# Linux
xdg-open index.html
```

### Deploy Online

Deploy this folder to any static hosting:

**GitHub Pages:**
```bash
# Push this folder to a repository
# Enable Pages in repo settings
```

**Netlify:**
```bash
# Drag and drop this folder to netlify.com
```

See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed hosting guides.

## How It Works

All processing happens in your browser using modern Web APIs:

1. **FileReader API** - Loads your image locally
2. **Cropper.js** - Interactive crop tool with aspect ratio locking
3. **Canvas API** - Crops and upscales with high-quality smoothing
4. **Blob API** - Creates downloadable file

**No data is ever uploaded** to any server. Your images stay on your device.

## Technical Details

### Image Processing

Uses Canvas 2D context with these quality settings:
```javascript
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
```

This provides excellent upscaling quality, very close to Lanczos resampling (the "gold standard" for image resizing).

### Quality Comparison

- **Server Mode** (Lanczos): ⭐⭐⭐⭐⭐ Excellent
- **Browser Mode** (Canvas): ⭐⭐⭐⭐ Very Good

The difference is minimal for Frame TV display purposes. Both produce crisp, professional results.

### Browser Requirements

**Modern browsers required:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Not supported:**
- Internet Explorer (use Server Mode instead)

### File Size Limits

Limited only by your browser's memory:
- **Typical limit**: 100-500MB
- **Recommended**: Images under 50MB for best performance
- **For huge files**: Use Server Mode instead

## Customization

### Add New Presets

Edit `js/app-client.js`, update the PRESETS object:

```javascript
const PRESETS = {
    '4k': { width: 3840, height: 2160, name: '4K Ultra HD' },
    'fhd': { width: 1920, height: 1080, name: 'Full HD' },
    'custom': { width: 2560, height: 1440, name: 'QHD' }  // Add this
};
```

Then add a button in `index.html`:
```html
<button class="preset-btn" data-preset="custom" data-width="2560" data-height="1440">
    <span class="preset-name">QHD</span>
    <span class="preset-resolution">2560 × 1440</span>
</button>
```

### Change Output Quality

Edit `js/app-client.js`, line ~327:

```javascript
// Change from 0.95 to desired quality (0.0 to 1.0)
canvas.toBlob(function(blob) {
    // ...
}, 'image/jpeg', 0.95);  // ← Change this value
```

- `0.95` = High quality (recommended)
- `0.85` = Good quality, smaller file
- `1.0` = Maximum quality, larger file

## Advantages vs Server Mode

| Feature | Browser Mode | Server Mode |
|---------|--------------|-------------|
| Setup | None | Flask + Python |
| Privacy | Never leaves browser | Local server |
| Quality | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Speed | Fast | Fast |
| Offline | Yes | No |
| Hosting | Free static | Requires server |
| Sharing | Send URL | Share files |

## Sharing

Share this application by:

1. **Deploying to GitHub Pages** → Share URL
2. **Sending the folder** → Recipients double-click `index.html`
3. **Hosting on Netlify/Vercel** → Share custom domain

Anyone can use it immediately without installing anything!

## Troubleshooting

**Issue: Page loads but buttons don't work**
- Enable JavaScript in browser settings
- Check browser console (F12) for errors
- Try a different browser

**Issue: Image quality lower than expected**
- Increase JPEG quality in code (see Customization)
- Use Server Mode for maximum quality
- Ensure source image is high resolution

**Issue: Processing is slow**
- Expected for very large images (>20MB)
- Try resizing image before upload
- Close other browser tabs
- Use Server Mode for better performance

**Issue: Cropper not loading**
- Check internet connection (Cropper.js loads from CDN)
- For offline use, download Cropper.js locally
- Check browser console for CDN errors

## Performance Tips

1. **Resize large images** before upload if possible
2. **Close other browser tabs** to free memory
3. **Use Chrome or Edge** for best Canvas performance
4. **Process one image at a time**

## Privacy & Security

This application:
- ✅ Never uploads your images
- ✅ Never stores data
- ✅ Never tracks users
- ✅ Works completely offline
- ✅ No cookies, no analytics (unless you add them)

Perfect for sensitive images or when privacy matters!

## Updates

To update this version:
1. Download new `client-side/` folder from repository
2. Replace your existing files
3. Clear browser cache and reload

Or if deployed via Git:
```bash
git pull
# Automatically updates if using GitHub Pages/Netlify/Vercel
```

## Support

For issues:
- **Application bugs**: Open issue on GitHub
- **Hosting questions**: See [DEPLOYMENT.md](../DEPLOYMENT.md)
- **Browser compatibility**: Check requirements above

## License

Free to use and modify for personal projects.

---

**Enjoy processing your Frame TV images!** 🖼️
