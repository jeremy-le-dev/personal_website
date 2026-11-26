import pdfURL from '../assets/Jérémy FROMENT - CV.pdf?url';

const root = document.documentElement;
root.classList.add('js');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Theme ---------- */
const setTheme = (mode) => {
    const dark = mode === 'dark';
    root.classList.toggle('dark', dark);
    localStorage.theme = dark ? 'dark' : 'light';
};
document.querySelector('#btn-change-theme').addEventListener('click', () => {
    setTheme(root.classList.contains('dark') ? 'light' : 'dark');
});

/* ---------- Small facts ---------- */
const getAge = (birth) => {
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
    return age;
};
document.getElementById('age').textContent = getAge(new Date(1994, 11, 8));
document.getElementById('year').textContent = new Date().getFullYear();
document.querySelector('#download-pdf').href = pdfURL;

/* ---------- Print mode (?print=1) ---------- */
if (new URLSearchParams(location.search).get('print')) {
    document.body.classList.add('print');
    root.classList.remove('js');
}

/* ---------- Hand-drawn SVGs: measure each stroke so it can be "drawn" ---------- */
document.querySelectorAll('.draw').forEach((svg) => {
    svg.querySelectorAll('path').forEach((p, i) => {
        p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 1);
        p.style.setProperty('--i', i);
    });
});

/* ---------- Reveal on scroll, staggered inside each section ---------- */
document.querySelectorAll('section, footer').forEach((section) => {
    section.querySelectorAll('.reveal').forEach((el, i) => el.style.setProperty('--d', `${i * 90}ms`));
});
const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
        if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
        }
    });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ---------- A thread that draws itself as you scroll ---------- */
const thread = document.getElementById('thread');
const threadPath = document.getElementById('thread-path');
let threadLen = 0;

const buildThread = () => {
    if (reduceMotion || innerWidth < 760) { thread.style.display = 'none'; return; }
    thread.style.display = '';
    const docH = document.documentElement.scrollHeight;
    const w = innerWidth;
    thread.setAttribute('viewBox', `0 0 ${w} ${docH}`);
    thread.style.height = `${docH}px`;

    // Run down the margins beside each section, and only cross over in the empty gap between sections
    const sections = [...document.querySelectorAll('main > section:not(.hero), main > footer')];
    const gutter = Math.max(32, (w - 960) / 2 - 48);
    const hero = document.querySelector('.hero').getBoundingClientRect();
    let x = w / 2, y = hero.bottom + scrollY - 40;
    let d = `M ${x} ${y}`;
    sections.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const top = r.top + scrollY, bottom = r.bottom + scrollY;
        const side = i % 2 ? w - gutter : gutter;
        const enter = top + 70;
        // swoop across the padding gap into the margin
        d += ` C ${x} ${(y + enter) / 2 + 40}, ${side} ${enter - 60}, ${side} ${enter}`;
        // wander down the margin with a gentle wiggle and a small loop
        const exit = i === sections.length - 1 ? bottom - 160 : bottom - 50;
        const mid = (enter + exit) / 2, sway = i % 2 ? -18 : 18;
        d += ` C ${side + sway} ${enter + 80}, ${side - sway} ${mid - 80}, ${side} ${mid}`;
        d += ` c ${sway * 1.4} 18, ${sway * 0.4} 46, ${-sway * 0.6} 30`;
        d += ` C ${side - sway} ${mid + 40}, ${side + sway} ${exit - 60}, ${side} ${exit}`;
        x = side; y = exit;
    });
    threadPath.setAttribute('d', d);
    threadLen = threadPath.getTotalLength();
    threadPath.style.strokeDasharray = threadLen;
    drawThread();
};

const drawThread = () => {
    if (!threadLen) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    const progress = Math.min(1, Math.max(0, scrollY / max));
    threadPath.style.strokeDashoffset = threadLen * (1 - progress);
};

let ticking = false;
addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { drawThread(); ticking = false; });
}, { passive: true });
addEventListener('resize', buildThread);
addEventListener('load', buildThread);
document.fonts?.ready.then(buildThread);

/* ---------- Draggable screenshot cards + lightbox ---------- */
const board = document.getElementById('board');
const lightbox = document.getElementById('lightbox');
let z = 1;

board.querySelectorAll('.card').forEach((card) => {
    let startX = 0, startY = 0, baseX = 0, baseY = 0, moved = false, active = false;

    card.addEventListener('pointerdown', (e) => {
        if (innerWidth < 760) return;
        active = true; moved = false;
        startX = e.clientX; startY = e.clientY;
        baseX = parseFloat(card.style.getPropertyValue('--dx')) || 0;
        baseY = parseFloat(card.style.getPropertyValue('--dy')) || 0;
        card.setPointerCapture(e.pointerId);
        card.classList.add('dragging');
        card.style.zIndex = ++z;
    });
    card.addEventListener('pointermove', (e) => {
        if (!active) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        card.style.setProperty('--dx', `${baseX + dx}px`);
        card.style.setProperty('--dy', `${baseY + dy}px`);
        // tilt with horizontal velocity for a bit of physicality
        card.style.setProperty('--r', `${Math.max(-12, Math.min(12, e.movementX * 0.8))}deg`);
    });
    const end = () => {
        if (!active) return;
        active = false;
        card.classList.remove('dragging');
        card.style.setProperty('--r', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
        if (!moved) openLightbox(card.querySelector('img'));
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    card.addEventListener('click', () => { if (innerWidth < 760) openLightbox(card.querySelector('img')); });
});

const openLightbox = (img) => {
    lightbox.querySelector('img').src = img.src;
    lightbox.querySelector('img').alt = img.alt;
    lightbox.hidden = false;
};
lightbox.addEventListener('click', () => { lightbox.hidden = true; });
addEventListener('keydown', (e) => { if (e.key === 'Escape') lightbox.hidden = true; });
