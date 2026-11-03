'use strict';
// Shared, offline heuristics. No requests, storage, telemetry, or safe verdicts.
(function (root) {
  const shorteners = new Set(['bit.ly', 't.co', 'tinyurl.com', 'is.gd', 'rb.gy', 'cutt.ly', 'shorturl.at', 'ow.ly']);
  const tracking = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_eid|igshid|twclid|ttclid|yclid|_hsenc|_hsmi|mkt_tok)$/i;
  function parseUrl(input) {
    if (typeof input !== 'string' || !input.trim() || input.length > 4000) throw new Error('Enter an HTTP or HTTPS link, up to 4,000 characters.');
    const value = input.trim();
    if (/[\u0000-\u0020\u007f\\]/.test(value)) throw new Error('The link contains spaces, control characters, or backslashes.');
    if (!/^https?:\/\//i.test(value)) throw new Error('Include http:// or https:// at the start of the link.');
    let url; try { url = new URL(value); } catch { throw new Error('This link could not be parsed.'); }
    if (!url.hostname) throw new Error('The link needs a hostname.');
    return url;
  }
  function analyzeUrl(input) {
    const url = parseUrl(input), host = url.hostname.toLowerCase().replace(/\.$/, ''), reasons = [];
    if (url.protocol === 'http:') reasons.push('This link uses unencrypted HTTP.');
    if (url.username || url.password) reasons.push('The text before @ is login information, not the destination. Check the actual hostname below.');
    if (host.split('.').some(part => part.startsWith('xn--'))) reasons.push('This is an internationalized domain. Check its spelling carefully; similar-looking characters can impersonate another site.');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[')) reasons.push('The destination is an IP address rather than a domain name.');
    if (shorteners.has(host.replace(/^www\./, ''))) reasons.push('This shortened link hides its final destination. Redirects have not been followed.');
    if (host.split('.').length > 5) reasons.push('The hostname has many subdomains. A familiar name at the start may not be the site owner.');
    if (url.port) reasons.push('The link uses a nonstandard web port. Check that the sender intended this.');
    return { hostname: host, reasons, verdict: reasons.length ? 'Review this link' : 'No listed warning signs found', limitation: 'Offline format checks only. No reputation lookup, redirect inspection, or guarantee of safety.' };
  }
  function analyzeMessage(input) {
    if (typeof input !== 'string' || !input.trim() || input.length > 4000) throw new Error('Paste a message up to 4,000 characters.');
    const reasons = [];
    const rules = [
      [/\b(urgent|act now|immediately|final warning|within \d+ hours?|account.{0,20}(suspend|block|clos))\b/i, 'Pressure to act quickly or a threat about your account.'],
      [/\b(password|passcode|one.time (code|password)|otp|verification code|seed phrase|recovery phrase|private key)\b/i, 'Mentions credentials or recovery codes. Never share them with someone who contacted you.'],
      [/\b(gift cards?|wire transfer|crypto(currency)?|bitcoin|pay.{0,25}(fee|release|parcel|prize)|processing fee)\b/i, 'Mentions a payment method or fee often used in scams. Verify the request through a separate trusted channel.'],
      [/\b(guaranteed (profit|return)|risk.free investment|you.{0,10}(won|winner)|lottery|claim.{0,15}prize)\b/i, 'Promises a prize or unusually certain investment returns.'],
      [/\b(anydesk|teamviewer|remote access|install.{0,20}support)\b/i, 'Asks about remote access or support software. Unsolicited remote support can expose your device.']
    ];
    for (const [pattern, reason] of rules) if (pattern.test(input)) reasons.push(reason);
    const found = [...input.matchAll(/https?:\/\/[^\s<>"']+/gi)].map(match => match[0].replace(/[.,;!?)\]}]+$/, ''));
    const links = found.slice(0, 8).map(value => { try { return analyzeUrl(value); } catch { return { hostname: 'Unparsed link', reasons: ['A web link could not be parsed.'], verdict: 'Review this link' }; } });
    return { reasons, links, omittedLinks: Math.max(0, found.length - 8), verdict: reasons.length || links.some(link => link.reasons.length) ? 'Warning signs to review' : 'No listed warning signs found', limitation: 'English-language heuristics only; this does not authenticate the sender or determine whether a message is a scam. Messages stay in memory until cleared or the app closes.' };
  }
  function cleanUrl(input) {
    const url = parseUrl(input);
    if (url.username || url.password) throw new Error('Remove embedded login information before cleaning this link.');
    const original = input.trim();
    if ([...url.searchParams.keys()].some(key => /^(x-amz-.+|x-goog-.+|signature|sig|token|access_token)$/i.test(key))) return { url: original, removed: [], note: 'Possibly signed or access-controlled link: left unchanged to avoid invalidating it.' };
    const hashAt = original.indexOf('#'), body = hashAt < 0 ? original : original.slice(0, hashAt), fragment = hashAt < 0 ? '' : original.slice(hashAt);
    const queryAt = body.indexOf('?'), removed = [];
    if (queryAt < 0) return { url: original, removed, note: 'No supported tracking parameters found.' };
    const kept = body.slice(queryAt + 1).split('&').filter(part => {
      let key; try { key = decodeURIComponent(part.split('=')[0].replace(/\+/g, ' ')); } catch { return true; }
      if (tracking.test(key)) { removed.push(key); return false; } return true;
    });
    return { url: body.slice(0, queryAt) + (kept.length ? '?' + kept.join('&') : '') + fragment, removed, note: removed.length ? 'Known tracking parameters removed. Other identifiers and tracking methods may remain. Check that the link still works.' : 'No supported tracking parameters found.' };
  }
  const api = Object.freeze({ analyzeUrl, analyzeMessage, cleanUrl });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VaccineChecks = api;
})(globalThis);
