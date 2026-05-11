# WooDreads - Dreadlocks Artist Website

## Project Overview
- **Project name:** WooDreads
- **Type:** Single-page business website with animations
- **Core functionality:** Portfolio, booking form, and info for a dreadlock artist in Rome
- **Target users:** People seeking dreadlock services in Rome, Italy

## File Structure
```
/mnt/c/Users/WooDreads/Documents/sito/
├── index.html          # Main website (1117 lines)
├── CLAUDE.md           # This file
├── Sito html .txt      # Source code copy
├── admin.pdf           # Admin panel design (unused)
└── [old artifacts]     # Expired Claude exports (not used)
```

## CSS Variables (Design Tokens)
```
--green:#8CFF00      --purple:#B58CFF     --lime:#E6FF4D
--dark:#0D0D0F       --dark2:#111116      --mid:#1E1E24
--cream:#F7F4EE      --warm:#EDE8DA
--leaf1:#2D5A27      --leaf2:#4A8C3F      --leaf3:#7BC67A
--fd:'Orbitron'      --fb:'Exo 2'
```

## Website Features

### Sections
1. **Header** - Fixed nav with logo, menu links, CTA button
2. **Hero** - Animated title, description, buttons, floating plants
3. **Ticker** - Scrolling marquee with keywords
4. **Servizi** - 4 service cards (Naturali, Cyberdreads, Restauro, Estensioni)
5. **Stats** - Social media stats (Instagram, TikTok, YouTube)
6. **Quiz** - Interactive "Che dread sei?" quiz
7. **Chi Siamo** - About section with animated logo ring
8. **Gallery** - 5 placeholder image slots
9. **Prenota** - Booking form with steps
10. **Social** - Links to Instagram, Facebook, TikTok, YouTube, WhatsApp
11. **Footer** - Logo, location, copyright

### Design
- Dark theme (#0D0D0F) with neon green (#8CFF00), purple (#B58CFF), lime (#E6FF4D)
- Fonts: Orbitron (headings), Exo 2 (body)

### Animations & Effects
- **Custom cursor** - Dual cursor with inertia (green trail that turns purple on hover)
- **Floating particles** - Animated dots in dark sections
- **Blob backgrounds** - Morphing color blobs in hero
- **Scroll reveal** - Elements fade in on scroll
- **Animated tickers** - Scrolling marquee text (4 different colors/speeds)
- **Wave text** - Letters wave animation in "Chi siamo" title
- **Shimmer text** - Rainbow gradient shimmer effect
- **Back to top** - Button with particle emission
- **Logo ring** - Rotating conic gradient ring in about section
- **Counter animation** - Numbers count up when visible

## Customization

### To Update
1. **WhatsApp link** - Change `https://wa.me/TUONUMERO` in lines 828, 887
2. **Instagram handle** - Update `@woodreads` in stats section (line 622)
3. **Instagram stats** - Update follower/post numbers (lines 625-627)
4. **Gallery images** - Replace `.gi-inner` divs with actual images
5. **Social links** - Update URLs in social section (lines 884-888)
6. **Phone number** - Add your actual number
7. **Location** - Update "Roma & Provincia" in footer (line 899)

### Add Images
Replace gallery placeholders:

### Add Images
Replace gallery placeholders:
```html
<div class="gi-inner">
  <img src="your-image.jpg" alt="Dreadlock work" style="width:100%;height:100%;object-fit:cover;">
</div>
```

## Deployment
- `TUONUMERO` - Replace with actual WhatsApp number
- Gallery images are placeholder colored gradients
- TikTok/YouTube stats show "–" (need API or manual update)

## Tech Stack (Detailed)
- Plain HTML5 + CSS3
- Google Fonts (Orbitron, Exo 2)
- Vanilla JavaScript (animations, quiz, form)
- Single file, no build required
- SVG graphics inline
- CSS custom properties for theming
- Intersection Observer for scroll animations
- Netlify functions ready for backend integration

## Deployment
Open `index.html` in a browser, or host on any static hosting (Netlify, Vercel, GitHub Pages, etc.)