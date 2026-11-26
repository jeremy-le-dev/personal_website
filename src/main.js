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
document.getElementById('age').textContent = getAge(new Date(1994, 10, 8));
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

/* ---------- A thread that draws itself as you scroll, with a knot at its tip ---------- */
const thread = document.getElementById('thread');
const threadPath = document.getElementById('thread-path');
const knot = document.getElementById('thread-knot');
const head = document.getElementById('tip-head');
const bubble = document.getElementById('tip-bubble');
let reactZones = [];      // [{y, react, say}] sorted by y
let currentZone = -1, bubbleTimer;
let threadLen = 0;
let samples = [];          // [{len, y}] with y kept monotonic so we can search it
let shownLen = 0, targetLen = 0, raf = 0;

const buildThread = () => {
    if (reduceMotion || innerWidth < 760) { thread.style.display = 'none'; head.style.display = 'none'; return; }
    thread.style.display = ''; head.style.display = '';
    const docH = document.documentElement.scrollHeight;
    const w = innerWidth;
    thread.setAttribute('viewBox', `0 0 ${w} ${docH}`);
    thread.style.height = `${docH}px`;

    // Starts at the very top, runs down the hero's left margin, then down the margins
    // beside each section, crossing over only in the empty gap between sections.
    const hero = document.querySelector('.hero');
    const sections = [...document.querySelectorAll('main > section:not(.hero), main > footer')];
    const gutter = Math.max(32, (w - 960) / 2 - 48);
    const heroGutter = Math.max(28, (w - 1040) / 2 - 56);
    const heroBottom = hero.getBoundingClientRect().bottom + scrollY;
    let x = heroGutter, y = heroBottom - 60;
    let d = `M ${heroGutter + 40} -4 C ${heroGutter + 40} 90, ${heroGutter - 14} 160, ${heroGutter} 260`;
    d += ` C ${heroGutter + 16} ${heroBottom * 0.5}, ${heroGutter - 20} ${heroBottom * 0.7}, ${x} ${y}`;
    sections.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const top = r.top + scrollY, bottom = r.bottom + scrollY;
        const side = i % 2 ? gutter : w - gutter;
        const enter = top + 70;
        d += ` C ${x} ${(y + enter) / 2 + 40}, ${side} ${enter - 60}, ${side} ${enter}`;
        const exit = i === sections.length - 1 ? bottom - 160 : bottom - 50;
        const mid = (enter + exit) / 2, sway = i % 2 ? 18 : -18;
        d += ` C ${side + sway} ${enter + 80}, ${side - sway} ${mid - 80}, ${side} ${mid}`;
        d += ` c ${sway * 1.4} 18, ${sway * 0.4} 46, ${-sway * 0.6} 30`;
        d += ` C ${side - sway} ${mid + 40}, ${side + sway} ${exit - 60}, ${side} ${exit}`;
        x = side; y = exit;
    });
    threadPath.setAttribute('d', d);
    reactZones = sections.map((s) => ({
        y: s.getBoundingClientRect().top + scrollY + 70,
        react: s.dataset.react, say: s.dataset.say,
    }));
    threadLen = threadPath.getTotalLength();
    threadPath.style.strokeDasharray = threadLen;

    samples = [];
    let maxY = -Infinity;
    const n = Math.ceil(threadLen / 8);
    for (let k = 0; k <= n; k++) {
        const len = (k / n) * threadLen;
        maxY = Math.max(maxY, threadPath.getPointAtLength(len).y);
        samples.push({ len, y: maxY });
    }
    updateTarget();
    shownLen = targetLen;
    currentZone = -2;     // re-evaluate zones silently after a rebuild
    render();
};

// The tip follows a line a little below the middle of the screen
const updateTarget = () => {
    if (!samples.length) return;
    const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
    if (atBottom) { targetLen = threadLen; return; }
    const lineY = scrollY + innerHeight * 0.62;
    let lo = 0, hi = samples.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; samples[m].y < lineY ? lo = m + 1 : hi = m; }
    targetLen = samples[lo].len;
};

const render = () => {
    threadPath.style.strokeDashoffset = threadLen - shownLen;
    const p = threadPath.getPointAtLength(Math.max(0, shownLen));
    const q = threadPath.getPointAtLength(Math.max(0, shownLen - 6));
    const angle = Math.atan2(p.y - q.y, p.x - q.x) * 180 / Math.PI;
    knot.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle - 90})`);

    // The head hangs just past the knot, leaning with the speed of the scroll
    const rad = angle * Math.PI / 180;
    const hx = p.x + Math.cos(rad) * 40, hy = p.y + Math.sin(rad) * 40;
    head.style.transform = `translate(${hx}px, ${hy}px)`;
    const lean = Math.max(-25, Math.min(25, (targetLen - shownLen) * 0.08));
    head.style.setProperty('--lean', `${lean}deg`);
    head.classList.toggle('flip', hx > innerWidth / 2);

    // React when the head reaches a new section
    let zone = -1;
    for (let k = 0; k < reactZones.length; k++) if (hy >= reactZones[k].y) zone = k;
    if (zone !== currentZone) {
        const goingDown = zone > currentZone;
        currentZone = zone;
        if (zone >= 0 && goingDown) react(reactZones[zone]);
    }
};

const react = ({ react, say }) => {
    head.classList.remove('r-spin', 'r-peek', 'r-surprised', 'r-nod', 'r-shake', 'r-wave');
    void head.offsetWidth; // restart the animation
    if (react) head.classList.add(`r-${react}`);
    if (say) {
        bubble.textContent = say;
        head.classList.add('talking');
        clearTimeout(bubbleTimer);
        bubbleTimer = setTimeout(() => head.classList.remove('talking'), 1800);
    }
};

// Ease the tip toward its target so it glides instead of jumping
const tick = () => {
    const diff = targetLen - shownLen;
    shownLen += Math.abs(diff) < 0.5 ? diff : diff * 0.14;
    render();
    raf = Math.abs(targetLen - shownLen) > 0.5 ? requestAnimationFrame(tick) : 0;
};

addEventListener('scroll', () => {
    updateTarget();
    if (!raf) raf = requestAnimationFrame(tick);
}, { passive: true });
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildThread, 120); });
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

/* ---------- Portrait: gentle 3D tilt that follows the cursor ---------- */
const portrait = document.getElementById('portrait');
if (portrait && !reduceMotion) {
    addEventListener('pointermove', (e) => {
        const r = portrait.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
        const dy = (e.clientY - (r.top + r.height / 2)) / innerHeight;
        portrait.style.setProperty('--tx', `${(dx * 14).toFixed(2)}deg`);
        portrait.style.setProperty('--ty', `${(-dy * 14).toFixed(2)}deg`);
    }, { passive: true });
}
