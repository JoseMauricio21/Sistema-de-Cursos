// Efecto de gradiente animado para "English Learning Platform"
(function() {
    function initGradientText() {
        const h1 = document.querySelector('.header h1');
        if (!h1) return;

        // El gradiente animado ahora está en CSS
        // Esta función simplemente asegura que el texto esté visible
        h1.style.animation = 'gradientFlow 8s ease-in-out infinite';
    }

    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGradientText);
    } else {
        initGradientText();
    }
})();
