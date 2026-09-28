/* =============================================================
 *  点到 · 朋友邀请（免填 Key）
 *
 *  站长用一个邀请码把自己的 DeepSeek Key 加密后放在下面的 BLOB 里。
 *  朋友打开带 #i=邀请码 的链接，在自己手机上解密出 Key，直接调 DeepSeek。
 *   - 网页源码里只有密文，没有邀请码解不开（PBKDF2-SHA256 × 3 万次 + HMAC 校验）。
 *   - 朋友本机只存邀请码，不存 Key；每次打开页面现解，Key 只在内存里。
 *   - 每台设备每天最多 DAILY_LIMIT 次：本机计数，防手滑刷爆，不防存心的人。
 *   - 换 Key 不用换邀请码（重新跑 mkinvite.py，朋友无感）；换邀请码 = 旧链接全部作废。
 *  BLOB 由 mkinvite.py 生成，不要手改。
 * ============================================================= */
(function (g) {
  "use strict";

  var BLOB = g.DIANDAO_INVITE_BLOB || /*BLOB*/{"v":1,"i":10000,"s":"wv7K49BN4pD+4hR6F75rNw==","c":"Uy9ynikgt9KkmuzJgz6IItjG2+LcuCS48sT9Txucn1C/2uw=","t":"aJEzZ4CR+XTPtNdSDlmhJA=="}/*BLOB*/;
  var DAILY_LIMIT = 20;
  var LS_CODE = "diandao_invite", LS_QUOTA = "diandao_quota", LS_DEV = "diandao_device";

  /* ---------------- SHA-256 / HMAC / PBKDF2（纯 JS，同步） ---------------- */
  var K = new Int32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  var IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var W = new Int32Array(64);

  // st：Int32Array(8) 就地更新；blk：Int32Array(16) 大端字
  function compress(st, blk) {
    var i, x, y, t1, t2;
    for (i = 0; i < 16; i++) W[i] = blk[i];
    for (i = 16; i < 64; i++) {
      x = W[i - 15]; y = W[i - 2];
      W[i] = (W[i - 16] + (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) +
              W[i - 7] + (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10))) | 0;
    }
    var a = st[0], b = st[1], c = st[2], d = st[3], e = st[4], f = st[5], h6 = st[6], h = st[7];
    for (i = 0; i < 64; i++) {
      t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) +
            ((e & f) ^ (~e & h6)) + K[i] + W[i]) | 0;
      t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) +
            ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = h6; h6 = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    st[0] = (st[0] + a) | 0; st[1] = (st[1] + b) | 0; st[2] = (st[2] + c) | 0; st[3] = (st[3] + d) | 0;
    st[4] = (st[4] + e) | 0; st[5] = (st[5] + f) | 0; st[6] = (st[6] + h6) | 0; st[7] = (st[7] + h) | 0;
  }
  function wordsToBytes(st) {
    var out = new Uint8Array(32);
    for (var i = 0; i < 8; i++) {
      out[i * 4] = st[i] >>> 24; out[i * 4 + 1] = (st[i] >>> 16) & 255;
      out[i * 4 + 2] = (st[i] >>> 8) & 255; out[i * 4 + 3] = st[i] & 255;
    }
    return out;
  }
  function sha256(bytes) {
    var n = bytes.length, total = ((n + 9 + 63) >> 6) << 6;
    var buf = new Uint8Array(total);
    buf.set(bytes); buf[n] = 0x80;
    var bits = n * 8;
    buf[total - 5] = Math.floor(bits / 4294967296) & 255;
    buf[total - 4] = (bits >>> 24) & 255; buf[total - 3] = (bits >>> 16) & 255;
    buf[total - 2] = (bits >>> 8) & 255; buf[total - 1] = bits & 255;
    var st = new Int32Array(IV), blk = new Int32Array(16);
    for (var off = 0; off < total; off += 64) {
      for (var j = 0; j < 16; j++) {
        var p = off + j * 4;
        blk[j] = (buf[p] << 24) | (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3];
      }
      compress(st, blk);
    }
    return wordsToBytes(st);
  }
  function concat(a, b) { var o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  function hmac(key, msg) {
    if (key.length > 64) key = sha256(key);
    var ip = new Uint8Array(64), op = new Uint8Array(64);
    for (var i = 0; i < 64; i++) { var k = i < key.length ? key[i] : 0; ip[i] = k ^ 0x36; op[i] = k ^ 0x5c; }
    return sha256(concat(op, sha256(concat(ip, msg))));
  }
  function u32be(n) { return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]); }

  // PBKDF2-HMAC-SHA256。内外两层的首块状态预先算好，之后每轮只要两次压缩
  function pbkdf2(pw, salt, iters, dkLen) {
    if (pw.length > 64) pw = sha256(pw);
    var kb = new Uint8Array(64); kb.set(pw);
    var ipad = new Int32Array(16), opad = new Int32Array(16), j;
    for (j = 0; j < 16; j++) {
      var w = (kb[j * 4] << 24) | (kb[j * 4 + 1] << 16) | (kb[j * 4 + 2] << 8) | kb[j * 4 + 3];
      ipad[j] = w ^ 0x36363636; opad[j] = w ^ 0x5c5c5c5c;
    }
    var ist = new Int32Array(IV); compress(ist, ipad);
    var ost = new Int32Array(IV); compress(ost, opad);
    var out = new Uint8Array(dkLen), st = new Int32Array(8), blk = new Int32Array(16);
    var U = new Int32Array(8), T = new Int32Array(8);
    for (var b = 1; (b - 1) * 32 < dkLen; b++) {
      var u1 = hmac(pw, concat(salt, u32be(b)));
      for (j = 0; j < 8; j++) {
        U[j] = (u1[j * 4] << 24) | (u1[j * 4 + 1] << 16) | (u1[j * 4 + 2] << 8) | u1[j * 4 + 3];
        T[j] = U[j];
      }
      for (var it = 1; it < iters; it++) {
        st.set(ist);
        for (j = 0; j < 8; j++) blk[j] = U[j];
        blk[8] = 0x80000000; for (j = 9; j < 15; j++) blk[j] = 0; blk[15] = 768;   // (64+32)*8 位
        compress(st, blk);
        for (j = 0; j < 8; j++) blk[j] = st[j];
        blk[8] = 0x80000000; for (j = 9; j < 15; j++) blk[j] = 0; blk[15] = 768;
        st.set(ost);
        compress(st, blk);
        for (j = 0; j < 8; j++) { U[j] = st[j]; T[j] ^= st[j]; }
      }
      var tb = wordsToBytes(T);
      for (j = 0; j < 32 && (b - 1) * 32 + j < dkLen; j++) out[(b - 1) * 32 + j] = tb[j];
    }
    return out;
  }

  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function b64dec(s) {
    s = String(s || "").replace(/[^A-Za-z0-9+/]/g, "");
    var out = [], buf = 0, nb = 0;
    for (var i = 0; i < s.length; i++) {
      buf = (buf << 6) | B64.indexOf(s.charAt(i)); nb += 6;
      if (nb >= 8) { nb -= 8; out.push((buf >>> nb) & 255); }
    }
    return new Uint8Array(out);
  }
  function ascii(s) { var o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 255; return o; }

  function normCode(code) { return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

  // 解开 BLOB：邀请码不对（或 BLOB 被改过）返回 ""
  function decrypt(code, blob) {
    try {
      if (!blob || blob.v !== 1) return "";
      var c = normCode(code);
      if (c.length < 6) return "";
      var salt = b64dec(blob.s), ct = b64dec(blob.c), tag = b64dec(blob.t);
      var dk = pbkdf2(ascii(c), salt, blob.i || 30000, 32);
      var encK = hmac(dk, ascii("enc")), macK = hmac(dk, ascii("mac"));
      var want = hmac(macK, concat(salt, ct)), diff = 0;
      if (tag.length !== 16) return "";
      for (var i = 0; i < 16; i++) diff |= want[i] ^ tag[i];
      if (diff) return "";
      var pt = "";
      for (var blkN = 0; blkN * 32 < ct.length; blkN++) {
        var ks = hmac(encK, concat(salt, u32be(blkN)));
        for (var j = 0; j < 32 && blkN * 32 + j < ct.length; j++) pt += String.fromCharCode(ct[blkN * 32 + j] ^ ks[j]);
      }
      return /^sk-[A-Za-z0-9]{8,}$/.test(pt) ? pt : "";
    } catch (e) { return ""; }
  }

  /* ---------------- 本机状态 ---------------- */
  var _key = "";
  function lsGet(k) { try { return g.localStorage ? g.localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (g.localStorage) g.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { if (g.localStorage) g.localStorage.removeItem(k); } catch (e) {} }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function readQuota() {
    var q = null;
    try { q = JSON.parse(lsGet(LS_QUOTA) || "null"); } catch (e) { q = null; }
    if (!q || q.d !== today() || typeof q.n !== "number") q = { d: today(), n: 0 };
    return q;
  }

  function readUrlCode() {
    try {
      var loc = g.location || {};
      var src = String(loc.hash || "").replace(/^#/, "") + "&" + String(loc.search || "").replace(/^\?/, "");
      var m = src.match(/(?:^|&)(?:i|invite)=([A-Za-z0-9\-]{4,40})/);
      return m ? m[1] : "";
    } catch (e) { return ""; }
  }
  // 解开之后把邀请码从地址栏抹掉：免得截图、转发、收藏时把码带出去
  function stripUrl() {
    try {
      var loc = g.location, hist = g.history;
      if (!loc || !hist || !hist.replaceState) return;
      var re = /(^|&)(?:i|invite)=[^&]*/g;
      var h = String(loc.hash || "").replace(/^#/, "").replace(re, "$1").replace(/^&+|&+$/g, "").replace(/&{2,}/g, "&");
      var q = String(loc.search || "").replace(/^\?/, "").replace(re, "$1").replace(/^&+|&+$/g, "").replace(/&{2,}/g, "&");
      hist.replaceState(null, "", String(loc.pathname || "") + (q ? "?" + q : "") + (h ? "#" + h : ""));
    } catch (e) {}
  }

  function unlock(code, fromSaved) {
    if (!BLOB) return false;
    var k = decrypt(code, BLOB);
    if (!k) {
      if (fromSaved) lsDel(LS_CODE);     // 站长换过邀请码：旧码作废，别每次打开都白算一遍
      return false;
    }
    _key = k;
    lsSet(LS_CODE, normCode(code));
    return true;
  }

  function init() {
    var res = { ok: false, fromUrl: false, bad: false };
    _key = "";
    var uc = readUrlCode();
    if (uc) {
      res.fromUrl = true;
      stripUrl();
      if (unlock(uc, false)) { res.ok = true; return res; }
      res.bad = true;
    }
    var saved = lsGet(LS_CODE);
    if (saved && unlock(saved, true)) res.ok = true;
    return res;
  }

  function deviceId() {
    var id = lsGet(LS_DEV);
    if (!id || !/^dd-[a-z0-9]{8,40}$/.test(id)) {
      var s = "";
      try {
        var r = new Uint8Array(10);
        (g.crypto || g.msCrypto).getRandomValues(r);
        for (var i = 0; i < r.length; i++) s += (r[i] % 36).toString(36);
      } catch (e) {
        for (var j = 0; j < 12; j++) s += Math.floor(Math.random() * 36).toString(36);
      }
      id = "dd-" + s;
      lsSet(LS_DEV, id);
    }
    return id;
  }

  g.DiandaoInvite = {
    LIMIT: DAILY_LIMIT,
    hasBlob: function () { return !!BLOB; },
    init: init,
    unlock: function (code) { return unlock(code, false); },
    active: function () { return !!_key; },
    key: function () { return _key; },
    quota: function () {
      var q = readQuota();
      return { limit: DAILY_LIMIT, used: q.n, left: Math.max(0, DAILY_LIMIT - q.n) };
    },
    // n 为负数 = 退回（接口失败没拿到回答，不算次数）
    consume: function (n) {
      var q = readQuota();
      q.n = Math.max(0, q.n + (typeof n === "number" ? n : 1));
      lsSet(LS_QUOTA, JSON.stringify(q));
      return Math.max(0, DAILY_LIMIT - q.n);
    },
    deviceId: deviceId,
    stripUrl: stripUrl,
    forget: function () { _key = ""; lsDel(LS_CODE); },
    // 下面几个给测试用
    _sha256: sha256, _hmac: hmac, _pbkdf2: pbkdf2, _decrypt: decrypt, _b64dec: b64dec
  };
})(typeof window !== "undefined" ? window : this);
