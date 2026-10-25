/* ══════════ Bloco JS 1 (original) ══════════ */
        // ── ENGINE DE ÁUDIO 8-BIT RAIZ (CHIPTUNE) ──
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        let masterVolume = 1.0; // Controlado pelo slider
        
        // 🔥 MULTIPLICADOR GERAL DE VOLUME (Mude aqui para aumentar/diminuir TUDO)
        let globalVolumeScale = 10.5; 
        
        let _activeVoices = 0; const MAX_VOICES = 28; const _lastPlay = {}; const _noiseCache = {};
        const _canPlay = (key, gap = 30) => {
            if (_activeVoices >= MAX_VOICES) return false;
            const now = performance.now();
            if (now - (_lastPlay[key] || 0) < gap) return false;
            _lastPlay[key] = now; return true;
        };

        const playTone = (freq, type, duration, vol=0.1, slideFreq=0) => {
            if(masterVolume <= 0 || audioCtx.state === 'suspended') {
                if(audioCtx.state === 'suspended' && masterVolume > 0) audioCtx.resume();
                else return;
            }
            if (!_canPlay('t' + type + freq)) return;
            let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
            osc.type = type; osc.connect(gain); gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            if(slideFreq > 0) osc.frequency.exponentialRampToValueAtTime(slideFreq, audioCtx.currentTime + duration);

            // Aqui a mágica acontece: multiplica o volume da carta pelo multiplicador global e pelo slider
            gain.gain.setValueAtTime(vol * globalVolumeScale * masterVolume, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

            _activeVoices++;
            osc.onended = () => { _activeVoices--; osc.disconnect(); gain.disconnect(); };
            osc.start(); osc.stop(audioCtx.currentTime + duration);
        };

        const playNoise = (duration, vol=0.1, lowpassFreq=5000) => {
            if(masterVolume <= 0 || audioCtx.state === 'suspended') {
                if(audioCtx.state === 'suspended' && masterVolume > 0) audioCtx.resume();
                else return;
            }
            if (!_canPlay('n' + duration + lowpassFreq)) return;
            // buffer de ruído gerado uma única vez por duração (antes era recriado a cada som)
            let buffer = _noiseCache[duration];
            if (!buffer) {
                const bufferSize = Math.floor(audioCtx.sampleRate * duration);
                buffer = _noiseCache[duration] = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0); for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            }
            let noise = audioCtx.createBufferSource(); noise.buffer = buffer;
            let filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass';
            filter.frequency.setValueAtTime(lowpassFreq, audioCtx.currentTime); filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + duration);

            let gain = audioCtx.createGain();
            // Mesma coisa aqui pro ruído
            gain.gain.setValueAtTime(vol * globalVolumeScale * masterVolume, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

            noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
            _activeVoices++;
            noise.onended = () => { _activeVoices--; noise.disconnect(); filter.disconnect(); gain.disconnect(); };
            noise.start();
        };
        
        const SFX = {
            ui_hover:  () => playTone(800, 'square', 0.05, 0.03),
            ui_click:  () => playTone(1200, 'square', 0.1, 0.05, 1800),
            ui_error:  () => playTone(150, 'sawtooth', 0.2, 0.05, 100),
            coin:      () => { playTone(988, 'square', 0.1, 0.05); setTimeout(()=>playTone(1319, 'square', 0.2, 0.05), 100); },
            card_drop: () => playTone(200, 'triangle', 0.1, 0.08, 100),
            shoot_gatling: () => playTone(600, 'square', 0.1, 0.04, 200),
            shoot_sniper:  () => playNoise(0.3, 0.15, 1500),
            shoot_tesla:   () => { playTone(800, 'square', 0.05, 0.04, 400); setTimeout(()=>playTone(1000, 'square', 0.05, 0.04, 600), 40); },
            hit_normal: () => playNoise(0.1, 0.08, 3000),
            kill_enemy: () => { playNoise(0.2, 0.1, 2000); playTone(300, 'sawtooth', 0.2, 0.05, 50); },
            build:      () => playTone(150, 'square', 0.1, 0.05, 50),
            base_dmg:   () => playTone(100, 'sawtooth', 0.4, 0.1, 50)
        };

        class Pixel {
            constructor(canvas, context, x, y, color, speed, delay) {
                this.width = canvas.width; this.height = canvas.height; this.ctx = context;
                this.x = x; this.y = y; this.color = color;
                this.speed = (Math.random() * 0.4 + 0.2) * speed;  
                this.sizeStep = Math.random() * 0.2 + 0.1; 
                this.size = 0;
                this.minSize = 0.5; this.maxSizeInteger = 1.8;
                this.maxSize = Math.random() * (this.maxSizeInteger - this.minSize) + this.minSize;
                this.delay = delay * 0.3; 
                this.counter = 0;
                this.counterStep = Math.random() * 5 + (this.width + this.height) * 0.02; 
                this.isIdle = false; this.isReverse = false; this.isShimmer = false;
                this.counter_disappear = 0;
            }
            draw() {
                const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
                this.ctx.fillStyle = this.color;
                this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
            }
            appear() {
                this.isIdle = false; this.counter_disappear = 0;
                if (this.counter <= this.delay) { this.counter += this.counterStep; return; }
                if (this.size >= this.maxSize) this.isShimmer = true;
                if (this.isShimmer) this.shimmer(); else this.size += this.sizeStep;
                this.draw();
            }
            disappear() {
                this.isShimmer = false;
                if (this.counter_disappear === undefined) this.counter_disappear = 0;
                if (this.counter_disappear <= this.delay) {
                    this.counter_disappear += this.counterStep * 1.5; 
                    this.draw(); return;
                }
                if (this.size <= 0) { this.isIdle = true; return; } 
                else { this.size -= 0.15; } 
                this.draw();
            }
            shimmer() {
                if (this.size >= this.maxSize) this.isReverse = true;
                else if (this.size <= this.minSize) this.isReverse = false;
                if (this.isReverse) this.size -= this.speed; else this.size += this.speed;
            }
        }

        const activePixelAnimations = new Set();

        function initPixelCard(cardEl, canvasEl, colorsHex) {
            const ctx = canvasEl.getContext('2d');
            let pixels = []; let animationFrame = null; let timePrevious = performance.now();
            const gap = 6; const speed = 0.18; const colorsArray = colorsHex.split(',');

            function initPixels() {
                const rect = cardEl.getBoundingClientRect();
                if(rect.width === 0) return; 
                const width = Math.floor(rect.width); const height = Math.floor(rect.height);
                canvasEl.width = width; canvasEl.height = height;
                pixels = [];
                for (let x = 0; x < width; x += gap) {
                    for (let y = 0; y < height; y += gap) {
                        const color = colorsArray[Math.floor(Math.random() * colorsArray.length)];
                        const dx = x - width / 2; const dy = y - height / 2;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        pixels.push(new Pixel(canvasEl, ctx, x, y, color, speed, distance * 1.5));
                    }
                }
            }

            function animate(fnName) {
                animationFrame = requestAnimationFrame(() => animate(fnName));
                const timeNow = performance.now();
                const timePassed = timeNow - timePrevious;
                if (timePassed < 1000 / 60) return;
                timePrevious = timeNow - (timePassed % (1000/60));
                ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
                let allIdle = true;
                for (let i = 0; i < pixels.length; i++) { pixels[i][fnName](); if (!pixels[i].isIdle) allIdle = false; }
                if (allIdle) { cancelAnimationFrame(animationFrame); animationFrame = null; activePixelAnimations.delete(animationFrame); }
            }

            function handleAnimation(name) {
                if(animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
                animationFrame = requestAnimationFrame(() => animate(name));
                activePixelAnimations.add(animationFrame);
            }

            function destroy() {
                if(animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = null; }
                ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
            }

            let pixelTimeout;
            cardEl.addEventListener('mouseenter', () => {
                handleAnimation('appear'); clearTimeout(pixelTimeout);
                pixelTimeout = setTimeout(() => handleAnimation('disappear'), 600);
            });
            cardEl.addEventListener('mouseleave', () => { clearTimeout(pixelTimeout); handleAnimation('disappear'); });

            cardEl._pixelDestroy = destroy;
            setTimeout(initPixels, 100); 
        }

        function applyTiltedCardEffect(el) {
            let rarity = [...el.classList].find(c => ['common','rare','epic','legendary'].includes(c)) || 'common';
            const cfg = {
                common:    { amp: 5,  lift: 5,  scale: 1.03, speed: 0.10 },
                rare:      { amp: 7,  lift: 7,  scale: 1.04, speed: 0.10 },
                epic:      { amp: 9,  lift: 9,  scale: 1.05, speed: 0.09 },
                legendary: { amp: 11, lift: 11, scale: 1.07, speed: 0.08 },
            }[rarity];

            let cur = { rx: 0, ry: 0, scale: 1, lift: 0 };
            let tgt = { rx: 0, ry: 0, scale: 1, lift: 0 };
            let raf = null;
            let inside = false;

            function tick() {
                const sp = cfg.speed;
                cur.rx    += (tgt.rx    - cur.rx)    * sp * 3;
                cur.ry    += (tgt.ry    - cur.ry)    * sp * 3;
                cur.scale += (tgt.scale - cur.scale) * sp * 2;
                cur.lift  += (tgt.lift  - cur.lift)  * sp * 2;

                el.style.transform = `rotateX(${cur.rx.toFixed(3)}deg) rotateY(${cur.ry.toFixed(3)}deg) scale(${cur.scale.toFixed(4)}) translateY(${(-cur.lift).toFixed(2)}px)`;

                const idle = Math.abs(tgt.rx - cur.rx) < 0.01 &&
                             Math.abs(tgt.ry - cur.ry) < 0.01 &&
                             Math.abs(tgt.scale - cur.scale) < 0.0005 &&
                             Math.abs(tgt.lift - cur.lift) < 0.05;

                if(idle && !inside) {
                    cancelAnimationFrame(raf); raf = null;
                    el.style.transform = '';
                    el.style.zIndex = '';
                } else {
                    raf = requestAnimationFrame(tick);
                }
            }

            el.addEventListener('mouseenter', () => {
                inside = true;
                tgt.scale = cfg.scale;
                tgt.lift  = cfg.lift;
                el.style.zIndex = '10';
                if(!raf) raf = requestAnimationFrame(tick);
            });

            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const ox = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
                const oy = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);
                tgt.rx = oy * -cfg.amp;
                tgt.ry = ox * cfg.amp;
                if(!raf) raf = requestAnimationFrame(tick);
            });

            el.addEventListener('mouseleave', () => {
                inside = false;
                tgt.rx = 0; tgt.ry = 0; tgt.scale = 1; tgt.lift = 0;
                el.style.zIndex = '1';
                if(!raf) raf = requestAnimationFrame(tick);
            });
        }

        function applyMagnetEffect(selectors) {
            document.querySelectorAll(selectors).forEach(btn => {
                btn.addEventListener('mousemove', (e) => {
                    if(btn.disabled) return;
                    const rect = btn.getBoundingClientRect();
                    const x = (e.clientX - rect.left - rect.width / 2) * 0.25;
                    const y = (e.clientY - rect.top - rect.height / 2) * 0.25;
                    btn.style.transform = `translate(${x}px, ${y}px)`;
                });
                btn.addEventListener('mouseleave', () => { btn.style.transform = `translate(0px, 0px)`; });
            });
        }

        // ── MOBILE/TOUCH: flag (classe definida no <head>), largura útil do painel lateral e deslocamento do dedo ao arrastar cartas ──
        const NX_TOUCH = document.documentElement.classList.contains('nx-touch');
        const NX_DRAG_DY = NX_TOUCH ? -70 : 0;                       // no toque a carta fica acima do dedo (senão o dedo cobre a torre-alvo)
        const nxDY = e => (e && e.pointerType && e.pointerType !== 'mouse') ? NX_DRAG_DY : 0;
        // desktop: sempre 300 (+extra), exatamente como antes. toque: borda direita REAL do painel (0 se recolhido)
        function nxSideW(extra) {
            extra = extra || 0;
            if (!NX_TOUCH) return 300 + extra;
            const sb = document.getElementById('sidebar'); if (!sb) return 0;
            const r = sb.getBoundingClientRect(); return r.right > 8 ? r.right + extra : 0;
        }
        const cursor = document.getElementById('custom-cursor');
        let cursorTarget = {x: window.innerWidth/2, y: window.innerHeight/2};
        let cursorCurrent = {x: window.innerWidth/2, y: window.innerHeight/2};
        window.addEventListener('mousemove', (e) => { cursorTarget.x = e.clientX; cursorTarget.y = e.clientY; });
        window.addEventListener('keydown', e => { if(!isTutorialActive) keys[e.key.toLowerCase()] = true; }); 
        
        let _cursorRaf = 0;
        function animateCursor() {
            const dx = cursorTarget.x - cursorCurrent.x, dy = cursorTarget.y - cursorCurrent.y;
            cursorCurrent.x += dx * 0.18; cursorCurrent.y += dy * 0.18;
            cursor.style.transform = 'translate3d(' + cursorCurrent.x.toFixed(1) + 'px,' + cursorCurrent.y.toFixed(1) + 'px,0) translate(-50%,-50%)';
            _cursorRaf = (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) ? 0 : requestAnimationFrame(animateCursor);
        }
        window.addEventListener('mousemove', () => { if (!_cursorRaf) _cursorRaf = requestAnimationFrame(animateCursor); }, { passive: true });
        animateCursor();

        const _curBoundA = new WeakSet(), _curBoundB = new WeakSet();
        function updateCursorTargeting() {
            document.querySelectorAll('.targeting-trigger, .hand-card').forEach(el => {
                if (_curBoundA.has(el)) return; _curBoundA.add(el);
                el.addEventListener('mouseenter', () => { SFX.ui_hover(); cursor.classList.remove('targeting-card'); cursor.classList.add('targeting'); });
                el.addEventListener('mouseleave', () => cursor.classList.remove('targeting'));
            });
            document.querySelectorAll('.card-wrapper').forEach(el => {
                if (_curBoundB.has(el)) return; _curBoundB.add(el);
                el.addEventListener('mouseenter', () => { SFX.ui_hover(); cursor.classList.remove('targeting'); cursor.classList.add('targeting-card'); });
                el.addEventListener('mouseleave', () => cursor.classList.remove('targeting-card'));
            });
        }

        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        ctx.imageSmoothingEnabled = false;

        // ── PERFORMANCE: qualidade adaptativa (cai sozinha se o PC não segura ~50fps) ──
        const PERF = {
            q: 2, shadow: 1, maxParticles: 600, maxFloating: 70, rays: { scale: 0.5, fps: 30 }, maxFx: 1400, post: true, lite: false,
            ema: 16.7, slow: 0
        };
        const _QUALITY = [
            { shadow: 0,   maxParticles: 120, maxFloating: 25, rays: null, maxFx: 350,  post: false, lite: true  },
            { shadow: 0.5, maxParticles: 300, maxFloating: 40, rays: { scale: 0.35, fps: 20 }, maxFx: 700,  post: true,  lite: true  },
            { shadow: 1,   maxParticles: 600, maxFloating: 70, rays: { scale: 0.5,  fps: 30 }, maxFx: 1400, post: true,  lite: false },
        ];
        function setQuality(q) {
            q = Math.max(0, Math.min(2, q)); PERF.q = q;
            Object.assign(PERF, _QUALITY[q]);
            document.documentElement.classList.toggle('nx-lite', !!PERF.lite);
        }
        function adaptQuality(dt) {
            if (PERF.q === 0 || document.hidden || isShopOpen || gameOver || menuActive) return;
            PERF.ema += (Math.min(dt, 100) - PERF.ema) * 0.05;
            if (PERF.ema > 21) PERF.slow++; else PERF.slow = Math.max(0, PERF.slow - 2);
            // (removido) antes aqui a qualidade caía sozinha quando o FPS baixava e desligava o filtro/shader
        }
        // shadowBlur é o efeito mais caro do canvas 2D: passa por um multiplicador de qualidade
        (function () {
            const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
            Object.defineProperty(ctx, 'shadowBlur', {
                configurable: true, enumerable: true,
                get() { return d.get.call(this); },
                set(v) { d.set.call(this, v * PERF.shadow); }
            });
        })();

        // ── MAPA: tiles estáticos viram Path2D em lote (1 fill por cor em vez de 4 paths por tile por frame) ──
        const renderQueue = [];
        const _rqCmp = (a, b) => { const dd = a.d - b.d; return (dd < 0.01 && dd > -0.01) ? a.o - b.o : dd; };
        let _tiles = null;
        // ── PALETAS DO CHÃO: uma é sorteada a cada partida nova (nunca repete a anterior) ──
        // cores amostradas da imagem de referência, já compensadas pelo filtro do shader final
        const FLOOR_PALETTES = [
            { id: 'abismo',   name: 'ABISMO',   tops: ['#241b53', '#2d2163', '#31236a', '#342677', '#3c2a8a'], hover: '#a78bfa', deco: 'crystal', c1: '#5b45b8', c2: '#a78bfa' },
            { id: 'floresta', name: 'FLORESTA', tops: ['#295422', '#366727', '#3c7028', '#427729', '#4f872a'], hover: '#bef264', deco: 'tuft',    c1: '#5fae2e', c2: '#8fd14f' },
            { id: 'vulcao',   name: 'VULCÃO',   tops: ['#783d25', '#974e2b', '#a4572d', '#b1602e', '#c9752f'], hover: '#fdba74', deco: 'rock',    c1: '#4a2412', c2: '#8a4a22' },
            { id: 'gelo',     name: 'GELO',     tops: ['#1f5f71', '#217585', '#237e8b', '#248893', '#2badaf'], hover: '#a5f3fc', deco: 'spark',   c1: '#7fe9f5', c2: '#ffffff' }
        ];
        FLOOR_PALETTES.forEach(p => {   // laterais = versão escurecida do tom médio
            const m = parseInt(p.tops[2].slice(1), 16), ch = s => [(m >> 16) & 255, (m >> 8) & 255, m & 255].map(v => Math.round(v * s));
            const hx = a => '#' + a.map(v => v.toString(16).padStart(2, '0')).join('');
            p.left = hx(ch(0.42)); p.right = hx(ch(0.58));
        });
        let floorPalette = FLOOR_PALETTES[0];
        const FLOOR_LAST_KEY = 'nexus_last_floor';
        function setFloorPalette(id) {
            const p = FLOOR_PALETTES.find(x => x.id === id); if (!p) return false;
            floorPalette = p; _tiles = null;
            try { localStorage.setItem(FLOOR_LAST_KEY, p.id); } catch (e) {}
            return true;
        }
        function pickRandomFloor() {
            let last = null; try { last = localStorage.getItem(FLOOR_LAST_KEY); } catch (e) {}
            const opts = FLOOR_PALETTES.filter(p => p.id !== last);
            return (opts[Math.floor(Math.random() * opts.length)] || FLOOR_PALETTES[0]).id;
        }
        setFloorPalette(pickRandomFloor());   // partida nova = página recarregada; "Continuar" restaura a paleta salva (ver loadGame)

        function _tileRand(x, y, n) {
            let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(n, 1274126177)) | 0;
            h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
            return (h >>> 0) / 4294967296;
        }
        function _buildTiles() {
            const W2 = TILE_W / 2, H2 = TILE_H / 2, P = floorPalette, NT = P.tops.length;
            const G = { l0: new Path2D(), l1: new Path2D(), r0: new Path2D(), r1: new Path2D(), t1: new Path2D(), top: [], dark: new Path2D(), light: new Path2D(), d1: new Path2D(), d2: new Path2D(), stroke: new Path2D() };
            for (let i = 0; i < NT; i++) G.top.push(new Path2D());
            for (let y = 0; y < map.length; y++) {
                for (let x = 0; x < map[y].length; x++) {
                    const type = map[y][x] === 1 ? 1 : 0;
                    const px = (x - y) * W2, py = (x + y) * H2;
                    const L = G[type ? 'l1' : 'l0'], R_ = G[type ? 'r1' : 'r0'];
                    L.moveTo(px - W2, py); L.lineTo(px, py + H2); L.lineTo(px, py + H2 + 10); L.lineTo(px - W2, py + 10); L.closePath();
                    R_.moveTo(px, py + H2); R_.lineTo(px + W2, py); R_.lineTo(px + W2, py + 10); R_.lineTo(px, py + H2 + 10); R_.closePath();
                    // tom da tile = ruído por tile + ruído em blocos 2x2 (forma manchas claras/escuras como na referência)
                    const shade = Math.min(NT - 2, Math.floor(_tileRand(x, y, 1) * (NT - 1)));   // variação suave por tile, sem manchas claras em bloco
                    const T = type ? G.t1 : G.top[shade];
                    T.moveTo(px, py - H2); T.lineTo(px + W2, py); T.lineTo(px, py + H2); T.lineTo(px - W2, py); T.closePath();
                    G.stroke.moveTo(px, py - H2); G.stroke.lineTo(px + W2, py); G.stroke.lineTo(px, py + H2); G.stroke.lineTo(px - W2, py); G.stroke.closePath();
                    if (type) continue;
                    // pontinhos de textura dentro do losango (|a|,|b| <= .42 garante ficar dentro da tile)
                    for (let k = 0; k < 3; k++) {
                        const a = (_tileRand(x, y, 10 + k) - 0.5) * 0.84, b = (_tileRand(x, y, 20 + k) - 0.5) * 0.84;
                        (k === 2 ? G.light : G.dark).rect(Math.round(px + (a - b) * W2), Math.round(py + (a + b) * H2), 2, 1);
                    }
                    // decoração rara por bioma (tufos, pedras, cristais, brilhos de gelo)
                    if (_tileRand(x, y, 30) < 0.085) {
                        const a = (_tileRand(x, y, 31) - 0.5) * 0.6, b = (_tileRand(x, y, 32) - 0.5) * 0.6;
                        const dx = Math.round(px + (a - b) * W2), dy = Math.round(py + (a + b) * H2);
                        if (P.deco === 'tuft')         { G.d1.rect(dx - 2, dy - 4, 1, 4); G.d1.rect(dx, dy - 6, 1, 6); G.d1.rect(dx + 2, dy - 4, 1, 4); G.d2.rect(dx, dy - 6, 1, 2); }
                        else if (P.deco === 'rock')    { G.d1.rect(dx - 3, dy - 3, 6, 4); G.d2.rect(dx - 3, dy - 3, 6, 1); G.d2.rect(dx - 3, dy - 3, 1, 3); }
                        else if (P.deco === 'crystal') { G.d1.rect(dx - 1, dy - 4, 2, 4); G.d2.rect(dx - 1, dy - 5, 2, 1); }
                        else                           { G.d1.rect(dx - 2, dy, 5, 1); G.d1.rect(dx, dy - 2, 1, 5); G.d2.rect(dx, dy, 1, 1); }
                    }
                }
            }
            _tiles = { key: map.length + 'x' + map[0].length + ':' + waypoints.length + ':' + P.id, G };
        }
        function drawMapTiles(hx, hy) {
            if (!_tiles || _tiles.key !== map.length + 'x' + map[0].length + ':' + waypoints.length + ':' + floorPalette.id) _buildTiles();
            const G = _tiles.G, P = floorPalette, W2 = TILE_W / 2, H2 = TILE_H / 2;
            ctx.save();
            ctx.translate(canvas.width / 2 + camX, canvas.height / 4 + camY);
            ctx.fillStyle = P.left; ctx.fill(G.l0);
            ctx.fillStyle = '#140c0c'; ctx.fill(G.l1);
            ctx.fillStyle = P.right; ctx.fill(G.r0);
            ctx.fillStyle = '#1d1111'; ctx.fill(G.r1);
            for (let i = 0; i < G.top.length; i++) { ctx.fillStyle = P.tops[i]; ctx.fill(G.top[i]); }
            ctx.fillStyle = '#2a1717'; ctx.fill(G.t1);
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke(G.stroke);
            ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fill(G.dark);
            ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill(G.light);
            ctx.fillStyle = P.c1; ctx.fill(G.d1);
            ctx.fillStyle = P.c2; ctx.fill(G.d2);
            if (hy >= 0 && hy < map.length && hx >= 0 && hx < map[hy].length && map[hy][hx] === 0) {
                const px = (hx - hy) * W2, py = (hx + hy) * H2;
                ctx.beginPath(); ctx.moveTo(px, py - H2); ctx.lineTo(px + W2, py); ctx.lineTo(px, py + H2); ctx.lineTo(px - W2, py); ctx.closePath();
                ctx.fillStyle = P.hover; ctx.fill(); ctx.stroke();
            }
            ctx.restore();
        }

        let camX = 0; let camY = 0; let zoom = 1.2; let keys = {}; let screenShake = 0; 
        let sellTokens = 1; let expansionsUsed = 0; let autoWave = false;
        const rarityColors = { common: '#a0a0a0', rare: '#0070dd', epic: '#a335ee', legendary: '#ff8000' };
        let mouseX = 0; let mouseY = 0;
        window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

        let camVX = 0; let camVY = 0;           
        let zoomTarget = 1.2; let zoomVel = 0;  
        const CAM_ACCEL   = 0.9;   
        const CAM_MAX_SPD = 18;    
        const CAM_DRAG    = 0.82;  
        const DRAG_SENS   = 0.6;   
        const DRAG_DRAG   = 0.88;  
        const ZOOM_SMOOTH = 0.16;  

        let isDragging = false; let dragLastX = 0; let dragLastY = 0;
        let dragVX = 0; let dragVY = 0;

        window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
        window.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

        canvas.addEventListener('contextmenu', e => e.preventDefault());

        window.addEventListener('mousedown', e => {
            if(e.button === 2) {
                if(menuActive || isTutorialActive || gameOver || isShopOpen) return;
                isDragging = true; dragLastX = e.clientX; dragLastY = e.clientY;
                dragVX = 0; dragVY = 0;
                e.preventDefault();
            }
        });
        window.addEventListener('mousemove', e => {
            if(isDragging) {
                let dx = e.clientX - dragLastX; let dy = e.clientY - dragLastY;
                dragVX = dx * DRAG_SENS; dragVY = dy * DRAG_SENS;
                camX += dragVX / zoom; camY += dragVY / zoom;
                dragLastX = e.clientX; dragLastY = e.clientY;
            }
        });
        window.addEventListener('mouseup', e => {
            if(e.button === 2) isDragging = false;
        });

        window.addEventListener('wheel', e => {
            if(menuActive || isTutorialActive || gameOver) return
            if(e.clientX < nxSideW(10)) return; 
            if(isShopOpen) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.18 : 0.18;
            zoomTarget = Math.max(0.4, Math.min(zoomTarget + delta, 3.0));
        }, { passive: false });

        const TILE_W = 64; const TILE_H = 32;
        let hp = 20; let gold = 70; let wave = 1;
        let alignmentLight = 0; let alignmentDark = 0;
        let gameOver = false;
        let adaptiveMult = 1.0;
        let waveStartHp = 20;
        let waveTotalEnemyHp = 0;
        let waveEnemyDmgDealt = 0;
        let waveEnemyHpKilled = 0; 
        let skipShop = false; let gameSpeed = 1;   // gameSpeed: 1 ou 2 (só vale com Auto-Wave + Pular Loja ativos)
        let statTotalDmgDealt = 0;
        let statTotalDmgTaken = 0;
        let statEnemiesKilled = 0;
        let statTowersBuilt = 0;
        let statCardsUsed = 0;
        let statGoldEarned = 0;
        let statCrits = 0;
        let statRerolls = 0; let gameOverAlpha = 0; let isShopOpen = false; let waveActive = false;
        let rerollCost = 15;
        let isTutorialActive = false; 
        let menuActive = true; let nxStarted = false;
        const NXO = (function () { let o = {}; try { o = JSON.parse(localStorage.getItem('nexus_opts') || '{}') || {}; } catch (e) {}
            return Object.assign({ music: 0.3, sfx: 1, px: 2, shake: true, dmg: true, flash: true, parts: 2 }, o); })();

        // ── PARTÍCULAS: modo (opção) + culling de tudo que está fora da tela ──
        // modo: 2 = TODAS · 1 = MÍNIMAS (~25%) · 0 = NENHUMA
        const PART = { mode: 2, keep: 1 };
        const VP = { x0: -1e9, x1: 1e9, y0: -1e9, y1: 1e9 };   // retângulo visível, em coordenadas de mundo (antes do zoom)
        function setParticleMode(m, clear) {
            m = (m === 0 || m === 1) ? m : 2;
            PART.mode = m; PART.keep = m === 2 ? 1 : m === 1 ? 0.25 : 0; NXO.parts = m;
            const cl = document.documentElement.classList; cl.remove('parts-0', 'parts-1', 'parts-2'); cl.add('parts-' + m);
            if (m === 0 && clear) { particles.length = 0; FX.parts.length = 0; }
        }
        setParticleMode(NXO.parts, false);
        function vpUpdate() {
            const cx = canvas.width / 2, cy = canvas.height / 2, pad = 160 / zoom;
            VP.x0 = -cx / zoom + cx - pad; VP.x1 = (canvas.width - cx) / zoom + cx + pad;
            VP.y0 = -cy / zoom + cy - pad; VP.y1 = (canvas.height - cy) / zoom + cy + pad;
        }
        // usado na hora de CRIAR partículas: se nasce fora da tela, nem cria (vivem ~1s, ninguém vê)
        function onScreen(gx, gy) {
            const p = cartToIso(gx, gy), cx = canvas.width / 2, cy = canvas.height / 2, pad = 160;
            const sx = (p.x - cx) * zoom + cx, sy = (p.y - cy) * zoom + cy;
            return sx > -pad && sx < canvas.width + pad && sy > -pad && sy < canvas.height + pad;
        }

        const shopMods = {
            rareBonusChance:   0,   
            epicBonusChance:   0,   
            legendBonusChance: 0,   
            priceReduction:    0,   
            rerollDiscount:    0,   
            guaranteeRare:     false, 
            onlyRarePlus:      false, 
            highLegendChance:  false, 
            wavesDiscount:     0,   
            waveDiscountAmt:   0,   
        };
        function tickShopMods() {
            if(shopMods.wavesDiscount > 0) { shopMods.wavesDiscount--; if(shopMods.wavesDiscount === 0) shopMods.waveDiscountAmt = 0; }
            shopMods.rerollDiscount = 0;
            shopMods.guaranteeRare = false;
            shopMods.onlyRarePlus = false;
            shopMods.highLegendChance = false;
        }
        
        const enemyHpConfig = { base: 30, linear: 22, expPow: 1.38, expMult: 6 };
        const ENEMY_HP_MULT = 1.15;   // multiplicador GLOBAL de vida de todos os inimigos (1.0 = original)

        let mapWidth = 12; let mapHeight = 12;
        let map = Array.from({length: mapHeight}, () => new Array(mapWidth).fill(0));
        let waypoints = [{x: 0, y: Math.floor(mapHeight/2)}];
        map[waypoints[0].y][waypoints[0].x] = 1;
        
        function generateWindingPath(startX, startY, mapW, mapH, mainDir) {
            let pts = []; let cx = startX; let cy = startY; let lastDir = mainDir;
            let initialStep = Math.floor(Math.random() * 2) + 2;
            for(let i=0; i<initialStep; i++) {
                if(lastDir === 'right') cx++; else if(lastDir === 'left') cx--; else if(lastDir === 'down') cy++; else if(lastDir === 'up') cy--;
                pts.push({x: cx, y: cy});
                if (cx >= mapW - 1 || cx <= 0 || cy <= 0 || cy >= mapH - 1) return pts;
            }
            while(true) {
                if (lastDir === 'right' || lastDir === 'left') {
                    lastDir = Math.random() > 0.5 ? 'up' : 'down';
                    if (cy <= 3) lastDir = 'down'; if (cy >= mapH - 4) lastDir = 'up';
                } else { lastDir = mainDir; }

                let dist = Math.floor(Math.random() * 3) + 2; 
                for(let i=0; i<dist; i++) {
                    if(lastDir === 'right') cx++; else if(lastDir === 'left') cx--; else if(lastDir === 'down') cy++; else if(lastDir === 'up') cy--;
                    pts.push({x: cx, y: cy});
                    if (cx >= mapW - 1 || cx <= 0 || cy <= 0 || cy >= mapH - 1) return pts; 
                }
            }
        }

        let initialPath = generateWindingPath(waypoints[0].x, waypoints[0].y, mapWidth, mapHeight, 'right');
        initialPath.forEach(p => { map[p.y][p.x] = 1; waypoints.push(p); });

        const towers = []; const soldTowers = []; const lostTowers = []; const enemies = []; const projectiles = []; const particles = [];
        const uiParticles = []; const floatingTexts = []; 
        let hoverGridX = -1; let hoverGridY = -1;
        let enemiesToSpawn = 0; let spawnInterval = 80; let frameCount = 0; let spawnTimer = 0;
        let spawnQueue = [];   
        let playerHand = [];

        const towerTypes = {
            gatling: { name: "Metralhadora", cost: 25, range: 3.5, fireRate: 25, damage: 10,  color: "#52525b", proj: "#fbbf24", icon: '\uf05b' },
            sniper:  { name: "Canhão de Elite", cost: 45, range: 7.0, fireRate: 100, damage: 75, color: "#2d3748", proj: "#ef4444", icon: '\uf135' },
            tesla:   { name: "Bobina Tesla", cost: 40, range: 4.5, fireRate: 35,  damage: 25, color: "#2b6cb0", proj: "#63b3ed", icon: '\uf0e7' }
        };
        let selectedTowerKey = 'gatling';

        function cartToIso(cartX, cartY) {
            const cx = canvas.width / 2 + camX; const cy = canvas.height / 4 + camY;
            return { x: cx + (cartX - cartY) * (TILE_W / 2), y: cy + (cartX + cartY) * (TILE_H / 2) };
        }
        function screenToGrid(screenX, screenY) {
            const cx = canvas.width / 2; const cy = canvas.height / 2;
            const unzoomedX = (screenX - cx) / zoom + cx; const unzoomedY = (screenY - cy) / zoom + cy;
            const offX = cx + camX; const offY = canvas.height / 4 + camY;
            const adjX = unzoomedX - offX; const adjY = unzoomedY - offY;
            return { x: Math.round((adjY / (TILE_H / 2) + adjX / (TILE_W / 2)) / 2), y: Math.round((adjY / (TILE_H / 2) - adjX / (TILE_W / 2)) / 2) };
        }
        function applyShake(amt) { if (NXO.shake === false) return; screenShake = Math.max(screenShake, amt); }

        function getLocks() {
            let endP = waypoints[waypoints.length - 1]; let locks = [];
            if (endP.x >= map[0].length - 1) locks.push({ dir: 'right', gx: endP.x, gy: endP.y });
            else if (endP.y <= 0) locks.push({ dir: 'up', gx: endP.x, gy: endP.y });
            else if (endP.y >= map.length - 1) locks.push({ dir: 'down', gx: endP.x, gy: endP.y });
            return locks;
        }

        function expandMap(dir, clickX, clickY) {
            let expansionsAvailable = Math.floor(wave / 5) - expansionsUsed;
            if (gold < 100 || expansionsAvailable <= 0 || waveActive) return;
            gold -= 100; expansionsUsed++; const margem = 6; 
            SFX.ui_click(); 
            
            if(clickX !== undefined && clickY !== undefined) {
                createParticles(clickX, clickY, '#fde047', 40); 
                createParticles(clickX, clickY, '#ffffff', 20); 
                applyShake(15);
                let cx = canvas.width/2; let cy = canvas.height/2;
                let screenPos = cartToIso(clickX, clickY);
                let screenX = (screenPos.x - cx) * zoom + cx; let screenY = (screenPos.y - cy) * zoom + cy; 
                floatingTexts.push(new FloatingText(screenX, screenY, "ÁREA LIBERADA!", '#fde047', true));
            }

            let larguraAntiga = map[0].length; let alturaAntiga = map.length;
            let shiftX = 0; let shiftY = 0;

            if (dir === 'up') {
                shiftY = margem; let novoMapa = [];
                for(let i=0; i<margem; i++) novoMapa.push(new Array(larguraAntiga).fill(0));
                map = novoMapa.concat(map);
                camY -= margem * TILE_H / 2; camX += margem * TILE_W / 2;
            } else if (dir === 'down') { for(let i=0; i<margem; i++) map.push(new Array(larguraAntiga).fill(0)); } 
            else if (dir === 'right') { map = map.map(row => [...row, ...new Array(margem).fill(0)]); }

            if (shiftX > 0 || shiftY > 0) {
                towers.forEach(t => { t.gridX += shiftX; t.gridY += shiftY; });
                waypoints = waypoints.map(wp => ({ x: wp.x + shiftX, y: wp.y + shiftY }));
                enemies.forEach(e => { e.x += shiftX; e.y += shiftY; e.myPath = e.myPath.map(wp => ({ x: wp.x + shiftX, y: wp.y + shiftY })); });
                projectiles.forEach(p => { p.x += shiftX; p.y += shiftY; p.startX += shiftX; p.startY += shiftY; p.history = p.history.map(hp => ({x: hp.x + shiftX, y: hp.y + shiftY})); });
            }

            let ultimoWp = waypoints[waypoints.length - 1];
            let nPts = generateWindingPath(ultimoWp.x, ultimoWp.y, map[0].length, map.length, dir);
            nPts.forEach(p => { map[p.y][p.x] = 1; waypoints.push(p); enemies.forEach(e => e.myPath.push(p)); });
            updateUI();
        }

        class FloatingText {
            constructor(sx, sy, text, color, isCrit = false) {
                this.x = sx; this.y = sy; this.text = text; this.color = color;
                this.life = 1.0; this.vy = -2.0; this.size = isCrit ? 28 : 20;
            }
            update() { this.y += this.vy; this.life -= 0.02; return this.life <= 0; }
            draw() {
                ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color;
                ctx.font = `900 ${this.size}px "Segoe UI", Arial`; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.textAlign = 'center';
                ctx.strokeText(this.text, this.x, this.y); ctx.fillText(this.text, this.x, this.y); ctx.globalAlpha = 1.0;
            }
        }

        let dragElement = null; let draggingCardIndex = -1; let hoverTimer = null;
        const tt = document.getElementById('tooltip');

        let cardDragTargetX = 0, cardDragTargetY = 0;
        let cardDragLastX = 0, cardDragLastY = 0;
        let cardDragRotZ = 0;
        let isCardDragAnimating = false;

        function updateDragPhysics() {
            if (!dragElement) { isCardDragAnimating = false; return; }
            
            let vx = cardDragTargetX - cardDragLastX;
            cardDragLastX = cardDragTargetX;
            cardDragLastY = cardDragTargetY;

            let targetRotZ = Math.max(-25, Math.min(25, vx * 0.8));
            cardDragRotZ += (targetRotZ - cardDragRotZ) * 0.15;

            dragElement.style.transform = `scale(1.15) rotate(${cardDragRotZ}deg)`;

            requestAnimationFrame(updateDragPhysics);
        }

        let hoveredDropTower   = null;
        let dropConfirmTimer   = null;
        let confirmedDropTower = null;
        let dropConfirmPulse   = 0;

        function clearDropTarget() {
            hoveredDropTower   = null;
            confirmedDropTower = null;
            clearTimeout(dropConfirmTimer);
            dropConfirmTimer = null;
            document.getElementById('tooltip').classList.remove('visible');
        }
        
        let isCardReturning = false;

        function returnCardToHand() {
            if (!dragElement) return;
            isCardDragAnimating = false; 
            isCardReturning = true;      
            
            dragElement.style.transition = 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), top 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            dragElement.style.left = dragElement.dataset.origX + 'px';
            dragElement.style.top = dragElement.dataset.origY + 'px';
            dragElement.style.transform = 'scale(1) rotate(0deg)';
            
            let capturedDrag = dragElement;
            dragElement = null; draggingCardIndex = -1; document.body.style.cursor = '';
            
            setTimeout(() => {
                if(capturedDrag) capturedDrag.remove();
                isCardReturning = false;
                renderHand();
            }, 300);
        }

        /* ── MÃO COM MUITAS CARTAS: faixa de 1 linha com rolagem lateral (roda do mouse, setas e arrastar de lado no toque) ── */
        const handWrap = document.getElementById('hand-container'), handBox = document.getElementById('hand-scroll');
        const handArL = document.getElementById('hand-arrow-l'), handArR = document.getElementById('hand-arrow-r'), handProg = document.getElementById('hand-prog');
        let handPrevLen = 0, handBusy = false;
        function handNeedsScroll() { return handBox.scrollWidth > handBox.clientWidth + 2; }
        function updateHandScrollUI() {   // só visual (setas/barra); chamado a cada scroll
            if (!handArL || !handArR || !handProg) return;
            const ovf = handWrap.classList.contains('ovf'), r = handWrap.getBoundingClientRect();
            const show = ovf && r.width > 0;
            const max = handBox.scrollWidth - handBox.clientWidth, sl = handBox.scrollLeft;
            [handArL, handArR].forEach(b => b.classList.toggle('on', show));
            handArL.classList.toggle('dis', sl <= 2); handArR.classList.toggle('dis', sl >= max - 2);
            handProg.classList.toggle('on', show);
            if (!show) return;
            const ah = Math.max(36, Math.min(56, r.height - 16)), top = (r.top + r.height / 2 - ah / 2) + 'px';
            handArL.style.height = handArR.style.height = ah + 'px'; handArL.style.top = handArR.style.top = top;
            handArL.style.left = (r.left + 6) + 'px'; handArR.style.left = (r.right - 6 - 28) + 'px';
            const tw = Math.max(20, r.width - 80); handProg.style.left = (r.left + 40) + 'px'; handProg.style.top = (r.bottom - 6) + 'px'; handProg.style.width = tw + 'px';
            const th = handProg.firstElementChild, ratio = Math.max(0.12, handBox.clientWidth / handBox.scrollWidth);
            th.style.width = (ratio * 100) + '%'; th.style.left = ((max > 0 ? sl / max : 0) * (1 - ratio) * 100) + '%';
        }
        function updateHandArrows() {     // mede se precisa rolar e reserva espaço das setas (preserva a posição da rolagem)
            if (handBusy) return; handBusy = true;
            const sl = handBox.scrollLeft;
            handWrap.classList.remove('ovf');
            const needs = handWrap.getBoundingClientRect().width > 0 && handNeedsScroll();
            handWrap.classList.toggle('ovf', needs);
            if (handBox.scrollLeft !== sl) handBox.scrollLeft = sl;
            handBusy = false; updateHandScrollUI();
        }
        function handScrollBy(dir) {
            const c = handBox.querySelector('.hand-card'); const step = (c ? c.offsetWidth + 10 : 80) * 2;
            handBox.scrollBy({ left: dir * step, behavior: 'smooth' });
        }
        if (handArL) handArL.addEventListener('click', () => handScrollBy(-1));
        if (handArR) handArR.addEventListener('click', () => handScrollBy(1));
        handBox.addEventListener('scroll', updateHandScrollUI, { passive: true });
        handWrap.addEventListener('wheel', e => {
            if (!handNeedsScroll()) return;
            const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            handBox.scrollLeft += d; e.preventDefault(); e.stopPropagation();
        }, { passive: false });
        window.addEventListener('resize', updateHandArrows);
        if (window.ResizeObserver) new ResizeObserver(updateHandArrows).observe(handWrap);

        function renderHand() {
            const container = document.getElementById('hand-scroll') || document.getElementById('hand-container');
            const emptyText = document.getElementById('empty-hand');
            container.querySelectorAll('.hand-card').forEach(c => c.remove());

            if(playerHand.length === 0) { emptyText.style.display = 'block'; } else {
                emptyText.style.display = 'none';
                playerHand.forEach((card, index) => {
                    let el = document.createElement('div');
                    el.className = 'hand-card'; el.style.borderColor = `var(--${card.rarity})`;
                    el.innerHTML = `<div class="mini-icon" style="color:var(--${card.rarity})">${card.icon}</div><span style="color:var(--${card.rarity})">${card.name}</span>`;

                    el.onpointerenter = () => {
                        if(dragElement) return;
                        hoverTimer = setTimeout(() => {
                            const rect = el.getBoundingClientRect();
                            tt.innerHTML = `<b style="color:var(--${card.rarity}); font-size:20px;">${card.name}</b><br><i style="color:#a1a1aa; font-size:14px; display:block; margin:8px 0;">"${card.desc}"</i><hr style="border-color:#27272a; margin:12px 0;"><span style="color:#22c55e">▲ ${card.buff}</span><br><span style="color:#ef4444">▼ ${card.debuff}</span>`;
                            tt.classList.add('visible'); tt.style.left = (rect.left + rect.width / 2 - 150) + 'px'; tt.style.top = (rect.top - 200) + 'px'; 
                        }, 250);
                    };
                    
                    el.onpointerleave = (ev) => { if (ev && ev.pointerType && ev.pointerType !== 'mouse') return; clearTimeout(hoverTimer); hoverTimer = null; tt.classList.remove('visible'); };
                    
                    el.onpointerdown = (e) => {
                        if(dragElement || isCardReturning) return; 
                        clearTimeout(hoverTimer); hoverTimer = null; tt.classList.remove('visible');
                        
                        let rect = el.getBoundingClientRect();
                        el.dataset.origX = rect.left;
                        el.dataset.origY = rect.top;

                        dragElement = el; draggingCardIndex = index;
                        el.style.position = 'fixed'; el.style.zIndex = 1000; 
                        
                        el.style.transition = 'opacity 0.2s ease-out';
                        el.classList.add('dragging');
                        document.body.appendChild(el); 

                        cardDragTargetX = e.clientX; cardDragTargetY = e.clientY;
                        cardDragLastX = e.clientX; cardDragLastY = e.clientY;
                        cardDragRotZ = 0;
                        if (!isCardDragAnimating) { isCardDragAnimating = true; updateDragPhysics(); }

                        moveDrag(e); el.setPointerCapture(e.pointerId); e.preventDefault();
                    };
                    
                    el.onpointermove = (e) => { if(dragElement === el) { moveDrag(e); e.preventDefault(); } };
                    
                    el.onpointerup = (e) => { if(dragElement === el) { el.classList.remove('dragging'); el.releasePointerCapture(e.pointerId); clearDropTarget(); checkCardDrop(e.clientX, e.clientY + nxDY(e)); } };
                    
                    el.onpointercancel = (e) => {
                        if(dragElement === el) { el.classList.remove('dragging'); el.releasePointerCapture(e.pointerId); clearDropTarget(); returnCardToHand(); }
                    };
                    const _startDrag = el.onpointerdown;
                    el.onpointerdown = (e) => {
                        if (e.pointerType === 'mouse' || !handNeedsScroll()) return _startDrag(e);
                        if (dragElement || isCardReturning) return;
                        e.preventDefault();
                        const sx = e.clientX, sy = e.clientY, sl = handBox.scrollLeft, pid = e.pointerId; let mode = '';
                        const end = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
                        const mv = ev => {
                            if (ev.pointerId !== pid) return;
                            const dx = ev.clientX - sx, dy = ev.clientY - sy;
                            if (!mode) {
                                if (Math.hypot(dx, dy) < 8) return;
                                mode = Math.abs(dx) > Math.abs(dy) ? 'scroll' : 'drag';   // de lado = rola a mão; pra cima/baixo = arrasta a carta
                                if (mode === 'drag') { end(); _startDrag(ev); return; }
                                clearTimeout(hoverTimer); tt.classList.remove('visible');
                            }
                            handBox.scrollLeft = sl - dx;
                        };
                        const up = ev => { if (ev.pointerId === pid) end(); };
                        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
                    };
                    container.appendChild(el);
                });
                updateCursorTargeting();
            }
            updateHandArrows();
            if (playerHand.length > handPrevLen && handNeedsScroll()) handBox.scrollTo({ left: handBox.scrollWidth, behavior: 'smooth' });   // carta nova: mostra no fim
            handPrevLen = playerHand.length;
        }

        function moveDrag(_e) {
            const e = (nxDY(_e) ? { clientX: _e.clientX, clientY: _e.clientY + nxDY(_e) } : _e);
            dragElement.style.left = (e.clientX - 35) + 'px';
            dragElement.style.top  = (e.clientY - 50) + 'px';
            
            cardDragTargetX = e.clientX;
            cardDragTargetY = e.clientY;

            let cx = canvas.width/2; let cy = canvas.height/2;
            let closestTower = null; let closestDist = Infinity;
            const HIT_RADIUS = 60 * zoom;

            for(let t of towers) {
                let p = cartToIso(t.gridX, t.gridY);
                let screenX = (p.x - cx) * zoom + cx;
                let screenY = (p.y - 10 - cy) * zoom + cy;
                let dist = Math.hypot(e.clientX - screenX, e.clientY - screenY);
                if(dist < HIT_RADIUS && dist < closestDist) { closestDist = dist; closestTower = t; }
            }

            if(closestTower !== hoveredDropTower) {
                hoveredDropTower = closestTower;
                
                if(closestTower) {
                    confirmedDropTower = closestTower;
                    dropConfirmPulse   = 0;
                } else {
                    confirmedDropTower = null;
                }
            }

            if(closestTower && draggingCardIndex >= 0) {
                let card = playerHand[draggingCardIndex];
                if(card && !card.isPill && !card.isApple && !card.isEcon) {
                    let b = closestTower;
                    let after = previewCardStats(b, card);

                    function ds(before, after) {
                        let diff = after - before;
                        if(Math.abs(diff) < 0.001) return '';
                        let col = diff > 0 ? '#22c55e' : '#ef4444';
                        return ` <span style="color:${col};font-size:12px;font-weight:bold;">(${diff>0?'+':''}${diff.toFixed(1)})</span>`;
                    }
                    function dp(before, after) {
                        if(Math.abs(before) < 0.001) return '';
                        let pct = ((after - before) / before) * 100;
                        if(Math.abs(pct) < 0.1) return '';
                        let col = pct > 0 ? '#22c55e' : '#ef4444';
                        return ` <span style="color:${col};font-size:12px;font-weight:bold;">(${pct>0?'+':''}${pct.toFixed(0)}%)</span>`;
                    }

                    let bDps = (b.damage * (60/b.fireRate)) * (1 + b.critChance*(b.critDamage-1));
                    let aDps = (after.damage * (60/after.fireRate)) * (1 + after.critChance*(after.critDamage-1));
                    let bShots = 60/b.fireRate; let aShots = 60/after.fireRate;
                    let newFlags = [...after.flags].filter(f => !b.flags.has(f));
                    let flagsHtml = newFlags.length ? `<br><span style="color:#a78bfa;font-size:12px;">✦ ${newFlags.join(', ')}</span>` : '';

                    tt.innerHTML = `<b style="color:${b.color};font-size:16px;">${towerTypes[b.type].name} (Lv.${b.level})</b>
                        <span style="background:${rarityColors[card.rarity]}22;border:1px solid ${rarityColors[card.rarity]}55;color:${rarityColors[card.rarity]};font-size:10px;font-weight:bold;padding:2px 7px;border-radius:10px;margin-left:6px;vertical-align:middle;">${card.name}</span>
                        <hr style="border-color:#27272a;margin:8px 0;">
                        <span style="color:#e2e8f0">Dano:</span> <span style="color:#ef4444;font-weight:bold;">${b.damage.toFixed(1)}</span>${ds(b.damage,after.damage)}<br>
                        <span style="color:#e2e8f0">Alcance:</span> <span style="color:#38bdf8;font-weight:bold;">${b.range.toFixed(1)}</span>${ds(b.range,after.range)}<br>
                        <span style="color:#e2e8f0">Disparos:</span> <span style="color:#22c55e;font-weight:bold;">${bShots.toFixed(1)}/s</span>${dp(bShots,aShots)}<br>
                        <span style="color:#e2e8f0">Crit:</span> <span style="color:#fde047;font-weight:bold;">${(b.critChance*100).toFixed(0)}%</span>${ds(b.critChance*100,after.critChance*100)}<br>
                        <span style="color:#e2e8f0">DPS Real:</span> <span style="color:#c084fc;font-weight:bold;">${bDps.toFixed(1)}</span>${ds(bDps,aDps)}
                        ${flagsHtml}`;
                    tt.style.left = (e.clientX + 15) + 'px';
                    tt.style.top  = (e.clientY + 15) + 'px';
                    tt.classList.add('visible');
                } else {
                    tt.classList.remove('visible');
                }
            } else {
                tt.classList.remove('visible');
            }
        }

        function previewCardStats(tower, card) {
            if(!card || !card.apply) return { range: tower.range, damage: tower.damage, fireRate: tower.fireRate };
            let clone = {
                isPreview: true, modDur: tower.modDur || 1, modDecay: tower.modDecay || 1, durRegen: tower.durRegen || 0, dur: tower.dur, 
                type: tower.type, level: tower.level,
                baseDmg: tower.baseDmg, baseRate: tower.baseRate, baseRange: tower.baseRange,
                modDmg: tower.modDmg, modRate: tower.modRate, modRange: tower.modRange,
                flags: new Set(tower.flags),
                effects: [...tower.effects],
                lifeSteal: tower.lifeSteal || 0,
                _critChance: tower._critChance || 0,
                critMult: tower.critMult || 1.5,
                chainTargets: tower.chainTargets || 0,
                splashRadius: tower.splashRadius || 0,
                goldPerKill: tower.goldPerKill || 0,
                goldMultiplier: tower.goldMultiplier || 1,
                poisonChance: tower.poisonChance || 0,
                attackType: tower.attackType || 'normal',
            };
            Object.defineProperties(clone, {
                damage:   { get() { let d = (this.baseDmg * Math.max(1,this.level)) * Math.max(0, this.modDmg); if(this.flags.has('arcane')) d += this.level*5; return d; } },
                fireRate: { get() { return Math.max(10, Math.round((this.baseRate * this.modRate) - (this.level * 1.5))); } },
                range:    { get() { return this.baseRange * this.modRange + (this.level * 0.2); } },
                critChance: { get() { return Math.min(1.0, this._critChance || 0); }, set(v) { this._critChance = v; } },
            });
            try { card.apply(clone); } catch(e) { }
            return clone;
        }

        function checkCardDrop(mouseX, mouseY) {
            let cx = canvas.width/2; let cy = canvas.height/2;
            clearDropTarget();
            if(waveActive) {
                floatingTexts.push(new FloatingText(mouseX, mouseY, "EM COMBATE!", '#ef4444')); applyShake(4);
                SFX.ui_error();
                returnCardToHand(); return;
            }

            const card = playerHand[draggingCardIndex];
            if(!card) { returnCardToHand(); return; }

            if(card.isEcon) {
                SFX.card_drop();
                if(card.apply) card.apply(null);
                floatingTexts.push(new FloatingText(mouseX, mouseY - 20, "ATIVADO!", '#fde047', true));
                createParticles((mouseX - cx) / zoom + cx, (mouseY - cy) / zoom + cy, '#fde047', 20);
                playerHand.splice(draggingCardIndex, 1);
                if(dragElement) dragElement.remove(); dragElement = null; draggingCardIndex = -1; document.body.style.cursor = ''; renderHand();
                return;
            }

            /* alvo = a torre MAIS PRÓXIMA dentro do raio (antes pegava a primeira da lista, e acertava a torre vizinha) */
            let _bestI = -1, _bestD = Infinity;
            for(let i = towers.length - 1; i >= 0; i--) {
                const _p = cartToIso(towers[i].gridX, towers[i].gridY);
                const _d = Math.hypot(mouseX - ((_p.x - cx) * zoom + cx), mouseY - ((_p.y - 10 - cy) * zoom + cy));
                if(_d < 60 * zoom && _d < _bestD) { _bestD = _d; _bestI = i; }
            }
            for(let i = towers.length - 1; i >= 0; i--) {
                if(i !== _bestI) continue;
                let t = towers[i]; let p = cartToIso(t.gridX, t.gridY);
                let screenX = (p.x - cx) * zoom + cx; let screenY = (p.y - 10 - cy) * zoom + cy; 
                let dist = Math.hypot(mouseX - screenX, mouseY - screenY);
                                
                if(dist < 60 * zoom) {
                    if(window.nxBlock && nxBlock('card')) { returnCardToHand(); return; }
                    if(card.isPill) {
                        if(sellTokens <= 0) { 
                            SFX.ui_error();
                            floatingTexts.push(new FloatingText(screenX, screenY, "VENDA BLOQUEADA", '#ef4444')); applyShake(4); 
                            returnCardToHand(); return; 
                        } 
                        else {
                            SFX.card_drop();
                            sellTokens--; let soldVal = towerTypes[t.type].cost + (t.level * 10) + (t.effects.length * 25); gold += soldVal;
                            floatingTexts.push(new FloatingText(screenX, screenY, `+${soldVal}g`, '#fde047'));
                            soldTowers.push(t); 
                            towers.splice(i, 1); createParticles(t.gridX, t.gridY, '#ef4444', 30); applyShake(5); updateUI();
                            playerHand.splice(draggingCardIndex, 1);
                        }
                    } else if(card.isApple) {
                        SFX.card_drop();
                        hp += 5; floatingTexts.push(new FloatingText(screenX, screenY, "+5 Vida", '#22c55e'));
                        createParticles(t.gridX, t.gridY, '#22c55e', 30); updateUI(); playerHand.splice(draggingCardIndex, 1);
                    } else {
                        if (t.dur <= 0) {
                            SFX.ui_error();
                            floatingTexts.push(new FloatingText(screenX, screenY, "TORRE QUEBRADA", '#ef4444')); applyShake(4);
                            returnCardToHand(); return;
                        }
                        if (cardRepeatBlocked(t, card)) {
                            SFX.ui_error();
                            floatingTexts.push(new FloatingText(screenX, screenY, "JÁ APLICADA NESTA TORRE", '#ef4444')); applyShake(4);
                            returnCardToHand(); return;
                        }
                        if (!card.healsDur && !card.isMonk && t.effectCount >= 3) { 
                            SFX.ui_error();
                            floatingTexts.push(new FloatingText(screenX, screenY, "MÁXIMO 3 EFEITOS", '#ef4444')); applyShake(4); 
                            returnCardToHand(); return; 
                        } 
                        else { 
                            SFX.card_drop();
                            let _bf = new Set(t.flags); t.levelUp(card); fxCardApply(t, card, _bf); statCardsUsed++; createParticles(t.gridX, t.gridY, '#f0d000', 30); playerHand.splice(draggingCardIndex, 1); 
                        }
                    }
                    if(dragElement) dragElement.remove(); dragElement = null; draggingCardIndex = -1; document.body.style.cursor = ''; renderHand();
                    return;
                }
            }
            returnCardToHand(); 
        }
        
        let _lastGoldPop = 0;
        const _goldT = { x: 0, y: 0, f: -999 };
        function _goldTarget() {
            if (frameCount - _goldT.f >= 20 || frameCount < _goldT.f) {
                const r = document.getElementById('gold').getBoundingClientRect();
                _goldT.x = r.left + r.width / 2; _goldT.y = r.top + r.height / 2; _goldT.f = frameCount;
            }
            return _goldT;
        }

        class UIParticle {
            constructor(sx, sy, val) {
                this.startX = sx; this.startY = sy;
                this.cpX = sx + (Math.random() - 0.5) * 300; this.cpY = sy - 150 - Math.random() * 100;
                this.progress = 0; this.speed = 0.02 + Math.random() * 0.015; this.size = Math.random() * 4 + 4;
                this.x = sx; this.y = sy; this.val = val;
            }
            update() {
                this.progress += this.speed;
                if(this.progress >= 1) { 
                    SFX.coin();
                    gold += this.val; updateUI(); 
                    let gEl = document.getElementById('gold'); const nowT = performance.now();
                    if (nowT - _lastGoldPop > 90) { _lastGoldPop = nowT; gEl.classList.remove('gold-pop'); void gEl.offsetWidth; gEl.classList.add('gold-pop'); }
                    return true; 
                }
                let t = this.progress; let u = 1 - t; let tt = t * t; let uu = u * u;
                const gt = _goldTarget(); let endX = gt.x; let endY = gt.y;
                
                this.x = uu * this.startX + 2 * u * t * this.cpX + tt * endX;
                this.y = uu * this.startY + 2 * u * t * this.cpY + tt * endY;
                return false;
            }
            draw() {
                ctx.fillStyle = '#fef08a'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 15;
                ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size/2, 0, Math.PI*2); ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

// ═══════════ NEXUS FX ENGINE (raios, meteoros, ricochetes, fogo, shader pixel-art) ═══════════
const FX={hitstop:0,slowmo:0,flash:0,px:2,combo:0,comboT:0,list:[],parts:[],decals:[],zones:[]};
const R=(a,b)=>a+Math.random()*(b-a), PI2=Math.PI*2, ISO=(x,y)=>cartToIso(x,y);
const scr=(gx,gy,dy=0)=>{const p=ISO(gx,gy),cx=canvas.width/2,cy=canvas.height/2;return{x:(p.x-cx)*zoom+cx,y:(p.y+dy-cy)*zoom+cy};};
const hs=n=>{FX.hitstop=Math.max(FX.hitstop,n)}, fl=n=>{if(NXO.flash===false)return;FX.flash=Math.max(FX.flash,n)};
function fxP(gx,gy,z,vx,vy,vz,col,life,sz,g,add,shrink){if(PART.keep<1&&(PART.keep===0||Math.random()>PART.keep))return;if(FX.parts.length>PERF.maxFx||!onScreen(gx,gy))return;FX.parts.push({gx,gy,z,vx,vy,vz,col,life,max:life,sz,g:g==null?.25:g,add,shrink});}
function fxBurst(gx,gy,z,n,cols,spd,up,life,sz,g,add,shrink){for(let i=0;i<n;i++){const a=R(0,PI2),s=R(.3,1)*spd;fxP(gx,gy,z,Math.cos(a)*s,Math.sin(a)*s,R(.3,1)*up,cols[i%cols.length],R(.6,1)*life,sz*R(.6,1.4),g,add,shrink);}}
function fxDecal(gx,gy,r,col,a){const pts=[];for(let i=0;i<6;i++)pts.push({x:R(-r,r),y:R(-r,r)*.5,r:R(.25,.65)*r});FX.decals.push({gx,gy,col,a,pts});if(FX.decals.length>150)FX.decals.shift();}
function fxAdd(life,draw,gx,gy,end){FX.list.push({life,max:life,draw,gx,gy,end});}
function fxShock(gx,gy,col,max,w=8){fxAdd(24,p=>{const o=ISO(gx,gy),e=1-Math.pow(1-p,3);ctx.globalAlpha=1-p;ctx.strokeStyle=col;ctx.lineWidth=w*(1-p)+1;ctx.beginPath();ctx.ellipse(o.x,o.y,max*e,max*e/2,0,0,PI2);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(o.x,o.y,max*e*.7,max*e*.35,0,0,PI2);ctx.stroke();});}
function fxFlameDraw(x,y,s,fc){for(let i=0;i<5;i++){const h=(6+(Math.sin(fc*.35+i*1.9)+1)*5)*s,w=3.2*s,xx=x+(i-2)*w*1.1;ctx.fillStyle='#dc2626';ctx.fillRect((xx-w/2)|0,(y-h)|0,w+1,h);ctx.fillStyle='#f97316';ctx.fillRect((xx-w/2+.5)|0,(y-h*.72)|0,w-1,h*.72);ctx.fillStyle='#fde047';ctx.fillRect((xx-.5)|0,(y-h*.4)|0,w*.5,h*.4);}}
function fxZone(gx,gy,r,dmg,life){FX.zones.push({gx,gy,r,dmg,life,max:life});}
// ── RAIO: cai do céu com ramificações, flash e chamuscado ──
function fxBolt(gx,gy,big){
  const pts=[{x:R(-70,70),y:-760}],n=10;for(let i=1;i<n;i++){const t=i/n;pts.push({x:pts[0].x*(1-t)+R(-28,28)*(1-t*.6),y:-760*(1-t)});}pts.push({x:0,y:-6});
  const br=[];for(let k=0;k<4;k++){const s=pts[2+(Math.random()*6|0)],b=[{x:s.x,y:s.y}];let x=s.x,y=s.y;for(let j=0;j<4;j++){x+=R(-34,34)+(k%2?28:-28);y+=R(18,55);b.push({x,y});}br.push(b);}
  fxAdd(18,p=>{const o=ISO(gx,gy),a=p<.4?1:(Math.random()<.55?1:.3)*(1-p);ctx.save();ctx.translate(o.x,o.y);ctx.globalAlpha=a;ctx.lineJoin='miter';ctx.globalCompositeOperation='lighter';
    [[16,'rgba(59,130,246,.45)'],[8,'#fde047'],[3,'#fff']].forEach(([w,c])=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();ctx.lineWidth=w*.45;br.forEach(b=>{ctx.beginPath();b.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();});});
    const g=ctx.createRadialGradient(0,0,2,0,0,60*(1-p*.4));g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(1,'rgba(96,165,250,0)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,60,30,0,0,PI2);ctx.fill();ctx.restore();},gx,gy);
  fl(big?.42:.28);applyShake(big?14:8);hs(2);fxShock(gx,gy,'#7dd3fc',90);fxBurst(gx,gy,4,22,['#fff','#fde047','#7dd3fc'],.14,4.5,24,3,.3,true);fxDecal(gx,gy,22,'#050308',.55);try{SFX.shoot_tesla()}catch(e){}
}
function fxArc(a,b,col='#a5f3fc'){const pa=ISO(a.x,a.y),pb=ISO(b.x,b.y),pts=[];for(let i=0;i<=7;i++){const t=i/7;pts.push({x:pa.x+(pb.x-pa.x)*t+(i&&i<7?R(-9,9):0),y:pa.y-18+(pb.y-pa.y)*t+(i&&i<7?R(-9,9):0)});}
  fxAdd(9,p=>{ctx.globalAlpha=1-p;ctx.globalCompositeOperation='lighter';[[7,col],[2,'#fff']].forEach(([w,c])=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();});ctx.globalCompositeOperation='source-over';});}
// ── METEORO: cai em diagonal, aviso no chão, cratera, fogo persistente ──
function fxMeteor(getPos,onLand,life=32){const tr=[];
  fxAdd(life,p=>{const g=getPos(),o=ISO(g.x,g.y),e=p*p,x=o.x+(1-e)*340,y=o.y-(1-e)*680-10;
    ctx.globalAlpha=.25+p*.5;ctx.strokeStyle='#ef4444';ctx.lineWidth=2;ctx.fillStyle='rgba(239,68,68,.18)';ctx.beginPath();ctx.ellipse(o.x,o.y,14+p*30,7+p*15,0,0,PI2);ctx.fill();ctx.stroke();
    tr.push({x,y});if(tr.length>14)tr.shift();ctx.globalAlpha=1;
    tr.forEach((q,i)=>{const s=(i+1)/tr.length;ctx.globalAlpha=s*.8;ctx.fillStyle=i%3?'#f97316':'#fde047';const r=3+s*13;ctx.fillRect((q.x-r/2+R(-3,3))|0,(q.y-r/2+R(-3,3))|0,r,r);});
    ctx.globalAlpha=1;ctx.save();ctx.translate(x,y);ctx.rotate(p*6);ctx.shadowColor='#f97316';ctx.shadowBlur=24;ctx.fillStyle='#3b2318';ctx.fillRect(-14,-14,28,28);ctx.fillStyle='#7c2d12';ctx.fillRect(-14,-14,14,14);ctx.fillStyle='#f97316';ctx.fillRect(2,-8,9,9);ctx.fillStyle='#fde047';ctx.fillRect(-8,4,6,6);ctx.restore();},0,0,onLand);}
function fxBoom(gx,gy,r,col='#f97316'){const rr=30+r*28;fxShock(gx,gy,col,rr*1.6,10);
  fxAdd(20,p=>{const o=ISO(gx,gy),s=rr*(.4+p*.9);ctx.globalAlpha=1-p;const g=ctx.createRadialGradient(o.x,o.y-s*.4,1,o.x,o.y-s*.4,s);g.addColorStop(0,'#fff');g.addColorStop(.35,'#fde047');g.addColorStop(.7,col);g.addColorStop(1,'rgba(127,29,29,0)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(o.x,o.y-s*.35,s,s*.8,0,0,PI2);ctx.fill();},gx,gy);
  fxBurst(gx,gy,6,30,['#fde047','#f97316','#ef4444','#fff'],.2,5,34,4,.25,true,true);fxBurst(gx,gy,4,10,['#44403c','#292524'],.1,2.2,60,7,.04,false,false);}
function fxMeteorImpact(gx,gy,r,dmg){fxBoom(gx,gy,r||1.5);fl(.5);applyShake(18);hs(4);
  for(let i=0;i<14;i++)fxP(gx,gy,6,R(-.18,.18),R(-.18,.18),R(3,8),['#3b2318','#57534e','#7c2d12'][i%3],R(50,90),R(4,8),.35);
  fxDecal(gx,gy,30,'#1c0a05',.7);fxDecal(gx,gy,48,'#0a0503',.4);fxZone(gx,gy,(r||1.5)*.9,(dmg||30)*.03,260);try{SFX.base_dmg()}catch(e){}}
// ── RICOCHETE: bala viaja de alvo em alvo com faísca e brilho ──
function fxHit(pr,crit,dmg){const t=pr.tgt,c=pr.color||'#fbbf24',bounce=pr.hitEnemies.size>1;
  fxBurst(t.x,t.y,12,crit?16:6,[c,'#fff'],.12,2.5,16,3,.25,true,true);
  if(crit){hs(2);fl(.15);fxShock(t.x,t.y,'#fde047',46,4);}
  if(bounce){const o={x:t.x,y:t.y},n=pr.hitEnemies.size;fxAdd(10,p=>{const q=ISO(o.x,o.y);ctx.globalAlpha=1-p;ctx.strokeStyle='#e0f2fe';ctx.lineWidth=3-p*2;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4+n,r0=6+p*8,r1=14+p*30*(i%2?.5:1);ctx.moveTo(q.x+Math.cos(a)*r0,q.y-14+Math.sin(a)*r0*.5);ctx.lineTo(q.x+Math.cos(a)*r1,q.y-14+Math.sin(a)*r1*.5);}ctx.stroke();});}}
function fxChain(pr,nx){if(pr.type==='lightning'||pr.type==='storm')return fxArc(pr.tgt,nx);
  const a=ISO(pr.tgt.x,pr.tgt.y),b=ISO(nx.x,nx.y),s=scr(pr.tgt.x,pr.tgt.y,-50);floatingTexts.push(new FloatingText(s.x,s.y,'RICOCHET x'+pr.hitEnemies.size,'#7dd3fc',false));
  fxAdd(12,p=>{ctx.globalAlpha=(1-p)*.7;ctx.strokeStyle='#bae6fd';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(a.x,a.y-15);ctx.lineTo(b.x,b.y-15);ctx.stroke();ctx.setLineDash([]);});}
function fxRicochetDemo(t){const pts=[];for(let i=0;i<5;i++)pts.push({x:t.gridX+R(-2.6,2.6),y:t.gridY+R(-2.6,2.6)});const seg=9,L=seg*(pts.length-1);
  fxAdd(L,p=>{const f=p*(pts.length-1),i=Math.min(pts.length-2,f|0),u=f-i,A=ISO(pts[i].x,pts[i].y),B=ISO(pts[i+1].x,pts[i+1].y),x=A.x+(B.x-A.x)*u,y=A.y-15+(B.y-A.y)*u;
    ctx.strokeStyle='#7dd3fc';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(A.x,A.y-15);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#fff';ctx.shadowColor='#38bdf8';ctx.shadowBlur=14;ctx.fillRect(x-4,y-4,8,8);ctx.shadowBlur=0;
    if(u<.15){ctx.globalAlpha=1-u*6;ctx.strokeStyle='#fff';ctx.beginPath();ctx.arc(A.x,A.y-15,10+u*60,0,PI2);ctx.stroke();}});
  pts.forEach((q,i)=>setTimeout(()=>fxBurst(q.x,q.y,12,10,['#fff','#7dd3fc'],.1,2.4,16,3,.25,true,true),i*150));}
// ── MORTE (gibs, sangue, combo), muzzle, status ──
const COMBOS={5:['KILLING SPREE!','#fde047'],10:['MASSACRE!','#fb923c'],20:['IMPARÁVEL!!','#f43f5e'],35:['NOSSA, QUE JOGO FODA!!!','#a855f7'],50:['LENDÁRIO!!!!','#22d3ee']};
const FX_SWORDS=(()=>{let r='';const p=(x,y,c)=>{r+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`};
  for(const f of[0,1]){const X=x=>f?15-x:x;
    for(let i=1;i<=10;i++){p(X(i),i,'currentColor');p(X(f?i-1:i+1),i,'#fff');}      // lâmina
    p(X(8),13,'#f59e0b');p(X(9),12,'#f59e0b');p(X(10),11,'#f59e0b');p(X(11),10,'#f59e0b');p(X(12),9,'#f59e0b');p(X(11),11,'#f59e0b');  // guarda
    p(X(12),12,'#92400e');p(X(13),13,'#92400e');p(X(14),14,'#f59e0b');}              // cabo + pomo
  return `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;})();
function fxBanner(txt,col,small){const d=document.createElement('div');d.className='fx-banner'+(small?' sm':'');d.style.color=col||'#fde047';
  if(txt.indexOf('⚔')<0)d.textContent=txt;
  else{d.classList.add('has-sw');const sw=()=>{const i=document.createElement('i');i.className='fx-sw';i.innerHTML=FX_SWORDS;return i;},t=document.createElement('span');t.textContent=txt.replace(/⚔/g,'').trim();d.append(sw(),t,sw());}
  document.body.appendChild(d);setTimeout(()=>d.remove(),small?1300:1900);}
function fxDeath(e){const t=ENEMY_TYPES[e.enemyType],boss=!!t.isBoss,st=e.statusEffects.map(s=>s.type);
  for(let i=0,n=boss?38:13;i<n;i++)fxP(e.x,e.y,R(8,20),R(-.13,.13),R(-.13,.13),R(2,6),[t.color,'#7f1d1d','#b91c1c','#3f0d0d'][i%4],R(45,90),R(3,6),.3);
  fxDecal(e.x,e.y,boss?34:14,'#5b0b0b',.55);
  if(st.includes('fire')){fxBurst(e.x,e.y,10,14,['#f97316','#fde047'],.1,3,30,3,.2,true,true);fxDecal(e.x,e.y,16,'#0a0503',.5);}
  if(st.includes('frost'))fxBurst(e.x,e.y,12,16,['#e0f2fe','#7dd3fc','#fff'],.18,4,40,4,.3);
  if(st.includes('poison'))fxBurst(e.x,e.y,10,10,['#4ade80','#166534'],.1,2,40,4,.05,false,true);
  hs(boss?10:1);
  if(boss){FX.slowmo=80;fl(1);applyShake(28);fxShock(e.x,e.y,'#f97316',160,12);fxBanner('BOSS ELIMINADO!','#f97316');}
  FX.combo++;FX.comboT=110;const c=COMBOS[FX.combo];if(c){fxBanner(c[0],c[1]);gold+=FX.combo;updateUI();}}
function fxMuzzle(t){const p=ISO(t.gridX,t.gridY),sn=t.type==='sniper',x=p.x+Math.cos(t.angle)*16,y=p.y-30+Math.sin(t.angle)*8,a=t.angle,c=t.proj;
  fxAdd(sn?7:4,q=>{ctx.globalAlpha=1-q;ctx.fillStyle='#fff';const s=(sn?16:9)*(1-q*.5);ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillRect(0,-s/4,s*1.6,s/2);ctx.fillStyle=c;ctx.fillRect(-s/3,-s/2,s/2,s);ctx.restore();});
  fxP(t.gridX,t.gridY,30,Math.cos(a+1.6)*.04+R(-.02,.02),Math.sin(a+1.6)*.04,R(1.5,3),sn?'#ef4444':'#fbbf24',50,3,.3);
  if(sn){applyShake(2);fxBurst(t.gridX,t.gridY,28,6,[c,'#fff'],.06,1,14,3,.2,true,true);}}
function fxFireTick(e,ef){if(frameCount%3===0)fxP(e.x+R(-.2,.2),e.y+R(-.2,.2),R(10,24),0,0,R(.5,1.4),['#f97316','#fde047','#ef4444'][frameCount%3],R(20,35),R(2,4),-.01,true,true);
  if(frameCount%40===0)for(const n of enemies)if(!n.dead&&n!==e&&Math.hypot(n.x-e.x,n.y-e.y)<1.2&&!n.statusEffects.some(s=>s.type==='fire')){n.statusEffects.push({type:'fire',dmg:ef.dmg*.6,duration:70});fxBurst(n.x,n.y,14,8,['#f97316','#fde047'],.1,3,20,3,.2,true,true);}}
function fxStatusDraw(e,fz,po,bl,fi){const fc=frameCount,sh=e.statusEffects.some(s=>s.type==='shock');
  if(fi)fxFlameDraw(0,-6,e.enemyType==='boss'?1.8:1.2,fc);
  if(fz){ctx.fillStyle='rgba(186,230,253,.4)';ctx.fillRect(-13,-30,26,28);ctx.fillStyle='#e0f2fe';for(let i=0;i<5;i++){const a=i*1.26,x=Math.cos(a)*14,y=-16+Math.sin(a)*13;ctx.fillRect(x-2,y-5,4,10);ctx.fillRect(x-5,y-2,10,4);}}
  if(po){ctx.fillStyle='#4ade80';for(let i=0;i<3;i++){const ph=(fc*.04+i*.33)%1;ctx.globalAlpha*=.8;ctx.fillRect(-9+i*8+Math.sin(fc*.2+i)*2,-6-ph*30,4,4);ctx.globalAlpha=1;}}
  if(bl){ctx.fillStyle='#b91c1c';for(let i=0;i<3;i++){const ph=(fc*.06+i*.4)%1;ctx.fillRect(-8+i*8,-14+ph*18,3,4);}}
  if(sh){ctx.strokeStyle='#fde047';ctx.lineWidth=2;for(let k=0;k<2;k++){ctx.beginPath();ctx.moveTo(R(-14,14),-34);for(let i=1;i<5;i++)ctx.lineTo(R(-14,14),-34+i*7);ctx.stroke();}}}
// ── CARTA APLICADA: pilar de luz + demonstração do efeito ──
function fxCardApply(t,card,bf){const col=rarityColors[card.rarity]||'#fff',gx=t.gridX,gy=t.gridY;
  fxAdd(28,p=>{const o=ISO(gx,gy);ctx.globalAlpha=(1-p)*.9;ctx.globalCompositeOperation='lighter';const w=34*(1-p*.6),g=ctx.createLinearGradient(0,o.y-700,0,o.y);g.addColorStop(0,col+'00');g.addColorStop(1,col);ctx.fillStyle=g;ctx.fillRect(o.x-w/2,o.y-700,w,700);ctx.fillStyle='#fff';ctx.fillRect(o.x-w/6,o.y-700,w/3,700);ctx.globalCompositeOperation='source-over';},gx,gy);
  fxShock(gx,gy,col,100,10);fxBurst(gx,gy,4,34,[col,'#fff'],.14,5,40,3,.18,true,true);fl(.3);applyShake(6);hs(3);
  const s=scr(gx,gy,-70);floatingTexts.push(new FloatingText(s.x,s.y,card.name.toUpperCase(),col,true));
  const nf=f=>t.flags.has(f)&&!bf.has(f);
  setTimeout(()=>{if(nf('lightning')||nf('storm'))fxBolt(gx,gy,true);if(nf('meteor')){const tx=gx+2,ty=gy+2;fxMeteor(()=>({x:tx,y:ty}),()=>fxMeteorImpact(tx,ty,1.5,30));}
    if(nf('fire')){fxBurst(gx,gy,6,40,['#f97316','#fde047','#ef4444'],.14,4,40,3,.1,true,true);fxZone(gx,gy,.8,0,90);}if(nf('chain'))fxRicochetDemo(t);
    if(nf('frost'))fxBurst(gx,gy,8,40,['#e0f2fe','#7dd3fc','#fff'],.2,4,50,4,.15);if(nf('poison'))fxBurst(gx,gy,6,30,['#4ade80','#166534'],.1,2,60,4,.03,false,true);},350);}
// ── LOOP: update / draw ──
function fxUpdate(){FX.flash*=.86;if(FX.flash<.01)FX.flash=0;
  for(let i=FX.list.length-1;i>=0;i--){const f=FX.list[i];if(--f.life<=0){f.end&&f.end();FX.list.splice(i,1);}}
  for(let i=FX.parts.length-1;i>=0;i--){const p=FX.parts[i];p.gx+=p.vx;p.gy+=p.vy;p.z+=p.vz;p.vz-=p.g;if(p.z<0){p.z=0;p.vz*=-.4;p.vx*=.6;p.vy*=.6;if(Math.abs(p.vz)<.35)p.vz=0;}if(--p.life<=0)FX.parts.splice(i,1);}
  for(let i=FX.zones.length-1;i>=0;i--){const z=FX.zones[i];if(--z.life<=0){FX.zones.splice(i,1);continue;}
    if(z.life%10===0)for(const e of enemies){const ty=z.kind==='rad'?'poison':'fire';if(!e.dead&&Math.hypot(e.x-z.gx,e.y-z.gy)<z.r&&z.dmg>0&&!e.statusEffects.some(s=>s.type===ty))e.statusEffects.push(ty==='poison'?{type:'poison',dmg:z.dmg,duration:60,stacks:1}:{type:'fire',dmg:z.dmg,duration:50});}
    if(z.life%4===0)fxP(z.gx+R(-z.r,z.r)*.7,z.gy+R(-z.r,z.r)*.7,2,0,0,R(.6,1.5),(z.kind==='rad'?['#86efac','#4ade80']:['#f97316','#fde047'])[z.life%2],R(18,30),R(2,4),-.01,true,true);}
  if(FX.comboT>0){FX.comboT--;if(!FX.comboT)FX.combo=0;}const c=document.getElementById('fx-combo');if(c){const v=FX.combo>=3?FX.combo:0;if(c._v!==v){c._v=v;c.textContent=v?'x'+v+' COMBO':'';c.style.opacity=v?1:0;c.classList.remove('pop');void c.offsetWidth;c.classList.add('pop');}}}
let _fd=null;
function fxDrawDecals(){const k=map.length+'x'+map[0].length+waypoints.length;
  if(!_fd||_fd.k!==k){const a=new Path2D(),b=new Path2D();for(let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){const h=(x*73+y*151+x*y*7)%9,p=ISO(x,y);if(map[y][x]===1){if(h<4)b.rect(p.x-14+h*7,p.y-3+(h%3)*3,3,2);}else if(h<4){a.rect(p.x-18+h*9,p.y-4+(h%2)*6,2,2);if(h===0)a.rect(p.x+4,p.y+2,6,1);}}_fd={k,a,b,ox:camX,oy:camY};}
  ctx.save();ctx.translate(camX-_fd.ox,camY-_fd.oy);ctx.fillStyle='rgba(255,255,255,.07)';ctx.fill(_fd.a);ctx.fillStyle='rgba(120,20,20,.35)';ctx.fill(_fd.b);ctx.restore();
  for(const d of FX.decals){const o=ISO(d.gx,d.gy);ctx.globalAlpha=d.a*Math.min(1,(d.life||999)/150);ctx.fillStyle=d.col;for(const q of d.pts){ctx.beginPath();ctx.ellipse(o.x+q.x,o.y+q.y,q.r,q.r*.5,0,0,PI2);ctx.fill();}}ctx.globalAlpha=1;
  }
function fxDrawWorld(){vpUpdate();ctx.save();for(const q of particles)q.draw();for(const f of FX.list){if(f.gx!=null&&(f.gx||f.gy)){const o=ISO(f.gx,f.gy),m=900/zoom;if(o.x<VP.x0-m||o.x>VP.x1+m||o.y<VP.y0-m||o.y>VP.y1+m)continue;}ctx.save();f.draw(1-f.life/f.max);ctx.restore();}
  let _ad=null;for(const p of FX.parts){const o=ISO(p.gx,p.gy);if(o.x<VP.x0||o.x>VP.x1||o.y-p.z<VP.y0||o.y-p.z>VP.y1)continue;const s=p.sz*(p.shrink?p.life/p.max:1);ctx.globalAlpha=Math.min(1,p.life/p.max*1.6);const _a=!!p.add;if(_a!==_ad){_ad=_a;ctx.globalCompositeOperation=_a?'lighter':'source-over';}ctx.fillStyle=p.col;ctx.fillRect((o.x-s/2)|0,(o.y-p.z-s/2)|0,Math.max(1,s|0),Math.max(1,s|0));}ctx.restore();}
FloatingText.prototype.draw=function(){if(NXO.dmg===false&&/^(⚡ )?\d+$/.test(this.text))return;const pop=this.life>.9?1+(this.life-.9)*7:1;ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,this.life*1.8));ctx.translate(Math.round(this.x),Math.round(this.y));ctx.scale(pop,pop);ctx.font=`${Math.round(this.size*.78)}px "Press Start 2P",monospace`;ctx.textAlign='center';ctx.lineWidth=6;ctx.lineJoin='round';ctx.strokeStyle='#0a0410';ctx.strokeText(this.text,0,0);ctx.fillStyle=this.color;ctx.fillText(this.text,0,0);ctx.restore();};
// ── SHADER: Pixelation + dithering + paleta + vinheta + aberração cromática ──
let _gl=null;
function fxInitGL(){try{const c=document.createElement('canvas');c.id='fx-gl';c.width=canvas.width;c.height=canvas.height;const gl=c.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false});if(!gl)return;
  const mk=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(o);return o;},pr=gl.createProgram();
  gl.attachShader(pr,mk(gl.VERTEX_SHADER,'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(pr,mk(gl.FRAGMENT_SHADER,`precision mediump float;uniform sampler2D t;uniform vec2 r;uniform float px,fl,ab,tm;
float bay(vec2 p){vec2 q=mod(p,2.);float i=q.x+q.y*2.;return (i<.5?0.:i<1.5?.5:i<2.5?.75:.25)-.375;}
void main(){vec2 f=gl_FragCoord.xy,b=floor(f/px),uv=(b+.5)*px/r;float o=ab/r.x;
vec3 bg=mix(vec3(.035,.025,.06),vec3(.085,.05,.11),uv.y);vec4 s=texture2D(t,uv),sr=texture2D(t,uv+vec2(o,0.)),sb=texture2D(t,uv-vec2(o,0.));
vec3 c=vec3(sr.r+bg.r*(1.-sr.a),s.g+bg.g*(1.-s.a),sb.b+bg.b*(1.-sb.a));
float l=dot(c,vec3(.3,.59,.11));c=mix(vec3(l),c,1.28);c=(c-.5)*1.14+.5;c*=vec3(1.05,1.,1.07);
c=floor(c*9.+.5+bay(b))/9.;vec2 q=f/r-.5;c*=1.-dot(q,q)*1.35;c*=(mod(b.y,2.)<1.?1.:.94);c+=fl*vec3(1.,.93,.75);gl_FragColor=vec4(c,1.);}`));
  gl.linkProgram(pr);gl.useProgram(pr);const bf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const al=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(al);gl.vertexAttribPointer(al,2,gl.FLOAT,false,0,0);
  const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);[[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]].forEach(([k,v])=>gl.texParameteri(gl.TEXTURE_2D,k,v));
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  const U=n=>gl.getUniformLocation(pr,n);_gl={c,gl,r:U('r'),px:U('px'),fl:U('fl'),ab:U('ab'),tm:U('tm')};document.body.insertBefore(c,document.body.firstChild);}catch(e){console.warn('Shader pixel desativado:',e);_gl=null;}}
function fxPost(){if(!_gl||FX.px<=1||!PERF.post){if(_gl&&_gl.c.style.display!=='none')_gl.c.style.display='none';canvas.style.opacity=1;return;}
  const {c,gl}=_gl;c.style.display='block';if(c.width!==canvas.width||c.height!==canvas.height){c.width=canvas.width;c.height=canvas.height;gl.viewport(0,0,c.width,c.height);}
  if(_gl.tw!==canvas.width||_gl.th!==canvas.height){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);_gl.tw=canvas.width;_gl.th=canvas.height;}else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,canvas);gl.uniform2f(_gl.r,c.width,c.height);gl.uniform1f(_gl.px,FX.px);gl.uniform1f(_gl.fl,Math.min(.9,FX.flash));gl.uniform1f(_gl.ab,Math.min(3,screenShake*.12+FX.flash*2.2));gl.uniform1f(_gl.tm,frameCount);gl.drawArrays(gl.TRIANGLES,0,6);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.restore();}
function fxCyclePx(){PERF.slow=0;PERF.ema=16.7;setQuality(2);FX.px=FX.px>1?1:2;const b=document.getElementById('fx-px');if(b)b.querySelector('span').textContent=FX.px>1?'ON':'OFF';if(window.nxPxChanged)nxPxChanged();}
function fxSkipIntro(){menuActive=false;nxStarted=true;const s=document.getElementById('splash');if(s)s.remove();}
(function fxBoot(){fxInitGL();window.addEventListener('keydown',e=>{if(e.key==='p'||e.key==='P')fxCyclePx();});
  const w=document.getElementById('audio-controls-wrapper'),b=document.createElement('div');b.id='fx-px';b.className='audio-btn targeting-trigger';b.title='Pixel shader [P]';b.innerHTML='<i class="fa-solid fa-border-all"></i><span>ON</span>';b.onclick=fxCyclePx;w&&w.appendChild(b);
  const sp=document.getElementById('splash'),em=sp&&sp.querySelector('.sp-embers');if(em)for(let i=0;i<30;i++){const s=document.createElement('i');s.style.cssText=`left:${R(0,100)}%;animation-duration:${R(3,8)}s;animation-delay:${R(0,6)}s;width:${(R(2,5)|0)*2}px;height:${(R(2,5)|0)*2}px`;em.appendChild(s);}
})();

// ═══════════ NEXUS FX · EXPANSÃO (gelo, veneno, sangue, plasma, vazio, arcano, perfurante, tempestade, nuclear, auras) ═══════════
const FXC={fire:['#f97316','#fde047','#ef4444'],frost:['#e0f2fe','#7dd3fc','#38bdf8'],poison:['#4ade80','#22c55e','#166534'],bleed:['#ef4444','#b91c1c','#7f1d1d'],plasma:['#f0abfc','#22d3ee','#fff'],void:['#a855f7','#6b21a8','#e9d5ff'],arcane:['#c4b5fd','#8b5cf6','#fff'],rad:['#86efac','#4ade80','#fde047'],lightning:['#fde047','#7dd3fc','#fff'],meteor:['#f97316','#92400e','#fde047'],chain:['#7dd3fc','#fff','#bae6fd'],nuclear:['#86efac','#a3e635','#fde047']};
const FXA={fire:[1,-.01],frost:[-.25,0],poison:[.5,-.005],bleed:[-.55,.01],void:[0,0],plasma:[0,0],arcane:[.6,0],lightning:[0,0],meteor:[.7,-.01],chain:[0,0],nuclear:[.4,0]};
const once=(k,n)=>{if((FX['c_'+k]||0)>frameCount)return false;FX['c_'+k]=frameCount+n;return true;};
const gfx=(p,a)=>{ctx.globalAlpha=a;};
// ── CAMADA SUPERIOR: tudo que é efeito/partícula passa por cima de torres e inimigos ──
function fxDrawZones(){const fc=frameCount;for(const z of FX.zones){const o=ISO(z.gx,z.gy),f=Math.min(1,z.life/60);ctx.globalAlpha=f*.9;
  if(z.kind==='rad'){ctx.fillStyle='rgba(74,222,128,.18)';ctx.beginPath();ctx.ellipse(o.x,o.y,z.r*40,z.r*20,0,0,PI2);ctx.fill();ctx.fillStyle='#86efac';for(let k=0;k<8;k++){const a=k*1.7,ph=(fc*.02+k*.31)%1,q=(k%3)/3+.3;ctx.fillRect((o.x+Math.cos(a)*z.r*30*q)|0,(o.y+Math.sin(a)*z.r*15*q-ph*26)|0,3,3);}}
  else for(let k=0;k<6;k++)fxFlameDraw(o.x+Math.cos(k*1.05)*z.r*26,o.y+Math.sin(k*1.05)*z.r*13,.9,fc+k*7);}ctx.globalAlpha=1;}
function fxStatusTop(e){const s=e.statusEffects;if(!s.length)return;const has=t=>s.some(x=>x.type===t),fz=has('frost'),po=has('poison'),bl=has('bleed'),fi=has('fire');if(!(fz||po||bl||fi||has('shock')))return;
  const p=ISO(e.x,e.y),bob=Math.abs(Math.sin(e.wobble))*-12;ctx.save();ctx.translate(p.x,p.y+bob);ctx.scale(e.scale*(1/e.squash),e.scale*e.squash);fxStatusDraw(e,fz,po,bl,fi);ctx.restore();}
const _fxZone=fxZone;fxZone=function(gx,gy,r,dmg,life,kind){FX.zones.push({gx,gy,r,dmg,life,max:life,kind});};
// ── GELO: espetos de gelo brotam do chão ──
function fxIce(gx,gy,n=5,r=24){if(!once('ice',4))return;const sp=[];for(let i=0;i<n;i++){const a=i/n*PI2+R(0,.5);sp.push({x:Math.cos(a)*r*R(.5,1),y:Math.sin(a)*r*R(.5,1)*.5,h:R(22,46),w:R(5,9)});}
  fxAdd(26,p=>{const o=ISO(gx,gy),k=p<.3?p/.3:1-(p-.3)/.7;ctx.globalAlpha=Math.min(1,k*1.5);sp.forEach((s,i)=>{const h=s.h*k;ctx.fillStyle=i%2?'#bae6fd':'#7dd3fc';ctx.beginPath();ctx.moveTo(o.x+s.x-s.w,o.y+s.y);ctx.lineTo(o.x+s.x,o.y+s.y-h);ctx.lineTo(o.x+s.x+s.w,o.y+s.y);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.fillRect((o.x+s.x-1)|0,(o.y+s.y-h*.75)|0,2,(h*.5)|0);});},gx,gy);
  fxShock(gx,gy,'#7dd3fc',r*2.4,5);fxBurst(gx,gy,6,12,FXC.frost,.1,3,30,3,.12,true);}
// ── VENENO: nuvem tóxica + bolhas ──
function fxToxic(gx,gy,big){if(!once('tox',5))return;fxBurst(gx,gy,10,big?16:8,FXC.poison,.05,1.2,55,big?10:7,-.005,false,true);fxBurst(gx,gy,6,5,['#bbf7d0','#4ade80'],.03,2.2,40,3,.02,true,true);
  fxAdd(30,p=>{const o=ISO(gx,gy),s=(big?48:28)*(.6+p*.6),g=ctx.createRadialGradient(o.x,o.y-6,1,o.x,o.y-6,s);g.addColorStop(0,'rgba(74,222,128,.55)');g.addColorStop(1,'rgba(22,101,52,0)');ctx.globalAlpha=1-p;ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(o.x,o.y-6,s,s*.55,0,0,PI2);ctx.fill();},gx,gy);}
// ── SANGUE: corte diagonal + jato ──
function fxSlash(gx,gy,big){if(!once('slash',2))return;const a=R(-.9,.9)-.8,L=big?34:24;
  fxAdd(9,p=>{const o=ISO(gx,gy),e=Math.min(1,p*2.5),x0=o.x-Math.cos(a)*L,y0=o.y-16-Math.sin(a)*L;ctx.globalAlpha=1-p;ctx.lineCap='square';ctx.strokeStyle='#fecaca';ctx.lineWidth=6*(1-p)+1;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+Math.cos(a)*L*2*e,y0+Math.sin(a)*L*2*e);ctx.stroke();ctx.strokeStyle='#dc2626';ctx.lineWidth=2;ctx.stroke();},gx,gy);
  for(let i=0;i<(big?14:7);i++)fxP(gx,gy,R(10,24),Math.cos(a)*R(.02,.12)+R(-.03,.03),Math.sin(a)*R(.01,.06),R(1,3.5),i%3?'#b91c1c':'#ef4444',R(24,44),R(2,4),.25);}
// ── PLASMA ──
function fxPlasma(gx,gy){if(!once('pls',3))return;fxShock(gx,gy,'#f0abfc',54,4);fxAdd(14,p=>{const o=ISO(gx,gy),s=8+p*26;ctx.globalAlpha=1-p;ctx.globalCompositeOperation='lighter';const g=ctx.createRadialGradient(o.x,o.y-14,1,o.x,o.y-14,s);g.addColorStop(0,'#fff');g.addColorStop(.4,'#e879f9');g.addColorStop(1,'rgba(34,211,238,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(o.x,o.y-14,s,0,PI2);ctx.fill();},gx,gy);fxBurst(gx,gy,12,12,FXC.plasma,.14,2.5,22,3,.15,true,true);}
// ── VAZIO: vórtice que suga partículas ──
function fxVoid(gx,gy){if(!once('void',8))return;
  fxAdd(34,p=>{const o=ISO(gx,gy),fd=p<.2?p/.2:p>.75?(1-p)/.25:1;ctx.globalAlpha=fd;ctx.translate(o.x,o.y-10);ctx.scale(1,.55);for(let k=0;k<4;k++){ctx.strokeStyle=k%2?'#a855f7':'#6b21a8';ctx.lineWidth=4-k*.6;ctx.beginPath();for(let i=0;i<=24;i++){const t=i/24,r=(1-t)*34*(1+.15*Math.sin(p*9)),a=t*7+p*14+k*1.57;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.stroke();}ctx.fillStyle='#050010';ctx.beginPath();ctx.arc(0,0,7+p*3,0,PI2);ctx.fill();ctx.strokeStyle='#f0abfc';ctx.lineWidth=1.5;ctx.stroke();},gx,gy,()=>fxShock(gx,gy,'#a855f7',44,4));
  for(let i=0;i<14;i++){const a=R(0,PI2),d=R(.5,1.1);fxP(gx+Math.cos(a)*d,gy+Math.sin(a)*d,R(2,18),-Math.cos(a)*d/22,-Math.sin(a)*d/22,0,FXC.void[i%3],22,3,0,true,true);}}
// ── ARCANO: círculo rúnico + feixe de luz ──
function fxArcane(gx,gy){if(!once('arc',6))return;
  fxAdd(30,p=>{const o=ISO(gx,gy),k=p<.2?p/.2:1-(p-.2)/.8;ctx.globalAlpha=k;ctx.translate(o.x,o.y);ctx.scale(1,.5);ctx.strokeStyle='#c4b5fd';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,30,0,PI2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,22,0,PI2);ctx.stroke();ctx.rotate(p*3);for(let i=0;i<6;i++){const a=i*PI2/6;ctx.fillStyle='#8b5cf6';ctx.fillRect(Math.cos(a)*26-2,Math.sin(a)*26-2,5,5);ctx.beginPath();ctx.moveTo(Math.cos(a)*22,Math.sin(a)*22);ctx.lineTo(Math.cos(a+2.1)*22,Math.sin(a+2.1)*22);ctx.stroke();}},gx,gy);
  fxAdd(22,p=>{const o=ISO(gx,gy);ctx.globalAlpha=(1-p)*.8;ctx.globalCompositeOperation='lighter';const w=14*(1-p),g=ctx.createLinearGradient(0,o.y-120,0,o.y);g.addColorStop(0,'rgba(196,181,253,0)');g.addColorStop(1,'#c4b5fd');ctx.fillStyle=g;ctx.fillRect(o.x-w/2,o.y-120,w,120);},gx,gy);fxBurst(gx,gy,4,16,FXC.arcane,.05,3,36,3,.04,true,true);}
// ── PERFURANTE: risco atravessa o inimigo ──
function fxPierce(pr){const t=pr.tgt,dx=t.x-pr.startX,dy=t.y-pr.startY,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d,c=pr.color||'#fff';
  fxAdd(9,p=>{const A=ISO(t.x-ux*1.4,t.y-uy*1.4),B=ISO(t.x+ux*1.8,t.y+uy*1.8),e=Math.min(1,p*3);ctx.globalAlpha=1-p;ctx.lineCap='round';ctx.strokeStyle=c;ctx.lineWidth=7*(1-p)+1;ctx.beginPath();ctx.moveTo(A.x,A.y-14);ctx.lineTo(A.x+(B.x-A.x)*e,A.y-14+(B.y-A.y)*e);ctx.stroke();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();},t.x,t.y);
  for(let i=0;i<8;i++)fxP(t.x,t.y,R(8,22),ux*R(.04,.16)+R(-.03,.03),uy*R(.04,.16)+R(-.03,.03),R(.3,1.5),i%2?c:'#fff',R(12,22),3,.12,true,true);}
// ── TEMPESTADE: nuvem, chuva e relâmpagos extras (causam dano!) ──
function fxStorm(gx,gy,dmg){if(!once('storm',24))return;
  fxAdd(46,p=>{const o=ISO(gx,gy),k=p<.15?p/.15:p>.8?(1-p)/.2:1,cy=o.y-250;ctx.globalAlpha=k*.92;[[-60,0,44],[-25,-10,52],[15,-6,48],[52,2,40],[0,8,60]].forEach(([x,y,r],i)=>{ctx.fillStyle=i%2?'#1e1b3a':'#2b2650';ctx.beginPath();ctx.ellipse(o.x+x+Math.sin(p*6+i)*4,cy+y,r,r*.5,0,0,PI2);ctx.fill();});if(Math.random()<.3){ctx.fillStyle='#fde047';ctx.fillRect((o.x+R(-60,60))|0,cy+10,3,R(8,18)|0);}},gx,gy);
  for(let i=0;i<26;i++)fxP(gx+R(-1.2,1.2),gy+R(-1.2,1.2),R(150,260),-.02,0,-R(6,8),'#93c5fd',30,2,0,true);
  [0,1,2].forEach(i=>setTimeout(()=>{const bx=gx+R(-1.3,1.3),by=gy+R(-1.3,1.3);fxBolt(bx,by);if(dmg)enemies.forEach(e=>{if(!e.dead&&Math.hypot(e.x-bx,e.y-by)<1)e.hp-=dmg*.4;});},200+i*170));}
// ── NUCLEAR: cogumelo atômico + zona radioativa ──
function fxNuke(gx,gy,r){if(!once('nuke',20))return;fl(.8);applyShake(24);hs(6);fxShock(gx,gy,'#86efac',190,14);fxShock(gx,gy,'#fff',120,8);
  fxAdd(80,p=>{const o=ISO(gx,gy),h=Math.min(1,p*2.2)*120,s=Math.min(1,p*1.6);ctx.globalAlpha=p>.7?(1-p)/.3:1;ctx.fillStyle='#78716c';ctx.fillRect(o.x-9*s,o.y-h,18*s,h);ctx.fillStyle='#a3e635';ctx.fillRect(o.x-5*s,o.y-h,10*s,h);const cy=o.y-h-4;
    [[0,0,46],[-34,10,30],[34,10,30],[-18,-14,28],[20,-12,30]].forEach(([x,y,rr],i)=>{ctx.fillStyle=['#fb923c','#fde047','#ef4444','#f97316','#fbbf24'][i];ctx.beginPath();ctx.ellipse(o.x+x*s,cy+y*s,rr*s,rr*s*.7,0,0,PI2);ctx.fill();});ctx.fillStyle='rgba(134,239,172,.35)';ctx.beginPath();ctx.ellipse(o.x,cy+6,60*s,26*s,0,0,PI2);ctx.fill();},gx,gy);
  fxBurst(gx,gy,6,50,[...FXC.rad,'#fff'],.25,6,50,4,.15,true,true);fxDecal(gx,gy,60,'#0a1a08',.6);fxZone(gx,gy,(r||2.5)*.9,.5,300,'rad');}
const _fxBoom=fxBoom;fxBoom=function(gx,gy,r,col){if(col==='#86efac'&&r>=2)return fxNuke(gx,gy,r);_fxBoom(gx,gy,r,col);};
// ── Ganchos: impacto por tipo, morte, disparo, carta aplicada ──
const _fxHit=fxHit;fxHit=function(pr,crit,dmg){_fxHit(pr,crit,dmg);const t=pr.tgt,f=pr.tower.flags,ty=pr.type;
  if(ty==='frost'||f.has('frost'))fxIce(t.x,t.y,crit?7:4,crit?30:20);if(f.has('poison'))fxToxic(t.x,t.y,false);if(f.has('bleed'))fxSlash(t.x,t.y,crit);
  if(f.has('fire')||ty==='fire')fxBurst(t.x,t.y,14,8,FXC.fire,.1,3,20,3,.15,true,true);if(ty==='plasma'||f.has('plasma'))fxPlasma(t.x,t.y);
  if(ty==='void'||f.has('void'))fxVoid(t.x,t.y);if(ty==='arcane'||f.has('arcane'))fxArcane(t.x,t.y);if(pr.pierces>0||ty==='piercing')fxPierce(pr);if(ty==='storm')fxStorm(t.x,t.y,pr.dmg);};
const _fxDeath=fxDeath;fxDeath=function(e){_fxDeath(e);const st=e.statusEffects.map(s=>s.type),near=(n,d)=>!n.dead&&n!==e&&Math.hypot(n.x-e.x,n.y-e.y)<d;
  if(st.includes('fire')){const fe=e.statusEffects.find(s=>s.type==='fire');fxBoom(e.x,e.y,.7,'#f97316');enemies.forEach(n=>{if(near(n,1.5)){if(!n.statusEffects.some(s=>s.type==='fire'))n.statusEffects.push({type:'fire',dmg:fe.dmg*.8,duration:80});n.hp-=e.maxHp*.03;}});}
  if(st.includes('frost')){fxIce(e.x,e.y,8,34);enemies.forEach(n=>{if(near(n,1.8))n.statusEffects.push({type:'frost',slow:.5,duration:70});});}
  if(st.includes('poison'))fxToxic(e.x,e.y,true);
  if(st.includes('bleed'))for(let i=0;i<10;i++)fxP(e.x,e.y,8,R(-.02,.02),R(-.02,.02),R(4,8),'#dc2626',R(30,50),R(2,4),.3);};
const _fxMuz=fxMuzzle;fxMuzzle=function(t){_fxMuz(t);const f=[...t.flags].find(x=>FXC[x]);if(f&&once('mz'+f,3))fxBurst(t.gridX,t.gridY,30,5,FXC[f],.05,1.2,14,3,.1,true,true);};
const _fxCA=fxCardApply;fxCardApply=function(t,card,bf){_fxCA(t,card,bf);const nf=f=>t.flags.has(f)&&!bf.has(f),gx=t.gridX,gy=t.gridY;
  setTimeout(()=>{if(nf('bleed'))fxSlash(gx,gy,true);if(nf('plasma'))fxPlasma(gx,gy);if(nf('void'))fxVoid(gx,gy);if(nf('arcane'))fxArcane(gx,gy);if(nf('storm'))fxStorm(gx,gy,0);if(nf('poison'))fxToxic(gx,gy,true);if(nf('frost'))fxIce(gx,gy,8,36);
    if(nf('nuclear')){fxShock(gx,gy,'#86efac',120,8);fxBurst(gx,gy,10,30,FXC.rad,.15,4,40,3,.1,true,true);}if(nf('explosion'))fxBoom(gx,gy,1.2);if(nf('piercing'))fxPierce({tgt:{x:gx+1,y:gy+1},startX:gx-1,startY:gy-1,color:'#fff'});},450);};
// ── Rastros nas balas + auras passivas nas torres (por efeito aplicado) ──
const _fxUpd=fxUpdate;fxUpdate=function(){_fxUpd();const fc=frameCount;
  for(const p of projectiles){if(p.dead||fc%2||p.type==='lightning'||p.type==='storm'||p.type==='meteor')continue;const f=[...p.tower.flags].find(x=>FXC[x]);if(f)fxP(p.x,p.y,16,R(-.01,.01),R(-.01,.01),R(.2,1),FXC[f][fc%3],R(10,18),f==='void'||f==='plasma'?4:3,-.01,true,true);}
  for(const t of towers){if((fc+t.gridX*3+t.gridY)%7||t.dur<=0)continue;const fl2=[...t.flags].filter(x=>FXC[x]);if(!fl2.length)continue;const f=fl2[(fc/7|0)%fl2.length],c=FXC[f],a=FXA[f]||[.5,0],g=R(0,PI2);
    if(f==='void'||f==='plasma'){const d=.55;fxP(t.gridX+Math.cos(g)*d,t.gridY+Math.sin(g)*d,R(20,40),-Math.cos(g)*d/20,-Math.sin(g)*d/20,0,c[fc%3],20,3,0,true,true);}
    else fxP(t.gridX+R(-.3,.3),t.gridY+R(-.3,.3),f==='frost'||f==='bleed'?R(42,60):R(14,38),0,0,a[0]*R(.5,1.2),c[fc%3],R(20,34),3,a[1],true,true);}};
(function(){const o=fxDrawWorld;fxDrawWorld=function(){ctx.save();fxDrawZones();for(const e of enemies)if(!e.dead&&e.yOffset<=30)fxStatusTop(e);ctx.restore();o();};})();
// ── Manchas (sangue, chamuscado, crateras) somem com o tempo ──
const _fxDecal=fxDecal;fxDecal=function(gx,gy,r,col,a){_fxDecal(gx,gy,r,col,a);const d=FX.decals[FX.decals.length-1];d.life=r>40?2400:1500;if(FX.decals.length>100)FX.decals.shift();};
(function(){const u=fxUpdate;fxUpdate=function(){u();for(let i=FX.decals.length-1;i>=0;i--)if(--FX.decals[i].life<=0)FX.decals.splice(i,1);};})();

        // ── DURABILIDADE ──
        // Toda torre desgasta a CADA DISPARO (uso). Quanto mais efeitos (cartas) ela tem, mais desgasta por tiro.
        // Em 0 a torre fica QUEBRADA (não atira, perde VFX) até ser consertada (clique nela).
        const REPAIR_MAX = 3;   // máx. de consertos ("reconstruções") por torre em cada partida
        const DUR = {
            base: 100,          // durabilidade máxima base (cartas alteram via modDur)
            wear: 0.25,         // desgaste base por disparo (ÚNICO ponto de ajuste; ~400 tiros para uma torre sem efeitos)
            perEffect: 0.45,    // +45% de desgaste por efeito: 3 efeitos = 2,35x (~170 tiros)
            warnPct: 0.25,      // aviso de "durabilidade baixa" abaixo de 25%
            repairExtra: 10,    // 1º conserto = custo normal da torre + 10 de ouro
            repairStep: 10      // cada conserto já feito encarece o próximo em +10 de ouro
        };
        // ── REPETIÇÃO DE CARTA NA MESMA TORRE ──
        // Bloqueia a 2ª cópia de cartas que só adicionam flag (sem efeito novo) e de cartas épicas/lendárias.
        // Cartas de status puro (dano, alcance...) e os Monges continuam podendo empilhar.
        function cardAddsFlag(card) {
            if (card._addsFlag !== undefined) return card._addsFlag;
            let r = false;
            try {
                const flags = new Set(), o = { flags };
                const probe = new Proxy(o, { get: (t, k) => (k in t ? t[k] : 0), set: (t, k, v) => { t[k] = v; return true; } });
                if (card.apply) card.apply(probe);
                r = flags.size > 0;
            } catch (e) {}
            return card._addsFlag = r;
        }
        function cardRepeatBlocked(t, card) {
            if (!card || card.isMonk || card.isPill || card.isApple || card.isEcon || !card.apply) return false;
            if (!t.effects.some(e => e.name === card.name)) return false;
            return card.rarity === 'epic' || card.rarity === 'legendary' || cardAddsFlag(card);
        }
        class Tower {
            constructor(gx, gy, key) {
                this.gridX = gx; this.gridY = gy; this.type = key;
                const c = towerTypes[key];
                this.baseRange = c.range; this.baseRate = c.fireRate; this.baseDmg = c.damage;
                this.color = c.color; this.proj = c.proj; this.icon = c.icon;
                this.cooldown = 0; this.angle = 0; this.level = 1; this.effects = [];
                this.modDmg = 1.0; this.modRate = 1.0; this.modRange = 1.0;
                this._critChance = 0; this.critDamage = 1.5; this.splashRadius = 0; this.chainTargets = 0; 
                this.projectileSpeed = 1.0; this.goldMultiplier = 1.0; this.goldPerKill = 0; this.lifeSteal = 0;
                this.dur = DUR.base; this.modDur = 1.0; this.modDecay = 1.0; this.durRegen = 0;
                this.flags = new Set(); this.attackType = 'normal'; this.scale = 0.1; this.scaleV = 0.5; 
            }
            get cappedGoldMult() { return Math.min(3.0, this.goldMultiplier); }
            get maxDur() { return Math.max(20, Math.round(DUR.base * Math.max(0.3, this.modDur))); }
            get broken() { return this.dur <= 0; }
            get effectCount() { return this.effects.filter(c => !c.healsDur && !c.isMonk).length; }   // cartas que regeneram durabilidade e cartas de Monge não ocupam vaga
            get wearPerShot() { return DUR.wear * (1 + DUR.perEffect * this.effects.length) * Math.max(0.1, this.modDecay); }   // desgaste de cada disparo
            get damage() { let d = (this.baseDmg * this.level) * Math.max(0, this.modDmg); if (this.flags.has('arcane')) d += this.level * 5; return d; }
            get range() { return (this.baseRange + (this.level*0.2)) * this.modRange; }
            get fireRate() { return Math.max(10, Math.round((this.baseRate * this.modRate) - (this.level * 1.5))); }
            get critChance() { return Math.min(1.0, this._critChance || 0); }
            set critChance(v) { this._critChance = v; }

            levelUp(card) { 
                const _m0 = this.maxDur, _d0 = this.dur;
                if(card.apply) card.apply(this);
                { const _m1 = this.maxDur; this.dur = Math.max(0.01, Math.min(_m1, _d0 / _m0 * _m1 + (this.dur - _d0))); }  
                this.level++; this.effects.push(card);
                if(this.flags.has('lightning') && this.flags.has('storm')) this.chainTargets += 2;
                if(this.flags.has('explosion') && this.flags.has('nuclear')) this.splashRadius += 1.5;
                if(this.flags.has('fire') && this.flags.has('plasma')) this.modDmg += 0.5;

                if(this.flags.has('nuclear')) this.attackType = 'nuclear';
                else if(this.flags.has('storm')) this.attackType = 'storm';
                else if(this.flags.has('meteor')) this.attackType = 'meteor';
                else if(this.flags.has('void')) this.attackType = 'void';
                else if(this.flags.has('plasma')) this.attackType = 'plasma';
                else if(this.flags.has('arcane')) this.attackType = 'arcane';
                else if(this.flags.has('explosion')) this.attackType = 'explosion';
                else if(this.flags.has('lightning')) this.attackType = 'lightning';
                else if(this.flags.has('chain')) this.attackType = 'chain';
                else if(this.flags.has('frost')) this.attackType = 'frost';
                else if(this.flags.has('fire')) this.attackType = 'fire';
                else if(this.flags.has('piercing')) this.attackType = 'piercing';

                this.scaleV += 0.5;
                if (this.cooldown > this.fireRate) this.cooldown = this.fireRate;
            }

            updateVisuals() { this.scaleV += (1.0 - this.scale) * 0.15; this.scaleV *= 0.8; this.scale += this.scaleV; }

            updateCombat() {
                if (this.dur <= 0) return;   // quebrada
                if(this.cooldown > this.fireRate) this.cooldown = this.fireRate;
                if(this.cooldown > 0) this.cooldown--;
                let tgt = null; let minD = Infinity;
                for(let e of enemies) {
                    if(e.dead || e.yOffset > 0) continue;
                    let d = Math.hypot(e.x - this.gridX, e.y - this.gridY);
                    if(d <= this.range && d < minD) { minD = d; tgt = e; }
                }
                if(tgt) {
                    let p1 = cartToIso(this.gridX, this.gridY); let p2 = cartToIso(tgt.x, tgt.y);
                    this.angle = Math.atan2(p2.y - (p1.y - 25), p2.x - p1.x);
                    if(this.cooldown === 0) {
                        projectiles.push(new Projectile(this, tgt)); fxMuzzle(this); this.cooldown = Math.round(this.fireRate); this.scaleV -= 0.2; if (!(window.MP && window.MP.active)) { this.dur -= this.wearPerShot; if (this.dur <= 0) durBreak(this); } 
                        
                        if (this.type === 'gatling') SFX.shoot_gatling();
                        else if (this.type === 'sniper') SFX.shoot_sniper();
                        else if (this.type === 'tesla') SFX.shoot_tesla();
                        
                        if(this.attackType !== 'lightning' && this.attackType !== 'storm') createParticles(this.gridX, this.gridY, this.proj, 3);
                    }
                }
            }

            drawMonks(pos, _brk, phase) {   // phase: 'back' = anel + monges atrás da torre | 'front' = monges na frente + raios
                    if (!(this.monks > 0)) return;
                    const n = Math.min(this.monks, 5), fxk = Math.max(0, (this._monkFx || 0) / 12), hit = fxk > 0;
                    if (frameCount - (this._alertF || -99) >= 6) { this._alertF = frameCount; this._alert = enemies.some(en => !en.dead && en.atkTower === this); }
                    const alert = !!this._alert && !_brk, glow = hit ? 1 : alert ? 0.6 : 0.25, tp = hit && this._monkTgt ? cartToIso(this._monkTgt.x, this._monkTgt.y) : null;
                    ctx.save(); ctx.globalAlpha = _brk ? 0.45 : 1;
                    // círculo de oração no chão (gira e brilha mais em alerta / ataque)
                    if (phase === 'back') { ctx.save(); ctx.translate(pos.x, pos.y); ctx.scale(1, 0.5);
                    ctx.fillStyle = 'rgba(253,230,138,' + (0.04 + glow * 0.10) + ')'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'rgba(253,230,138,' + (0.20 + glow * 0.45) + ')'; ctx.lineWidth = 1.5 + glow * 1.5;
                    ctx.setLineDash([7, 5]); ctx.lineDashOffset = -frameCount * (hit || alert ? 0.9 : 0.25);
                    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
                    ctx.lineDashOffset = frameCount * (hit || alert ? 0.6 : 0.15); ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
                    ctx.restore(); }
                    const hands = [];
                    for (let i = 0; i < n; i++) {
                        const a = Math.PI / 4 + i * Math.PI * 2 / n;
                        let mx = pos.x + Math.cos(a) * 30, my = pos.y + Math.sin(a) * 15;
                        const bob = Math.sin(frameCount * (alert ? 0.1 : 0.06) + i * 2) * (alert ? 1.8 : 1.2), sway = Math.sin(frameCount * 0.04 + i * 1.7) * 0.8;
                        let dx = 0, dy = 0;
                        if (tp) { dx = tp.x - mx; dy = tp.y - my; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl; const lg = Math.sin((1 - fxk) * Math.PI) * 6; mx += dx * lg; my += dy * lg * 0.5; }
                        const cx = mx + sway, top = my - 9 + bob;
                        const hx = tp ? cx + dx * 4.5 : cx, hy = tp ? top + 3 + dy * 2.5 : top + 3.5;
                        if (phase === 'front') hands.push({ x: hx, y: hy });
                        if ((phase === 'back') !== (Math.sin(a) < 0)) continue;   // desenha só os monges deste plano (atrás/na frente da torre)
                        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(mx, my, 5.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
                        if (!_brk) {   // aura de luz do monge
                            const g = ctx.createRadialGradient(cx, top, 1, cx, top, 15), ga = 0.18 + glow * 0.32;
                            g.addColorStop(0, 'rgba(253,230,138,' + ga + ')'); g.addColorStop(1, 'rgba(253,230,138,0)');
                            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, top, 15, 0, Math.PI * 2); ctx.fill();
                        }
                        // túnica
                        ctx.fillStyle = hit ? '#d97706' : '#b45309'; ctx.beginPath(); ctx.moveTo(cx - 4.5, my); ctx.lineTo(cx + 4.5, my); ctx.lineTo(cx + 1.8, top); ctx.lineTo(cx - 1.8, top); ctx.closePath(); ctx.fill();
                        ctx.fillStyle = '#7c2d12'; ctx.fillRect(cx - 3.2, my - 4.2, 6.4, 1.4);   // faixa
                        // cabeça + capuz
                        ctx.fillStyle = '#fcd9a8'; ctx.beginPath(); ctx.arc(cx, top - 2 + (alert ? 0 : 0.8), 2.5, 0, Math.PI * 2); ctx.fill();
                        ctx.fillStyle = '#92400e'; ctx.beginPath(); ctx.arc(cx, top - 2.6 + (alert ? 0 : 0.8), 2.7, Math.PI, Math.PI * 2); ctx.fill();
                        // mãos: juntas (rezando) ou estendidas para o alvo (atacando)
                        ctx.fillStyle = '#fcd9a8'; ctx.beginPath(); ctx.arc(hx, hy, 1.5, 0, Math.PI * 2); ctx.fill();
                        if (!_brk) {
                            // auréola
                            ctx.strokeStyle = 'rgba(253,230,138,' + (0.45 + 0.35 * Math.sin(frameCount * 0.08 + i) + glow * 0.2) + ')'; ctx.lineWidth = 1;
                            ctx.beginPath(); ctx.ellipse(cx, top - 6.5 + (alert ? 0 : 0.8), 2.9, 1, 0, 0, Math.PI * 2); ctx.stroke();
                            // partículas de oração subindo
                            for (let j = 0; j < 2; j++) {
                                const ph = (frameCount * (hit || alert ? 0.03 : 0.018) + i * 0.37 + j * 0.5) % 1;
                                ctx.fillStyle = 'rgba(254,240,138,' + ((1 - ph) * (0.35 + glow * 0.5)) + ')';
                                ctx.beginPath(); ctx.arc(cx + Math.sin(ph * 6 + i + j * 3) * 5, top - 8 - ph * 22, 1.1 + (1 - ph) * 0.6, 0, Math.PI * 2); ctx.fill();
                            }
                        }
                    }
                    if (phase === 'front' && tp && !_brk) {   // raios dourados dos monges até o inimigo + impacto
                        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
                        for (const h of hands) {
                            ctx.strokeStyle = 'rgba(253,230,138,' + (fxk * 0.55) + ')'; ctx.lineWidth = 2 + 4 * fxk;
                            ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(tp.x, tp.y - 15); ctx.stroke();
                            ctx.strokeStyle = 'rgba(255,255,255,' + fxk + ')'; ctx.lineWidth = 1.4;
                            ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(tp.x, tp.y - 15); ctx.stroke();
                        }
                        const rr = 5 + (1 - fxk) * 16;
                        ctx.strokeStyle = 'rgba(253,230,138,' + fxk + ')'; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.ellipse(tp.x, tp.y - 15, rr, rr * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
                        ctx.strokeStyle = 'rgba(255,255,255,' + fxk + ')'; ctx.lineWidth = 1.5; const sp = 4 + (1 - fxk) * 9;
                        ctx.beginPath(); ctx.moveTo(tp.x - sp, tp.y - 15); ctx.lineTo(tp.x + sp, tp.y - 15); ctx.moveTo(tp.x, tp.y - 15 - sp); ctx.lineTo(tp.x, tp.y - 15 + sp); ctx.stroke();
                        ctx.restore();
                    }
                    ctx.restore();
                }

            draw() {
                const pos = cartToIso(this.gridX, this.gridY);
                const _brk = this.dur <= 0;
                if (this.flags.size > 0) { if (_brk) { ctx.save(); ctx.globalAlpha = 0.35; drawTowerVFX(pos, this, frameCount); ctx.restore(); } else drawTowerVFX(pos, this, frameCount); }   // quebrada: efeitos continuam visíveis, só esmaecidos

                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath(); ctx.ellipse(pos.x, pos.y, 22, 11, 0, 0, Math.PI*2); ctx.fill();

                this.drawMonks(pos, _brk, 'back');
                let backOrbs = []; let frontOrbs = [];
                for(let i=0; i<this.effects.length; i++) { 
                    let angle = (frameCount * 0.03) + (i * Math.PI * 2 / this.effects.length);
                    let sinA = Math.sin(angle); 
                    let ox = pos.x + Math.cos(angle) * 22; 
                    let oy = pos.y - 12 + sinA * 11; 
                    
                    let t = (sinA + 1) / 2; 
                    let alpha = (0.4 + t * 0.6) * (_brk ? 0.45 : 1);
                    let size = 3.0 + t * 2.0;

                    let orbColor = rarityColors[this.effects[i].rarity] || '#f0d000';
                    let o = {x: ox, y: oy, c: orbColor, a: alpha, s: size};
                    if(sinA < 0) backOrbs.push(o); else frontOrbs.push(o);
                }

                backOrbs.forEach(o => { ctx.fillStyle = o.c; ctx.globalAlpha = o.a; ctx.beginPath(); ctx.arc(o.x, o.y, o.s, 0, Math.PI*2); ctx.fill(); });
                ctx.globalAlpha = 1.0;

                ctx.save(); ctx.translate(pos.x, pos.y); ctx.scale(this.scale, this.scale); if (_brk) ctx.globalAlpha = 0.5;
                ctx.fillStyle = '#18181b'; ctx.beginPath(); ctx.ellipse(0, -6, 20, 10, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillRect(-20, -16, 40, 10);
                ctx.fillStyle = '#27272a'; ctx.beginPath(); ctx.ellipse(0, -16, 20, 10, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = _brk ? '#52525b' : this.color; ctx.beginPath(); ctx.ellipse(0, -16, 12, 6, 0, 0, Math.PI*2); ctx.fill();

                ctx.font = '900 26px "Font Awesome 6 Free"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = _brk ? '#71717a' : this.color;
                ctx.fillText(this.icon, 0, -38);

                if (this.level > 1 && this.flags.size > 0) {
                    const badgeMap = {
                        fire:        { icon: '\uf06d', color: '#f97316' }, frost:       { icon: '\uf2dc', color: '#93c5fd' }, lightning:   { icon: '\uf0e7', color: '#fde047' },
                        arcane:      { icon: '\uf6e8', color: '#c084fc' }, plasma:      { icon: '\uf5d2', color: '#4ade80' }, nuclear:     { icon: '\uf7b9', color: '#86efac' },
                        void:        { icon: '\uf192', color: '#818cf8' }, meteor:      { icon: '\uf753', color: '#fb923c' }, storm:       { icon: '\uf0e9', color: '#fbbf24' },
                        explosion:   { icon: '\uf1e2', color: '#ef4444' }, chain:       { icon: '\uf0c1', color: '#94a3b8' }, piercing:    { icon: '\uf0da', color: '#fbbf24' },
                        poison:      { icon: '\uf714', color: '#4ade80' }, bleed:       { icon: '\uf043', color: '#ef4444' }, corrosive:   { icon: '\uf0c3', color: '#a3e635' },
                        epidemic:    { icon: '\uf21e', color: '#86efac' }, hemorrhage:  { icon: '\uf5bb', color: '#fca5a5' }, mortalwound: { icon: '\uf54b', color: '#fda4af' },
                        bloodbath:   { icon: '\uf72b', color: '#dc2626' },
                    };
                    let activeFlags = [...this.flags].filter(f => badgeMap[f]);
                    ctx.font = '900 11px "Font Awesome 6 Free"';
                    activeFlags.forEach((flag, i) => {
                        let b = badgeMap[flag];
                        ctx.fillStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 5;
                        ctx.fillText(b.icon, 18, -58 + i * 13);
                    });
                    ctx.shadowBlur = 0;
                }
                ctx.restore();

                this.drawMonks(pos, _brk, 'front');
                frontOrbs.forEach(o => { ctx.fillStyle = o.c; ctx.globalAlpha = o.a; ctx.beginPath(); ctx.arc(o.x, o.y, o.s, 0, Math.PI*2); ctx.fill(); });
                ctx.globalAlpha = 1.0;

                if (_brk) {   // quebrada: chave inglesa + custo do conserto
                    const cost = repairCost(this), ok = gold >= cost, bob = Math.sin(frameCount * 0.08) * 2;
                    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.font = '900 18px "Font Awesome 6 Free"'; ctx.fillStyle = '#ef4444'; ctx.fillText('\uf0ad', pos.x, pos.y - 66 + bob);
                    ctx.font = 'bold 12px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = ok ? '#fde047' : '#f87171';
                    const lb = cost + 'g'; ctx.strokeText(lb, pos.x, pos.y - 48 + bob); ctx.fillText(lb, pos.x, pos.y - 48 + bob);
                    ctx.restore();
                } else if (this.dur < this.maxDur - 0.5 && !(window.MP && window.MP.active)) {   // barra de durabilidade
                    const pc = Math.max(0, this.dur / this.maxDur), bw = 34, bx = pos.x - bw / 2, by = pos.y + 14;
                    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
                    ctx.fillStyle = pc > 0.6 ? '#22c55e' : pc > 0.3 ? '#eab308' : '#ef4444';
                    if (pc <= DUR.warnPct) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(frameCount * 0.3);
                    ctx.fillRect(bx, by, bw * pc, 4); ctx.globalAlpha = 1.0;
                }
            }
        }

        const ENEMY_TYPES = {
            normal: {
                label: 'Normal',
                hpMult: 1.0, speedMult: 1.0, scaleMult: 1.0, goldMult: 1,
                color: '#ef4444', icon: '\uf54c',
                minWave: 1,
            },
            breaker: {
                label: 'Sabotador',
                hpMult: 1.4, speedMult: 0.9, scaleMult: 1.15, goldMult: 2,
                color: '#c026d3', icon: '\uf6e3',
                minWave: 3,
                seekRange: 7, towerRange: 0.9, towerHit: 0.10, towerCd: 45,   // raio de busca, distância de ataque, fração da durabilidade máx. por golpe, intervalo (frames)
            },
            demolisher: {
                label: 'Boss Demolidor',
                hpMult: 8, speedMult: 0.5, scaleMult: 2.1, goldMult: 12,
                color: '#dc2626', icon: '\uf0e3',
                minWave: 15,
                isBoss: true, leakDmg: 3,
                seekRange: 9, towerRange: 1.1, towerDmg: 33, towerCd: 110,   // sai da estrada atrás das torres; cada golpe tira 33 de durabilidade de uma vez
            },
            boss: {
                label: 'BOSS',
                hpMult: 6, speedMult: 0.55, scaleMult: 2.2, goldMult: 8,
                color: '#f97316', icon: '\uf6de',
                minWave: 5,
                isBoss: true,
            },
        };

        function rollEnemyType(w) {
            if (w >= 3 && Math.random() < Math.min(0.3, 0.08 + w * 0.012)) return 'breaker';
            return 'normal'; 
        }

        class Enemy {
            constructor(forcedType) {
                this.myPath = [...waypoints]; this.wayIdx = 0;
                this.x = this.myPath[0].x; this.y = this.myPath[0].y;

                this.enemyType = forcedType || rollEnemyType(wave);
                let cfg = ENEMY_TYPES[this.enemyType];

                let baseHp    = Math.floor((enemyHpConfig.base + (wave * enemyHpConfig.linear) + Math.floor(Math.pow(wave, enemyHpConfig.expPow) * enemyHpConfig.expMult)) * adaptiveMult * ENEMY_HP_MULT);
                let baseSpeed = (0.02 + (wave * 0.0028)) * Math.pow(adaptiveMult, 0.4);

                this.hp       = Math.max(1, Math.floor(baseHp    * cfg.hpMult));
                this.maxHp    = this.hp;
                this.baseSpeed = baseSpeed * cfg.speedMult;
                this.speed     = this.baseSpeed;
                this.targetScale = cfg.scaleMult;
                this.scale       = 0.01;
                this.spawnProgress = 0;   
                let baseGold = 4;
                this.goldReward = Math.max(1, Math.round(baseGold * cfg.goldMult));

                waveTotalEnemyHp += this.maxHp;
                this.dead = false; this.wobble = Math.random() * 5;
                this.yOffset = 0; this.hitTimer = 0; this.statusEffects = [];
                this.squash = 1.0; this.squashV = 0;

                if(cfg.isBoss) {
                    let mid = canvas.width / 2;
                    floatingTexts.push(new FloatingText(mid, canvas.height * 0.35, this.enemyType === 'demolisher' ? '⚠ BOSS DEMOLIDOR ⚠' : '⚠ BOSS ⚠', cfg.color, true));
                    applyShake(12);
                }
            }

            update() {
                if (this.spawnProgress < 1) {
                    this.spawnProgress = Math.min(1, this.spawnProgress + 0.05);
                    let t = this.spawnProgress;
                    this.scale = this.targetScale * (1 - Math.pow(1 - t, 4)); 
                }

                if(this.hitTimer > 0) this.hitTimer--;
                let currentSpeedMod = 1.0;
                for(let i = this.statusEffects.length - 1; i >= 0; i--) {
                    let ef = this.statusEffects[i]; ef.duration--;

                    if(ef.type === 'fire') {
                        this.hp -= ef.dmg;
                        fxFireTick(this, ef);
                    }
                    if(ef.type === 'frost') currentSpeedMod *= ef.slow;
                    if(ef.type === 'shock') currentSpeedMod *= 0.25;

                    if(ef.type === 'poison') {
                        if(frameCount % 15 === 0) {
                            let stacks = ef.stacks || 1;
                            let pdmg = ef.dmg * stacks * (ef.amplify ? 1.35 : 1);
                            this.hp -= pdmg;
                            if(frameCount % 30 === 0) createParticles(this.x, this.y, '#4ade80', 1);
                        }
                    }

                    if(ef.type === 'bleed') {
                        if(frameCount % 12 === 0) {
                            let bdmg = ef.dmg + (ef.scalesWithMaxHp ? this.maxHp * 0.004 : 0);
                            this.hp -= bdmg;
                            createParticles(this.x, this.y, '#991b1b', 1);
                        }
                        if(ef.mortalWound) this.hp -= ef.dmg * currentSpeedMod * 0.3;
                    }

                    if(ef.duration <= 0) {
                        if(ef.type === 'poison' && ef.spreads && this.dead) {
                            enemies.forEach(ne => {
                                if(!ne.dead && ne !== this && Math.hypot(ne.x-this.x, ne.y-this.y) < 2.5)
                                    ne.statusEffects.push({type:'poison', dmg:ef.dmg, duration:120, stacks:1, amplify:false, spreads:false});
                            });
                        }
                        if(ef.type === 'bleed' && ef.deathExplosion && this.dead) {
                            enemies.forEach(ne => {
                                if(!ne.dead && ne !== this && Math.hypot(ne.x-this.x, ne.y-this.y) < 2)
                                    ne.statusEffects.push({type:'bleed', dmg:ef.dmg*0.5, duration:90, scalesWithMaxHp:false, mortalWound:false, deathExplosion:false});
                            });
                            createParticles(this.x, this.y, '#991b1b', 20);
                        }
                        this.statusEffects.splice(i, 1);
                    }
                }
                this.speed = this.baseSpeed * currentSpeedMod;
                if(this.hp <= 0 && !this.dead) {
                    SFX.kill_enemy();
                    this.dead = true; fxDeath(this);
                    let goldDrop = this.goldReward;
                    
                    statGoldEarned += goldDrop;
                    
                    let pos2 = cartToIso(this.x, this.y);
                    let cx2 = canvas.width/2; let cy2 = canvas.height/2;
                    let sx2 = (pos2.x - cx2) * zoom + cx2; let sy2 = (pos2.y - cy2) * zoom + cy2;
                    floatingTexts.push(new FloatingText(sx2, sy2, `+${goldDrop}g`, '#fde047'));
                    
                    let numOrbs = Math.min(8, goldDrop);
                    let valPerOrb = Math.floor(goldDrop / numOrbs);
                    let remainder = goldDrop % numOrbs;
                    for(let i=0; i<numOrbs; i++) {
                        let orbVal = valPerOrb + (i === 0 ? remainder : 0);
                        uiParticles.push(new UIParticle(sx2, sy2+20, orbVal));
                    }
                    
                    createParticles(this.x, this.y, '#b91c1c', this.enemyType === 'boss' ? 30 : 5);
                    updateUI();

                    if(this.enemyType === 'splitter') {
                        let cfg = ENEMY_TYPES['splitter'];
                        for(let s = 0; s < (cfg.splitsInto || 2); s++) {
                            let mini = new Enemy('fast');
                            mini.myPath = [...this.myPath];
                            mini.wayIdx = Math.max(0, this.wayIdx - 1);
                            mini.x = this.x + (Math.random() - 0.5) * 0.5;
                            mini.y = this.y + (Math.random() - 0.5) * 0.5;
                            mini.hp = Math.max(1, Math.floor(mini.hp * 0.55));
                            mini.maxHp = mini.hp;
                            mini.scale = 0.55;
                            mini.goldReward = 1;
                            waveTotalEnemyHp += mini.hp;
                            enemies.push(mini);
                        }
                        createParticles(this.x, this.y, '#a855f7', 20);
                        let pos3 = cartToIso(this.x, this.y);
                        let cx3 = canvas.width/2; let cy3 = canvas.height/2;
                        let sx3 = (pos3.x - cx3) * zoom + cx3; let sy3 = (pos3.y - cy3) * zoom + cy3;
                        floatingTexts.push(new FloatingText(sx3, sy3 - 30, 'DIVIDE!', '#a855f7'));
                    }

                    if(ENEMY_TYPES[this.enemyType].isBoss) {
                        applyShake(20);
                        let pos3 = cartToIso(this.x, this.y);
                        let cx3 = canvas.width/2; let cy3 = canvas.height/2;
                        let sx3 = (pos3.x - cx3) * zoom + cx3; let sy3 = (pos3.y - cy3) * zoom + cy3;
                        floatingTexts.push(new FloatingText(sx3, sy3 - 30, 'BOSS MORTO!', '#f97316', true));
                        createParticles(this.x, this.y, '#f97316', 40, 0.3, 6);
                        createParticles(this.x, this.y, '#fde047', 20, 0.4, 4);
                    }
                }
                this.squashV += (1.0 - this.squash) * 0.2; this.squashV *= 0.8; this.squash += this.squashV;
                if(this.dead) { this.yOffset += 1.5; return; }
                if((this.enemyType === 'breaker' || this.enemyType === 'demolisher') && this.spawnProgress >= 1 && !(window.MP && window.MP.active)) {
                    const bc = ENEMY_TYPES[this.enemyType]; let bt = null, bd = bc.seekRange;
                    for(const t of towers) { if(t.dur <= 0) continue; const d = Math.hypot(t.gridX - this.x, t.gridY - this.y); if(d < bd) { bd = d; bt = t; } }
                    this.atkTower = null;
                    if(bt) {
                        if(bd > bc.towerRange) {   // sai da estrada e chega o mais perto possível da torre
                            const k = Math.min(this.speed, bd - bc.towerRange * 0.7) / bd;
                            this.x += (bt.gridX - this.x) * k; this.y += (bt.gridY - this.y) * k; this.wobble += 0.4 * currentSpeedMod; return;
                        }
                        this.atkTower = bt;
                        if((this.atkCd = (this.atkCd || 0) - 1) <= 0) {
                            this.atkCd = bc.towerCd; this.squashV -= 0.25;
                            const dmg = bc.towerDmg ? bc.towerDmg : Math.max(2, bt.maxDur * bc.towerHit); bt.dur -= dmg; bt.scaleV -= (bc.towerDmg ? 0.9 : 0.3);
                            const sp = scr(bt.gridX, bt.gridY, -50);
                            floatingTexts.push(new FloatingText(sp.x, sp.y, '-' + Math.round(dmg), bc.towerDmg ? '#ef4444' : '#c026d3', !!bc.towerDmg));
                            if(bc.towerDmg) { createParticles(bt.gridX, bt.gridY, '#dc2626', 18, 0.35, 5); fxShock(bt.gridX, bt.gridY, '#dc2626', 90, 6); applyShake(9); } else { createParticles(bt.gridX, bt.gridY, '#c026d3', 4); applyShake(2); }
                            if(bt.dur <= 0) durBreak(bt);
                        }
                        this.wobble += 0.4 * currentSpeedMod; return;
                    }
                }
                let remaining = this.speed;
                while(remaining > 0) {
                    let tgt = this.myPath[this.wayIdx + 1];
                    if(!tgt) {
                        SFX.base_dmg();
                        let dmg = (ENEMY_TYPES[this.enemyType] && ENEMY_TYPES[this.enemyType].leakDmg) || (this.enemyType === 'boss' ? 3 : 1);
                        hp -= dmg; waveEnemyDmgDealt += dmg; statTotalDmgTaken += dmg;
                        applyShake(this.enemyType === 'boss' ? 20 : 8);

                        if (autoWave && skipShop) {
                            autoWave = false;
                            skipShop = false;
                            
                            let btnAuto = document.getElementById('btn-auto-wave');
                            if (btnAuto) { btnAuto.innerText = 'AUTO-WAVE: OFF'; btnAuto.classList.remove('on'); }
                            
                            let btnSkip = document.getElementById('btn-skip-shop');
                            if (btnSkip) { btnSkip.innerText = 'PULAR LOJA: OFF'; btnSkip.classList.remove('on'); btnSkip.classList.remove('visible'); }
                            syncSpeedBtn();
                            
                            floatingTexts.push(new FloatingText(canvas.width/2, canvas.height * 0.35, "AUTO-WAVE CANCELADO!", '#ef4444', true));
                        }

                        this.dead = true; updateUI(); if(hp <= 0) gameOver = true; break;
                    }
                    let dx = tgt.x - this.x; let dy = tgt.y - this.y; let dist = Math.hypot(dx, dy);
                    if(dist <= 0) { this.x = tgt.x; this.y = tgt.y; this.wayIdx++; remaining = 0; break; }
                    if(dist <= remaining) { remaining -= dist; this.x = tgt.x; this.y = tgt.y; this.wayIdx++; }
                    else { this.x += (dx / dist) * remaining; this.y += (dy / dist) * remaining; remaining = 0; }
                }
                this.wobble += 0.4 * currentSpeedMod;
            }

            draw() {
                if(this.yOffset > 30) return;
                let cfg    = ENEMY_TYPES[this.enemyType];
                let sc     = this.scale;
                let pos    = cartToIso(this.x, this.y);
                let bob    = this.dead ? this.yOffset : Math.abs(Math.sin(this.wobble)) * -12;

                if(!this.dead) {
                    ctx.fillStyle = 'rgba(0,0,0,0.4)';
                    let shadowSize = (14 + bob * 0.5) * sc;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y, Math.max(5, shadowSize), Math.max(2, shadowSize / 2), 0, 0, Math.PI * 2); ctx.fill();
                }
                ctx.save(); ctx.translate(pos.x, pos.y + bob);
                ctx.scale(sc * (1 / this.squash), sc * this.squash);
                ctx.globalAlpha = this.dead ? Math.max(0, 1 - (this.yOffset / 30)) : 1.0;

                let isPoisoned = this.statusEffects.some(e => e.type === 'poison');
                let isBleeding = this.statusEffects.some(e => e.type === 'bleed');
                let isFrozen   = this.statusEffects.some(e => e.type === 'frost');
                let isOnFire   = this.statusEffects.some(e => e.type === 'fire');

                if(isPoisoned) {
                    let pulseA = 0.15 + Math.sin(frameCount * 0.15) * 0.1;
                    ctx.save(); ctx.globalAlpha *= pulseA;
                    ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(0, -15, 22, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                }
                if(isBleeding) {
                    let pulseA = 0.18 + Math.sin(frameCount * 0.2 + 1) * 0.08;
                    ctx.save(); ctx.globalAlpha *= pulseA;
                    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, -15, 20, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                }

                if(this.enemyType === 'fast' && !this.dead) {
                    let ta = 0.12 + Math.sin(frameCount * 0.3) * 0.08;
                    ctx.save(); ctx.globalAlpha *= ta;
                    ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, -15, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
                    for(let i = 1; i <= 3; i++) {
                        ctx.save();
                        ctx.globalAlpha *= (0.12 - i * 0.03);
                        ctx.fillStyle = cfg.color;
                        ctx.font = `900 ${18 - i * 2}px "Font Awesome 6 Free"`;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText(cfg.icon, -i * 4, -15);
                        ctx.restore();
                    }
                }
                if(this.enemyType === 'splitter' && !this.dead) {
                    let ta = 0.15 + Math.abs(Math.sin(frameCount * 0.08)) * 0.12;
                    ctx.save(); ctx.globalAlpha *= ta;
                    ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(0, -15, 24 + Math.sin(frameCount * 0.1) * 3, 0, Math.PI * 2); ctx.stroke();
                    ctx.restore();
                }
                if(cfg.isBoss && !this.dead) {
                    for(let i = 0; i < 6; i++) {
                        let a = (frameCount * 0.04) + i * Math.PI * 2 / 6;
                        let r = 28 + Math.sin(frameCount * 0.08 + i) * 5;
                        ctx.save();
                        ctx.globalAlpha = 0.45 + Math.sin(frameCount * 0.12 + i) * 0.2;
                        ctx.fillStyle = i % 2 === 0 ? cfg.color : '#ef4444';
                        ctx.beginPath(); ctx.arc(Math.cos(a) * r, -15 + Math.sin(a) * (r / 2), 3.5, 0, Math.PI * 2); ctx.fill();
                        ctx.restore();
                    }
                    ctx.save();
                    ctx.font = 'bold 9px "Segoe UI", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = cfg.color; ctx.shadowColor = cfg.color; ctx.shadowBlur = 8;
                    ctx.fillText(this.enemyType === 'demolisher' ? 'DEMOLIDOR' : 'BOSS', 0, -46);
                    ctx.restore();
                }

                let enemyColor = this.hitTimer > 0 ? '#ffffff'
                    : this.dead     ? '#7f1d1d'
                    : isPoisoned    ? '#86efac'
                    : isBleeding    ? '#fca5a5'
                    : isFrozen      ? '#93c5fd'
                    : isOnFire      ? '#fb923c'
                    : cfg.color;

                let iconSize = cfg.isBoss ? 36 : this.enemyType === 'splitter' ? 28 : 24;
                ctx.fillStyle = enemyColor;
                ctx.font = `900 ${iconSize}px "Font Awesome 6 Free"`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.shadowColor = enemyColor; ctx.shadowBlur = cfg.isBoss ? 15 : 0;
                ctx.fillText(cfg.icon, 0, -15);
                ctx.shadowBlur = 0;

                                if(!this.dead) {
                    let icons = [];
                    if(isPoisoned) icons.push({icon: '\uf7dd', color: '#4ade80'});
                    if(isBleeding) icons.push({icon: '\uf043', color: '#ef4444'});
                    if(isFrozen)   icons.push({icon: '\uf2dc', color: '#93c5fd'});
                    if(isOnFire)   icons.push({icon: '\uf6d9', color: '#fb923c'});
                    ctx.font = '900 10px "Font Awesome 6 Free"';
                    icons.forEach((ic, i) => { ctx.fillStyle = ic.color; ctx.fillText(ic.icon, -8 + (i * 10), -42); });

                    let barW = cfg.isBoss ? 40 : 24;
                    let pct = this.hp / this.maxHp;
                    ctx.fillStyle = '#000'; ctx.fillRect(-barW / 2, -34, barW, 5);
                    ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444';
                    ctx.fillRect(-barW / 2, -34, barW * pct, 5);
                }
                ctx.restore();
            }
        }

        class Projectile {
            constructor(tower, tgt, startX = null, startY = null, chainHits = 0) {
                this.tower = tower; this.startX = startX !== null ? startX : tower.gridX; this.startY = startY !== null ? startY : tower.gridY;
                this.x = this.startX; this.y = this.startY; this.tgt = tgt;
                
                this.dmg = tower.damage; this.color = tower.proj; this.type = tower.attackType; if(tower.flags.has('storm') && tower.flags.has('meteor') && Math.random()<0.5) this.type = 'meteor';
                this.critChance = tower.critChance; this.critDamage = tower.critDamage;
                this.splashRadius = tower.splashRadius; this.chainTargets = tower.chainTargets - chainHits;
                this.goldMultiplier = tower.cappedGoldMult; this.goldPerKill = tower.goldPerKill; this.lifeSteal = tower.lifeSteal;
                
                this.speed = (this.type === 'lightning' || this.type === 'storm') ? 2.0 : (0.45 * tower.projectileSpeed); 
                if(this.type === 'meteor') this.speed *= 0.5;
                this.dead = false; this.history = []; this.hitEnemies = new Set();
                this.pierces = tower.flags.has('piercing') ? (tower.flags.has('void') ? 10 : 3) : 0;
            }
            update() {
                if(this.dead) return;
                this.history.push({x: this.x, y: this.y}); if(this.history.length > 6) this.history.shift();

                if(this.type === 'meteor') {
                    if(!this.sky) { this.sky = 1; this.fall = 0; const me = this; fxMeteor(() => ({x: me.tgt.x, y: me.tgt.y}), null, 32); }
                    if(++this.fall < 32) return;
                    if(this.tgt.dead) { const rr = this.splashRadius > 0 ? this.splashRadius : 1.5; enemies.forEach(e => { if(!e.dead && Math.hypot(e.x-this.tgt.x, e.y-this.tgt.y) < rr) e.hp -= this.dmg*0.5; }); fxMeteorImpact(this.tgt.x, this.tgt.y, rr, this.dmg); this.dead = true; return; }
                    this.x = this.tgt.x - 0.001; this.y = this.tgt.y;
                }
                if(this.tgt.dead) { this.dead = true; return; }
                let dx = this.tgt.x - this.x; let dy = this.tgt.y - this.y; let dist = Math.hypot(dx, dy);
                
                if(dist < this.speed) {
                    if(dist <= 0 || this.hitEnemies.has(this.tgt)) { this.dead = true; return; }
                    
                    SFX.hit_normal();

                    let isCrit = Math.random() < this.critChance;
                    let finalDmg = isCrit ? this.dmg * this.critDamage : this.dmg;

                    if(this.tower.bossKiller && ENEMY_TYPES[this.tgt.enemyType].isBoss) finalDmg *= 4;
                    if (this.tower.flags.has('void')) { let voidDmg = this.tgt.hp * 0.10; if(ENEMY_TYPES[this.tgt.enemyType].isBoss) voidDmg = Math.min(voidDmg, 500); finalDmg += voidDmg; }
                    if (this.tower.flags.has('plasma')) this.tower.modDmg = Math.min(5.0, this.tower.modDmg + 0.01);

                    this.tgt.hp -= finalDmg; this.tgt.hitTimer = 4; this.tgt.squash = 0.6; this.hitEnemies.add(this.tgt);
                    statTotalDmgDealt += finalDmg; fxHit(this, isCrit, finalDmg);
                    if(isCrit) statCrits++;

                    if(this.lifeSteal > 0) hp = Math.min(20, Math.floor(hp + this.lifeSteal));
                    updateUI(); 

                    if (this.tower.flags.has('fire')) this.tgt.statusEffects.push({type: 'fire', dmg: this.dmg * 0.1, duration: 90});
                    if (this.tower.flags.has('frost')) this.tgt.statusEffects.push({type: 'frost', slow: 0.6, duration: 60});
                    if (this.tower.flags.has('poison')) {
                        let existing = this.tgt.statusEffects.find(e=>e.type==='poison');
                        if(existing) { existing.stacks = Math.min(existing.stacks+1, 5); existing.duration = Math.max(existing.duration, 120); }
                        else this.tgt.statusEffects.push({type:'poison', dmg: this.dmg*0.08, duration:180, stacks:1, amplify:this.tower.flags.has('corrosive'), spreads:this.tower.flags.has('epidemic')});
                    }
                    if (this.tower.flags.has('bleed')) {
                        let existing = this.tgt.statusEffects.find(e=>e.type==='bleed');
                        if(!existing) this.tgt.statusEffects.push({type:'bleed', dmg:this.dmg*0.06, duration:150, scalesWithMaxHp:this.tower.flags.has('hemorrhage'), mortalWound:this.tower.flags.has('mortalwound'), deathExplosion:this.tower.flags.has('bloodbath')});
                    }

                    let textPos = cartToIso(this.tgt.x, this.tgt.y);
                    let pivX = canvas.width/2; let pivY = canvas.height/2;
                    let screenX = (textPos.x - pivX) * zoom + pivX;
                    let screenY = (textPos.y - 20 - pivY) * zoom + pivY;
                    floatingTexts.push(new FloatingText(screenX, screenY, (isCrit ? '⚡ ' : '') + Math.floor(finalDmg).toString(), isCrit ? '#fde047' : '#fca5a5', isCrit));
                    if(isCrit) {
                        createParticles(this.tgt.x, this.tgt.y, '#fde047', 8);
                        createParticles(this.tgt.x, this.tgt.y, '#ffffff', 5);
                        applyShake(3);
                    }
                    
                    if(this.type === 'explosion' || this.type === 'nuclear' || this.type === 'meteor') {
                        applyShake(this.type === 'meteor' ? 10 : 6);
                        if(this.type === 'meteor') fxMeteorImpact(this.tgt.x, this.tgt.y, this.splashRadius > 0 ? this.splashRadius : 1.5, this.dmg); else fxBoom(this.tgt.x, this.tgt.y, this.type === 'nuclear' ? 2.5 : (this.splashRadius || 1.2), this.type === 'nuclear' ? '#86efac' : '#f97316');
                        triggerImpactVFX(this, this.tgt.x, this.tgt.y);
                    } else if(this.type === 'lightning' || this.type === 'storm') {
                        triggerImpactVFX(this, this.tgt.x, this.tgt.y); fxBolt(this.tgt.x, this.tgt.y, this.type === 'storm'); this.tgt.statusEffects.push({type:'shock', duration: 22});
                    } else if (this.tower.flags.size > 0) {
                        triggerImpactVFX(this, this.tgt.x, this.tgt.y);
                    } else {
                        createParticles(this.tgt.x, this.tgt.y, this.color, 5);
                    }

                    if (this.splashRadius > 0 || this.type === 'nuclear' || this.type === 'meteor') {
                        let radius = this.splashRadius > 0 ? this.splashRadius : (this.type === 'meteor' ? 1.5 : 2.5);
                        enemies.forEach(e => {
                            if (e !== this.tgt && !e.dead && Math.hypot(e.x - this.tgt.x, e.y - this.tgt.y) < radius) {
                                e.hp -= finalDmg * 0.5; e.hitTimer = 4;
                                floatingTexts.push(new FloatingText(screenX + (Math.random()*20-10), screenY, Math.floor(finalDmg*0.5).toString(), '#fca5a5', false));
                                if (e.hp <= 0) this.handleKill(e, screenX, screenY);
                            }
                        });
                    }

                    if(this.tgt.hp <= 0 && !this.tgt.dead) this.handleKill(this.tgt, screenX, screenY);

                    if (this.chainTargets > 0) {
                        let nextTgt = enemies.find(e => !e.dead && e !== this.tgt && !this.hitEnemies.has(e) && Math.hypot(e.x - this.tgt.x, e.y - this.tgt.y) < 3);
                        if (nextTgt) {
                            fxChain(this, nextTgt);
                            let newProj = new Projectile(this.tower, nextTgt, this.tgt.x, this.tgt.y, this.tower.chainTargets - this.chainTargets + 1);
                            newProj.hitEnemies = new Set(this.hitEnemies); projectiles.push(newProj);
                        }
                    }
                    if (this.pierces > 0) { this.pierces--; } else { this.dead = true; }
                } else { this.x += (dx/dist)*this.speed; this.y += (dy/dist)*this.speed; }
            }

            handleKill(enemy, sX, sY) {
                SFX.kill_enemy();
                enemy.dead = true; fxDeath(enemy);
                statEnemiesKilled++;
                waveEnemyHpKilled += enemy.maxHp;
                waveEnemyHpKilled += enemy.maxHp;  
                let goldDrop = enemy.goldReward ? Math.floor(enemy.goldReward * this.goldMultiplier) + this.goldPerKill : Math.floor(5 * this.goldMultiplier) + this.goldPerKill;
                
                statGoldEarned += goldDrop; 
                floatingTexts.push(new FloatingText(sX, sY - 20, `+${goldDrop}g`, '#fde047'));
                let p = cartToIso(enemy.x, enemy.y);
                let pivX = canvas.width/2; let pivY = canvas.height/2;
                let mapX = (p.x - pivX) * zoom + pivX; let mapY = (p.y - pivY) * zoom + pivY;
                
                let numOrbs = Math.min(10, goldDrop);
                let valPerOrb = Math.floor(goldDrop / numOrbs);
                let remainder = goldDrop % numOrbs;
                
                for(let i=0; i<numOrbs; i++) {
                    let orbVal = valPerOrb + (i === 0 ? remainder : 0);
                    uiParticles.push(new UIParticle(mapX, mapY + 20, orbVal));
                }
                
                createParticles(enemy.x, enemy.y, '#b91c1c', 5); 
            }

            draw() {
                let pos = cartToIso(this.x, this.y); let tgtPos = cartToIso(this.tgt.x, this.tgt.y);

                if(this.type === 'lightning' || this.type === 'storm') { return;
                    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4;
                    ctx.shadowColor = '#fde047'; ctx.shadowBlur = 10;
                    ctx.beginPath(); ctx.moveTo(tgtPos.x, tgtPos.y - 400); 
                    let midX = tgtPos.x + (Math.random() * 20 - 10); let midY = tgtPos.y - 200 + (Math.random() * 20 - 10);
                    ctx.lineTo(midX, midY); ctx.lineTo(tgtPos.x, tgtPos.y - 15); ctx.stroke();
                    ctx.shadowBlur = 0;
                    return;
                }

                if(this.type === 'meteor') { return;
                    let distTotal = Math.hypot(this.tgt.x - this.startX, this.tgt.y - this.startY);
                    let distAtual = Math.hypot(this.tgt.x - this.x, this.tgt.y - this.y);
                    let progress = 1 - (distAtual / distTotal);
                    let meteorHeight = 300 * (1 - progress); let r = 12;
                    if (this.history.length > 1) {
                        ctx.globalAlpha = 0.4; ctx.strokeStyle = '#f97316'; ctx.lineWidth = 4;
                        ctx.shadowColor = '#fde047'; ctx.shadowBlur = 10; ctx.lineCap = 'round';
                        ctx.beginPath();
                        this.history.forEach((h, i) => {
                            let mh = 300 * (1 - Math.min(1, (this.history.length - i) / Math.max(this.history.length, 1)));
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - mh) : ctx.lineTo(hp2.x, hp2.y - mh);
                        });
                        ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                    }
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)'; ctx.beginPath(); ctx.arc(pos.x - 10, pos.y - meteorHeight - 15, r, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#f97316'; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 12;
                    ctx.beginPath(); ctx.arc(pos.x, pos.y - meteorHeight, r, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(pos.x, pos.y - meteorHeight, r/2, 0, Math.PI*2); ctx.fill();
                    ctx.shadowBlur = 0;
                    return;
                }

                if (this.tower.flags.size > 0) {
                    drawProjVFX(pos, this);
                } else if (this.history.length > 1) {
                    ctx.beginPath();
                    for(let i=0; i<this.history.length; i++) {
                        let hp2 = cartToIso(this.history[i].x, this.history[i].y);
                        if(i===0) ctx.moveTo(hp2.x, hp2.y - 15); else ctx.lineTo(hp2.x, hp2.y - 15);
                    }
                    ctx.lineTo(pos.x, pos.y - 15);
                    ctx.strokeStyle = this.color; ctx.lineWidth = this.type === 'explosion' ? 6 : 3;
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
                }
            }
        }

        class Particle {
            constructor(gx, gy, color, decayScale=1, sizeScale=2) {
                this.gx = gx; this.gy = gy;
                this.vx = (Math.random() - 0.5) * 0.2; this.vy = (Math.random() - 0.5) * 0.2;
                this.z = 15; this.vz = Math.random() * 3 + 1; 
                this.life = 1.0; this.decay = (Math.random() * 0.04 + 0.02) * decayScale;
                this.color = color; this.size = ((Math.random() * 3) + sizeScale) * 0.5;
            }
            update() { this.gx += this.vx; this.gy += this.vy; this.z += this.vz; this.vz -= 0.2; this.life -= this.decay; }
            draw() {
                let pos = cartToIso(this.gx, this.gy), py = pos.y - this.z;
                if (pos.x < VP.x0 || pos.x > VP.x1 || py < VP.y0 || py > VP.y1) return;   // fora da tela: não desenha
                ctx.globalAlpha = Math.max(0, this.life); ctx.fillStyle = this.color;
                ctx.beginPath(); ctx.arc(pos.x, pos.y - this.z, this.size, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1.0;
            }
        }
        function createParticles(gx, gy, color, amt, decay, size) {
            if (PART.keep === 0 || !onScreen(gx, gy)) return;
            if (PART.keep < 1) amt = Math.floor(amt * PART.keep + Math.random());   // arredondamento probabilístico: 1 partícula ainda aparece de vez em quando
            const room = PERF.maxParticles - particles.length; if (room <= 0 || amt <= 0) return; if (amt > room) amt = room;
            const d = decay == null ? 0.5 : decay, sz = size == null ? 4 : size;
            for(let i=0; i<amt; i++) particles.push(new Particle(gx, gy, color, d, sz));
        }

        const VFX_LAYERS = [
            {
                id: 'fire',
                match: t => t.flags.has('fire'),
                priority: 1,
                towerAura(pos, tower, fc) {
                    let count = Math.min(tower.level + 1, 5);
                    for (let i = 0; i < count; i++) {
                        let a = (fc * 0.04 + i * Math.PI * 2 / count);
                        let rx = 18 + Math.sin(fc * 0.07 + i) * 4;
                        let ry = 9  + Math.cos(fc * 0.07 + i) * 2;
                        let bx = pos.x + Math.cos(a) * rx;
                        let by = pos.y + Math.sin(a) * ry - 14;
                        let alpha = 0.55 + Math.sin(fc * 0.13 + i * 1.3) * 0.25;
                        ctx.globalAlpha = alpha;
                        ctx.fillStyle = (i % 2 === 0) ? '#f97316' : '#ef4444';
                        ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, Math.PI * 2); ctx.fill();
                    }
                    let pulse = 0.15 + Math.sin(fc * 0.10) * 0.07;
                    ctx.globalAlpha = pulse;
                    let rg = ctx.createRadialGradient(pos.x, pos.y - 8, 2, pos.x, pos.y - 8, 26);
                    rg.addColorStop(0, '#fde047'); rg.addColorStop(1, 'transparent');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 8, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.7;
                    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 5; ctx.lineCap = 'round';
                    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#f97316', 8);
                    createParticles(gx, gy, '#fde047', 5);
                }
            },
            {
                id: 'frost',
                match: t => t.flags.has('frost'),
                priority: 2,
                towerAura(pos, tower, fc) {
                    let count = Math.min(tower.level + 2, 6);
                    for (let i = 0; i < count; i++) {
                        let a = (fc * -0.025 + i * Math.PI * 2 / count);
                        let rx = 22 + Math.sin(fc * 0.05 + i) * 3;
                        let bx = pos.x + Math.cos(a) * rx;
                        let by = pos.y + Math.sin(a) * (rx / 2.4) - 14;
                        ctx.globalAlpha = 0.5 + Math.sin(fc * 0.08 + i) * 0.2;
                        ctx.fillStyle = i % 3 === 0 ? '#e0f2fe' : '#93c5fd';
                        ctx.save(); ctx.translate(bx, by); ctx.rotate(a * 3);
                        ctx.fillRect(-1.5, -4, 3, 8); ctx.fillRect(-4, -1.5, 8, 3);
                        ctx.restore();
                    }
                    let pa = 0.08 + Math.sin(fc * 0.06) * 0.04;
                    ctx.globalAlpha = pa;
                    let rg = ctx.createRadialGradient(pos.x, pos.y - 8, 0, pos.x, pos.y - 8, 28);
                    rg.addColorStop(0, '#bae6fd'); rg.addColorStop(1, 'transparent');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 8, 28, 14, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.6;
                    ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.shadowColor = '#bae6fd'; ctx.shadowBlur = 6;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#93c5fd', 8);
                    createParticles(gx, gy, '#e0f2fe', 4);
                }
            },
            {
                id: 'lightning',
                match: t => t.flags.has('lightning') || t.attackType === 'lightning',
                priority: 3,
                towerAura(pos, tower, fc) {
                    if (fc % 8 < 3) {
                        let count = Math.min(tower.level, 3);
                        for (let i = 0; i < count; i++) {
                            let a = Math.random() * Math.PI * 2;
                            let len = 12 + Math.random() * 10;
                            ctx.globalAlpha = 0.7;
                            ctx.strokeStyle = '#fde047'; ctx.lineWidth = 1.5;
                            ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 6;
                            ctx.beginPath();
                            ctx.moveTo(pos.x, pos.y - 20);
                            ctx.lineTo(pos.x + Math.cos(a) * len, pos.y - 20 + Math.sin(a) * len);
                            ctx.stroke();
                            ctx.shadowBlur = 0;
                        }
                    }
                    let pa = 0.12 + Math.abs(Math.sin(fc * 0.18)) * 0.12;
                    ctx.globalAlpha = pa;
                    let rg = ctx.createRadialGradient(pos.x, pos.y - 14, 0, pos.x, pos.y - 14, 22);
                    rg.addColorStop(0, '#fde047'); rg.addColorStop(1, 'transparent');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 14, 22, 11, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.shadowColor = '#fde047'; ctx.shadowBlur = 12;
                    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 5; ctx.globalAlpha = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y - 15);
                    ctx.lineTo(pos.x + (Math.random()-0.5)*6, pos.y - 10);
                    ctx.stroke();
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#fde047', 10);
                    createParticles(gx, gy, '#ffffff', 4);
                }
            },
            {
                id: 'arcane',
                match: t => t.flags.has('arcane'),
                priority: 4,
                towerAura(pos, tower, fc) {
                    ctx.save();
                    ctx.translate(pos.x, pos.y - 16);
                    ctx.rotate(fc * 0.015);
                    let hexR = 18;
                    ctx.globalAlpha = 0.25 + Math.sin(fc * 0.07) * 0.1;
                    ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        let ax = Math.cos(i * Math.PI / 3) * hexR;
                        let ay = Math.sin(i * Math.PI / 3) * (hexR / 2);
                        i === 0 ? ctx.moveTo(ax, ay) : ctx.lineTo(ax, ay);
                    }
                    ctx.closePath(); ctx.stroke();
                    ctx.restore();
                    for (let i = 0; i < 4; i++) {
                        let a = (fc * 0.03 + i * Math.PI / 2);
                        let r = 16 + Math.sin(fc * 0.06 + i) * 4;
                        ctx.globalAlpha = 0.6;
                        ctx.fillStyle = i % 2 === 0 ? '#a855f7' : '#c084fc';
                        ctx.beginPath();
                        ctx.arc(pos.x + Math.cos(a)*r, pos.y - 14 + Math.sin(a)*(r/2), 2, 0, Math.PI*2);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.65;
                    ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 10;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#a855f7', 8);
                    createParticles(gx, gy, '#c084fc', 5);
                }
            },
            {
                id: 'plasma',
                match: t => t.flags.has('plasma'),
                priority: 5,
                towerAura(pos, tower, fc) {
                    let pa = 0.18 + Math.sin(fc * 0.12) * 0.1;
                    ctx.globalAlpha = pa;
                    let rg = ctx.createRadialGradient(pos.x, pos.y - 12, 0, pos.x, pos.y - 12, 30);
                    rg.addColorStop(0, '#4ade80'); rg.addColorStop(0.5, '#22d3ee'); rg.addColorStop(1, 'transparent');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 12, 30, 15, 0, 0, Math.PI*2); ctx.fill();
                    for (let i = 0; i < 3; i++) {
                        let a = fc * 0.07 + i * Math.PI * 2 / 3;
                        ctx.globalAlpha = 0.7;
                        ctx.fillStyle = i % 2 === 0 ? '#4ade80' : '#22d3ee';
                        ctx.beginPath();
                        ctx.arc(pos.x + Math.cos(a)*20, pos.y - 12 + Math.sin(a)*10, 3, 0, Math.PI*2);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.75;
                    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 5; ctx.lineCap = 'round';
                    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 12;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#4ade80', 8);
                    createParticles(gx, gy, '#22d3ee', 6);
                }
            },
            {
                id: 'nuclear',
                match: t => t.flags.has('nuclear'),
                priority: 6,
                towerAura(pos, tower, fc) {
                    let pa = 0.12 + Math.sin(fc * 0.09) * 0.06;
                    ctx.globalAlpha = pa;
                    let rg = ctx.createRadialGradient(pos.x, pos.y - 10, 2, pos.x, pos.y - 10, 32);
                    rg.addColorStop(0, '#86efac'); rg.addColorStop(0.5, '#4ade80'); rg.addColorStop(1, 'transparent');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 10, 32, 16, 0, 0, Math.PI*2); ctx.fill();
                    ctx.save(); ctx.translate(pos.x, pos.y - 22); ctx.rotate(fc * 0.008);
                    ctx.globalAlpha = 0.25 + Math.sin(fc * 0.08) * 0.1;
                    ctx.strokeStyle = '#86efac'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.stroke();
                    for (let i = 0; i < 3; i++) {
                        let a = i * Math.PI * 2 / 3;
                        ctx.beginPath();
                        ctx.moveTo(Math.cos(a)*4, Math.sin(a)*4);
                        ctx.lineTo(Math.cos(a)*14, Math.sin(a)*14);
                        ctx.stroke();
                    }
                    ctx.restore();
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.7;
                    ctx.strokeStyle = '#86efac'; ctx.lineWidth = 6; ctx.lineCap = 'round';
                    ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 14;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#86efac', 12);
                    createParticles(gx, gy, '#4ade80', 8);
                    createParticles(gx, gy, '#fde047', 4);
                }
            },
            {
                id: 'void',
                match: t => t.flags.has('void'),
                priority: 7,
                towerAura(pos, tower, fc) {
                    let pa = 0.20 + Math.sin(fc * 0.08) * 0.08;
                    ctx.globalAlpha = pa;
                    let rg = ctx.createRadialGradient(pos.x, pos.y - 12, 0, pos.x, pos.y - 12, 24);
                    rg.addColorStop(0, '#1e1b4b'); rg.addColorStop(0.5, '#4f46e5'); rg.addColorStop(1, 'transparent');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 12, 24, 12, 0, 0, Math.PI*2); ctx.fill();
                    for (let i = 0; i < 4; i++) {
                        let a = fc * 0.05 + i * Math.PI / 2;
                        let r = 20 - ((fc * 0.8 + i * 5) % 18);
                        ctx.globalAlpha = r / 20 * 0.6;
                        ctx.fillStyle = '#818cf8';
                        ctx.beginPath();
                        ctx.arc(pos.x + Math.cos(a)*r, pos.y - 12 + Math.sin(a)*(r/2), 2, 0, Math.PI*2);
                        ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.7;
                    ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.shadowColor = '#4f46e5'; ctx.shadowBlur = 10;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#818cf8', 8);
                    createParticles(gx, gy, '#1e1b4b', 6);
                }
            },
            {
                id: 'meteor',
                match: t => t.flags.has('meteor'),
                priority: 8,
                towerAura(pos, tower, fc) {
                    for (let i = 0; i < 5; i++) {
                        let a = fc * 0.02 + i * Math.PI * 2 / 5;
                        let r = 20 + Math.sin(fc * 0.06 + i) * 5;
                        ctx.globalAlpha = 0.5 + Math.sin(fc * 0.1 + i) * 0.2;
                        ctx.fillStyle = ['#ef4444','#f97316','#fde047','#f97316','#ef4444'][i];
                        ctx.beginPath();
                        ctx.arc(pos.x + Math.cos(a)*r, pos.y - 14 + Math.sin(a)*(r/2.2), 2.5, 0, Math.PI*2);
                        ctx.fill();
                    }
                    let pa = 0.20 + Math.sin(fc * 0.10) * 0.08;
                    ctx.globalAlpha = pa;
                    let rg = ctx.createRadialGradient(pos.x, pos.y - 20, 0, pos.x, pos.y - 20, 16);
                    rg.addColorStop(0, '#fde047'); rg.addColorStop(0.6, '#f97316'); rg.addColorStop(1, 'transparent');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 20, 16, 8, 0, 0, Math.PI*2); ctx.fill();
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.5;
                    ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3;
                    ctx.shadowColor = '#f97316'; ctx.shadowBlur = 14;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            let mh = 300 * (1 - Math.min(1, i / proj.history.length));
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - mh) : ctx.lineTo(hp2.x, hp2.y - mh);
                        });
                        ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#ef4444', 14);
                    createParticles(gx, gy, '#fde047', 8);
                    createParticles(gx, gy, '#f97316', 10);
                }
            },
            {
                id: 'storm',
                match: t => t.flags.has('storm'),
                priority: 9,
                towerAura(pos, tower, fc) {
                    if (fc % 5 < 2) {
                        for (let i = 0; i < 3; i++) {
                            let a = fc * 0.06 + i * Math.PI * 2 / 3;
                            let r = 22 + Math.sin(fc * 0.1 + i) * 4;
                            let sx = pos.x + Math.cos(a) * r;
                            let sy = pos.y - 14 + Math.sin(a) * (r/2);
                            ctx.globalAlpha = 0.6;
                            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
                            ctx.shadowColor = '#fde047'; ctx.shadowBlur = 5;
                            ctx.beginPath();
                            ctx.moveTo(sx, sy);
                            ctx.lineTo(sx + (Math.random()-0.5)*10, sy + (Math.random()-0.5)*10);
                            ctx.stroke();
                            ctx.shadowBlur = 0;
                        }
                    }
                    let pa = 0.10 + Math.sin(fc * 0.07) * 0.05;
                    ctx.globalAlpha = pa;
                    let rg = ctx.createRadialGradient(pos.x, pos.y - 14, 0, pos.x, pos.y - 14, 30);
                    rg.addColorStop(0, '#cbd5e1'); rg.addColorStop(1, 'transparent');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 14, 30, 15, 0, 0, Math.PI*2); ctx.fill();
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.6;
                    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4;
                    ctx.shadowColor = '#fde047'; ctx.shadowBlur = 8;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#fde047', 12);
                    createParticles(gx, gy, '#cbd5e1', 6);
                }
            },
            {
                id: 'poison',
                match: t => t.flags.has('poison'),
                priority: 10,
                towerAura(pos, tower, fc) {
                    for (let i = 0; i < 4; i++) {
                        let a = fc * 0.03 + i * Math.PI / 2;
                        let r = 16 + Math.sin(fc * 0.07 + i) * 4;
                        ctx.globalAlpha = 0.55 + Math.sin(fc * 0.09 + i) * 0.2;
                        ctx.fillStyle = i % 2 === 0 ? '#4ade80' : '#86efac';
                        ctx.beginPath(); ctx.arc(pos.x + Math.cos(a)*r, pos.y - 12 + Math.sin(a)*(r/2), 2.5, 0, Math.PI*2); ctx.fill();
                    }
                    let pa = 0.10 + Math.sin(fc * 0.08) * 0.04;
                    ctx.globalAlpha = pa;
                    let rg = ctx.createRadialGradient(pos.x, pos.y - 10, 0, pos.x, pos.y - 10, 22);
                    rg.addColorStop(0, '#4ade80'); rg.addColorStop(1, 'transparent');
                    ctx.fillStyle = rg;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y - 10, 22, 11, 0, 0, Math.PI*2); ctx.fill();
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.6;
                    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.shadowColor = '#86efac'; ctx.shadowBlur = 7;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#4ade80', 6);
                    createParticles(gx, gy, '#86efac', 4);
                }
            },
            {
                id: 'bleed',
                match: t => t.flags.has('bleed'),
                priority: 11,
                towerAura(pos, tower, fc) {
                    for (let i = 0; i < 3; i++) {
                        let phase = (fc * 0.04 + i * 0.7) % 1;
                        let bx = pos.x + Math.cos(i * 2.1) * 14;
                        let by = pos.y - 8 - 14 * (1 - phase) + phase * 10;
                        ctx.globalAlpha = phase < 0.8 ? 0.7 : (1 - phase) * 3.5;
                        ctx.fillStyle = '#ef4444';
                        ctx.beginPath(); ctx.ellipse(bx, by, 2, 3, 0, 0, Math.PI*2); ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.65;
                    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.shadowColor = '#991b1b'; ctx.shadowBlur = 6;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#ef4444', 6);
                    createParticles(gx, gy, '#991b1b', 4);
                }
            },
            {
                id: 'chain',
                match: t => t.flags.has('chain'),
                priority: 12,
                towerAura(pos, tower, fc) {
                    let count = Math.min(tower.chainTargets + 2, 6);
                    for (let i = 0; i < count; i++) {
                        let a = fc * 0.04 + i * Math.PI * 2 / count;
                        let r = 18;
                        ctx.globalAlpha = 0.4 + Math.sin(fc * 0.1 + i) * 0.15;
                        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.arc(pos.x + Math.cos(a)*r, pos.y - 12 + Math.sin(a)*(r/2), 3, 0, Math.PI*2);
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.5;
                    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 3; ctx.lineCap = 'round';
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#94a3b8', 4);
                }
            },
            {
                id: 'piercing',
                match: t => t.flags.has('piercing'),
                priority: 13,
                towerAura(pos, tower, fc) {
                    for (let i = 0; i < 4; i++) {
                        let a = i * Math.PI / 2 + fc * 0.02;
                        let r = 14 + ((fc * 0.6 + i * 4) % 10);
                        ctx.globalAlpha = 0.4;
                        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(pos.x + Math.cos(a)*r, pos.y - 12 + Math.sin(a)*(r/2));
                        ctx.lineTo(pos.x + Math.cos(a)*(r+6), pos.y - 12 + Math.sin(a)*((r+6)/2));
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                },
                projTrail(pos, proj) {
                    ctx.globalAlpha = 0.55;
                    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
                    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 5;
                    if (proj.history.length > 1) {
                        ctx.beginPath();
                        proj.history.forEach((h, i) => {
                            let hp2 = cartToIso(h.x, h.y);
                            i === 0 ? ctx.moveTo(hp2.x, hp2.y - 15) : ctx.lineTo(hp2.x, hp2.y - 15);
                        });
                        ctx.lineTo(pos.x, pos.y - 15); ctx.stroke();
                    }
                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                },
                onImpact(gx, gy) {
                    createParticles(gx, gy, '#fbbf24', 5);
                }
            },
        ];

        function _vfxLayers(tower) {
            let c = tower._vfxCache;
            if (!c || c.sz !== tower.flags.size) {
                const all = VFX_LAYERS.filter(l => l.match(tower)).sort((a,b) => a.priority - b.priority);
                c = tower._vfxCache = { sz: tower.flags.size, aura: all.slice(0, 3), proj: all.slice(0, 2) };
            }
            return c;
        }
        function getActiveLayers(tower) { return _vfxLayers(tower).aura; }

        function drawTowerVFX(pos, tower, fc) {
            const ls = _vfxLayers(tower).aura;
            for (let i = 0; i < ls.length; i++) if (ls[i].towerAura) ls[i].towerAura(pos, tower, fc);
        }

        function drawProjVFX(pos, proj) {
            const ls = _vfxLayers(proj.tower).proj;
            for (let i = 0; i < ls.length; i++) if (ls[i].projTrail) ls[i].projTrail(pos, proj);
        }

        function triggerImpactVFX(proj, gx, gy) {
            const ls = _vfxLayers(proj.tower).proj;
            for (let i = 0; i < ls.length; i++) if (ls[i].onImpact) ls[i].onImpact(gx, gy);
        }

        function createCard(name, rarity, icon, desc, buff, debuff, apply) { return { name, rarity, icon, desc, buff, debuff, apply }; }

        const arcanasPool = [
            createCard("Monges Orantes", "common", '<i class="fa-solid fa-hands-praying"></i>', "Rezam pela torre dia e noite.", "Monge protege a torre: ataca quem tentar sabotá-la", "-5% Vel. Ataque", t => { t.monks = (t.monks || 0) + 1; t.modRate += 0.05; }),
            createCard("Noviço Fervoroso", "common", '<i class="fa-solid fa-person-praying"></i>', "Reza rápido e bate mais rápido ainda.", "+1 Monge, monges atacam 30% mais rápido", "-5% Dano", t => { t.monks = (t.monks || 0) + 1; t.monkHaste = (t.monkHaste || 1) + 0.30; t.modDmg -= 0.05; }),
            createCard("Monges Veteranos", "rare", '<i class="fa-solid fa-hands-praying"></i>', "Anos de oração e muita disciplina.", "+2 Monges, +25% dano dos monges", "-8% Vel. Ataque", t => { t.monks = (t.monks || 0) + 2; t.monkMul = (t.monkMul || 1) + 0.25; t.modRate += 0.08; }),
            createCard("Ordem do Mosteiro", "epic", '<i class="fa-solid fa-place-of-worship"></i>', "Uma ordem inteira jura proteger a torre.", "+3 Monges, +60% dano dos monges, +20% Durabilidade", "-12% Vel. Ataque", t => { t.monks = (t.monks || 0) + 3; t.monkMul = (t.monkMul || 1) + 0.60; t.modDur += 0.20; t.modRate += 0.12; }),
            createCard("Abade Iluminado", "legendary", '<i class="fa-solid fa-dharmachakra"></i>', "A luz guia cada golpe dos monges.", "+4 Monges, dano dos monges x2, atacam 2x mais rápido, +35% Durabilidade", "-15% Vel. Ataque", t => { t.monks = (t.monks || 0) + 4; t.monkMul = (t.monkMul || 1) + 1.0; t.monkHaste = (t.monkHaste || 1) + 1.0; t.modDur += 0.35; t.modRate += 0.15; }),
            createCard("Mira Ajustada", "common", '<i class="fa-solid fa-crosshairs"></i>', "Um leve ajuste nas lentes.", "+15% Alcance", "-5% Dano", t => {t.modRange += 0.15; t.modDmg -= 0.05;}),
            createCard("Óleo Mecânico", "common", '<i class="fa-solid fa-oil-can"></i>', "Engrenagens mais lisas.", "+15% Vel. Ataque", "-5% Alcance", t => {t.modRate -= 0.15; t.modRange -= 0.05;}),
            createCard("Parafusos Reforçados", "common", '<i class="fa-solid fa-screwdriver"></i>', "Estrutura mais firme.", "+15% Dano", "-5% Vel. Ataque", t => {t.modDmg += 0.15; t.modRate += 0.05;}),
            createCard("Treinamento Básico", "common", '<i class="fa-solid fa-person-military-rifle"></i>', "Foco no que importa.", "+10% Dano, +10% Vel", "-5% Alcance", t => {t.modDmg+=0.10; t.modRate-=0.10; t.modRange -= 0.05;}),
            createCard("Pólvora Extra", "common", '<i class="fa-solid fa-fire"></i>', "Mais boom por tiro.", "+20% Dano", "-5% Vel. Ataque", t => {t.modDmg+=0.20; t.modRate+=0.05;}),
            createCard("Molas Novas", "common", '<i class="fa-solid fa-ring"></i>', "Recuo mais suave.", "+20% Vel. Ataque", "-5% Dano", t => {t.modRate-=0.20; t.modDmg-=0.05;}),
            createCard("Peças Recicladas", "common", '<i class="fa-solid fa-recycle"></i>', "Custo benefício.", "+5% Dano, +5% Alcance", "-5% Crit", t => {t.modDmg+=0.05; t.modRange+=0.05; t.critChance-=0.05;}),
            createCard("Afiamento", "common", '<i class="fa-solid fa-gavel"></i>', "Corta o ar.", "+5% Crit Chance", "-5% Vel. Ataque", t => {t.critChance += 0.05; t.modRate += 0.05;}),
            createCard("Binóculo Compacto", "common", '<i class="fa-solid fa-binoculars"></i>', "Enxerga mais longe.", "+25% Alcance", "-5% Vel. Ataque", t => {t.modRange+=0.25; t.modRate+=0.05;}),
            createCard("Ajuste Fino", "common", '<i class="fa-solid fa-wrench"></i>', "Tudo nos conformes.", "+10% Dano", "-5% Alcance", t => {t.modDmg += 0.10; t.modRange -= 0.05;}),
            createCard("Kit de Reparos", "common", '<i class="fa-solid fa-toolbox"></i>', "Manutenção básica.", "+10% Vel. Ataque", "-5% Dano", t => {t.modRate -= 0.10; t.modDmg -= 0.05;}),
            createCard("Caixa de Ferramentas", "common", '<i class="fa-solid fa-hammer"></i>', "Básico do básico.", "+5% Dano, Vel, Alcance", "-5% Crit", t => {t.modDmg+=0.05; t.modRate-=0.05; t.modRange+=0.05; t.critChance-=0.05;}),
            createCard("Bronze Polido", "common", '<i class="fa-solid fa-medal"></i>', "Bonito e funcional.", "+10% Mult. Ouro", "-10% Dano", t => {t.goldMultiplier += 0.10; t.modDmg -= 0.10;}),
            createCard("Lubrificação Extrema", "common", '<i class="fa-solid fa-droplet"></i>', "Escorrega e vai.", "+25% Vel. Ataque", "-10% Dano", t => {t.modRate-=0.25; t.modDmg-=0.10;}),
            createCard("Visor Simples", "common", '<i class="fa-solid fa-eye"></i>', "Sem erro.", "+15% Alcance, +5% Crit", "-5% Vel. Ataque", t => {t.modRange+=0.15; t.critChance+=0.05; t.modRate+=0.05;}),
            createCard("Carga Econômica", "common", '<i class="fa-solid fa-battery-quarter"></i>', "Gasta menos, ganha mais.", "+1 Ouro por Abate", "-10% Dano", t => {t.goldPerKill+=1; t.modDmg-=0.10;}),
            createCard("Armadura Leve", "common", '<i class="fa-solid fa-shield-halved"></i>', "Proteção simples.", "+15% Vida Base", "-5% Dano", t => { t.modDmg-=0.05; if(!t.isPreview) { hp += 3; updateUI(); } }),
            createCard("Alinhamento", "common", '<i class="fa-solid fa-ruler-combined"></i>', "Tiro reto.", "+10% Vel. Projétil", "-5% Vel. Ataque", t => {t.projectileSpeed *= 1.10; t.modRate+=0.05;}),
            createCard("Calibração", "common", '<i class="fa-solid fa-compass-drafting"></i>', "Na mosca.", "+10% Crit Damage", "-5% Alcance", t => {t.critDamage += 0.10; t.modRange -= 0.05;}),
            createCard("Moeda da Sorte", "common", '<i class="fa-solid fa-coins"></i>', "Sorte.", "+15 Ouro (Imediato)", "-1 Vida Base", t => { if(!t.isPreview) { gold += 15; hp -= 1; updateUI(); } }),

            createCard("Munição Perfurante", "rare", '<i class="fa-solid fa-angles-right"></i>', "Atravessa alvos.", "Ataque Perfurante", "-15% Dano", t => {t.flags.add('piercing'); t.modDmg-=0.15;}),
            createCard("Radar Militar", "rare", '<i class="fa-solid fa-satellite-dish"></i>', "Visão além do alcance.", "+50% Alcance", "-10% Vel. Ataque", t => {t.modRange+=0.50; t.modRate+=0.10;}),
            createCard("Turbo Compressor", "rare", '<i class="fa-solid fa-fan"></i>', "Atira como louco.", "+50% Vel. Ataque", "-15% Dano", t => {t.modRate-=0.50; t.modDmg-=0.15;}),
            createCard("Bateria de Íons", "rare", '<i class="fa-solid fa-car-battery"></i>', "Choque puro.", "Ataque de Raio", "-10% Dano", t => {t.flags.add('lightning'); t.modDmg-=0.10;}),
            createCard("Microfusão", "rare", '<i class="fa-solid fa-atom"></i>', "Dano denso.", "+40% Dano", "-10% Alcance", t => {t.modDmg+=0.40; t.modRange-=0.10;}),
            createCard("Mecanismo Duplo", "rare", '<i class="fa-solid fa-layer-group"></i>', "O dobro de eficiência.", "+30% Dano, +30% Vel", "-20% Alcance", t => {t.modDmg+=0.30; t.modRate-=0.30; t.modRange-=0.20;}),
            createCard("Núcleo Rubi", "rare", '<i class="fa-solid fa-gem"></i>', "Esquenta tudo.", "Ataque Fogo (DoT)", "-10% Vel. Ataque", t => {t.flags.add('fire'); t.modRate+=0.10;}),
            createCard("Telescópio Militar", "rare", '<i class="fa-solid fa-microscope"></i>', "Acha o ponto fraco.", "+20% Crit Chance", "-10% Vel. Ataque", t => {t.critChance+=0.20; t.modRate+=0.10;}),
            createCard("Cartucho Magnum", "rare", '<i class="fa-solid fa-box-archive"></i>', "Tiro pesado.", "+50% Crit Damage", "-15% Vel. Ataque", t => {t.critDamage+=0.50; t.modRate+=0.15;}),
            createCard("Circuito Rápido", "rare", '<i class="fa-solid fa-microchip"></i>', "Velocidade da luz.", "+40% Vel. Projétil", "-10% Dano", t => {t.projectileSpeed*=1.40; t.modDmg-=0.10;}),
            createCard("Núcleo de Safira", "rare", '<i class="fa-regular fa-snowflake"></i>', "Congela até a alma.", "Ataque Gelo (Slow)", "-10% Dano", t => {t.flags.add('frost'); t.modDmg-=0.10;}),
            createCard("Tiro Concentrado", "rare", '<i class="fa-solid fa-bullseye"></i>', "Dano bruto.", "+50% Dano", "-20% Vel. Ataque", t => {t.modDmg+=0.50; t.modRate+=0.20;}),
            createCard("Foco Balístico", "rare", '<i class="fa-solid fa-location-crosshairs"></i>', "Equilíbrio.", "+25% Dano, +25% Alcance", "-20% Vel. Ataque", t => {t.modDmg+=0.25; t.modRange+=0.25; t.modRate+=0.20;}),
            createCard("Amplificador Tático", "rare", '<i class="fa-solid fa-tower-broadcast"></i>', "Suporte focado.", "+30% Vel. Ataque", "-15% Dano", t => {t.modRate-=0.30; t.modDmg-=0.15;}),
            createCard("Reator Compacto", "rare", '<i class="fa-solid fa-plug"></i>', "Energia limpa.", "+20% Ouro Mult.", "-15% Dano", t => {t.goldMultiplier+=0.20; t.modDmg-=0.15;}),
            createCard("Câmaras Duplas", "rare", '<i class="fa-solid fa-yin-yang"></i>', "Mais tiro por vez.", "+1 Ricochete", "-10% Dano", t => {t.chainTargets+=1; t.modDmg-=0.10; t.flags.add('chain');}),
            createCard("Arsenal Aprimorado", "rare", '<i class="fa-solid fa-boxes-stacked"></i>', "Tudo de bom.", "+20% Dano/Vel/Alcance", "-15% Crit Chance", t => {t.modDmg+=0.20; t.modRate-=0.20; t.modRange+=0.20; t.critChance-=0.15;}),
            createCard("Visão Longa", "rare", '<i class="fa-solid fa-glasses"></i>', "Muito longe.", "+60% Alcance", "-15% Dano", t => {t.modRange+=0.60; t.modDmg-=0.15;}),
            createCard("Carregador Industrial", "rare", '<i class="fa-solid fa-industry"></i>', "Não para nunca.", "+60% Vel. Ataque", "-20% Dano", t => {t.modRate-=0.60; t.modDmg-=0.20;}),
            createCard("Gerador de Campo", "rare", '<i class="fa-solid fa-shield-virus"></i>', "Regeneração.", "+0.1 Roubo de Vida", "-10% Dano", t => {t.lifeSteal+=0.1; t.modDmg-=0.10;}),

            createCard("Morteiro Incendiário", "epic", '<i class="fa-solid fa-fire-flame-curved"></i>', "Fogo em área.", "Fogo + Área", "-15% Vel. Ataque", t => {t.flags.add('fire'); t.flags.add('explosion'); t.splashRadius+=1.5; t.modRate+=0.15;}),
            createCard("Canhão de Plasma", "epic", '<i class="fa-solid fa-biohazard"></i>', "Aquece a cada tiro.", "Ataque Plasma", "-10% Alcance", t => {t.flags.add('plasma'); t.modRange-=0.10;}),
            createCard("Reator Instável", "epic", '<i class="fa-solid fa-burst"></i>', "Explode tudo.", "+100% Dano Base", "-30% Vel. Ataque", t => {t.modDmg+=1.0; t.modRate+=0.30;}),
            createCard("Rajada Frenética", "epic", '<i class="fa-solid fa-hurricane"></i>', "Máquina de costura.", "+100% Vel. Ataque", "-30% Dano", t => {t.modRate-=0.50; t.modDmg-=0.30;}),
            createCard("Fragmentação", "epic", '<i class="fa-solid fa-star-of-david"></i>', "Dano espalhado.", "+2 Ricochetes", "-20% Dano", t => {t.chainTargets+=2; t.flags.add('chain'); t.modDmg-=0.20;}),
            createCard("Campo Eletromagnético", "epic", '<i class="fa-solid fa-magnet"></i>', "Prende os inimigos.", "Ataque Chain", "-15% Dano", t => {t.flags.add('chain'); t.modDmg-=0.15;}),
            createCard("Munição Nuclear", "epic", '<i class="fa-solid fa-radiation"></i>', "Sombra de cogumelo.", "Ataque Nuclear", "-50% Vel. Ataque", t => {t.flags.add('nuclear'); t.modRate+=0.50;}),
            createCard("Cristal Arcano", "epic", '<i class="fa-regular fa-gem"></i>', "Poder bruto.", "Ataque Arcano", "-15% Vel. Ataque", t => {t.flags.add('arcane'); t.modRate+=0.15;}),
            createCard("Olho de Águia", "epic", '<i class="fa-brands fa-earlybirds"></i>', "Sem erro.", "+50% Crit Chance", "-20% Vel. Ataque", t => {t.critChance+=0.5; t.modRate+=0.20;}),
            createCard("Tempestade de Ferro", "epic", '<i class="fa-solid fa-cloud-showers-heavy"></i>', "Chuva de balas.", "+3 Perfurar", "-20% Dano", t => {t.flags.add('piercing'); t.chainTargets+=3; t.modDmg-=0.20;}),
            createCard("Buraco Negro Compacto", "epic", '<i class="fa-solid fa-circle-notch"></i>', "Suga a vida.", "Ataque Void", "-40% Vel. Ataque", t => {t.flags.add('void'); t.modRate+=0.40;}),
            createCard("Fogo Grego", "epic", '<i class="fa-solid fa-fire-burner"></i>', "Chama verde.", "+200% Dano Fogo", "-20% Alcance", t => {t.modRange-=0.20; if(t.flags.has('fire')) t.modDmg+=2.0; else {t.flags.add('fire'); t.modDmg+=0.50;}}),
            createCard("Tempestade Arcana", "epic", '<i class="fa-solid fa-wand-magic-sparkles"></i>', "Dano mágico.", "+100% Dano, Magia", "-20% Vel. Ataque", t => {t.flags.add('arcane'); t.modDmg+=1.0; t.modRate+=0.20;}),
            createCard("Colapso Quântico", "epic", '<i class="fa-solid fa-cubes-stacked"></i>', "Dobra os status.", "+60% Dano, +50% Alcance, +40% Vel.", "-30% Crit Chance", t => {t.modDmg+=0.60; t.modRate-=0.40; t.modRange+=0.50; t.critChance-=0.30;}),
            createCard("Coração Vulcânico", "epic", '<i class="fa-solid fa-volcano"></i>', "Magma.", "+3 Área de Dano", "-20% Vel. Ataque", t => {t.splashRadius+=3; t.modRate+=0.20;}),
            createCard("Fusão Instável", "epic", '<i class="fa-solid fa-arrows-to-circle"></i>', "Risco e recompensa.", "+150% Crit Dmg, +30% Crit", "-20% Dano Base", t => {t.critDamage+=1.5; t.critChance+=0.3; t.modDmg-=0.20;}),
            createCard("Campo Temporal", "epic", '<i class="fa-solid fa-hourglass-half"></i>', "Paralisa.", "Frost + AoE", "-15% Dano", t => {t.flags.add('frost'); t.splashRadius+=2; t.modDmg-=0.15;}),
            createCard("Arsenal Experimental", "epic", '<i class="fa-solid fa-flask-vial"></i>', "Testando... 123.", "+100% Vel. Projétil", "-15% Dano", t => {t.projectileSpeed*=2.0; t.modDmg-=0.15;}),
            createCard("Núcleo Prismático", "epic", '<i class="fa-solid fa-circle-nodes"></i>', "Dinheiro vivo.", "+50% Ouro Mult.", "-20% Dano", t => {t.goldMultiplier+=0.5; t.modDmg-=0.20;}),
            createCard("Eco Dimensional", "epic", '<i class="fa-solid fa-podcast"></i>', "Tiro duplo.", "+2 Ricochetes, +50% Vel", "-25% Dano", t => {t.chainTargets+=2; t.modRate-=0.50; t.flags.add('chain'); t.modDmg-=0.25;}),

            createCard("Coração do Dragão", "legendary", '<i class="fa-solid fa-dragon"></i>', "Fogo e destruição global.", "Nuclear + Fire", "-30% Vel. Ataque", t => {t.flags.add('nuclear'); t.flags.add('fire'); t.splashRadius+=4; t.modDmg+=2.0; t.modRate+=0.30;}),
            createCard("Tempestade Divina", "legendary", '<i class="fa-solid fa-cloud-bolt"></i>', "Ira dos deuses.", "Ataque Storm", "-10% Alcance", t => {t.flags.add('storm'); t.modDmg+=3.0; t.modRate+=0.50; t.modRange-=0.10;}),
            createCard("Olho do Apocalipse", "legendary", '<i class="fa-solid fa-eye-low-vision"></i>', "Certeiro e letal.", "100% Crit, +300% Dmg", "-40% Vel. Ataque", t => {t.critChance=1.0; t.critDamage+=3.0; t.modRate+=0.40;}),
            createCard("Sol Artificial", "legendary", '<i class="fa-solid fa-sun"></i>', "Derrete o mapa.", "Plasma + Área", "-20% Alcance", t => {t.flags.add('plasma'); t.splashRadius+=3; t.modDmg+=2.0; t.modRange-=0.20;}),
            createCard("Motor Infinito", "legendary", '<i class="fa-solid fa-infinity"></i>', "Metralhadora laser.", "+300% Vel. Ataque", "-40% Dano", t => {t.modRate-=0.75; t.modDmg-=0.40;}),
            createCard("Arsenal Supremo", "legendary", '<i class="fa-solid fa-gun"></i>', "Todas as armas.", "+200% Dano/Vel/Alcance", "-50% Crit Chance", t => {t.modDmg+=2.0; t.modRate-=0.67; t.modRange+=2.0; t.critChance-=0.50;}),
            createCard("Núcleo Estelar", "legendary", '<i class="fa-solid fa-meteor"></i>', "O fim está próximo.", "Ataque Meteor", "Vel. Lenta", t => {t.flags.add('meteor'); t.modDmg+=4.0; t.modRate+=1.50;}),
            createCard("Caos Controlado", "legendary", '<i class="fa-solid fa-dice-d20"></i>', "Imprevisível.", "+5 Ricochetes", "-15% Alcance", t => {t.chainTargets+=5; t.flags.add('chain'); t.modDmg+=1.0; t.modRange-=0.15;}),
            createCard("Torre Viva", "legendary", '<i class="fa-solid fa-tree"></i>', "Absorve a alma.", "+1 Roubo Vida, +200% Dano", "-20% Vel. Ataque", t => {t.lifeSteal+=1.0; t.modDmg+=2.0; t.modRate+=0.20;}),
            createCard("Singularidade", "legendary", '<i class="fa-brands fa-galactic-senate"></i>', "Engole os fracos.", "Void Absoluto", "-25% Dano", t => {t.flags.add('void'); t.splashRadius+=2; t.modRate+=0.20; t.modDmg-=0.25;}),
            createCard("Deus da Guerra", "legendary", '<i class="fa-solid fa-khanda"></i>', "Força bruta.", "+250% Dano Base", "-30% Vel. Ataque", t => {t.modDmg+=2.5; t.modRate+=0.30;}),
            createCard("Estrela Colapsante", "legendary", '<i class="fa-solid fa-star-half-stroke"></i>', "Puxa e explode.", "Nuclear + Chain", "-20% Alcance", t => {t.flags.add('nuclear'); t.chainTargets+=2; t.modDmg+=1.0; t.modRange-=0.20;}),
            createCard("Eclipse Eterno", "legendary", '<i class="fa-solid fa-moon"></i>', "Escuridão.", "Frost + Void", "-15% Alcance", t => {t.flags.add('void'); t.flags.add('frost'); t.modRate-=0.50; t.modDmg+=1.0; t.modRange-=0.15;}),
            createCard("Trono Arcano", "legendary", '<i class="fa-solid fa-chess-rook"></i>', "Mágica suprema.", "Arcane em Área", "-25% Vel. Ataque", t => {t.flags.add('arcane'); t.splashRadius+=2.5; t.modDmg+=1.5; t.modRate+=0.25;}),
            createCard("Mente Colmeia", "legendary", '<i class="fa-solid fa-network-wired"></i>', "Multiplica tiros.", "+10 Ricochetes", "-10% Dano", t => {t.chainTargets+=10; t.flags.add('chain'); t.modDmg-=0.10;}),
            createCard("Anomalia Temporal", "legendary", '<i class="fa-solid fa-clock-rotate-left"></i>', "O tempo para.", "Frost Severo AoE", "-30% Dano", t => {t.flags.add('frost'); t.splashRadius+=5; t.modRate-=0.50; t.modDmg-=0.30;}),
            createCard("Chuva de Meteoros", "legendary", '<i class="fa-solid fa-meteor"></i>', "Apocalipse aéreo.", "Storm + Meteor", "-30% Vel. Ataque", t => {t.flags.add('storm'); t.flags.add('meteor'); t.modDmg+=3.0; t.splashRadius+=2; t.modRate+=0.30;}),
            createCard("Núcleo Universal", "legendary", '<i class="fa-solid fa-globe"></i>', "Dinheiro bom.", "+100% Ouro Mult. (cap 3x)", "-30% Dano", t => {t.goldMultiplier+=1.0; t.modDmg-=0.30;}),
            createCard("Portal do Vazio", "legendary", '<i class="fa-solid fa-door-open"></i>', "Atravessa tudo.", "+10 Perfurar, +100% Dmg", "-20% Vel. Ataque", t => {t.flags.add('piercing'); t.chainTargets+=10; t.modDmg+=1.0; t.modRate+=0.20;}),
            createCard("Máquina Divina", "legendary", '<i class="fa-solid fa-robot"></i>', "Sem falhas.", "+500% Vel. Ataque", "-50% Dano", t => {t.modRate-=0.40; t.modDmg-=0.50;})
        ];

        arcanasPool.push(createCard("Pílula de Venda", "common", '<i class="fa-solid fa-capsules"></i>', "Vende a torre, recupera Ouro.", "Ganha Ouro", "Destrói Torre", null));
        arcanasPool[arcanasPool.length-1].isPill = true;
        arcanasPool.push(createCard("Maçã Dourada", "rare", '<i class="fa-solid fa-apple-whole"></i>', "Restaura 5 Vida Base.", "+5 Vida Base", "Nenhum", null));
        arcanasPool[arcanasPool.length-1].isApple = true;

        arcanasPool.push(createCard("Toxina Fraca",    "common", '<i class="fa-solid fa-flask"></i>',        "Um toque venenoso.", "Aplica Veneno (1 stack)", "-10% Dano",    t=>{t.flags.add('poison'); t.modDmg-=0.10;}));
        arcanasPool.push(createCard("Sangue Corrosivo","rare",   '<i class="fa-solid fa-droplet-slash"></i>',"Inimigos envenenados sofrem mais.", "+35% Dano vs Envenenados", "Nenhum",   t=>{t.flags.add('poison'); t.flags.add('corrosive');}));
        arcanasPool.push(createCard("Epidemia",        "epic",   '<i class="fa-solid fa-biohazard"></i>',    "Veneno se espalha ao morrer.", "Veneno Contágio AoE", "Nenhum",           t=>{t.flags.add('poison'); t.flags.add('epidemic');}));
        arcanasPool.push(createCard("Praga Ancestral", "legendary",'<i class="fa-solid fa-skull-crossbones"></i>',"Veneno eterno, perfura armadura.", "Veneno Infinito + Ignora Def", "Nenhum", t=>{t.flags.add('poison'); t.flags.add('epidemic'); t.flags.add('corrosive'); t.modDmg+=0.50;}));

        arcanasPool.push(createCard("Lâmina Serrilhada","common",'<i class="fa-solid fa-khanda"></i>',      "Ferimento profundo.", "30% Chance Sangramento", "-10% Vel. Ataque", t=>{t.flags.add('bleed'); t.modRate+=0.10;}));
        arcanasPool.push(createCard("Hemorragia",       "rare",  '<i class="fa-solid fa-heart-crack"></i>',  "Mais dano para inimigos grandes.", "Sangramento vs Vida Máx.", "Nenhum", t=>{t.flags.add('bleed'); t.flags.add('hemorrhage');}));
        arcanasPool.push(createCard("Ferida Mortal",    "epic",  '<i class="fa-solid fa-person-falling"></i>',"Quanto mais corre, mais morre.", "Sangramento + Escala Mov.", "Nenhum",  t=>{t.flags.add('bleed'); t.flags.add('mortalwound');}));
        arcanasPool.push(createCard("Banho de Sangue",  "legendary",'<i class="fa-solid fa-droplet"></i>',  "Explosão de sangue ao morrer.", "Sangramento + Explosão Morte", "Nenhum", t=>{t.flags.add('bleed'); t.flags.add('bloodbath'); t.flags.add('hemorrhage'); t.modDmg+=0.50;}));

        let econCards = [
            createCard("Cupom Amassado",     "common",'<i class="fa-solid fa-ticket"></i>',    "Achado no chão.", "Próx. Reroll 50% Off", "Nenhum",                t=>{ shopMods.rerollDiscount=0.5; }),
            createCard("Comerciante Local",  "common",'<i class="fa-solid fa-store"></i>',     "Negócio de bairro.", "+2 Waves: Cartas 15% Off", "Nenhum",           t=>{ shopMods.wavesDiscount=2; shopMods.waveDiscountAmt=0.15; }),
            createCard("Catálogo Antigo",    "rare",  '<i class="fa-solid fa-book-open"></i>',  "Dicas de um velho sábio.", "+10% Chance Rara", "Nenhum",            t=>{ shopMods.rareBonusChance+=0.1; }),
            createCard("Atacadista",         "rare",  '<i class="fa-solid fa-boxes-stacked"></i>',"Compra em volume.", "+3 Waves: Tudo 20% Off", "Nenhum",           t=>{ shopMods.wavesDiscount=3; shopMods.waveDiscountAmt=0.20; }),
            createCard("Contato no Mercado Negro","rare",'<i class="fa-solid fa-user-secret"></i>',"Conhece os caras certos.", "+20% Chance Rara, +5% Épica", "Nenhum", t=>{shopMods.rareBonusChance+=0.2; shopMods.epicBonusChance+=0.05;}),
            createCard("Curador de Relíquias","rare", '<i class="fa-solid fa-magnifying-glass"></i>',"Garante qualidade.", "Próx. Loja: Mín. 1 Rara", "Nenhum",    t=>{ shopMods.guaranteeRare=true; }),
            createCard("Mercado Arcano",     "epic",  '<i class="fa-solid fa-hat-wizard"></i>', "Magia é caro, mas vale.", "+15% Épica, +5% Lendária", "Nenhum",    t=>{shopMods.epicBonusChance+=0.15; shopMods.legendBonusChance+=0.05;}),
            createCard("Colecionador Obsessivo","epic",'<i class="fa-solid fa-trophy"></i>',   "Só o melhor serve.", "Próx. Loja: Só Rara+", "Nenhum",             t=>{ shopMods.onlyRarePlus=true; }),
            createCard("Contrato com o Destino","epic",'<i class="fa-solid fa-scroll"></i>',   "Uma oferta irrecusável.", "Próx. Loja: Alta Chance Lendária", "Nenhum", t=>{ shopMods.highLegendChance=true; }),
            createCard("Coroa do Mercador Supremo","legendary",'<i class="fa-solid fa-crown"></i>',"O rei dos mercadores.", "Preços -25% Perm + Chance Lendária", "Nenhum", t=>{shopMods.priceReduction=Math.min(0.5,shopMods.priceReduction+0.25); shopMods.legendBonusChance+=0.05;}),
        ];
        econCards.forEach(c=>{ c.isEcon=true; arcanasPool.push(c); });

        // ── CARTAS DE DURABILIDADE ──
        const DUR_CARDS = [
            createCard("Chapa Reforçada", "common", '<i class="fa-solid fa-shield-halved"></i>', "Mais metal onde dói.", "+30% Durabilidade", "-5% Vel. Ataque", t => { t.modDur = (t.modDur || 1) + 0.30; t.modRate += 0.05; }),
            createCard("Graxa Pesada", "common", '<i class="fa-solid fa-oil-can"></i>', "Menos atrito, menos desgaste.", "-25% Desgaste", "-5% Dano", t => { t.modDecay = (t.modDecay || 1) - 0.25; t.modDmg -= 0.05; }),
            createCard("Solda de Campo", "common", '<i class="fa-solid fa-screwdriver-wrench"></i>', "Remendo rápido entre ondas.", "Restaura 50% da Durabilidade (não ocupa vaga)", "-5% Alcance", t => { if (!t.isPreview) t.dur = Math.min(t.maxDur, t.dur + t.maxDur * 0.5); t.modRange -= 0.05; }),
            createCard("Liga de Titânio", "rare", '<i class="fa-solid fa-gem"></i>', "Leve e quase indestrutível.", "+50% Durab., -15% Desgaste", "-10% Vel. Ataque", t => { t.modDur = (t.modDur || 1) + 0.50; t.modDecay = (t.modDecay || 1) - 0.15; t.modRate += 0.10; }),
            createCard("Nanobots de Reparo", "rare", '<i class="fa-solid fa-microchip"></i>', "Remendam a torre durante a batalha.", "Regenera 0.20 Durab./s (não ocupa vaga)", "-10% Dano", t => { t.durRegen = (t.durRegen || 0) + 0.20; t.modDmg -= 0.10; }),
            createCard("Motor Superaquecido", "rare", '<i class="fa-solid fa-temperature-high"></i>', "Roda no limite.", "+25% Vel. Ataque", "+30% Desgaste", t => { t.modRate -= 0.25; t.modDecay = (t.modDecay || 1) + 0.30; }),
            createCard("Blindagem Pesada", "epic", '<i class="fa-solid fa-helmet-safety"></i>', "Aguenta o tranco.", "+80% Durabilidade", "-15% Alcance", t => { t.modDur = (t.modDur || 1) + 0.80; t.modRange -= 0.15; }),
            createCard("Sobrecarga Perigosa", "epic", '<i class="fa-solid fa-radiation"></i>', "Poder demais derrete o metal.", "+40% Dano", "+50% Desgaste", t => { t.modDmg += 0.40; t.modDecay = (t.modDecay || 1) + 0.50; }),
            createCard("Coração de Adamantium", "legendary", '<i class="fa-solid fa-heart-pulse"></i>', "Nada o quebra.", "+120% Durab., -40% Desgaste", "-15% Vel. Ataque", t => { t.modDur = (t.modDur || 1) + 1.20; t.modDecay = (t.modDecay || 1) - 0.40; t.modRate += 0.15; }),
        ];
        DUR_CARDS.forEach(c => { c.isDur = true; if (c.name === 'Solda de Campo' || c.name === 'Nanobots de Reparo') c.healsDur = true; arcanasPool.push(c); });
        arcanasPool.push(createCard("Brasa Viva", "common", '<i class="fa-solid fa-fire"></i>', "Tudo que toca, queima.", "Queima + Espalha Fogo", "-5% Dano", t=>{t.flags.add('fire'); t.modDmg-=0.05;}));
        arcanasPool.push(createCard("Ricochete Cromado", "rare", '<i class="fa-solid fa-arrows-split-up-and-left"></i>', "A bala quica de inimigo em inimigo.", "+3 Ricochetes", "-10% Dano", t=>{t.chainTargets+=3; t.flags.add('chain'); t.modDmg-=0.10;}));
        arcanasPool.push(createCard("Pára-Raios", "epic", '<i class="fa-solid fa-bolt-lightning"></i>', "Raios caem do céu e saltam entre inimigos.", "Raio + 2 Saltos + Atordoa", "-15% Vel. Ataque", t=>{t.flags.add('lightning'); t.chainTargets+=2; t.modRate+=0.15;}));
        arcanasPool.push(createCard("Pedra Cadente", "epic", '<i class="fa-solid fa-meteor"></i>', "Um meteorito pequeno, mas teimoso.", "Meteoro + Cratera em Chamas", "-40% Vel. Ataque", t=>{t.flags.add('meteor'); t.modDmg+=1.5; t.modRate+=0.40;}));

        const angelicCards = [
            createCard("Pena Luminosa", "common", '<i class="fa-solid fa-feather"></i>', "Um toque de luz divina.", "+15% Alcance", "-5% Dano", t => {t.modRange += 0.15; t.modDmg -= 0.05;}),
            createCard("Sopro Divino", "common", '<i class="fa-solid fa-wind"></i>', "Acelera os justos.", "+15% Vel. Ataque", "-5% Alcance", t => {t.modRate -= 0.15; t.modRange -= 0.05;}),
            createCard("Escudo da Fé", "common", '<i class="fa-solid fa-shield"></i>', "Proteção menor.", "+1 Vida Base", "-5% Dano", t => { t.modDmg -= 0.05; if (!t.isPreview) { hp += 1; updateUI(); } }),
            createCard("Canto Angelical", "common", '<i class="fa-solid fa-music"></i>', "Harmonia no campo.", "+10% Dano, +5% Vel", "-5% Alcance", t => { t.modDmg += 0.10; t.modRate -= 0.05; t.modRange -= 0.05; }),
            createCard("Bênção Financeira", "common", '<i class="fa-solid fa-hand-holding-dollar"></i>', "Os deuses pagam bem.", "+10 Ouro, +5% Ouro Mult.", "-5% Dano", t => { t.goldMultiplier += 0.05; t.modDmg -= 0.05; if (!t.isPreview) { gold += 10; updateUI(); } }),

            createCard("Raio Purificador", "rare", '<i class="fa-solid fa-bolt-lightning"></i>', "Limpa a escuridão.", "Ataque Arcano, +10% Dano", "-10% Vel. Ataque", t => { t.flags.add('arcane'); t.modDmg += 0.10; t.modRate += 0.10; }),
            createCard("Graça Restauradora", "rare", '<i class="fa-solid fa-heart-pulse"></i>', "Cura constante.", "+3 Vida Base", "-10% Dano", t => { t.modDmg-=0.10; if (!t.isPreview) { hp += 3; updateUI(); } }),
            createCard("Aura de Proteção", "rare", '<i class="fa-solid fa-sun"></i>', "Cega os inimigos.", "+30% Alcance", "-10% Vel. Ataque", t => {t.modRange += 0.30; t.modRate += 0.10;}),
            createCard("Martelo Sagrado", "rare", '<i class="fa-solid fa-gavel"></i>', "Justiça pesada.", "+40% Dano", "-10% Vel. Ataque", t => { t.modDmg += 0.40; t.modRate += 0.10; }),
            createCard("Visão Celestial", "rare", '<i class="fa-solid fa-eye"></i>', "Nada escapa.", "+30% Crit Chance", "-10% Vel. Ataque", t => {t.critChance += 0.3; t.modRate+=0.10;}),

            createCard("Julgamento Divino", "epic", '<i class="fa-solid fa-scale-balanced"></i>', "A balança pesa.", "Storm + 50% Crit Dmg", "-15% Vel. Ataque", t => { t.flags.add('storm'); t.critDamage += 0.5; t.modRate+=0.15; }),
            createCard("Presença Angélica", "legendary", '<i class="fa-solid fa-hands-praying"></i>', "Inspiração divina.", "+67% Vel. Ataque", "-20% Dano", t => {t.modRate -= 0.67; t.modDmg-=0.20;}),
            createCard("Ressurreição Parcial", "epic", '<i class="fa-solid fa-cross"></i>', "A base se ergue.", "+10 Vida Base", "-15% Dano", t => { t.modDmg-=0.15; if (!t.isPreview) { hp += 10; updateUI(); } }),
            createCard("Santuário", "epic", '<i class="fa-solid fa-place-of-worship"></i>', "Zona segura.", "+0.3 Roubo Vida", "-15% Dano", t => {t.lifeSteal += 0.3; t.modDmg-=0.15;}),
            createCard("Fúria dos Céus", "epic", '<i class="fa-solid fa-cloud-sun"></i>', "Trovões impiedosos.", "Lightning + Piercing", "-20% Vel. Ataque", t => { t.flags.add('lightning'); t.flags.add('piercing'); t.modRate+=0.20; }),

            createCard("Ira de Deus", "legendary", '<i class="fa-solid fa-hands-holding-circle"></i>', "Dano supremo, alcance global.", "+200% Alcance, +200% Dano", "-40% Vel. Ataque", t => { t.modRange += 2.0; t.modDmg += 2.0; t.modRate+=0.40; }),
            createCard("Avatar da Luz", "legendary", '<i class="fa-solid fa-user-astronaut"></i>', "Forma pura.", "Plasma + Arcane AoE", "-20% Vel. Ataque", t => { t.flags.add('plasma'); t.flags.add('arcane'); t.splashRadius += 3; t.modRate+=0.20; }),
            createCard("Portões do Paraíso", "legendary", '<i class="fa-solid fa-torii-gate"></i>', "Ouro e vida fartos.", "+20 Vida, +300 Ouro", "-30% Dano", t => { t.modDmg-=0.30; if (!t.isPreview) { hp += 20; gold += 300; updateUI(); } }),
            createCard("Milagre Supremo", "legendary", '<i class="fa-solid fa-dove"></i>', "Impossível de morrer.", "+1.5 Roubo Vida, +100% Vel", "-30% Dano", t => { t.lifeSteal += 1.5; t.modRate -= 0.50; t.modDmg-=0.30; }),
            createCard("Arcanjo Guardião", "legendary", '<i class="fa-solid fa-person-burst"></i>', "EXCLUSIVA DA LUZ.", "Dano Triplo, +100% Crit", "-50% Vel. Ataque", t => { t.modDmg += 2.0; t.critChance = 1.0; t.modRate+=0.50; })
        ];
        angelicCards.forEach(c => { c.alignment = 'angelic'; arcanasPool.push(c); });

        const demonicCards = [
            createCard("Pacto de Sangue", "common", '<i class="fa-solid fa-file-contract"></i>', "Dano bruto.", "+30% Dano", "-1 Vida Base", t => { t.modDmg += 0.30; if (!t.isPreview) { hp -= 1; updateUI(); if(hp<=0) gameOver=true; } }),
            createCard("Fogo Fátuo", "common", '<i class="fa-solid fa-fire-flame-simple"></i>', "Queima leve.", "Aplica Fogo", "-10% Alcance", t => { t.flags.add('fire'); t.modRange -= 0.10; }),
            createCard("Garra Sombria", "common", '<i class="fa-solid fa-hand-lizard"></i>', "Rasga a carne.", "30% Sangramento", "-10% Alcance", t => {t.flags.add('bleed'); t.modRange-=0.10;}),
            createCard("Sussurro Abissal", "common", '<i class="fa-solid fa-ear-listen"></i>', "Acelera o fim.", "+20% Vel. Ataque", "-1 Vida Base", t => { t.modRate -= 0.20; if (!t.isPreview) { hp -= 1; updateUI(); if(hp<=0) gameOver=true; } }),
            createCard("Chifre Quebrado", "common", '<i class="fa-solid fa-tooth"></i>', "Ganha uns trocados.", "+35 Ouro", "-2 Vida Base", t => { if (!t.isPreview) { gold += 35; hp -= 2; updateUI(); if(hp<=0) gameOver=true; } }),

            createCard("Sacrifício Menor", "rare", '<i class="fa-solid fa-droplet"></i>', "Mais sangue, mais poder.", "+70% Dano", "-3 Vida Base", t => { t.modDmg += 0.70; if (!t.isPreview) { hp -= 3; updateUI(); if(hp<=0) gameOver=true; } }),
            createCard("Marca da Maldição", "rare", '<i class="fa-solid fa-skull"></i>', "Dor dupla.", "+40% Crit Dmg, Sangramento", "-10% Vel. Ataque", t => { t.critDamage += 0.4; t.flags.add('bleed'); t.modRate+=0.10; }),
            createCard("Olho do Abismo", "rare", '<i class="fa-solid fa-eye-slash"></i>', "Alcance sombrio.", "+50% Alcance", "-2 Vida Base", t => { t.modRange += 0.50; if (!t.isPreview) { hp -= 2; updateUI(); if(hp<=0) gameOver=true; } }),
            createCard("Sede de Sangue", "rare", '<i class="fa-solid fa-vial"></i>', "Frenesi.", "+60% Vel. Ataque", "-3 Vida Base", t => { t.modRate -= 0.60; if (!t.isPreview) { hp -= 3; updateUI(); if(hp<=0) gameOver=true; } }),
            createCard("Aura Putrefata", "rare", '<i class="fa-solid fa-bugs"></i>', "Todos adoecem.", "Poison + Epidemic", "-15% Dano", t => { t.flags.add('poison'); t.flags.add('epidemic'); t.modDmg-=0.15; }),

            createCard("Pacto Sombrio", "epic", '<i class="fa-solid fa-scroll"></i>', "Sangue por poder.", "+200% Dano, Penetra Armadura", "-5 Vida Base", t => { t.modDmg += 2.0; t.flags.add('piercing'); if (!t.isPreview) { hp -= 5; updateUI(); if(hp<=0) gameOver=true; } }),
            createCard("Tormento", "epic", '<i class="fa-solid fa-face-dizzy"></i>', "Caos em área.", "Explosion + Fire", "-20% Vel. Ataque", t => { t.flags.add('explosion'); t.flags.add('fire'); t.modRate+=0.20; }),
            createCard("Alma Corrompida", "epic", '<i class="fa-solid fa-ghost"></i>', "Tiros assombrados.", "Void + 2 Ricochetes", "-15% Dano", t => { t.flags.add('void'); t.chainTargets += 2; t.flags.add('chain'); t.modDmg-=0.15; }),
            createCard("Chama do Inferno", "epic", '<i class="fa-solid fa-fire-burner"></i>', "Queima o mapa.", "+200% Dano Fogo", "-4 Vida Base", t => { t.flags.add('fire'); t.modDmg += 2.0; if (!t.isPreview) { hp -= 4; updateUI(); if(hp<=0) gameOver=true; } }),
            createCard("Fenda Abissal", "epic", '<i class="fa-solid fa-burst"></i>', "Tudo de uma vez.", "+100% Vel e Dano", "-7 Vida Base", t => { t.modRate -= 0.50; t.modDmg += 1.0; if (!t.isPreview) { hp -= 7; updateUI(); if(hp<=0) gameOver=true; } }),

            createCard("Despertar do Demônio", "legendary", '<i class="fa-solid fa-spaghetti-monster-flying"></i>', "O verdadeiro monstro.", "+400% Dano, Fogo+Sangramento", "-6 Vida Base", t => { t.modDmg += 4.0; t.flags.add('fire'); t.flags.add('bleed'); if (!t.isPreview) { hp -= 6; updateUI(); if(hp<=0) gameOver=true; } }),
            createCard("Ritual de Sangue", "legendary", '<i class="fa-solid fa-syringe"></i>', "Venda sua alma.", "+800 Ouro", "-8 Vida Base", t => { if (!t.isPreview) { gold += 800; hp -= 8; updateUI(); if(hp<=0) gameOver=true; } }),
            createCard("Apocalipse Sombrio", "legendary", '<i class="fa-solid fa-volcano"></i>', "Fogo e Morte.", "Meteor + Void", "-20% Vel. Ataque", t => { t.flags.add('meteor'); t.flags.add('void'); t.modDmg += 2.0; t.modRate+=0.20; }),
            createCard("Devorador de Mundos", "legendary", '<i class="fa-solid fa-teeth-open"></i>', "Insaciável.", "+5 Roubo Vida, Sangramento AoE", "-25% Vel. Ataque", t => { t.lifeSteal += 5.0; t.flags.add('bleed'); t.splashRadius += 2; t.modRate+=0.25; }),
            createCard("Senhor do Abismo", "legendary", '<i class="fa-solid fa-khanda"></i>', "EXCLUSIVA DAS TREVAS. Aniquila Bosses.", "Void+Chain+Nuclear, +15x vs Boss, -10 HP", "Quase Morte", t => { 
                t.flags.add('void'); t.flags.add('chain'); t.flags.add('nuclear'); 
                t.chainTargets += 10; t.modDmg += 11.0; 
                t.bossKiller = true;
                if (!t.isPreview) { hp -= 10; updateUI(); if(hp<=0) gameOver=true; } 
            })
        ];
        demonicCards.forEach(c => { c.alignment = 'demonic'; arcanasPool.push(c); });

        ['Monges Orantes','Noviço Fervoroso','Monges Veteranos','Ordem do Mosteiro','Abade Iluminado'].forEach(n => { const c = arcanasPool.find(x => x.name === n); if (c) c.isMonk = true; });
        arcanasPool.find(c => c.name === "Arcanjo Guardião").exclusive = true;
        arcanasPool.find(c => c.name === "Senhor do Abismo").exclusive = true;

        const pixelColors = { common: '#f8fafc,#f1f5f9,#cbd5e1', rare: '#e0f2fe,#7dd3fc,#0ea5e9', epic: '#f3e8ff,#d8b4fe,#a855f7', legendary: '#fef08a,#fde047,#eab308' };

        function updateShopAffordability() {
            document.querySelectorAll('.card-wrapper').forEach(wrapper => {
                if(wrapper.classList.contains('bought')) return; 
                let cost = parseInt(wrapper.dataset.cost);
                let costEl = wrapper.querySelector('.card-cost-text');
                let cardEl = wrapper.querySelector('.card');
                
                if(gold < cost) {
                    if(costEl) costEl.style.color = '#ef4444';
                    if(cardEl) { cardEl.style.opacity = '0.5'; cardEl.style.filter = 'grayscale(80%)'; }
                } else {
                    if(costEl) costEl.style.color = '#eab308';
                    if(cardEl) { cardEl.style.opacity = '1'; cardEl.style.filter = 'none'; }
                }
            });
            let rBtn = document.getElementById('reroll-btn'); 
            if (rBtn) rBtn.disabled = gold < rerollCost;
            
            let lBox = document.getElementById('lootbox-btn');
            if (lBox) {
                if(gold < 120) { lBox.style.opacity = '0.5'; lBox.style.filter = 'grayscale(100%)'; }
                else { lBox.style.opacity = '1'; lBox.style.filter = 'none'; }
            }
        }

        function rollRarity() {
            let waveProgress = Math.min(1.0, (wave - 1) / 20); 

            let baseLeg  = 0.02 + waveProgress * 0.08;  
            let baseEpic = 0.08 + waveProgress * 0.14;  
            let baseRare = 0.25 + waveProgress * 0.15;  

            let pLeg  = Math.min(0.35, baseLeg  + shopMods.legendBonusChance + (shopMods.highLegendChance ? 0.25 : 0));
            let pEpic = Math.min(0.45, baseEpic + shopMods.epicBonusChance);
            let pRare = Math.min(0.55, baseRare + shopMods.rareBonusChance);

            if(shopMods.onlyRarePlus) {
                pRare = Math.max(pRare, 0.50);
                pLeg  = Math.max(pLeg,  0.08);
                pEpic = Math.max(pEpic, 0.20);
            }

            let roll = Math.random();
            if(roll < pLeg)                      return "legendary";
            if(roll < pLeg + pEpic)              return "epic";
            if(roll < pLeg + pEpic + pRare)      return "rare";
            return "common";
        }

        function getCardCost(card, baseCost) {
            let disc = Math.max(shopMods.priceReduction, shopMods.wavesDiscount > 0 ? shopMods.waveDiscountAmt : 0);
            return Math.max(5, Math.round(baseCost * (1 - disc)));
        }

        function renderShopCards() {
            const container = document.getElementById('all-cards'); 
            if(!container) return;
            container.querySelectorAll('.card-wrapper').forEach(w => {
                let cEl = w.querySelector('.card');
                if(cEl && cEl._pixelDestroy) cEl._pixelDestroy();
            });
            container.innerHTML = '';
            
            let isDualChoice = Math.random() > 0.5; 
            let numIndependent = isDualChoice ? 3 : 5; 
            let dualPicked = false;

            let guaranteeSlot = shopMods.guaranteeRare ? Math.floor(Math.random() * numIndependent) : -1;

            function createShopCard(parent, isDual, delay, dualGroupArr, forceMinRarity) {
                let r = rollRarity();
                if(forceMinRarity === 'rare' && (r === 'common')) r = 'rare';
                
                let card;
                let forcedPill = false;
                if (r === 'common' && !forceMinRarity && Math.random() < 0.25) {
                    card = arcanasPool.find(c => c.isPill);
                    forcedPill = true;
                }
                if (!card) {
                    let isEconCard = (r === 'common' || r === 'rare') && Math.random() < 0.18;
                    let basePool = isEconCard
                        ? arcanasPool.filter(c => c.isEcon && c.rarity === r)
                        : arcanasPool.filter(c => c.rarity === r && !c.isPill && !c.isApple && !c.isEcon && !(c.isDur && window.MP && window.MP.active));

                    let pool = basePool.filter(c => {
                        let totalAlign = Math.max(1, alignmentLight + alignmentDark);
                        let lightPct = alignmentLight / totalAlign;
                        let darkPct = alignmentDark / totalAlign;

                        if (c.exclusive) {
                            if (c.alignment === 'angelic' && lightPct < 0.8) return false;
                            if (c.alignment === 'demonic' && darkPct < 0.8) return false;
                        }

                        if (c.alignment === 'angelic' && Math.random() < darkPct * 0.85) return false;
                        if (c.alignment === 'demonic' && Math.random() < lightPct * 0.85) return false;

                        return true;
                    });

                    if(!pool.length) pool = basePool; 
                    if(!pool.length) pool = arcanasPool.filter(c => c.rarity === r && !c.isPill);
                    card = pool.length ? pool[Math.floor(Math.random() * pool.length)] : arcanasPool[0];
                    if (!isEconCard && Math.random() < 0.15) { const mk = arcanasPool.filter(c => c.isMonk && c.rarity === r); if (mk.length) card = mk[Math.floor(Math.random() * mk.length)]; }   // reforço: monges aparecem mais
                }
                if(!card) return null;

                let wrapper = document.createElement('div');
                wrapper.className = `card-wrapper ${r} targeting-trigger`;
                if (isDual) { wrapper.style.width = '200px'; wrapper.style.height = '295px'; }

                let baseCost = card.isPill ? 10 : 20;
                let cardCost = getCardCost(card, baseCost);
                wrapper.dataset.cost = cardCost;

                let alignStr = '';
                let titleColor = `var(--${r})`;
                let iconColor = `var(--${r})`;
                let pColors = pixelColors[r]; 
                let glowHtml = '';

                if (card.alignment === 'angelic') {
                    alignStr = ' + ANGELICAL';
                    titleColor = '#fef08a'; 
                    iconColor = '#fde047';
                    pColors = '#ffffff,#fef08a,#fde047'; 
                    glowHtml = '<div class="alignment-glow angelic"></div>';
                } else if (card.alignment === 'demonic') {
                    alignStr = ' + DEMONÍACA';
                    titleColor = '#fca5a5'; 
                    iconColor = '#ef4444'; 
                    pColors = '#ef4444,#dc2626,#7f1d1d'; 
                    glowHtml = '<div class="alignment-glow demonic"></div>';
                }

                wrapper.innerHTML = `
                    <div class="card ${r}">
                        ${glowHtml} 
                        <canvas class="pixel-canvas"></canvas>
                        <div style="display: flex; flex-direction: column; width: 100%; height: 100%; position: relative; z-index: 2;">
                            
                            <div class="card-header" style="color: ${titleColor}; font-size: 18px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">${card.name}</div>
                            
                            <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                                <div class="card-icon" style="color: ${iconColor}; font-size: 45px; margin: 10px auto 15px; text-shadow: 0 0 15px rgba(0,0,0,0.8);">${card.icon}</div>
                                <div class="card-desc" style="font-size: 13px; line-height: 1.2; padding: 0 5px; flex-grow: 0; margin-bottom: 15px;">"${card.desc}"</div>
                                <div class="card-stats" style="font-size: 13px; gap: 4px; margin-bottom: 0;">
                                    <div class="card-buff">▲ ${card.buff}</div>
                                    <div class="card-debuff">▼ ${card.debuff}</div>
                                </div>
                            </div>

                            <div style="margin-top: 0; display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                <div style="font-size: 10px; text-transform: uppercase; font-weight: bold; letter-spacing: 2px; color: var(--${r});">${r}${alignStr}</div>
                                <div class="card-cost-text" style="font-weight: bold; color: #eab308; font-size: 18px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${cardCost}g</div>
                            </div>
                        </div>
                    </div>
                `;
                
                if (delay >= 0) wrapper.style.animationDelay = `${delay}s`;
                parent.appendChild(wrapper);

                if(r === 'legendary') {
                    setTimeout(() => {
                        let flash = document.createElement('div');
                        flash.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle,rgba(255,180,0,.18),transparent 70%);pointer-events:none;z-index:999;opacity:0;transition:opacity .3s';
                        document.body.appendChild(flash);
                        requestAnimationFrame(()=>{ flash.style.opacity='1'; setTimeout(()=>{ flash.style.opacity='0'; setTimeout(()=>flash.remove(),400); },300); });
                    }, (delay||0)*1000 + 200);
                }

                if (typeof applyTiltedCardEffect === 'function') applyTiltedCardEffect(wrapper, 8, 1.05); 
                let canvasEl = wrapper.querySelector('.pixel-canvas');
                if (canvasEl) initPixelCard(wrapper, canvasEl, pColors);
                
                wrapper.onclick = () => { 
                    if (window.nxBlock && nxBlock('shop')) return;
                    if (isDual && dualPicked) { 
                        SFX.ui_error(); 
                        if(typeof applyShake === 'function') applyShake(3); 
                        return; 
                    }
                    if (gold >= cardCost) {
                        SFX.ui_click();
                        gold -= cardCost; 
                        
                        if(card.alignment === 'angelic') alignmentLight++;
                        if(card.alignment === 'demonic') alignmentDark++;
                        
                        updateUI();
                        playerHand.push(card); 
                        renderHand();
                        
                        if(isDual && dualGroupArr) {
                            dualPicked = true;
                            dualGroupArr.forEach(dc => {
                                if(dc !== wrapper && dc) {
                                    dc.style.pointerEvents = 'none'; 
                                    let cCard = dc.querySelector('.card');
                                    if(cCard) { cCard.style.opacity = '0.3'; cCard.style.filter = 'grayscale(100%)'; }
                                    dc.insertAdjacentHTML('beforeend', '<div class="blocked-stamp">BLOQUEADO</div>');
                                }
                            });
                        }
                        
                        wrapper.classList.add('bought');
                        wrapper.insertAdjacentHTML('beforeend', '<div class="bought-stamp">COMPRADO</div>');
                        updateShopAffordability();
                    } else {
                        SFX.ui_error();
                        if(typeof flashGold === 'function') flashGold(); 
                        if(typeof applyShake === 'function') applyShake(5);
                    }
                };
                return wrapper;
            }

            for(let i = 0; i < numIndependent; i++) {
                let minR = (i === guaranteeSlot) ? 'rare' : null;
                createShopCard(container, false, i * 0.1, null, minR);
            }

            if (isDualChoice) {
                let dc = document.createElement('div');
                dc.style.cssText = `
                    display: flex; gap: 12px; align-items: center;
                    padding: 30px 16px 16px 16px; 
                    border: 3px dashed #fde047;
                    border-radius: 20px; position: relative;
                    background: rgba(253, 224, 71, 0.05);
                    animation: cardEnter 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards;
                    animation-delay: ${numIndependent * 0.1}s;
                    flex-shrink: 0;
                    height: 360px; box-sizing: border-box;
                `;
                
                let badge = document.createElement('div'); 
                badge.innerHTML = '<i class="fa-solid fa-code-branch"></i> ESCOLHA APENAS UMA';
                badge.style.cssText = "position:absolute; top:-16px; left:50%; transform:translateX(-50%); background:#eab308; color:#000; padding:6px 18px; font-weight:900; border-radius:10px; font-size:13px; z-index:10; box-shadow: 0 5px 15px rgba(0,0,0,0.6); white-space: nowrap;";
                dc.appendChild(badge);

                let dualGroup = [];
                let c1 = createShopCard(dc, true, 0, dualGroup, null); 
                let c2 = createShopCard(dc, true, 0, dualGroup, null);
                if(c1) dualGroup.push(c1); if(c2) dualGroup.push(c2);
                container.appendChild(dc);
            }
            
            let rCost = document.getElementById('reroll-cost'); if (rCost) rCost.innerText = rerollCost;
            updateShopAffordability();
            if(typeof updateCursorTargeting === 'function') updateCursorTargeting();
            requestAnimationFrame(() => recalcShopScale());
        }

        function buyLootbox() {
            if(gold >= 120) {
                SFX.ui_click();
                gold -= 120; updateUI();
                document.getElementById('shop-overlay').classList.remove('active');
                
                let modal = document.getElementById('lootbox-modal');
                modal.style.display = 'flex';
                void modal.offsetWidth;
                modal.classList.add('visible');

                document.getElementById('lootbox-result').style.display = 'none';
                document.getElementById('lootbox-title').style.display = 'block';
                let chest = document.getElementById('lootbox-chest');
                chest.style.display = 'block'; 
                chest.className = 'fa-solid fa-box lootbox-chest targeting-trigger';
                chest.style.transform = ''; chest.style.opacity = '1'; chest.style.pointerEvents = 'all';
                document.getElementById('lootbox-close').style.display = 'none';
            } else { 
                SFX.ui_error();
                flashGold(); 
                applyShake(5); 
            }
        }

        function openLootbox() {
            SFX.ui_click();
            let chest = document.getElementById('lootbox-chest');
            document.getElementById('lootbox-title').style.display = 'none';
            chest.style.pointerEvents = 'none';
            chest.style.transition = 'transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            chest.style.transform = 'scale(1.3)';
            chest.classList.add('lootbox-shake'); applyShake(10);
            
            let flash = document.createElement('div');
            flash.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:#fff;opacity:0;z-index:999;pointer-events:none;transition:opacity 0.12s ease-in;";
            document.getElementById('lootbox-modal').appendChild(flash);
            
            setTimeout(() => {
                flash.style.opacity = '1';
                chest.classList.remove('lootbox-shake'); 
                chest.className = 'fa-solid fa-box-open lootbox-chest';
                chest.style.transform = 'scale(2.5)'; applyShake(25);
                SFX.card_drop(); // som de impacto do baú
                
                setTimeout(() => {
                    flash.style.transition = 'opacity 0.8s ease-out';
                    flash.style.opacity = '0';
                    chest.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
                    chest.style.transform = 'scale(3)';
                    chest.style.opacity = '0';
                    
                    let roll = Math.random(); let r = "rare";
                    if(roll > 0.90) r = "legendary"; else if(roll > 0.60) r = "epic";
                    let opts = arcanasPool.filter(c => c.rarity === r);
                    let card = opts.length ? opts[Math.floor(Math.random() * opts.length)] : arcanasPool[0];
                    playerHand.push(card); renderHand();

                    setTimeout(() => {
                        chest.style.display = 'none';
                        let resultDiv = document.getElementById('lootbox-result');
                        resultDiv.style.display = 'block';
                        resultDiv.innerHTML = `
                            <div style="font-size:110px; color:var(--${r}); animation: iconReveal 0.7s cubic-bezier(0.175,0.885,0.32,1.275) forwards, rarityPulse 2s ease-in-out 0.7s infinite; margin-bottom: 24px;">
                                ${card.icon}
                            </div>
                            <div style="color:var(--${r}); font-size:28px; font-weight:900; letter-spacing:2px; text-transform:uppercase;
                                        animation: stampIn 0.6s cubic-bezier(0.175,0.885,0.32,1.275) 0.3s both;">
                                ${card.name}
                            </div>
                            <div style="color:#a1a1aa; font-size:15px; margin-top:8px; font-style:italic;
                                        animation: stampIn 0.5s ease 0.55s both; opacity:0;">
                                "${card.desc}"
                            </div>
                            <div style="color:var(--${r}); font-size:12px; font-weight:bold; letter-spacing:3px; text-transform:uppercase; margin-top:12px;
                                        animation: stampIn 0.4s ease 0.7s both; opacity:0;">
                                ${r}
                            </div>`;
                        document.getElementById('lootbox-close').style.display = 'block';
                        document.getElementById('lootbox-close').style.animation = 'stampIn 0.4s ease 0.9s both';
                        document.getElementById('lootbox-close').style.opacity = '0';
                        setTimeout(() => flash.remove(), 1000);
                    }, 400);
                }, 200);
            }, 1200);
        }

        function closeLootbox() {
            SFX.ui_click();
            let modal = document.getElementById('lootbox-modal');
            modal.classList.remove('visible');
            setTimeout(() => { modal.style.display = 'none'; }, 400);
            document.getElementById('shop-overlay').classList.add('active'); 
            updateShopAffordability(); 
        }

        function calcAdaptiveDifficulty() {
            if (waveTotalEnemyHp > 0) {
                let dmgPressure  = waveEnemyDmgDealt / Math.max(1, waveStartHp);
                let killPressure = waveEnemyHpKilled  / Math.max(1, waveTotalEnemyHp);

                let delta = 0;
                if      (dmgPressure === 0)      delta += 0.030;
                else if (dmgPressure < 0.10)     delta += 0.010;
                else if (dmgPressure >= 0.15)    delta -= 0.030;

                if (killPressure >= 0.80 && dmgPressure < 0.05)  delta += 0.025;
                else if (killPressure >= 0.90)                    delta += 0.012;
                else if (killPressure < 0.40)                     delta -= 0.015;

                let waveFloor = 1.0 + Math.max(0, wave - 5) * 0.008;
                adaptiveMult = Math.max(waveFloor, Math.min(1.6, adaptiveMult + delta));
                adaptiveMult = Math.round(adaptiveMult * 1000) / 1000;
            }
            waveTotalEnemyHp = 0; waveEnemyDmgDealt = 0; waveEnemyHpKilled = 0;
        }

        function showShop() {
            calcAdaptiveDifficulty();
            if(gameOver) {
                let overlay = document.getElementById('shop-overlay');
                if(overlay) overlay.classList.remove('active');
                isShopOpen = false; waveActive = false;
                return;
            }
            waveActive = false; rerollCost = 15; 
            try { renderShopCards(); } catch (error) { console.error("Erro renderizando loja:", error); }
            let overlay = document.getElementById('shop-overlay'); if (overlay) overlay.classList.add('active'); 
            isShopOpen = true;
            let btn = document.getElementById('btn-start-wave'); if (btn) { btn.disabled = false; btn.innerText = "INICIAR ONDA " + (wave + 1); }
        }

        function flashGold() { let el = document.getElementById('gold'); el.classList.add('error-flash'); setTimeout(() => el.classList.remove('error-flash'), 300); }

        function rerollShop() {
            let cost = Math.round(rerollCost * (1 - shopMods.rerollDiscount));
            if(gold >= cost) { 
                SFX.ui_click();
                gold -= cost; rerollCost += 10; statRerolls++; shopMods.rerollDiscount = 0; updateUI(); renderShopCards(); 
            } else { 
                SFX.ui_error();
                flashGold(); applyShake(3); 
            }
        }

        function buildSpawnQueue(w) {
            let isBossWave = w >= 5 && w % 5 === 0;
            let count = Math.floor((5 + (w * 4.5)) * Math.pow(adaptiveMult, 0.55));
            if(w === 1) count = 5;
            if(isBossWave) count = Math.max(4, Math.floor(count * 0.65));

            let queue = [];
            for(let i = 0; i < count; i++) queue.push(rollEnemyType(w));

            if(isBossWave) {
                let mid = Math.floor(queue.length / 2);
                queue.splice(mid, 0, 'boss');
            }
            if(w >= 15 && w % 15 === 0) {   // Boss Demolidor: a cada 15 ondas
                queue.splice(Math.floor(queue.length / 3), 0, 'demolisher');
            }
            return queue;
        }

        function closeShop() {
            SFX.ui_click();
            document.getElementById('shop-overlay').classList.remove('active'); isShopOpen = false;
            wave++;
            if (wave % 10 === 0) sellTokens++;
            tickShopMods();
            spawnQueue = buildSpawnQueue(wave);
            enemiesToSpawn = spawnQueue.length;
            spawnTimer = 0; updateUI(); renderHand();
            if(autoWave) setTimeout(startNextWave, 500);
        }
        function _internalShowShopOrSkip() {
            if(autoWave && skipShop) { calcAdaptiveDifficulty(); closeShop(); }
            else { showShop(); }
        }

        function startNextWave() {
            SFX.ui_click(); fxBanner('⚔ ONDA ' + wave + ' ⚔', '#fde047');
            waveStartHp = hp; waveActive = true;
            document.getElementById('btn-start-wave').disabled = true;
            document.getElementById('btn-start-wave').innerText = "ONDA EM PROGRESSO...";
            updateUI();
            if(wave >= 15 && wave % 15 === 0) {
                setTimeout(() => {
                    floatingTexts.push(new FloatingText(canvas.width / 2, canvas.height * 0.22, `⚠ WAVE ${wave} — BOSS DEMOLIDOR ⚠`, '#dc2626', true));
                    applyShake(10);
                }, 900);
            }
            if(wave >= 5 && wave % 5 === 0) {
                setTimeout(() => {
                    floatingTexts.push(new FloatingText(canvas.width / 2, canvas.height * 0.3, `⚠ WAVE ${wave} — BOSS ⚠`, '#f97316', true));
                    applyShake(8);
                }, 300);
            }
        }

        function giveUp() {
            SFX.ui_click();
            let modal = document.getElementById('giveup-overlay');
            modal.style.display = 'flex';
            void modal.offsetWidth; 
            modal.style.opacity = '1';
        }

        function cancelGiveUp() {
            SFX.ui_click();
            let modal = document.getElementById('giveup-overlay');
            modal.style.opacity = '0';
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        }

        function confirmGiveUp() {
            SFX.ui_click();
            cancelGiveUp();
            hp = 0;
            gameOver = true;
            updateUI();
        }

        function toggleAutoWave() {
            SFX.ui_click();
            autoWave = !autoWave;
            let btn = document.getElementById('btn-auto-wave');
            btn.innerText = autoWave ? 'AUTO-WAVE: ON' : 'AUTO-WAVE: OFF';
            if(autoWave) btn.classList.add('on'); else btn.classList.remove('on');
            
            let skipBtn = document.getElementById('btn-skip-shop');
            if(autoWave) { 
                skipBtn.classList.add('visible'); 
            } else { 
                skipShop = false; 
                skipBtn.innerText = 'PULAR LOJA: OFF'; 
                skipBtn.classList.remove('on'); 
                skipBtn.classList.remove('visible'); 
            }
            syncSpeedBtn();
        }
        function toggleSkipShop() {
            SFX.ui_click();
            skipShop = !skipShop;
            let btn = document.getElementById('btn-skip-shop');
            btn.innerText = skipShop ? 'PULAR LOJA: ON' : 'PULAR LOJA: OFF';
            if(skipShop) btn.classList.add('on'); else btn.classList.remove('on');
            syncSpeedBtn();
        }
        function toggleSpeed() {
            if(!(autoWave && skipShop)) return;
            SFX.ui_click(); gameSpeed = gameSpeed === 1 ? 2 : 1; syncSpeedBtn();
        }
        function syncSpeedBtn() {   // botão 2x só aparece com Pular Loja ligado; ao desligar, volta pra 1x
            let b = document.getElementById('btn-speed'); if(!b) return;
            const ok = autoWave && skipShop;
            if(!ok) gameSpeed = 1;
            b.innerText = 'VELOCIDADE: ' + gameSpeed + 'x';
            b.classList.toggle('visible', ok); b.classList.toggle('on', ok && gameSpeed === 2);
        }

        function initMenu() {
            try {
                const list = document.getElementById('tower-list'); 
                if(!list) return;
                list.innerHTML = '';
                Object.keys(towerTypes).forEach(k => {
                    let t = towerTypes[k]; let d = document.createElement('div');
                    d.className = `tower-option targeting-trigger ${k===selectedTowerKey?'active':''}`;
                    d.innerHTML = `<span class="tower-name">${t.name}</span><span class="tower-cost">${t.cost} Ouro</span>`;
                    d.onclick = () => { 
                        SFX.ui_click();
                        selectedTowerKey = k; 
                        initMenu(); 
                    };

                    let tipTimer = null;
                    d.addEventListener('mouseenter', () => {
                        tt._sidebarOwned = true;
                        tipTimer = setTimeout(() => {
                            let dps = (t.damage * (60 / t.fireRate)).toFixed(1);
                            tt.innerHTML = `<b style="color:${t.color}; font-size:16px;">${t.icon} ${t.name}</b>
                                <hr style="border-color:#27272a; margin:8px 0;">
                                <span style="color:#e2e8f0">Dano:</span> <span style="color:#ef4444; font-weight:bold;">${t.damage}</span><br>
                                <span style="color:#e2e8f0">Alcance:</span> <span style="color:#38bdf8; font-weight:bold;">${t.range}</span><br>
                                <span style="color:#e2e8f0">Disparos:</span> <span style="color:#22c55e; font-weight:bold;">${(60/t.fireRate).toFixed(1)}/s</span><br>
                                <span style="color:#e2e8f0">DPS Base:</span> <span style="color:#fde047; font-weight:bold;">${dps}</span><br>
                                <span style="color:#e2e8f0">Custo:</span> <span style="color:#eab308; font-weight:bold;">${t.cost}g</span>`;
                            let rect = d.getBoundingClientRect();
                            tt.style.left = (rect.right + 12) + 'px';
                            tt.style.top  = (rect.top) + 'px';
                            tt.classList.add('visible');
                        }, 150);
                    });
                    d.addEventListener('mouseleave', () => {
                        clearTimeout(tipTimer); tipTimer = null;
                        tt._sidebarOwned = false;
                        tt.classList.remove('visible');
                    });

                    list.appendChild(d);
                });
                if(typeof updateCursorTargeting === 'function') updateCursorTargeting();
            } catch(e) { console.error("O Menu quebrou: ", e); }
        }

        const _ui = {};
        function _setTxt(id, val) {
            let rec = _ui[id];
            if (!rec) { const el = document.getElementById(id); if (!el) return; rec = _ui[id] = { el, v: undefined, c: undefined }; }
            if (rec.v !== val) { rec.v = val; rec.el.textContent = val; }
        }
        function updateUI() {
            _setTxt('hp', Math.max(0, Math.floor(hp)));
            _setTxt('gold', gold);
            _setTxt('wave', wave);
            _setTxt('align-light', alignmentLight);
            _setTxt('align-dark', alignmentDark);

            let elDiff = document.getElementById('diff-indicator');
            if(elDiff) {
                let pct = Math.round((adaptiveMult - 1) * 100);
                let txt, col;
                if      (pct < -10) { txt = 'Fácil (' + pct + '%)';     col = '#22c55e'; }
                else if (pct < 20)  { txt = 'Normal';                    col = '#a1a1aa'; }
                else if (pct < 60)  { txt = 'Difícil (+' + pct + '%)';  col = '#f97316'; }
                else                { txt = 'Brutal (+' + pct + '%)';   col = '#ef4444'; }
                if (elDiff.textContent !== txt) elDiff.textContent = txt;
                if (elDiff.style.color !== col && _ui._diffCol !== col) { elDiff.style.color = col; _ui._diffCol = col; }
            }
            let expansionsAvailable = Math.floor(wave / 5) - expansionsUsed;
            _setTxt('expansions', Math.max(0, expansionsAvailable));
            _setTxt('sells', sellTokens);
            if(hp <= 0) { const elHp = document.getElementById('hp'); if(elHp) elHp.classList.add('danger'); }
            _setTxt('shop-gold-val', gold);
        }

        window.addEventListener('mousemove', e => {
            if(isTutorialActive || isShopOpen || dragElement || e.clientX < nxSideW()) {
                hoverGridX = -1; hoverGridY = -1;
                if(e.clientX >= nxSideW()) tt.classList.remove('visible');
                window.lastHoveredTower = null; return; 
            }
            let p = screenToGrid(e.clientX, e.clientY); hoverGridX = p.x; hoverGridY = p.y;

            if (e.target === canvas) {
                let hoveredTower = towers.find(t => t.gridX === hoverGridX && t.gridY === hoverGridY);
                if (hoveredTower && !dragElement) {
                    if (window.lastHoveredTower !== hoveredTower) {
                        window.lastHoveredTower = hoveredTower;
                        let effectsHtml = '';
                        if(hoveredTower.effects.length > 0) {
                            effectsHtml = `<div style="margin-top: 15px; border-top: 1px solid #3f3f46; padding-top: 15px; font-size: 15px; line-height: 1.6; text-align: left;">
                                ${hoveredTower.effects.map(ef => `<span style="color:${rarityColors[ef.rarity]}"><i class="fa-solid fa-circle-dot" style="font-size:10px; margin-right:5px;"></i> ${ef.name}</span>`).join('<br>')}
                            </div>`;
                        }
                        
                        let realDps = (hoveredTower.damage * (60 / hoveredTower.fireRate)) * (1 + (hoveredTower.critChance * (hoveredTower.critDamage - 1)));

                        tt.innerHTML = `<b style="color:${hoveredTower.color}; font-size: 16px;">${towerTypes[hoveredTower.type].name} (Lv.${hoveredTower.level})</b><hr style="border-color:#27272a; margin:8px 0;">
                        <span style="color:#e2e8f0">Dano:</span> <span style="color:#ef4444; font-weight:bold;">${hoveredTower.damage.toFixed(1)}</span><br>
                        <span style="color:#e2e8f0">Alcance:</span> <span style="color:#38bdf8; font-weight:bold;">${hoveredTower.range.toFixed(1)}</span><br>
                        <span style="color:#e2e8f0">Disparos:</span> <span style="color:#22c55e; font-weight:bold;">${(60/hoveredTower.fireRate).toFixed(1)}/s</span><br>
                        <span style="color:#e2e8f0">Crit:</span> <span style="color:#fde047; font-weight:bold;">${(hoveredTower.critChance*100).toFixed(0)}% (${hoveredTower.critDamage.toFixed(1)}x)</span><br>
                        <span style="color:#e2e8f0">DPS Real:</span> <span style="color:#c084fc; font-weight:bold;">${realDps.toFixed(1)}</span><br>
                        <div id="tt-dur" style="margin-top:6px;">${durHtml(hoveredTower)}</div>
                        <br><span style="color:#eab308; font-size:12px; font-weight:bold; letter-spacing:1px;">EFEITO: ${hoveredTower.attackType.toUpperCase()}</span>
                        ${effectsHtml}`;
                    }
                    tt.classList.add('visible'); tt.style.left = (e.clientX + 15) + 'px'; tt.style.top = (e.clientY + 15) + 'px';
                } else if (hoveredTower && dragElement && draggingCardIndex >= 0) {
                    let card = playerHand[draggingCardIndex];
                    if(card && !card.isPill && !card.isApple && !card.isEcon && (card.healsDur || card.isMonk || hoveredDropTower.effectCount < 3) && !cardRepeatBlocked(hoveredDropTower, card)) {
                        let after = previewCardStats(hoveredDropTower, card);
                        let b = hoveredTower; 

                        function deltaSpan(before, after, invert) {
                            let diff = after - before;
                            if(Math.abs(diff) < 0.001) return '';
                            let positive = invert ? diff < 0 : diff > 0;
                            let sign = diff > 0 ? '+' : '';
                            let col = positive ? '#22c55e' : '#ef4444';
                            return ` <span style="color:${col};font-size:12px;font-weight:bold;">(${sign}${diff.toFixed(1)})</span>`;
                        }
                        function deltaPct(before, after, invert) {
                            if(Math.abs(before) < 0.001) return '';
                            let pct = ((after - before) / before) * 100;
                            if(Math.abs(pct) < 0.1) return '';
                            let positive = invert ? pct < 0 : pct > 0;
                            let sign = pct > 0 ? '+' : '';
                            let col = positive ? '#22c55e' : '#ef4444';
                            return ` <span style="color:${col};font-size:12px;font-weight:bold;">(${sign}${pct.toFixed(0)}%)</span>`;
                        }

                        let bDps = (b.damage * (60 / b.fireRate)) * (1 + b.critChance * (b.critDamage - 1));
                        let aDps = (after.damage * (60 / after.fireRate)) * (1 + after.critChance * (after.critDamage - 1));
                        let bShots = 60 / b.fireRate;
                        let aShots = 60 / after.fireRate;

                        let newFlags = [...after.flags].filter(f => !b.flags.has(f));
                        let flagsHtml = newFlags.length ? `<br><span style="color:#a78bfa;font-size:12px;">✦ ${newFlags.join(', ')}</span>` : '';

                        tt.innerHTML = `<b style="color:${b.color}; font-size:16px;">${towerTypes[b.type].name} (Lv.${b.level})</b>
                            <span style="background:${rarityColors[card.rarity]}22;border:1px solid ${rarityColors[card.rarity]}55;color:${rarityColors[card.rarity]};font-size:10px;font-weight:bold;padding:2px 7px;border-radius:10px;margin-left:6px;vertical-align:middle;">${card.name}</span>
                            <hr style="border-color:#27272a; margin:8px 0;">
                            <span style="color:#e2e8f0">Dano:</span> <span style="color:#ef4444;font-weight:bold;">${b.damage.toFixed(1)}</span>${deltaSpan(b.damage, after.damage, false)}<br>
                            <span style="color:#e2e8f0">Alcance:</span> <span style="color:#38bdf8;font-weight:bold;">${b.range.toFixed(1)}</span>${deltaSpan(b.range, after.range, false)}<br>
                            <span style="color:#e2e8f0">Disparos:</span> <span style="color:#22c55e;font-weight:bold;">${bShots.toFixed(1)}/s</span>${deltaPct(bShots, aShots, false)}<br>
                            <span style="color:#e2e8f0">Crit:</span> <span style="color:#fde047;font-weight:bold;">${(b.critChance*100).toFixed(0)}%</span>${deltaSpan(b.critChance*100, after.critChance*100, false)}<br>
                            <span style="color:#e2e8f0">DPS Real:</span> <span style="color:#c084fc;font-weight:bold;">${bDps.toFixed(1)}</span>${deltaSpan(bDps, aDps, false)}
                            ${flagsHtml}`;
                        window.lastHoveredTower = null; 
                        tt.classList.add('visible');
                        tt.style.left = (e.clientX + 15) + 'px';
                        tt.style.top  = (e.clientY + 15) + 'px';
                    }
                } else if(!hoverTimer) { window.lastHoveredTower = null; if(!tt._sidebarOwned) tt.classList.remove('visible'); }
            }
        });

        window.addEventListener('mousedown', e => {
            if(menuActive || isTutorialActive || gameOver) { return; }
            if(e.target && e.target.closest && e.target.closest('#splash,.nx-modal,#nx-dlg,#nx-task,#giveup-overlay,#gameover-overlay,#lootbox-modal,#shop-overlay,#hand-container,.hand-arrow,#hand-prog,#audio-controls-wrapper,#cheat-panel,#cat-modal,#nx-mini,#nx-rotate,#sidebar,#nx-meta-btn,#nx-meta-modal,#team-modal,#tooltip')) return;
            if(e.button !== 0) return; 
            if(isShopOpen || dragElement || e.clientX < nxSideW()) return;
            if(document.getElementById('giveup-overlay') && document.getElementById('giveup-overlay').style.display === 'flex') return;
            let pos = screenToGrid(e.clientX, e.clientY);
            
            let clickedLock = getLocks().find(l => l.gx === pos.x && l.gy === pos.y);
            if(clickedLock) {
                if(waveActive) {
                    SFX.ui_error();
                    let cx = canvas.width/2; let cy = canvas.height/2; let screenPos = cartToIso(pos.x, pos.y);
                    let screenX = (screenPos.x - cx) * zoom + cx; let screenY = (screenPos.y - cy) * zoom + cy;
                    floatingTexts.push(new FloatingText(screenX, screenY, "EM COMBATE!", '#ef4444')); applyShake(4);
                } else { expandMap(clickedLock.dir, clickedLock.gx, clickedLock.gy); } return;
            }
            
            const _bt = towers.find(t => t.gridX === pos.x && t.gridY === pos.y);
            if (_bt && _bt.dur <= 0) { if (window.nxBlock && nxBlock('repair')) return; repairTower(_bt); return; }   // torre quebrada: conserta (custo normal + 10)

            if(pos.y >= 0 && pos.y < map.length && pos.x >= 0 && pos.x < map[0].length && map[pos.y][pos.x] === 0) {
                if(waveActive) {
                    SFX.ui_error();
                    let p = cartToIso(pos.x, pos.y); let cx = canvas.width/2; let cy = canvas.height/2;
                    let screenX = (p.x - cx) * zoom + cx; let screenY = (p.y - cy) * zoom + cy; 
                    floatingTexts.push(new FloatingText(screenX, screenY, "EM COMBATE!", '#ef4444')); applyShake(4); return;
                }

                if(!towers.some(t => t.gridX === pos.x && t.gridY === pos.y)) {
                    if(window.nxBlock && nxBlock('build')) return;
                    let cost = towerTypes[selectedTowerKey].cost;
                    if(gold >= cost) { 
                        SFX.build();
                        gold -= cost; towers.push(new Tower(pos.x, pos.y, selectedTowerKey));
                        statTowersBuilt++;
                        createParticles(pos.x, pos.y, '#71717a', 15); applyShake(3); updateUI(); 
                    } else {
                        SFX.ui_error();
                        let p = cartToIso(pos.x, pos.y); let cx = canvas.width/2; let cy = canvas.height/2;
                        let screenX = (p.x - cx) * zoom + cx; let screenY = (p.y - cy) * zoom + cy; 
                        floatingTexts.push(new FloatingText(screenX, screenY, "SEM OURO!", '#ef4444')); flashGold(); applyShake(5);
                    }
                }
            }
        });

        // ── LOOP PRINCIPAL: passo fixo de lógica (mesma velocidade de antes) + render sincronizado com a tela ──
        const STEP_MS = 16;
        let _lastFrameT = performance.now(), _acc = 0, _shopSkip = 0;
        function mainFrame(now) {
            requestAnimationFrame(mainFrame);
            let dt = now - _lastFrameT; _lastFrameT = now;
            if (dt > 250) dt = STEP_MS;              // voltou de outra aba / travou: não "acelera" o jogo
            const _spd = (autoWave && skipShop) ? gameSpeed : 1;   // 2x só com Pular Loja ativo
            _acc += dt * _spd;
            let steps = 0;
            while (_acc >= STEP_MS && steps < 3 * _spd) { if (!menuActive || (window.MP && window.MP.active)) gameUpdate(); _acc -= STEP_MS; steps++; }
            if (_acc >= STEP_MS) _acc = 0;           // PC não acompanha: o jogo desacelera em vez de entrar em espiral
            if (steps > 0 && !menuActive && (!isShopOpen || (++_shopSkip % 3 === 0))) gameRender();   // loja aberta = só 1/3 dos frames (fundo quase invisível)
            adaptQuality(dt);
        }
        requestAnimationFrame(mainFrame);
        
        function drawTile(gx, gy, type, hovered) {
            let p = cartToIso(gx, gy);
            ctx.fillStyle = type === 1 ? '#0a0a0a' : '#022c22'; 
            ctx.beginPath(); ctx.moveTo(p.x - TILE_W/2, p.y); ctx.lineTo(p.x, p.y + TILE_H/2); ctx.lineTo(p.x, p.y + TILE_H/2 + 10); ctx.lineTo(p.x - TILE_W/2, p.y + 10); ctx.fill();
            ctx.fillStyle = type === 1 ? '#111111' : '#034031'; 
            ctx.beginPath(); ctx.moveTo(p.x, p.y + TILE_H/2); ctx.lineTo(p.x + TILE_W/2, p.y); ctx.lineTo(p.x + TILE_W/2, p.y + 10); ctx.lineTo(p.x, p.y + TILE_H/2 + 10); ctx.fill();

            let hash = (gx * 37 + gy * 17) % 3; let grassColors = ['#065f46', '#064e3b', '#047857'];
            ctx.beginPath(); ctx.moveTo(p.x, p.y - TILE_H/2); ctx.lineTo(p.x + TILE_W/2, p.y); ctx.lineTo(p.x, p.y + TILE_H/2); ctx.lineTo(p.x - TILE_W/2, p.y); ctx.closePath();
            ctx.fillStyle = type === 1 ? '#1c1917' : (hovered ? '#34d399' : grassColors[hash]); ctx.fill(); 
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
        }

        function showGameOverScreen() {
            let go = document.getElementById('gameover-overlay');
            go.style.display = 'flex';
            setTimeout(() => go.style.opacity = '1', 50);
            document.getElementById('go-wave').innerText = wave;
            
            let score = (wave - 1) * 100 + statEnemiesKilled * 10 + Math.floor(statTotalDmgDealt / 10);

            let buildClass = "Estrategista Versátil";
            let colorClass = "#38bdf8";
            let fireCount = 0, magicCount = 0, stormCount = 0, poisonCount = 0;

            towers.forEach(t => {
                if(t.flags.has('fire') || t.flags.has('explosion') || t.flags.has('meteor')) fireCount++;
                if(t.flags.has('arcane') || t.flags.has('void') || t.flags.has('plasma')) magicCount++;
                if(t.flags.has('lightning') || t.flags.has('storm')) stormCount++;
                if(t.flags.has('poison') || t.flags.has('epidemic') || t.flags.has('corrosive')) poisonCount++;
            });

            let totalAlign = alignmentLight + alignmentDark;
            let lightPct = totalAlign > 0 ? alignmentLight / totalAlign : 0.5;

            if (statGoldEarned > wave * 120) { buildClass = "Capitalista Selvagem"; colorClass = "#fde047"; } 
            else if (fireCount >= 3) { buildClass = "Piromaníaco do Caos"; colorClass = "#f97316"; } 
            else if (magicCount >= 3) { buildClass = "Arquimago do Vazio"; colorClass = "#c084fc"; } 
            else if (stormCount >= 3) { buildClass = "Senhor da Tempestade"; colorClass = "#fbbf24"; } 
            else if (poisonCount >= 3) { buildClass = "Arauto da Peste"; colorClass = "#4ade80"; } 
            else if (statTowersBuilt >= 10) { buildClass = "Engenheiro Industrial"; colorClass = "#60a5fa"; } 
            else if (statCrits > statEnemiesKilled * 1.5) { buildClass = "Atirador de Elite"; colorClass = "#ef4444"; }

            if (totalAlign >= 5) {
                if (lightPct >= 0.9) { buildClass = "Arcanjo Supremo"; colorClass = "#fef08a"; }
                else if (lightPct >= 0.7) { buildClass = "Guardião Celestial"; colorClass = "#fde047"; }
                else if (lightPct >= 0.6) { buildClass = "Arauto da Luz"; colorClass = "#eab308"; }
                else if (lightPct <= 0.1) { buildClass = "Lorde do Inferno"; colorClass = "#7f1d1d"; }
                else if (lightPct <= 0.3) { buildClass = "Cultista do Abismo"; colorClass = "#991b1b"; }
                else if (lightPct <= 0.4) { buildClass = "Arauto do Apocalipse"; colorClass = "#ef4444"; }
                else { buildClass = "Equilíbrio Cósmico"; colorClass = "#a855f7"; }
            }

            if (totalAlign >= 15 && lightPct >= 0.8 && statCrits > 80) { buildClass = "Juiz do Fim"; colorClass = "#fbbf24"; }
            else if (totalAlign >= 15 && lightPct <= 0.2 && statTotalDmgDealt > 10000) { buildClass = "Entidade Primordial"; colorClass = "#4c1d95"; }
            else if (totalAlign >= 10 && Math.abs(lightPct - 0.5) < 0.15 && fireCount > 0 && magicCount > 0) { buildClass = "Anjo Caído"; colorClass = "#9333ea"; }

            let classEl = document.getElementById('go-build-class');
            classEl.innerText = "CLASSE: " + buildClass;
            classEl.style.color = colorClass;
            classEl.style.textShadow = `0 0 15px ${colorClass}80`;


            let highScore = parseInt(localStorage.getItem('nexus_highscore') || '0');
            let isNewRecord = score > highScore;

            if (isNewRecord && score > 0) {
                highScore = score;
                localStorage.setItem('nexus_highscore', score.toString());
                document.getElementById('new-record-badge').style.display = 'block'; 
            }
            
            document.getElementById('go-highscore-display').innerText = highScore.toLocaleString('pt-BR');

            let historyArray = JSON.parse(localStorage.getItem('nexus_history') || '[]');
            if (score > 0) {
                let dataAtual = new Date();
                let dataFormatada = dataAtual.toLocaleDateString('pt-BR') + ' ' + dataAtual.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
                
                historyArray.unshift({
                    date: dataFormatada,
                    score: score,
                    wave: wave,
                    buildClass: buildClass,
                    color: colorClass,
                    team: (window.NXTEAM && NXTEAM.name) || ''
                });
                
                if (historyArray.length > 5) historyArray.pop();
                localStorage.setItem('nexus_history', JSON.stringify(historyArray));
            }

            let hList = document.getElementById('go-history-list');
            if (historyArray.length === 0) {
                hList.innerHTML = '<span style="color:#52525b">Nenhuma partida anterior registrada.</span>';
            } else {
                hList.innerHTML = historyArray.map(match => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #1f1f23;">
                        <div>
                            ${match.team ? `<div style="font-size:12px; color:#a1a1aa; font-weight:bold;">${String(match.team).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</div>` : ''}<div style="font-weight:bold; color:#f4f4f5;">Score: <span style="color:#fde047">${match.score.toLocaleString('pt-BR')}</span></div>
                            <div style="font-size:12px; color:${match.color}; font-weight:bold; text-shadow: 0 0 5px ${match.color}50;">${match.buildClass} (Onda ${match.wave})</div>
                        </div>
                        <div style="color:#52525b; font-size:12px; font-weight:bold;">${match.date}</div>
                    </div>
                `).join('');
            }


            function animCountUp(elId, targetVal, durationMs = 2000, suffix = '') {
                let el = document.getElementById(elId);
                if(!el) return;
                let start = null;
                function step(timestamp) {
                    if(!start) start = timestamp;
                    let progress = Math.min((timestamp - start) / durationMs, 1);
                    let ease = 1 - Math.pow(1 - progress, 4); 
                    let current = Math.floor(ease * targetVal);
                    el.innerText = current.toLocaleString('pt-BR') + suffix;
                    
                    if(progress < 1) requestAnimationFrame(step);
                    else el.innerText = targetVal.toLocaleString('pt-BR') + suffix;
                }
                requestAnimationFrame(step);
            }

            let grid = document.getElementById('go-stats-grid');
            let avgDmgPerWave = wave > 0 ? Math.floor(statTotalDmgDealt / wave) : 0;
            let diffFinal = Math.round(adaptiveMult * 100);

            let statsData = [
                { id: 'st-kills', label: 'Inimigos Derrotados', val: statEnemiesKilled, suffix: '', icon: '\u2620', color: '#ef4444' },
                { id: 'st-dmg', label: 'Dano Total Causado',  val: Math.floor(statTotalDmgDealt), suffix: '', icon: '\u2694', color: '#f97316' },
                { id: 'st-taken', label: 'Dano Sofrido (HP)',   val: statTotalDmgTaken, suffix: ' HP', icon: '\u2764', color: '#f43f5e' },
                { id: 'st-towers', label: 'Torres Construídas',  val: statTowersBuilt, suffix: '', icon: '\ud83d\uddf3', color: '#60a5fa' },
                { id: 'st-cards', label: 'Cartas Aplicadas',    val: statCardsUsed, suffix: '', icon: '\ud83c\udccf', color: '#a78bfa' },
                { id: 'st-gold', label: 'Ouro Ganho Total',    val: statGoldEarned, suffix: 'g', icon: '\ud83d\udcb0', color: '#fde047' },
                { id: 'st-crits', label: 'Crits Acertados',     val: statCrits, suffix: '', icon: '\u26a1', color: '#fbbf24' },
                { id: 'st-avg', label: 'Dano Médio / Onda',   val: avgDmgPerWave, suffix: '', icon: '\ud83d\udcca', color: '#34d399' },
                { id: 'st-rerolls', label: 'Rerolls Usados',      val: statRerolls, suffix: '', icon: '\ud83d\udd04', color: '#94a3b8' },
                { id: 'st-diff', label: 'Dificuldade Final',   val: diffFinal, suffix: '%', icon: '\ud83d\udd25', color: adaptiveMult > 1.3 ? '#ef4444' : adaptiveMult > 1.1 ? '#f97316' : '#22c55e' },
            ];

            grid.innerHTML = statsData.map(s =>
                '<div style="background:rgba(20,22,28,0.9);border:1px solid #2d313b;border-radius:10px;padding:16px;text-align:left;">'
                + '<div style="color:#71717a;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">' + s.icon + ' ' + s.label + '</div>'
                + '<div id="' + s.id + '" style="color:' + s.color + ';font-size:26px;font-weight:900;">0' + s.suffix + '</div>'
                + '</div>'
            ).join('');
            
            setTimeout(() => animCountUp('go-score', score, 2500), 100);
            statsData.forEach((s, i) => {
                setTimeout(() => animCountUp(s.id, s.val, 1500, s.suffix), 300 + i * 80);
            });

            let tList = document.getElementById('go-towers-list');
            let allTowers = [...towers, ...soldTowers, ...lostTowers]; 
            
            if(allTowers.length === 0) { tList.innerHTML = '<span style="color:#52525b">Nenhuma torre construída.</span>'; }
            else {
                tList.innerHTML = allTowers.map(t => {
                    let cfg = towerTypes[t.type] || {};
                    let typeName = cfg.name || t.type;
                    let color = t.color || cfg.color || '#a1a1aa';
                    let icon = t.icon || cfg.icon || '🏰';
                    let flags = (t.flags instanceof Set ? [...t.flags] : Array.isArray(t.flags) ? t.flags : []).join(', ') || 'Nenhuma';
                    let dmgStat = Math.floor(t.damage || 0);
                    
                    let isSold = soldTowers.includes(t), isLost = lostTowers.includes(t);
                    let tagVendida = isSold ? ' <span style="color:#ef4444;font-size:10px;border:1px solid #ef4444;border-radius:4px;padding:2px 4px;margin-left:6px;vertical-align:middle;">VENDIDA</span>' : (isLost ? ' <span style="color:#f97316;font-size:10px;border:1px solid #f97316;border-radius:4px;padding:2px 4px;margin-left:6px;vertical-align:middle;">DESTRU\u00CDDA</span>' : '');

                    return '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #1f1f23;">'
                        + '<span style="font-size:20px;color:' + color + ';">' + icon + '</span>'
                        + '<div>'
                        + '<div style="font-weight:bold;color:#f4f4f5;">' + typeName + ' <span style="color:#71717a;font-size:12px;">Nível ' + (t.level||1) + '</span>' + tagVendida + '</div>'
                        + '<div style="color:#52525b;font-size:12px;">Flags: <span style="color:#a1a1aa;">' + flags + '</span> &nbsp;·&nbsp; Dano: <span style="color:#f97316;">' + dmgStat + '</span></div>'
                        + '</div></div>';
                }).join('');
            }
        }

        // ── DURABILIDADE: desgaste, quebra e conserto ──
        // (desgaste por disparo; substitui a antiga "Torre Condenada", que destruía torres aleatoriamente)
        const DOOM = { pending: null, timer: 0 };   // compatibilidade
        function doomReset() {}
        const _retireQ = new Set();   // torres que quebraram sem consertos restantes (removidas em durTick)
        function towerRetire(t) {
            _retireQ.delete(t);
            const i = towers.indexOf(t); if (i < 0) return;
            towers.splice(i, 1); lostTowers.push(t);
            if (window.lastHoveredTower === t) { window.lastHoveredTower = null; try { tt.classList.remove('visible'); } catch (e) {} }
            const gx = t.gridX, gy = t.gridY, s = scr(gx, gy, -50);
            fxBoom(gx, gy, 1.6, '#ef4444'); fxShock(gx, gy, '#ffffff', 100, 8);
            fxBurst(gx, gy, 5, 24, ['#52525b', '#27272a', '#a1a1aa', t.color], .25, 5, 55, 5, .35, false, false);
            fxDecal(gx, gy, 32, '#0a0305', .7); createParticles(gx, gy, '#ef4444', 30);
            applyShake(12); hs(3);
            try { SFX.base_dmg(); } catch (e) {}
            floatingTexts.push(new FloatingText(s.x, s.y, '\uD83D\uDCA5 ' + ((towerTypes[t.type] && towerTypes[t.type].name) || 'TORRE') + ' DESTRU\u00CDDA', '#ef4444', true));
            floatingTexts.push(new FloatingText(s.x, s.y + 24, 'LIMITE DE CONSERTOS (' + REPAIR_MAX + '/' + REPAIR_MAX + ')', '#f87171'));
            updateUI();
        }
        function repairCost(t) { return towerTypes[t.type].cost + DUR.repairExtra + (t.repairs || 0) * DUR.repairStep; }
        function durHtml(t) {
            if (window.MP && window.MP.active) return '';
            const m = t.maxDur, pc = Math.max(0, Math.min(1, t.dur / m));
            const col = pc > 0.6 ? '#22c55e' : pc > 0.3 ? '#eab308' : '#ef4444';
            if (t.dur <= 0) return '<span style="color:#ef4444;font-weight:bold;"><i class="fa-solid fa-screwdriver-wrench"></i> QUEBRADA</span><br>'
                + '<span style="color:#e2e8f0">Consertar:</span> <span style="color:' + (gold >= repairCost(t) ? '#fde047' : '#f87171') + ';font-weight:bold;">' + repairCost(t) + 'g</span> <span style="color:#a1a1aa;font-size:12px;">' + (waveActive ? '(indisponível em combate)' : (t.repairs || 0) >= REPAIR_MAX ? '(limite de consertos atingido: a torre será removida)' : '(clique na torre · ' + (REPAIR_MAX - (t.repairs || 0)) + '/' + REPAIR_MAX + ' restantes)') + '</span>';
            const _used = t.repairs || 0, _left = REPAIR_MAX - _used;
            const repInfo = '<div style="margin-top:4px;font-size:12px;color:#a1a1aa;">Consertos: <b style="color:' + (_left > 0 ? '#e2e8f0' : '#ef4444') + '">' + _used + '/' + REPAIR_MAX + '</b> · '
                + (_left > 0 ? 'próximo: <b style="color:#fde047">' + repairCost(t) + 'g</b>' : '<span style="color:#f87171">se quebrar, será destruída</span>') + '</div>';
            const wt = '-' + t.wearPerShot.toFixed(2) + '/tiro' + (t.durRegen ? ', +' + t.durRegen.toFixed(2) + '/s' : '');
            return '<span style="color:#e2e8f0">Durabilidade:</span> <span style="color:' + col + ';font-weight:bold;">' + Math.ceil(t.dur) + '/' + m + '</span> <span style="color:#a1a1aa;font-size:12px;">(' + wt + ')</span>'
                + '<div style="height:5px;background:#27272a;border-radius:3px;margin-top:3px;overflow:hidden;"><div style="height:100%;width:' + (pc * 100).toFixed(0) + '%;background:' + col + ';"></div></div>' + repInfo;
        }
        function durBreak(t) {
            t.dur = 0; t.cooldown = 0; t._lowWarn = false;
            const gx = t.gridX, gy = t.gridY;
            fxBoom(gx, gy, 1.2, '#f97316'); fxShock(gx, gy, '#ffffff', 80, 6);
            fxBurst(gx, gy, 5, 18, ['#52525b', '#27272a', '#a1a1aa', t.color], .2, 4, 45, 4, .3, false, false);
            fxDecal(gx, gy, 26, '#0a0305', .6);
            applyShake(10); hs(3);
            try { SFX.base_dmg(); } catch (e) {}
            if ((t.repairs || 0) >= REPAIR_MAX) { _retireQ.add(t); return; }   // sem consertos restantes: será removida
            const s = scr(gx, gy, -50);
            floatingTexts.push(new FloatingText(s.x, s.y, '\uD83D\uDD27 ' + ((towerTypes[t.type] && towerTypes[t.type].name) || 'TORRE') + ' QUEBRADA', '#f97316', true));
        }
        function repairTower(t) {
            if (!t || t.dur > 0) return;
            const cost = repairCost(t), s = scr(t.gridX, t.gridY, -50);
            if (waveActive) {
                try { SFX.ui_error(); } catch (e) {}
                floatingTexts.push(new FloatingText(s.x, s.y, 'EM COMBATE!', '#ef4444')); applyShake(4); return;
            }
            if ((t.repairs || 0) >= REPAIR_MAX) {
                try { SFX.ui_error(); } catch (e) {}
                floatingTexts.push(new FloatingText(s.x, s.y, 'LIMITE DE CONSERTOS (' + REPAIR_MAX + '/' + REPAIR_MAX + ')', '#ef4444')); applyShake(4); return;
            }
            if (gold < cost) {
                try { SFX.ui_error(); } catch (e) {}
                floatingTexts.push(new FloatingText(s.x, s.y, 'SEM OURO! (' + cost + 'g)', '#ef4444')); flashGold(); applyShake(4); return;
            }
            gold -= cost; t.repairs = (t.repairs || 0) + 1; t.dur = t.maxDur; t._lowWarn = false; t.cooldown = 0; t._vfxCache = null; if (!(t.scale > 0.5)) t.scale = 1; t.scaleV = Math.min(0.6, Math.max(0, t.scaleV) + 0.6);   // conserto mantém efeitos, ícones, flags e monges
            try { SFX.build(); } catch (e) {}
            createParticles(t.gridX, t.gridY, '#22c55e', 25); fxShock(t.gridX, t.gridY, '#22c55e', 70, 5);
            floatingTexts.push(new FloatingText(s.x, s.y, '\uD83D\uDD27 CONSERTADA -' + cost + 'g', '#22c55e', true));
            updateUI();
        }
        function durTick() {
            if (gameOver || (window.MP && window.MP.active)) return;
            const fight = waveActive && !isShopOpen;
            for (const t of towers) {
                if (t.dur <= 0) {   // quebrada: solta fumaça
                    if ((t.repairs || 0) >= REPAIR_MAX) { _retireQ.add(t); continue; }   // (inclui saves antigos)
                    if (frameCount % 18 === 0) fxBurst(t.gridX, t.gridY, 28, 1, ['#52525b', '#3f3f46'], .03, 1.2, 45, 3, .02, false, true);
                    continue;
                }
                if (!fight) continue;
                if (t.durRegen) t.dur += t.durRegen / 60;   // regeneração (Nanobots)
                const mx = t.maxDur;
                if (t.dur > mx) t.dur = mx;
                if (t.dur <= 0) { durBreak(t); continue; }
                const pc = t.dur / mx;
                if (!t._lowWarn && pc <= DUR.warnPct) {
                    t._lowWarn = true;
                    const s = scr(t.gridX, t.gridY, -50);
                    floatingTexts.push(new FloatingText(s.x, s.y, '\u26A0 DURABILIDADE BAIXA', '#eab308', true));
                    try { SFX.ui_error(); } catch (e) {}
                } else if (t._lowWarn && pc > DUR.warnPct + 0.05) t._lowWarn = false;
            }
            if (_retireQ.size) [..._retireQ].forEach(towerRetire);
            if (frameCount % 15 === 0 && window.lastHoveredTower) {   // atualiza a durabilidade no tooltip
                const el = document.getElementById('tt-dur'); if (el) el.innerHTML = durHtml(window.lastHoveredTower);
            }
        }

        // ── MONGES (carta comum): rezam pela torre e atacam inimigos que tentam atacá-la ──
        const MONK = { dmg: 4, perWave: 0.8, cd: 30 };   // dano por monge (+ por onda) e intervalo (frames)
        function monksTick() {
            for (const t of towers) {
                if (!t.monks || t.dur <= 0) continue;
                if (t._monkCd > 0) t._monkCd--; if (t._monkFx > 0) t._monkFx--;
                if (t._monkCd > 0) continue;
                const e = enemies.find(en => !en.dead && en.yOffset <= 0 && en.atkTower === t);
                if (!e) continue;
                t._monkCd = Math.max(8, Math.round(MONK.cd / (t.monkHaste || 1))); t._monkFx = 12; t._monkTgt = { x: e.x, y: e.y }; fxShock(t.gridX, t.gridY, '#fde68a', 52, 3); fxShock(e.x, e.y, '#fde68a', 36, 3); fxBurst(e.x, e.y, 12, 6, ['#fde68a', '#ffffff'], .08, 2.2, 22, 2.5, .15, true, true); t.scaleV += 0.08;
                const dmg = t.monks * (MONK.dmg + MONK.perWave * wave) * (t.monkMul || 1); e.hp -= dmg; e.hitTimer = 4; statTotalDmgDealt += dmg;
                const sp = scr(e.x, e.y, -40); floatingTexts.push(new FloatingText(sp.x, sp.y, String(Math.floor(dmg)), '#fde68a'));
                createParticles(e.x, e.y, '#fde68a', 5);
                if (e.hp <= 0) {
                    e.dead = true; fxDeath(e); statEnemiesKilled++; waveEnemyHpKilled += e.maxHp * 2;
                    const gd = e.goldReward || 5; gold += gd; statGoldEarned += gd; try { SFX.kill_enemy(); } catch (x) {}
                    floatingTexts.push(new FloatingText(sp.x, sp.y - 20, '+' + gd + 'g', '#fde047')); updateUI();
                }
            }
        }
        function gameUpdate() {
            if(gameOver) {
                if(gameOverAlpha === 0) {
                    let shopOv = document.getElementById('shop-overlay');
                    if(shopOv) shopOv.classList.remove('active');
                    isShopOpen = false;
                    ['sidebar','hand-container','controls-hint'].forEach(id => {
                        let el = document.getElementById(id);
                        if(el) { el.style.transition='opacity 0.6s'; el.style.opacity='0'; el.style.pointerEvents='none'; }
                    });
                    setTimeout(showGameOverScreen, 700);
                }
                gameOverAlpha = 1;
                frameCount++;
                return;
            }
            
            if(!isShopOpen) {
                if(keys['w']) camVY += CAM_ACCEL; if(keys['s']) camVY -= CAM_ACCEL;
                if(keys['a']) camVX += CAM_ACCEL; if(keys['d']) camVX -= CAM_ACCEL;
                let spd = Math.hypot(camVX, camVY);
                if(spd > CAM_MAX_SPD) { camVX = camVX / spd * CAM_MAX_SPD; camVY = camVY / spd * CAM_MAX_SPD; }
            }
            if(!isDragging) { camVX += dragVX; camVY += dragVY; dragVX *= DRAG_DRAG; dragVY *= DRAG_DRAG; }
            camX += camVX / zoom; camY += camVY / zoom;
            if(!keys['w'] && !keys['s'] && !keys['a'] && !keys['d']) { camVX *= CAM_DRAG; camVY *= CAM_DRAG; }

            let prevZoom = zoom;
            zoom += (zoomTarget - zoom) * ZOOM_SMOOTH;
            zoom = Math.max(0.4, Math.min(zoom, 3.0));
            if(Math.abs(zoom - prevZoom) > 0.0001) {
                let mx = mouseX - canvas.width/2; let my = mouseY - canvas.height/2;
                camX += (mx / zoom) - (mx / prevZoom);
                camY += (my / zoom) - (my / prevZoom);
            }
            if(FX.hitstop>0){FX.hitstop--; fxUpdate(); return;}
            if(FX.slowmo>0 && (FX.slowmo--&1)) return;
            frameCount++; fxUpdate(); towers.forEach(t => t.updateVisuals()); durTick(); if(!isShopOpen && waveActive) monksTick();

            if(!isShopOpen && waveActive) {
                spawnTimer++;
                if(enemiesToSpawn > 0 && spawnTimer >= spawnInterval) {
                    let nextType = spawnQueue.length > 0 ? spawnQueue.shift() : 'normal';
                    enemies.push(new Enemy(nextType));
                    enemiesToSpawn--;
                    spawnTimer = 0;
                }
                enemies.forEach(e => e.update());
                if(enemiesToSpawn === 0 && enemies.every(e => e.dead && e.yOffset > 30)) { _internalShowShopOrSkip(); }
                else { towers.forEach(t => t.updateCombat()); projectiles.forEach(p => p.update()); }
            }
            
            for(let i=particles.length-1; i>=0; i--) { particles[i].update(); if(particles[i].life <= 0) particles.splice(i,1); }
            for(let i=projectiles.length-1; i>=0; i--) { if(projectiles[i].dead) projectiles.splice(i,1); }
            for(let i=enemies.length-1; i>=0; i--) { if(enemies[i].dead && enemies[i].yOffset > 30) enemies.splice(i,1); }
            for(let i=uiParticles.length-1; i>=0; i--) { if(uiParticles[i].update()) uiParticles.splice(i,1); }
            for(let i=floatingTexts.length-1; i>=0; i--) { if(floatingTexts[i].update()) floatingTexts.splice(i,1); }

            if (floatingTexts.length > PERF.maxFloating) floatingTexts.splice(0, floatingTexts.length - PERF.maxFloating);
        }

        function gameRender() {
            if(gameOver) return;
            ctx.setTransform(1,0,0,1,0,0);
            ctx.clearRect(0,0,canvas.width,canvas.height);
            ctx.save();
            if (screenShake > 0.5) { ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake); screenShake *= 0.8; }
            ctx.translate(canvas.width/2, canvas.height/2); ctx.scale(zoom, zoom); ctx.translate(-canvas.width/2, -canvas.height/2);

            drawMapTiles(hoverGridX, hoverGridY);
            fxDrawDecals();

            renderQueue.length = 0;
            getLocks().forEach(l => { renderQueue.push({ type: 'lock', x: l.gx, y: l.gy, dir: l.dir, d: l.gx + l.gy, o: 0 }); });
            for (let i = 0; i < towers.length; i++) { const t = towers[i]; renderQueue.push({ type: 'tower', x: t.gridX, y: t.gridY, obj: t, d: t.gridX + t.gridY, o: 3 }); }
            for (let i = 0; i < enemies.length; i++) { const e = enemies[i]; if (e.yOffset <= 30) renderQueue.push({ type: 'enemy', x: e.x, y: e.y, obj: e, d: e.x + e.y, o: 2 }); }
                        renderQueue.sort(_rqCmp);

            renderQueue.forEach(item => {
                if(item.type === 'lock') {
                    let p = cartToIso(item.x, item.y); let expansionsAvailable = Math.floor(wave / 5) - expansionsUsed;
                    let canBuy = expansionsAvailable > 0 && gold >= 100 && !waveActive; let isHovered = (hoverGridX === item.x && hoverGridY === item.y);
                    let bob = Math.sin(frameCount * 0.1) * 5;
                    ctx.font = '900 24px "Font Awesome 6 Free", "Font Awesome 5 Free", "FontAwesome"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = canBuy ? (isHovered ? '#fef08a' : '#eab308') : (waveActive && expansionsAvailable > 0 ? '#ef4444' : '#a1a1aa');
                    ctx.fillText(canBuy ? '\uf3c1' : '\uf023', p.x, p.y - 10 + bob);
                    ctx.font = 'bold 12px Arial';
                    if(expansionsAvailable <= 0) { ctx.fillStyle = '#a1a1aa'; ctx.fillText(`FALTAM ${5 - (wave % 5)} ONDAS`, p.x, p.y + 10 + bob); } 
                    else if(waveActive) { ctx.fillStyle = '#ef4444'; ctx.fillText('EM COMBATE', p.x, p.y + 10 + bob); } 
                    else { ctx.fillText('100g', p.x, p.y + 10 + bob); }
                } else { item.obj.draw(); }
            });

            if(!waveActive && waypoints && waypoints.length > 0) {
                let spawnPt = waypoints[0];
                let sp = cartToIso(spawnPt.x, spawnPt.y);
                let pulse = Math.sin(frameCount * 0.07);
                let alpha = 0.55 + pulse * 0.35;
                let scale = 1.0 + pulse * 0.12;

                ctx.save();
                ctx.globalAlpha = alpha * 0.4;
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 12;
                ctx.beginPath();
                ctx.ellipse(sp.x, sp.y, 30 * scale, 15 * scale, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 16;
                let arrowY = sp.y - 55 - pulse * 6;
                ctx.beginPath();
                ctx.moveTo(sp.x,       arrowY + 14);
                ctx.lineTo(sp.x - 10,  arrowY);
                ctx.lineTo(sp.x - 4,   arrowY);
                ctx.lineTo(sp.x - 4,   arrowY - 14);
                ctx.lineTo(sp.x + 4,   arrowY - 14);
                ctx.lineTo(sp.x + 4,   arrowY);
                ctx.lineTo(sp.x + 10,  arrowY);
                ctx.closePath();
                ctx.fill();

                ctx.globalAlpha = alpha;
                ctx.shadowBlur = 8;
                ctx.fillStyle = '#fca5a5';
                ctx.font = 'bold 11px "Segoe UI", Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('ENTRADA', sp.x, arrowY - 24);
                ctx.restore();
            }

            if(hoverGridX >= 0 && hoverGridX < map[0].length && hoverGridY >= 0 && hoverGridY < map.length && !isShopOpen) {
                const hoveredTower = towers.find(t => t.gridX === hoverGridX && t.gridY === hoverGridY);
                if(!hoveredTower && map[hoverGridY][hoverGridX] === 0 && !dragElement) {
                    let pos = cartToIso(hoverGridX, hoverGridY); let cfg = towerTypes[selectedTowerKey];
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y, cfg.range * (TILE_W/2), cfg.range * (TILE_H/2), 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                    ctx.globalAlpha = 0.5; ctx.fillStyle = cfg.color; ctx.font = '900 28px "Font Awesome 6 Free"';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cfg.icon, pos.x, pos.y - 24); ctx.globalAlpha = 1.0;
                } else if (hoveredTower) {
                    let pos = cartToIso(hoverGridX, hoverGridY);
                    let baseRange = hoveredTower.baseRange + (hoveredTower.level * 0.2); 
                    let currRange = hoveredTower.range; 

                    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)'; ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y, baseRange * (TILE_W/2), baseRange * (TILE_H/2), 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();

                    if(Math.abs(currRange - baseRange) > 0.05) {
                        ctx.fillStyle = 'rgba(34, 197, 94, 0.10)'; ctx.strokeStyle = 'rgba(34, 197, 94, 0.75)';
                        ctx.lineWidth = 1.5;
                        ctx.setLineDash([6, 4]);
                        ctx.beginPath(); ctx.ellipse(pos.x, pos.y, currRange * (TILE_W/2), currRange * (TILE_H/2), 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                        ctx.setLineDash([]);
                    }
                }
            }

            if (dragElement && hoveredDropTower && draggingCardIndex >= 0) {
                let card = playerHand[draggingCardIndex];
                if (card && !card.isPill && !card.isApple && !card.isEcon && (card.healsDur || card.isMonk || hoveredDropTower.effectCount < 3) && !cardRepeatBlocked(hoveredDropTower, card)) {
                    let clone = previewCardStats(hoveredDropTower, card);
                    let prevRange = hoveredDropTower.range;
                    let newRange = clone.range;
                    let pos = cartToIso(hoveredDropTower.gridX, hoveredDropTower.gridY);

                    ctx.fillStyle = 'rgba(56, 189, 248, 0.05)'; ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.ellipse(pos.x, pos.y, prevRange * (TILE_W/2), prevRange * (TILE_H/2), 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();

                    if(Math.abs(newRange - prevRange) > 0.05) {
                        ctx.fillStyle = newRange > prevRange ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)';
                        ctx.strokeStyle = newRange > prevRange ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)';
                        ctx.lineWidth = 1.5;
                        ctx.setLineDash([6, 4]);
                        ctx.beginPath(); ctx.ellipse(pos.x, pos.y, newRange * (TILE_W/2), newRange * (TILE_H/2), 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                        ctx.setLineDash([]);
                    }
                }
            }

            projectiles.forEach(p => p.draw()); fxDrawWorld();

            if(confirmedDropTower) {
                dropConfirmPulse += 0.10;
                let alpha = 0.35 + Math.sin(dropConfirmPulse * 2) * 0.30; 
                let pos = cartToIso(confirmedDropTower.gridX, confirmedDropTower.gridY);

                ctx.save();
                ctx.globalAlpha = Math.max(0, alpha);
                let r = 1.0 + Math.sin(dropConfirmPulse * 2) * 0.15; 
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth   = 2.5;
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur  = 18;
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y, 26 * r, 13 * r, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.globalAlpha = Math.max(0, alpha * 0.6);
                ctx.strokeStyle = '#ffffffcc';
                ctx.lineWidth   = 1.2;
                ctx.shadowBlur  = 8;
                ctx.beginPath();
                ctx.ellipse(pos.x, pos.y - 20, 13 * r, 7 * r, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.globalAlpha = 0.5 + Math.sin(dropConfirmPulse * 2) * 0.4;
                ctx.fillStyle   = '#ffffff';
                ctx.font        = 'bold 11px "Segoe UI", Arial';
                ctx.textAlign   = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowBlur  = 6;
                ctx.fillText('SOLTE AQUI', pos.x, pos.y - 46);

                ctx.restore();
            }
            ctx.restore(); ctx.setTransform(1,0,0,1,0,0);
            uiParticles.forEach(p => p.draw()); floatingTexts.forEach(t => t.draw());
            fxPost();
        }

        function initBattleRays() {
            const canvas = document.getElementById('battle-rays-canvas');
            if (!canvas) return;
            const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false }) || canvas.getContext('experimental-webgl', { alpha: true });
            if (!gl) return;

            const vsSource = `
            attribute vec2 position;
            void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

            const fsSource = `precision highp float;
            uniform float iTime; uniform vec2 iResolution; uniform float iSpeed;
            uniform vec3 iRayColor1; uniform vec3 iRayColor2; uniform float iIntensity;
            uniform float iSpread; uniform float iFlipX; uniform float iFlipY;
            uniform float iTilt; uniform float iSaturation; uniform float iBlend;
            uniform float iFalloff; uniform float iOpacity;

            float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
                vec2 sourceToCoord = coord - raySource;
                float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
                return clamp((0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) + (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)), 0.0, 1.0) *
                    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
            }

            void main() {
                vec2 fragCoord = gl_FragCoord.xy;
                if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
                if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

                vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
                vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);

                float tiltRad = iTilt * 3.14159265 / 180.0;
                float cs = cos(tiltRad); float sn = sin(tiltRad);
                vec2 rel = coord - rayPos;
                vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

                float halfSpread = iSpread * 0.275;
                vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
                vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));

                vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
                vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

                vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;
                float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
                float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
                color.rgb *= brightness;

                float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                color.rgb = mix(vec3(gray), color.rgb, iSaturation);
                color.a = max(color.r, max(color.g, color.b)) * iOpacity;
                gl_FragColor = color;
            }`;

            function compile(type, source) {
                const s = gl.createShader(type);
                gl.shaderSource(s, source); gl.compileShader(s); return s;
            }

            const program = gl.createProgram();
            gl.attachShader(program, compile(gl.VERTEX_SHADER, vsSource));
            gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fsSource));
            gl.linkProgram(program); gl.useProgram(program);

            const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
            const posLoc = gl.getAttribLocation(program, "position");
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

            const loc = {};
            ['iTime','iResolution','iSpeed','iRayColor1','iRayColor2','iIntensity','iSpread','iFlipX','iFlipY','iTilt','iSaturation','iBlend','iFalloff','iOpacity'].forEach(n => loc[n] = gl.getUniformLocation(program, n));

            const hexToRgb = hex => { const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return m ? [parseInt(m[1],16)/255, parseInt(m[2],16)/255, parseInt(m[3],16)/255] : [1,1,1]; };

            gl.uniform1f(loc.iSpeed, 1.8);
            gl.uniform3fv(loc.iRayColor1, hexToRgb('#eab308')); 
            gl.uniform3fv(loc.iRayColor2, hexToRgb('#38bdf8')); 
            gl.uniform1f(loc.iIntensity, 1.8);
            gl.uniform1f(loc.iSpread, 2.5);
            gl.uniform1f(loc.iFlipX, 0.0); 
            gl.uniform1f(loc.iFlipY, 0.0); 
            gl.uniform1f(loc.iTilt, 0.0);
            gl.uniform1f(loc.iSaturation, 1.2);
            gl.uniform1f(loc.iBlend, 0.5);
            gl.uniform1f(loc.iFalloff, 1.2); 
            gl.uniform1f(loc.iOpacity, 1.0);

            let startTime = performance.now();
            let lastDraw = 0;
            function render(now) {
                requestAnimationFrame(render);
                const cfg = PERF.rays;
                if (!cfg) { if (canvas.style.display !== 'none') canvas.style.display = 'none'; return; }
                if (canvas.style.display === 'none') canvas.style.display = '';
                if (document.hidden || isShopOpen || gameOver || menuActive) return;
                if (now - lastDraw < 1000 / cfg.fps) return;
                lastDraw = now;
                const w = Math.max(2, Math.floor(canvas.clientWidth * cfg.scale));
                const h = Math.max(2, Math.floor(canvas.clientHeight * cfg.scale));
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w; canvas.height = h;
                    gl.viewport(0, 0, w, h);
                    gl.uniform2f(loc.iResolution, w, h);
                }
                gl.uniform1f(loc.iTime, (performance.now() - startTime) * 0.001);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
            requestAnimationFrame(render);
        }

        function recalcShopScale() {
            let shopContent = document.getElementById('shop-content');
            let shopOverlay = document.getElementById('shop-overlay');
            if (!shopContent || !shopOverlay) return;

            if (NX_TOUCH) {   // toque: cartas num tamanho legível (zoom altera o layout), rolagem horizontal se não couberem
                shopContent.style.transform = 'none'; shopContent.style.marginBottom = '0'; shopContent.style.zoom = '1';
                const oh = shopOverlay.clientHeight || window.innerHeight, ch = shopContent.scrollHeight || 360;
                shopContent.style.zoom = Math.max(0.55, Math.min(1, (oh - 135) / ch));
                return;
            }
            shopContent.style.transform = 'scale(1)';
            shopContent.style.marginBottom = '0';

            let overlayH = shopOverlay.clientHeight || window.innerHeight;
            let overlayW = shopOverlay.clientWidth  || window.innerWidth;
            let contentH = shopContent.scrollHeight;
            let contentW = shopContent.scrollWidth;

            const _t = document.getElementById('shop-title'), _g = document.getElementById('shop-gold-display'), _bt = document.getElementById('shop-buttons');
            const others = (_t ? _t.offsetHeight : 40) + (_g ? _g.offsetHeight : 40) + (_bt ? _bt.offsetHeight : 100) + 20 + 10 + 20 + 30 + 40;   // alturas fora das cartas (título, ouro, botões, margens e padding)
            let availH = overlayH - others;
            let availW = overlayW - 40;

            let scaleH = availH / Math.max(contentH, 1);
            let scaleW = availW / Math.max(contentW, 1);
            let scale  = Math.min(1.0, scaleH, scaleW);
            scale = Math.max(NX_TOUCH ? 0.3 : 0.45, scale);

            shopContent.style.transform = `scale(${scale})`;
            let shrink = (scale - 1) * contentH;
            shopContent.style.marginBottom = shrink + 'px';
        }

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            ctx.imageSmoothingEnabled = false;
            recalcShopScale();
        });

        applyMagnetEffect('.magnet-btn');
        spawnQueue = buildSpawnQueue(wave);
        enemiesToSpawn = spawnQueue.length;
        initMenu(); 
        updateUI(); 
        renderHand();
        initBattleRays(); 

        // ── LÓGICA DOS CONTROLES DE ÁUDIO (SFX E MÚSICA) ──
        
        // 1. MÚSICA DE FUNDO (PLAYLIST)
        const bgMusic = document.getElementById('bg-music');
        const musicCtrl = document.getElementById('music-control');
        const sliderMusicCont = document.getElementById('slider-container-music');
        const musicSlider = document.getElementById('music-slider');
        const musicIcon = document.getElementById('music-icon');

        // Jogue os nomes dos seus arquivos MP3 aqui, na ordem que quiser
        const playlist = [
            "playlist/Blocky Memory Drift.mp3",
            "playlist/Mossy Save File.mp3",
            "playlist/Wandering Through the Quiet.mp3",
            "playlist/Boss Battle.mp3",
            "playlist/Shadow Arpeggio.mp3"
        ];
        
        let currentTrack = 0;
        // abaixa a música um pouco enquanto a loja de cartas está aberta
        const MUSIC_DUCK = 0.6; let musicDuck = 1;
        const musicVol = () => parseFloat(musicSlider.value) * musicDuck;
        setInterval(() => {
            const tgt = (typeof isShopOpen !== 'undefined' && isShopOpen) ? MUSIC_DUCK : 1;
            if (Math.abs(tgt - musicDuck) < 0.005) { if (musicDuck !== tgt) { musicDuck = tgt; if (bgMusic) bgMusic.volume = musicVol(); } return; }
            musicDuck += (tgt - musicDuck) * 0.15; if (bgMusic) bgMusic.volume = musicVol();
        }, 60);
        
        // Engatilha a primeira música
        if(bgMusic) bgMusic.src = playlist[currentTrack];

        // Loop da playlist: acabou uma, puxa a próxima
        if(bgMusic) {
            bgMusic.addEventListener('ended', () => {
                currentTrack++;
                if (currentTrack >= playlist.length) {
                    currentTrack = 0; // Volta pra primeira
                }
                bgMusic.src = playlist[currentTrack];
                bgMusic.volume = musicVol();
                bgMusic.play().catch(e => console.error("Erro ao pular faixa:", e));
            });
        }

        // Tenta tocar a música assim que o jogador clicar na tela
        let musicStarted = false;
        window.addEventListener('mousedown', () => {
            if(!musicStarted && bgMusic) {
                bgMusic.volume = musicVol();
                let playPromise = bgMusic.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        musicStarted = true; // Só marca como tocando se deu certo
                    }).catch(error => {
                        console.error("Navegador bloqueou ou o arquivo não existe:", error);
                    });
                }
            }
        });

        musicCtrl.addEventListener('mousedown', (e) => {
            if (e.target === musicSlider) return; 
            SFX.ui_click();
            sliderMusicCont.classList.toggle('visible');
            document.getElementById('slider-container-sfx').classList.remove('visible');
        });

        musicSlider.addEventListener('input', (e) => {
            let vol = parseFloat(e.target.value);
            if(bgMusic) bgMusic.volume = vol * musicDuck;
            if(vol === 0) {
                musicIcon.style.color = '#ef4444';
            } else {
                musicIcon.style.color = '#f4f4f5';
            }
        });

        // 2. EFEITOS SONOROS (SFX)
        const volCtrl = document.getElementById('volume-control');
        const sliderSfxCont = document.getElementById('slider-container-sfx');
        const volSlider = document.getElementById('volume-slider');
        const volIcon = document.getElementById('volume-icon');

        volCtrl.addEventListener('mousedown', (e) => {
            if (e.target === volSlider) return; 
            SFX.ui_click();
            sliderSfxCont.classList.toggle('visible');
            document.getElementById('slider-container-music').classList.remove('visible');
        });

        volSlider.addEventListener('input', (e) => {
            masterVolume = parseFloat(e.target.value);
            if(masterVolume === 0) {
                volIcon.className = 'fa-solid fa-volume-xmark';
                volIcon.style.color = '#ef4444';
            } else if(masterVolume < 0.5) {
                volIcon.className = 'fa-solid fa-volume-low';
                volIcon.style.color = '#f4f4f5';
            } else {
                volIcon.className = 'fa-solid fa-volume-high';
                volIcon.style.color = '#f4f4f5';
            }
        });

        // Fechar sliders ao clicar fora
        window.addEventListener('mousedown', (e) => {
            if (!volCtrl.contains(e.target)) sliderSfxCont.classList.remove('visible');
            if (!musicCtrl.contains(e.target)) sliderMusicCont.classList.remove('visible');
        });

/* ══════════ Bloco JS 2 (original) ══════════ */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const SAVE_KEY = 'nexus_save_v1', LIFE_KEY = 'nexus_life', OPT_KEY = 'nexus_opts';
    const CREDITS_AUTHOR = 'Leonardo Macêdo';   // ← troque pelo seu nome / estúdio

    const LS = {
        get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
        del(k) { try { localStorage.removeItem(k); } catch (e) {} }
    };
    const nf = n => Math.floor(n || 0).toLocaleString('pt-BR');
    const fmtTime = s => { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}h ${m}min` : `${m}min ${s % 60}s`; };
    const click = () => { try { SFX.ui_click(); } catch (e) {} };

    /* ─────────────── OPÇÕES (persistentes) ─────────────── */
    const ms = $('music-slider'), vs = $('volume-slider');
    function saveOpts() {
        NXO.music = +ms.value; NXO.sfx = +vs.value; NXO.px = FX.px;
        LS.set(OPT_KEY, { music: NXO.music, sfx: NXO.sfx, px: NXO.px, shake: NXO.shake, dmg: NXO.dmg, flash: NXO.flash, parts: NXO.parts });
    }
    ms.addEventListener('change', saveOpts); vs.addEventListener('change', saveOpts);
    ms.value = NXO.music; ms.dispatchEvent(new Event('input'));
    vs.value = NXO.sfx;   vs.dispatchEvent(new Event('input'));
    NXO.px = FX.px = NXO.px > 1 ? 2 : 1;   // compat.: valores salvos 3x/4x viram ON

    window.nxPxChanged = function () {
        const o = $('fx-over');
        if (o) { o.style.setProperty('--px', FX.px + 'px'); o.style.display = FX.px > 1 ? 'block' : 'none'; }
        const sp = document.querySelector('#fx-px span'); if (sp) sp.textContent = FX.px > 1 ? 'ON' : 'OFF';
        saveOpts();
        if ($('nx-modal').classList.contains('open') && $('nx-title').dataset.k === 'opts') refreshOpts();
    };

    /* ─────────────── MODAL GENÉRICO ─────────────── */
    function openModal(title, html, key) {
        const t = $('nx-title'); t.textContent = title; t.dataset.k = key || '';
        $('nx-body').innerHTML = html; $('nx-body').scrollTop = 0;
        $('nx-modal').classList.add('open');
    }
    function closeModal() { $('nx-modal').classList.remove('open'); $('nx-title').dataset.k = ''; }
    $('nx-modal').addEventListener('mousedown', e => { if (e.target === $('nx-modal')) closeModal(); });
    $('nx-x').addEventListener('click', () => { click(); closeModal(); });

    function confirmBox(title, text, yesLabel, onYes) {
        openModal(title, `<p>${text}</p><div class="nx-actions"><button class="nx-btn" id="nx-no">CANCELAR</button><button class="nx-btn danger" id="nx-yes">${yesLabel}</button></div>`, 'confirm');
        $('nx-no').onclick = () => { click(); closeModal(); };
        $('nx-yes').onclick = () => { click(); closeModal(); onYes(); };
    }

    /* ─────────────── ESTATÍSTICAS ─────────────── */
    const LIFE0 = { games: 0, bestWave: 0, waves: 0, kills: 0, dmg: 0, dmgTaken: 0, towers: 0, cards: 0, gold: 0, crits: 0, rerolls: 0, time: 0 };
    const life = () => Object.assign({}, LIFE0, LS.get(LIFE_KEY, {}));
    let sessAcc = 0;
    function flushTime() { if (!sessAcc) return; const l = life(); l.time += sessAcc; sessAcc = 0; LS.set(LIFE_KEY, l); }
    setInterval(() => { if (nxStarted && !menuActive && !gameOver && !document.hidden && !window.NXTUTRUN) { sessAcc++; if (sessAcc >= 15) flushTime(); } }, 1000);

    function commitRun() {
        const l = life();
        l.games++; l.bestWave = Math.max(l.bestWave, wave); l.waves += Math.max(0, wave - 1);
        l.kills += statEnemiesKilled; l.dmg += statTotalDmgDealt; l.dmgTaken += statTotalDmgTaken;
        l.towers += statTowersBuilt; l.cards += statCardsUsed; l.gold += statGoldEarned; l.crits += statCrits; l.rerolls += statRerolls;
        l.time += sessAcc; sessAcc = 0;
        LS.set(LIFE_KEY, l);
    }
    const _sg = showGameOverScreen;
    showGameOverScreen = function () { try { commitRun(); } catch (e) { console.warn(e); } LS.del(SAVE_KEY); return _sg.apply(this, arguments); };

    const stat = (v, l) => `<div class="nx-stat"><b>${v}</b><span>${l}</span></div>`;
    function showStats() {
        flushTime();
        const l = life(), hs = LS.get('nexus_highscore', 0), hist = LS.get('nexus_history', []);
        let h = '';
        if (nxStarted && !gameOver) {
            h += `<div class="nx-sec">PARTIDA ATUAL${(window.NXTEAM && NXTEAM.name) ? ' — ' + String(NXTEAM.name).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) : ''}</div><div class="nx-grid">${stat(wave, 'Onda')}${stat(nf(statEnemiesKilled), 'Inimigos derrotados')}${stat(nf(statTotalDmgDealt), 'Dano causado')}${stat(statTowersBuilt, 'Torres construídas')}${stat(statCardsUsed, 'Cartas usadas')}${stat(nf(statGoldEarned) + 'g', 'Ouro ganho')}</div>`;
        }
        h += `<div class="nx-sec">HISTÓRICO GERAL</div><div class="nx-grid">${stat(nf(hs), 'Recorde de score')}${stat(l.bestWave || '-', 'Melhor onda')}${stat(l.games, 'Partidas jogadas')}${stat(nf(l.kills), 'Inimigos derrotados')}${stat(nf(l.dmg), 'Dano total causado')}${stat(nf(l.dmgTaken), 'Dano sofrido')}${stat(nf(l.towers), 'Torres construídas')}${stat(nf(l.cards), 'Cartas usadas')}${stat(nf(l.gold) + 'g', 'Ouro ganho')}${stat(nf(l.crits), 'Críticos')}${stat(nf(l.rerolls), 'Rerolls na loja')}${stat(fmtTime(l.time), 'Tempo jogado')}</div>`;
        h += `<div class="nx-sec">ÚLTIMAS PARTIDAS</div>`;
        h += hist.length ? hist.map(m => `<div class="nx-hist"><span>${m.team ? '<b style="color:#e4e4e7">' + String(m.team).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) + '</b> · ' : ''}<b style="color:#fde047">${nf(m.score)}</b> · <span style="color:${m.color}">${m.buildClass}</span> (onda ${m.wave})</span><span style="color:#71717a">${m.date}</span></div>`).join('') : '<span style="color:#71717a">Nenhuma partida registrada ainda.</span>';
        openModal('ESTATÍSTICAS', h, 'stats');
    }

    /* ─────────────── OPÇÕES (UI) ─────────────── */
    const onoff = v => v ? 'ON' : 'OFF';
    function optsHTML() {
        const px = [['ON', 2], ['OFF', 1]].map(([l, n]) => `<button class="nx-btn ${FX.px === n ? 'on' : ''}" data-px="${n}">${l}</button>`).join('');
        const pt = [['TODAS', 2], ['MÍNIMAS', 1], ['NENHUMA', 0]].map(([n, v]) => `<button class="nx-btn ${PART.mode === v ? 'on' : ''}" data-pt="${v}">${n}</button>`).join('');
        const tg = (k, t, d) => `<div class="nx-row"><label>${t}<small>${d}</small></label><button class="nx-btn ${NXO[k] ? 'on' : ''}" data-tg="${k}">${onoff(NXO[k])}</button></div>`;
        return `<div class="nx-sec">ÁUDIO</div>
            <div class="nx-row"><label>Música</label><input type="range" id="nx-mus" min="0" max="1" step="0.01" value="${ms.value}"></div>
            <div class="nx-row"><label>Efeitos sonoros</label><input type="range" id="nx-sfx" min="0" max="1" step="0.01" value="${vs.value}"></div>
            <div class="nx-sec">VÍDEO</div>
            <div class="nx-row"><label>Filtro pixel-art<small>Atalho: tecla P</small></label><div class="nx-seg">${px}</div></div>
            <div class="nx-row"><label>Partículas<small>Menos partículas = mais FPS em PCs fracos</small></label><div class="nx-seg">${pt}</div></div>
            ${tg('shake', 'Tremor de tela', 'Desligue se a câmera tremendo incomoda')}
            ${tg('dmg', 'Números de dano', 'Os números que sobem ao acertar inimigos')}
            ${tg('flash', 'Flashes de luz', 'Clarões de explosões e raios (fotossensibilidade)')}
            <div class="nx-row"><label>Tela cheia</label><button class="nx-btn" id="nx-fs">ALTERNAR</button></div>
            <div class="nx-sec">DADOS</div>
            <div class="nx-row"><label>Apagar progresso<small>Recorde, estatísticas, histórico e jogo salvo</small></label><button class="nx-btn danger" id="nx-wipe">APAGAR</button></div>`;
    }
    function bindOpts() {
        const b = $('nx-body');
        $('nx-mus').oninput = e => { ms.value = e.target.value; ms.dispatchEvent(new Event('input')); };
        $('nx-mus').onchange = saveOpts;
        $('nx-sfx').oninput = e => { vs.value = e.target.value; vs.dispatchEvent(new Event('input')); };
        $('nx-sfx').onchange = () => { saveOpts(); click(); };
        b.querySelectorAll('[data-pt]').forEach(x => x.onclick = () => { click(); setParticleMode(+x.dataset.pt, true); saveOpts(); refreshOpts(); });
        b.querySelectorAll('[data-px]').forEach(x => x.onclick = () => { click(); FX.px = +x.dataset.px; nxPxChanged(); });
        b.querySelectorAll('[data-tg]').forEach(x => x.onclick = () => { click(); NXO[x.dataset.tg] = !NXO[x.dataset.tg]; saveOpts(); refreshOpts(); });
        $('nx-fs').onclick = () => { click(); let D = document; try { if (window.parent !== window && parent.document) D = parent.document; } catch (e) {}   // jogo roda num iframe: a tela cheia fica na página-pai e sobrevive aos reloads
            if (D.fullscreenElement) D.exitFullscreen(); else D.documentElement.requestFullscreen().catch(() => {}); };
        $('nx-wipe').onclick = () => { click(); confirmBox('APAGAR PROGRESSO?', 'Isso apaga TUDO: recorde, estatísticas, histórico, conquistas, missões, melhorias, opções, tutorial e o jogo salvo. Você volta a ser um jogador novo. Não dá para desfazer.', 'APAGAR TUDO', () => {
            /* Bloqueia qualquer gravação (beforeunload/visibilitychange/pagehide regravariam o estado em memória), apaga tudo e recarrega do zero */
            try { Storage.prototype.setItem = function () {}; } catch (e) {}
            try { Object.keys(localStorage).filter(k => k.indexOf('nexus_') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) {}
            try { Object.keys(sessionStorage).filter(k => k.indexOf('nexus_') === 0).forEach(k => sessionStorage.removeItem(k)); } catch (e) {}
            location.reload();
        }); };
    }
    function refreshOpts() { const sc = $('nx-body').scrollTop; $('nx-body').innerHTML = optsHTML(); bindOpts(); $('nx-body').scrollTop = sc; }
    function showOpts() { openModal('OPÇÕES', optsHTML(), 'opts'); bindOpts(); }

    /* ─────────────── CRÉDITOS ─────────────── */
    function showCredits() {
        openModal('CRÉDITOS', `<div class="nx-credits">
            <div class="big">NEXUS<br>HEXA GUARD</div>
            <p>Tower defense isométrico com cartas e evolução.</p>
            <div class="nx-sec" style="margin-top:22px">CRIADO POR</div><p>${CREDITS_AUTHOR}</p>
            <div class="nx-sec">TECNOLOGIA</div><p>HTML5 Canvas 2D · WebGL (shader pixel-art)<br>Web Audio API</p>
            <div class="nx-sec">FONTE &amp; ÍCONES</div><p>Press Start 2P — CodeMan38 (Google Fonts)<br>Font Awesome 6 Free</p>
            <div class="nx-sec">OBRIGADO POR JOGAR</div><p style="color:#fb923c">Boa sorte defendendo a base!</p></div>`, 'credits');
    }

    /* ─────────────── SALVAR / CARREGAR ─────────────── */
    const T_SKIP = new Set(['effects', 'flags', 'cooldown', 'angle', 'scale', 'scaleV']);
    function serTower(t) {
        const p = {};
        Object.keys(t).forEach(k => {
            if (T_SKIP.has(k) || (k[0] === '_' && k !== '_critChance')) return;
            const v = t[k];
            if ((typeof v === 'number' && Number.isFinite(v)) || typeof v === 'string' || typeof v === 'boolean') p[k] = v;
        });
        return { p, flags: [...t.flags], effects: t.effects.map(c => c.name) };
    }
    function saveGame() {
        if (window.MP && window.MP.active) return false;
        if (window.NXTUTRUN) return false;   // partida do tutorial nunca é salva
        if (!nxStarted || gameOver || waveActive || isShopOpen) return false;
        if (enemies.some(e => !e.dead)) return false;
        if (wave === 1 && towers.length === 0 && playerHand.length === 0) return false;
        LS.set(SAVE_KEY, {
            v: 1, t: Date.now(), team: (window.NXTEAM && NXTEAM.name) || '', floor: floorPalette.id, hp, gold, wave, sellTokens, expansionsUsed, alignmentLight, alignmentDark, adaptiveMult, rerollCost, selectedTowerKey,
            map, waypoints, camX, camY, zoom: zoomTarget, hand: playerHand.map(c => c.name), shopMods: Object.assign({}, shopMods),
            stats: { statTotalDmgDealt, statTotalDmgTaken, statEnemiesKilled, statTowersBuilt, statCardsUsed, statGoldEarned, statCrits, statRerolls },
            towers: towers.map(serTower)
        });
        return true;
    }
    function loadGame(d) {
        if (d.floor) setFloorPalette(d.floor);
        hp = d.hp; gold = d.gold; wave = d.wave; sellTokens = d.sellTokens; expansionsUsed = d.expansionsUsed;
        if (d.team && window.NXTEAM) NXTEAM.name = d.team;
        alignmentLight = d.alignmentLight; alignmentDark = d.alignmentDark; adaptiveMult = d.adaptiveMult; rerollCost = d.rerollCost;
        if (towerTypes[d.selectedTowerKey]) selectedTowerKey = d.selectedTowerKey;
        map = d.map; waypoints = d.waypoints; mapHeight = map.length; mapWidth = map[0].length;
        camX = d.camX; camY = d.camY; zoom = zoomTarget = d.zoom;
        Object.assign(shopMods, d.shopMods);
        const byName = n => arcanasPool.find(c => c.name === n);
        playerHand = d.hand.map(byName).filter(Boolean);
        towers.length = 0; soldTowers.length = 0; lostTowers.length = 0; enemies.length = 0; projectiles.length = 0; particles.length = 0; floatingTexts.length = 0;
        d.towers.forEach(s => {
            const t = new Tower(s.p.gridX, s.p.gridY, s.p.type);
            Object.assign(t, s.p);
            t.flags = new Set(s.flags); t.effects = s.effects.map(byName).filter(Boolean);
            t.scale = 1; t.scaleV = 0; t._vfxCache = null; towers.push(t);
        });
        const st = d.stats || {};
        statTotalDmgDealt = st.statTotalDmgDealt || 0; statTotalDmgTaken = st.statTotalDmgTaken || 0; statEnemiesKilled = st.statEnemiesKilled || 0;
        statTowersBuilt = st.statTowersBuilt || 0; statCardsUsed = st.statCardsUsed || 0; statGoldEarned = st.statGoldEarned || 0;
        statCrits = st.statCrits || 0; statRerolls = st.statRerolls || 0;
        waveActive = false; isShopOpen = false; gameOverAlpha = 0; waveStartHp = hp;
        spawnQueue = buildSpawnQueue(wave); enemiesToSpawn = spawnQueue.length; spawnTimer = 0;
        const b = $('btn-start-wave'); b.disabled = false; b.innerText = wave > 1 ? 'INICIAR ONDA ' + wave : 'INICIAR ONDA';
        doomReset(); updateUI(); renderHand(); initMenu();
    }
    setInterval(saveGame, 3000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { saveGame(); flushTime(); } });
    window.addEventListener('beforeunload', () => { saveGame(); flushTime(); });

    window.nxRetry = function () { LS.del(SAVE_KEY); sessionStorage.setItem('nexus_autostart', '1'); location.reload(); };
    window.nxToMenu = function () { LS.del(SAVE_KEY); sessionStorage.removeItem('nexus_autostart'); location.reload(); };
    function newGame() { LS.del(SAVE_KEY); flushTime(); sessionStorage.setItem('nexus_autostart', '1'); location.reload(); }

    /* ─────────────── MENU PRINCIPAL ─────────────── */
    const splash = () => $('splash');
    const tutDone = () => { try { return localStorage.getItem('nexus_tutorial_done') === 'true'; } catch (e) { return true; } };
    const playLocked = () => !tutDone() && !(nxStarted && !gameOver) && !(window.MP && window.MP.active);   // 1º acesso: só libera depois do tutorial
    function refreshMenu() {
        const s = splash(); if (!s) return;
        const save = LS.get(SAVE_KEY, null), inGame = nxStarted && !gameOver;
        const main = s.querySelector('[data-act=play]'), nw = s.querySelector('[data-act=new]'), st = s.querySelector('.sp-status');
        if (inGame) { main.textContent = '▶ CONTINUAR'; nw.style.display = ''; st.textContent = `ONDA ${wave} · ${nf(gold)} OURO`; }
        else if (save) { main.textContent = '▶ CONTINUAR'; nw.style.display = ''; st.textContent = `JOGO SALVO: ONDA ${save.wave} · ${nf(save.gold)} OURO`; }
        else { main.textContent = '▶ JOGAR'; nw.style.display = 'none'; st.textContent = ''; }
        const lk = playLocked();
        [main, nw].forEach(b => { b.classList.toggle('locked', lk); b.setAttribute('aria-disabled', lk ? 'true' : 'false'); });
        const menu = s.querySelector('.sp-menu'); if (menu) menu.classList.toggle('locked', lk);
    }
    function closeMenu() { const s = splash(); menuActive = false; if (s) s.classList.add('out'); }
    function openMenu() {
        const s = splash(); if (!s || !nxStarted || gameOver || menuActive || dragElement) return;
        menuActive = true; flushTime(); refreshMenu(); s.classList.remove('out');
    }
    function play() {
        if (!nxStarted) { const save = LS.get(SAVE_KEY, null); if (save) { try { loadGame(save); } catch (e) { console.error('Falha ao carregar save:', e); LS.del(SAVE_KEY); } } nxStarted = true; }
        closeMenu();
    }
    document.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('#splash [data-act]'); if (!b) return;
        click();
        if ((b.dataset.act === 'play' || b.dataset.act === 'new') && playLocked()) {   // bloqueado até concluir o tutorial
            const l = $('sp-lock'); if (l) { l.classList.remove('shake'); void l.offsetWidth; l.classList.add('shake'); }
            try { SFX.ui_error(); } catch (x) {}
            return;
        }
        switch (b.dataset.act) {
            case 'play': play(); break;
            case 'new': (nxStarted || LS.get(SAVE_KEY, null))
                ? confirmBox('NOVO JOGO?', 'O progresso atual (e o jogo salvo) será perdido.', 'COMEÇAR DE NOVO', newGame) : newGame(); break;
            case 'stats': showStats(); break;
            case 'how': play(); showTutorial(true); break;   // fecha o menu, vai pro mapa e roda o tutorial lá
            case 'opts': showOpts(); break;
            case 'credits': showCredits(); break;
        }
    });
    window.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if ($('nx-modal').classList.contains('open')) { closeModal(); return; }
        if (window.NXTUT && NXTUT.reviewing) { NXTUT.stop(); return; }
        if (menuActive) { if (nxStarted) closeMenu(); } else openMenu();
    });

    // botão de menu ao lado dos controles de áudio
    const wrap = $('audio-controls-wrapper');
    if (wrap) { const b = document.createElement('div'); b.id = 'nx-menu-btn'; b.className = 'audio-btn'; b.title = 'Menu [ESC]'; b.innerHTML = '<i class="fa-solid fa-bars"></i>'; b.onclick = () => { click(); openMenu(); }; wrap.insertBefore(b, wrap.firstChild); }

    // overlay do filtro pixel sempre por último no <body>
    const ov = $('fx-over'); document.body.appendChild(ov); nxPxChanged();
    new MutationObserver(() => { if (document.body.lastElementChild !== ov) document.body.appendChild(ov); }).observe(document.body, { childList: true });

    // reinício direto (NOVO JOGO / TENTAR NOVAMENTE) pula o menu
    if (sessionStorage.getItem('nexus_autostart')) {
        sessionStorage.removeItem('nexus_autostart');
        nxStarted = true; menuActive = false;
        const s = splash(); if (s) { s.style.transition = 'none'; s.classList.add('out'); setTimeout(() => s.style.transition = '', 100); }
    }
    refreshMenu();
})();

/* ══════════ Bloco JS 3 (original) ══════════ */
/* ═══════════════════════════════════════════════════════════════════════════
   NEXUS HEXA GUARD — EXTRAS
   1) Splash text amarelo no logo do menu (estilo Minecraft / Terraria)
   2) Escolha do nome do time (estilo Super Auto Pets): 3 opções "Substantivo + Adjetivo"
      aparecem logo depois de apertar INICIAR ONDA na onda 1, a cada partida.
   API pra outros scripts (ex.: multiplayer):  window.NXTEAM.name  +  evento 'nx-team' (detail.name)
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const pick = a => a[Math.random() * a.length | 0];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const css = document.createElement('style');
css.textContent = `
.sp-logo { z-index: 3 !important; }
.sp-logo .sp-splash { position: absolute; left: 84%; bottom: -58px; z-index: 3; width: max-content; max-width: clamp(140px, 30vw, 340px); text-align: center; white-space: normal; cursor: pointer; user-select: none;
  font: clamp(12px, 2vw, 22px)/1.25 'Press Start 2P', monospace !important; letter-spacing: 0; color: #8dff4f;
  text-shadow: 3px 3px 0 #123300; transform: rotate(-12deg); transform-origin: 0 100%; animation: spSplash .5s ease-in-out infinite alternate; }
@keyframes spSplash { from { transform: rotate(-12deg) scale(1); } to { transform: rotate(-12deg) scale(1.08); } }
@keyframes spSplashM { from { transform: translateX(-50%) rotate(-6deg) scale(1); } to { transform: translateX(-50%) rotate(-6deg) scale(1.06); } }
@media (max-width: 640px) { .sp-logo .sp-splash { left: 50%; bottom: -38px; max-width: 88vw; font-size: 11px; transform-origin: 50% 50%; animation-name: spSplashM; } }
#team-modal { position: fixed; inset: 0; z-index: 100004; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 16px; box-sizing: border-box; background: rgba(5,3,10,.9); }
#team-modal.open { display: flex; animation: nxFade .2s ease-out; }
#team-modal .tm-t { font: clamp(13px, 3vw, 22px)/1.4 'Press Start 2P', monospace; color: #fde047; text-shadow: 3px 3px 0 #7f1d1d; text-align: center; }
#team-modal .tm-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(8px, 2vw, 22px); width: min(900px, 100%); }
#team-modal .tm-o { padding: clamp(14px, 3vw, 26px) 6px; font: clamp(8px, 1.6vw, 14px)/1.4 'Press Start 2P', monospace; color: #fff; border: 4px solid #fff; border-radius: 10px; cursor: pointer; word-break: break-word;
  text-shadow: 2px 2px 0 rgba(0,0,0,.6); opacity: 0; animation: tmPop .28s ease-out forwards; transition: transform .1s, filter .1s; }
#team-modal .tm-o.n { background: #15803d; box-shadow: 0 6px 0 #14532d; } #team-modal .tm-o.a { background: #1d4ed8; box-shadow: 0 6px 0 #1e3a8a; }
#team-modal .tm-row .tm-o:nth-child(2) { animation-delay: .07s; } #team-modal .tm-row .tm-o:nth-child(3) { animation-delay: .14s; }
#team-modal .tm-o:hover { transform: translateY(3px) scale(1.03); filter: brightness(1.2); }
#team-modal .tm-o.sel { filter: brightness(1.7) saturate(.7); border-color: #fde047; transform: translateY(4px); }
#team-modal .tm-p { font: clamp(11px, 2.4vw, 18px)/1.5 'Press Start 2P', monospace; color: #fff; text-align: center; min-height: 28px; text-shadow: 2px 2px 0 #000; }
#team-modal .tm-p i { font-style: normal; color: #fde047; }
#team-modal .tm-act { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
#team-modal .tm-b { font: clamp(9px, 1.6vw, 12px) 'Press Start 2P', monospace; padding: 12px 16px; color: #e9d5ff; background: #2a1540; border: 2px solid #6d28d9; cursor: pointer; }
#team-modal .tm-b:hover:not(:disabled) { background: #7c2d12; border-color: #fb923c; color: #fff7ed; }
#team-modal .tm-b.go { color: #1a0b26; background: #fde047; border-color: #fde047; box-shadow: 0 5px 0 #b45309; } #team-modal .tm-b:disabled { opacity: .35; cursor: not-allowed; }
@keyframes tmPop { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
#team-badge { margin: -4px 0 10px; text-align: center; font: 8px/1.5 'Press Start 2P', monospace; color: #fde047; text-shadow: 2px 2px 0 #000; word-break: break-word; display: none; }
`;
document.head.appendChild(css);

/* ───────────────────────── 1) SPLASH TEXT ───────────────────────── */
const SPLASHES = [
    'Defenda o Nexus!', 'Hexágono é amor!', 'Seis lados, zero medo!', 'Mais uma onda!', 'Só mais uma onda...', 'Tem boss na onda 5!', 'Cuidado com o boss!',
    'Torre nunca dorme!', 'Metralhadora resolve!', 'Tesla é vida!', 'Canhão de Elite!', 'Fogo, raio e meteoro!', 'Ricochete!', 'Crítico!', 'Combo infinito!',
    'Compre torres, não ansiedade!', 'Vender torre também é jogada!', 'Arrasta a carta na torre!', 'Carta lendária? Sorte sua!', 'Cadê o ouro?!',
    '100% pixel-art!', 'Pixels artesanais!', 'Feito com HTML5!', 'Sem anúncios!', 'Roda a 60 FPS*', '*quando dá', 'Agora com mais pixels!',
    'Experimente também Terraria!', 'Também joga no celular!', 'Isso é bug ou feature?', 'Funciona na minha máquina!', 'Café com código!',
    'Escrito de madrugada!', 'Ctrl+S salva vidas!', 'Clique em mim!', 'Tem Easter egg aqui!', 'Manda o link pro amigo!', 'Hexagonal, meu bem!',
    'Base forte, onda fraca!', 'Defesa é o melhor ataque!', 'Não deixa passar!', 'Torres: cuidem bem delas!', 'Nexus Hexa Guard!', 'Quase um Tower Defense!',
    'Dica: venda e reconstrua!', 'Dica: use as expansões!', 'Dica: [P] muda o filtro pixel!', 'Dica: WASD move a câmera!', 'Dica: o scroll dá zoom!',
    'Hoje a base não cai!', 'Respira e constrói!', 'Quem tem Tesla não tem medo!', 'O inimigo é fraco, o pânico é forte!', 'Sobreviva até a onda 20!'
];
function dynamicSplash() {
    const d = new Date(), out = [], m = d.getMonth(), day = d.getDate(), wd = d.getDay();
    try { const hs = +localStorage.getItem('nexus_highscore') || 0; if (hs > 0) out.push('Seu recorde: ' + hs.toLocaleString('pt-BR') + '!'); } catch (e) {}
    try { const l = JSON.parse(localStorage.getItem('nexus_life') || '{}'); if (l.bestWave > 1) out.push('Melhor onda: ' + l.bestWave + '!'); if (l.kills > 100) out.push(l.kills.toLocaleString('pt-BR') + ' abates!'); } catch (e) {}
    if (wd === 5) out.push('Sextou!'); if (wd === 1) out.push('Segunda... bora defender!'); if (wd === 0 || wd === 6) out.push('Bom fim de semana!');
    if (m === 9 && day >= 25) out.push('Feliz Halloween!'); if (m === 11 && (day === 24 || day === 25)) out.push('Feliz Natal!'); if (m === 0 && day === 1) out.push('Feliz Ano Novo!');
    return out;
}
let lastSplash = '';
function rollSplash() {
    const el = document.querySelector('.sp-logo .sp-splash'); if (!el) return;
    const dyn = dynamicSplash(); let t, n = 0;
    do { t = (dyn.length && Math.random() < 0.18) ? pick(dyn) : pick(SPLASHES); } while (t === lastSplash && ++n < 8);
    lastSplash = t; el.textContent = t;
}
(function initSplash() {
    const logo = document.querySelector('#splash .sp-logo'); if (!logo) return;
    const sp = document.createElement('span'); sp.className = 'sp-splash'; sp.title = 'Clique pra trocar';
    sp.addEventListener('click', e => { e.stopPropagation(); rollSplash(); });
    logo.appendChild(sp); rollSplash();
    const s = $('splash'); let was = s.classList.contains('out');
    new MutationObserver(() => { const now = s.classList.contains('out'); if (was && !now) rollSplash(); was = now; }).observe(s, { attributes: true, attributeFilter: ['class'] });
})();

/* ───────────────────────── 2) NOME DO TIME (estilo Super Auto Pets: 1 de 3 substantivos + 1 de 3 adjetivos) ───────────────────────── */
const NOUNS = [['Torres', 'f'], ['Sentinelas', 'f'], ['Muralhas', 'f'], ['Bruxas', 'f'], ['Coxinhas', 'f'], ['Capivaras', 'f'], ['Galinhas', 'f'], ['Gárgulas', 'f'], ['Tartarugas', 'f'], ['Minhocas', 'f'], ['Fadas', 'f'], ['Lulas', 'f'], ['Tropas', 'f'], ['Raposas', 'f'], ['Jaquetas', 'f'],
    ['Guardiões', 'm'], ['Canhões', 'm'], ['Goblins', 'm'], ['Pastéis', 'm'], ['Lobos', 'm'], ['Cogumelos', 'm'], ['Magos', 'm'], ['Hexágonos', 'm'], ['Escudos', 'm'], ['Dragões', 'm'], ['Sapos', 'm'], ['Zumbis', 'm'], ['Tijolos', 'm'], ['Pirulitos', 'm'], ['Mosquitos', 'm'], ['Cavaleiros', 'm'], ['Pãezinhos', 'm'], ['Gatos', 'm']];
const ADJS = [['Adoráveis', 'Adoráveis'], ['Agressivos', 'Agressivas'], ['Deliciosos', 'Deliciosas'], ['Molhados', 'Molhadas'], ['Furiosos', 'Furiosas'], ['Sinistros', 'Sinistras'], ['Estranhos', 'Estranhas'], ['Heroicos', 'Heroicas'],
    ['Suspeitos', 'Suspeitas'], ['Lendários', 'Lendárias'], ['Absurdos', 'Absurdas'], ['Misteriosos', 'Misteriosas'], ['Radioativos', 'Radioativas'], ['Invencíveis', 'Invencíveis'], ['Fofos', 'Fofas'], ['Cósmicos', 'Cósmicas'],
    ['Desempregados', 'Desempregadas'], ['Suados', 'Suadas'], ['Nervosos', 'Nervosas'], ['Cansados', 'Cansadas'], ['Poderosos', 'Poderosas'], ['Bugados', 'Bugadas'], ['Brilhantes', 'Brilhantes'], ['Gigantes', 'Gigantes'], ['Elétricos', 'Elétricas'], ['Ilegais', 'Ilegais'],
    ['Desastrados', 'Desastradas'], ['Desequilibrados', 'Desequilibradas'], ['Esperançosos', 'Esperançosas'], ['Imprestáveis', 'Imprestáveis']];
const sample = (arr, n) => { const a = arr.slice(), o = []; while (o.length < n && a.length) o.push(a.splice(Math.random() * a.length | 0, 1)[0]); return o; };
const adjOf = (a, noun) => noun && noun[1] === 'f' ? a[1] : a[0];

const TEAM = window.NXTEAM = { name: '' };
let named = false, picking = false, onPick = null, autoT = null;
let nounOpts = [], adjOpts = [], selN = -1, selA = -1;

const modal = document.createElement('div'); modal.id = 'team-modal';
document.body.appendChild(modal);
['mousedown', 'mouseup', 'click', 'pointerdown', 'touchstart', 'wheel'].forEach(ev => modal.addEventListener(ev, e => e.stopPropagation()));
const preview = () => selN >= 0 && selA >= 0 ? nounOpts[selN][0] + ' ' + adjOf(adjOpts[selA], nounOpts[selN]) : '';
function rollOpts() { nounOpts = sample(NOUNS, 3); adjOpts = sample(ADJS, 3); selN = selA = -1; }
function renderPicker(anim) {
    const nn = selN >= 0 ? nounOpts[selN] : null, p = preview();
    modal.innerHTML = `<div class="tm-t">DÊ UM NOME À SUA EQUIPE</div>
      <div class="tm-row">${nounOpts.map((o, i) => `<button class="tm-o n${i === selN ? ' sel' : ''}" data-n="${i}" ${anim ? '' : 'style="animation:none;opacity:1"'}>${esc(o[0])}</button>`).join('')}</div>
      <div class="tm-row">${adjOpts.map((o, i) => `<button class="tm-o a${i === selA ? ' sel' : ''}" data-a="${i}" ${anim ? '' : 'style="animation:none;opacity:1"'}>${esc(adjOf(o, nn))}</button>`).join('')}</div>
      <div class="tm-p">${p ? '🛡 <i>' + esc(p) + '</i>' : 'Escolha 1 de cada cor'}</div>
      <div class="tm-act"><button class="tm-b" data-r="1">🎲 SORTEAR OUTROS [R]</button><button class="tm-b go" data-ok="1" ${p ? '' : 'disabled'}>CONFIRMAR [ENTER]</button></div>`;
}
function selectN(i) { selN = i; renderPicker(false); }
function selectA(i) { selA = i; renderPicker(false); }
modal.addEventListener('click', e => {
    const n = e.target.closest('[data-n]'), a = e.target.closest('[data-a]'), r = e.target.closest('[data-r]'), ok = e.target.closest('[data-ok]');
    try { SFX.ui_click(); } catch (er) {}
    if (n) selectN(+n.dataset.n); else if (a) selectA(+a.dataset.a);
    else if (r) { rollOpts(); renderPicker(true); } else if (ok) confirmPick();
});
function confirmPick() {
    if (selN < 0 || selA < 0) return;
    clearTimeout(autoT);
    TEAM.name = preview(); modal.classList.remove('open'); picking = false; named = true;
    showBadge();
    window.dispatchEvent(new CustomEvent('nx-team', { detail: { name: TEAM.name } }));
    const f = onPick; onPick = null; if (f) f();
}
function openPicker(cb) {
    picking = true; onPick = cb; rollOpts(); renderPicker(true); modal.classList.add('open');
    try { SFX.card_drop(); } catch (er) {}
    const nv = window.NXVS && NXVS.state && NXVS.state.active;
    if (nv) autoT = setTimeout(() => { if (selN < 0) selN = 0; if (selA < 0) selA = 0; confirmPick(); }, 15000);   // no versus não dá pra deixar o rival esperando
}
window.addEventListener('keydown', e => {
    if (!picking) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); return; }
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '3') selectN(+k - 1);
    else if (k >= '4' && k <= '6') selectA(+k - 4);
    else if (k === 'r') { rollOpts(); renderPicker(true); }
    else if (k === 'enter') confirmPick();
}, true);

function showBadge() {
    let b = $('team-badge');
    if (!b) { const t = $('sidebar-title'); if (!t) return; b = document.createElement('div'); b.id = 'team-badge'; t.insertAdjacentElement('afterend', b); }
    b.textContent = '🛡 ' + TEAM.name; b.style.display = 'block';
}

/* depois de apertar INICIAR ONDA na onda 1: escolhe o nome, e só então a onda começa */
const _sw = startNextWave;
startNextWave = function () {
    if (picking) return;
    if (wave === 1 && !named) { const args = arguments, self = this; openPicker(() => _sw.apply(self, args)); return; }
    return _sw.apply(this, arguments);
};
/* fim de partida: mostra o nome na tela final e libera nova escolha na próxima */
const _sg = showGameOverScreen;
showGameOverScreen = function () {
    const r = _sg.apply(this, arguments);
    try {
        const w = $('go-wave'); let g = $('go-team');
        if (w && !g && TEAM.name) { g = document.createElement('div'); g.id = 'go-team'; g.style.cssText = "color:#fde047;font:12px 'Press Start 2P',monospace;margin:-18px 0 22px;text-shadow:2px 2px 0 #000"; w.parentElement.insertAdjacentElement('beforebegin', g); }
        if (g) g.textContent = TEAM.name ? '🛡 ' + TEAM.name : '';
    } catch (e) {}
    named = false; picking = false; return r;
};
})();

/* ══════════ Bloco JS 4 (original) ══════════ */
(function () {
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const $ = id => document.getElementById(id);
let M = LS.get('nexus_meta', { c: 0, u: {} }); if (!M.u) M.u = {};
const saveM = () => LS.set('nexus_meta', M);

/* ── upgrades permanentes ── */
const UPG = [
  { id: 'gold', n: 'Cofre inicial', d: '+15 de ouro no início da partida', max: 5 },
  { id: 'hp', n: 'Muralha reforçada', d: '+2 de vida da base', max: 5 },
  { id: 'dmg', n: 'Munição Hexa', d: '+4% de dano em todas as torres', max: 5 },
  { id: 'wave', n: 'Imposto de guerra', d: '+6 de ouro no começo de cada onda', max: 5 }
];
const lvl = id => M.u[id] || 0, cost = id => 10 + lvl(id) * 10;

/* ── missões diárias e conquistas ── */
const now = new Date(), ds = now.toISOString().slice(0, 10), sd = (now.getDate() + now.getMonth()) % 3;
const MIS = [
  { id: 'k', n: 'Abata ' + (120 + sd * 40) + ' inimigos', t: 120 + sd * 40 },
  { id: 'g', n: 'Ganhe ' + (600 + sd * 200) + ' de ouro', t: 600 + sd * 200 },
  { id: 'w', n: 'Chegue à onda ' + (6 + sd * 2), t: 6 + sd * 2 }
];
let D = LS.get('nexus_daily', {}); if (D.d !== ds) D = { d: ds, k: 0, g: 0, w: 0, done: {} };
const ACH = [
  { id: 'k100', n: 'Exterminador', d: '100 abates numa partida', r: 5, f: s => s.k >= 100 },
  { id: 'w5', n: 'Veterano', d: 'Chegue à onda 5', r: 5, f: s => s.w >= 5 },
  { id: 'w10', n: 'Sobrevivente', d: 'Chegue à onda 10', r: 10, f: s => s.w >= 10 },
  { id: 'w15', n: 'Lenda do Nexus', d: 'Chegue à onda 15', r: 20, f: s => s.w >= 15 },
  { id: 'w20', n: 'Hexa Supremo', d: 'Chegue à onda 20', r: 40, f: s => s.w >= 20 },
  { id: 'c25', n: 'Frenesi', d: 'Combo de 25', r: 8, f: s => s.c >= 25 },
  { id: 'c50', n: 'Imparável', d: 'Combo de 50', r: 15, f: s => s.c >= 50 },
  { id: 't10', n: 'Arquiteto', d: '10 torres ao mesmo tempo', r: 8, f: s => s.t >= 10 },
  { id: 'g15', n: 'Rei Midas', d: 'Ganhe 1500 de ouro numa partida', r: 10, f: s => s.g >= 1500 }
];
let A = LS.get('nexus_ach', {});

function toast(msg) {
  let w = $('nx-toasts'); if (!w) { w = document.createElement('div'); w.id = 'nx-toasts'; document.body.appendChild(w); }
  const t = document.createElement('div'); t.className = 'nx-toast'; t.textContent = msg; w.appendChild(t);
  try { SFX.card_drop(); } catch (e) {} setTimeout(() => t.remove(), 3800);
}
function gain(n) { M.c += n; saveM(); refreshBtn(); }
function ft(txt, col) { try { floatingTexts.push(new FloatingText(canvas.width / 2, canvas.height * 0.3, txt, col, true)); } catch (e) {} }

/* ── aplica bônus permanentes ── */
let lastBonusWave = 0;
const _sw = startNextWave;
startNextWave = function () {
  if (lastBonusWave !== wave) {
    lastBonusWave = wave;
    if (wave === 1) { gold += lvl('gold') * 15; hp += lvl('hp') * 2; gold += lvGold(); hp += lvHp(); fxActivate(); }
    else if (lvl('wave')) { gold += lvl('wave') * 6; ft('+' + lvl('wave') * 6 + 'g Imposto de guerra', '#fde047'); }
    if (wave > 1) { const fw = fxSum('wave'); if (fw) { gold += fw; ft('+' + fw + 'g Maré de Sorte', '#4ade80'); } }
    try { updateUI(); } catch (e) {}
  }
  return _sw.apply(this, arguments);
};
try {
  const d = Object.getOwnPropertyDescriptor(Tower.prototype, 'damage');
  Object.defineProperty(Tower.prototype, 'damage', { configurable: true, get() { return d.get.call(this) * (1 + 0.04 * lvl('dmg')); } });
} catch (e) {}

/* ── combo, missões e conquistas (checados 10x/s) ── */
let combo = 0, comboT = 0, maxCombo = 0, lastK = 0, lastG = 0;
const MILES = [10, 25, 50, 100, 200]; let milesHit = 0; let _dSig = '', _dT = 0;   // PERF: controla quando gravar nexus_daily
function tick() {
  try {
    const k = statEnemiesKilled, g = statGoldEarned, tn = Date.now();
    if (window.NXTUTRUN) { lastK = k; lastG = g; return; }   // tutorial não conta p/ missões/conquistas
    if (k < lastK) { lastK = k; combo = 0; milesHit = 0; maxCombo = 0; }
    if (g < lastG) lastG = g;
    if (k > lastK) {
      addXp((k - lastK) / 8); D.k += k - lastK; combo += k - lastK; lastK = k; comboT = tn + 2500; maxCombo = Math.max(maxCombo, combo);
      const el = $('nx-combo'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      while (milesHit < MILES.length && combo >= MILES[milesHit]) { const b = MILES[milesHit] * 2; gold += b; ft('COMBO x' + MILES[milesHit] + '  +' + b + 'g', '#f97316'); try { updateUI(); } catch (e) {} milesHit++; }
    }
    if (g > lastG) { D.g += g - lastG; lastG = g; }
    if (combo && tn > comboT) { combo = 0; milesHit = 0; }
    D.w = Math.max(D.w, wave);
    if (!xpWave) xpWave = wave;
    if (wave > xpWave) { const gw = 6 + wave * 2; xpWave = wave; addXp(gw); ft('+' + gw + ' XP', '#60a5fa'); } else if (wave < xpWave) xpWave = wave;
    const c = $('nx-combo'); const _op = combo >= 3 ? '1' : '0'; if (c.style.opacity !== _op) c.style.opacity = _op;
    const _h = 'COMBO x' + combo + '<small>PRÓXIMO BÔNUS EM ' + (MILES[milesHit] || '∞') + '</small>'; if (c._h !== _h) { c._h = _h; c.innerHTML = _h; }
    const s = { k, w: wave, c: maxCombo, t: towers.length, g };
    let dirty = false;
    ACH.forEach(a => { if (!A[a.id] && a.f(s)) { A[a.id] = 1; dirty = true; gain(a.r); addXp(10); toast('🏆 ' + a.n + ' +' + a.r + '💎'); } });
    MIS.forEach(m => { if (!D.done[m.id] && D[m.id] >= m.t) { D.done[m.id] = 1; dirty = true; gain(15); addXp(25); toast('📋 Missão cumprida: ' + m.n + ' +15💎'); } });
    const _sg = D.k + '|' + D.g + '|' + D.w; if (dirty || (_sg !== _dSig && tn - _dT > 2000)) { _dSig = _sg; _dT = tn; LS.set('nexus_daily', D); } if (dirty) LS.set('nexus_ach', A);
  } catch (e) {}
}
setInterval(tick, 100);
const _flushD = () => { try { LS.set('nexus_daily', D); } catch (e) {} };
window.addEventListener('pagehide', _flushD); document.addEventListener('visibilitychange', () => { if (document.hidden) _flushD(); });

/* ── UI: botão, combo e modal ── */
const cb = document.createElement('div'); cb.id = 'nx-combo'; document.body.appendChild(cb);
const btn = document.createElement('button'); btn.id = 'nx-meta-btn'; document.body.appendChild(btn);
let _rOk;
function refreshBtn() {
  btn.textContent = '💎 ' + M.c + ' · LOJA';
  const ok = M.c >= 10;
  if (_rOk === false && ok && !modal.classList.contains('open')) {
    toast('🎰 Você já tem 💎 suficiente pra jogar na roleta!');
    try { const w = $('nx-toasts'), t = w && w.lastChild; if (t) { t.style.cursor = 'pointer'; t.onclick = () => { t.remove(); openM(); }; } } catch (e) {}
  }
  _rOk = ok;
}
refreshBtn();
const modal = document.createElement('div'); modal.id = 'nx-meta-modal'; document.body.appendChild(modal);
['mousedown', 'mouseup', 'pointerdown', 'touchstart', 'wheel', 'click'].forEach(ev => modal.addEventListener(ev, e => e.stopPropagation()));
/* ── nível do jogador (XP por abates, ondas, missões e conquistas) ── */
if (!M.lv) M.lv = 1; if (!M.xp) M.xp = 0;
const LV_MAX = 99;
const lvNeed = l => 60 + l * 25;
const lvReward = l => 3 + Math.floor(l / 2) + (l % 5 === 0 ? 10 : 0);
const lvGold = () => Math.min(100, 2 * (M.lv - 1));
const lvDmg = () => Math.min(.15, .01 * Math.floor((M.lv - 1) / 2));
const lvHp = () => Math.min(8, Math.floor((M.lv - 1) / 5));
const lvRank = l => l >= 40 ? 'Lenda do Nexus' : l >= 30 ? 'Herói' : l >= 20 ? 'Comandante' : l >= 15 ? 'Capitão' : l >= 10 ? 'Guardião' : l >= 5 ? 'Soldado' : 'Recruta';
const lvPerks = () => '+' + lvGold() + ' ouro inicial · +' + Math.round(lvDmg() * 100) + '% dano · +' + lvHp() + ' vida da base';
let xpRun = 0, xpWave = 0;
function lvHud() {
  const sb = $('sidebar'); if (!sb) return; let sec = $('nx-lv-sec');
  if (!sec) { sec = document.createElement('div'); sec.id = 'nx-lv-sec'; sec.className = 'hud-section'; sb.insertBefore(sec, sb.querySelector('.hud-section')); }
  const nd = lvNeed(M.lv), pc = Math.min(100, M.xp / nd * 100);
  sec.innerHTML = '<div class="hud-section-label">NÍVEL</div><div class="hud-row"><span class="hud-icon">⭐</span><span class="hud-key">Nv ' + M.lv + ' · ' + lvRank(M.lv) + '</span></div><div class="nxl-bar sm"><i style="width:' + pc + '%"></i></div><div style="font-size:10px;color:#71717a;margin:3px 0 0">' + Math.floor(M.xp) + ' / ' + nd + ' XP</div>';
}
function lvHTML() {
  const l = M.lv, nd = lvNeed(l), pc = Math.min(100, M.xp / nd * 100);
  return '<div class="nxm-s">⭐ NÍVEL DO JOGADOR</div><div class="nxl"><div class="nxl-badge">' + l + '</div><div class="nxl-main"><b>' + lvRank(l) + '</b>' +
    '<div class="nxl-bar"><i style="width:' + pc + '%"></i></div><small>' + Math.floor(M.xp) + ' / ' + nd + ' XP' + (l < LV_MAX ? ' · próximo nível: +' + lvReward(l + 1) + '💎' : ' · NÍVEL MÁXIMO') + '</small>' +
    '<small class="nxl-perk">🎖️ ' + lvPerks() + '</small></div></div>';
}
function addXp(n) {
  if (!(n > 0) || M.lv >= LV_MAX) return;
  const before = Math.floor(M.xp); M.xp += n; xpRun += n; let up = 0;
  while (M.lv < LV_MAX && M.xp >= lvNeed(M.lv)) { M.xp -= lvNeed(M.lv); M.lv++; up++; const r = lvReward(M.lv); M.c += r; toast('⬆️ NÍVEL ' + M.lv + ' · ' + lvRank(M.lv) + ' · +' + r + '💎'); }
  saveM();
  if (up) {
    refreshBtn(); ft('⬆ NÍVEL ' + M.lv + '!', '#fde047');
    try { fxBanner('⬆ NÍVEL ' + M.lv + ' ⬆', '#fde047'); } catch (e) {}
    try { rJingle([523, 659, 784, 1047, 1319], 90); } catch (e) {}
    if (modal.classList.contains('open') && !rSpin) render();
  }
  if (up || Math.floor(M.xp) !== before) lvHud();
}
lvHud();
window.nxLv = () => M.lv;

/* ── destino: bênçãos e maldições da roleta (valem na PRÓXIMA partida) ── */
const FX = {
  b_gold: { t: 'b', ico: '💰', n: 'Cofre Dourado', d: '+60 de ouro inicial', once() { gold += 60; } },
  b_hp: { t: 'b', ico: '🛡️', n: 'Escudo Antigo', d: '+6 de vida da base', once() { hp += 6; } },
  b_dmg: { t: 'b', ico: '⚔️', n: 'Fúria Hexa', d: '+20% de dano das torres', dmg: .20 },
  b_wave: { t: 'b', ico: '🍀', n: 'Maré de Sorte', d: '+10 de ouro no início de cada onda', wave: 10 },
  b_loot: { t: 'b', ico: '🪙', n: 'Saque Farto', d: '+30% de ouro por abate', loot: .30 },
  b_slow: { t: 'b', ico: '🧊', n: 'Brisa Gélida', d: 'Inimigos 10% mais lentos', spd: -.10 },
  c_hp: { t: 'c', ico: '🩸', n: 'Sangria', d: '-5 de vida da base', once() { hp = Math.max(1, hp - 5); } },
  c_gold: { t: 'c', ico: '💸', n: 'Rapina', d: '-40 de ouro inicial', once() { gold = Math.max(0, gold - 40); } },
  c_dmg: { t: 'c', ico: '🥀', n: 'Fraqueza', d: '-15% de dano das torres', dmg: -.15 },
  c_ehp: { t: 'c', ico: '👹', n: 'Horda Robusta', d: 'Inimigos com +20% de vida', ehp: .20 },
  c_spd: { t: 'c', ico: '🐺', n: 'Fúria Selvagem', d: 'Inimigos 10% mais rápidos', spd: .10 },
  c_loot: { t: 'c', ico: '🕳️', n: 'Saque Pobre', d: '-25% de ouro por abate', loot: -.25 }
};
const FXB = Object.keys(FX).filter(k => FX[k].t === 'b'), FXC = Object.keys(FX).filter(k => FX[k].t === 'c');
const fxSum = k => (M.act || []).reduce((a, id) => a + ((FX[id] && FX[id][k]) || 0), 0);
function fxHud() {
  let sec = $('nx-fx-sec'); const a = (M.act || []).filter(id => FX[id]);
  if (!a.length) { if (sec) sec.style.display = 'none'; return; }
  if (!sec) { const sb = $('sidebar'); if (!sb) return; sec = document.createElement('div'); sec.id = 'nx-fx-sec'; sec.className = 'hud-section'; sb.insertBefore(sec, $('sidebar-buttons') || null); }
  sec.style.display = '';
  sec.innerHTML = '<div class="hud-section-label">DESTINO</div>' + a.map(id => { const f = FX[id]; return '<div class="hud-row" title="' + f.d + '"><span class="hud-icon">' + f.ico + '</span><span class="hud-key" style="color:' + (f.t === 'b' ? '#4ade80' : '#f87171') + '">' + f.n + '</span></div>'; }).join('');
}
function fxActivate() {
  if (window.NXTUTRUN) return;
  const p = (M.fx || []).filter(id => FX[id]); M.act = p.slice(); M.fx = []; saveM();
  p.forEach(id => { try { if (FX[id].once) FX[id].once(); } catch (e) {} });
  try { updateUI(); } catch (e) {} fxHud();
  if (p.length) { ft('🎰 DESTINO ATIVO', '#c084fc'); toast('🎰 Destino: ' + p.map(id => FX[id].ico + ' ' + FX[id].n).join(' · ')); }
}
try {
  const d2 = Object.getOwnPropertyDescriptor(Tower.prototype, 'damage');
  Object.defineProperty(Tower.prototype, 'damage', { configurable: true, get() { return d2.get.call(this) * Math.max(.1, 1 + fxSum('dmg') + lvDmg()); } });
} catch (e) {}
try {
  const eu = Enemy.prototype.update;
  Enemy.prototype.update = function () {
    if (!this._fx) {
      this._fx = 1; const hm = 1 + fxSum('ehp'), sm = 1 + fxSum('spd'), lm = 1 + fxSum('loot');
      if (hm !== 1) { const o = this.maxHp; this.hp = Math.max(1, Math.floor(this.hp * hm)); this.maxHp = this.hp; try { waveTotalEnemyHp += this.maxHp - o; } catch (e) {} }
      if (sm !== 1) this.baseSpeed *= Math.max(.3, sm);
      if (lm !== 1 && this.goldReward) this.goldReward = Math.max(1, Math.round(this.goldReward * Math.max(.1, lm)));
    }
    return eu.apply(this, arguments);
  };
} catch (e) {}
fxHud();

/* ── roleta de cristais ── */
const RSL = [{ m: 0 }, { m: 2 }, { m: 1, k: 'b' }, { m: 0 }, { m: 3 }, { m: 1.5, k: 'c' }, { m: 0 }, { m: .5 }, { m: 1, k: 'b' }, { m: 2 }, { m: 0 }, { m: 1.5, k: 'c' }, { m: 0 }, { m: 1, k: 'b' }, { m: 0 }, { m: 1.5, k: 'c' }];
const RCOL = { 0: ['#23232a', '#34343c'], .5: ['#92400e', '#c2610c'], 2: ['#15803d', '#22a050'], 3: ['#1d4ed8', '#3b82f6'], b: ['#0f766e', '#14b8a6'], c: ['#7f1d1d', '#b91c1c'] };
const rCol = (sl, i) => RCOL[sl.k || sl.m][i % 2];
let rBet = 5, rSpin = false, rRot = 0, rMsg = '', rCls = '', rHl = -1, rLast = -1, rAC;
function rBeep(f, d, v, t) {
  try {
    const vol = +(($('volume-slider') || {}).value || 1); if (!vol) return;
    rAC = rAC || new (window.AudioContext || window.webkitAudioContext)();
    const o = rAC.createOscillator(), g = rAC.createGain(), n = rAC.currentTime;
    o.type = t || 'square'; o.frequency.value = f; g.gain.setValueAtTime(v * vol, n); g.gain.exponentialRampToValueAtTime(.0001, n + d);
    o.connect(g); g.connect(rAC.destination); o.start(n); o.stop(n + d);
  } catch (e) {}
}
function rJingle(notes, gap, type) { notes.forEach((f, i) => setTimeout(() => rBeep(f, .22, .09, type || 'triangle'), i * gap)); }
function rHTML() {
  if (rBet > M.c) rBet = M.c; if (rBet < 1) rBet = Math.min(5, M.c);
  const n = RSL.length, s = 360 / n, off = rSpin || M.c < 1, bets = [2, 5, 10, 25];
  const g = RSL.map((sl, i) => rCol(sl, i) + ' ' + i * s + 'deg ' + (i + 1) * s + 'deg').join(',');
  const lb = RSL.map((sl, i) => '<span style="font-size:' + (sl.k ? 20 : sl.m >= 3 ? 17 : 15) + 'px;transform:rotate(' + (i * s + s / 2) + 'deg) translateY(calc(var(--w) * -.37))">' + (sl.k === 'b' ? '🍀' : sl.k === 'c' ? '☠️' : sl.m === 0 ? '💀' : sl.m === .5 ? '½' : sl.m + 'x') + '</span>').join('');
  const hl = rHl >= 0 ? '<div class="nxr-hl" style="background:conic-gradient(transparent ' + rHl * s + 'deg,rgba(255,255,255,.55) ' + rHl * s + 'deg ' + (rHl + 1) * s + 'deg,transparent ' + (rHl + 1) * s + 'deg)"></div>' : '';
  const bulbs = Array.from({ length: 24 }, (_, i) => '<i class="nxr-bulb" style="transform:rotate(' + i * 15 + 'deg) translateY(calc((var(--w) + 40px) / -2 + 10px));animation-delay:' + (i % 2 ? '.35s' : '0s') + '"></i>').join('');
  const pend = (M.fx || []).filter(id => FX[id]);
  return '<div class="nxm-s">🎰 ROLETA DE CRISTAIS</div><div class="nxr' + (rSpin ? ' spin' : '') + '" id="nxr">' +
    '<div class="nxr-bal">SALDO <b>💎 <span id="nxr-bal">' + M.c + '</span></b></div>' +
    '<div class="nxr-wrap"><div class="nxr-rim">' + bulbs + '</div><div class="nxr-ptr" id="nxr-ptr"></div>' +
    '<div class="nxr-wheel" id="nxr-wheel" style="background:conic-gradient(' + g + ');transform:rotate(' + rRot + 'deg)">' + lb + hl + '</div><div class="nxr-hub">💎</div></div>' +
    '<div class="nxr-msg ' + rCls + '" id="nxr-msg">' + rMsg + '</div>' +
    '<div class="nxr-bets">' + bets.map(b => '<button class="nxr-b' + (rBet === b ? ' on' : '') + '" data-bet="' + b + '" ' + (rSpin || M.c < b ? 'disabled' : '') + '>' + b + '</button>').join('') +
    '<button class="nxr-b nxr-all' + (M.c > 0 && rBet === M.c && !bets.includes(rBet) ? ' on' : '') + '" data-bet="all" ' + (off ? 'disabled' : '') + '>TUDO</button></div>' +
    '<button class="nxr-go" id="nxr-go" data-spin="1" ' + (off ? 'disabled' : '') + '>' + (rSpin ? 'GIRANDO…' : M.c < 1 ? 'SEM 💎' : 'GIRAR · ' + rBet + ' 💎') + '</button>' +
    '<small class="nxr-info">💀 perde · ½ metade · 2x · 3x<br>🍀 Bênção: devolve a aposta + benefício · ☠️ Maldição: paga 1.5x + malefício</small>' +
    '<div class="nxr-fxh">🔮 DESTINO DA PRÓXIMA PARTIDA</div><div class="nxr-fx">' +
    (pend.length ? pend.map(id => '<div class="nxr-chip ' + FX[id].t + '"><span>' + FX[id].ico + '</span><div><b>' + FX[id].n + '</b><small>' + FX[id].d + '</small></div></div>').join('') : '<small class="nxr-info">Nenhum efeito. Caia numa 🍀 ou ☠️ para sortear um.</small>') + '</div></div>';
}
function rBurst(n, cols) {
  const w = document.querySelector('.nxr-wrap'); if (!w) return; cols = cols || ['#fde047', '#22c55e', '#3b82f6', '#d946ef', '#f97316', '#fff'];
  for (let i = 0; i < n; i++) { const e = document.createElement('i'); e.className = 'nxr-cf';
    e.style.cssText = '--dx:' + (Math.random() * 360 - 180) + 'px;--dy:' + (-Math.random() * 220 - 40) + 'px;--r:' + (Math.random() * 720 - 360) + 'deg;background:' + cols[i % cols.length] + ';animation-delay:' + Math.random() * .15 + 's';
    w.appendChild(e); setTimeout(() => e.remove(), 1900); }
}
function rCount(from, to) {
  const el = $('nxr-bal'); if (!el) return; const t0 = performance.now();
  (function f(t) { const k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(from + (to - from) * k); if (k < 1) requestAnimationFrame(f); })(t0);
}
function rTick() {
  const w = $('nxr-wheel'); if (!w || !rSpin) return;
  const m = getComputedStyle(w).transform; let a = 0;
  if (m && m !== 'none') { const v = m.match(/matrix\(([^)]+)\)/); if (v) { const q = v[1].split(',').map(Number); a = Math.atan2(q[1], q[0]) * 180 / Math.PI; } }
  const idx = Math.floor((((-a) % 360) + 360) % 360 / (360 / RSL.length));
  if (idx !== rLast) { rLast = idx; rBeep(850 + Math.random() * 120, .04, .06); const p = $('nxr-ptr'); if (p) { p.classList.remove('tk'); void p.offsetWidth; p.classList.add('tk'); } }
  requestAnimationFrame(rTick);
}
function rGo() {
  if (rSpin || rBet < 1 || rBet > M.c) return;
  rSpin = true; rHl = -1; rMsg = ''; rCls = ''; rLast = -1;
  const i = Math.floor(Math.random() * RSL.length), sl = RSL[i], mult = sl.m, bet = rBet, pay = Math.floor(bet * mult), before = M.c;
  let fid = null;
  if (sl.k) { const pool = sl.k === 'b' ? FXB : FXC, have = M.fx || [], av = pool.filter(x => !have.includes(x)), arr = av.length ? av : pool; fid = arr[Math.floor(Math.random() * arr.length)]; M.fx = have.concat(fid).slice(-5); }
  M.c += pay - bet; saveM();
  const s = 360 / RSL.length, c = i * s + s / 2 + (Math.random() - .5) * s * .7;
  rRot += 360 * 7 + ((-c - rRot) % 360 + 360) % 360;
  const w = $('nxr-wheel'); if (w) { w.style.transition = 'transform 5s cubic-bezier(.12,.6,.1,1)'; w.style.transform = 'rotate(' + rRot + 'deg)'; }
  const go = $('nxr-go'); if (go) { go.disabled = true; go.textContent = 'GIRANDO…'; }
  const box = $('nxr'); if (box) box.classList.add('spin'); const mg = $('nxr-msg'); if (mg) mg.textContent = '';
  const bl = $('nxr-bal'); if (bl) bl.textContent = before - bet;
  document.querySelectorAll('.nxr-b').forEach(x => x.disabled = true);
  rBeep(300, .15, .08, 'sawtooth'); requestAnimationFrame(rTick);
  setTimeout(() => {
    rSpin = false; rHl = i; const big = !sl.k && mult >= 3, f = fid && FX[fid]; let txt;
    if (f) {
      rCls = sl.k === 'b' ? 'win' : 'curse';
      txt = (sl.k === 'b' ? '🍀 BÊNÇÃO: ' : '☠️ MALDIÇÃO: ') + f.ico + ' ' + f.n + '!';
      rMsg = txt + '<small class="nxr-sub">' + f.d + ' · vale na próxima partida' + (pay > bet ? ' · +' + (pay - bet) + '💎' : '') + '</small>';
    } else {
      rCls = mult === 0 ? 'lose' : pay > bet ? (big ? 'big' : 'win') : 'half';
      txt = mult === 0 ? '💀 Perdeu ' + bet + '💎' : pay > bet ? (big ? '🔥 JACKPOT ' + mult + 'x! ' : '🎉 ' + mult + 'x! ') + '+' + (pay - bet) + '💎' : '↘ Voltaram ' + pay + '💎';
      rMsg = txt;
    }
    refreshBtn();
    if (modal.classList.contains('open')) {
      render(); rCount(before - bet, M.c);
      const bx = $('nxr'); if (bx) bx.classList.add(mult === 0 || sl.k === 'c' ? 'shk' : big ? 'jack' : 'flash');
      if (sl.k === 'b') rBurst(40, ['#14b8a6', '#4ade80', '#fde047', '#fff']); else if (sl.k === 'c') rBurst(26, ['#b91c1c', '#7e22ce', '#111']); else if (pay > bet) rBurst(big ? 70 : 32);
    }
    if (sl.k === 'c') rJingle([196, 185, 147, 98], 160, 'sawtooth'); else if (sl.k === 'b') rJingle([523, 659, 784, 1047], 110);
    else if (mult === 0) rJingle([220, 165, 110], 130, 'sawtooth'); else if (pay > bet) rJingle(big ? [523, 659, 784, 1047, 1319] : [523, 659, 784], 110); else rBeep(330, .25, .08);
    toast((sl.k === 'c' || mult === 0 ? '💀 ' : '🎰 ') + txt);
  }, 5200);
}
function render() {
  modal.innerHTML = '<div class="nxm-box"><div class="nxm-h"><b>💎 ' + M.c + ' Cristais Hexa</b><button class="nxm-x" data-x="1">FECHAR [ESC]</button></div>' +
    lvHTML() + '<div class="nxm-s">UPGRADES PERMANENTES</div>' + UPG.map(u => { const l = lvl(u.id), mx = l >= u.max;
      return '<div class="nxm-row"><div><b>' + u.n + ' (' + l + '/' + u.max + ')</b><small>' + u.d + '</small></div><button class="nxm-buy" data-b="' + u.id + '" ' + (mx || M.c < cost(u.id) ? 'disabled' : '') + '>' + (mx ? 'MÁXIMO' : cost(u.id) + ' 💎') + '</button></div>'; }).join('') +
    rHTML() +
    '<div class="nxm-s">MISSÕES DE HOJE (+15💎 cada)</div>' + MIS.map(m => { const p = Math.min(D[m.id] || 0, m.t);
      return '<div class="nxm-row" style="display:block"><b>' + (D.done[m.id] ? '✅ ' : '') + m.n + '</b> <small style="display:inline">' + p + '/' + m.t + '</small><div class="nxm-bar"><i style="width:' + (p / m.t * 100) + '%"></i></div></div>'; }).join('') +
    '<div class="nxm-s">CONQUISTAS (' + ACH.filter(a => A[a.id]).length + '/' + ACH.length + ')</div>' + ACH.map(a => '<div class="nxm-row nxm-ach' + (A[a.id] ? ' on' : '') + '"><div><b>' + (A[a.id] ? '🏆 ' : '🔒 ') + a.n + '</b><small>' + a.d + '</small></div><span>+' + a.r + '💎</span></div>').join('') + '</div>';
}
function openM() { render(); modal.classList.add('open'); } function closeM() { modal.classList.remove('open'); }
window.nxMeta = on => { if (on) { if (!modal.classList.contains('open')) openM(); } else if (modal.classList.contains('open')) closeM(); };
btn.onclick = openM;
modal.addEventListener('click', e => {
  if (e.target === modal || e.target.closest('[data-x]')) return closeM();
  const bt = e.target.closest('[data-bet]'); if (bt) { if (!rSpin) { rBet = bt.dataset.bet === 'all' ? M.c : +bt.dataset.bet; render(); } return; }
  if (e.target.closest('[data-spin]')) return rGo();
  const b = e.target.closest('[data-b]'); if (!b) return;
  const id = b.dataset.b, u = UPG.find(x => x.id === id);
  if (u && lvl(id) < u.max && M.c >= cost(id)) { M.c -= cost(id); M.u[id] = lvl(id) + 1; saveM(); refreshBtn(); try { SFX.ui_click(); } catch (er) {} render(); toast('✔ ' + u.n + ' nível ' + lvl(id) + (wave === 1 ? ' (vale a partir da próxima partida)' : '')); }
});

/* ── game over provocador + reinício com ENTER ── */
let awarded = false;
const _go = showGameOverScreen;
showGameOverScreen = function () {
  const prevBest = (LS.get('nexus_life', {}).bestWave) || 0;
  const r = _go.apply(this, arguments);
  try {
    if (!awarded) {
      awarded = true; M.act = []; try { fxHud(); } catch (e) {}
      const g = Math.max(1, Math.floor((wave - 1) * 2 + statEnemiesKilled / 25)); gain(g);
      let teaser = wave > prevBest && prevBest > 0 ? '🏆 NOVO RECORDE DE ONDAS!' : wave === prevBest ? 'Você igualou seu recorde. Só mais UMA onda passa dele!' : prevBest ? 'Faltaram só ' + (prevBest - wave) + ' onda(s) para igualar seu recorde (onda ' + prevBest + ')!' : 'Seu primeiro recorde está feito. Dá pra superar!';
      const next = UPG.filter(u => lvl(u.id) < u.max).sort((a, b) => cost(a.id) - cost(b.id))[0];
      const hint = next ? (M.c >= cost(next.id) ? '💎 Você já pode comprar <b>' + next.n + '</b>!' : 'Faltam <b>' + (cost(next.id) - M.c) + '💎</b> para <b>' + next.n + '</b>.') : 'Todos os upgrades no máximo!';
      const x = document.createElement('div'); x.id = 'nx-go-extra';
      x.innerHTML = '<div class="t">' + teaser + '</div>+' + g + '💎 ganhos nesta partida (total ' + M.c + ')<br>⭐ +' + Math.floor(xpRun) + ' XP nesta partida (Nível ' + M.lv + ')<br>' + hint + '<br><button data-go="shop">💎 LOJA</button><button data-go="share">📋 COMPARTILHAR</button><div style="color:#71717a;font-size:12px;margin-top:10px">Aperte ENTER para jogar de novo</div>';
      x.addEventListener('click', e => {
        const a = e.target.closest('[data-go]'); if (!a) return;
        if (a.dataset.go === 'shop') openM();
        else { const t = '🏰 Nexus Hexa Guard — ' + ((window.NXTEAM && NXTEAM.name) || 'minha equipe') + ' caiu na onda ' + wave + ' com ' + statEnemiesKilled + ' abates! Consegue superar? ' + location.href.split('#')[0];
          (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copiado! Cole pros amigos 😈')).catch(() => prompt('Copie:', t)); }
      });
      const grid = $('go-stats-grid'); if (grid) grid.insertAdjacentElement('beforebegin', x);
    }
  } catch (e) {}
  return r;
};
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('open')) { closeM(); return; }
  const go = $('gameover-overlay');
  if (e.key === 'Enter' && go && go.style.display === 'flex' && !modal.classList.contains('open') && typeof nxRetry === 'function') nxRetry();
});
})();

/* ══════════ Bloco JS 5 (original) ══════════ */
/* ═══════════════════════════════════════════════════════════════════════════
   NEXUS HEXA GUARD — TUTORIAL DO CAVALEIRO LARANJA (substitui o tutorial antigo)
   • Edite as falas em STEPS. Cada fala é [expressão, "texto com *negrito*"].
   • wait(base): condição real do jogo para liberar o passo; base() guarda o estado inicial.
   • Sprites em cavaleiro/ (nomes em SP).  Modo guiado = 1ª partida; modo revisão = "COMO JOGAR".
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const $ = id => document.getElementById(id), sleep = ms => new Promise(r => setTimeout(r, ms));
const DIR = 'cavaleiro/';
const SP = { normal: '01_normal', lado: '02_olhando_pro_lado', irritado: '03_irritado', feliz: '04_feliz', surpreso: '05_surpreso', confuso: '06_confuso',
    bravo: '08_bravo', rindo: '11_rindo', pensando: '13_pensando', apontando: '19_apontando', debochado: '21_debochado', preparado: '22_preparado',
    vem: '25_vem_aqui', shhh: '27_shhh', vitoria: '28_vitoria' };
Object.values(SP).forEach(f => { new Image().src = DIR + f + '.png'; });

const STEPS = [
  { lines: [["normal", "Finalmente acordou? Achei que ia precisar te carregar."],
            ["apontando", "Esta é a sua base: ela tem *20 de Vida*. Se um inimigo chegar ao fim do caminho, você perde vida: *1* por inimigo comum e *3* por Boss.", ".hud-row:has(#hp)"],
            ["apontando", "Aqui fica o seu *ouro*. Você ganha ouro matando inimigos e gasta com torres, cartas, consertos e expansões do mapa.", ".hud-row:has(#gold)"],
            ["apontando", "*Expansões* mostra quantos cadeados você pode abrir (1 a cada 5 ondas). *Vendas* são as fichas da Pílula de Venda: você começa com 1 e ganha mais *1 a cada 10 ondas*.", ".hud-row:has(#expansions),.hud-row:has(#sells)"],
            ["apontando", "Esta é a *onda* atual. A cada *5 ondas* aparece um *Boss*: grandalhão, lento e com muita vida. E a cada *15 ondas* surge também o *Boss Demolidor*, que destrói torres. O jogo também ajusta a *dificuldade* ao seu desempenho.", ".hud-section:has(#wave)"],
            ["pensando", "Dica: se o *Auto-Wave* e o *Pular Loja* estiverem ativos e você levar dano, eu desligo os dois por segurança. De nada.", "#btn-auto-wave,#btn-skip-shop"]] },
  { lines: [["apontando", "Use *W A S D* para mover a câmera. Não é tão complicado... eu acho.", "#controls-hint"],
            ["normal", "O *scroll do mouse* dá zoom, e dá pra arrastar a tela segurando o *botão direito*.", "#controls-hint"]],
    hint: "Mova a câmera com W A S D (ou use o scroll)",
    base: () => [camX, camY, zoomTarget],
    wait: b => Math.abs(camX - b[0]) + Math.abs(camY - b[1]) > 25 || Math.abs(zoomTarget - b[2]) > 0.05,
    ok: [["feliz", "Boa! Até que você aprende rápido."]] },
  { lines: [["apontando", "Escolha uma torre no *menu lateral* e clique num espaço vazio (*losango livre*) do mapa para construir. Só dá pra construir *fora de combate*.", ".hud-section:has(#tower-list)"],
            ["pensando", "São 3 torres: *Metralhadora* (25g, rápida e de curto alcance), *Canhão de Elite* (45g, longo alcance e dano alto, mas lento) e *Bobina Tesla* (40g, alcance médio e dano elétrico).", "#tower-list"],
            ["pensando", "Ah, e os *cadeados* no fim do caminho expandem o mapa por *100 de ouro*. Você libera *1 expansão a cada 5 ondas*. Guarde essa ideia."]],
    hint: "Escolha uma torre e clique num espaço vazio do mapa", hl: '#tower-list', allow: ['build'],
    base: () => statTowersBuilt, wait: b => statTowersBuilt > b,
    ok: [["debochado", "Muito bem. Agora tente não estragar tudo."]] },
  { lines: [["pensando", "Aviso: a partir da onda 3 surgem os *Sabotadores* (roxos). Eles saem do caminho pra atacar a *durabilidade* das suas torres. Os *Monges* (carta) protegem a torre deles."],
            ["irritado", "E a cada *15 ondas* chega o *Boss Demolidor* (vermelho): ele também sai do caminho pra bater nas torres, mas cada golpe tira *33 de durabilidade de uma vez*. Mate-o rápido ou proteja suas torres!"],
            ["preparado", "Hora do show. Clique em *INICIAR ONDA* e segure a base.", "#btn-start-wave"]],
    hint: "Clique em INICIAR ONDA", hl: '#btn-start-wave', allow: ['start'], wait: () => waveActive },
  { lines: [],
    hint: "Defenda a base até o fim da onda!", base: () => hp, wait: () => isShopOpen,
    watch: b => hp < b, say: [["irritado", "Opa, calma aí! Você está tentando perder de propósito?"]],
    ok: [["vitoria", "Conseguiu! Vou fingir que não estava preocupado."]] },
  { lines: [["apontando", "No fim de cada onda a *loja* abre. Cada carta custa *20 de ouro* (a Pílula de Venda sai por 10).", "#shop-content"],
            ["pensando", "Há 4 raridades: *comum*, *rara*, *épica* e *lendária*. Toda carta traz um *bônus* e quase sempre um *custo* (debuff). Leia antes de comprar."],
            ["apontando", "Não gostou das opções? *Sortear Novas* custa *15g* e sobe *+10g* a cada uso. O preço volta ao normal na próxima loja.", "#reroll-btn"],
            ["apontando", "As cartas compradas vão para a sua *mão*, lá embaixo.", "#hand-container"],
            ["pensando", "Algumas cartas são especiais: *Pílula de Venda* (vende uma torre e devolve ouro, gasta 1 ficha), *Maçã Dourada* (+5 de vida), cartas de *economia* (descontos e mais chance de raridade) e *Monges* (não ocupam vaga de efeito da torre)."],
            ["pensando", "Cartas *Angelicais* e *Demoníacas* mudam o seu alinhamento: quanto mais você compra de um lado, mais cartas dele aparecem. As *exclusivas* só surgem com afinidade alta."],
            ["pensando", "Cada torre aguenta até *3 efeitos* (cartas). Cartas que *regeneram durabilidade* e as cartas de *Monges* não contam nesse limite. Cartas *épicas*, *lendárias* e as que dão um efeito especial não repetem na mesma torre."]],
    hint: "Compre uma carta e clique em PRÓXIMA ONDA", hl: '#all-cards,#close-shop-btn', allow: ['shop'], wait: () => !isShopOpen },
  { skip: () => playerHand.length === 0,
    lines: [["vem", "Agora *arraste a carta* da mão e solte em cima de uma torre para aplicar o upgrade. Passe a carta sobre a torre pra ver uma prévia dos status.", "#hand-container"]],
    hint: "Arraste uma carta da mão até uma torre", hl: '#hand-container', allow: ['card'],
    base: () => statCardsUsed, wait: b => statCardsUsed > b,
    ok: [["surpreso", "Olha só! Torre com carta é torre feliz."]] },
  { lines: [["apontando", "Preste atenção na *durabilidade*: toda torre se desgasta a *cada tiro*, e quanto mais efeitos ela tem, mais rápido desgasta. Passe o mouse na torre pra ver os números."],
            ["irritado", "Quando chega a *0*, a torre *quebra*: para de atirar e perde os efeitos visuais. Os Sabotadores e o Boss Demolidor (33 de dano por golpe) aceleram isso."],
            ["apontando", "Entre as ondas, *clique na torre quebrada* pra consertar. Custa o *preço da torre + 10g*, e *cada conserto encarece o próximo em +10g*."],
            ["bravo", "Cada torre tem no máximo *3 consertos* por partida. Se quebrar de novo depois do 3º, ela é *destruída* e some do mapa. Cartas de durabilidade ajudam a evitar isso."]] },
  { lines: [["pensando", "Fora das ondas você junta *Cristais Hexa* 💎: eles vêm de *abates*, *ondas*, *missões diárias* e *conquistas*, e ficam salvos mesmo quando você perde.", "#nx-meta-btn"],
            ["apontando", "Clique no botão *💎 LOJA* para gastar cristais em *upgrades permanentes* (ouro inicial, vida da base, dano...). Quando você juntar *10 💎*, uma notificação avisa que já dá pra jogar na roleta!", "#nx-meta-btn"],
            ["debochado", "Agora olha *aqui dentro*: tem a *ROLETA*. Escolha a aposta (*2, 5, 10, 25* ou *TUDO*) e gire. Você pode perder a aposta, receber metade de volta ou ganhar *2x* e *3x*.", "#nxr"],
            ["apontando", "As casas *🍀 Bênção* devolvem a aposta e dão um *benefício*. As *☠️ Maldição* pagam *1,5x*, mas trazem um *malefício*. Esses efeitos valem só na *próxima partida*, aparecem em *DESTINO* e somem quando ela termina.", "#nxr"],
            ["pensando", "E tem o seu *nível*: você ganha *XP* matando inimigos, vencendo ondas e cumprindo missões. Cada nível dá *💎* e bônus permanentes de *ouro inicial*, *dano* e *vida da base*.", ".nxl"],
            ["feliz", "A barra colorida mostra quanto falta para o próximo nível. Evolua sempre!", ".nxl"]] },
  { lines: [["pensando", "Últimos atalhos: *ESC* abre o menu e pausa o jogo, e *P* liga ou desliga o filtro pixel."],
            ["debochado", "O *AUTO-WAVE* inicia as ondas sozinho e o *PULAR LOJA* ignora a loja. O jogo também *salva sozinho* entre as ondas.", "#btn-auto-wave,#btn-skip-shop"],
            ["apontando", "Com o *AUTO-WAVE* e o *PULAR LOJA* ligados, aparece o botão *VELOCIDADE*: ele alterna entre *1x* e *2x* e acelera o jogo todo. Se você desligar o Pular Loja, a velocidade volta pra 1x.", "#btn-auto-wave,#btn-skip-shop,#btn-speed"],
            ["vitoria", "Pronto, o treino acabou. Vou te levar de volta ao menu: o *JOGAR* já está liberado. Boa sorte, e tente não morrer."]] }
];

const root = $('nx-dlg'), box = $('nx-box'), txt = $('nx-txt'), kn = $('nx-kn'), task = $('nx-task'), dim = $('nx-dim');
let spotSel = null, spotRaf = 0;
function paintSpot() {                                         // recorta "buracos" no escurecimento sobre os elementos citados
    spotRaf = 0; if (!spotSel) return;
    const W = innerWidth, H = innerHeight, P = 14, R = 16; let d = `M0 0H${W}V${H}H0Z`, n = 0;
    const rects = [];
    document.querySelectorAll(spotSel).forEach(el => {
        const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
        const x = Math.max(0, r.left - P), y = Math.max(0, r.top - P), w = Math.min(W, r.right + P) - x, h = Math.min(H, r.bottom + P) - y;
        if (w > 0 && h > 0) rects.push({ x, y, x2: x + w, y2: y + h });
    });
    for (let ch = true; ch;) {   // une buracos que se sobrepõem (senão a área comum volta a ficar escura)
        ch = false;
        for (let i = 0; i < rects.length && !ch; i++) for (let j = i + 1; j < rects.length && !ch; j++) {
            const a = rects[i], b = rects[j];
            if (a.x < b.x2 && b.x < a.x2 && a.y < b.y2 && b.y < a.y2) {
                a.x = Math.min(a.x, b.x); a.y = Math.min(a.y, b.y); a.x2 = Math.max(a.x2, b.x2); a.y2 = Math.max(a.y2, b.y2);
                rects.splice(j, 1); ch = true;
            }
        }
    }
    rects.forEach(q => {
        const x = q.x, y = q.y, w = q.x2 - q.x, h = q.y2 - q.y; n++;
        d += `M${x + R} ${y}Q${x} ${y} ${x} ${y + R}V${y + h - R}Q${x} ${y + h} ${x + R} ${y + h}H${x + w - R}Q${x + w} ${y + h} ${x + w} ${y + h - R}V${y + R}Q${x + w} ${y} ${x + w - R} ${y}Z`;   // sentido anti-horário = buraco
    });
    if (n) { dim.style.clipPath = `path('${d}')`; dim.classList.add('on', 'block'); } else { dim.classList.remove('on', 'block'); }
    spotRaf = requestAnimationFrame(paintSpot);
}
function spot(sel) {                                           // sel vazio = sem escurecer
    spotSel = sel || null; window.nxSpotSel = spotSel;
    if (!spotSel) { dim.classList.remove('on', 'block'); cancelAnimationFrame(spotRaf); spotRaf = 0; return; }
    if (!spotRaf) spotRaf = requestAnimationFrame(paintSpot);
}
const S = { tok: 0, mode: null, typing: false, res: null, lock: 0, review: false, timer: 0, fin: null, tried: false };
const done = () => { try { return localStorage.getItem('nexus_tutorial_done') === 'true'; } catch (e) { return true; } };
const mark = () => { try { localStorage.setItem('nexus_tutorial_done', 'true'); } catch (e) {} };
kn.onerror = () => { if (!kn.dataset.fb) { kn.dataset.fb = 1; kn.src = DIR + SP.normal + '.png'; } };

function face(k) {
    const f = DIR + (SP[k] || SP.normal) + '.png';
    if (kn.getAttribute('src') === f) return;
    kn.src = f; $('nx-kn2').src = f; kn.classList.remove('kpop'); void kn.offsetWidth; kn.classList.add('kpop');
}
function html(s, n) {                       // *negrito*; revela n caracteres visíveis
    let o = '', b = false, c = 0;
    for (const ch of s) { if (ch === '*') { b = !b; o += b ? '<b>' : '</b>'; continue; } if (c >= n) break; c++; o += ch === '<' ? '&lt;' : ch === '&' ? '&amp;' : ch; }
    return o + (b ? '</b>' : '');
}
/* som de fala 8-bit (blips de onda quadrada) */
let _bAC = null; const _bNotes = [196, 220, 247, 262, 294, 330, 392];
function blip(ch) {
    if (!/[\p{L}\p{N}]/u.test(ch)) return;
    try {
        const vol = +((document.getElementById('volume-slider') || {}).value || 1); if (!vol) return;
        _bAC = _bAC || new (window.AudioContext || window.webkitAudioContext)(); if (_bAC.state === 'suspended') _bAC.resume();
        const o = _bAC.createOscillator(), g = _bAC.createGain(), t = _bAC.currentTime, f = _bNotes[Math.floor(Math.random() * _bNotes.length)] * (Math.random() < .25 ? 2 : 1);
        o.type = 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .85, t + .05);
        g.gain.setValueAtTime(.08 * vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .06);
        o.connect(g); g.connect(_bAC.destination); o.start(t); o.stop(t + .07);
    } catch (e) {}
}
function type(s) {
    return new Promise(res => {
        const len = s.replace(/\*/g, '').length; let n = 0; const plain = s.replace(/\*/g, '');
        S.typing = true; box.classList.remove('done'); clearInterval(S.timer);
        const fin = () => { clearInterval(S.timer); S.typing = false; S.fin = null; txt.innerHTML = html(s, len); box.classList.add('done'); res(); };
        S.fin = fin; txt.innerHTML = '';
        S.timer = setInterval(() => { n++; txt.innerHTML = html(s, n); if (n % 2 === 1) blip(plain[n - 1] || ''); if (n >= len) fin(); }, 26);
    });
}
function show(m) {
    S.mode = m; root.classList.toggle('talk', m === 'talk'); task.classList.toggle('on', m === 'task');
    isTutorialActive = (m === 'talk');                           // fala = trava a entrada do jogo; tarefa = libera
    if (m === 'talk') { const a = document.activeElement; if (a && a.blur) a.blur(); }
}
function hl(sel) {
    document.querySelectorAll('.nx-hl').forEach(e => e.classList.remove('nx-hl'));
    if (sel) document.querySelectorAll(sel).forEach(e => e.classList.add('nx-hl'));
}
const modalOpen = () => document.querySelector('#team-modal.open,#nx-modal.open') || ($('gameover-overlay') && $('gameover-overlay').style.display === 'flex');

async function talk(lines, tok) {
    if (!lines || !lines.length) return tok === S.tok;
    while (tok === S.tok && modalOpen()) await sleep(200);      // não fala por cima do seletor de time / modais
    for (const [e, t, sel] of lines) {
        if (tok !== S.tok) return false;
        const inM = !!sel && /^(#nxr|\.nxl)/.test(sel);   // alvo dentro da LOJA 💎: abre o modal e rola até ele
        try { window.nxMeta && nxMeta(inM); if (inM) setTimeout(() => { const el = document.querySelector(sel); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }, 60); } catch (x) {}
        show('talk'); spot(sel); face(e); await type(window.nxTouchTxt ? nxTouchTxt(t) : t);
        if (tok !== S.tok) return false;
        await new Promise(r => { S.res = r; });
    }
    try { window.nxMeta && nxMeta(false); } catch (x) {}
    if (tok === S.tok) spot(null);
    return tok === S.tok;
}
function adv() {                                                            // 1º comando completa o texto, o 2º avança
    if (S.mode !== 'talk' || performance.now() < S.lock) return;
    S.lock = performance.now() + 180;
    if (S.typing) { if (S.fin) S.fin(); return; }
    if (S.res) { const r = S.res; S.res = null; r(); }
}
function end() {
    window.nxGate = null; S.tok++; clearInterval(S.timer);
    if (S.typing && S.fin) S.fin();
    if (S.res) { const r = S.res; S.res = null; r(); }
    try { window.nxMeta && nxMeta(false); } catch (x) {}
    hl(); spot(null); S.mode = null; root.classList.remove('talk', 'review'); task.classList.remove('on');
    S.review = false; isTutorialActive = false;
}
/* fim do tutorial guiado: a partida de treino é descartada (sem save, sem estatísticas) e começa uma partida nova */
function resetRun(finished) {
    if (S.resetting) return; S.resetting = true; window.nxGate = null;
    if (finished) mark();                                         // se morreu no treino, ele reaparece na próxima partida
    S.tok++; clearInterval(S.timer); hl(); spot(null);
    root.classList.remove('talk', 'review'); task.classList.remove('on'); S.mode = null; isTutorialActive = false;
    try { localStorage.removeItem('nexus_save_v1'); } catch (e) {}
    dim.style.background = '#000'; dim.style.clipPath = 'none'; dim.classList.add('on');
    setTimeout(() => { try { sessionStorage.removeItem('nexus_autostart'); } catch (e) {} location.reload(); }, 550);   // volta pro menu inicial
}
function restartForTutorial() {                                  // descarta a partida atual (sem salvar) e recarrega já com o tutorial pendente
    if (S.resetting) return; S.resetting = true;
    S.tok++; clearInterval(S.timer); hl(); spot(null);
    root.classList.remove('talk', 'review'); task.classList.remove('on'); S.mode = null; isTutorialActive = false; window.NXTUTRUN = true;
    try { localStorage.removeItem('nexus_save_v1'); sessionStorage.setItem('nexus_tut_force', '1'); } catch (e) {}
    dim.style.background = '#000'; dim.style.clipPath = 'none'; dim.classList.add('on');
    setTimeout(() => { try { sessionStorage.setItem('nexus_autostart', '1'); } catch (e) {} location.reload(); }, 450);
}
const skipTut = () => { if (S.guided && !S.review) resetRun(false); else end(); };   // sair NÃO libera o Play: só concluir o tutorial

async function guided() {
    const tok = ++S.tok; S.review = false; S.guided = true; window.NXTUTRUN = true; root.classList.remove('review'); $('nx-skip').textContent = 'Sair';
    for (const st of STEPS) {
        if (tok !== S.tok) return;
        if (st.skip && st.skip()) continue;
        const base = st.base ? st.base() : 0;
        window.nxGate = [];                                                // falando: nada do jogo liberado
        if (!await talk(st.lines, tok)) return;
        if (st.wait) {
            window.nxGate = st.allow || [];
            hl(st.hl); $('nx-hint').textContent = window.nxTouchTxt ? nxTouchTxt(st.hint) : st.hint; show('task');
            let said = false;
            while (tok === S.tok && !st.wait(base)) {
                if (typeof gameOver !== 'undefined' && gameOver) { resetRun(false); return; }
                if (st.watch && !said && st.watch(base)) { said = true; if (!await talk(st.say, tok)) return; hl(st.hl); show('task'); }
                await sleep(150);
            }
            window.nxGate = []; hl(); if (tok !== S.tok) return;
            if (!await talk(st.ok, tok)) return;
        }
    }
    if (tok === S.tok) resetRun(true);
}
async function review() {
    const tok = ++S.tok; S.review = true; S.guided = false; root.classList.remove('review'); $('nx-skip').textContent = 'Fechar';
    if (!await talk(STEPS.flatMap(s => s.lines), tok)) return;
    end();
}

box.addEventListener('click', adv);
$('nx-skip').addEventListener('click', e => { e.stopPropagation(); skipTut(); });
$('nx-skip2').addEventListener('click', skipTut);
[root, task].forEach(el => ['mousedown', 'mouseup', 'wheel', 'touchstart', 'contextmenu'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation(), { passive: true })));
window.addEventListener('keydown', e => {                                   // Espaço/Enter só avançam a fala (nunca acionam botões do jogo)
    if (S.mode !== 'talk' || (e.key !== ' ' && e.key !== 'Enter') || (typeof menuActive !== 'undefined' && menuActive && !S.review)) return;
    e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) adv();
}, true);

// início automático: 1ª partida nova (mesmo momento do tutorial antigo: ao sair do menu pela 1ª vez)
setInterval(() => {
    const hold = menuActive && !S.review;
    root.classList.toggle('hold', hold); task.classList.toggle('hold', hold); dim.classList.toggle('hold', hold);
    if (S.tried || menuActive || !nxStarted) return;
    S.tried = true;
    if (window.MP && window.MP.active) return;
    let _force = false; try { _force = sessionStorage.getItem('nexus_tut_force') === '1'; sessionStorage.removeItem('nexus_tut_force'); } catch (e) {}
    if (done() && !_force) return;
    if (wave === 1 && towers.length === 0 && !waveActive && !gameOver) guided(); else mark();    // save em andamento: não repete
}, 200);

window.NXTUT = { get reviewing() { return S.review && S.mode === 'talk'; }, stop: end, start: guided };
// se morrer/desistir durante o treino: não mostra tela final, não grava recorde/histórico/estatísticas/💎
const _gosTut = showGameOverScreen;
showGameOverScreen = function () { if (window.NXTUTRUN) { resetRun(false); return; } return _gosTut.apply(this, arguments); };
window.showTutorial = function (fromMenu) {
    if (S.guided && !S.resetting) return;                                    // treino já em andamento: só fecha o menu
    end(); S.tried = true;                                                   // evita o início automático duplicado
    const fresh = typeof wave !== 'undefined' && wave === 1 && towers.length === 0 && !waveActive && !gameOver;
    if (fresh) { guided(); return; }
    restartForTutorial();                                                    // partida em andamento: reseta tudo e roda o tutorial numa partida nova
};
window.hideTutorial = window.skipTutorial = skipTut;

/* ── TRAVA DO TUTORIAL: durante o treino, cada ação só funciona no passo em que o Nexus manda fazer ── */
window.nxGate = null;                                         // null = tudo livre (fora do tutorial); array = ações liberadas agora
window.nxBlock = function (act) {                             // true = bloqueado
    if (!window.NXTUTRUN || S.review || !Array.isArray(window.nxGate)) return false;
    if (window.nxGate.includes(act)) return false;
    try { SFX.ui_error(); } catch (e) {}
    const k = $('nx-kn'); if (k) { k.classList.remove('kpop'); void k.offsetWidth; k.classList.add('kpop'); }
    return true;
};
[['startNextWave', 'start'], ['closeShop', 'shop'], ['rerollShop', 'shop'], ['buyLootbox', 'shop'], ['toggleAutoWave', 'auto'], ['toggleSkipShop', 'auto'], ['toggleSpeed', 'auto']].forEach(([fn, act]) => {
    const orig = window[fn]; if (typeof orig !== 'function') return;
    window[fn] = function () { if (nxBlock(act)) return; return orig.apply(this, arguments); };
});
})();


/* ══════════ Bloco JS MOBILE (adicionado) — controles de toque, HUD compacto. Só ativa em dispositivos touch (html.nx-touch); no PC não faz nada ══════════ */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);

    /* Textos do tutorial para toque (no PC o texto original é mantido) */
    const TOUCH_TXT = [
        [/Use \*W A S D\* para mover a câmera\./, '*Arraste um dedo* sobre o mapa para mover a câmera.'],
        [/O \*scroll do mouse\* dá zoom, e dá pra arrastar a tela segurando o \*botão direito\*\./, 'O gesto de *pinça* (dois dedos) dá zoom no mapa.'],
        [/Mova a câmera com W A S D \(ou use o scroll\)/, 'Arraste o mapa com um dedo (ou use a pinça)'],
        [/Passe o mouse na torre pra ver os números\./, 'Toque na torre pra ver os números.'],
        [/Passe a carta sobre a torre pra ver uma prévia dos status\./, 'Segure a carta sobre a torre pra ver uma prévia dos status.'],
        [/\*clique na torre quebrada\*/, '*toque na torre quebrada*'],
        [/e clique num espaço vazio/g, 'e toque num espaço vazio'],
        [/Clique no botão \*💎 LOJA\*/, 'Toque no botão *💎 LOJA*'],
        [/Clique em \*INICIAR ONDA\*/, 'Toque em *INICIAR ONDA*'],
        [/Clique em INICIAR ONDA/, 'Toque em INICIAR ONDA'],
        [/clique em PRÓXIMA ONDA/, 'toque em PRÓXIMA ONDA'],
        [/Últimos atalhos: \*ESC\* abre o menu e pausa o jogo, e \*P\* liga ou desliga o filtro pixel\./, 'Últimos atalhos: o botão *☰* (canto inferior direito) abre o menu e pausa o jogo, e o botão de grade liga ou desliga o filtro pixel.']
    ];
    window.nxTouchTxt = function (s) {
        if (!NX_TOUCH || typeof s !== 'string') return s;
        for (const [re, to] of TOUCH_TXT) s = s.replace(re, to);
        return s;
    };

    if (!NX_TOUCH) return;

    /* ── Evita zoom/gestos nativos do navegador durante o jogo ── */
    // novo gesto (1º dedo) = todo toque anterior já terminou: descarta estado preso (causa dos bugs com 2 dedos)
    window.addEventListener('pointerdown', e => { if ((e.pointerType === 'touch' || e.pointerType === 'pen') && e.isPrimary && window.__nxP && window.__nxP.size) window.__nxEnd(); }, true);
    window.addEventListener('touchend', e => { if (e.touches.length === 0 && window.__nxP && window.__nxP.size) window.__nxEnd(); }, { passive: true });
    window.addEventListener('touchcancel', e => { if (e.touches.length === 0 && window.__nxP && window.__nxP.size) window.__nxEnd(); }, { passive: true });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
    document.addEventListener('dblclick', e => e.preventDefault());

    /* ── Dica de controles (substitui o texto de teclado/mouse) ── */
    const hint = $('controls-hint');
    if (hint) hint.innerHTML = '<strong>1 dedo</strong>: mover câmera<br><strong>2 dedos</strong>: zoom (pinça)<br><strong>Toque</strong>: construir / ver torre<br>Arraste cartas até as torres.<br><strong>Segure a carta</strong> p/ detalhes!';

    /* ── CÂMERA POR TOQUE: 1 dedo arrasta (pan), 2 dedos = pinça (zoom + pan). Toque curto continua construindo (eventos de mouse sintetizados) ── */
    const cv = $('gameCanvas'), P = new Map();
    let pinchD = 0, pinchX = 0, pinchY = 0, lastPanT = 0, lastMoveT = 0, panning = false;
    const MOVE_SLOP = 10;
    const blocked = () => menuActive || isTutorialActive || gameOver || isShopOpen || dragElement;
    const isT = e => e.pointerType === 'touch' || e.pointerType === 'pen';
    const two = () => { const a = [...P.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1 }; };
    function endAll() { P.clear(); if (panning) lastPanT = performance.now(); panning = false; isDragging = false; dragVX = dragVY = 0; }
    window.__nxP = P; window.__nxEnd = endAll;

    cv.addEventListener('pointerdown', e => {
        if (!isT(e) || blocked() || P.size >= 2) return;
        P.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false });
        if (P.size === 2) {
            const m = two(); pinchD = m.d; pinchX = m.x; pinchY = m.y;
            P.forEach(p => { p.moved = true; });
            panning = true; isDragging = true; dragVX = dragVY = 0; mouseX = m.x; mouseY = m.y;
        }
    });
    window.addEventListener('pointermove', e => {
        const p = P.get(e.pointerId); if (!p) return;
        if (blocked()) { endAll(); return; }
        p.x = e.clientX; p.y = e.clientY;
        if (P.size === 2) {
            const m = two();
            zoomTarget = Math.max(0.4, Math.min(zoomTarget * (m.d / pinchD), 3.0));
            camX += (m.x - pinchX) / zoom; camY += (m.y - pinchY) / zoom;
            pinchD = m.d; pinchX = m.x; pinchY = m.y; mouseX = m.x; mouseY = m.y;     // âncora do zoom = centro da pinça
            return;
        }
        if (!p.moved) {
            if (Math.hypot(p.x - p.sx, p.y - p.sy) < MOVE_SLOP) return;               // ainda é um toque
            p.moved = true; p.lx = p.sx; p.ly = p.sy; panning = true; isDragging = true; dragVX = dragVY = 0;
            tt.classList.remove('visible');
        }
        const dx = p.x - p.lx, dy = p.y - p.ly; p.lx = p.x; p.ly = p.y;
        camX += dx / zoom; camY += dy / zoom;                                          // 1:1 com o dedo
        dragVX = dx * 0.25; dragVY = dy * 0.25; lastMoveT = performance.now();         // leve inércia ao soltar
    }, { passive: true });
    function up(e) {
        const p = P.get(e.pointerId); if (!p) return;
        P.delete(e.pointerId);
        if (performance.now() - lastMoveT > 80) { dragVX = 0; dragVY = 0; }            // dedo parado antes de soltar = sem arremesso
        if (P.size === 1) { const r = [...P.values()][0]; r.lx = r.x; r.ly = r.y; r.moved = true; }   // sobrou 1 dedo: continua arrastando
        if (P.size === 0) { if (panning) lastPanT = performance.now(); panning = false; isDragging = false; }
    }
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('blur', endAll); document.addEventListener('visibilitychange', () => { if (document.hidden) endAll(); });
    // depois de arrastar/pinçar o navegador não deve disparar "clique" de construção
    window.addEventListener('mousedown', e => { if (e.target === cv && performance.now() - lastPanT < 450) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);

    /* ── DETALHES DA CARTA: segurar ~0,5s sem mover (equivale ao "pousar o mouse 1s") ── */
    let lpTimer = 0, lpStart = null;
    function cardTip(card, px, py) {
        if (!card) return;
        tt.innerHTML = `<b style="color:var(--${card.rarity}); font-size:20px;">${card.name}</b><br><i style="color:#a1a1aa; font-size:14px; display:block; margin:8px 0;">"${card.desc}"</i><hr style="border-color:#27272a; margin:12px 0;"><span style="color:#22c55e">▲ ${card.buff}</span><br><span style="color:#ef4444">▼ ${card.debuff}</span>`;
        tt.classList.add('visible');
        const w = tt.offsetWidth || 260, h = tt.offsetHeight || 160;
        tt.style.left = Math.max(8, Math.min(innerWidth - w - 8, px - w / 2)) + 'px';
        tt.style.top = Math.max(8, py - h - 120) + 'px';
    }
    const hand = $('hand-container');
    hand.addEventListener('pointerdown', e => {
        if (!isT(e) || !e.target.closest || !e.target.closest('.hand-card')) return;
        clearTimeout(lpTimer); lpStart = { x: e.clientX, y: e.clientY, id: e.pointerId, idx: [...hand.querySelectorAll('.hand-card')].indexOf(e.target.closest('.hand-card')), t: performance.now(), shown: false };
        lpTimer = setTimeout(() => { if (lpStart && (draggingCardIndex === lpStart.idx || draggingCardIndex === -1) && !hoveredDropTower) { lpStart.shown = true; cardTip(playerHand[lpStart.idx], lpStart.x, lpStart.y); } }, 450);
    });
    window.addEventListener('pointermove', e => { if (lpStart && e.pointerId === lpStart.id && Math.hypot(e.clientX - lpStart.x, e.clientY - lpStart.y) > 18) { clearTimeout(lpTimer); lpStart = null; } }, { passive: true });
    const lpEnd = e => {
        if (!lpStart || e.pointerId !== lpStart.id) return;
        clearTimeout(lpTimer); const s = lpStart; lpStart = null;
        if (e.type === 'pointerup' && !s.shown && performance.now() - s.t < 350) cardTip(playerHand[s.idx], s.x, s.y);   // toque rápido = mostra info (some sozinho em ~3,5s)
        else tt.classList.remove('visible');
    };
    window.addEventListener('pointerup', lpEnd); window.addEventListener('pointercancel', lpEnd);

    /* ── TOOLTIP: nunca sai da tela; durante arrasto de carta fica acima da carta (não debaixo do dedo) ── */
    let clamping = false;
    new MutationObserver(() => {
        if (clamping || !tt.classList.contains('visible')) return;
        clamping = true;
        const w = tt.offsetWidth, h = tt.offsetHeight;
        let l = parseFloat(tt.style.left) || 0, t = parseFloat(tt.style.top) || 0;
        if (dragElement) t = Math.min(t, (parseFloat(dragElement.style.top) || 0) - h - 8);
        tt.style.left = Math.max(8, Math.min(l, innerWidth - w - 8)) + 'px';
        tt.style.top = Math.max(8, Math.min(t, innerHeight - h - 8)) + 'px';
        clamping = false;
    }).observe(tt, { attributes: true, attributeFilter: ['style', 'class'] });

    /* ── TOOLTIP no toque: toque no mapa limpa a anterior; some sozinho após ~3,5s (não fica "preso") ── */
    let ttHide = 0;
    new MutationObserver(() => {
        const vis = tt.classList.contains('visible');
        if (!vis) { clearTimeout(ttHide); ttHide = 0; return; }
        if (!ttHide && !dragElement && !lpStart) ttHide = setTimeout(() => { ttHide = 0; if (!dragElement && !lpStart) { tt.classList.remove('visible'); window.lastHoveredTower = null; } }, 3500);
    }).observe(tt, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pointerdown', e => { if (isT(e) && e.target === cv) { tt.classList.remove('visible'); window.lastHoveredTower = null; } }, true);

    /* ── HUD COMPACTO + GAVETA DO PAINEL LATERAL ── */
    const sb = $('sidebar'), orig = { hp: $('hp'), gold: $('gold'), wave: $('wave'), go: $('btn-start-wave') };
    const mini = document.createElement('div'); mini.id = 'nx-mini';
    mini.innerHTML = '<button id="nx-mini-toggle" type="button" aria-label="Abrir/fechar painel"><i class="fa-solid fa-table-columns"></i></button>' +
        '<span class="nx-m">❤️ <b id="nx-m-hp"></b></span><span class="nx-m">💰 <b id="nx-m-gold"></b></span><span class="nx-m">🌊 <b id="nx-m-wave"></b></span><span class="nx-m">⭐ <b id="nx-m-lv"></b></span>' +
        '<button id="nx-mini-go" type="button"></button>';
    document.body.appendChild(mini);
    const mHp = $('nx-m-hp'), mGold = $('nx-m-gold'), mWave = $('nx-m-wave'), mLv = $('nx-m-lv'), mGo = $('nx-mini-go');
    const toggle = $('nx-mini-toggle');
    toggle.addEventListener('click', () => { try { SFX.ui_click(); } catch (e) {} sb.classList.toggle('nx-open'); toggle.classList.toggle('on', sb.classList.contains('nx-open')); });
    mGo.addEventListener('click', () => { if (orig.go && !orig.go.disabled) orig.go.click(); });       // usa o botão original (mesma lógica, tutorial, etc.)
    document.addEventListener('pointerdown', e => {                                                      // tocar no mapa fecha a gaveta
        if (sb.classList.contains('nx-open') && e.target === cv) { sb.classList.remove('nx-open'); toggle.classList.remove('on'); }
    });
    function syncMini() {
        const set = (el, v) => { if (el.textContent !== v) el.textContent = v; };
        set(mHp, orig.hp.textContent); set(mGold, orig.gold.textContent); set(mWave, orig.wave.textContent); if (window.nxLv) set(mLv, String(window.nxLv()));
        mHp.classList.toggle('danger', orig.hp.classList.contains('danger'));
        const dis = !!orig.go.disabled; mGo.disabled = dis;
        set(mGo, dis ? '⚔ EM ONDA' : '▶ ' + orig.go.innerText.replace(/^INICIAR\s*/i, '').trim());
        mini.classList.toggle('hide', !!(menuActive || gameOver));
    }
    setInterval(syncMini, 200); syncMini();

    /* ── TUTORIAL no toque: gaveta abre só quando o alvo está nela (e fecha ao tocar no mapa); diálogo sai da frente do alvo ── */
    const dlg = $('nx-dlg'); let tutKey = '', tutClosed = false;
    function tutLayout() {
        const talk = dlg.classList.contains('talk'), sel = window.nxSpotSel;
        let els = [];
        try { els = talk ? (sel ? [...document.querySelectorAll(sel)] : []) : [...document.querySelectorAll('.nx-hl')]; } catch (e) {}
        const inSb = els.some(el => sb.contains(el));
        const key = (talk ? 't' : 'h') + (sel || '') + inSb;
        if (key !== tutKey) { tutKey = key; tutClosed = false; }
        sb.classList.toggle('nx-force', inSb && !tutClosed && (talk || !!document.querySelector('.nx-hl')));
        let top = false;
        if (talk && els.length && !inSb) { const ys = els.map(el => el.getBoundingClientRect()).filter(r => r.width > 2); if (ys.length) top = ys.reduce((a, r) => a + (r.top + r.bottom) / 2, 0) / ys.length > innerHeight * 0.5; }
        dlg.classList.toggle('nx-top', top); dlg.classList.toggle('nx-side', talk && inSb);
        const mb = $('nx-meta-btn'); if (mb) mb.classList.toggle('tut-show', talk && sel === '#nx-meta-btn');
    }
    setInterval(tutLayout, 150);
    document.addEventListener('pointerdown', e => { if (e.target === cv) { tutClosed = true; sb.classList.remove('nx-force'); } });
    toggle.addEventListener('click', () => { tutClosed = true; sb.classList.remove('nx-force'); });

    /* ── Aviso de orientação (celular em retrato): não bloqueia o jogo ── */
    const rot = document.createElement('div'); rot.id = 'nx-rotate';
    rot.innerHTML = '<span>📱↻ Gire o aparelho para jogar na horizontal</span><button type="button" aria-label="Fechar">✕</button>';
    document.body.appendChild(rot);
    rot.querySelector('button').addEventListener('click', () => rot.classList.add('gone'));

    /* ── Primeiro toque desbloqueia a música (alguns navegadores só aceitam pointer/touch como gesto) ── */
    window.addEventListener('pointerup', function once(e) {
        if (!isT(e)) return;
        const m = $('bg-music'); if (m && m.paused) { m.volume = (typeof musicVol === 'function') ? musicVol() : m.volume; m.play().catch(() => {}); }
        window.removeEventListener('pointerup', once);
    });
})();
