document.addEventListener('DOMContentLoaded', function () {
    const navbar = document.getElementById('navbar');
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    window.addEventListener('scroll', function () {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    menuToggle.addEventListener('click', function () {
        this.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function (e) {
            if (this.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                    navLinks.classList.remove('active');
                    menuToggle.classList.remove('active');
                }

                navLinks.querySelectorAll('a').forEach(a => a.classList.remove('active'));
                this.classList.add('active');
            }
        });
    });
});
