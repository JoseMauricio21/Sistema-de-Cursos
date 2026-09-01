/* =============================================
   welcome-lottie.js — Logica INDIVIDUAL
   Reproduce Welcome.json (493 frames) y resuelve
   ============================================= */

(function (global) {
    'use strict';

    const WELCOME_LOTTIE_PATH = '../Animaciones%20lottiefiles/Welcome.json';
    const WELCOME_LOTTIE_TOTAL_FRAMES = 493;
    const LOTTIE_PLAYBACK_SPEED = 1;
    const MAX_WAIT_MS = 12000;

    function playWelcomeLottie() {
        return new Promise((resolve) => {
            const wrap = document.getElementById('welcomeLottieWrap');
            const player = document.getElementById('welcomeLottiePlayer');

            if (!wrap || !player || !global.lottie) {
                console.warn('[WELCOME-LOTTIE] ⚠️ No hay contenedor o lottie-web. Saltando.');
                resolve({ played: false, durationMs: 0 });
                return;
            }

            let settled = false;
            const settle = (result) => {
                if (settled) return;
                settled = true;
                wrap.classList.add('is-leaving');
                global.setTimeout(() => {
                    wrap.classList.add('is-hidden');
                    resolve(result);
                }, 520);
            };

            let anim;
            let startTime = 0;
            let loadedFrames = WELCOME_LOTTIE_TOTAL_FRAMES;

            try {
                anim = global.lottie.loadAnimation({
                    container: player,
                    renderer: 'svg',
                    loop: false,
                    autoplay: true,
                    path: WELCOME_LOTTIE_PATH,
                    rendererSettings: {
                        progressiveLoad: true,
                        preserveAspectRatio: 'xMidYMid meet',
                    },
                });
            } catch (err) {
                console.warn('[WELCOME-LOTTIE] ⚠️ Error al crear animacion:', err);
                settle({ played: false, durationMs: 0 });
                return;
            }

            anim.setSpeed(LOTTIE_PLAYBACK_SPEED);

            anim.addEventListener('data_failed', () => {
                console.warn('[WELCOME-LOTTIE] ⚠️ data_failed');
                settle({ played: false, durationMs: 0, reason: 'data_failed' });
            });

            anim.addEventListener('data_ready', () => {
                try {
                    const total = anim.totalFrames || WELCOME_LOTTIE_TOTAL_FRAMES;
                    loadedFrames = Math.max(WELCOME_LOTTIE_TOTAL_FRAMES, total);
                    anim.goToAndPlay(0, true);
                    startTime = performance.now();
                } catch (e) {
                    console.warn('[WELCOME-LOTTIE] ⚠️ data_ready error:', e);
                }
            });

            anim.addEventListener('enterFrame', (evt) => {
                try {
                    if (evt && typeof evt.currentTime !== 'undefined') {
                        if (evt.currentTime >= loadedFrames - 0.05) {
                            const elapsed = performance.now() - startTime;
                            settle({ played: true, durationMs: elapsed, reason: 'last_frame' });
                        }
                    }
                } catch {
                    // ignore
                }
            });

            anim.addEventListener('complete', () => {
                const elapsed = startTime ? performance.now() - startTime : 2500;
                settle({ played: true, durationMs: elapsed, reason: 'complete' });
            });

            global.setTimeout(() => {
                try {
                    if (anim && anim.goToAndStop) {
                        anim.goToAndStop(loadedFrames, true);
                    }
                } catch {
                    // ignore
                }
                const elapsed = startTime ? performance.now() - startTime : 2500;
                settle({ played: true, durationMs: elapsed, reason: 'timeout_fallback' });
            }, MAX_WAIT_MS);
        });
    }

    global.WelcomeLottie = {
        play: playWelcomeLottie,
    };
})(window);
