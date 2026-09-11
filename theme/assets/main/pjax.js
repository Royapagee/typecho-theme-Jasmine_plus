/**
 * Jasmine_Plus PJAX v2 — 轻量级无刷新页面切换
 *
 * 改进点：
 *  - AbortController 取消竞态请求
 *  - 滚动位置记忆 / popstate 恢复
 *  - 内联 <script> 重执行
 *  - 搜索表单拦截 (GET)
 *  - Hover prefetch 预加载
 *  - <head> meta 同步
 *  - 平滑淡入淡出过渡
 */
(function () {
    'use strict';

    // ─── 状态 ───────────────────────────────────────────────
    var currentController = null;   // 当前正在进行的 fetch 的 AbortController
    var prefetchCache = {};         // { url: { html, ts } }
    var PREFETCH_TTL = 30000;       // 预加载缓存有效期 30s
    var hoverTimer = null;          // hover debounce timer
    var hoverUrl = null;            // 当前 hover 预加载的 URL

    // ─── 进度条 ─────────────────────────────────────────────
    var progressEl = null;
    var progressTimer = null;

    function createProgress() {
        if (!progressEl) {
            progressEl = document.createElement('div');
            progressEl.id = 'pjax-progress';
            document.body.appendChild(progressEl);
        }
    }

    function startProgress() {
        createProgress();
        if (progressTimer) clearTimeout(progressTimer);

        progressEl.classList.remove('active');
        progressEl.style.transition = 'none';
        progressEl.style.width = '0%';
        progressEl.style.removeProperty('opacity');

        // 强制重排
        void progressEl.offsetHeight;

        progressEl.classList.add('active');
        progressEl.style.transition = 'width 0.4s ease-out, opacity 0.4s ease-out';

        // 快速冲到 60%
        progressTimer = setTimeout(function () {
            if (progressEl && progressEl.classList.contains('active')) {
                progressEl.style.width = '60%';
            }
        }, 100);
    }

    function endProgress() {
        if (!progressEl) return;
        if (progressTimer) clearTimeout(progressTimer);

        progressEl.style.width = '100%';
        progressEl.style.opacity = '0';
        progressEl.classList.remove('active');

        progressTimer = setTimeout(function () {
            if (progressEl) {
                progressEl.style.transition = 'none';
                progressEl.style.width = '0%';
            }
        }, 400);
    }

    // ─── 链接判断 ───────────────────────────────────────────
    function shouldPjaxLink(link) {
        if (!link || !link.href) return false;

        var href = link.getAttribute('href');
        if (!href) return false;
        if (href.charAt(0) === '#') return false;
        if (href.indexOf('javascript:') === 0) return false;
        if (href.indexOf('mailto:') === 0) return false;
        if (href.indexOf('tel:') === 0) return false;
        if (link.getAttribute('data-no-pjax') !== null) return false;
        if (link.target === '_blank') return false;
        if (link.hostname !== location.hostname) return false;

        var dl = link.getAttribute('download');
        if (dl !== null && dl !== false) return false;

        if (link.pathname.indexOf('/admin') === 0) return false;
        if (link.pathname.indexOf('/action/') === 0) return false;

        return true;
    }

    // ─── Prefetch（hover 预加载）─────────────────────────────
    function onLinkMouseEnter(e) {
        var link = e.target.closest('a');
        if (!link || !shouldPjaxLink(link)) return;

        var url = link.href;
        // 跳过已缓存且未过期的
        if (prefetchCache[url] && (Date.now() - prefetchCache[url].ts < PREFETCH_TTL)) return;

        hoverUrl = url;
        if (hoverTimer) clearTimeout(hoverTimer);

        hoverTimer = setTimeout(function () {
            if (hoverUrl !== url) return; // 鼠标已移走
            fetchPage(url).then(function (html) {
                if (html) {
                    prefetchCache[url] = { html: html, ts: Date.now() };
                }
            }).catch(function () { /* 静默失败 */ });
        }, 65);
    }

    function onLinkMouseLeave(e) {
        var link = e.target.closest('a');
        if (link) {
            hoverUrl = null;
            if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
        }
    }

    // ─── 网络请求 ────────────────────────────────────────────
    function fetchPage(url, signal) {
        return fetch(url, {
            method: 'GET',
            headers: {
                'X-PJAX': 'true',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'same-origin',
            signal: signal || undefined
        })
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
        });
    }

    // ─── 滚动位置管理 ────────────────────────────────────────
    function saveScrollPosition() {
        var state = history.state || {};
        state.scrollY = window.scrollY || window.pageYOffset || 0;
        history.replaceState(state, '');
    }

    // ─── <head> 元信息同步 ───────────────────────────────────
    function syncHead(doc) {
        // 同步 title
        var newTitle = doc.querySelector('title');
        if (newTitle) {
            document.title = newTitle.textContent;
        }

        // 同步 meta description
        var newDesc = doc.querySelector('meta[name="description"]');
        var curDesc = document.querySelector('meta[name="description"]');
        if (newDesc && curDesc) {
            curDesc.setAttribute('content', newDesc.getAttribute('content') || '');
        } else if (newDesc && !curDesc) {
            document.head.appendChild(newDesc.cloneNode(true));
        }

        // 同步 link canonical
        var newCanon = doc.querySelector('link[rel="canonical"]');
        var curCanon = document.querySelector('link[rel="canonical"]');
        if (newCanon && curCanon) {
            curCanon.setAttribute('href', newCanon.getAttribute('href') || '');
        } else if (newCanon && !curCanon) {
            document.head.appendChild(newCanon.cloneNode(true));
        } else if (!newCanon && curCanon) {
            curCanon.parentNode.removeChild(curCanon);
        }
    }

    // ─── 内联脚本重执行 ──────────────────────────────────────
    function executeScripts(container) {
        var scripts = container.querySelectorAll('script');
        for (var i = 0; i < scripts.length; i++) {
            var oldScript = scripts[i];

            // 跳过外部脚本（已由 <head> 全局加载的库）
            if (oldScript.src) continue;

            // 跳过 type 不是 JS 的
            var type = oldScript.getAttribute('type');
            if (type && type !== 'text/javascript' && type !== 'application/javascript' && type !== '') continue;

            var newScript = document.createElement('script');
            // 复制属性
            for (var j = 0; j < oldScript.attributes.length; j++) {
                var attr = oldScript.attributes[j];
                newScript.setAttribute(attr.name, attr.value);
            }
            newScript.textContent = oldScript.textContent;

            oldScript.parentNode.replaceChild(newScript, oldScript);
        }
    }

    // ─── 淡入淡出过渡 ────────────────────────────────────────
    function fadeOut(el) {
        return new Promise(function (resolve) {
            if (!el) { resolve(); return; }
            el.classList.add('pjax-fade-out');
            // 等待 CSS transition 完成
            setTimeout(resolve, 180);
        });
    }

    function fadeIn(el) {
        if (!el) return;
        el.classList.add('pjax-fade-in');
        // 强制重排后移除触发类，让动画播放
        void el.offsetHeight;
        el.classList.remove('pjax-fade-in');
        el.classList.add('pjax-fade-in-active');
        setTimeout(function () {
            el.classList.remove('pjax-fade-in-active');
        }, 250);
    }

    // ─── 核心导航 ────────────────────────────────────────────
    function navigateTo(url, pushState) {
        // 同页面点击：不重复加载，仅滚顶
        if (url === location.href) {
            window.scrollTo(0, 0);
            return;
        }

        // 取消上一个未完成的请求
        if (currentController) {
            currentController.abort();
            currentController = null;
        }

        // 保存当前页面的滚动位置
        saveScrollPosition();

        // 关闭移动端 offcanvas
        var openOffcanvas = document.querySelector('.offcanvas.show');
        if (openOffcanvas && typeof bootstrap !== 'undefined' && bootstrap.Offcanvas) {
            var inst = bootstrap.Offcanvas.getInstance(openOffcanvas);
            if (inst) inst.hide();
        }

        // 加载指示
        document.body.style.cursor = 'wait';
        startProgress();

        var curMiddle = document.getElementById('middle');
        var curRight = document.getElementById('right');

        // 淡出当前内容
        var fadeOutPromise = Promise.all([fadeOut(curMiddle), fadeOut(curRight)]);

        // 检查 prefetch 缓存
        var cached = prefetchCache[url];
        var htmlPromise;
        if (cached && (Date.now() - cached.ts < PREFETCH_TTL)) {
            htmlPromise = Promise.resolve(cached.html);
            delete prefetchCache[url]; // 使用后清除
        } else {
            currentController = new AbortController();
            htmlPromise = fetchPage(url, currentController.signal);
        }

        // 等待淡出 + 数据就绪
        Promise.all([fadeOutPromise, htmlPromise])
            .then(function (results) {
                var html = results[1];
                currentController = null;

                var parser = new DOMParser();
                var doc = parser.parseFromString(html, 'text/html');

                // 同步 <head>
                syncHead(doc);

                // 提取新页面关键区域
                var newMiddle = doc.getElementById('middle');
                var newRight = doc.getElementById('right');

                if (!newMiddle || !curMiddle) {
                    throw new Error('PJAX container not found');
                }



                // 替换内容
                curMiddle.innerHTML = newMiddle.innerHTML;
                if (newRight && curRight) {
                    curRight.innerHTML = newRight.innerHTML;
                }



                // 执行新容器中的内联脚本
                executeScripts(curMiddle);
                if (curRight) executeScripts(curRight);

                // 移除淡出类
                curMiddle.classList.remove('pjax-fade-out');
                if (curRight) curRight.classList.remove('pjax-fade-out');

                // 淡入新内容
                fadeIn(curMiddle);
                if (curRight) fadeIn(curRight);

                // 更新 URL
                if (pushState) {
                    history.pushState({ scrollY: 0 }, '', url);
                }

                // 滚动处理
                if (pushState) {
                    // 新导航 → 回到顶部
                    window.scrollTo(0, 0);
                }
                // popstate 的滚动在 onPopState 中处理

                // 触发 PJAX 完成事件
                window.dispatchEvent(new Event('pjax:complete'));

                // 重新初始化页面组件
                if (typeof initPageComponents === 'function') {
                    initPageComponents();
                }


            })
            .catch(function (err) {
                if (err.name === 'AbortError') {
                    // 请求被新导航取消，正常行为，不处理
                    return;
                }
                console.warn('PJAX navigation failed, falling back to full load:', err);
                location.href = url;
            })
            .finally(function () {
                currentController = null;
                document.body.style.cursor = '';
                endProgress();
                // 确保淡出类被清理（异常时兜底）
                if (curMiddle) curMiddle.classList.remove('pjax-fade-out');
                if (curRight) curRight.classList.remove('pjax-fade-out');
            });
    }

    // ─── popstate（前进/后退）───────────────────────────────
    function onPopState(e) {
        var targetScroll = (e.state && typeof e.state.scrollY === 'number') ? e.state.scrollY : 0;

        // 取消进行中的请求
        if (currentController) {
            currentController.abort();
            currentController = null;
        }

        // 自定义 navigateTo 的行为：不 pushState，完成后恢复滚动
        var url = location.href;

        // 关闭 offcanvas
        var openOffcanvas = document.querySelector('.offcanvas.show');
        if (openOffcanvas && typeof bootstrap !== 'undefined' && bootstrap.Offcanvas) {
            var inst = bootstrap.Offcanvas.getInstance(openOffcanvas);
            if (inst) inst.hide();
        }

        document.body.style.cursor = 'wait';
        startProgress();

        var curMiddle = document.getElementById('middle');
        var curRight = document.getElementById('right');

        var fadeOutPromise = Promise.all([fadeOut(curMiddle), fadeOut(curRight)]);

        currentController = new AbortController();
        var htmlPromise = fetchPage(url, currentController.signal);

        Promise.all([fadeOutPromise, htmlPromise])
            .then(function (results) {
                var html = results[1];
                currentController = null;

                var parser = new DOMParser();
                var doc = parser.parseFromString(html, 'text/html');

                syncHead(doc);

                var newMiddle = doc.getElementById('middle');
                var newRight = doc.getElementById('right');

                if (!newMiddle || !curMiddle) {
                    throw new Error('PJAX container not found');
                }



                curMiddle.innerHTML = newMiddle.innerHTML;
                if (newRight && curRight) {
                    curRight.innerHTML = newRight.innerHTML;
                }



                executeScripts(curMiddle);
                if (curRight) executeScripts(curRight);

                curMiddle.classList.remove('pjax-fade-out');
                if (curRight) curRight.classList.remove('pjax-fade-out');

                fadeIn(curMiddle);
                if (curRight) fadeIn(curRight);

                // 恢复滚动位置
                window.scrollTo(0, targetScroll);

                window.dispatchEvent(new Event('pjax:complete'));

                if (typeof initPageComponents === 'function') {
                    initPageComponents();
                }

            })
            .catch(function (err) {
                if (err.name === 'AbortError') return;
                console.warn('PJAX popstate failed, falling back:', err);
                location.href = url;
            })
            .finally(function () {
                currentController = null;
                document.body.style.cursor = '';
                endProgress();
                if (curMiddle) curMiddle.classList.remove('pjax-fade-out');
                if (curRight) curRight.classList.remove('pjax-fade-out');
            });
    }

    // ─── 点击事件委托 ────────────────────────────────────────
    function onDocumentClick(e) {
        var link = e.target.closest('a');
        if (!link) return;
        if (!shouldPjaxLink(link)) return;

        // 保留原生多选键行为
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

        e.preventDefault();
        navigateTo(link.href, true);
    }

    // ─── 搜索表单拦截 ────────────────────────────────────────
    function onFormSubmit(e) {
        var form = e.target;
        if (!form || form.tagName !== 'FORM') return;

        // 只拦截含 name="s" 的搜索表单
        var input = form.querySelector('input[name="s"]');
        if (!input) return;

        var keyword = (input.value || '').trim();
        if (!keyword) return;

        e.preventDefault();

        // 构造 Typecho 搜索 URL: /search/关键词/
        var baseUrl = location.protocol + '//' + location.host;
        var searchUrl = baseUrl + '/search/' + encodeURIComponent(keyword) + '/';
        navigateTo(searchUrl, true);
    }

    // ─── 滚动位置定期保存 ─────────────────────────────────────
    var scrollSaveTimer = null;
    function onScroll() {
        if (scrollSaveTimer) return;
        scrollSaveTimer = setTimeout(function () {
            scrollSaveTimer = null;
            saveScrollPosition();
        }, 300);
    }

    // ─── 初始化 ──────────────────────────────────────────────
    function initPjax() {
        // 点击导航
        document.addEventListener('click', onDocumentClick);

        // 前进/后退
        window.addEventListener('popstate', onPopState);

        // 搜索表单
        document.addEventListener('submit', onFormSubmit);

        // hover 预加载
        document.addEventListener('mouseenter', onLinkMouseEnter, true);
        document.addEventListener('mouseleave', onLinkMouseLeave, true);

        // 滚动位置保存
        window.addEventListener('scroll', onScroll, { passive: true });

        // 初始化当前页面的 history state
        history.replaceState({ scrollY: window.scrollY || 0 }, '');
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPjax);
    } else {
        initPjax();
    }
})();
