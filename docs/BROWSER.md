# Browser companion

The companion is an unpacked Manifest V3 extension for desktop Chrome and Microsoft Edge. It is not published in either extension store. Use **Web & privacy → Export browser companion**, keep the exported folder, open your browser's extensions page, enable Developer mode and choose **Load unpacked**. Select that folder and review the browser's permission prompt. Install separately in each browser profile. Disable or remove it from the extensions page to uninstall.

The popup reports the actual enabled state of the packaged rules. The desktop app cannot check extension installation or status. Updates are manual: export a new version, remove the old companion, and load the new folder.

## Tracker blocking

The original curated list contains twelve ad/analytics domains, visible in the popup and `src/companion/trackers.json`. It blocks only matching third-party requests, using the browser's [declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest). It does not inspect page contents, gather browsing history, download a remote list, or contact a reputation service. It is a small, incomplete list, not a comprehensive ad blocker or malware/phishing filter. First-party tracking and unlisted services are not blocked. Pause the rules if a site stops working. No fabricated blocked-request counter is shown.

## Link tools and cleanup

Links are analyzed locally without visiting them. Checks examine HTTP, embedded credentials, IP hosts, internationalized domains, shortened links and unusual host structure. The URL cleaner removes recognized query keys while preserving the remaining raw query and fragment; likely signed links are left untouched. It does not remove every identifier, validate destinations or guarantee that a link still works.

Cleanup uses the browser's [browsingData API](https://developer.chrome.com/docs/extensions/reference/api/browsingData). You choose cached files and/or cookies, a time window, and explicitly confirm deletion. Cookies are unselected by default. Cookie cleanup may sign you out, and time-scoped cookie removal can remove older cookies for sites that have cookies created within the chosen period. Only this profile's ordinary websites are included. History, saved passwords, bookmarks, extension data and other profiles are not requested for deletion. Clearing local data does not erase information already held by a website or prevent every tracking method.

## Permissions and privacy

`declarativeNetRequest` supplies browser-level blocking; `browsingData` supplies deletion after user confirmation. No host-reading permission, content script, active-tab access, native messaging bridge, analytics or telemetry is used. Pasted links exist only in popup memory and disappear when it closes. All scripts and rules are packaged. The desktop message checker similarly keeps drafts only in memory until cleared or the app exits; its English-language heuristics are not a trained scam classifier.

## Isolated verification

`npm run review:browser` uses Playwright Chromium and a new temporary profile. It checks real browser blocking against a local fixture, pause/resume, link tools, confirmation, cookie/cache cleanup, and retention of unrelated data. It does not access an existing browser profile. Install the test browser with `npx playwright install chromium` if needed.
