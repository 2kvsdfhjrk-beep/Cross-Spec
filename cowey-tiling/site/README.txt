Cowey Tiling website, production files

What is here
  index.html   The whole page. Styles and the scroll script are inline, so there is nothing else to load.
  img/         The opening frame and the service photos in AVIF (modern browsers) with a JPEG fallback.
  f/           The drone flight, one image per frame. L is the landscape cut, P the portrait cut for phones.
               Each frame is AVIF with a WebP copy for older browsers. They load after the page has appeared.
  robots.txt   Lets search engines crawl the site.
  _headers     Cache rules for Netlify or Cloudflare Pages. Images and frames are cached for a year, the page is always checked for updates.

To put it live
  1. Upload this folder as it is to any static host (Netlify, Cloudflare Pages, Vercel, or your current web host).
  2. Point your domain at it.
  3. Once you know the final address, add these two lines inside <head> in index.html, using your real domain:
       <link rel="canonical" href="https://www.your-domain.co.uk/">
       <meta property="og:url" content="https://www.your-domain.co.uk/">
     and change the og:image and the JSON-LD "image" to the full address of img/garden-1440.jpg.
  4. Make sure the host serves HTML and text with gzip or brotli compression (all of the hosts above do this by default).

Still to add before launch
  - Phone number, email and the towns you cover. Put the towns in the services text and in the JSON-LD as "areaServed".
    Local wording like this is the biggest single help for showing up in local searches.
  - Connect the quote form to an inbox (Netlify Forms, Formspree or your host's form handler).
  - The flight and the photos are computer renders made for this site. Photos of your own finished jobs can replace the
    service photos at any time (same file names in img/).
  - Set up a Google Business Profile with the same name, phone number and address details as the site.
