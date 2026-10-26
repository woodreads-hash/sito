(function(){
  const ALLOWED = new Set(['p','br','h1','h2','h3','h4','strong','b','em','i','u','s','strike','ul','ol','li','blockquote','a','img','video','source','iframe','figure','figcaption','hr','pre','code','span','div','mark','small','sub','sup']);
  const DROP = new Set(['script','style','object','embed','form','input','button','textarea','select','option','meta','link','base','title','svg','math','canvas','audio','template','noscript']);
  const GLOBAL_ATTRS = new Set(['style']);
  const TAG_ATTRS = {
    a: ['href','title','target','rel'],
    img: ['src','alt','title','width','height','loading'],
    iframe: ['src','title','width','height','allow','allowfullscreen','frameborder','loading'],
    video: ['src','controls','autoplay','loop','muted','playsinline','poster','width','height','preload'],
    source: ['src','type','media']
  };
  const STYLE_PROPS = new Set(['text-align','font-weight','font-style','text-decoration','color','background-color','margin','margin-top','margin-right','margin-bottom','margin-left','padding','padding-top','padding-right','padding-bottom','padding-left','border-radius','max-width','width','height','display','float','object-fit','aspect-ratio']);

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function cleanUrl(value, kind){
    const url = String(value || '').trim();
    if (!url) return '';
    if (/^(https?:\/\/|\/(?!\/)|\.\/|\.\.\/|#)/i.test(url)) return url;
    if (kind === 'link' && /^(mailto:|tel:)/i.test(url)) return url;
    return '';
  }

  function cleanStyle(value){
    const input = String(value || '');
    if (!input || /(expression|javascript:|@import|behavior|url\s*\()/i.test(input)) return '';
    const out = [];
    input.split(';').forEach(function(part){
      const idx = part.indexOf(':');
      if (idx < 1) return;
      const prop = part.slice(0, idx).trim().toLowerCase();
      let val = part.slice(idx + 1).trim();
      if (!STYLE_PROPS.has(prop) || !val) return;
      if (prop === 'display' && !/^(block|inline|inline-block|none)$/i.test(val)) return;
      if (prop === 'float' && !/^(left|right|none)$/i.test(val)) return;
      if (/^(width|max-width|height)$/.test(prop) && !/^(auto|\d+(\.\d+)?(px|%|rem|em|vh|vw))$/i.test(val)) return;
      if (/^(margin|padding)(-|$)/.test(prop) && !/^[-0-9a-z.%\s]+$/i.test(val)) return;
      if (/^(color|background-color)$/.test(prop) && !/^[#a-z0-9(),.%\s-]+$/i.test(val)) return;
      out.push(prop + ':' + val);
    });
    return out.join(';');
  }

  function validIframe(url){
    try {
      const parsed = new URL(url, location.href);
      const host = parsed.hostname.replace(/^www\./,'');
      if (!/^https?:$/.test(parsed.protocol)) return false;
      return host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'player.vimeo.com' || host === 'vimeo.com';
    } catch (e) { return false; }
  }

  function cleanNode(node, target){
    if (node.nodeType === 3){
      target.appendChild(document.createTextNode(node.nodeValue));
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (DROP.has(tag)) return;
    if (!ALLOWED.has(tag)){
      Array.prototype.forEach.call(node.childNodes, function(child){ cleanNode(child, target); });
      return;
    }
    if (tag === 'iframe' && !validIframe(node.getAttribute('src') || '')) return;
    if (tag === 'img' && !cleanUrl(node.getAttribute('src'), 'media')) return;
    if (tag === 'video' && node.getAttribute('src') && !cleanUrl(node.getAttribute('src'), 'media')) return;
    if (tag === 'source' && !cleanUrl(node.getAttribute('src'), 'media')) return;

    let outTag = tag;
    let href = '';
    if (tag === 'a'){
      href = cleanUrl(node.getAttribute('href'), 'link');
      if (!href) outTag = 'span';
    }
    const el = document.createElement(outTag);
    const allowedAttrs = (TAG_ATTRS[tag] || []).concat(Array.from(GLOBAL_ATTRS));
    allowedAttrs.forEach(function(name){
      if (!node.hasAttribute(name)) return;
      const value = node.getAttribute(name);
      if (name === 'style'){
        const style = cleanStyle(value);
        if (style) el.setAttribute('style', style);
        return;
      }
      if (name === 'href'){
        if (href) el.setAttribute('href', href);
        return;
      }
      if (name === 'src' || name === 'poster'){
        const media = cleanUrl(value, 'media');
        if (media) el.setAttribute(name, media);
        return;
      }
      if (name === 'target'){
        if (value === '_blank') el.setAttribute('target', '_blank');
        return;
      }
      if (name === 'rel'){
        el.setAttribute('rel', 'noopener noreferrer');
        return;
      }
      if (name === 'width' || name === 'height'){
        if (/^\d+$/.test(value)) el.setAttribute(name, value);
        return;
      }
      if (name === 'loading'){
        if (/^(lazy|eager)$/i.test(value)) el.setAttribute(name, value.toLowerCase());
        return;
      }
      if (name === 'allowfullscreen' || name === 'controls' || name === 'autoplay' || name === 'loop' || name === 'muted' || name === 'playsinline'){
        el.setAttribute(name, '');
        return;
      }
      el.setAttribute(name, value);
    });
    if (tag === 'a' && el.getAttribute('target') === '_blank') el.setAttribute('rel','noopener noreferrer');
    Array.prototype.forEach.call(node.childNodes, function(child){ cleanNode(child, el); });
    target.appendChild(el);
  }

  function sanitizeHtml(html){
    const source = String(html || '');
    if (!source) return '';
    const template = document.createElement('template');
    template.innerHTML = source;
    const out = document.createElement('div');
    Array.prototype.forEach.call(template.content.childNodes, function(node){ cleanNode(node, out); });
    return out.innerHTML;
  }

  function inlineMarkdown(text){
    return text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function markdownToHtml(text){
    const source = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    if (!source.trim()) return '';
    const lines = source.split('\n');
    let html = '';
    let paragraph = [];
    let listType = '';

    function flushParagraph(){
      if (!paragraph.length) return;
      html += '<p>' + inlineMarkdown(paragraph.join('<br>')) + '</p>';
      paragraph = [];
    }
    function closeList(){
      if (!listType) return;
      html += '</' + listType + '>';
      listType = '';
    }

    lines.forEach(function(line){
      const trimmed = line.trim();
      if (!trimmed){
        flushParagraph();
        closeList();
        return;
      }
      const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (heading){
        flushParagraph();
        closeList();
        const level = Math.min(4, heading[1].length);
        html += '<h' + level + '>' + inlineMarkdown(escapeHtml(heading[2])) + '</h' + level + '>';
        return;
      }
      const quote = trimmed.match(/^>\s?(.*)$/);
      if (quote){
        flushParagraph();
        closeList();
        html += '<blockquote><p>' + inlineMarkdown(escapeHtml(quote[1])) + '</p></blockquote>';
        return;
      }
      const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
      if (unordered){
        flushParagraph();
        if (listType !== 'ul'){ closeList(); html += '<ul>'; listType = 'ul'; }
        html += '<li>' + inlineMarkdown(escapeHtml(unordered[1])) + '</li>';
        return;
      }
      const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (ordered){
        flushParagraph();
        if (listType !== 'ol'){ closeList(); html += '<ol>'; listType = 'ol'; }
        html += '<li>' + inlineMarkdown(escapeHtml(ordered[1])) + '</li>';
        return;
      }
      if (listType) closeList();
      paragraph.push(escapeHtml(trimmed));
    });
    flushParagraph();
    closeList();
    return html;
  }

  function plainTextToHtml(text){
    return markdownToHtml(text);
  }

  function textFromHtml(html){
    const div = document.createElement('div');
    div.innerHTML = sanitizeHtml(html);
    return (div.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function truncateHtml(html, max){
    const text = textFromHtml(html);
    const limit = Math.max(1, Number(max) || 180);
    return text.length > limit ? text.slice(0, limit).replace(/\s+\S*$/,'') + '…' : text;
  }

  function slugify(value){
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90);
  }

  function readingTime(html){
    const words = textFromHtml(html).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function formatDuration(seconds){
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    if (!total) return '—';
    if (total < 60) return total + 's';
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return minutes + 'm' + (rest ? ' ' + rest + 's' : '');
  }

  function youtubeEmbed(url){
    const match = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return match ? 'https://www.youtube.com/embed/' + match[1] : '';
  }

  function isVideoUrl(url){
    return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(url || ''));
  }

  function isGifUrl(url){
    return /\.gif(\?|#|$)/i.test(String(url || ''));
  }

  window.WD_BLOG = {
    escapeHtml: escapeHtml,
    sanitizeHtml: sanitizeHtml,
    markdownToHtml: markdownToHtml,
    plainTextToHtml: plainTextToHtml,
    textFromHtml: textFromHtml,
    truncateHtml: truncateHtml,
    slugify: slugify,
    readingTime: readingTime,
    formatDuration: formatDuration,
    youtubeEmbed: youtubeEmbed,
    isVideoUrl: isVideoUrl,
    isGifUrl: isGifUrl
  };
})();
