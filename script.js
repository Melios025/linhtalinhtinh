// ==UserScript==
// @name         Tool for clone
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Tool auto các hoạt động hàng ngày trên hoathinh3d.co, phục vụ mục đích cá nhân
// @author       Melios
// @match        https://hoathinh3d.co/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/Melios025/hh3d/refs/heads/main/script.js
// @downloadURL  https://raw.githubusercontent.com/Melios025/hh3d/refs/heads/main/script.js
// @require      file:///C:/Users/Admin/Desktop/Document/hh3d/script.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';
    var SCRIPT_VERSION = 'V3.0';

    //Helper function to format text
    function normalizeText(str) {
        return str
            .normalize('NFC')
            .toLowerCase()
            .replace(/đ/g, 'd')
            .replace(/[《》「」『』""''`~@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?!！?？。、，。；：]/g, '')
            // bỏ hết phần số La Mã
            .replace(/[\t\n\r]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    //Tạo dữ liệu đầu ngày
    function getDailyTasks() {
        var today = new Date().toLocaleDateString('en-GB');
        var raw = localStorage.getItem('daily_tasks');
        var data = raw ? JSON.parse(raw) : null;
        if (!data || data.lastUpdatedDate !== today) {
            data = {
                lastUpdatedDate: today,
                dailyTasks: { done: false },
                hdnReward: { done: false },
                diemdanh: { done: false },
                thiluyen: { nextTime: null, done: false, currentStage: 0 },
                bicanh: { nextTime: null, done: false, remainingTurn: null },
                dothach: { betplaced: false, turn: 0, stoneBetted1: null, stoneBetted2: null },
                hoangvuc: { nextTime: null, done: false, remainingTurn: 5 },
                khoangmach: { nextTime: null, done: false, is_in: false },
                phucloi: { nextTime: null, done: false, currentChest: 1 },
                tienduyen: { done: false },
                tele: { done: false },
                vandap: { done: false },
                mecung: { huyen_tinh_daily_total: 0, huyen_tinh_daily_cap: 200 },
                luyenDan: { dangCo: false, danHuanUsed: 0, finishAtTs: null, role: null },
            };
            localStorage.setItem('daily_tasks', JSON.stringify(data));
        }
        return data;
    }

    function getUserSetting() {
        var raw = localStorage.getItem('userSetting');
        var data = raw ? JSON.parse(raw) : null;

        var defaults = {
            autoRun: true,
            diemdanh: { auto: true, label: 'Điểm Danh' },
            thiluyen: { auto: true, label: 'Thí Luyện' },
            bicanh: { auto: true, label: 'Bí Cảnh' },
            hoangvuc: { auto: true, label: 'Hoàng Vực' },
            khoangmach: { auto: true, label: 'Khoáng Mạch' },
            phucloi: { auto: true, label: 'Phúc Lợi' },
            tienduyen: { auto: true, label: 'Tiên Duyên' },
            chucphuc: { auto: true, label: 'Chúc Phúc' },
            tele: { auto: true, label: 'Tế Lễ' },
            vandap: { auto: true, label: 'Vấn Đáp' },
        };

        if (!data) {
            data = JSON.parse(JSON.stringify(defaults));
            localStorage.setItem('userSetting', JSON.stringify(data));
        }

        return data;
    }

    //Lưu dữ liệu
    function saveTaskData(key, obj) {
        var tasks = getDailyTasks();
        tasks[key] = Object.assign(tasks[key] || {}, obj);
        localStorage.setItem('daily_tasks', JSON.stringify(tasks));
    }

    function saveUserSetting(key, value) {
        var setting = getUserSetting();
        if (!setting[key]) setting[key] = {};
        setting[key].auto = value;
        localStorage.setItem('userSetting', JSON.stringify(setting));
    }

    function isTaskEnabled(taskKey) {
        var setting = getUserSetting();
        return setting[taskKey]?.auto !== false;
    }
    //  ICON MAP cho Auto tab

    var autoIcons = {
        diemdanh: 'fa-calendar-check',
        thiluyen: 'fa-fire-flame-curved',
        phucloi: 'fa-hand-holding-heart',
        hoangvuc: 'fa-mountain-sun',
        bicanh: 'fa-dungeon',
        khoangmach: 'fa-gem',
        tienduyen: 'fa-wand-sparkles',
        tele: 'fa-staff-snake',
        vandap: 'fa-comments',
        chucphuc: 'fa-star',
    };

    //  HELPER: timestamp → "HH:MM"
    function tsToTime(ts) {
        if (!ts) return '';
        var d = new Date(typeof ts === 'string' ? parseInt(ts) : ts);
        if (isNaN(d.getTime())) return '';
        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }

    //Hàm xử lý ajax
    function ajax(action, extraParams, options = {}) {
        if (typeof hh3dData === 'undefined') return Promise.reject(new Error('hh3dData not found'));
        var params = Object.assign({
            action: action,
            security_token: hh3dData.securityToken
        }, extraParams || {});
        return fetch(hh3dData.themeAjax, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params)
        })
            .then(async function (r) {
                var data = await r.json();
                if (!r.ok) {
                    throw new Error(data.message);
                }
                return data;
            })
            .then(function (data) {
                if (!options.ignoreSuccess && !data.success) throw new Error(`[${action}] ${data.data?.error || data.data?.message || data.data || 'Request thất bại'}`);
                return data;
            });
    }

    //Hàm xử lý rest api
    async function resApi(endpoint, body, options = {}) {
        if (typeof hh3dData === 'undefined') throw new Error('hh3dData not found');
        var url;
        body = body || {};
        if (endpoint.startsWith('http')) {
            url = endpoint;
        } else if (endpoint.includes('/')) {
            url = 'https://hoathinh3d.co/wp-json/' + endpoint;
        } else {
            url = hh3dData.restAction;
            body = Object.assign({ action: endpoint }, body);
        }

        // Merge thêm headers từ options nếu có
        var headers = Object.assign({
            'Content-Type': 'application/json',
            'X-WP-Nonce': hh3dData.restNonce
        }, options.headers || {});

        var res = await fetch(url, {
            method: 'POST',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify(body)
        })
            .then(async function (r) {
                var data = await r.json();
                if (!r.ok) throw new Error(data.message);
                return data;
            })
            .then(function (data) {
                var isSuccess = data.success === true || data.ok === true;
                if (!options.ignoreSuccess && !isSuccess) {
                    var errMsg = data.data?.error || data.data?.message || data.message;
                    if (typeof errMsg !== 'string') errMsg = `${endpoint} thất bại`;
                    throw new Error(errMsg);
                }
                return data;
            });

        return res;
    }

    //Đánh điểm danh
    async function danh_diem_danh_api() {
        var res = await resApi('daily_check_in');

        showTempAlert(res.data?.message || res.message, 'success');

        saveTaskData('diemdanh', { done: true });
        updateButtonStates();
    }

    //Hàm đánh tế lễ
    async function danh_tele_tong_mon_api() {
        var res = await resApi('tong-mon/v1/te-le-tong-mon', {
            action: 'te_le_tong_mon',
            security_token: hh3dData.securityToken
        });

        showTempAlert(res.data?.message || res.message, 'success');

        saveTaskData('tele', { done: true });
        updateButtonStates();
    }
    //Hàm đánh phúc lợi
    async function danh_phuc_loi_api() {
        var tasks = getDailyTasks();
        if (tasks.phucloi.nextTime && Date.now() < tasks.phucloi.nextTime) {
            var minutesLeft = Math.ceil((tasks.phucloi.nextTime - Date.now()) / 60000);
            throw new Error(`Chưa đến lượt mở rương, còn ${minutesLeft} phút`);
        }

        var chestId = getDailyTasks().phucloi.currentChest;
        var data = await ajax(hh3dData.act.plOpen, { chest_id: chestId });
        showTempAlert(data.data.message, 'success');
        var isLastChest = chestId >= 4;
        // Lấy thời gian chờ cho lần mở tiếp
        if (isLastChest) {
            saveTaskData('phucloi', { done: true, nextTime: null, currentChest: 1 });
            updateButtonStates();
        } else {
            var timerAfter = await ajax(hh3dData.act.plTimer);
            var partsAfter = timerAfter.data.time.split(':');
            var nextWaitMs = (parseInt(partsAfter[0]) * 60 + parseInt(partsAfter[1])) * 1000;
            saveTaskData('phucloi', {
                currentChest: chestId + 1,
                nextTime: nextWaitMs > 0 ? Date.now() + nextWaitMs + 10000 : null
            });
        }
    }

    //Hàm đánh hoang vực
    async function danh_hoang_vuc_api() {
        var Tasks = getDailyTasks();
        var hoangvuc = Tasks?.hoangvuc;

        if (hoangvuc?.done || hoangvuc?.remainingTurn <= 0) {
            showTempAlert('Đã hết lượt đánh hôm nay');
            return;
        }

        if (hoangvuc?.nextTime) {
            var now = Date.now(); // milliseconds
            if (now < hoangvuc.nextTime) {
                var secondsLeft = Math.ceil((hoangvuc.nextTime - now) / 1000);
                var minutes = Math.floor(secondsLeft / 60);
                var seconds = secondsLeft % 60;
                showTempAlert(`Chưa đến lượt đánh, còn ${minutes}p ${seconds}s`);
                return;
            }
        }

        var startTime = performance.now();

        var res = await fetch('/hoang-vuc', { credentials: 'include' });
        var html = await res.text();

        var m1 = html.match(/ajax_boss_nonce\s*=\s*'([^']+)'/);
        var m2 = html.match(/boss_attack_token\s*=\s*'([^']+)'/);

        var token = {
            nonce: m1 ? m1[1] : null,
            attackToken: m2 ? m2[1] : null
        };

        if (!token.nonce || !token.attackToken) {
            showTempAlert('Không lấy được token Hoàng Vực');
            return;
        }

        // Lấy boss info
        var bossData = await ajax(hh3dData.act.bossGet, { nonce: token.nonce });
        if (bossData.data.has_pending_rewards) {
            // Nhận thưởng
            var claimData = await fetch(hh3dData.adminAjax, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'claim_chest',
                    nonce: token.nonce
                })
            }).then(r => r.json());

            if (claimData.success) {
                var rewards = claimData.total_rewards;
                var msg = claimData.success + ' Tu Vi: ' + rewards.tu_vi + ' | Tinh Thạch: ' + rewards.tinh_thach + ' | Tiên Ngọc: ' + rewards.tien_ngoc;
                showTempAlert(msg, 'success');
            } else {
                showTempAlert('Nhận thưởng thất bại', 'error');
            }
        };

        // Tấn công
        var requestId = 'req_' + Math.random().toString(36).substr(2, 10) + '_' + Date.now();
        var result = await ajax(hh3dData.act.bossAttack, {
            boss_id: bossData.data.id,
            nonce: token.nonce,
            attack_token: token.attackToken,
            request_id: requestId
        });

        showTempAlert('Đang tấn công... (' + Math.round(performance.now() - startTime) + 'ms)', 'success');
        var bossTimer = await ajax(hh3dData.act.bossTimer);

        var currentTasks = getDailyTasks();
        var currentTurn = currentTasks?.hoangvuc?.remainingTurn ?? 5;
        var newTurn = currentTurn - 1;

        var updateObj = { remainingTurn: newTurn };
        updateObj.nextTime = parseInt(bossTimer.data) + 1 * 60 * 1000; // Thêm 1 phút đệm để chắc chắn đã hết thời gian chờ trên server
        if (newTurn <= 0) updateObj.done = true;
        saveTaskData('hoangvuc', updateObj);
        updateButtonStates();
    }

    //Hàm đánh mê cung
    var mazeState = null;
    var cryptoKeyPromise = null;
    var _mazeSocket = null;
    var _heartbeatInterval = null;

    const MAZE = {
        userStatus: 'me-cung/v1/user-status',
        joinRoom: 'https://hoathinh3d.co/wp-json/me-cung/v1/join-by-invite',
        ready: 'me-cung/v1/ready',
        leave: 'me-cung/v1/leave',
    };
    const MAZE_MAX_WAIT = 60 * 1000;
    const MC_TOKEN_TTL = 5 * 60 * 1000;
    var _mcTokenCache = null;
    var _mcTokenExpiry = 0;

    async function getMcToken(forceRefresh = false) {
        var now = Date.now();
        if (!forceRefresh && _mcTokenCache && now < _mcTokenExpiry) {
            return _mcTokenCache;
        }
        // Chỉ load iframe khi thực sự cần
        return new Promise(function (resolve, reject) {
            var iframe = document.createElement('iframe');
            iframe.src = '/me-cung';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            iframe.onload = function () {
                try {
                    var scripts = iframe.contentDocument.querySelectorAll('script:not([src])');
                    var token = null;
                    scripts.forEach(function (s) {
                        var match = s.textContent.match(/mcToken:\s*"([^"]+)"/);
                        if (match) token = match[1];
                    });
                    document.body.removeChild(iframe);
                    if (token) {
                        _mcTokenCache = token;
                        _mcTokenExpiry = Date.now() + MC_TOKEN_TTL;
                        resolve(token);
                    } else {
                        reject(new Error('Không tìm thấy mcToken'));
                    }
                } catch (e) {
                    document.body.removeChild(iframe);
                    reject(e);
                }
            };
            iframe.onerror = function () {
                document.body.removeChild(iframe);
                reject(new Error('Không load được iframe'));
            };
        });
    };

    function parseMazeToken(input) {
        input = input.trim();
        try {
            var url = new URL(input);
            var token = url.searchParams.get('invite');
            if (token) return token;
        } catch (e) { }
        return input;
    }

    var _statusCache = null;
    var _statusCacheTime = 0;
    const STATUS_CACHE_TTL = 3000; // 3 giây

    async function getMazeStatusCached(forceRefresh = false) {
        var now = Date.now();
        if (!forceRefresh && _statusCache && (now - _statusCacheTime) < STATUS_CACHE_TTL) {
            return _statusCache;
        }
        _statusCache = await getMazeStatusSafe();
        _statusCacheTime = Date.now();
        return _statusCache;
    }

    async function getMazeStatus() {
        var res = await fetch('https://hoathinh3d.co/wp-json/' + MAZE.userStatus, {
            method: 'GET',
            headers: { 'X-WP-Nonce': hh3dData.restNonce },
            credentials: 'include',
        });
        if (!res.ok) {
            var err = new Error('HTTP ' + res.status);
            err.status = res.status;
            throw err;
        }
        return res.json();
    }

    function getMcCryptoKey() {
        if (cryptoKeyPromise) return cryptoKeyPromise;
        cryptoKeyPromise = (function () {
            var key = ['SDNkQFMwY2szdEszeSE=', 'MjAyNiNTZWN1cmUkMzJDaHIh'].map(function (s) { return atob(s); }).join('');
            return window.crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'AES-CBC' }, false, ['decrypt']);
        })();
        return cryptoKeyPromise;
    }

    async function decryptMazeEvent(raw) {
        if (!raw || !raw._e) return raw;
        try {
            var parts = String(raw._e).split(':');
            if (parts.length !== 2) return raw;
            var iv = new Uint8Array(parts[0].length / 2);
            for (var i = 0; i < parts[0].length; i += 2) iv[i / 2] = parseInt(parts[0].slice(i, i + 2), 16);
            var enc = Uint8Array.from(atob(parts[1]), function (c) { return c.charCodeAt(0); });
            var key = await getMcCryptoKey();
            var dec = await window.crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv }, key, enc);
            return JSON.parse(new TextDecoder().decode(dec));
        } catch (e) { return raw; }
    }

    async function getMazeStatusSafe() {
        var delays = [1000, 2000, 4000];
        for (var i = 0; i <= delays.length; i++) {
            try {
                return await getMazeStatus();
            } catch (e) {
                var is503 = e.status === 503 || (e.message && e.message.includes('503'));
                if (is503 && i < delays.length) {
                    await new Promise(r => setTimeout(r, delays[i]));
                } else {
                    throw e;
                }
            }
        }
    }
    //  HEARTBEAT — độc lập, không bị clear bởi disconnect
    function startHeartbeat() {
        if (_heartbeatInterval) return; // đã chạy rồi
        _heartbeatInterval = setInterval(function () {
            if (_mazeSocket && _mazeSocket.connected) {
                _mazeSocket.emit('heartbeat', { userId: hh3dData.userId });
            }
        }, 30000);
    }

    function stopHeartbeat() {
        if (_heartbeatInterval) {
            clearInterval(_heartbeatInterval);
            _heartbeatInterval = null;
        }
    }

    //  SOCKET — kết nối 1 lần, giữ sống liên tục
    function connectMazeSocket() {
        return new Promise(function (resolve, reject) {
            // Nếu socket đang sống → dùng lại luôn
            if (_mazeSocket && _mazeSocket.connected) {
                return resolve(_mazeSocket);
            }

            // Dọn socket cũ nếu đã chết
            if (_mazeSocket) {
                _mazeSocket.removeAllListeners();
                _mazeSocket.disconnect();
                _mazeSocket = null;
            }

            var resolved = false;
            var timer = setTimeout(function () {
                if (!resolved) reject(new Error('Timeout kết nối socket'));
            }, 10000);

            var sock = io('https://online.hoathinhtq.net', {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: Infinity,
            });

            // ── connect ──────────────────────────────
            sock.on('connect', function () {
                _mazeSocket = sock;
                sock.emit('register_user', parseInt(hh3dData.userId));
            });

            // ── registration confirmed ────────────────
            sock.on('registration_confirmed', function () {
                if (mazeState && mazeState.roomCode) {
                    sock.emit('mc_join_room', mazeState.roomCode);
                }
                startHeartbeat();
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    resolve(sock);
                }
            });
            // ── disconnect ───────────────────────────
            sock.on('disconnect', function (reason) {
                if (mazeState) mazeState.status = 'reconnecting';
            });


            // ── heartbeat ack ────────────────────────
            sock.on('heartbeat_ack', function () {
            });

            // ── connect error (lần đầu) ──────────────
            sock.on('connect_error', function (e) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    reject(new Error('Kết nối socket thất bại: ' + e.message));
                }
            });

            // ── mc_room_event ────────────────────────
            sock.on('mc_room_event', async function (raw) {
                var data = await decryptMazeEvent(raw);
                if (!data || !data.eventType) return;
                if (!mazeState || data.roomCode !== mazeState.roomCode) return;

                if (data.eventType === 'attack_result') {
                    Object.assign(mazeState, {
                        status: data.all_dead ? 'waiting' : 'battle',
                        stage: data.boss && data.boss.stage,
                        bossName: data.boss && data.boss.name,
                        bossElement: data.boss && data.boss.element,
                        bossHpPct: data.boss && data.boss.hp_max
                            ? Math.round(data.boss.hp / data.boss.hp_max * 100) : 0,
                        timeLeft: data.stage_time_left_seconds,
                        lastResult: data.boss_dead ? 'win' : data.all_dead ? 'lose' : mazeState.lastResult,
                        nextStage: data.next_stage || mazeState.nextStage,
                        allDead: data.all_dead,
                        myHp: data.members && data.members.find(function (m) {
                            return String(m.user_id) === String(hh3dData.userId);
                        }),
                    });
                }
            });
        });
    }

    //  WAIT FOR EVENT
    function waitForMazeEvent(roomCode, condition) {
        return new Promise(function (resolve, reject) {
            var timer = setTimeout(function () {
                cleanup();
                reject(new Error('Timeout chờ event'));
            }, MAZE_MAX_WAIT);

            function cleanup() {
                clearTimeout(timer);
                if (_mazeSocket) _mazeSocket.off('mc_room_event', handler);
            }

            async function handler(raw) {
                var data = await decryptMazeEvent(raw);
                if (!data || data.roomCode !== roomCode) return;
                if (condition(data)) {
                    cleanup();
                    resolve(data);
                }
            }

            if (!_mazeSocket) { reject(new Error('Chưa có socket')); return; }
            _mazeSocket.on('mc_room_event', handler);
        });
    }

    //  CLAIM CHEST (helper tránh duplicate code)
    async function claimBoss5Chest(roomCode, result, mcOptions) {
        if (!result.floor_complete) return;
        var myToken = result.chest_tokens && result.chest_tokens[String(hh3dData.userId)];
        if (!myToken) return;

        showTempAlert('Nhận rương ải 5 sau 7 giây...', 'success');
        await new Promise(r => setTimeout(r, 7000));

        try {
            var res = await resApi('me-cung/v1/claim-boss5-chest', {
                room_code: roomCode,
                chest_token: myToken,
            }, mcOptions);
            showTempAlert('Đã nhận rương ải 5!', 'success');

            if (res && res.reward) {
                var tasks = getDailyTasks();
                tasks.mecung.huyen_tinh_daily_total = res.reward.huyen_tinh_daily_total ?? tasks.mecung.huyen_tinh_daily_total;
                tasks.mecung.huyen_tinh_daily_cap = res.reward.huyen_tinh_daily_cap ?? tasks.mecung.huyen_tinh_daily_cap;
                localStorage.setItem('daily_tasks', JSON.stringify(tasks));

                if (tasks.mecung.huyen_tinh_daily_total >= tasks.mecung.huyen_tinh_daily_cap) {
                    var btn = document.getElementById('btn-mecung');
                    if (btn && !btn.querySelector('.mc-done-badge')) {
                        var badge = document.createElement('span');
                        badge.className = 'mc-done-badge';
                        badge.textContent = '✓';
                        badge.style.cssText = 'margin-left:auto;font-size:14px;opacity:0.9;';
                        btn.appendChild(badge);
                    }
                }
            }
        } catch (e) {
            console.error('[MC] Nhận rương thất bại:', e);
        }
    }

    //  READY — retry 3 lần
    async function sendReady(roomCode, mcOptions) {
        await new Promise(r => setTimeout(r, 2000));
        var delays = [0, 5000, 8000];

        for (var i = 0; i < 3; i++) {
            try {
                if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));

                // Luôn fetch token mới cho ready, không tái dùng token cũ
                var freshToken = await getMcToken(true); // force refresh
                var opts = { headers: { 'X-Mc-Action-Token': freshToken } };

                await Promise.race([
                    resApi(MAZE.ready, { room_code: roomCode, is_ready: 1 }, opts),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 10000)),
                ]);

                var check = await getMazeStatusCached(true);
                var me = check.members?.find(m => String(m.user_id) === String(hh3dData.userId));
                if (me?.is_ready) return check;

            } catch (e) {
                if (i === 2) throw new Error('Ready thất bại sau 3 lần thử: ' + e.message);
                console.warn(`Retry ${i + 1}`, e.message);
            }
        }
    }
    //  MAIN
    async function danh_me_cung_api(inviteInput) {
        showTempAlert('Đang kết nối socket...', 'success');
        await connectMazeSocket();

        var token = inviteInput ? parseMazeToken(inviteInput) : null;

        // 1 lần getMcToken duy nhất cho cả flow
        var mcToken = await getMcToken();
        var mcOptions = { headers: { 'X-Mc-Action-Token': mcToken } };

        // 1 lần getMazeStatus duy nhất ban đầu
        var currentStatus = await getMazeStatusCached(true);

        if (token) {
            if (currentStatus.in_room) {
                showTempAlert('Đang rời phòng cũ...', 'success');
                var leaveToken = await getMcToken(true);
                await resApi(MAZE.leave, { room_code: currentStatus.room_code },
                    { headers: { 'X-Mc-Action-Token': leaveToken } });

                // Dùng socket event thay vì poll HTTP
                await new Promise(function (resolve) {
                    var timeout = setTimeout(resolve, 5000); // fallback 5s
                    _mazeSocket.once('mc_room_event', async function (raw) {
                        var data = await decryptMazeEvent(raw);
                        if (data?.eventType === 'user_left') {
                            clearTimeout(timeout);
                            resolve();
                        }
                    });
                });

                currentStatus = await getMazeStatusCached(true);
                if (currentStatus.in_room) throw new Error('Rời phòng thất bại');
            }

            var joinToken = await getMcToken(true);
            await resApi(MAZE.joinRoom, { token },
                { headers: { 'X-Mc-Action-Token': joinToken } });
            currentStatus = await getMazeStatusCached(true); // 1x sau join
            if (!currentStatus.in_room) throw new Error('Vào phòng thất bại');
        } else {
            if (!currentStatus.in_room) throw new Error('Bạn chưa ở trong phòng nào');
        }

        var roomCode = currentStatus.room_code;
        _mazeSocket.emit('mc_join_room', roomCode);
        showTempAlert('Đã vào phòng ' + roomCode + '!', 'success');
        mazeState = { status: 'waiting', roomCode, stage: currentStatus.floor || 1 };

        // ── Game loop ─────────────────────────────────────────────
        while (true) {
            console.log('[MC] đầu loop — currentStatus.status:', currentStatus.status);
            try {
                if (currentStatus.status === 'battle') {
                    _mazeSocket.emit('mc_join_room', roomCode);
                    Object.assign(mazeState, { status: 'battle', stage: currentStatus.floor });

                    var result = await waitForMazeEvent(roomCode, d =>
                        d.eventType === 'attack_result' && (d.boss_dead || d.all_dead)
                    );

                    if (result.all_dead) {
                        showTempAlert('Thua! Chờ lượt mới...', 'error');
                        await new Promise(r => setTimeout(r, 1500)); // buffer nhỏ cho chắc
                        currentStatus = await getMazeStatusSafe();
                        Object.assign(mazeState, { status: 'waiting', stage: currentStatus.floor || mazeState.stage });
                    } else {
                        showTempAlert('Ải ' + (result.stage_complete || mazeState.stage) + ' thắng!', 'success');
                        await claimBoss5Chest(roomCode, result, mcOptions);

                        if (result.floor_complete) {
                            // Ải 5 xong → chờ lượt mới
                            currentStatus.status = 'waiting';
                            Object.assign(mazeState, { status: 'waiting', bossHpPct: 0, lastResult: 'win' });
                        } else {
                            // Ải 1-4 → tiếp tục battle
                            Object.assign(mazeState, { status: 'battle', bossHpPct: 0, lastResult: 'win' });
                        }
                    }

                } else {
                    var me = currentStatus.members?.find(
                        m => String(m.user_id) === String(hh3dData.userId)
                    );

                    if (!me?.is_ready) {
                        currentStatus = await sendReady(roomCode, mcOptions);
                        showTempAlert('Đã sẵn sàng! Chờ host bắt đầu...', 'success');
                    } else {
                        showTempAlert('Đã ready, chờ host bắt đầu...', 'success');
                    }

                    Object.assign(mazeState, { status: 'ready', stage: currentStatus.floor || mazeState.stage });

                    var firstAttack = await waitForMazeEvent(roomCode, d => d.eventType === 'attack_result');
                    showTempAlert('Ải ' + firstAttack.boss.stage + ' — ' + firstAttack.boss.name + ' bắt đầu!', 'success');
                    Object.assign(mazeState, { status: 'battle' });
                    currentStatus.status = 'battle';
                }

            } catch (e) {
                if (e.message === 'Timeout chờ event' || e.message === 'Timeout gọi ready') {
                    await new Promise(r => setTimeout(r, 2000));
                    currentStatus = await getMazeStatusCached(true);
                    if (!currentStatus.in_room) {
                        mazeState = null; stopHeartbeat();
                        showTempAlert('Đã hoàn thành Mê Cung!', 'success');
                        break;
                    }
                    continue;
                }
                throw e;
            }
        }
    }

    // ============================================================
    // LUYỆN ĐAN
    // ============================================================
    const LD = {
        sessionToken: 'hh3d/v1/luyen-dan/session-token',
        invite: 'hh3d/v1/luyen-dan/dong/invite',
        respond: 'hh3d/v1/luyen-dan/dong/respond',
        start: 'hh3d/v1/luyen-dan/start',
        tune: 'hh3d/v1/luyen-dan/tune',
        state: 'hh3d/v1/luyen-dan/state',
        leave: 'hh3d/v1/luyen-dan/dong/leave',
        friends: 'hh3d/v1/luyen-dan/friends',
        collect: 'hh3d/v1/luyen-dan/collect',
        decompose: 'hh3d/v1/luyen-dan/decompose'
    };

    var _ldState = null;
    var _ldInfoCache = null;

    // ── Token cache ───────────────────────────────────────────
    var _ldTokenCache = null;
    var _ldTokenExpiresAt = 0;

    async function getLdToken() {
        var now = Math.floor(Date.now() / 1000);
        if (_ldTokenCache && now < _ldTokenExpiresAt - 10) return _ldTokenCache;
        var res = await fetch('https://hoathinh3d.co/wp-json/' + LD.sessionToken, {
            method: 'GET',
            headers: { 'X-WP-Nonce': hh3dData.restNonce },
            credentials: 'include',
        });
        var data = await res.json();
        if (!data.ok) throw new Error('Không lấy được LD token');
        _ldTokenCache = data.data.security_token;
        _ldTokenExpiresAt = data.data.expires_at;
        return _ldTokenCache;
    }

    //  State 
    async function getLdState(ldToken) {
        var res = await fetch('https://hoathinh3d.co/wp-json/' + LD.state, {
            method: 'GET',
            headers: {
                'X-WP-Nonce': hh3dData.restNonce,
                'X-Ld-Token': ldToken,
            },
            credentials: 'include',
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.message || 'Lỗi lấy LD state');
        return data;
    }
    // ── INIT KHI LOAD TRANG ──────────────────────────────────
    async function initLdTimerOnLoad() {
        try {
            var ldToken = await getLdToken();
            var state = await getLdState(ldToken);
            _ldInfoCache = getLdInfoFromStateData(state);  // luôn set cache

            var craft = state.data && state.data.craft;
            var tasks = getDailyTasks();

            if (craft && craft.status === 'crafting') {
                _ldState = {
                    status: 'crafting',
                    role: tasks.luyenDan && tasks.luyenDan.role || 'owner',
                    finishAt: craft.finish_at_ts,
                    tier: craft.ui_tier,
                    tuneCount: craft.tune_count,
                    tuneSlotsLeft: craft.tune_huan_slots_left,
                    stabilityPct: craft.stability_pct,
                };
                saveTaskData('luyenDan', { finishAtTs: craft.finish_at_ts, dangCo: true });
            } else {
                _ldState = null;
            }
        } catch (e) {
            var tasks = getDailyTasks();
            if (tasks.luyenDan && tasks.luyenDan.finishAtTs) {
                _ldState = {
                    status: 'crafting',
                    role: tasks.luyenDan.role || 'owner',
                    finishAt: tasks.luyenDan.finishAtTs,
                };
            }
        }
    }

    // ── Parse info từ state ───────────────────────────────────
    function getLdInfoFromStateData(stateData) {
        if (!stateData || !stateData.data) return null;
        var d = stateData.data;
        var craft = d.craft || null;
        var slots = d.dong_slots || [];
        var activeBuddies = slots.filter(function (s) { return s && s.userId; });
        return {
            buddyNames: activeBuddies.map(function (b) { return b.name || '#' + b.userId; }),
            buddyIds: activeBuddies.map(function (b) { return b.userId; }),
            dongServingOwnerName: d.dong_serving ? d.dong_serving.owner_name : null,
            dongServingOwnerId: d.dong_serving ? d.dong_serving.owner_id : null,
            craft: craft,
            materials: d.materials || {},
            materialKeys: d.material_keys || [],
            danHuanWallet: d.dan_huan_wallet || 0,
            danHuanLeft: d.dan_huan_left || 0,
            recipes: d.recipes || {},
            pillStacks: d.pill_stacks || []
        };
    }
    // ── Render info box ───────────────────────────────────────
    function renderLdInfo() {
        var infoEl = document.getElementById('ld-info-box');
        if (!infoEl) return;
        if (!_ldInfoCache) {
            infoEl.innerHTML = '<span class="ld-info-hint">Chưa có dữ liệu</span>';
            return;
        }
        var lines = [];

        // Đan đồng / chủ lò
        if (_ldInfoCache.dongServingOwnerName) {
            lines.push('<span class="ld-info-label"><i class="fa-solid fa-user-tie"></i> Chủ lò:</span>'
                + '<span class="ld-info-val">' + _ldInfoCache.dongServingOwnerName + '</span>');
        }
        if (_ldInfoCache.buddyNames && _ldInfoCache.buddyNames.length > 0) {
            lines.push('<span class="ld-info-label"><i class="fa-solid fa-user-group"></i> Đan đồng:</span>'
                + '<span class="ld-info-val">' + _ldInfoCache.buddyNames.join(', ') + '</span>');
        }

        // Craft info
        if (_ldInfoCache.craft) {
            var c = _ldInfoCache.craft;
            var tierLabel = { ha: 'Hạ Phẩm', trung: 'Trung Phẩm', thuong: 'Thượng Phẩm', cuc: 'Cực Phẩm' };
            lines.push('<span class="ld-info-label"><i class="fa-solid fa-fire"></i> Lò:</span>'
                + '<span class="ld-info-val">' + (tierLabel[c.ui_tier] || c.ui_tier || '?') + '</span>');
            if (c.stability_pct !== undefined) {
                var col = c.stability_pct > 68 ? '#4ade80' : c.stability_pct > 40 ? '#fbbf24' : '#f87171';
                lines.push('<span class="ld-info-label"><i class="fa-solid fa-gauge"></i> Ổn định:</span>'
                    + '<span class="ld-info-val" style="color:' + col + ';">' + c.stability_pct.toFixed(1) + '%</span>');
            }
        }

        // Separator
        lines.push('<div style="width:100%;border-top:1px solid rgba(255,255,255,0.06);margin:4px 0;"></div>');

        var danHuanUsed = getDailyTasks().luyenDan.danHuanUsed || 0;
        var danHuanMax = 27;
        var danHuanColor = danHuanUsed >= danHuanMax ? '#4ade80' : '#fbbf24';

        var maxCraftHtml = '';
        if (_ldInfoCache.materials && _ldInfoCache.recipes) {
            var tier = (_ldInfoCache.craft && _ldInfoCache.craft.ui_tier) || 'ha';
            var recipe = _ldInfoCache.recipes[tier] && _ldInfoCache.recipes[tier].vector;
            if (recipe) {
                var maxCraft = Infinity;
                Object.keys(recipe).forEach(function (key) {
                    var have = _ldInfoCache.materials[key] || 0;
                    var need = recipe[key];
                    maxCraft = Math.min(maxCraft, Math.floor(have / need));
                });
                if (maxCraft === Infinity) maxCraft = 0;
                var craftColor = maxCraft === 0 ? '#f87171' : maxCraft < 3 ? '#fbbf24' : '#4ade80';
                maxCraftHtml = '<span class="ld-info-label"><i class="fa-solid fa-flask"></i> Luyện:</span>'
                    + '<span class="ld-info-val" style="color:' + craftColor + ';">' + maxCraft + ' lần</span>';
            }
        }

        lines.push(
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;width:100%;">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">'
            + '<span class="ld-info-label"><i class="fa-solid fa-fire-flame-curved"></i> Đan Huân:</span>'
            + '<span class="ld-info-val">' + _ldInfoCache.danHuanWallet
            + ' <span style="color:' + danHuanColor + ';font-size:11px;">(' + danHuanUsed + '/' + danHuanMax + ')</span></span>'
            + '</div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">'
            + maxCraftHtml
            + '</div>'
            + '</div>'
        );

        // Linh Dược — 2 cột
        if (_ldInfoCache.materialKeys && _ldInfoCache.materialKeys.length) {
            var matLabel = {
                kim: '<i class="fa-solid fa-circle" style="color:#c0c0c0;"></i> Kim',
                moc: '<i class="fa-solid fa-circle" style="color:#4ade80;"></i> Mộc',
                thuy: '<i class="fa-solid fa-circle" style="color:#38bdf8;"></i> Thủy',
                hoa: '<i class="fa-solid fa-circle" style="color:#f87171;"></i> Hỏa',
                tho: '<i class="fa-solid fa-circle" style="color:#d97706;"></i> Thổ',
                linh_phong_thao: '<i class="fa-solid fa-leaf" style="color:#a3e635;"></i> Linh Phong',
                huyen_van_thao: '<i class="fa-solid fa-leaf" style="color:#818cf8;"></i> Huyền Vân',
                thien_de_thao: '<i class="fa-solid fa-leaf" style="color:#f59e0b;"></i> Thiên Đế',
            };

            var matCells = _ldInfoCache.materialKeys.map(function (key) {
                var qty = _ldInfoCache.materials[key] || 0;
                var label = matLabel[key] || key;
                var color = qty === 0 ? '#f87171' : qty < 10 ? '#fbbf24' : '#e2e8f0';
                return '<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">'
                    + '<span class="ld-info-label" style="font-size:12px;">' + label + '</span>'
                    + '<span class="ld-info-val" style="color:' + color + ';font-size:12px;">' + qty + '</span>'
                    + '</div>';
            });

            var gridHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;width:100%;">';
            matCells.forEach(function (cell) { gridHtml += cell; });
            gridHtml += '</div>';

            lines.push(gridHtml);
        }

        infoEl.innerHTML = lines.map(function (l) {
            if (l.startsWith('<div style="display:grid')  // grid 2 cột
                || l.startsWith('<div style="width:100%')) { // separator
                return l;
            }
            return '<div class="ld-info-row">' + l + '</div>';
        }).join('');
    }

    // ── CHỦ LÒ: Mời đan đồng ─────────────────────────────────
    async function danh_luyen_dan_invite_api(buddyId) {
        var ldToken = await getLdToken();
        await resApi(LD.invite, { buddy_id: buddyId }, { headers: { 'X-Ld-Token': ldToken }, ignoreSuccess: true });
        showTempAlert('Đã mời đan đồng! Đang chờ chấp nhận...', 'success');

        // Poll tối đa 2 phút để chờ đan đồng accept
        for (var i = 0; i < 24; i++) {
            await new Promise(function (r) { setTimeout(r, 5000); });
            var state = await getLdState(ldToken);
            _ldInfoCache = getLdInfoFromStateData(state);
            var slots = state.data.dong_slots || [];
            var hasBuddy = slots.some(function (s) { return s && s.userId; });
            if (hasBuddy) {
                showTempAlert('Đan đồng đã chấp nhận!', 'success');
                return;
            }
        }
        showTempAlert('Đan đồng chưa chấp nhận sau 2 phút.', 'error');
    }

    // ── CHỦ LÒ: Khai lò ──────────────────────────────────────
    async function danh_luyen_dan_start_api(tier) {
        tier = tier || 'ha';
        var ldToken = await getLdToken();

        // Check có đan đồng chưa
        var state = await getLdState(ldToken);
        _ldInfoCache = getLdInfoFromStateData(state);

        var slots = state.data.dong_slots || [];
        var hasBuddy = slots.some(function (s) { return s && s.userId; });
        if (!hasBuddy) throw new Error('Chưa có đan đồng trong lò, mời đan đồng trước');

        // Khai lò
        await resApi(LD.start, { tier: tier }, { headers: { 'X-Ld-Token': ldToken } });
        showTempAlert('Đã khai lò! Đang lấy thông tin...', 'success');

        // Chờ 5 giây rồi lấy state
        await new Promise(function (r) { setTimeout(r, 5000); });
        var stateAfter = await getLdState(ldToken);
        _ldInfoCache = getLdInfoFromStateData(stateAfter);

        var craft = stateAfter.data && stateAfter.data.craft;
        _ldState = {
            status: 'crafting',
            role: 'owner',
            finishAt: craft ? craft.finish_at_ts : null,
            tier: tier,
            tuneCount: craft ? craft.tune_count : 0,
            tuneSlotsLeft: craft ? craft.tune_huan_slots_left : 0,
            stabilityPct: craft ? craft.stability_pct : undefined,
        };

        // Lưu vào localStorage
        saveTaskData('luyenDan', {
            dangCo: true,
            role: 'owner',
            finishAtTs: craft ? craft.finish_at_ts + 60 * 1000 : null,
        });
        showTempAlert('Lò đã khai! Đan đồng sẽ tự tune.', 'success');
    }

    // ── ĐAN ĐỒNG: Chấp nhận + chờ lò + tune loop ────────────
    async function danh_luyen_dan_dong_api() {
        var ldToken = await getLdToken();
        var state = await getLdState(ldToken);
        _ldInfoCache = getLdInfoFromStateData(state);
        var d = state.data;

        // Nếu đang là đan đồng và có craft đang chạy → resume tune loop
        var craft = d.craft;
        if (craft && craft.status === 'crafting') {
            var tasks = getDailyTasks();
            if (tasks.luyenDan && tasks.luyenDan.role === 'dong') {
                showTempAlert('Tiếp tục tune loop...', 'success');
                _ldState = {
                    status: 'crafting',
                    role: 'dong',
                    finishAt: craft.finish_at_ts,
                    tier: craft.ui_tier,
                    tuneCount: craft.tune_count,
                    tuneSlotsLeft: craft.tune_huan_slots_left,
                    stabilityPct: craft.stability_pct,
                };
                await runLdTuneLoop(ldToken);
                return;
            }
        }

        // Flow bình thường
        if (d.dong_invites_in && d.dong_invites_in.length > 0) {
            var invite = d.dong_invites_in[0];
            showTempAlert('Chấp nhận lời mời từ ' + (invite.owner_name || invite.owner_id) + '...', 'success');
            await resApi(LD.respond, { accept: true, owner_id: invite.owner_id }, { headers: { 'X-Ld-Token': ldToken } });
            showTempAlert('Đã chấp nhận! Chờ chủ lò khai lò...', 'success');
        } else if (d.dong_serving && d.dong_serving.owner_id) {
            showTempAlert('Đang làm đan đồng cho ' + d.dong_serving.owner_name + ', chờ lò...', 'success');
        } else {
            throw new Error('Không có lời mời nào và chưa là đan đồng của ai');
        }

        saveTaskData('luyenDan', { role: 'dong' });

        // Poll chờ chủ lò khai lò (tối đa 10 phút)
        craft = null;
        for (var i = 0; i < 120; i++) {
            await new Promise(function (r) { setTimeout(r, 5000); });
            state = await getLdState(ldToken);
            _ldInfoCache = getLdInfoFromStateData(state);
            craft = state.data && state.data.craft;
            if (craft && craft.status === 'crafting') break;
        }

        if (!craft || craft.status !== 'crafting') {
            throw new Error('Chủ lò chưa khai lò sau 10 phút');
        }

        showTempAlert('Lò đã bắt đầu! Vào tune loop...', 'success');

        _ldState = {
            status: 'crafting',
            role: 'dong',
            stabilityPct: craft.stability_pct,
            finishAt: craft.finish_at_ts,
            tuneCount: craft.tune_count,
            tuneSlotsLeft: craft.tune_huan_slots_left,
            unstableLeft: craft.unstable_left_sec,
            tier: craft.ui_tier,
        };

        await runLdTuneLoop(ldToken);
    }

    //Rời lò 
    async function danh_luyen_dan_leave_api() {
        var ldToken = await getLdToken();
        var ownerId = _ldInfoCache && _ldInfoCache.dongServingOwnerId;
        if (!ownerId) {
            var state = await getLdState(ldToken);
            _ldInfoCache = getLdInfoFromStateData(state);
            ownerId = _ldInfoCache && _ldInfoCache.dongServingOwnerId;
        }
        if (!ownerId) throw new Error('Không lấy được owner_id để leave');
        await resApi(LD.leave, { owner_id: ownerId }, { headers: { 'X-Ld-Token': ldToken } });
        showTempAlert('Đã rời lò!', 'success');
        _ldState = null;
        _ldInfoCache = null;
        saveTaskData('luyenDan', { role: null });
    }


    // ── TUNE LOOP (chỉ đan đồng) ─────────────────────────────
    async function runLdTuneLoop(ldToken) {
        // Giai đoạn 1: tune trong unstable phase
        while (true) {
            var state = await getLdState(ldToken);
            var craft = state.data && state.data.craft;


            if (!craft || craft.status !== 'crafting') {
                showTempAlert('Luyện đan đã kết thúc.', 'success');
                _ldState = null;
                saveTaskData('luyenDan', { role: null });
                return;
            }

            _ldState = {
                status: 'crafting',
                role: 'dong',
                stabilityPct: craft.stability_pct,
                finishAt: craft.finish_at_ts,
                tuneCount: craft.tune_count,
                tuneSlotsLeft: craft.tune_huan_slots_left,
                unstableLeft: craft.unstable_left_sec,
                tier: craft.ui_tier,
            };
            _ldInfoCache = getLdInfoFromStateData(state);
            renderLdInfo();
            updateButtonStates();

            // Hết unstable phase → thoát loop
            if (craft.unstable_left_sec <= 0) {
                showTempAlert('Hết giai đoạn unstable. Chờ 5 phút rồi leave...', 'success');
                danh_luyen_dan_leave_api(); // tự động leave sau khi hết unstable
                break;
            }

            // Tune nếu đủ điều kiện
            if (craft.tune_huan_slots_left > 0
                && craft.tune_cooldown_left_sec <= 0
                && craft.stability_pct <= craft.tune_effective_max_pct) {
                try {
                    await resApi(LD.tune, {}, { headers: { 'X-Ld-Token': ldToken } });
                    var tasks = getDailyTasks();
                    var used = Math.min((tasks.luyenDan.danHuanUsed || 0) + 3, 27);
                    saveTaskData('luyenDan', { danHuanUsed: used });
                    showTempAlert('Đã tune! Stability: ' + craft.stability_pct + '% — Đan Huân: ' + used + '/27', 'success');
                    if (_ldState.tuneCount + 1 >= 3) {
                        showTempAlert('Đã tune đủ ' + tuneSuccessCount + ' lần! Chờ 5 phút rồi leave...', 'success');
                        _ldState.tuneCount = 3;
                        break;
                    }
                } catch (e) {
                    showTempAlert('Tune thất bại: ' + e.message, 'error');
                }
            }

            await new Promise(function (r) { setTimeout(r, 10000); });
        }

        // Giai đoạn 2: chờ (unstable_left_sec + 15s), check mỗi 30s —
        // chỉ gọi state server 1 lần, sau đó dùng cache local để đếm ngược + check leave
        var finalState = await getLdState(ldToken);
        var finalCraft = finalState.data && finalState.data.craft;
        var unstableLeft = finalCraft ? (finalCraft.unstable_left_sec || 0) : 0;

        _ldState = Object.assign({}, _ldState, {
            unstableLeft: unstableLeft,
            stabilityPct: finalCraft ? finalCraft.stability_pct : _ldState.stabilityPct,
        });
        _ldInfoCache = getLdInfoFromStateData(finalState);
        renderLdInfo();
        updateTimerDisplay();

        var waitLeft = unstableLeft + 15; // tổng thời gian chờ trước khi leave
        while (waitLeft > 0) {
            var step = Math.min(30, waitLeft);
            await new Promise(function (r) { setTimeout(r, step * 1000); });
            waitLeft -= step;
            unstableLeft = Math.max(0, unstableLeft - step);
            _ldState = Object.assign({}, _ldState, { unstableLeft: unstableLeft });
            updateTimerDisplay();
        }

        await danh_luyen_dan_leave_api();
        _ldState = null;
        _ldInfoCache = null;
        saveTaskData('luyenDan', { role: null });
    }

    // ── THU ĐAN (chủ lò) ─────────────────────────────────────
    async function danh_luyen_dan_collect_api() {
        var ldToken = await getLdToken();
        var state = await getLdState(ldToken);
        _ldInfoCache = getLdInfoFromStateData(state);

        var craft = state.data && state.data.craft;
        if (!craft || !craft.id) throw new Error('Không có đan đang luyện để thu');

        var res = await resApi(LD.collect, { job_id: craft.id }, { headers: { 'X-Ld-Token': ldToken } });
        showTempAlert(res.message || 'Thu đan thành công!', 'success');

        saveTaskData('luyenDan', { dangCo: false, finishAtTs: null, role: null });
        _ldState = null;
        _ldInfoCache = null;
    }

    // ── PHÂN GIẢI ────────────────────────────────────────────
    async function danh_luyen_dan_decompose_api(pillId) {
        var ldToken = await getLdToken();
        var res = await resApi(LD.decompose, { pill_id: pillId }, { headers: { 'X-Ld-Token': ldToken } });
        showTempAlert(res.message || 'Phân giải thành công!', 'success');
        loadLdPillSelect();
    }

    // ── LOAD PILL SELECT ──────────────────────────────────────
    async function loadLdPillSelect() {
        var select = document.getElementById('ld-pill-select');
        if (!select) return;

        // Nếu đã có cache thì dùng luôn
        if (_ldInfoCache && _ldInfoCache.pillStacks) {
            renderLdPillSelect(_ldInfoCache.pillStacks);
            return;
        }

        // Chưa có cache → gọi API
        var ldToken = await getLdToken();
        var state = await getLdState(ldToken);
        _ldInfoCache = getLdInfoFromStateData(state);
        renderLdPillSelect(_ldInfoCache.pillStacks || []);
    }

    function renderLdPillSelect(stacks) {
        var select = document.getElementById('ld-pill-select');
        if (!select) return;
        var tierLabel = { ha: 'Hạ Phẩm', trung: 'Trung Phẩm', thuong: 'Thượng Phẩm', cuc: 'Cực Phẩm' };
        var starLabel = { 1: '1 sao', 2: '2 sao', 3: '3 sao', 4: '4 sao' };
        select.innerHTML = '<option value="">-- Chọn đan phân giải --</option>';
        if (!stacks.length) {
            select.innerHTML += '<option disabled>Không có đan nào</option>';
            return;
        }
        stacks.forEach(function (stack) {
            var opt = document.createElement('option');
            opt.value = stack.stack_id;
            opt.textContent = (tierLabel[stack.tier] || stack.tier)
                + ' ' + (starLabel[stack.stars] || stack.stars + '★')
                + ' ×' + stack.count;
            select.appendChild(opt);
        });
    }

    // ── LOAD FRIEND SELECT ────────────────────────────────────
    var _ldFriendsCache = null;

    async function loadLdFriendSelect() {
        var select = document.getElementById('ld-friend-select');
        if (!select) return;
        if (_ldFriendsCache) { renderLdFriendSelect(_ldFriendsCache); return; }
        var ldToken = await getLdToken();
        var res = await fetch('https://hoathinh3d.co/wp-json/' + LD.friends, {
            method: 'GET',
            headers: { 'X-WP-Nonce': hh3dData.restNonce, 'X-Ld-Token': ldToken },
            credentials: 'include',
        });
        var data = await res.json();
        if (!data.ok) throw new Error(data.message || 'Lỗi lấy danh sách bạn bè');
        _ldFriendsCache = (data.data && data.data.friends) || [];
        renderLdFriendSelect(_ldFriendsCache);
    }

    function renderLdFriendSelect(friends) {
        var select = document.getElementById('ld-friend-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- Chọn đan đồng --</option>';
        if (!friends.length) {
            select.innerHTML += '<option disabled>Không có bạn bè nào</option>';
            return;
        }
        friends.forEach(function (f) {
            var opt = document.createElement('option');
            opt.value = f.userId;
            opt.textContent = f.name + ' (#' + f.userId + ')';
            select.appendChild(opt);
        });
    }


    //Hàm đánh thí luyện
    async function danh_thi_luyen_api() {
        var tasks = getDailyTasks();
        var currentStage = tasks.thiluyen.currentStage;
        if (tasks.thiluyen.nextTime && Date.now() < tasks.thiluyen.nextTime) {
            var minutesLeft = Math.ceil((tasks.thiluyen.nextTime - Date.now()) / 60000);
            throw new Error(`Chưa đến lượt mở thí luyện, còn ${minutesLeft} phút`);
        }

        var data = await ajax(hh3dData.act.tltmOpen);
        showTempAlert(data.data.message, 'success');
        currentStage += 1;
        var isLastStage = currentStage >= 3;
        if (isLastStage) {
            saveTaskData('thiluyen', { currentStage: 0, done: true, nextTime: null });
            updateButtonStates();
        }
        else {
            var timerData = await ajax(hh3dData.act.tltmTimer);
            var parts = timerData.data.time_remaining.split(':');
            var nextWaitMs = (parseInt(parts[0]) * 60 + parseInt(parts[1])) * 1000;
            saveTaskData('thiluyen', { currentStage: currentStage, done: false, nextTime: Date.now() + nextWaitMs });
        }
    }

    //Hàm check bí cảnh
    async function check_bi_canh_api() {

        var bicanh = getDailyTasks()
        var status = await resApi('tong-mon/v1/get-boss-status', {}, { ignoreSuccess: true });
        var attack_cooldown = await resApi('tong-mon/v1/check-attack-cooldown', {}, { ignoreSuccess: true });
        if (!status.has_boss && status.has_pending_boss && !status.boss_contribution.user_has_contributed) {
            var contribute = await resApi('tong-mon/v1/contribute-boss').catch(() => null);
            if (contribute) showTempAlert(contribute.message, 'success');
            return;
        }
        else if (status.has_boss && bicanh.bicanh.done && attack_cooldown.can_attack) {
            saveTaskData('bicanh', { remainingTurn: 5, done: false, nextTime: null });
            saveTaskData('dailyTasks', { done: false })
            showTempAlert('Đã có lượt đánh mới', 'success')
            startAutoExecute();
            updateButtonStates();
        }
    }

    //Hàm đánh bí cảnh
    async function danh_bi_canh_api() {
        var status = await resApi('tong-mon/v1/get-boss-status', {}, { ignoreSuccess: true });

        // Có thưởng chưa nhận → nhận trước
        if (status.has_pending_reward) {
            var claim = await resApi('tong-mon/v1/claim-boss-reward', {}, { ignoreSuccess: true });
            if (claim.success) saveTaskData('bicanh', { remainingTurn: 5, done: true, nextTime: null });
            showTempAlert(claim.message || 'Đã nhận thưởng bí cảnh', 'success');
        }

        var tasks = getDailyTasks();

        // Chưa đến lượt
        if (tasks.bicanh.nextTime && Date.now() < tasks.bicanh.nextTime) {
            var minutesLeft = Math.ceil((tasks.bicanh.nextTime - Date.now()) / 60000);
            throw new Error('Chưa đến lượt đánh Bí Cảnh, còn ' + minutesLeft + ' phút');
        }

        // Lấy remainingTurn từ local hoặc từ status vừa gọi
        var remainingTurnLocal = tasks.bicanh.remainingTurn;
        if (remainingTurnLocal == null && status.attack_info) {
            remainingTurnLocal = status.attack_info.remaining;
            saveTaskData('bicanh', { remainingTurn: remainingTurnLocal });
        }

        if (remainingTurnLocal <= 0) {
            saveTaskData('bicanh', { done: true, remainingTurn: 0 });
            updateButtonStates();
            throw new Error('Hết lượt đánh Bí Cảnh hôm nay');
        }

        if (!remainingTurnLocal) throw new Error('Không lấy được số lượt đánh, vui lòng kiểm tra lại');

        // Đánh boss
        var bossAttack = await resApi('tong-mon/v1/attack-boss');
        showTempAlert(bossAttack.message, 'success');

        if (bossAttack.attack_info.remaining <= 0) {
            saveTaskData('bicanh', { done: true, remainingTurn: 0, nextTime: null });
            updateButtonStates();
        } else {
            var attackCooldown = await resApi('tong-mon/v1/check-attack-cooldown');
            var nextTimeMs = Date.now() + (attackCooldown.cooldown_remaining * 1000) + 30000;
            saveTaskData('bicanh', {
                remainingTurn: bossAttack.attack_info.remaining,
                nextTime: nextTimeMs
            });
            updateButtonStates();
        }
    }

    //Hàm đánh khoáng mạch
    async function danh_khoang_mach_api() {
        var tokens = await new Promise(function (resolve) {
            var iframe = document.createElement('iframe');
            iframe.src = '/khoang-mach';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            iframe.onload = function () {
                var html = iframe.contentDocument.documentElement.innerHTML;
                var token = iframe.contentWindow.hh3dData.securityToken;

                var el = iframe.contentDocument.querySelector('.stat-item.stat-tuvi');
                var current = 0, max = 1;
                if (el) {
                    var match = el.textContent.match(/(\d+)\s*\/\s*(\d+)/);
                    if (match) { current = parseInt(match[1]); max = parseInt(match[2]); }
                }

                document.body.removeChild(iframe);
                resolve({
                    token: token,
                    list: html.match(/kmList[^}]*security:\s*'([a-f0-0]+)'/s)?.[1],
                    enter: html.match(/kmEnter[^}]*security:\s*'([a-f0-9]+)'/s)?.[1],
                    claim: html.match(/kmClaim[^}]*security:\s*'([a-f0-9]+)'/s)?.[1],
                    tuvi: { current: current, max: max }
                });

            };
        });
        saveTaskData('khoangmach', { tuvi_current: tokens.tuvi.current, tuvi_max: tokens.tuvi.max });
        if (!tokens.token || !tokens.enter || !tokens.claim) {
            showTempAlert('Không lấy được token Khoáng Mạch');
            return;
        }

        // Tu Vi đã đầy
        if (tokens.tuvi.current >= tokens.tuvi.max) {
            showTempAlert('Khoáng Mạch: Tu Vi đã đầy!', 'success');
            saveTaskData('khoangmach', { done: true, is_in: false, nextTime: null });
            updateButtonStates();
            return;
        }

        //Check trong mỏ
        var kmList = await ajax(hh3dData.act.kmList, {
            mine_type: 'silver',
            security: tokens.list
        });
        var currentMine = kmList.data.find(mine => mine.is_current === true);
        if (currentMine) {
            saveTaskData('khoangmach', { is_in: true });
        } else {
            saveTaskData('khoangmach', { is_in: false });
        }

        var tasks = getDailyTasks();
        var isIn = tasks.khoangmach.is_in === true;

        // Đang trong mỏ → thử claim
        if (isIn) {
            var claimData = await ajax(hh3dData.act.kmClaim, {
                mine_id: 59,
                security_token: tokens.token,
                security: tokens.claim
            });

            showTempAlert(claimData.data.message, 'success');
            // Random 4-5 phút tính theo giây
            var randomMs = (240 + Math.floor(Math.random() * 60)) * 1000;
            saveTaskData('khoangmach', { is_in: true, nextTime: Date.now() + randomMs });
            return;
        }

        // Chưa trong mỏ → vào mỏ
        if (tasks.khoangmach.done === false && isIn === false) {
            var enterData = await ajax(hh3dData.act.kmEnter, {
                mine_id: 59,
                security_token: tokens.token,
                security: tokens.enter
            });

            showTempAlert(enterData.data.message, 'success');
            var randomMs2 = (240 + Math.floor(Math.random() * 60)) * 1000;
            saveTaskData('khoangmach', { nextTime: Date.now() + randomMs2, is_in: true });
        }

    }

    //Hàm đánh tiên duyên
    async function danh_tien_duyen_api() {
        var userId = 144860
        var status = await resApi('check_wish_tree_status', {}, { ignoreSuccess: true });
        if (!status.can_wish) {
            showTempAlert(status.message || 'Không thể ước nguyện Tiên Duyên', 'error');
        }
        else {
            var makeWish = await resApi("make_wish_tree");
            showTempAlert(status.message || 'Đã ước nguyện Tiên Duyên', 'success');
        }

        for (var i = 0; i < 3; i++) {
            var giftData = await resApi("gift_to_friend", { friend_id: "144860", gift_type: "hoa_hong", cost_type: "tien_ngoc" });
            showTempAlert(giftData.message + `Đã tặng lần ${i + 1}`, 'success');
            if (i < 2) await new Promise(resolve => setTimeout(resolve, 2000));
        }
        saveTaskData('tienduyen', { done: true });
        updateButtonStates();
    }

    //Hàm đánh chúc phúc
    async function danh_chuc_phuc_api() {
        var listWedding = await resApi('show_all_wedding', { security_token: hh3dData.securityToken });

        if (!listWedding.data || !listWedding.data.length) {
            showTempAlert('Không có phòng cưới nào', 'error');
            return;
        }
        var rooms_has_lixi = listWedding.data.filter(function (room) {
            return room.has_li_xi === true
        });

        var rooms_not_blessed = listWedding.data.filter(function (room) {
            return room.has_blessed === false;
        });

        //Xử lý nhận lì xì
        if (rooms_has_lixi.length > 0) {
            for (var i = 0; i < rooms_has_lixi.length; i++) {
                await new Promise(function (r) { setTimeout(r, 500 + Math.random() * 500); });
                var room = rooms_has_lixi[i];
                try {
                    var res = await resApi('hh3d_receive_li_xi', { wedding_room_id: room.wedding_room_id });
                    showTempAlert(res.message + " khi gửi chúc phúc" || 'Đã nhận lì xì', 'success');
                }
                catch (e) {
                    showTempAlert(e.message || 'Nhận lì xì thất bại', 'error');
                }
            }
        }

        //Xử lý chúc phúc
        if (rooms_not_blessed.length === 0) {
            return;
        }

        var blessMessages = [
            '🌠 Thiên duyên vạn kiếp, hội ngộ giữa hồng trần! Nguyện hai vị đạo hữu đồng tâm tu luyện, phi thăng cửu thiên, trường tồn cùng nhật nguyệt! ✨',
            '🌸 Tân lang tân nương, duyên trời định sẵn! Chúc hai vị trăm năm hạnh phúc, đồng cam cộng khổ, sánh đôi phi thăng cửu thiên! 🌈',
            '🌿 Trải qua ngàn kiếp luân hồi, cuối cùng tương ngộ! Nguyện hai vị đạo hữu tâm ý tương thông, đồng tu đồng tiến, chứng đắc đại đạo! ⚔️'
        ];

        for (var j = 0; j < rooms_not_blessed.length; j++) {
            await new Promise(function (r) { setTimeout(r, 500 + Math.random() * 500); });
            room = rooms_not_blessed[j];
            var randomBless = blessMessages[Math.floor(Math.random() * blessMessages.length)];

            try {
                var endpoint = room.room_type === 'hong_nhan'
                    ? 'https://hoathinh3d.co/wp-json/hh3d/v1/hong-nhan/bless'
                    : 'hh3d_add_blessing';

                res = await resApi(endpoint, {
                    message: randomBless,
                    wedding_room_id: room.wedding_room_id
                });
                showTempAlert(res.message || 'Chúc phúc thành công', 'success');
            } catch (e) {
                showTempAlert(e.message || 'Chúc phúc thất bại', 'error');
                return;
            }
        }
    }

    //Hàm đánh vấn đáp
    async function danh_van_dap_api() {
        var answerMap = await fetch('https://raw.githubusercontent.com/Melios025/hh3d/main/vandap.json')
            .then(r => r.json());

        var vandapData = await ajax(hh3dData.act.vdLoad);
        var questions = vandapData.data.questions;

        // ✅ Tạo một lần bên ngoài vòng lặp
        var normalizedMap = {};
        Object.keys(answerMap).forEach(key => {
            normalizedMap[normalizeText(key)] = answerMap[key];
        });

        for (var i = 0; i < questions.length; i++) {
            var q = questions[i];
            var answer = normalizedMap[normalizeText(q.question)];
            var answerIndex;

            if (!answer) {
                showTempAlert(`Không tìm thấy đáp án: ${q.question}`, 'error');
                answerIndex = await showManualPicker(q.question, q.options);
            } else {
                // ✅ normalize cả option lẫn answer khi so sánh
                answerIndex = q.options.findIndex(opt => normalizeText(opt) === normalizeText(answer));
                if (answerIndex === -1) {
                    showTempAlert(`Đáp án không khớp: ${answer}`, 'error');
                    answerIndex = await showManualPicker(q.question, q.options);
                }
            }

            var result = await ajax(hh3dData.act.vdSave, {
                question_id: q.id,
                answer: answerIndex
            });

            showTempAlert(result.data?.message || `Câu ${i + 1}/${questions.length} đã trả lời`, 'success');

            if (i < questions.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        saveTaskData('vandap', { done: true });
        updateButtonStates();
    }

    //Hàm chọn thủ công vấn đáp
    function showManualPicker(question, options) {
        return new Promise((resolve) => {
            // Tạo overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 999999;
            display: flex; align-items: center; justify-content: center;
        `;

            // Tạo popup
            const popup = document.createElement('div');
            popup.style.cssText = `
            background: #1a1a2e; color: #fff;
            border-radius: 12px; padding: 24px;
            max-width: 500px; width: 90%;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            font-family: Arial, sans-serif;
        `;

            // Tiêu đề
            popup.innerHTML = `
            <div style="color: #ff6b6b; font-size: 13px; margin-bottom: 8px;">
                ⚠️ Không tìm thấy đáp án — Chọn thủ công
            </div>
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 20px; line-height: 1.5;">
                ${normalizeText(question)}
            </div>
        `;

            // 4 đáp án
            options.forEach((opt, index) => {
                const btn = document.createElement('button');
                btn.textContent = `${index + 1}. ${normalizeText(opt)}`;
                btn.style.cssText = `
                display: block; width: 100%;
                padding: 12px 16px; margin-bottom: 10px;
                background: #16213e; color: #fff;
                border: 1px solid #0f3460;
                border-radius: 8px; cursor: pointer;
                font-size: 14px; text-align: left;
                transition: background 0.2s;
            `;
                btn.onmouseover = () => btn.style.background = '#0f3460';
                btn.onmouseout = () => btn.style.background = '#16213e';
                btn.onclick = () => {
                    document.body.removeChild(overlay);
                    resolve(index);
                };
                popup.appendChild(btn);
            });

            overlay.appendChild(popup);
            document.body.appendChild(overlay);
        });
    }

    //Hàm đánh đồ thạch
    async function danh_do_thach_api() {
        const hour = new Date().getHours();

        // [00-06] Dọn trạng thái lượt của ngày hôm trước trước khi ngày mới bắt đầu
        if (hour < 6) {
            await nhan_thuong_do_thach({ silent: true });
            return;
        }

        // [06-13] Lượt 1: nhận thưởng tồn đọng (nếu có) rồi đặt cược
        if (hour < 13) {
            // Nhận thưởng lượt trước nếu còn, không thông báo nếu không trúng
            await nhan_thuong_do_thach({ silent: true });

            // Nếu đã đặt lượt 1 rồi thì dừng, chờ kết quả lúc 13h
            const tasks = getDailyTasks();
            if (tasks.dothach.betplaced) {
                throw new Error('Đã đặt cược lượt 1 hôm nay');
            }

            // Lấy danh sách đá, ưu tiên 2 viên có reward_multiplier cao nhất
            const dothachData = await ajax(hh3dData.act.dtLoad);
            const stones = [...dothachData.data.stones]
                .sort((a, b) => b.reward_multiplier - a.reward_multiplier)
                .slice(0, 2);

            for (const stone of stones) {
                const betData = await ajax(hh3dData.act.dtBet, { stone_id: stone.stone_id, bet_amount: 20 });
                showTempAlert(betData.data.message, 'success');
                // Lưu lần lượt stoneBetted1 rồi stoneBetted2
                const t = getDailyTasks();
                saveTaskData('dothach', t.dothach.stoneBetted1 == null
                    ? { betplaced: true, turn: 1, stoneBetted1: stone.stone_id }
                    : { betplaced: true, turn: 1, stoneBetted2: stone.stone_id }
                );
                updateButtonStates();
            }
            return;
        }

        // [13-16] Giữa 2 lượt: nhận thưởng lượt 1 (thông báo nếu không trúng), reset chuẩn bị lượt 2
        if (hour < 16) {
            // Chỉ gọi nhận thưởng nếu thực sự đã đặt lượt 1
            const tasks = getDailyTasks();
            if (tasks.dothach.betplaced && tasks.dothach.turn === 1) {
                await nhan_thuong_do_thach({ silent: false });
            }
            // Reset sạch, đánh dấu sẵn sàng cho lượt 2
            saveTaskData('dothach', { betplaced: false, stoneBetted1: null, stoneBetted2: null, turn: 2 });
            updateButtonStates();
            showTempAlert('Đã sẵn sàng cho lượt 2 (16h-21h)', 'success');
            return;
        }

        // [16-21] Lượt 2: nhận thưởng tồn đọng (nếu có) rồi đặt cược
        if (hour < 21) {
            // Nhận thưởng lượt 1 hoặc lượt 2 ngày hôm trước nếu còn sót, không thông báo nếu không trúng
            await nhan_thuong_do_thach({ silent: true });
            // Đảm bảo turn = 2 dù trước đó có quên đặt lượt 1 hay không
            saveTaskData('dothach', { turn: 2 });

            // Lấy danh sách đá, ưu tiên 2 viên có reward_multiplier cao nhất
            const dothachData = await ajax(hh3dData.act.dtLoad);
            const stones = [...dothachData.data.stones]
                .sort((a, b) => b.reward_multiplier - a.reward_multiplier)
                .slice(0, 2);

            for (const stone of stones) {
                const betData = await ajax(hh3dData.act.dtBet, { stone_id: stone.stone_id, bet_amount: 20 });
                showTempAlert(betData.data.message, 'success');
                // Lưu lần lượt stoneBetted1 rồi stoneBetted2
                const t = getDailyTasks();
                saveTaskData('dothach', t.dothach.stoneBetted1 == null
                    ? { betplaced: true, turn: 2, stoneBetted1: stone.stone_id }
                    : { betplaced: true, turn: 2, stoneBetted2: stone.stone_id }
                );
                updateButtonStates();
            }
            return;
        }

        // [21-00] Nhận thưởng lượt 2, thông báo nếu không trúng
        await nhan_thuong_do_thach({ silent: false });
    }

    async function nhan_thuong_do_thach({ silent = false } = {}) {
        // Thử nhận thưởng, server tự kiểm tra điều kiện
        const claim = await ajax(hh3dData.act.dtClaim, {}, { ignoreSuccess: true });

        if (claim.success) {
            saveTaskData('dothach', { betplaced: false, stoneBetted1: null, stoneBetted2: null });
            showTempAlert('Đã nhận thưởng', 'success');
            updateButtonStates();
            return;
        }

        // Nhận thưởng thất bại: kiểm tra xem có đặt đúng viên thắng không
        const tasks = getDailyTasks();
        const dothachData = await ajax(hh3dData.act.dtLoad);
        const winningId = dothachData.data.winning_stone_id;
        const didBetWinner = tasks.dothach.stoneBetted1 == winningId || tasks.dothach.stoneBetted2 == winningId;

        // Reset trạng thái bất kể kết quả
        saveTaskData('dothach', { betplaced: false, stoneBetted1: null, stoneBetted2: null });
        updateButtonStates();

        // Chỉ thông báo không trúng ở các khung giờ nhận thưởng chính thức (13-16, 21-00)
        if (!didBetWinner && !silent) {
            throw new Error('Không trúng thưởng lượt này');
        }
    }

    //Hàm nhận thưởng hoạt động ngày
    async function nhan_thuong_hoat_dong_ngay() {
        var tasks = getDailyTasks();
        var prerequisitesDone = tasks.diemdanh?.done && tasks.hoangvuc?.done && tasks.phucloi?.done && tasks.vandap?.done;
        if (!prerequisitesDone) {
            showTempAlert('Chưa đủ điều kiện nhận thưởng hoạt động ngày', 'error');
            return;
        }

        await ajax(hh3dData.act.hdnReward, { stage: 'stage1' }).catch(e => {
            showTempAlert(e.message || 'Lỗi stage1', 'error');
        });
        await ajax(hh3dData.act.hdnReward, { stage: 'stage2' }).catch(e => {
            showTempAlert(e.message || 'Lỗi stage2', 'error');
        });


        for (var i = 0; i < 4; i++) {
            var res = await fetch('https://hoathinh3d.co/wp-json/lottery/v1/' + hh3dData.act.lotterySpin, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': hh3dData.restNonce
                },
                body: JSON.stringify({
                    security_token: hh3dData.securityToken
                })
            }).then(r => r.json());

            if (res.success) {
                showTempAlert('Lần quay ' + (i + 1) + ': ' + res.prize.name, 'success');
                if (i >= 3) {
                    saveTaskData('hdnReward', { done: true });
                    showTempAlert('Đã nhận thưởng hoạt động ngày', 'success');
                }
            } else {
                throw new Error('Quay thưởng thất bại: ' + (res.data?.message || res.message));
            }

            if (i < 3) await new Promise(function (r) { setTimeout(r, 2000); });
        }


    }

    //Update button
    function updateButtonStates() {
        updateAutoToggleButton();
        var tasks = getDailyTasks();

        // Button gộp
        var btn3 = document.getElementById('btn-diemdanh-vandap-tele');
        if (btn3) {
            var allDone = tasks.diemdanh?.done && tasks.tele?.done && tasks.vandap?.done;

            if (!btn3.hasAttribute('data-original-html')) {
                btn3.setAttribute('data-original-html', btn3.innerHTML.trim());
            }
            var originalHtml = btn3.getAttribute('data-original-html');

            btn3.disabled = allDone;
            btn3.innerHTML = allDone
                ? originalHtml + ' <i class="fa-solid fa-circle-check" style="color: #979696;"></i>'
                : originalHtml;
        }

        // Các button thường
        var keys = ['tienduyen', 'dothach'];
        keys.forEach(function (key) {
            var btn = document.getElementById('btn-' + key);
            if (btn) {
                var t = tasks[key] || {};
                var isDone = t.done === true;

                if (!btn.hasAttribute('data-original-html')) {
                    btn.setAttribute('data-original-html', btn.innerHTML.trim());
                }
                var originalHtml = btn.getAttribute('data-original-html');

                btn.disabled = isDone;
                btn.innerHTML = isDone
                    ? originalHtml + ' <i class="fa-solid fa-circle-check" style="color: #979696;"></i>'
                    : originalHtml;
            }
        });

        // Progress buttons
        var progressItems = [
            {
                key: 'hoangvuc',
                label: 'Hoang Vực',
                icon: 'fa-solid fa-dragon',
                getProgress: function (t) {
                    var done = 5 - (t.remainingTurn ?? 5);
                    return { done, max: 5 };
                }
            },
            {
                key: 'thiluyen',
                label: 'Thí Luyện',
                icon: 'fa-solid fa-shield-halved',
                getProgress: function (t) {
                    return { done: t.currentStage ?? 0, max: 3 };
                }
            },
            {
                key: 'phucloi',
                label: 'Phúc Lợi',
                icon: 'fa-solid fa-gift',
                getProgress: function (t) {
                    return { done: (t.currentChest ?? 1) - 1, max: 4 };
                }
            },
            {
                key: 'bicanh',
                label: 'Bí Cảnh',
                icon: 'fa-solid fa-map',
                getProgress: function (t) {
                    var remaining = t.remainingTurn ?? 5;
                    return { done: 5 - remaining, max: 5 };
                }
            },
            {
                key: 'khoangmach',
                label: 'Khoáng Mạch',
                icon: 'fa-solid fa-gem',
                getProgress: function (t) {
                    return { done: t.tuvi_current ?? 0, max: t.tuvi_max ?? 1 };
                }
            },
        ];

        progressItems.forEach(function (item) {
            var btn = document.getElementById('btn-' + item.key);
            if (!btn) return;

            var t = tasks[item.key] || {};
            var isDone = t.done === true;
            var p = item.getProgress(t);
            var pct = Math.min(100, Math.round((p.done / p.max) * 100));

            btn.disabled = isDone;
            btn.innerHTML = `<div class="btn-progress" style="width:${pct}%"></div><span class="btn-label"><i class="${item.icon}"></i> ${item.label}${isDone ? ' <i class="fa-solid fa-circle-check" style="color: #979696;"></i>' : ''}</span>`;
        });

        // Button Mê Cung
        var btnMecung = document.getElementById('btn-mecung');
        if (btnMecung) {
            if (!btnMecung.hasAttribute('data-original-html')) {
                btnMecung.setAttribute('data-original-html', btnMecung.innerHTML.trim());
            }
            var originalHtml = btnMecung.getAttribute('data-original-html');

            var mc = tasks.mecung || { huyen_tinh_daily_total: 0, huyen_tinh_daily_cap: 200 };
            var current = mc.huyen_tinh_daily_total ?? 0;
            var max = mc.huyen_tinh_daily_cap ?? 200;

            btnMecung.innerHTML = originalHtml.replace(
                '<span>Mê Cung</span>',
                `<span>Mê Cung (${current}/${max})</span>`
            );
            if (current >= max) {
                btnMecung.classList.add('mc-full');
            } else {
                btnMecung.classList.remove('mc-full');
            }
        }

        // Luyện Đan - render info box
        renderLdInfo();

        // Button Thu Đan (Luyện Đan)
        var btnLdCollect = document.getElementById('btn-ld-collect');
        if (btnLdCollect) {
            if (_ldState && _ldState.finishAt) {
                var now = Math.floor(Date.now() / 1000);
                btnLdCollect.disabled = now < _ldState.finishAt;
            } else {
                var ld = tasks.luyenDan;
                if (ld && ld.dangCo && ld.finishAtTs) {
                    var now = Math.floor(Date.now() / 1000);
                    btnLdCollect.disabled = now < ld.finishAtTs;
                } else {
                    btnLdCollect.disabled = true;
                }
            }
        }

        // Button Rời Lò (Luyện Đan - chỉ đan đồng sau 5 phút)
        var btnLdLeave = document.getElementById('btn-ld-leave');
        if (btnLdLeave) {
            var craft = _ldInfoCache && _ldInfoCache.craft;
            var isDong = _ldInfoCache && !!_ldInfoCache.dongServingOwnerName;

            var canLeave = false;
            if (isDong && craft) {
                if (craft.status === 'ready') {
                    canLeave = true; // lò đã xong, đan đồng có thể rời bất cứ lúc nào
                } else if (craft.status === 'crafting'
                    && craft.duration_sec !== undefined && craft.timer_left_sec !== undefined) {
                    var elapsed = craft.duration_sec - craft.timer_left_sec;
                    if (elapsed >= 5 * 60) canLeave = true;
                }
            }
            btnLdLeave.disabled = !canLeave;
        }
    }

    //Tạo nút menu
    function createAutoMenuButton() {
        if (document.getElementById('open-auto-menu')) return;

        var navItems = document.querySelector('.nav-items');
        if (!navItems) return;

        var notifDiv = navItems.querySelector('.load-notification');
        if (!notifDiv) return;

        var wrapper = document.createElement('div');
        wrapper.className = 'load-notification relative';
        wrapper.style.cssText = 'position:relative;';
        wrapper.innerHTML = `
        <a href="#" id="open-auto-menu" data-view="hide">
            <div><i class="fa-solid fa-robot"></i></div>
            <span class="nav-label">Auto</span>
        </a>
    `;

        if (notifDiv.nextSibling) {
            navItems.insertBefore(wrapper, notifDiv.nextSibling);
        } else {
            navItems.appendChild(wrapper);
        }

        // Khai báo style ở đây
        var style = document.createElement('style');
        style.textContent = `
        #open-auto-menu, #open-auto-menu * {
            font-size: 12px;
            -webkit-tap-highlight-color: rgba(0,0,0,0);
            color: var(--text, hsla(0,0%,100%,.9));
            text-decoration: none;
        }
        .load-notification.relative #open-auto-menu {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 6px 8px;
            border-radius: 8px;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.12);
            transition: background 200ms ease, transform 200ms ease;
        }
        .load-notification.relative #open-auto-menu:hover {
            background: rgba(255,255,255,0.16);
            transform: translateY(-1px);
        }
        .load-notification.relative #open-auto-menu .nav-label {
            font-size: 12px;
            line-height: 1;
        }
    `;
        var menuBtn = document.getElementById('open-auto-menu');
        wrapper = menuBtn.closest('.load-notification');
        document.head.appendChild(style);

        wrapper.addEventListener('click', function (event) {
            var menuBtn = document.getElementById('open-auto-menu');
            if (!menuBtn.contains(event.target)) return; // click vào panel/button → bỏ qua

            event.preventDefault();
            event.stopPropagation();
            toggleControlPanel();
        });
    }

    //Bật tắt bảng điều khiển
    function toggleControlPanel() {
        createControlPanel();
        var panel = document.getElementById('auto-control-panel');
        if (!panel) return;

        var isVisible = panel.style.display === 'block';
        if (isVisible) {
            panel.style.display = 'none';
        } else {
            panel.style.display = 'block';
            updateButtonStates();
        }

        var button = document.getElementById('open-auto-menu');
        if (button) button.setAttribute('aria-expanded', String(!isVisible));
    }

    //Tạo bảng điều khiển
    function createControlPanel() {
        if (document.getElementById('auto-control-panel')) return;

        var menuBtn = document.getElementById('open-auto-menu');
        if (!menuBtn) return;
        var wrapper = menuBtn.closest('.load-notification');
        if (!wrapper) return;

        var panel = document.createElement('div');
        panel.id = 'auto-control-panel';
        panel.innerHTML = `
   <div class="panel-header">
        <span>Auto Menu</span>
        <span class="panel-version">${SCRIPT_VERSION}</span>
   </div>
    <div class="panel-body">

        <div class="panel-row">
            <button id="btn-diemdanh-vandap-tele" class="panel-btn panel-btn-full">
                <i class="fa-solid fa-calendar-check"></i> Điểm Danh - Tế lễ - Vấn đáp
            </button>
            <button id="btn-auto-toggle" class="panel-btn btn-auto-toggle"></button>
            <button id="btn-setting" class="panel-btn btn-auto-toggle"><i class="fa-solid fa-gear"></i></button>
        </div>

        <div class="panel-row">
            <button id="btn-hoangvuc" class="panel-btn"><i class="fa-solid fa-dragon"></i> Hoàng Vực</button>
            <button id="btn-thiluyen" class="panel-btn"><i class="fa-solid fa-shield-halved"></i> Thí Luyện</button>
        </div>

        <div class="panel-row">
            <button id="btn-phucloi" class="panel-btn"><i class="fa-solid fa-gift"></i> Phúc Lợi</button>
            <button id="btn-bicanh" class="panel-btn"><i class="fa-solid fa-map"></i> Bí Cảnh</button>
        </div>
            <!-- Mê Cung -->
        <div id="mecung-wrapper" class="expandable-wrapper">
            <button id="btn-mecung" class="panel-btn panel-btn-full expandable-btn">
                <i class="fa-solid fa-dungeon"></i>
                <span>Mê Cung</span>
                <i class="fa-solid fa-chevron-down expandable-chevron"></i>
            </button>
            <div id="mecung-input-row" class="expandable-dropdown hidden">
                <input id="mecung-invite-input" type="text" placeholder="Nhập link hoặc token mời..." />
                <button id="btn-mecung-start" class="panel-btn btn-auto-toggle">
                    <i class="fa-solid fa-play"></i>
                </button>
            </div>
        </div>

        <!-- Luyện Đan -->
        <div id="luyen-dan-wrapper" class="expandable-wrapper">
            <button id="btn-luyen-dan" class="panel-btn panel-btn-full expandable-btn">
                <i class="fa-solid fa-fire-flame-curved"></i>
                <span>Luyện Đan</span>
                <i class="fa-solid fa-chevron-down expandable-chevron"></i>
            </button>
            <div id="luyen-dan-dropdown" class="expandable-dropdown hidden" style="flex-direction: column; align-items: stretch;">

                <!-- Thông tin đan đồng / chủ lò hiện tại -->
                <div id="ld-info-box" class="ld-info-box">
                    <span class="ld-info-hint">Đang tải...</span>
                </div>

                <!-- Chủ lò: chọn đan đồng + khai lò -->
                <div class="ld-section-title"><i class="fa-solid fa-crown"></i> Chủ lò</div>
                <div class="ld-row">
                    <select id="ld-friend-select" class="panel-select"></select>
                    <button id="btn-ld-invite" class="panel-btn btn-auto-toggle" title="Mời đan đồng">
                        <i class="fa-solid fa-user-plus"></i>
                    </button>
                </div>
                <div class="ld-row">
                    <select id="ld-tier-select" class="panel-select">
                        <option value="ha">Hạ Phẩm Đan</option>
                        <option value="trung" disabled>Trung Phẩm Đan</option>
                        <option value="thuong" disabled>Thượng Phẩm Đan</option>
                        <option value="cuc" disabled>Cực Phẩm Đan</option>
                    </select>
                    <button id="btn-ld-start" class="panel-btn panel-btn-full" style="background: linear-gradient(135deg, #ea580c 0%, #b45309 100%); box-shadow: 0 8px 18px rgba(234, 88, 12, 0.3);">
                <i class="fa-solid fa-fire"></i> Khai Lò
                </button>
                </div>
                <button id="btn-ld-collect" class="panel-btn panel-btn-full">
                    <i class="fa-solid fa-hand-sparkles"></i> Thu Đan
                </button>

                <!-- Đan đồng: chấp nhận + bắt đầu tune -->
               <div class="ld-section-title"><i class="fa-solid fa-user-group"></i> Đan đồng</div>
                <button id="btn-ld-respond" class="panel-btn panel-btn-full">
                <i class="fa-solid fa-handshake"></i> Chấp Nhận & Chờ Tune
            </button>
            <button id="btn-ld-leave" class="panel-btn panel-btn-full" disabled>
    <i class="fa-solid fa-door-open"></i> Rời Lò
</button>

                <!-- Phân giải đan -->
                <div class="ld-section-title"><i class="fa-solid fa-scissors"></i> Phân giải</div>
                <div class="ld-row">
                    <select id="ld-pill-select" class="panel-select">
                        <option value="">-- Chọn đan phân giải --</option>
                    </select>
                    <button id="btn-ld-decompose" class="panel-btn btn-auto-toggle" title="Phân giải đan">
                        <i class="fa-solid fa-scissors"></i>
                    </button>
                </div>
            </div>
        </div>

        <button id="btn-khoangmach" class="panel-btn panel-btn-full"><i class="fa-solid fa-gem"></i> Khoáng Mạch</button>

        <div class="panel-row">
            <button id="btn-tienduyen" class="panel-btn"><i class="fa-solid fa-heart"></i> Tiên Duyên</button>
            <button id="btn-chucphuc" class="panel-btn"><i class="fa-solid fa-star"></i> Chúc Phúc</button>
        </div>

        <button id="btn-dothach" class="panel-btn panel-btn-full"><i class="fa-solid fa-dice-d6"></i> Đồ Thạch</button>

        <button id="btn-banghoatdong" class="panel-btn panel-btn-full" onclick="window.open('https://hoathinh3d.co/nhiem-vu-hang-ngay', '_blank')">
            <i class="fa-solid fa-list-check"></i> Bảng hoạt động ngày
        </button>
        <!-- Timer -->
        <div id="timer-display">
            <div class="timer-row">
                <span>Hoàng Vực</span>
                <span style="color:#4ade80;">Ready</span>
            </div>
            <div class="timer-row">
                <span>Phúc Lợi</span>
                <span>12p 30s</span>
            </div>
        </div>
        <div id="settings-panel" class="settings-panel hidden"></div>
    </div>
`;

        panel.style.cssText = 'display:none;';

        var style = document.createElement('style');
        style.textContent = `
        #auto-control-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    left: auto;
    bottom: auto;
    width: min(400px, calc(100vw - 20px));
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    z-index: 999999;
    background: rgba(20, 20, 20, 0.95);
    color: #fff;
    border-radius: 14px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
    font-family: Arial, sans-serif;
    line-height: 1.4;
    padding: 20px;
    padding-top: 0;
}

        /* ===== HEADER ===== */
        #auto-control-panel .panel-header {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 18px;
            font-weight: bold;
            color: #60a5fa;
            margin-bottom: 12px;
            margin-top: 12px;
        }
        #auto-control-panel .panel-version {
            position: absolute;
            right: 0;
            font-size: 10px;
            font-weight: 700;
            color: #eeeeee;
            border: 1px solid rgba(255, 255, 255, 0.9);
            border-radius: 20px;
            padding: 2px 9px;
            letter-spacing: .04em;
        }

        /* ===== BODY ===== */
        #auto-control-panel .panel-body {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 4px;
            padding: 0;
        }

        /* ===== ROWS ===== */
        #auto-control-panel .panel-row {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        /* ===== BUTTONS ===== */
        #auto-control-panel .panel-btn {
            position: relative;
            overflow: hidden;
            width: 100%;
            margin: 0;
            padding-top: 10px;
            padding-bottom: 10px;
            border: none;
            border-radius: 12px;
            background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
            color: #ffffff;
            box-shadow: 0 8px 18px rgba(59, 130, 246, 0.25);
            cursor: pointer;
            transition: transform 180ms ease, opacity 200ms ease, background 200ms ease;
            font-size: 16px;
            justify-content: center;
            text-align: center;
            font-weight: bold;
        }
        #auto-control-panel .btn-progress {
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            background: rgba(255, 255, 255, 0.15);
            transition: width 300ms ease;
            z-index: 0;
            border-radius: 12px;
        }
        #auto-control-panel .btn-label {
            position: relative;
            z-index: 1;
        }
        #auto-control-panel #btn-banghoatdong {
            background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
        }
        #auto-control-panel #btn-banghoatdong:hover:not(:disabled) {
            background: linear-gradient(135deg, #dc2626 0%, #f97316 100%);
        }
        #auto-control-panel .panel-btn-full {
            width: 100%;
            display: block;
            margin: 0;
        }
        #auto-control-panel #btn-auto-toggle,
        #auto-control-panel .btn-auto-toggle {
            width: 30px;
            min-width: 30px;
            height: 30px;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 5px;
            background: rgba(255, 255, 255, 0.08);
        }
        #auto-control-panel #btn-auto-toggle:hover:not(:disabled),
        #auto-control-panel #btn-setting:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.16);
            transform: none;
            box-shadow: none;
        }
        #auto-control-panel .panel-btn:hover:not(:disabled) {
            background: linear-gradient(135deg, #f07373 0%, #f13e3e 100%);
            transform: scale(1.03);
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
            transition: all 0.2s ease;
        }
        #auto-control-panel .panel-btn:disabled {
            background: linear-gradient(135deg, #3d3d3d 0%, #8f8f8f 100%);
            color: #979696;
            cursor: not-allowed;
            opacity: 0.9;
        }
        #auto-control-panel .panel-btn.mc-full {
            background: linear-gradient(135deg, #3d3d3d 0%, #8f8f8f 100%);
            color: #979696;
            opacity: 0.9;
            cursor: pointer;
        }
        #auto-control-panel .panel-btn.done {
            background: #16a34a;
        }

        /* ===== LUYỆN ĐAN — INFO BOX ===== */
        #auto-control-panel .ld-info-box {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 10px 12px;
            font-size: 14px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        #auto-control-panel .ld-info-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }
        #auto-control-panel .ld-info-label {
            color: #94a3b8;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            white-space: nowrap;
        }
        #auto-control-panel .ld-info-label i {
            width: 14px;
            text-align: center;
            opacity: 0.8;
        }
        #auto-control-panel .ld-info-val {
            color: #e2e8f0;
            font-weight: 600;
            font-size: 13px;
            text-align: right;
        }
        #auto-control-panel .ld-info-hint {
            color: #64748b;
            font-size: 13px;
            font-style: italic;
        }

        /* ===== LUYỆN ĐAN — SECTION TITLE ===== */
        #auto-control-panel .ld-section-title {
            font-size: 12px;
            font-weight: 700;
            color: #7dd3fc;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            padding: 4px 2px 2px;
            display: flex;
            align-items: center;
            gap: 6px;
            opacity: 0.85;
        }

        /* ===== LUYỆN ĐAN — DONG START BUTTON ===== */
        #auto-control-panel .ld-dong-start-btn {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            box-shadow: 0 4px 14px rgba(34, 197, 94, 0.25);
        }
        #auto-control-panel .ld-dong-start-btn:hover:not(:disabled) {
            background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
            box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
        }

        /* ===== SETTINGS PANEL ===== */
        #auto-control-panel .settings-panel {
            display: none;
            padding: 10px;
            background: rgba(15, 15, 20, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 14px;
            margin-top: 10px;
        }
        #auto-control-panel .settings-panel.visible {
            display: block;
        }
        #auto-control-panel .settings-header {
            margin-bottom: 8px;
            color: #cbd5e1;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }
        #auto-control-panel .settings-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.04);
            color: #e2e8f0;
            cursor: pointer;
            transition: background 160ms ease;
            user-select: none;
        }
        #auto-control-panel .settings-item:hover {
            background: rgba(255, 255, 255, 0.08);
        }
        #auto-control-panel .settings-checkbox-input {
            width: 18px;
            height: 18px;
            margin-right: 10px;
            accent-color: #4ade80;
            cursor: pointer;
        }
        #auto-control-panel .settings-label {
            flex: 1;
            font-size: 14px;
        }

        /* ===== EXPANDABLE WRAPPER (dùng chung cho Mê Cung & Luyện Đan) ===== */
        #auto-control-panel .expandable-wrapper {
            border-radius: 14px;
            border: 1px solid rgba(var(--accent-rgb), 0.3);
        }

        #auto-control-panel .expandable-btn {
            position: relative;
        }       

        #auto-control-panel .expandable-chevron {
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 12px;
            opacity: 0.6;
            transition: transform 0.2s ease;
        }

        #auto-control-panel .expandable-btn.expanded .expandable-chevron {
            transform: translateY(-50%) rotate(180deg);
        }
        #auto-control-panel .expandable-dropdown {
            display: flex;
            align-items: center;
            padding: 10px;
            background: rgba(0, 0, 0, 0.2);
            gap: 8px;
            border-radius: 0 0 14px 14px;
        }

        #auto-control-panel .expandable-dropdown.hidden { display: none; }
        #auto-control-panel .ld-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* ===== MÊ CUNG INPUT ===== */
        #mecung-invite-input {
            flex: 1;
            padding: 9px 12px;
            border-radius: 8px;
            border: 1px solid rgba(116, 113, 126, 0.3);
            background: rgba(255, 255, 255, 0.06);
            color: #e2e8f0;
            font-size: 13px;
            outline: none;
        }
        #mecung-invite-input::placeholder {
            color: rgba(255,255,255,0.3);
            font-size: 12px;
        }
        #mecung-invite-input:focus {
            border-color: rgba(209, 209, 216, 0.7);
            background: rgba(255, 255, 255, 0.09);
        }

        /* ===== SELECT ===== */
        #auto-control-panel .panel-select {
            flex: 1;
            padding: 14px;
            border-radius: 12px;
            border: none;
            background: #374151;
            color: #fff;
            font-size: 16px;
            cursor: pointer;
        }

        /* ===== LINKS ===== */
        a {
            text-decoration: none;
        }

        /* ===== TIMER ===== */
        #auto-control-panel #timer-display {
            background: rgba(0, 0, 0, 0.3);
            padding: 10px;
            border-radius: 12px;
            margin-top: 4px;
            font-size: 16px;
            text-align: center;
        }
        #auto-control-panel .timer-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
        }
        #auto-control-panel .timer-row span:first-child {
            color: #aaa;
        }
`;

        document.head.appendChild(style);
        wrapper.appendChild(panel);

        document.getElementById('btn-diemdanh-vandap-tele').addEventListener('click', async function () {
            if (this.disabled) return;
            var tasks = getDailyTasks();
            if (!tasks.diemdanh.done) await runTask(danh_diem_danh_api);
            if (!tasks.tele.done) await runTask(danh_tele_tong_mon_api);
            if (!tasks.vandap.done) await runTask(danh_van_dap_api);
        });
        document.getElementById('btn-setting').addEventListener('click', toggleSettingsPanel);
        document.getElementById('btn-auto-toggle').addEventListener('click', function () {
            var setting = getUserSetting();
            setting.autoRun = !setting.autoRun;
            localStorage.setItem('userSetting', JSON.stringify(setting));
            updateAutoToggleButton();
            if (setting.autoRun) {
                startAutoExecute();
                showTempAlert('Auto đã bật', 'success');
            } else {
                stopAutoExecute();
                showTempAlert('Auto đã tắt', 'error');
            }
        });

        document.getElementById('btn-mecung').addEventListener('click', function () {
            var row = document.getElementById('mecung-input-row');
            row.classList.toggle('hidden');
            this.classList.toggle('expanded');
            if (!row.classList.contains('hidden')) {
                document.getElementById('mecung-invite-input').focus();
            }
        });
        document.getElementById('btn-mecung-start').addEventListener('click', async function () {
            var input = document.getElementById('mecung-invite-input').value.trim();
            document.getElementById('mecung-input-row').classList.add('hidden');
            document.getElementById('btn-mecung').classList.remove('expanded');
            var fn = function danh_me_cung() {
                return danh_me_cung_api(input);
            };
            runTask(fn);
        });
        document.getElementById('btn-hoangvuc').addEventListener('click', function () {
            if (!this.disabled) runTask(danh_hoang_vuc_api);
        });
        document.getElementById('btn-thiluyen').addEventListener('click', function () {
            if (!this.disabled) runTask(danh_thi_luyen_api);
        });
        document.getElementById('btn-phucloi').addEventListener('click', function () {
            if (!this.disabled) runTask(danh_phuc_loi_api);
        });
        document.getElementById('btn-bicanh').addEventListener('click', function () {
            if (!this.disabled) runTask(danh_bi_canh_api);
        });
        document.getElementById('btn-khoangmach').addEventListener('click', function () {
            if (!this.disabled) runTask(danh_khoang_mach_api);
        });
        document.getElementById('btn-tienduyen').addEventListener('click', function () {
            if (!this.disabled) runTask(danh_tien_duyen_api);
        });
        document.getElementById('btn-chucphuc').addEventListener('click', function () {
            if (!this.disabled) runTask(danh_chuc_phuc_api);
        });
        document.getElementById('btn-dothach').addEventListener('click', function () {
            if (!this.disabled) runTask(danh_do_thach_api);
        });

        // ── Luyện Đan dropdown toggle ──────────────────────────────
        document.getElementById('btn-luyen-dan').addEventListener('click', function () {
            var dropdown = document.getElementById('luyen-dan-dropdown');
            var wasHidden = dropdown.classList.contains('hidden');
            dropdown.classList.toggle('hidden');
            this.classList.toggle('expanded');

            if (wasHidden) {
                renderLdInfo(); // render cache ngay
                if (!_ldInfoCache) {
                    // Chỉ gọi API lần đầu khi chưa có cache
                    loadLdPillSelect(); // bên trong cập nhật _ldInfoCache
                } else {
                    loadLdPillSelect(); // chỉ load pill select, không gọi state nữa
                }
                loadLdFriendSelect();
            }
        });

        // ── Chủ lò: mời đan đồng (chỉ mời, chưa khai lò) ─────────
        document.getElementById('btn-ld-invite').addEventListener('click', function () {
            var buddyId = document.getElementById('ld-friend-select').value;
            if (!buddyId) { showTempAlert('Vui lòng chọn đan đồng', 'error'); return; }
            var fn = function danh_ld_invite() {
                return danh_luyen_dan_invite_api(buddyId);
            };
            runTask(fn);
        });

        // ── Chủ lò: khai lò (mời + đợi accept + start) ────────────
        document.getElementById('btn-ld-start').addEventListener('click', function () {
            var tier = document.getElementById('ld-tier-select').value;
            var fn = function danh_luyen_dan_start() {
                return danh_luyen_dan_start_api(tier);
            };
            runTask(fn);
        });

        // ── Đan đồng: chấp nhận lời mời ───────────────────────────
        document.getElementById('btn-ld-respond').addEventListener('click', function () {
            runTask(danh_luyen_dan_dong_api);
        });

        //Rời lò cho đan đồng
        document.getElementById('btn-ld-leave').addEventListener('click', function () {
            var fn = function danh_ld_leave() {
                return danh_luyen_dan_leave_api();
            };
            runTask(fn);
        });
        // ── Chủ lò: thu đan ────────────────────────────────────────
        document.getElementById('btn-ld-collect').addEventListener('click', function () {
            if (this.disabled) return;
            runTask(danh_luyen_dan_collect_api);
        });

        // ── Phân giải đan ──────────────────────────────────────────
        document.getElementById('btn-ld-decompose').addEventListener('click', function () {
            var pillId = document.getElementById('ld-pill-select').value;
            if (!pillId) { showTempAlert('Chọn đan cần phân giải', 'error'); return; }
            var fn = function danh_luyen_dan_decompose() {
                return danh_luyen_dan_decompose_api(pillId);
            };
            runTask(fn);
        });
    }

    //  INJECT CSS cho Settings Panel
    function injectSettingsPanelStyles() {
        if (document.getElementById('settings-panel-style')) return;
        var style = document.createElement('style');
        style.id = 'settings-panel-style';
        style.textContent = `
        /* ===== SETTINGS PANEL OVERLAY ===== */
        #settings-panel-overlay {
            position: fixed;
            inset: 0;
            z-index: 1000000;
            background: rgba(0,0,0,0.55);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: sp-fadein 180ms ease;
        }
        @keyframes sp-fadein {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
 
        /* ===== PANEL BOX ===== */
        #settings-panel-box {
            width: 400px;
            max-height: 90vh;
            background: linear-gradient(160deg, #111010, #0f1120);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 18px;
            padding: 14px;
            box-shadow: 0 28px 70px rgba(0,0,0,.65), 0 0 0 1px rgba(99,102,241,.08);
            display: flex;
            flex-direction: column;
            gap: 10px;
            animation: sp-slidein 200ms ease;
            overflow: hidden;
        }
        @keyframes sp-slidein {
            from { opacity: 0; transform: translateY(10px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
        }
 
        /* ===== PANEL HEADER ===== */
        #settings-panel-box .sp-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.07);
            flex-shrink: 0;
        }
        #settings-panel-box .sp-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: .05em;
            color: #fff;
        }
        #settings-panel-box .sp-title i { color: #ffffff; font-size: 15px; }
        #settings-panel-box .sp-badge {
            font-size: 10px;
            font-weight: 700;
            color: #eeeeee;
            border: 1px solid rgba(255, 255, 255, 0.9);
            border-radius: 20px;
            padding: 2px 9px;
            letter-spacing: .04em;
        }
        #settings-panel-box .sp-close {
            background: rgba(255,255,255,0.06);
            border: none;
            color: #64748b;
            width: 26px;
            height: 26px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            transition: background 150ms, color 150ms;
        }
        #settings-panel-box .sp-close:hover { background: rgba(255,255,255,0.12); color: #e2e8f0; }
 
        /* ===== TABS ===== */
        #settings-panel-box .sp-tabs {
            display: flex;
            gap: 6px;
            flex-shrink: 0;
        }
        #settings-panel-box .sp-tab-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 7px 4px;
            border-radius: 7px;
            background: rgba(255,255,255,.08); 
            color: #e2e8f0;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 150ms, color 150ms, border-color 150ms;
            border-width: 0px;
        }
        #settings-panel-box .sp-tab-btn i { font-size: 16px; }
        #settings-panel-box .sp-tab-btn:hover { background: linear-gradient(135deg, #3d3d3d 0%, #8f8f8f 100%); color: #979696; }
        #settings-panel-box .sp-tab-btn.active {
            background: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
            color: #ffffff;
        }
 
        /* ===== TAB CONTENT ===== */
        #settings-panel-box .sp-tab-content { display: none; overflow: hidden; }
        #settings-panel-box .sp-tab-content.active {
            display: flex;
            flex-direction: column;
            gap: 8px;
            animation: sp-tab-fadein 180ms ease;
        }
        @keyframes sp-tab-fadein {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
        }
 
        /* ===== SCROLL ===== */
        #settings-panel-box .sp-scroll {
            max-height: 380px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-right: 2px;
        }
        #settings-panel-box .sp-scroll::-webkit-scrollbar { width: 3px; }
        #settings-panel-box .sp-scroll::-webkit-scrollbar-track { background: transparent; }
        #settings-panel-box .sp-scroll::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,.08);
            border-radius: 4px;
        }
 
        /* ===== SECTION ===== */
        #settings-panel-box .sp-section {
            padding: 10px;
            background: rgba(255,255,255,0.028);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 11px;
        }
        #settings-panel-box .sp-section-title {
            font-size: 12px;
            font-weight: 700;
            color: #accaee;
            text-transform: uppercase;
            letter-spacing: .09em;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        #settings-panel-box .sp-section-title i { font-size: 11px; opacity: .9; }
 
        /* ===== ITEMS ===== */
        #settings-panel-box .sp-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 4px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 120ms;
            margin-bottom: 3px;
        }
        #settings-panel-box .sp-item:last-child { margin-bottom: 0; }
        #settings-panel-box .sp-item:hover { background: rgba(255,255,255,.04); }
 
        /* ===== CHECKBOX ===== */
        #settings-panel-box .sp-checkbox {
            -webkit-appearance: none;
            appearance: none;
            width: 15px;
            height: 15px;
            flex-shrink: 0;
            border: 1.5px solid #361313d5;;
            border-radius: 4px;
            background: #474646;
            cursor: pointer;
            position: relative;
            transition: background 150ms, border-color 150ms;
        }
        #settings-panel-box .sp-checkbox:checked {
            background: #474646;
            border-color: #361313d5;
        }
        #settings-panel-box .sp-checkbox:checked::after {
            content: '';
            position: absolute;
            left: 4px;
            top: 1.5px;
            width: 4px;
            height: 8px;
            border: 1.5px solid #fff;
            border-top: none;
            border-left: none;
            transform: rotate(45deg);
        }
        #settings-panel-box .sp-label {
            font-size: 16px;
            color: #94a3b8;
            flex: 1;
            display: flex;
            align-items: center;
            font-weight: bold;
            gap: 15px;
        }
        #settings-panel-box .sp-label i {
            font-size: 16px;
            color: #ccc5c5;
            width: 14px;
            height: 14px;
            text-align: center;
            flex-shrink: 0;
        }
 
        /* ===== INPUT ROW ===== */
        #settings-panel-box .sp-input-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            padding: 3px 4px;
            margin-bottom: 3px;
        }
        #settings-panel-box .sp-input-row:last-child { margin-bottom: 0; }
 
        #settings-panel-box .sp-field {
            background: rgba(255,255,255,.07);
            border: 1px solid rgba(255,255,255,.1);
            border-radius: 4px;
            color: #f1f5f9;
            font-size: 16px;
            font-weight: 600;
            padding: 5px 5px;
            text-align: center;
            outline: none;
            transition: border-color 150ms, background 150ms;
        }
        #settings-panel-box .sp-field:focus {
            border-color: #161616;
            background: rgba(255,255,255,.07);
        }
        #settings-panel-box .sp-field[type="time"]   { width: 150px; font-size: 12px; }
        #settings-panel-box .sp-field[type="number"] { width: 150px; font-size: 12px; }
        #settings-panel-box .sp-field[type="text"]   { width: 150px; font-size: 12px; }
 
        /* ===== SAVE BUTTON ===== */
        #settings-panel-box .sp-save-btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 9px;
            border: none;
            border-radius: 7px;
            background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
            color: #fff;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(99,102,241,.35);
            transition: opacity 150ms, transform 100ms;
            flex-shrink: 0;
        }
        #settings-panel-box .sp-save-btn:active { transform: scale(.97); }
        #settings-panel-box .sp-save-btn:hover  { opacity: .87; }
    `;
        document.head.appendChild(style);
    }

    //  BUILD HTML: Tab Auto
    function buildAutoTabHTML() {
        var setting = getUserSetting();
        var keys = ['diemdanh', 'thiluyen', 'phucloi', 'hoangvuc', 'bicanh', 'khoangmach', 'tienduyen', 'tele', 'vandap', 'chucphuc'];
        var items = keys.map(function (key) {
            var checked = setting[key]?.auto === true;
            var label = setting[key]?.label || setting[key]?.lable || key;
            var icon = autoIcons[key] || 'fa-circle';
            return `
            <label class="sp-item" data-key="${key}">
                <input type="checkbox" class="sp-checkbox sp-auto-check"${checked ? ' checked' : ''}/>
                <span class="sp-label"><i class="fa-solid ${icon}"></i> ${label}</span>
            </label>`;
        }).join('');

        return `
        <div class="sp-section">
            <div class="sp-section-title"><i class="fa-solid fa-toggle-on"></i> Bật / Tắt tự động</div>
            ${items}
        </div>`;
    }

    //  BUILD HTML: Tab Daily Tasks
    function buildDailyTasksTabHTML() {
        return `
        <div class="sp-scroll" id="sp-tasks-scroll">
 
            <!-- Tổng quan -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-chart-pie"></i> Tổng quan</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="dailyTasks.done"/>
                    <span class="sp-label"><i class="fa-solid fa-check-double"></i>Tất cả task done</span>
                </label>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="hdnReward.done"/>
                    <span class="sp-label"><i class="fa-solid fa-gift"></i>Nhận thưởng hằng ngày</span>
                </label>
            </div>
 
            <!-- Điểm Danh -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-calendar-check"></i> Điểm Danh</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="diemdanh.done"/>
                    <span class="sp-label"><i class="fa-solid fa-circle-check"></i>Done</span>
                </label>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-clock-rotate-left"></i>Retry After</span>
                    <input type="time" class="sp-field sp-time" data-path="diemdanh.retryAfter"/>
                </div>
            </div>
 
            <!-- Thí Luyện -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-fire-flame-curved"></i> Thí Luyện</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="thiluyen.done"/>
                    <span class="sp-label"><i class="fa-solid fa-circle-check"></i>Done</span>
                </label>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-regular fa-clock"></i>Next Time</span>
                    <input type="time" class="sp-field sp-time" data-path="thiluyen.nextTime"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-layer-group"></i>Current Stage</span>
                    <input type="number" class="sp-field sp-number" data-path="thiluyen.currentStage" placeholder="—"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-clock-rotate-left"></i>Retry After</span>
                    <input type="time" class="sp-field sp-time" data-path="thiluyen.retryAfter"/>
                </div>
            </div>
 
            <!-- Bí Cảnh -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-dungeon"></i> Bí Cảnh</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="bicanh.done"/>
                    <span class="sp-label"><i class="fa-solid fa-circle-check"></i>Done</span>
                </label>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-regular fa-clock"></i>Next Time</span>
                    <input type="time" class="sp-field sp-time" data-path="bicanh.nextTime"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-rotate-right"></i>Remaining Turn</span>
                    <input type="number" class="sp-field sp-number" data-path="bicanh.remainingTurn" placeholder="—"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-clock-rotate-left"></i>Retry After</span>
                    <input type="time" class="sp-field sp-time" data-path="bicanh.retryAfter"/>
                </div>
            </div>
 
            <!-- Hoàng Vực -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-mountain-sun"></i> Hoàng Vực</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="hoangvuc.done"/>
                    <span class="sp-label"><i class="fa-solid fa-circle-check"></i>Done</span>
                </label>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-regular fa-clock"></i>Next Time</span>
                    <input type="time" class="sp-field sp-time" data-path="hoangvuc.nextTime"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-rotate-right"></i>Remaining Turn</span>
                    <input type="number" class="sp-field sp-number" data-path="hoangvuc.remainingTurn" placeholder="—"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-clock-rotate-left"></i>Retry After</span>
                    <input type="time" class="sp-field sp-time" data-path="hoangvuc.retryAfter"/>
                </div>
            </div>
 
            <!-- Khoáng Mạch -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-gem"></i> Khoáng Mạch</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="khoangmach.done"/>
                    <span class="sp-label"><i class="fa-solid fa-circle-check"></i>Done</span>
                </label>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="khoangmach.is_in"/>
                    <span class="sp-label"><i class="fa-solid fa-door-open"></i>Is In</span>
                </label>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-regular fa-clock"></i>Next Time</span>
                    <input type="time" class="sp-field sp-time" data-path="khoangmach.nextTime"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-bolt"></i>Tu Vi Current</span>
                    <input type="number" class="sp-field sp-number" data-path="khoangmach.tuvi_current" placeholder="—"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-bolt-lightning"></i>Tu Vi Max</span>
                    <input type="number" class="sp-field sp-number" data-path="khoangmach.tuvi_max" placeholder="—"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-clock-rotate-left"></i>Retry After</span>
                    <input type="time" class="sp-field sp-time" data-path="khoangmach.retryAfter"/>
                </div>
            </div>
 
            <!-- Phúc Lợi -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-hand-holding-heart"></i> Phúc Lợi</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="phucloi.done"/>
                    <span class="sp-label"><i class="fa-solid fa-circle-check"></i>Done</span>
                </label>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-regular fa-clock"></i>Next Time</span>
                    <input type="time" class="sp-field sp-time" data-path="phucloi.nextTime"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-box-open"></i>Current Chest</span>
                    <input type="number" class="sp-field sp-number" data-path="phucloi.currentChest" placeholder="—"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-clock-rotate-left"></i>Retry After</span>
                    <input type="time" class="sp-field sp-time" data-path="phucloi.retryAfter"/>
                </div>
            </div>
 
            <!-- Tiên Duyên -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-wand-sparkles"></i> Tiên Duyên</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="tienduyen.done"/>
                    <span class="sp-label"><i class="fa-solid fa-circle-check"></i>Done</span>
                </label>
            </div>
 
            <!-- Tế Lễ -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-staff-snake"></i> Tế Lễ</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="tele.done"/>
                    <span class="sp-label"><i class="fa-solid fa-circle-check"></i>Done</span>
                </label>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-clock-rotate-left"></i>Retry After</span>
                    <input type="time" class="sp-field sp-time" data-path="tele.retryAfter"/>
                </div>
            </div>
 
            <!-- Vấn Đáp -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-comments"></i> Vấn Đáp</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="vandap.done"/>
                    <span class="sp-label"><i class="fa-solid fa-circle-check"></i>Done</span>
                </label>
            </div>
 
            <!-- Đồ Thạch -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-dice"></i> Đồ Thạch</div>
                <label class="sp-item">
                    <input type="checkbox" class="sp-checkbox sp-field" data-path="dothach.betplaced"/>
                    <span class="sp-label"><i class="fa-solid fa-coins"></i>Bet Placed</span>
                </label>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-hashtag"></i>Turn</span>
                    <input type="number" min="0" max="2" class="sp-field sp-number" data-path="dothach.turn" placeholder="—"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-id-badge"></i>Stone 1 ID</span>
                    <input type="text" class="sp-field sp-text" data-path="dothach.stoneBetted1" placeholder="—"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-id-badge"></i>Stone 2 ID</span>
                    <input type="text" class="sp-field sp-text" data-path="dothach.stoneBetted2" placeholder="—"/>
                </div>
            </div>

             <!-- Mê Cung -->
            <div class="sp-section">
                <div class="sp-section-title"><i class="fa-solid fa-dungeon"></i> Mê Cung</div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-gem"></i>Huyền Tinh Hiện Tại</span>
                    <input type="number" min="0" class="sp-field sp-number" data-path="mecung.huyen_tinh_daily_total" placeholder="—"/>
                </div>
                <div class="sp-item sp-input-row">
                    <span class="sp-label"><i class="fa-solid fa-gem"></i>Huyền Tinh Tối Đa</span>
                    <input type="number" min="0" class="sp-field sp-number" data-path="mecung.huyen_tinh_daily_cap" placeholder="—"/>
                </div>
            </div>
 
        </div>
 
        <!-- SAVE BUTTON -->
        <button class="sp-save-btn" id="sp-dt-save-btn">
            <i class="fa-solid fa-floppy-disk"></i> Lưu Daily Tasks
        </button>`;
    }

    //  BIND EVENTS sau khi render
    function bindSettingsPanelEvents() {
        var box = document.getElementById('settings-panel-box');
        if (!box) return;

        // Close button
        var closeBtn = box.querySelector('.sp-close');
        if (closeBtn) closeBtn.addEventListener('click', closeSettingsPanel);

        // Click overlay để đóng
        var overlay = document.getElementById('settings-panel-overlay');
        if (overlay) overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeSettingsPanel();
        });

        // Tab switching
        box.querySelectorAll('.sp-tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                box.querySelectorAll('.sp-tab-btn').forEach(b => b.classList.remove('active'));
                box.querySelectorAll('.sp-tab-content').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                box.querySelector('.sp-tab-content[data-tab="' + this.dataset.tab + '"]').classList.add('active');
            });
        });

        // Auto checkboxes
        box.querySelectorAll('.sp-auto-check').forEach(function (input) {
            input.addEventListener('change', function () {
                var key = this.closest('.sp-item').dataset.key;
                saveUserSetting(key, this.checked);
                showTempAlert('Đã ' + (this.checked ? 'bật' : 'tắt') + ' tự động cho ' + key, 'success');
            });
        });

        // Save daily tasks
        var saveBtn = document.getElementById('sp-dt-save-btn');
        if (saveBtn) saveBtn.addEventListener('click', saveDailyFields);
    }

    //  SAVE daily_tasks từ form
    function saveDailyFields() {
        var daily = JSON.parse(localStorage.getItem('daily_tasks') || '{}');
        document.querySelectorAll('#settings-panel-box .sp-field').forEach(function (field) {
            if (!field.dataset.path) return;
            var parts = field.dataset.path.split('.');
            var section = parts[0], key = parts[1];
            if (!daily[section]) daily[section] = {};

            if (field.classList.contains('sp-time')) {
                if (field.value) {
                    var p = field.value.split(':');
                    var d = new Date();
                    d.setHours(parseInt(p[0]), parseInt(p[1]), 0, 0);
                    daily[section][key] = d.getTime();
                }
            } else if (field.classList.contains('sp-number')) {
                if (field.value !== '') daily[section][key] = Number(field.value);
            } else if (field.classList.contains('sp-text')) {
                if (field.value !== '') daily[section][key] = field.value;
                else {
                    daily[section][key] = null; // ← thêm dòng này để xóa giá trị khi input trống
                }
            } else if (field.type === 'checkbox') {
                daily[section][key] = field.checked;
            }
        });

        localStorage.setItem('daily_tasks', JSON.stringify(daily));
        showTempAlert('Đã lưu Daily Tasks!', 'success');
    }

    //  LOAD daily_tasks vào form
    function loadDailyFields() {
        var daily = JSON.parse(localStorage.getItem('daily_tasks') || '{}');
        document.querySelectorAll('#settings-panel-box .sp-field').forEach(function (field) {
            if (!field.dataset.path) return;
            var parts = field.dataset.path.split('.');
            var val = (daily[parts[0]] || {})[parts[1]];

            if (field.classList.contains('sp-time')) {
                field.value = tsToTime(val);
            } else if (field.classList.contains('sp-number')) {
                field.value = (val !== undefined && val !== null) ? val : '';
            } else if (field.classList.contains('sp-text')) {
                field.value = (val !== undefined && val !== null) ? val : '';
            } else if (field.type === 'checkbox') {
                field.checked = !!val;
            }
        });
    }

    //  OPEN SETTINGS PANEL
    function openSettingsPanel() {
        if (document.getElementById('settings-panel-overlay')) return;

        injectSettingsPanelStyles();

        var overlay = document.createElement('div');
        overlay.id = 'settings-panel-overlay';
        overlay.innerHTML = `
        <div id="settings-panel-box">
 
            <!-- HEADER -->
            <div class="sp-header">
                <div class="sp-title">
                    <i class="fa-solid fa-robot"></i>
                    Auto Control
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="sp-badge">${SCRIPT_VERSION}</span>
                    <button class="sp-close" title="Đóng"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
 
            <!-- TABS -->
            <div class="sp-tabs">
                <button class="sp-tab-btn active" data-tab="auto">
                    <i class="fa-solid fa-gear"></i> Auto
                </button>
                <button class="sp-tab-btn" data-tab="tasks">
                    <i class="fa-solid fa-list-check"></i> Daily Tasks
                </button>
            </div>
 
            <!-- TAB: Auto -->
            <div class="sp-tab-content active" data-tab="auto">
                ${buildAutoTabHTML()}
            </div>
 
            <!-- TAB: Daily Tasks -->
            <div class="sp-tab-content" data-tab="tasks">
                ${buildDailyTasksTabHTML()}
            </div>
 
        </div>
    `;

        document.body.appendChild(overlay);
        bindSettingsPanelEvents();
        loadDailyFields();
    }

    //  CLOSE SETTINGS PANEL
    function closeSettingsPanel() {
        var overlay = document.getElementById('settings-panel-overlay');
        if (overlay) overlay.remove();
    }


    //  TOGGLE SETTINGS PANEL
    function toggleSettingsPanel() {
        if (document.getElementById('settings-panel-overlay')) {
            closeSettingsPanel();
        } else {
            openSettingsPanel();
        }
    }

    //Hiển thị thông báo
    function showTempAlert(message, type) {
        type = type || 'error';

        var container = document.querySelector('ul.notifications');
        if (!container) {
            container = document.createElement('ul');
            container.className = 'notifications';
            document.body.appendChild(container);
        }

        if (!document.getElementById('toast-style')) {
            var style = document.createElement('style');
            style.id = 'toast-style';
            style.textContent = [
                'ul.notifications {',
                '  position: fixed;',
                '  top: 30px;',
                '  left: 50%;',
                '  transform: translateX(-50%);',
                '  z-index: 9999999;',
                '  margin: 0;',
                '  padding: 0;',
                '  list-style: none;',
                '  display: flex;',
                '  flex-direction: column;',
                '  gap: 8px;',
                '  width: auto;',
                '}',
                '.notifications .toast {',
                '  display: flex;',
                '  align-items: center;',
                '  justify-content: space-between;',
                '  gap: 12px;',
                '  padding: 12px 16px;',
                '  border-radius: 8px;',
                '  font-family: Montserrat, sans-serif;',
                '  font-size: 18px;',
                '  min-width: 280px;',
                '  max-width: 420px;',
                '  min-height: 80px;',
                '  background: #26282e;',
                '  color: #f1f3f5;',
                '  border: 1px solid #30323a;',
                '  position: relative;',
                '  overflow: hidden;',
                '  animation: toastSlideIn 0.3s ease;',
                '}',
                '.notifications .toast::after {',
                '  content: "";',
                '  position: absolute;',
                '  bottom: 0;',
                '  left: 0;',
                '  height: 3px;',
                '  width: var(--progress-width, 100%);',
                '  transition: width 0.1s linear;',
                '}',
                '.notifications .toast.error   { border-left: 3px solid #ff6b6b; }',
                '.notifications .toast.error::after   { background: #ff6b6b; }',
                '.notifications .toast.success { border-left: 3px solid #0abf30; }',
                '.notifications .toast.success::after { background: #0abf30; }',
                '.notifications .toast .column {',
                '  display: flex;',
                '  align-items: center;',
                '  gap: 10px;',
                '  flex: 1;',
                '}',
                '.notifications .toast .column i { font-size: 16px; }',
                '.notifications .toast.error   .column i { color: #ff6b6b; }',
                '.notifications .toast.success .column i { color: #0abf30; }',
                '.notifications .toast .fa-xmark {',
                '  cursor: pointer;',
                '  color: #868e96;',
                '  font-size: 14px;',
                '  flex-shrink: 0;',
                '  transition: color 0.2s;',
                '}',
                '.notifications .toast .fa-xmark:hover { color: #f1f3f5; }',
                '@keyframes toastSlideIn {',
                '  from { transform: translateY(-100%); opacity: 0; }',
                '  to   { transform: translateY(0);     opacity: 1; }',
                '}',
            ].join('');
            document.head.appendChild(style);
        }

        if (typeof window.removeToast !== 'function') {
            window.removeToast = function (el) { el.remove(); };
        }

        var toast = document.createElement('li');
        toast.className = 'toast ' + type;

        var iconClass = type === 'error'
            ? 'fa-solid fa-circle-xmark'
            : 'fa-solid fa-circle-check';

        toast.innerHTML = [
            '<div class="column">',
            '  <i class="' + iconClass + '"></i>',
            '  <span>' + message + '</span>',
            '</div>',
            '<i class="fa-solid fa-xmark" onclick="removeToast(this.parentElement)"></i>',
        ].join('');

        container.appendChild(toast);

        var duration = 5000;
        var start = Date.now();
        var timer = setInterval(function () {
            var elapsed = Date.now() - start;
            var pct = Math.max(0, 100 - (elapsed / duration * 100));
            toast.style.setProperty('--progress-width', pct + '%');
            if (pct <= 0) {
                clearInterval(timer);
                toast.remove();
            }
        }, 50);
    }

    //Hiển thị thời gian
    function updateTimerDisplay() {
    var timerDisplay = document.getElementById('timer-display');
    if (!timerDisplay) return;

    var tasks = getDailyTasks();
    var now = Date.now();
    var html = '';

    var items = [
        { key: 'phucloi', label: 'Phúc Lợi' },
        { key: 'hoangvuc', label: 'Hoàng Vực' },
        { key: 'thiluyen', label: 'Thí Luyện' },
        { key: 'bicanh', label: 'Bí Cảnh' },
        { key: 'khoangmach', label: 'Khoáng Mạch' },
    ];

    items.forEach(function (item) {
        var t = tasks[item.key];
        if (!t || t.done) return;

        var nextTime = t.nextTime;
        if (!nextTime || now >= nextTime) {
            html += `<div class="timer-row"><span>${item.label}</span><span style="color:#4ade80;">Ready</span></div>`;
        } else {
            var remaining = nextTime - now;
            var mins = Math.floor(remaining / 60000);
            var secs = Math.floor((remaining % 60000) / 1000);
            html += `<div class="timer-row"><span>${item.label}</span><span>${mins}p ${secs}s</span></div>`;
        }
    });

    // Mê Cung
    if (mazeState) {
        var mc = mazeState;

        var statusLabel = mc.status === 'battle' ? '⚔️ Đang đánh' : mc.status === 'ready' ? '✅ Sẵn sàng' : '⏳ Chờ';
        var elColor = { kim: '#c0c0c0', moc: '#4ade80', thuy: '#38bdf8', hoa: '#f87171', tho: '#d97706' };
        var elName = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
        var hpColor = mc.bossHpPct > 50 ? '#4ade80' : mc.bossHpPct > 20 ? '#fbbf24' : '#f87171';
        var resColor = mc.lastResult === 'win' ? '#4ade80' : '#f87171';
        var resLabel = mc.lastResult === 'win' ? '✅ Thắng' : mc.lastResult === 'lose' ? '❌ Thua' : '';

        html += '<div style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;">';
        html += '<div class="timer-row"><span>Mê Cung</span><span style="color:#fbbf24;">' + statusLabel + ' — Ải ' + (mc.stage || 0) + '</span></div>';

        if (mc.status === 'battle' && mc.bossHpPct !== null && mc.bossHpPct !== undefined) {
            html += '<div style="position:relative;margin:16px 0 4px;">'
                + '<div style="height:4px;background:#2d3448;border-radius:2px;overflow:hidden;">'
                + '<div style="width:' + mc.bossHpPct + '%;height:100%;background:' + hpColor + ';border-radius:2px;transition:width 0.8s ease-out;"></div>'
                + '</div>'
                + '<div style="position:absolute; top:-20px;left:' + Math.min(mc.bossHpPct, 90) + '%;transform:translateX(-50%);font-size:14px;color:' + hpColor + ';white-space:nowrap;transition:left 0.8s ease-out;">' + mc.bossHpPct + '%</div>'
                + '</div>';
            html += '<div class="timer-row"; style="margin-top:6px";>'
                + '<span style="color:' + (elColor[mc.bossElement] || '#fff') + ';">' + (elName[mc.bossElement] || mc.bossElement || '?') + '</span>'
                + (resLabel ? '<span style="color:' + resColor + ';">' + resLabel + '</span>' : '')
                + '</div>';
        } else if (resLabel) {
            html += '<div class="timer-row"><span style="color:#aaa;">Vòng trước</span><span style="color:' + resColor + ';">' + resLabel + '</span></div>';
        }

        html += '</div>';
    }

    // Luyện Đan           
    if (_ldState) {
        var ld = _ldState;
        var tierLabel = { ha: 'Hạ Phẩm', trung: 'Trung Phẩm', thuong: 'Thượng Phẩm', cuc: 'Cực Phẩm' };
        var tasks2 = getDailyTasks();
        var danHuanUsed = tasks2.luyenDan ? (tasks2.luyenDan.danHuanUsed || 0) : 0;
        var isDong = ld.role === 'dong';

        var roleText = isDong
            ? ('⚗️ ' + (_ldInfoCache && _ldInfoCache.dongServingOwnerName ? _ldInfoCache.dongServingOwnerName : ''))
            : ('🤝 ' + (_ldInfoCache && _ldInfoCache.buddyNames && _ldInfoCache.buddyNames.length
                ? _ldInfoCache.buddyNames.join(', ')
                : ''));

        html += '<div style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;">';
        if (roleText.trim() !== '⚗️' && roleText.trim() !== '🤝') {
    html += '<div class="timer-row"><span>Luyện Đan</span><span style="color:#d97706;">' + roleText + '</span></div>';
}

        if (ld.tier) {
            html += '<div class="timer-row"><span>Phẩm</span><span>' + (tierLabel[ld.tier] || ld.tier) + '</span></div>';
        }

        if (isDong && ld.stabilityPct !== undefined) {
            var bandColor = ld.stabilityPct > 68 ? '#4ade80' : ld.stabilityPct > 40 ? '#fbbf24' : '#f87171';
            html += '<div class="timer-row"><span>Ổn định</span><span style="color:' + bandColor + ';">' + ld.stabilityPct.toFixed(1) + '%</span></div>';
            if (ld.tuneCount !== undefined && ld.tuneSlotsLeft !== undefined) {
                html += '<div class="timer-row"><span>Tune</span><span>' + ld.tuneCount + ' lần</span></div>';
            }
            html += '<div class="timer-row"><span>Đan Huân hôm nay</span><span style="color:' + (danHuanUsed >= 27 ? '#4ade80' : '#fbbf24') + ';">' + danHuanUsed + '/27</span></div>';
        }

        if (!isDong && ld.finishAt) {
            var remaining2 = Math.max(0, tasks2.luyenDan.finishAtTs * 1000 - Date.now());
            var doneColor, doneText;
            if (ld.status === 'ready' || remaining2 <= 0) {
                doneColor = '#4ade80';
                doneText = 'Hoàn thành! Bấm Thu Đan';
            } else {
                var mins2 = Math.floor(remaining2 / 60000);
                var secs2 = Math.floor((remaining2 % 60000) / 1000);
                doneColor = '#fff';
                doneText = mins2 + 'p ' + secs2 + 's';
            }
            html += '<div class="timer-row"><span>Còn lại</span><span style="color:' + doneColor + ';">' + doneText + '</span></div>';
        }

        html += '</div>';
    }

    if (runningTask) {
        html += `<div class="timer-row" style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;"><span>Đang chạy</span><span style="color:#fbbf24;">${runningTask}</span></div>`;

        if (!window._runningTaskTimer) {
            window._runningTaskTimer = setTimeout(function () {
                runningTask = null;
                window._runningTaskTimer = null;
            }, 30000);
        }
    }

    timerDisplay.innerHTML = html || '<div class="timer-row">Không có task nào đang chờ</div>';
}

    //Chạy task với xử lý lỗi chung
    var runningTask = null;
    function runTask(fn, key) {
        runningTask = fn.name || fn.displayName || key || (fn.toString().match(/^\s*function\s*([^\s(]+)/) || [])[1];
        return fn()
            .then(function () {
                setTimeout(function () {
                    autoExecuteRunning = false;
                }, 3000);
            })
            .catch(function (err) {
                showTempAlert(err.message || 'Thất bại', 'error');
                if (key) {
                    saveTaskData(key, { retryAfter: Date.now() + 60 * 1000 });
                }
                setTimeout(function () {
                    autoExecuteRunning = false;
                }, 3000); // giảm xuống vì không cần chờ lâu nữa
            });
    }

    // Cập nhật trạng thái nút auto toggle
    function updateAutoToggleButton() {
        var btn = document.getElementById('btn-auto-toggle');
        if (!btn) return;
        var setting = getUserSetting();
        btn.innerHTML = setting.autoRun !== false
            ? '<i class="fa-solid fa-check" style="color: rgb(55, 157, 8);"></i>'
            : '<i class="fa-solid fa-xmark" style="color: rgb(239, 5, 5);"></i>';
    }

    // Tự động excute
    var autoExecuteRunning = false;
    var autoExecuteInterval = null;
    function autoExecute() {
        if (autoExecuteRunning) return;

        var setting = getUserSetting();
        if (setting.autoRun === false) return;

        var tasks = getDailyTasks();

        if (tasks.dailyTasks?.done) {
            stopAutoExecute();
            return;
        }

        var now = Date.now();

        var queue = [
            { key: 'diemdanh', fn: danh_diem_danh_api },
            { key: 'tele', fn: danh_tele_tong_mon_api },
            { key: 'phucloi', fn: danh_phuc_loi_api },
            { key: 'hoangvuc', fn: danh_hoang_vuc_api },
            { key: 'thiluyen', fn: danh_thi_luyen_api },
            { key: 'bicanh', fn: danh_bi_canh_api },
            { key: 'khoangmach', fn: danh_khoang_mach_api },
            { key: 'tienduyen', fn: danh_tien_duyen_api },
            { key: 'vandap', fn: danh_van_dap_api },
            { key: 'hdnReward', fn: nhan_thuong_hoat_dong_ngay },
        ].filter(function (item) {
            if (item.key === 'hdnReward') {
                var prerequisitesDone = tasks.diemdanh?.done && tasks.hoangvuc?.done && tasks.phucloi?.done && tasks.vandap?.done;
                return prerequisitesDone && !tasks[item.key]?.done;
            }
            return !tasks[item.key]?.done && isTaskEnabled(item.key);
        });

        if (queue.length === 0) {
            var allDone = [
                'diemdanh', 'tele', 'phucloi', 'hoangvuc', 'thiluyen', 'bicanh', 'khoangmach', 'tienduyen', 'vandap', 'hdnReward'
            ].every(function (key) {
                return tasks[key]?.done;
            });
            if (allDone) {
                saveTaskData('dailyTasks', { done: true });
                stopAutoExecute();
                showTempAlert('Tất cả task hôm nay đã hoàn thành', 'success');
            }
            return;
        }

        var task = queue.find(function (item) {
            var t = tasks[item.key];
            if (!t) return false;
            if (item.key === 'hoangvuc' && t.remainingTurn <= 0) return false;
            if (t.nextTime && now < t.nextTime) return false;
            if (t.retryAfter && now < t.retryAfter) return false;
            return true;
        });

        if (!task) return;

        autoExecuteRunning = true;
        runTask(task.fn, task.key);
    }

    function startAutoExecute() {
        if (autoExecuteInterval) return;
        autoExecuteInterval = setInterval(autoExecute, 5000);
        autoExecute();
    }

    function stopAutoExecute() {
        clearInterval(autoExecuteInterval);
        autoExecuteInterval = null;
        autoExecuteRunning = false;
    }

    //Khởi tạo menu
    var autoMenuInitialized = false;
    function initializeAutoMenu() {
        createControlPanel();
        createAutoMenuButton();
        updateButtonStates();
        updateTimerDisplay();
        initLdTimerOnLoad();
        if (!autoMenuInitialized) {
            autoMenuInitialized = true;
            setInterval(updateButtonStates, 5000);
            setInterval(updateTimerDisplay, 1000);
            var setting = getUserSetting();
            setTimeout(function () {
                var panel = document.getElementById('auto-control-panel');
                if (panel && panel.style.display !== 'block') {
                    toggleControlPanel();
                }
            }, 1000); // delay thêm 2s để đảm bảo mọi thứ đã sẵn sàng trước khi chạy auto
            if (setting.autoRun !== false) {
                startAutoExecute();
            }
            if (setting.bicanh?.auto) {
                runTask(check_bi_canh_api)
            }
            if (setting.chucphuc?.auto) {
                runTask(danh_chuc_phuc_api);
            }
        }
    }

    var allowedPaths = ['/', '/nhiem-vu-hang-ngay'];
    if (window.location.hostname === 'hoathinh3d.co' && allowedPaths.includes(window.location.pathname)) {
        window.addEventListener('load', initializeAutoMenu);
        window.addEventListener('hashchange', initializeAutoMenu);
        setTimeout(function () {
            if (!document.getElementById('auto-control-panel')) initializeAutoMenu();
        }, 500);
    }

})();