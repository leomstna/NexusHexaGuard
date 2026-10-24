/* MOBILE: marca aparelhos de toque (ponteiro principal "grosso"). No PC com mouse a classe NÃO é aplicada e nada muda. */
        (function () { try { var mm = function (q) { return window.matchMedia && window.matchMedia(q).matches; }; if (mm('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mm('(pointer: fine)'))) document.documentElement.classList.add('nx-touch'); } catch (e) {} })();
