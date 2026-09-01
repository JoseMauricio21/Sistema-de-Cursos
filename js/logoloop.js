// Logo Loop Carousel - Infinito
(function() {
    function initLogoLoop() {
        const logoLoop = document.getElementById('logoLoop');
        if (!logoLoop) return;
        
        const track = logoLoop.querySelector('.logo-loop__track');
        if (!track) return;
        
        // Obtener los slides originales
        const originalSlides = Array.from(track.children);
        
        // Clonar infinitamente (cantidad muy grande para efecto infinito)
        for (let i = 0; i < 100; i++) {
            originalSlides.forEach(slide => {
                const clonedSlide = slide.cloneNode(true);
                track.appendChild(clonedSlide);
            });
        }
        
        // Resetear la animación cuando llega al final para mantener el efecto infinito
        const trackStyle = track.style;
        let animationDuration = 0;
        
        track.addEventListener('animationiteration', () => {
            // La animación se repite infinitamente
        });
    }
    
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLogoLoop);
    } else {
        initLogoLoop();
    }
})();
