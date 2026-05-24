// ==UserScript==
// @name         Tool for clone
// @namespace    http://tampermonkey.net/
// @version      2.6.0
// @description  Tool auto các hoạt động hàng ngày trên hoathinh3d.co, phục vụ mục đích cá nhân
// @author       Melios
// @match        https://hoathinh3d.co/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/Melios025/hh3d/refs/heads/main/script.js
// @downloadURL  https://raw.githubusercontent.com/Melios025/hh3d/refs/heads/main/script.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    //Helper function to format text
    function normalizeText(str) {
        return str
            .normalize('NFC')
            .replace(/[《》「」『』""''?？!！]/g, '')  // bỏ dấu câu đặc biệt
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }
    //Tạo dữ liệu đầu ngày
    function getDailyTasks() {
        var today = new Date().toLocaleDateString('en-GB'); // e.g. 19/05/2026
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
                vandap: { done: false }
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

    //Hàm xử lý ajax
    function ajax(action, extraParams) {
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
                if (!data.success) throw new Error(`[${action}] ${data.data?.error || data.data?.message || data.data || 'Request thất bại'}`);
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

        var res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': hh3dData.restNonce
            },
            credentials: 'include',
            body: JSON.stringify(body)
        })
            .then(async function (r) {
                var data = await r.json();
                if (!r.ok) {
                    throw new Error(data.message);
                }
                return data;
            })
            .then(function (data) {
                if (!options.ignoreSuccess && !data.success) {
                    throw new Error(data.data?.error || data.data?.message || data.message || data.data || `${endpoint} thất bại`);
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
                nextTime: nextWaitMs > 0 ? Date.now() + nextWaitMs : null
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
        var bossTimer = null;
        if (hh3dData?.securityToken) {
            try {
                bossTimer = await ajax(hh3dData.act.bossTimer);
            } catch (err) {
                console.warn('bossTimer lỗi:', err);
            }
        }

        var currentTasks = getDailyTasks();
        var currentTurn = currentTasks?.hoangvuc?.remainingTurn ?? 5;
        var newTurn = currentTurn - 1;

        var updateObj = { remainingTurn: newTurn };
        if (bossTimer?.success && bossTimer?.data) {
            updateObj.nextTime = parseInt(bossTimer.data) + 1 * 60 * 1000; // Thêm 1 phút đệm để chắc chắn đã hết thời gian chờ trên server
        }
        if (newTurn <= 0) updateObj.done = true;
        saveTaskData('hoangvuc', updateObj);
        updateButtonStates();
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

    //Hàm đánh bí cảnh
    async function danh_bi_canh_api() {
        var status = await resApi('tong-mon/v1/get-boss-status', {}, { ignoreSuccess: true });

        // Có thưởng chưa nhận → nhận trước
        if (status.has_pending_reward) {
            var claim = await resApi('tong-mon/v1/claim-boss-reward', {}, { ignoreSuccess: true });
            showTempAlert(claim.message || 'Đã nhận thưởng bí cảnh', 'success');
        }

        // Không có boss → chờ
        if (!status.has_boss) {
            showTempAlert('Bí Cảnh: chưa có boss mới', 'error');
            return;
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
            var nextTimeMs = Date.now() + (attackCooldown.cooldown_remaining * 1000);
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
            return room.has_blessed === false && room.has_sent_li_xi === false;
        });

        //Xử lý nhận lì xì
        if (rooms_has_lixi.length > 0) {
            for (var i = 0; i < rooms_has_lixi.length; i++) {
                await new Promise(function (r) { setTimeout(r, 500 + Math.random() * 500); });
                var room = rooms_has_lixi[i];
                try {
                    var res = await resApi('hh3d_receive_li_xi', { wedding_room_id: room.wedding_room_id });
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

        for (var i = 0; i < questions.length; i++) {
            var q = questions[i];
            var normalizedMap = {};
            Object.keys(answerMap).forEach(key => {
                normalizedMap[normalizeText(key)] = answerMap[key];
            });
            var answer = normalizedMap[normalizeText(q.question)];
            var answerIndex;

            if (!answer) {
                answerIndex = Math.floor(Math.random() * 4);
                showTempAlert(`Không tìm thấy đáp án: ${q.question}, random: ${q.options[answerIndex]}`, 'error');
            } else {
                answerIndex = q.options.findIndex(opt => opt === answer);
                if (answerIndex === -1) {
                    answerIndex = Math.floor(Math.random() * 4);
                    showTempAlert(`Đáp án không khớp, random: ${q.options[answerIndex]}`, 'error');
                }
            }

            var result = await ajax(hh3dData.act.vdSave, {
                question_id: q.id,
                answer: answerIndex
            });

            showTempAlert(result.data?.message || `Câu ${i + 1}/${questions.length} đã trả lời`, 'success');

            // Chờ 3 giây trước câu tiếp theo (trừ câu cuối)
            if (i < questions.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        saveTaskData('vandap', { done: true });
        updateButtonStates();
    }

    //Hàm đánh đồ thạch
    async function danh_do_thach_api() {
        let tasks = getDailyTasks();
        const hour = new Date().getHours();

        // Xác định lượt theo giờ
        const isTurn1Time = hour >= 6 && hour < 13;
        const isTurn2Time = hour >= 16 && hour < 21;

        if (!isTurn1Time && !isTurn2Time) {
            throw new Error('Không phải thời gian đặt cược (6h-13h hoặc 18h-21h)');
        }

        const turn = isTurn1Time ? 1 : 2;

        // Nếu đang ở lượt 2, kiểm tra thưởng lượt 1 đã nhận chưa
        if (turn == 2) {
            const dothachCheck = await ajax(hh3dData.act.dtLoad);
            const hasUnclaimedReward =
                dothachCheck.data.winning_stone_id &&
                (tasks.dothach.stoneBetted1 == dothachCheck.data.winning_stone_id ||
                    tasks.dothach.stoneBetted2 == dothachCheck.data.winning_stone_id);

            if (hasUnclaimedReward) {
                try {
                    await nhan_thuong_do_thach();
                } catch (err) {
                    showTempAlert(err.message, 'error');
                }
                tasks = getDailyTasks();
            }

            // Reset để chuẩn bị đặt lượt 2
            saveTaskData('dothach', { betplaced: false, turn: 2, stoneBetted1: null, stoneBetted2: null });
            tasks = getDailyTasks();
        }

        if (tasks.dothach.betplaced == true && tasks.dothach.turn == turn) {
            throw new Error(`Đã đặt cược lượt ${turn} hôm nay`);
        }

        const dothachData = await ajax(hh3dData.act.dtLoad);

        if (dothachData.data.bet_limit_reached || dothachData.data.is_reward_time) {
            throw new Error('Không thể đặt cược lúc này');
        }

        const stones = dothachData.data.stones;
        stones.sort((a, b) => b.reward_multiplier - a.reward_multiplier);
        const top2Stones = stones.slice(0, 2);

        for (const stone of top2Stones) {
            var betData = await ajax(hh3dData.act.dtBet, {
                stone_id: stone.stone_id,
                bet_amount: 20
            });

            showTempAlert(betData.data.message, 'success');

            tasks = getDailyTasks();
            if (tasks.dothach.stoneBetted1 == null) {
                saveTaskData('dothach', { betplaced: true, turn: turn, stoneBetted1: stone.stone_id });
            } else {
                saveTaskData('dothach', { betplaced: true, turn: turn, stoneBetted2: stone.stone_id });
            }
            updateButtonStates();
        }
    }

    async function nhan_thuong_do_thach() {
        let tasks = getDailyTasks();
        const hour = new Date().getHours();
        const dothachData = await ajax(hh3dData.act.dtLoad);
        const winningId = dothachData.data.winning_stone_id;

        if (!winningId) {
            throw new Error('Chưa có kết quả hoặc không phải thời gian nhận thưởng');
        }

        const didBetWinner =
            tasks.dothach.stoneBetted1 == winningId ||
            tasks.dothach.stoneBetted2 == winningId;

        if (!didBetWinner) {
            // Không trúng nhưng vẫn reset để đặt lượt tiếp
            saveTaskData('dothach', { betplaced: false, stoneBetted1: null, stoneBetted2: null });
            updateButtonStates();
            throw new Error('Không trúng thưởng lượt này');
        }

        const claim = await ajax(hh3dData.act.dtClaim, { stone_id: winningId });

        // Reset sau khi nhận thưởng, giữ lại turn để biết vừa xong lượt mấy
        saveTaskData('dothach', {
            betplaced: false,
            stoneBetted1: null,
            stoneBetted2: null
        });

        showTempAlert(claim.data.message, 'success');
        updateButtonStates();
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
            var res = await fetch('https://hoathinh3d.co/wp-json/lottery/v1/7cdf093b', {
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
            var originalText = btn3.getAttribute('data-label') || btn3.textContent.replace(' ✅', '').trim();
            btn3.setAttribute('data-label', originalText);
            btn3.disabled = allDone;
            btn3.textContent = allDone ? originalText + ' ✅' : originalText;
        }

        // Các button thường
        var keys = ['tienduyen', 'dothach'];
        keys.forEach(function (key) {
            var btn = document.getElementById('btn-' + key);
            if (btn) {
                var t = tasks[key] || {};
                var isDone = t.done === true;
                var originalText = btn.getAttribute('data-label') || btn.querySelector('.btn-label')?.textContent.replace(' ✅', '').trim() || btn.textContent.replace(' ✅', '').trim();
                btn.setAttribute('data-label', originalText);
                btn.disabled = isDone;
                btn.textContent = isDone ? originalText + ' ✅' : originalText;
            }
        });

        // Progress buttons
        var progressItems = [
            {
                key: 'hoangvuc',
                label: 'Hoang Vực',
                getProgress: function (t) {
                    var done = 5 - (t.remainingTurn ?? 5);
                    return { done, max: 5 };
                }
            },
            {
                key: 'thiluyen',
                label: 'Thí Luyện',
                getProgress: function (t) {
                    return { done: t.currentStage ?? 0, max: 3 };
                }
            },
            {
                key: 'phucloi',
                label: 'Phúc Lợi',
                getProgress: function (t) {
                    return { done: (t.currentChest ?? 1) - 1, max: 4 };
                }
            },
            {
                key: 'bicanh',
                label: 'Bí Cảnh',
                getProgress: function (t) {
                    var remaining = t.remainingTurn ?? 5;
                    return { done: 5 - remaining, max: 5 };
                }
            },
            {
                key: 'khoangmach',
                label: 'Khoáng Mạch',
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
            btn.innerHTML = `<div class="btn-progress" style="width:${pct}%"></div><span class="btn-label">${item.label}${isDone ? ' ✅' : ''}</span>`;
        });
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

        // Tìm wrapper qua nút open-auto-menu thay vì querySelector
        var menuBtn = document.getElementById('open-auto-menu');
        if (!menuBtn) return;
        var wrapper = menuBtn.closest('.load-notification');
        if (!wrapper) return;

        var panel = document.createElement('div');
        panel.id = 'auto-control-panel';
        panel.innerHTML = `
       <div class="panel-header">Auto Menu</div>
        <div class="panel-body">

            <!-- Hàng 1: 1 lần/ngày -->
            <div class="panel-row">
                <button id="btn-diemdanh-vandap-tele" class="panel-btn panel-btn-full">Điểm Danh - Tế lễ - Vấn
                    đáp</button>
                <button id="btn-auto-toggle" class="panel-btn btn-auto-toggle">✅</button>
                <button id="btn-setting" class="panel-btn btn-auto-toggle">⚙️</button>
            </div>

            <!-- Hàng 2 -->
            <div class="panel-row">
                <button id="btn-hoangvuc" class="panel-btn">Hoàng Vực</button>
                <button id="btn-thiluyen" class="panel-btn">Thí Luyện</button>
            </div>

            <!-- Hàng 3 -->
            <div class="panel-row">
                <button id="btn-phucloi" class="panel-btn">Phúc Lợi</button>
                <button id="btn-bicanh" class="panel-btn">Bí Cảnh</button>
            </div>

            <!-- Khoáng Mạch full width -->
            <button id="btn-khoangmach" class="panel-btn panel-btn-full">Khoáng Mạch</button>

            <!-- Tiên Duyên full width -->
            <div class="panel-row">
                <button id="btn-tienduyen" class="panel-btn">Tiên Duyên</button>
                <button id="btn-chucphuc" class="panel-btn">Chúc Phúc</button>
            </div>

            <!-- Đồ Thạch -->
            <button id="btn-dothach" class="panel-btn panel-btn-full">Đồ Thạch</button>

            <!-- Link -->
            <button id="btn-banghoatdong" class="panel-btn panel-btn-full" onclick="window.open('https://hoathinh3d.co/nhiem-vu-hang-ngay', '_blank')">Bảng hoạt động ngày</button>

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
            z-index: 999999;
            background: rgba(20, 20, 20, 0.95);
            color: #fff;
            border-radius: 14px;
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
            font-family: Arial, sans-serif;
            line-height: 1.4;
            padding: 20px;
        }
          /* ===== HEADER ===== */
        #auto-control-panel .panel-header {
            display: flex;
            gap: 10px;
            justify-content: center;
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            color: #60a5fa;
            margin-bottom: 12px;
            margin-top: 12px;
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
            position:relative;
            overflow:hidden;
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
        }
        #auto-control-panel .btn-progress {
            position:absolute;
            left:0;
            top:0;
            height:100%;
            background:rgba(255,255,255,0.15);
            transition:width 300ms ease;
            z-index:0;
            border-radius:12px;
        }
        #auto-control-panel .btn-label {
            position:relative;
            z-index:1;
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
        }
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

        #auto-control-panel .panel-btn.done {
            background: #16a34a;
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
        document.getElementById('btn-setting').addEventListener('click', function () {
            toggleSettingsPanel();
        });
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
            var now = new Date();
            var currentHour = now.getHours();
            var tasks = getDailyTasks();
            if (currentHour >= 6 && currentHour < 13 || currentHour >= 16 && currentHour < 21) {
                if (!tasks.dothach.betplaced) {
                    if (!this.disabled) runTask(danh_do_thach_api);
                } else {
                    showTempAlert('Đã đặt cược rồi', 'error');
                }
            } else {
                if (!this.disabled) runTask(nhan_thuong_do_thach);
            }
        });
    }

    //Hiển thị bảng cài đặt    
    function renderSettingsPanel() {
        var panel = document.getElementById('settings-panel');
        if (!panel) return;
        var setting = getUserSetting();
        var keys = ['diemdanh', 'thiluyen', 'phucloi', 'hoangvuc', 'bicanh', 'khoangmach', 'tienduyen', 'tele', 'vandap', 'chucphuc'];
        var html = '<div class="settings-header">Tùy chọn Auto</div>';
        html += '<div class="settings-list">';
        keys.forEach(function (key) {
            var checked = setting[key]?.auto === true;
            var label = setting[key]?.label || setting[key]?.lable || key;
            html += '<label class="settings-item" data-key="' + key + '">' +
                '<input type="checkbox" class="settings-checkbox-input"' + (checked ? ' checked' : '') + ' />' +
                '<span class="settings-label">' + label + '</span>' +
                '</label>';
        });
        html += '</div>';
        panel.innerHTML = html;
        panel.querySelectorAll('.settings-checkbox-input').forEach(function (input) {
            input.addEventListener('change', function () {
                var key = this.closest('.settings-item').dataset.key;
                saveUserSetting(key, this.checked);
            });
        });
    }

    //Bật tắt bảng cài đặt
    function toggleSettingsPanel() {
        var panel = document.getElementById('settings-panel');
        if (!panel) return;
        var isVisible = panel.classList.contains('visible');
        if (isVisible) {
            panel.classList.remove('visible');
            panel.classList.add('hidden');
        } else {
            renderSettingsPanel();
            panel.classList.remove('hidden');
            panel.classList.add('visible');
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
                '  z-index: 999999;',
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

        var duration = 3000;
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


        if (runningTask) {
            html += `<div class="timer-row" style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;"><span>Đang chạy</span><span style="color:#fbbf24;">${runningTask}</span></div>`;
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
                    saveTaskData(key, { retryAfter: Date.now() + 5 * 60 * 1000 });
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
        btn.textContent = setting.autoRun !== false ? '✅' : '❌';
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
        if (!autoMenuInitialized) {
            autoMenuInitialized = true;
            var lastTasksSnapshot = null;

            setInterval(function () {
                var tasks = getDailyTasks();
                var snapshot = JSON.stringify(tasks);

                if (snapshot !== lastTasksSnapshot) {
                    lastTasksSnapshot = snapshot;
                    updateButtonStates();
                }
            }, 1000);
            setInterval(updateTimerDisplay, 1000);
            var setting = getUserSetting();
            if (setting.autoRun !== false) {
                startAutoExecute();
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