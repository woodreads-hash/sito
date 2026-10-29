(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WDHermesEmbed = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var DIMS = 384;

  function normalize(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function hash32(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function add(vec, key, weight) {
    var h = hash32(key);
    var index = h % DIMS;
    var sign = (h & 1) ? 1 : -1;
    vec[index] += sign * weight;
  }

  function embed(text) {
    var vec = new Array(DIMS);
    for (var i = 0; i < DIMS; i++) vec[i] = 0;
    var tokens = normalize(text).split(' ').filter(function (token) { return token.length > 0; });
    tokens.forEach(function (token, index) {
      add(vec, token, 1 + Math.min(token.length, 12) / 12);
      if (token.length > 4) {
        for (var c = 0; c <= token.length - 3; c++) {
          add(vec, '#' + token.slice(c, c + 3), 0.28);
        }
      }
      if (index > 0) add(vec, tokens[index - 1] + ' ' + token, 0.55);
    });
    var norm = 0;
    for (var j = 0; j < DIMS; j++) norm += vec[j] * vec[j];
    norm = Math.sqrt(norm);
    if (!norm) return vec;
    return vec.map(function (value) { return value / norm; });
  }

  function vectorLiteral(vec) {
    return '[' + vec.map(function (value) { return Number(value.toFixed(6)); }).join(',') + ']';
  }

  function chunkText(text, maxChars, overlap) {
    var clean = String(text == null ? '' : text).replace(/\r\n/g, '\n').trim();
    if (!clean) return [];
    var limit = Math.max(400, Number(maxChars) || 1200);
    var chunks = [];
    var current = '';
    function push() {
      var value = current.trim();
      if (value) chunks.push(value);
      current = '';
    }
    function addLong(value) {
      var sentences = value.match(/[^.!?\n]+[.!?]*/g) || [value];
      sentences.forEach(function (sentence) {
        var piece = sentence.trim();
        if (!piece) return;
        if ((current ? current.length + 1 : 0) + piece.length <= limit) {
          current += (current ? ' ' : '') + piece;
        } else {
          push();
          if (piece.length <= limit) current = piece;
          else {
            for (var i = 0; i < piece.length; i += limit) {
              var part = piece.slice(i, i + limit).trim();
              if (part) chunks.push(part);
            }
          }
        }
      });
    }
    clean.split(/\n{2,}/).forEach(function (paragraph) {
      var value = paragraph.trim();
      if (!value) return;
      if ((current ? current.length + 2 : 0) + value.length <= limit) {
        current += (current ? '\n\n' : '') + value;
      } else {
        push();
        if (value.length <= limit) current = value;
        else addLong(value);
      }
    });
    push();
    if (overlap && chunks.length > 1) {
      var size = Math.max(0, Number(overlap) || 0);
      if (size) {
        return chunks.map(function (chunk, index) {
          if (index === 0) return chunk;
          var previous = chunks[index - 1].slice(-size);
          return (previous + '\n' + chunk).trim();
        });
      }
    }
    return chunks;
  }

  return {
    DIMS: DIMS,
    normalize: normalize,
    embed: embed,
    vectorLiteral: vectorLiteral,
    chunkText: chunkText
  };
});
