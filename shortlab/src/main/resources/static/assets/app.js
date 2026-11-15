(() => {
    'use strict';

    const HISTORY_KEY = 'shortlab.history.v1';
    const MAX_HISTORY = 10;
    const ALIAS_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,19}$/;
    const REFRESH_INTERVAL_MS = 5000; // 접속 횟수·차트 자동 갱신 주기

    const $ = (selector) => document.querySelector(selector);

    const els = {
        createForm: $('#create-form'),
        originalUrl: $('#original-url'),
        createBtn: $('#create-btn'),
        createError: $('#create-error'),
        alias: $('#alias'),
        aliasPrefix: $('#alias-prefix'),
        qrImage: $('#qr-image'),
        qrHint: $('#qr-hint'),
        qrDownloadSvg: $('#qr-download-svg'),
        qrDownloadPng: $('#qr-download-png'),
        result: $('#result'),
        resultShortUrl: $('#result-short-url'),
        resultOriginal: $('#result-original'),
        resultCount: $('#result-count'),
        resultCopy: $('#result-copy'),
        statsForm: $('#stats-form'),
        statsInput: $('#stats-input'),
        statsBtn: $('#stats-btn'),
        statsError: $('#stats-error'),
        statsResult: $('#stats-result'),
        statsOriginal: $('#stats-original'),
        statsKey: $('#stats-key'),
        statsCount: $('#stats-count'),
        logBox: $('#log-box'),
        clickLog: $('#click-log'),
        logEmpty: $('#log-empty'),
        historyList: $('#history-list'),
        historyEmpty: $('#history-empty'),
        historyClear: $('#history-clear'),
        toast: $('#toast'),
    };

    // 화면 상태
    let currentKey = null; // 결과 카드에 표시 중인 키
    let statsKey = null;   // 통계 조회에 표시 중인 키
    let refreshing = false;

    /* ---------------- API ---------------- */

    async function handleResponse(response) {
        if (response.ok) {
            return response.json();
        }
        if (response.status === 400) {
            throw new Error('올바른 http:// 또는 https:// URL을 입력해 주세요.');
        }
        if (response.status === 409) {
            throw new Error('이미 사용 중이거나 사용할 수 없는 별칭이에요. 다른 별칭을 입력해 주세요.');
        }
        if (response.status === 404) {
            throw new Error('단축 URL을 찾지 못했습니다.');
        }
        const isText = (response.headers.get('content-type') || '').includes('text/plain');
        const body = isText ? (await response.text()).trim() : '';
        throw new Error(body || '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }

    const api = {
        async create(originalUrl, alias) {
            const response = await fetch('/shortenUrl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alias ? { originalUrl, alias } : { originalUrl }),
            });
            return handleResponse(response);
        },
        async info(shortenUrlKey) {
            const response = await fetch('/shortenUrl/' + encodeURIComponent(shortenUrlKey));
            return handleResponse(response);
        },
        async clicks(shortenUrlKey) {
            const response = await fetch(`/shortenUrl/${encodeURIComponent(shortenUrlKey)}/clicks`);
            return handleResponse(response);
        },
    };

    /* ---------------- Helpers ---------------- */

    const shortUrlOf = (key) => `${location.origin}/${key}`;
    const qrUrlOf = (key) => `/shortenUrl/${encodeURIComponent(key)}/qr`;
    const isLocalHost = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

    function isHttpUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    // 스킴이 없으면 https://를 붙여 준다.
    function normalizeUrl(value) {
        const trimmed = value.trim();
        if (trimmed && !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
            return 'https://' + trimmed;
        }
        return trimmed;
    }

    // "http://host/aB3dE7xK", "host/aB3dE7xK", "aB3dE7xK" 모두 키만 뽑아낸다.
    function extractKey(input) {
        const trimmed = input.trim();
        if (!trimmed) return '';
        let path = trimmed;
        try {
            path = new URL(trimmed).pathname;
        } catch {
            // URL이 아니면 그대로 경로로 취급
        }
        const segments = path.split(/[?#]/)[0].split('/').filter(Boolean);
        return segments.length ? segments[segments.length - 1] : '';
    }

    function showError(element, message) {
        element.textContent = message;
        element.hidden = false;
    }

    function hideError(element) {
        element.textContent = '';
        element.hidden = true;
    }

    function setBusy(button, busy, idleLabel, busyLabel = '처리 중…') {
        button.disabled = busy;
        button.textContent = busy ? busyLabel : idleLabel;
    }

    let toastTimer;
    function toast(message) {
        els.toast.textContent = message;
        els.toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
    }

    async function copyText(text, message = '복사했어요') {
        try {
            await navigator.clipboard.writeText(text);
            toast(message);
        } catch {
            toast('복사에 실패했어요. 직접 선택해서 복사해 주세요.');
        }
    }

    function createElement(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text; // textContent: XSS 방지
        return node;
    }

    /* ---------------- History (localStorage) ---------------- */

    function loadHistory() {
        try {
            const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveHistory(items) {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
        } catch {
            // 저장소를 못 쓰는 환경이면 조용히 무시
        }
    }

    function addHistory(item) {
        const items = loadHistory().filter((existing) => existing.key !== item.key);
        items.unshift(item);
        saveHistory(items);
        renderHistory();
    }

    function renderHistory() {
        const items = loadHistory();
        els.historyList.replaceChildren();
        els.historyEmpty.hidden = items.length > 0;
        els.historyClear.hidden = items.length === 0;

        for (const item of items) {
            const li = createElement('li', 'history-item');

            const main = createElement('div', 'history-main');
            const link = createElement('a', 'history-short', shortUrlOf(item.key));
            link.href = shortUrlOf(item.key);
            link.target = '_blank';
            link.rel = 'noopener';
            main.append(link, createElement('p', 'history-original', item.originalUrl));

            const side = createElement('div', 'history-side');

            const statsButton = createElement('button', 'btn btn-secondary btn-sm', '통계');
            statsButton.type = 'button';
            statsButton.addEventListener('click', () => {
                els.statsInput.value = item.key;
                lookupStats(item.key);
                $('#stats').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            const copyButton = createElement('button', 'btn btn-secondary btn-sm', '복사');
            copyButton.type = 'button';
            copyButton.addEventListener('click', () => copyText(shortUrlOf(item.key)));

            side.append(statsButton, copyButton);
            li.append(main, side);
            els.historyList.append(li);
        }
    }

    /* ---------------- 접속 기록 ---------------- */

    function pad(n) { return String(n).padStart(2, '0'); }

    function formatTime(iso) { // "2026-11-14T20:35:12.123456" → "11/14 20:35:12"
        const d = new Date(iso);
        return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function formatAgo(iso) {
        const sec = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000));
        if (sec < 60) return `${sec}초 전`;
        if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
        if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
        return `${Math.floor(sec / 86400)}일 전`;
    }

    async function loadLog() {
        if (!statsKey) return;
        const requestedKey = statsKey;
        try {
            const times = await api.clicks(requestedKey);
            if (requestedKey !== statsKey) return; // 응답이 오는 사이 다른 링크로 바뀜
            els.clickLog.replaceChildren(...times.map((iso) => {
                const li = createElement('li');
                li.append(createElement('span', '', formatTime(iso)), createElement('span', 'ago', formatAgo(iso)));
                return li;
            }));
            els.logEmpty.hidden = times.length > 0;
        } catch (error) {
            els.logEmpty.textContent = error.message;
            els.logEmpty.hidden = false;
        }
    }

    /* ---------------- 접속 횟수 자동 갱신 ---------------- */

    async function refreshCounts() {
        if (refreshing) return; // 이전 갱신이 끝나기 전에는 중복 요청하지 않는다.

        const keys = new Set([currentKey, statsKey].filter(Boolean));
        if (keys.size === 0) return;

        refreshing = true;
        try {
            const entries = await Promise.all([...keys].map(async (key) => {
                try {
                    return [key, await api.info(key)];
                } catch {
                    return [key, null]; // 서버 재시작 등으로 사라진 키는 건너뛴다.
                }
            }));
            const infos = new Map(entries.filter(([, info]) => info));

            if (currentKey && infos.has(currentKey)) {
                els.resultCount.textContent = String(infos.get(currentKey).redirectCount);
            }
            if (statsKey && infos.has(statsKey)) {
                els.statsCount.textContent = String(infos.get(statsKey).redirectCount);
                await loadLog();
            }
        } finally {
            refreshing = false;
        }
    }

    setInterval(() => {
        if (!document.hidden) refreshCounts();
    }, REFRESH_INTERVAL_MS);

    // 단축 링크를 열었다가 이 탭으로 돌아오면 즉시 갱신
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) refreshCounts();
    });
    window.addEventListener('focus', () => refreshCounts());

    /* ---------------- 단축 URL 생성 ---------------- */

    els.createForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideError(els.createError);

        const value = normalizeUrl(els.originalUrl.value);
        els.originalUrl.value = value;
        if (!isHttpUrl(value)) {
            showError(els.createError, '올바른 http:// 또는 https:// URL을 입력해 주세요.');
            return;
        }

        const alias = els.alias.value.trim();
        if (alias && !ALIAS_PATTERN.test(alias)) {
            showError(els.createError, '별칭은 영문·숫자·하이픈(-)으로 3~20자, 영문이나 숫자로 시작해야 해요.');
            return;
        }

        setBusy(els.createBtn, true, '단축하기');
        try {
            const data = await api.create(value, alias);
            const item = { key: data.shortenUrlKey, originalUrl: data.originalUrl, createdAt: Date.now() };

            currentKey = item.key;
            els.resultShortUrl.textContent = shortUrlOf(item.key);
            els.resultShortUrl.href = shortUrlOf(item.key);
            els.resultOriginal.textContent = item.originalUrl;
            els.resultCount.textContent = '0';
            els.qrImage.src = qrUrlOf(item.key);
            els.qrHint.hidden = !isLocalHost();
            els.result.hidden = false;
            addHistory(item);
        } catch (error) {
            currentKey = null;
            els.result.hidden = true;
            showError(els.createError, error.message);
        } finally {
            setBusy(els.createBtn, false, '단축하기');
        }
    });

    els.resultCopy.addEventListener('click', () => {
        if (currentKey) copyText(shortUrlOf(currentKey));
    });

    /* ---------------- QR 저장 ---------------- */

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function fetchQrSvg() {
        const response = await fetch(qrUrlOf(currentKey));
        if (!response.ok) throw new Error('QR 코드를 불러오지 못했어요.');
        return response.text();
    }

    // SVG를 캔버스에 그려 PNG로 변환한다. (같은 출처의 SVG라 캔버스가 오염되지 않는다.)
    function svgToPng(svgText, scale) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth * scale;
                canvas.height = image.naturalHeight * scale;
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG 변환에 실패했어요.'))), 'image/png');
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('PNG 변환에 실패했어요.'));
            };
            image.src = url;
        });
    }

    els.qrDownloadSvg.addEventListener('click', async () => {
        if (!currentKey) return;
        try {
            downloadBlob(new Blob([await fetchQrSvg()], { type: 'image/svg+xml' }), `shortlab-${currentKey}-qr.svg`);
        } catch (error) {
            toast(error.message);
        }
    });

    els.qrDownloadPng.addEventListener('click', async () => {
        if (!currentKey) return;
        try {
            downloadBlob(await svgToPng(await fetchQrSvg(), 3), `shortlab-${currentKey}-qr.png`);
        } catch (error) {
            toast(error.message);
        }
    });

    /* ---------------- 통계 조회 ---------------- */

    async function lookupStats(key) {
        hideError(els.statsError);
        els.statsResult.hidden = true;
        els.logBox.hidden = true;
        statsKey = null;

        if (!key) {
            showError(els.statsError, '단축 URL 또는 키를 입력해 주세요.');
            return;
        }

        setBusy(els.statsBtn, true, '조회');
        try {
            const info = await api.info(key);
            statsKey = info.shortenUrlKey;
            els.statsCount.textContent = String(info.redirectCount);
            els.statsKey.textContent = info.shortenUrlKey;
            els.statsOriginal.textContent = info.originalUrl;
            els.statsResult.hidden = false;
            els.logBox.hidden = false;
            await loadLog();
        } catch (error) {
            showError(els.statsError, error.message);
        } finally {
            setBusy(els.statsBtn, false, '조회');
        }
    }

    els.statsForm.addEventListener('submit', (event) => {
        event.preventDefault();
        lookupStats(extractKey(els.statsInput.value));
    });

    /* ---------------- 최근 링크 지우기 ---------------- */

    els.historyClear.addEventListener('click', () => {
        saveHistory([]);
        renderHistory();
        toast('목록을 지웠어요');
    });

    els.aliasPrefix.textContent = `${location.host}/`;
    renderHistory();
})();