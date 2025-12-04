# Deployment Guide - Browser Mode

This guide explains how to deploy the browser-only version of the Frame TV Image Processor to various free hosting platforms.

## Overview

The **Browser Mode** (`client-side/` directory) is a completely standalone application that can be hosted on any static file hosting service. No server, database, or backend required!

## What You'll Deploy

Only the `client-side/` directory contents:
- `index.html` - Main application page
- `css/style.css` - Styling
- `js/app-client.js` - Canvas-based image processing

Total size: ~20KB (excluding Cropper.js from CDN)

## Deployment Options

### Option 1: GitHub Pages (Recommended)

**Advantages:** Free, automatic SSL, custom domain support, git-based deployment

**Steps:**

1. **Create a GitHub repository** (if not already done):
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/frame-tv-processor.git
git push -u origin main
```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select branch: `main`
   - Select folder: `/client-side` or copy contents to root
   - Click **Save**

3. **Access your site**:
   - URL: `https://YOUR_USERNAME.github.io/frame-tv-processor/`
   - Updates automatically when you push to main branch

**Alternative: Deploy only client-side folder**
```bash
# Create a separate branch with only client-side contents
git checkout --orphan gh-pages
git rm -rf .
cp -r client-side/* .
git add .
git commit -m "Deploy browser mode"
git push origin gh-pages

# Set GitHub Pages to use gh-pages branch
```

### Option 2: Netlify

**Advantages:** Drag-and-drop deployment, instant previews, serverless functions available

**Steps:**

1. **Sign up** at [netlify.com](https://www.netlify.com)

2. **Deploy via drag-and-drop**:
   - Drag the `client-side/` folder to Netlify dashboard
   - Site deploys instantly
   - Get a URL like: `https://random-name.netlify.app`

3. **Deploy via Git** (continuous deployment):
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli

   # Login
   netlify login

   # Deploy
   cd client-side
   netlify deploy --prod
   ```

4. **Custom domain** (optional):
   - Go to Site Settings → Domain Management
   - Add your custom domain
   - Configure DNS

### Option 3: Vercel

**Advantages:** Fast global CDN, automatic HTTPS, git integration

**Steps:**

1. **Sign up** at [vercel.com](https://vercel.com)

2. **Deploy via CLI**:
   ```bash
   # Install Vercel CLI
   npm install -g vercel

   # Login
   vercel login

   # Deploy
   cd client-side
   vercel --prod
   ```

3. **Deploy via Git**:
   - Push to GitHub
   - Import project in Vercel dashboard
   - Set "Root Directory" to `client-side`
   - Deploy

### Option 4: Cloudflare Pages

**Advantages:** Unlimited bandwidth, fast worldwide, free SSL

**Steps:**

1. **Sign up** at [pages.cloudflare.com](https://pages.cloudflare.com)

2. **Connect repository**:
   - Connect your GitHub account
   - Select your repository
   - Build settings:
     - Build command: (leave empty)
     - Build output directory: `client-side`

3. **Deploy**: Automatic on every push

### Option 5: Local File (No Hosting)

**Advantages:** No internet required, completely private, instant access

**Steps:**

1. **Open directly in browser**:
   ```bash
   # Windows
   start client-side/index.html

   # Mac
   open client-side/index.html

   # Linux
   xdg-open client-side/index.html
   ```

2. **Bookmark the file location** for easy access

3. **Share the folder** via USB, email, or file sharing

## Configuration

### Custom Domain Setup

Most platforms support custom domains:

1. **Add domain in hosting platform**
2. **Update DNS records**:
   ```
   Type: CNAME
   Name: www (or subdomain)
   Value: [provided by hosting platform]
   ```
3. **Wait for DNS propagation** (up to 48 hours)

### Analytics (Optional)

Add Google Analytics or similar:

Edit `client-side/index.html`, add before `</head>`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR-ID');
</script>
```

## Performance Tips

1. **CDN Caching**: All platforms automatically cache static files
2. **Compression**: Gzip/Brotli enabled by default on all platforms
3. **Global Distribution**: Sites are served from nearest location to users

## Security

**No security concerns** for this application:
- No user data stored
- No server-side processing
- All processing happens locally in browser
- No authentication needed
- No sensitive information

## Monitoring

Most platforms provide:
- Visitor analytics
- Bandwidth usage
- Error logs
- Performance metrics

## Troubleshooting

### Images not loading
- Check browser console for errors
- Verify Cropper.js CDN is accessible
- Try hard refresh: `Ctrl+Shift+R`

### Cropper not working
- Ensure JavaScript is enabled
- Check browser compatibility (needs modern browser)
- Clear browser cache

### Slow processing
- Expected for very large images
- Browser memory limitations
- Consider using Server Mode for huge files

## Browser Compatibility

**Supported Browsers:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Required Features:**
- FileReader API
- Canvas API
- Blob API
- ES6 JavaScript

**Not Supported:**
- Internet Explorer (any version)
- Very old mobile browsers

## Cost Summary

| Platform | Cost | Bandwidth | Custom Domain |
|----------|------|-----------|---------------|
| GitHub Pages | Free | 100GB/month | Yes (free) |
| Netlify | Free | 100GB/month | Yes (free) |
| Vercel | Free | 100GB/month | Yes (free) |
| Cloudflare Pages | Free | Unlimited | Yes (free) |

## Updating Your Deployment

### GitHub Pages
```bash
git add .
git commit -m "Update application"
git push
# Automatically deploys
```

### Netlify/Vercel/Cloudflare
- Push to Git: Automatic deployment
- Manual: Re-upload folder or run CLI deploy command

## Example Deployments

Share your Frame TV Processor publicly:

```
# Public URL examples
https://yourusername.github.io/frame-tv/
https://frame-tv-processor.netlify.app
https://frame-tv.vercel.app
https://frame-tv.pages.dev
```

Users can process images immediately with zero setup!

## Support

For issues with:
- **GitHub Pages**: [GitHub Pages docs](https://docs.github.com/pages)
- **Netlify**: [Netlify docs](https://docs.netlify.com)
- **Vercel**: [Vercel docs](https://vercel.com/docs)
- **Cloudflare Pages**: [Cloudflare docs](https://developers.cloudflare.com/pages)

## Next Steps

1. Choose a hosting platform
2. Deploy following the steps above
3. Share your URL
4. Users can process images instantly!

Remember: The browser version works completely offline after the first load, making it perfect for personal use or sharing!
