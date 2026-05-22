// ==UserScript==
// @name         Tool clone
// @namespace    http://tampermonkey.net/
// @version      2026-04-27
// @description  try to take over the world!
// @author       Melios
// @match        https://hoathinh3d.co/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    var hoangvuc = '/hoang-vuc';
    var phucloi = '/phuc-loi-duong';
    var khoangmach = '/khoang-mach';
    var diemdanh = '/diem-danh';
    var thiluyen = '/thi-luyen-tong-mon-hh3d';
    var bicanh = '/bi-canh-tong-mon';
    var tele = '/danh-sach-thanh-vien-tong-mon';
    var vandap = '/van-dap-tong-mon';
    var tienduyen = '/tien-duyen';
    var vandapQAUrl = 'https://raw.githubusercontent.com/Melios025/hh3d/main/vandap.json';
    var storedQA = {};
    var vandapQAReady = false;
    var vandapQALoading = false;
    var vandapQuestionCount = 5;
    var vandapDelayMs = 5000;
    var activeAutoIframeId = null;


    function getToday() {
        var today = new Date();
        return today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    }

    function showTempAlert(message, type, fromIframe) {
        type = type || 'error';

        // If message comes from iframe, show in parent window
        if (fromIframe) {
            showTempAlertFallback(message, type);
            return;
        }

        var notifications = document.querySelector('.notifications');
        if (!notifications) {
            // Fallback to custom alert if website notifications not found
            showTempAlertFallback(message, type);
            return;
        }

        // Website has notifications - still show our custom alert too
        showTempAlertFallback(message, type);
    }

    function showTempAlertFallback(message, type) {
        type = type || 'error';
        var notifications = document.querySelector('.notifications');
        if (notifications) {
            // Website has notifications - still show our custom alert
            // Don't return, continue to show custom alert
        }

        var toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'notifications';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 999999;
                margin: 0;
                padding: 0;
                list-style: none;
            `;
            document.body.appendChild(toastContainer);
        }

        var toast = document.createElement('li');
        var iconClass = type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check';
        var iconColor = type === 'error' ? '#ff6b6b' : '#0abf30';
        toast.className = 'toast ' + type;
        toast.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 16px;
            background: #26282e;
            border: 1px solid #30323a;
            border-radius: 8px;
            color: #f1f3f5;
            font-family: 'Montserrat', sans-serif;
            font-size: 13px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
            min-width: 280px;
            max-width: 400px;
        `;
        toast.innerHTML = `
            <div class="column" style="display: flex; align-items: center; gap: 10px;">
                <i class="fa-solid ${iconClass}" style="color: ${iconColor}; font-size: 16px;"></i>
                <span>${message}</span>
            </div>
            <i class="fa-solid fa-xmark" style="cursor: pointer; color: #868e96; font-size: 12px;" onclick="this.parentElement.remove()"></i>
        `;
        toastContainer.appendChild(toast);

        setTimeout(function () {
            if (toastContainer.contains(toast)) {
                toast.remove();
            }
        }, 3000);

        // Add animation style if not exists
        if (!document.getElementById('toast-animation')) {
            var style = document.createElement('style');
            style.id = 'toast-animation';
            style.textContent = '@keyframes slideIn { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }';
            document.head.appendChild(style);
        }
    }

    function clickElementBySelector(root, selector) {
        var element = root.querySelector(selector);
        if (element) {
            element.click();
            return true;
        }
        return false;
    }


    function danh_hoang_vuc(root, closeIframe) {
        var remainingAttacksEl = root.querySelector('.remaining-attacks');
        if (remainingAttacksEl) {
            var text = remainingAttacksEl.textContent;
            if (text.includes(': 0')) {
                localStorage.setItem('hoangvuc_done', getToday());
                updateButtonStates();
            }
        }

        if (!clickElementBySelector(root, '#battle-button')) {
            showTempAlert('Vào chiến không thấy');
            if (typeof closeIframe === 'function') closeIframe();
            return;
        }

        setTimeout(function () {
            if (!clickElementBySelector(root, '.attack-button')) {
                showTempAlert('Đánh Hoàng Vực không thành công');
            } else {
                showTempAlert('Đánh Hoàng Vực thành công', 'success');
            }
            setTimeout(function () {
                if (typeof closeIframe === 'function') closeIframe();
            }, 3000);

        }, 5000); // 5 second delay; adjust if needed
    }

    function danh_phuc_loi(root, closeIframe) {
        // Click all chests with class 'chest-box shake'
        setTimeout(function () {
            var chests = root.querySelectorAll('.chest-box');
            for (var i = 0; i < chests.length; i++) {
                chests[i].click();
                chests[i].click();
            }
            showTempAlert('Đánh Phúc Lợi thành công', 'success');
        }, 2000);
        setTimeout(function () {
            var shake = root.querySelectorAll('.chest-box.shake');
            if (shake && shake.length > 0) {
            } else {
                localStorage.setItem('phucloi_done', getToday());
                updateButtonStates();
            } setTimeout(function () {
                if (typeof closeIframe === 'function') closeIframe();
            }, 2000);
        }, 2000);


        return
    }

    function danh_khoang_mach(root, closeIframe) {

        if (!root.querySelector('.leave-mine')) {
            setTimeout(function () {
                if (!clickElementBySelector(root, '.mine-type-button[data-mine-type="silver"]')) {
                    showTempAlert('Nút vào mỏ không thấy');
                }
                setTimeout(function () {
                    if (!clickElementBySelector(root, '.enter-mine[data-mine-id="59"]')) {
                        if (!clickElementBySelector(root, '.mine-image')) {
                            showTempAlert('Vào khoáng mạch không thấy');
                        }
                    }
                    setTimeout(function () {
                        if (!root.querySelector('.leave-mine')) {
                            if (!clickElementBySelector(root, '.swal2-confirm.swal2-styled')) {
                                showTempAlert('Xác nhận không thấy');
                            }
                        }
                        setTimeout(function () {
                            if (!clickElementBySelector(root, '.claim-reward')) {
                                showTempAlert('Đánh Khoáng Mạch không thành công');
                            } else {
                                showTempAlert('Đánh Khoáng Mạch thành công', 'success');
                            }

                            // Check Tu Vi after claiming reward
                            setTimeout(function () {
                                var tuviEl = root.querySelector('.stat-item.stat-tuvi');
                                if (tuviEl) {
                                    var text = tuviEl.textContent;
                                    var match = text.match(/Tu Vi:\s*(\d+)\s*\/\s*(\d+)/);
                                    if (match) {
                                        var current = parseInt(match[1]);
                                        var max = parseInt(match[2]);
                                        if (current >= max) {
                                            localStorage.setItem('khoangmach_done', getToday());
                                            updateButtonStates();
                                        }
                                    }
                                }
                                if (typeof closeIframe === 'function') closeIframe();
                            }, 2000);
                        }, 3000);
                    }, 3000);
                }, 3000);
            }, 3000);
            return;
        }
        return;
    }

    function danh_diem_danh(root, closeIframe) {
        setTimeout(function () {
            var button = root.querySelector('#checkInButton');
            if (!button) {
                showTempAlert('Không tìm thấy nút điểm danh');
                if (typeof closeIframe === 'function') closeIframe();
                return;
            }
            if (button.disabled) {
                showTempAlert('Đã điểm danh hôm nay!', 'success');
                localStorage.setItem('diemdanh_done', getToday());
                updateButtonStates();
                if (typeof closeIframe === 'function') closeIframe();
                return;
            }
            if (!clickElementBySelector(root, '#checkInButton')) {
                showTempAlert('Đánh Điểm Danh không thành công');
                if (typeof closeIframe === 'function') closeIframe();
                return;
            }
            showTempAlert('Điểm danh thành công!', 'success');
            setTimeout(function () {
                if (typeof closeIframe === 'function') closeIframe();
            }, 3000);
        }, 3000);
    }
    function danh_thi_luyen(root, closeIframe) {

        setTimeout(function () {
            if (!clickElementBySelector(root, '#chestImage')) {
                showTempAlert('Không thấy chest thí luyện');
                if (typeof closeIframe === 'function') closeIframe();
                return;
            }
            setTimeout(function () {
                var notifications = root.querySelectorAll('.notifications .toast');
                for (var i = 0; i < notifications.length; i++) {
                    var text = notifications[i].textContent;
                    if (text.includes('Đã hoàn thành Thí Luyện Tông Môn')) {
                        localStorage.setItem('thiluyen_done', getToday());
                        updateButtonStates();
                        showTempAlert('Đánh Thí Luyện thành công', 'success');
                        if (typeof closeIframe === 'function') closeIframe();
                        return;
                    }
                }
                if (typeof closeIframe === 'function') closeIframe();
            }, 2000);
        }, 3000);
    }

    function danh_bi_canh(root, closeIframe) {
        setTimeout(function () {
            if (!clickElementBySelector(root, '#challenge-boss-btn')) {
                showTempAlert('Khiêu chiến boss bí cảnh không thành công');
                if (typeof closeIframe === 'function') closeIframe();
                return;
            }
            setTimeout(function () {
                if (!clickElementBySelector(root, '#attack-boss-btn')) {
                    showTempAlert('Đánh Bí Cảnh không thành công');
                } else {
                    showTempAlert('Đánh Bí Cảnh thành công', 'success');
                }

            }, 3000);
        }, 5000);

        setTimeout(function () {
            getOrCreateIframe('bicanh-iframe', bicanh, function (doc) {
                setTimeout(function () {
                    var attackcount = doc.querySelector('.attack-count');
                    var text = attackcount.textContent;
                    if (text.includes('0')) {
                        localStorage.setItem('bicanh_done', getToday());
                        updateButtonStates();
                    }
                }, 3000);
            });
        }, 5000);
    }

    function danh_te_le(root, closeIframe) {

        var button = root.querySelector('#te-le-button');

        if (!button) {
            showTempAlert('Không thấy nút tế lễ');
            if (typeof closeIframe === 'function') closeIframe();
            return;
        }

        if (button.disabled) {
            showTempAlert('Đã tế lễ hôm nay!', 'success');
            localStorage.setItem('tele_done', getToday());
            updateButtonStates();
            if (typeof closeIframe === 'function') closeIframe();
            return;
        }

        button.click();

        setTimeout(function () {
            var confirmBtn = root.querySelector('.swal2-confirm.swal2-styled');
            if (!confirmBtn) {
                showTempAlert('Không thấy nút xác nhận Tế Lễ');
                if (typeof closeIframe === 'function') closeIframe();
                return;
            }

            confirmBtn.click();
            localStorage.setItem('tele_done', getToday());
            showTempAlert('Tế Lễ thành công!', 'success');

            setTimeout(function () {
                if (typeof closeIframe === 'function') closeIframe();
            }, 2000);
        }, 2000);
    }

    function danh_tien_duyen(root, closeIframe) {
        // Click nút bạn bè
        setTimeout(function () {
            var friendBtn = root.querySelector('.tien-duyen-btn.friends-btn');
            if (!friendBtn) {
                showTempAlert('Không thấy nút bạn bè để tặng quà');
                setTimeout(function () {
                    if (typeof closeIframe === 'function') closeIframe();
                    return;
                }, 2000);

            }
            friendBtn.click();
        }, 2000);

        // Click Melios
        setTimeout(function () {
            var melios = root.querySelector("[onclick=\"showGiftConfirm(144860, 'Melios')\"]")
            if (!melios) {
                showTempAlert('Không thấy Melios để tặng quà');
                setTimeout(function () {
                    if (typeof closeIframe === 'function') closeIframe();
                    return;
                }, 2000);
            }
            melios.click();
        }, 3000);



        // Click x3
        setTimeout(function () {
            var labelX3 = Array.from(root.querySelectorAll('label.gift-quantity-option-label'))
                .find(function (label) {
                    return label.querySelector('.quantity-text')?.textContent.trim() === 'x3';
                });

            if (!labelX3) {
                showTempAlert('Không thấy chọn x3 để tặng quà');
                setTimeout(function () {
                    if (typeof closeIframe === 'function') closeIframe();
                    return;
                }, 2000);
                return;
            }
            labelX3.click();
        }, 3000);

        //Click xác nhận
        setTimeout(function () {
            root.querySelector('.confirm-yes.gift-step1-next-btn').click();
            setTimeout(function () {
                root.querySelector('.gift-final-send-btn').click()
                setTimeout(function () {
                    localStorage.setItem('tienduyen_done', getToday());
                    updateButtonStates();
                    if (typeof closeIframe === 'function') closeIframe();
                    return;
                }, 3000);
            }, 2000);
        }, 4000);

    }

    function createControlPanel() {
        if (document.getElementById('auto-control-panel')) {
            return;
        }

        var panel = document.createElement('div');
        panel.id = 'auto-control-panel';
        panel.innerHTML = `
            <div class="panel-header">Auto Menu</div>
            <button id="btn-diemandanh" class="panel-btn">Điểm Danh</button>
            <button id="btn-tele" class="panel-btn">Tề Lễ</button>
            <button id="btn-tienduyen" class="panel-btn">Tiên Duyên</button>
            <button id="btn-hoangvuc" class="panel-btn">Hoàng Vực</button>
            <button id="btn-phucloi" class="panel-btn">Phúc Lợi</button>
            <button id="btn-thiluyen" class="panel-btn">Thí Luyện</button>
            <button id="btn-bicanh" class="panel-btn">Bí Cảnh</button>
            <button id="btn-khoangmach" class="panel-btn">Khoáng Mạch</button>
            <div id="timer-display"></div>
        `;

        panel.style.position = 'fixed';
        panel.style.top = 'auto';
        panel.style.right = '10px';
        panel.style.bottom = '60px';
        panel.style.width = '180px';
        panel.style.padding = '10px';
        panel.style.background = 'rgba(20, 20, 20, 0.95)';
        panel.style.color = '#fff';
        panel.style.borderRadius = '10px';
        panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.3)';
        panel.style.zIndex = 99999;
        panel.style.fontFamily = 'Arial, sans-serif';
        panel.style.fontSize = '12px';
        panel.style.lineHeight = '1.4';
        panel.style.display = 'none';

        var style = document.createElement('style');
        style.textContent = `
            #auto-control-panel .panel-header {
                font-weight: 700;
                text-align: center;
                margin-bottom: 8px;
            }
            #auto-control-panel #timer-display {
                background: rgba(0,0,0,0.3);
                padding: 8px;
                border-radius: 6px;
                margin-top: 10px;
                font-size: 11px;
                text-align: center;
            }
            #auto-control-panel .timer-row {
                display: flex;
                justify-content: space-between;
                padding: 2px 0;
            }
            #auto-control-panel .timer-row span:first-child {
                color: #aaa;
            }
            #auto-control-panel .panel-btn {
                width: 100%;
                margin: 4px 0;
                padding: 8px;
                border: none;
                border-radius: 6px;
                background: #2563eb;
                color: #fff;
                cursor: pointer;
                transition: background 200ms ease, opacity 200ms ease;
            }
            #auto-control-panel .panel-btn:hover:not(:disabled) {
                background: #1d4ed8;
            }
            #auto-control-panel .panel-btn:disabled {
                background: #555;
                color: #999;
                cursor: not-allowed;
                opacity: 0.6;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Update button states immediately after creating panel
        updateButtonStates();

        document.getElementById('btn-hoangvuc').addEventListener('click', function () {
            if (this.disabled) return;
            danh_hoang_vuc_in_iframe();

        });
        document.getElementById('btn-phucloi').addEventListener('click', function () {
            if (this.disabled) return;
            danh_phuc_loi_in_iframe();

        });
        document.getElementById('btn-diemandanh').addEventListener('click', function () {
            if (this.disabled) return;
            danh_diem_danh_in_iframe();

        });
        document.getElementById('btn-thiluyen').addEventListener('click', function () {
            if (this.disabled) return;
            danh_thi_luyen_in_iframe();

        });
        document.getElementById('btn-bicanh').addEventListener('click', function () {
            if (this.disabled) return;
            danh_bi_canh_in_iframe();

        });
        document.getElementById('btn-tele').addEventListener('click', function () {
            if (this.disabled) return;
            danh_te_le_in_iframe();

        });
        document.getElementById('btn-khoangmach').addEventListener('click', function () {
            if (this.disabled) return;
            danh_khoang_mach_in_iframe();

        });
        document.getElementById('btn-tienduyen').addEventListener('click', function () {
            if (this.disabled) return;
            danh_tien_duyen_in_iframe();

        });
    }

    function toggleControlPanel() {
        createControlPanel();
        var panel = document.getElementById('auto-control-panel');
        if (!panel) return;

        var isVisible = panel.style.display === 'block';
        if (isVisible) {
            panel.style.display = 'none';
        } else {
            var taskBtn = document.getElementById('open-auto-menu');
            if (taskBtn) {
                var rect = taskBtn.getBoundingClientRect();
                var panelWidth = 200; // hoặc panel.offsetWidth nếu đã render
                var left = rect.left;
                // Nếu panel vượt quá màn hình, dịch sang trái
                if (left + panelWidth > window.innerWidth) {
                    left = window.innerWidth - panelWidth - 10;
                }
                panel.style.top = (rect.bottom + 5) + 'px';
                panel.style.left = left + 'px';
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
            }
            panel.style.display = 'block';
            updateButtonStates();
        }

        var button = document.getElementById('open-auto-menu');
        if (button) {
            button.setAttribute('aria-expanded', String(!isVisible));
        }
    }

    function updateButtonStates() {
        var hoangvucBtn = document.getElementById('btn-hoangvuc');
        var phucloi_btn = document.getElementById('btn-phucloi');
        var diemdanh_btn = document.getElementById('btn-diemandanh');
        var tele_btn = document.getElementById('btn-tele');
        var khoangmach_btn = document.getElementById('btn-khoangmach');
        var thiluyen_btn = document.getElementById('btn-thiluyen');
        var bicanh_btn = document.getElementById('btn-bicanh');
        var tienduyen_btn = document.getElementById('btn-tienduyen');

        if (hoangvucBtn) {
            if (localStorage.getItem('hoangvuc_done') === getToday()) {
                hoangvucBtn.disabled = true;
            } else {
                hoangvucBtn.disabled = false;
            }
        }

        if (phucloi_btn) {
            if (localStorage.getItem('phucloi_done') === getToday()) {
                phucloi_btn.disabled = true;
            } else {
                phucloi_btn.disabled = false;
            }
        }

        if (diemdanh_btn) {
            if (localStorage.getItem('diemdanh_done') === getToday()) {
                diemdanh_btn.disabled = true;
            } else {
                diemdanh_btn.disabled = false;
            }
        }

        if (thiluyen_btn) {
            if (localStorage.getItem('thiluyen_done') === getToday()) {
                thiluyen_btn.disabled = true;
            } else {
                thiluyen_btn.disabled = false;
            }
        }

        if (bicanh_btn) {
            if (localStorage.getItem('bicanh_done') === getToday()) {
                bicanh_btn.disabled = true;
            } else {
                bicanh_btn.disabled = false;
            }
        }

        if (tele_btn) {
            if (localStorage.getItem('tele_done') === getToday()) {
                tele_btn.disabled = true;
            } else {
                tele_btn.disabled = false;
            }
        }

        if (khoangmach_btn) {
            if (localStorage.getItem('khoangmach_done') === getToday()) {
                khoangmach_btn.disabled = true;
            } else {
                khoangmach_btn.disabled = false;
            }
        }

        var vandap_btn = document.getElementById('btn-vandap');
        if (vandap_btn) {
            if (localStorage.getItem('vandap_done') === getToday()) {
                vandap_btn.disabled = true;
            } else {
                vandap_btn.disabled = false;
            }
        }

        var tienduyen_btn = document.getElementById('btn-tienduyen');
        if (tienduyen_btn) {
            if (localStorage.getItem('tienduyen_done') === getToday()) {
                tienduyen_btn.disabled = true;
            } else {
                tienduyen_btn.disabled = false;
            }
        }
    }

    function createAutoMenuButton() {
        if (document.getElementById('open-auto-menu')) {
            return;
        }

        // Tìm container nav-items và chèn sau Thông báo
        var navItems = document.querySelector('.nav-items');
        if (!navItems) {
            return;
        }

        // Tìm div load-notification (Thông báo)
        var notifDiv = navItems.querySelector('.load-notification');

        // Nếu không có icon thông báo thì không hiện Auto Menu
        if (!notifDiv) {
            return;
        }

        // Tạo Auto Menu button
        var wrapper = document.createElement('div');
        wrapper.className = 'load-notification relative';
        wrapper.innerHTML = '<a href="#" id="open-auto-menu" data-view="hide"><div><span class="material-icons-round1 material-icons-menu">🗐</span></div><span class="nav-label">Auto</span></a>';

        // Chèn sau Thông báo
        if (notifDiv && notifDiv.nextSibling) {
            navItems.insertBefore(wrapper, notifDiv.nextSibling);
        } else {
            navItems.appendChild(wrapper);
        }

        var style = document.createElement('style');
        style.textContent = `
            #open-auto-menu,
            #open-auto-menu * {
                font-size: 12px;
                -webkit-tap-highlight-color: rgba(0,0,0,0);
                font-family: var(--font-family, 'Montserrat', sans-serif);
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
                color: var(--text, hsla(0,0%,100%,.9));
                transition: background 200ms ease, transform 200ms ease;
            }
            .load-notification.relative #open-auto-menu:hover {
                background: rgba(255,255,255,0.16);
                transform: translateY(-1px);
            }
            .load-notification.relative #open-auto-menu .material-icons-menu {
                font-size: 18px;
                color: var(--text, hsla(0,0%,100%,.9));
            }
            .load-notification.relative #open-auto-menu .nav-label {
                font-size: 12px;
                line-height: 1;
                color: var(--text, hsla(0,0%,100%,.9));
            }
        `;
        document.head.appendChild(style);

        wrapper.addEventListener('click', function (event) {
            event.preventDefault();
            toggleControlPanel();
        });
    }


    function getOrCreateIframe(iframeId, url, onLoad) {
        var existingOpenIframe = document.querySelector('iframe[data-auto-menu-iframe="true"]');
        if (existingOpenIframe && existingOpenIframe.id !== iframeId) {
            showTempAlert('Vui lòng đóng iframe đang mở trước khi mở tác vụ mới');
            return false;
        }

        function removeIframe() {
            if (iframe && document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
            if (activeAutoIframeId === iframeId) {
                activeAutoIframeId = null;
            }
        }

        function scheduleClose(delay) {
            setTimeout(removeIframe, delay);
        }

        function handleLoad(doc) {
            var result = onLoad(doc, removeIframe);
            if (result === true) {
                removeIframe();
            } else {
                scheduleClose(100 * 1000);
            }
        }

        var iframe = document.getElementById(iframeId);
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.dataset.autoMenuIframe = 'true';
            iframe.id = iframeId;
            iframe.style.display = 'none';
            iframe.style.position = 'fixed';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.width = '800px';
            iframe.style.height = '100vh';
            iframe.style.zIndex = '99999';
            iframe.src = url;
            iframe.onload = function () {
                var doc = iframe.contentDocument || iframe.contentWindow.document;

                // Listen for notifications in iframe and send to parent
                var observer = new MutationObserver(function () {
                    var toasts = doc.querySelectorAll('.notifications .toast');
                    toasts.forEach(function (toast) {
                        if (!toast.dataset.sentToParent) {
                            toast.dataset.sentToParent = 'true';
                            var text = toast.textContent.trim();
                            if (text) {
                                var type = toast.classList.contains('error') ? 'error' : 'success';
                                window.parent.postMessage({
                                    type: 'iframe-notification',
                                    message: text,
                                    notificationType: type
                                }, '*');
                            }
                        }
                    });
                });

                observer.observe(doc.body, { childList: true, subtree: true });
                handleLoad(doc);
            };
            document.body.appendChild(iframe);
            activeAutoIframeId = iframeId;
            return true;
        }

        if (iframe.src.indexOf(url) === -1) {
            iframe.src = url;
        }

        if (iframe.contentDocument) {
            handleLoad(iframe.contentDocument);
        } else {
            iframe.onload = function () {
                var doc = iframe.contentDocument || iframe.contentWindow.document;

                var observer = new MutationObserver(function () {
                    var toasts = doc.querySelectorAll('.notifications .toast');
                    toasts.forEach(function (toast) {
                        if (!toast.dataset.sentToParent) {
                            toast.dataset.sentToParent = 'true';
                            var text = toast.textContent.trim();
                            if (text) {
                                var type = toast.classList.contains('error') ? 'error' : 'success';
                                window.parent.postMessage({
                                    type: 'iframe-notification',
                                    message: text,
                                    notificationType: type
                                }, '*');
                            }
                        }
                    });
                });

                observer.observe(doc.body, { childList: true, subtree: true });
                handleLoad(doc);
            };
        }

        activeAutoIframeId = iframeId;
        return true;
    }

    function danh_hoang_vuc_in_iframe() {
        if (!getOrCreateIframe('hoangvuc-frame', hoangvuc, function (doc, closeIframe) {
            var result = danh_hoang_vuc(doc, closeIframe);
            setTimeout(function () {
                updateButtonStates();
            }, 100);
            return result;
        })) {
            return;
        }
        resetTimer('hoangvuc');
    }
    function danh_phuc_loi_in_iframe() {
        if (!getOrCreateIframe('phucloi-frame', phucloi, function (doc, closeIframe) {
            var result = danh_phuc_loi(doc, closeIframe);
            setTimeout(function () {
                updateButtonStates();
            }, 100);
            return result;
        })) {
            return;
        }
        resetTimer('phucloi');
    }
    function danh_khoang_mach_in_iframe() {
        if (!getOrCreateIframe('khoangmach-frame', khoangmach, function (doc, closeIframe) {
            var result = danh_khoang_mach(doc, closeIframe);
            setTimeout(function () {
                updateButtonStates();
            }, 100);
            return result;
        })) {
            return;
        }
        resetTimer('khoangmach');
    }
    function danh_diem_danh_in_iframe() {
        if (!getOrCreateIframe('diemdanh-frame', diemdanh, function (doc, closeIframe) {
            var result = danh_diem_danh(doc, closeIframe);
            setTimeout(function () {
                updateButtonStates();
            }, 100);
            return result;
        })) {
            return;
        }
        // No timer reset needed for điểm danh, it uses fixed interval logic.
    }
    function danh_thi_luyen_in_iframe() {
        if (!getOrCreateIframe('thiluyen-frame', thiluyen, function (doc, closeIframe) {
            var result = danh_thi_luyen(doc, closeIframe);
            setTimeout(function () {
                updateButtonStates();
            }, 100);
            return result;
        })) {
            return;
        }
        resetTimer('thiluyen');
    }

    function danh_bi_canh_in_iframe() {
        if (!getOrCreateIframe('bicanh-frame', bicanh, function (doc, closeIframe) {
            var result = danh_bi_canh(doc, closeIframe);
            setTimeout(function () {
                updateButtonStates();
            }, 100);
            return result;
        })) {
            return;
        }
        resetTimer('bicanh');
    }
    function danh_te_le_in_iframe() {
        if (!getOrCreateIframe('tele-frame', tele, function (doc, closeIframe) {
            var result = danh_te_le(doc, closeIframe);
            setTimeout(function () {
                updateButtonStates();
            }, 100);
            return result;
        })) {
            return;
        }
        resetTimer('tele');
    }

    function danh_tien_duyen_in_iframe() {
        if (!getOrCreateIframe('tienduyen-frame', tienduyen, function (doc, closeIframe) {
            var result = danh_tien_duyen(doc, closeIframe);
            setTimeout(function () {
                updateButtonStates();
            }, 100);
            return result;
        })) {
            return;
        }
        resetTimer('tienduyen');
    }

    function deleteLocalStorageKeys() {
        if (getToday() !== localStorage.getItem('diemdanh_done')) {
            localStorage.removeItem('hoangvuc_done');
            localStorage.removeItem('phucloi_done');
            localStorage.removeItem('tele_done');
            localStorage.removeItem('khoangmach_done');
            localStorage.removeItem('thiluyen_done');
            localStorage.removeItem('tienduyen_done');
            localStorage.removeItem('bicanh_done');
            localStorage.removeItem('vandap_done');
            localStorage.removeItem('diemdanh_done');
        }
    }


    function autoClickOnLoad() {
        // Initialize timers
        initTimers();

        // Start timer display
        updateTimerDisplay();
        setInterval(updateTimerDisplay, 500);

        // Run task timers every second
        setInterval(runTaskTimers, 500);

        // Update button states every 4m
        setInterval(function () {
            updateButtonStates();
        }, 1000);
    }

    // Timer configuration
    var taskIntervals = [
        { name: 'hoangvuc', label: 'Hoàng Vực', time: 15 * 60 * 1000 + 30000, func: danh_hoang_vuc_in_iframe },
        { name: 'phucloi', label: 'Phúc Lợi', time: 30 * 60 * 1000 + 30000, func: danh_phuc_loi_in_iframe },
        { name: 'thiluyen', label: 'Thí Luyện', time: 30 * 60 * 1000 + 30000, func: danh_thi_luyen_in_iframe },
        { name: 'bicanh', label: 'Bí Cảnh', time: 7 * 60 * 1000 + 30000, func: danh_bi_canh_in_iframe },
        { name: 'khoangmach', label: 'Khoáng Mạch', time: 5 * 60 * 1000 + 30000, func: danh_khoang_mach_in_iframe },
        { name: 'diemdanh', label: 'Điểm Danh', time: 10 * 1000, func: danh_diem_danh_in_iframe },
        { name: 'tele', label: 'Tề Lễ', time: 10 * 1000, func: danh_te_le_in_iframe },
        { name: 'tienduyen', label: 'Tiên Duyên', time: 30 * 1000, func: danh_tien_duyen_in_iframe }
    ];

    function initTimers() {
        // Initialize each task timer if not exists
        taskIntervals.forEach(function (task) {
            var key = 'task_timer_' + task.name;
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, Date.now());
            }
        });
    }

    function updateTimerDisplay() {
        var timerDisplay = document.getElementById('timer-display');
        if (!timerDisplay) return;

        var html = '';
        taskIntervals.forEach(function (task) {
            // Nếu task đã done hôm nay, ẩn khỏi timer
            if (localStorage.getItem(task.name + '_done') === getToday()) {
                return; // Không hiển thị gì cả
            }

            var taskTimer = parseInt(localStorage.getItem('task_timer_' + task.name)) || Date.now();
            var elapsed = Date.now() - taskTimer;
            var remaining = task.time - elapsed;

            if (remaining <= 0) {
                // Timer expired, show ready
                html += '<div class="timer-row"><span>' + task.label + '</span><span style="color: #4ade80;">Ready</span></div>';
            } else {
                var mins = Math.floor(remaining / 60000);
                var secs = Math.floor((remaining % 60000) / 1000);
                html += '<div class="timer-row"><span>' + task.label + '</span><span>' + mins + 'p' + secs + 's</span></div>';
            }
        });

        timerDisplay.innerHTML = html;
    }

    function runTaskTimers() {
    // Nếu đang có iframe mở thì bỏ qua
    if (document.querySelector('iframe[data-auto-menu-iframe="true"]')) return;

    var readyTask = taskIntervals.find(function (task) {
        if (localStorage.getItem(task.name + '_done') === getToday()) return false;
        var taskTimer = parseInt(localStorage.getItem('task_timer_' + task.name)) || Date.now();
        return Date.now() - taskTimer >= task.time;
    });

    if (readyTask) {
        readyTask.func();
        localStorage.setItem('task_timer_' + readyTask.name, Date.now());
    }
}

    function resetTimer(taskName) {
        var key = 'task_timer_' + taskName;
        if (localStorage.getItem(key)) {
            localStorage.setItem(key, Date.now());
        }
    }

    // Listen for notifications from iframes
    window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'iframe-notification') {
            showTempAlert(event.data.message, event.data.notificationType, true);
        }
    });

    if (window.location.hostname === 'hoathinh3d.co') {
        // Chạy khi trang load lần đầu
        window.addEventListener('load', function () {
            initializeAutoMenu();
        });

        // Chạy lại khi hash thay đổi (URL có #)
        window.addEventListener('hashchange', function () {
            initializeAutoMenu();
        });

        // Backup: thử chạy sau một khoảng delay nếu load event đã xảy ra
        setTimeout(function () {
            if (!document.getElementById('auto-control-panel')) {
                initializeAutoMenu();
            }
        }, 3000);
    }


    function initializeAutoMenu() {
        deleteLocalStorageKeys();
        createControlPanel();
        createAutoMenuButton();
        updateButtonStates();
        autoClickOnLoad();

    }

})();