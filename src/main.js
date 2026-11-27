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
const startReveals = () => document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ---------- A thread that draws itself as you scroll, with my head hanging from its tip ---------- */
const thread = document.getElementById('thread');
const threadPath = document.getElementById('thread-path');
const knot = document.getElementById('thread-knot');
const head = document.getElementById('tip-head');
const tilt = document.getElementById('tip-tilt');
const body = document.getElementById('tip-body');
const fx = document.getElementById('tip-fx');
const prop = document.getElementById('tip-prop');
const bubble = document.getElementById('tip-bubble');

let threadLen = 0, samples = [], reactZones = [];
let shownLen = 0, targetLen = 0, raf = 0;
let docked = false;                       // reduced motion: no thread, the head sits in a corner
let compact = false;                      // phones: a thinner thread down the right edge, smaller head
let headScale = 1;
let started = false;                      // the thread waits for the loader before it moves
let introStart = 0, introFrom = 0;
const INTRO_MS = 1100;
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
let swing = 0, swingVel = 0, lastX = null; // pendulum
let currentZone = null;
let built = false, intro = false;

const buildThread = () => {
    const sections = [...document.querySelectorAll('main > section:not(.hero), main > footer')];
    reactZones = sections.map((s) => ({
        el: s, y: s.getBoundingClientRect().top + scrollY + 70,
        react: s.dataset.react, say: s.dataset.say,
    }));
    docked = reduceMotion;
    compact = !docked && innerWidth < 760;
    headScale = compact ? 0.45 : 1;
    head.classList.toggle('docked', docked);
    head.classList.toggle('compact', compact);
    thread.style.display = docked ? 'none' : '';
    head.style.transform = '';
    if (docked) { samples = []; head.classList.add('ready'); checkZone(); return; }

    const docH = document.documentElement.scrollHeight;
    const w = innerWidth;
    thread.setAttribute('viewBox', `0 0 ${w} ${docH}`);
    thread.style.height = `${docH}px`;

    let d;
    if (compact) {
        // Phones: a thin thread down the right edge, wiggling a little and looping at each section
        const x0 = w - 36; // keeps the whole portrait on screen
        d = `M ${x0} -4`;
        let y = -4, k = 0;
        const loops = sections.map((s) => s.getBoundingClientRect().top + scrollY + 70);
        const end = docH - 160;
        while (y < end) {
            const next = Math.min(end, y + 220);
            const sway = k++ % 2 ? 7 : -7;
            d += ` C ${x0 + sway} ${y + 80}, ${x0 - sway} ${next - 80}, ${x0} ${next}`;
            if (loops.length && next >= loops[0]) { loops.shift(); d += ` c -14 14, -6 34, 4 26`; }
            y = next;
        }
        buildFromPath(d);
        return;
    }

    // Starts at the very top, runs down the margin beside the intro, then down the margins
    // beside each section, crossing over only in the empty gap between sections.
    const hero = document.querySelector('.hero');
    const heroText = document.querySelector('.hero-text').getBoundingClientRect();
    const gutter = Math.max(32, (w - 960) / 2 - 60);
    const heroGutter = Math.max(40, heroText.left - 150);
    const heroBottom = hero.getBoundingClientRect().bottom + scrollY;
    let x = heroGutter, y = heroBottom - 60;
    d = `M ${heroGutter + 40} -4 C ${heroGutter + 40} 90, ${heroGutter - 14} 160, ${heroGutter} 260`;
    d += ` C ${heroGutter + 16} ${heroBottom * 0.5}, ${heroGutter - 20} ${heroBottom * 0.7}, ${x} ${y}`;
    sections.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        const top = r.top + scrollY, bottom = r.bottom + scrollY;
        const side = i % 2 ? gutter : w - gutter;
        const enter = top + 70;
        d += ` C ${x} ${(y + enter) / 2 + 40}, ${side} ${enter - 60}, ${side} ${enter}`;
        const exit = i === sections.length - 1 ? bottom - 200 : bottom - 50;
        const mid = (enter + exit) / 2, sway = i % 2 ? 18 : -18;
        d += ` C ${side + sway} ${enter + 80}, ${side - sway} ${mid - 80}, ${side} ${mid}`;
        d += ` c ${sway * 1.4} 18, ${sway * 0.4} 46, ${-sway * 0.6} 30`;
        d += ` C ${side - sway} ${mid + 40}, ${side + sway} ${exit - 60}, ${side} ${exit}`;
        x = side; y = exit;
    });
    buildFromPath(d);
};

const buildFromPath = (d) => {
    threadPath.setAttribute('d', d);
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
    if (!built) {
        // First build happens behind the loader: nothing drawn yet
        built = true;
        shownLen = 0;
        lastX = null;
        render();
    } else if (started) {
        // Later rebuilds (fonts, images, resize): keep gliding from where we are
        shownLen = Math.min(shownLen, threadLen);
        lastX = null;
        if (!raf) raf = requestAnimationFrame(tick);
    }
};

// The tip follows a line a little below the middle of the screen
const lineY = () => scrollY + innerHeight * 0.62;
const updateTarget = () => {
    if (!samples.length) return;
    const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
    if (atBottom) { targetLen = threadLen; return; }
    const ly = lineY();
    let lo = 0, hi = samples.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; samples[m].y < ly ? lo = m + 1 : hi = m; }
    targetLen = samples[lo].len;
};

// Where the portrait hangs for a given length of thread
const headPoint = (len) => {
    const p = threadPath.getPointAtLength(len);
    const q = threadPath.getPointAtLength(Math.max(0, len - 6));
    const rad = Math.atan2(p.y - q.y, p.x - q.x);
    return { hx: p.x + Math.cos(rad) * 16, hy: p.y + Math.sin(rad) * 16 };
};

const render = () => {
    threadPath.style.strokeDashoffset = threadLen - shownLen;
    const p = threadPath.getPointAtLength(Math.max(0, shownLen));
    const q = threadPath.getPointAtLength(Math.max(0, shownLen - 6));
    const angle = Math.atan2(p.y - q.y, p.x - q.x) * 180 / Math.PI;
    knot.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle - 90})`);

    // The portrait hangs from the knot like a pendant and swings when the thread moves sideways
    const { hx, hy } = headPoint(Math.max(0, shownLen));
    head.style.transform = `translate(${hx}px, ${hy}px)`;
    const vx = lastX === null ? 0 : hx - lastX;
    lastX = hx;
    swingVel += (Math.max(-35, Math.min(35, vx * 2.2)) - swing) * 0.08;
    swingVel *= 0.86;
    swing += swingVel;
    tilt.style.transform = `rotate(${swing.toFixed(2)}deg)`;
    head.classList.toggle('flip', hx > innerWidth / 2);
    checkZone();
};

// Ease the tip toward its target so it glides instead of jumping, and let the pendulum settle
const tick = () => {
    if (intro) {
        const t = Math.min(1, (performance.now() - introStart) / INTRO_MS);
        shownLen = introFrom + (targetLen - introFrom) * easeOutCubic(t);
        if (t >= 1) intro = false;
    } else {
        const diff = targetLen - shownLen;
        shownLen += Math.abs(diff) < 0.5 ? diff : diff * 0.14;
    }
    render();
    const busy = intro || Math.abs(targetLen - shownLen) > 0.5 || Math.abs(swingVel) > 0.02 || Math.abs(swing) > 0.1;
    raf = busy ? requestAnimationFrame(tick) : 0;
};

/* ---------- Reactions when the head reaches a section ---------- */
const checkZone = () => {
    const ly = lineY();
    let zone = -1;
    reactZones.forEach((z, k) => { if (ly >= z.y + 60) zone = k; });
    if (currentZone === null) { currentZone = zone; return; } // no reaction on first paint
    if (zone === currentZone) return;
    const down = zone > currentZone;
    currentZone = zone;
    if (down && zone >= 0) react(reactZones[zone]);
};

const spring = 'cubic-bezier(.3, 1.6, .5, 1)';
const play = (el, frames, opts) => el.animate(frames, { duration: 700, easing: 'ease-out', ...opts });
const side = () => (head.classList.contains('flip') ? -1 : 1); // which way the page content is

const burstStars = (spread = 70) => {
    fx.querySelectorAll('.stars path').forEach((star, i, all) => {
        const a = (-90 + (i - (all.length - 1) / 2) * 38) * Math.PI / 180;
        play(star, [
            { transform: 'translate(0, 0) scale(.2) rotate(0deg)', opacity: 1 },
            { transform: `translate(${Math.cos(a) * spread}px, ${Math.sin(a) * spread}px) scale(1.3) rotate(120deg)`, opacity: 1, offset: .6 },
            { transform: `translate(${Math.cos(a) * spread * 1.2}px, ${Math.sin(a) * spread * 1.2}px) scale(.4) rotate(200deg)`, opacity: 0 },
        ], { duration: 900, delay: i * 40, easing: 'cubic-bezier(.2,.8,.3,1)' });
    });
};
const shockLines = () => {
    fx.querySelectorAll('.shock path').forEach((l, i) => play(l, [
        { strokeDashoffset: 30, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: .5 }, { strokeDashoffset: -30, opacity: 0 },
    ], { duration: 650, delay: i * 50 }));
};
const showProp = (emoji, frames, opts) => {
    prop.textContent = emoji;
    return play(prop, frames, { fill: 'forwards', ...opts });
};

const reactions = {
    // Ray: a coin flip with a burst of sparkles
    spin: () => {
        play(body, [{ transform: 'rotateY(0) scale(1)' }, { transform: 'rotateY(180deg) scale(1.15)', offset: .5 }, { transform: 'rotateY(360deg) scale(1)' }],
            { duration: 900, easing: 'cubic-bezier(.45,0,.2,1)' });
        burstStars();
    },
    // Projects: leans over toward the list to have a look
    peek: () => play(body, [
        { transform: 'none' },
        { transform: `translateX(${side() * 18}px) rotate(${side() * 16}deg) scale(1.08)`, offset: .25 },
        { transform: `translateX(${side() * 18}px) rotate(${side() * 10}deg) scale(1.08)`, offset: .7 },
        { transform: 'none' },
    ], { duration: 1600, easing: 'ease-in-out' }),
    // Screenshots: a proper cartoon double take
    surprised: () => {
        play(body, [
            { transform: 'none' },
            { transform: 'translateY(6px) scale(1.12, .84)', offset: .15 },
            { transform: 'translateY(-34px) scale(.9, 1.16)', offset: .4 },
            { transform: 'translateY(-34px) scale(1.04)', offset: .55 },
            { transform: 'translateY(4px) scale(1.1, .9)', offset: .75 },
            { transform: 'none' },
        ], { duration: 950, easing: 'ease-out' });
        setTimeout(shockLines, 250);
    },
    // Experience: two thoughtful nods
    nod: () => play(body, [
        { transform: 'none' }, { transform: 'translateY(6px) rotateX(28deg)' }, { transform: 'none' },
        { transform: 'translateY(6px) rotateX(28deg)' }, { transform: 'none' },
    ], { duration: 1100, easing: 'ease-in-out' }),
    // Toolbox: a quick "let's go" shake
    shake: () => {
        play(body, [0, -10, 10, -8, 8, -4, 0].map((r, i) => ({ transform: `rotate(${r}deg) translateX(${r * .6}px)` })), { duration: 700 });
        burstStars(50);
    },
    // School: a graduation cap drops onto the head
    cap: () => {
        showProp('🎓', [
            { transform: 'translate(-50%, -90px) rotate(-30deg)', opacity: 0 },
            { transform: 'translate(-50%, 2px) rotate(8deg)', opacity: 1, offset: .55 },
            { transform: 'translate(-50%, -10px) rotate(-4deg)', opacity: 1, offset: .75 },
            { transform: 'translate(-50%, 0) rotate(-12deg)', opacity: 1 },
        ], { duration: 900, easing: 'ease-out' }).finished.then(() => setTimeout(() =>
            play(prop, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }), 1600));
        play(body, [{ transform: 'none' }, { transform: 'translateY(6px) scale(1.06, .92)', offset: .6 }, { transform: 'none' }], { duration: 900 });
    },
    // Footer: a big wave
    wave: () => {
        showProp('👋', [
            { transform: 'translate(-50%, 0) translateX(46px) scale(0) rotate(0)', opacity: 0, transformOrigin: '70% 80%' },
            { transform: 'translate(-50%, 0) translateX(46px) scale(1) rotate(-20deg)', opacity: 1, offset: .2 },
            { transform: 'translate(-50%, 0) translateX(46px) scale(1) rotate(20deg)', opacity: 1, offset: .4 },
            { transform: 'translate(-50%, 0) translateX(46px) scale(1) rotate(-20deg)', opacity: 1, offset: .6 },
            { transform: 'translate(-50%, 0) translateX(46px) scale(1) rotate(15deg)', opacity: 1, offset: .8 },
            { transform: 'translate(-50%, 0) translateX(46px) scale(1) rotate(0)', opacity: 1 },
        ], { duration: 1500, easing: 'ease-in-out' });
        play(body, [{ transform: 'none' }, { transform: 'translateY(-12px)' }, { transform: 'none' }], { duration: 600, easing: spring });
    },
};

let bubbleTimer;
const say = (text, ms = 2200) => {
    bubble.textContent = text;
    bubble.getAnimations().forEach((a) => a.cancel());
    play(bubble, [
        { opacity: 0, transform: 'translateY(10px) scale(.4) rotate(-12deg)' },
        { opacity: 1, transform: 'translateY(0) scale(1.08) rotate(3deg)', offset: .6 },
        { opacity: 1, transform: 'scale(1) rotate(-2deg)' },
    ], { duration: 450, easing: 'ease-out', fill: 'forwards' });
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => play(bubble, [
        { opacity: 1, transform: 'scale(1) rotate(-2deg)' }, { opacity: 0, transform: 'translateY(-6px) scale(.8) rotate(-2deg)' },
    ], { duration: 250, fill: 'forwards' }), ms);
};

const react = ({ react: name, say: text }) => {
    if (text) say(text);
    if (reduceMotion) return;
    prop.getAnimations().forEach((a) => a.cancel());
    prop.textContent = '';
    reactions[name]?.();
    // the outline pentagon pulses each time
    play(body.querySelector('.tip-frame'), [{ transform: 'translate(7px, 7px) rotate(3deg)' }, { transform: 'translate(12px, 12px) rotate(8deg) scale(1.06)' }, { transform: 'translate(7px, 7px) rotate(3deg)' }], { duration: 600, easing: spring });
};

addEventListener('scroll', () => {
    if (!started) return;
    if (docked) { checkZone(); return; }
    updateTarget();
    if (!raf) raf = requestAnimationFrame(tick);
}, { passive: true });
// Rebuild whenever the page height changes (late fonts and images on a first visit, resize...)
let resizeTimer;
const scheduleBuild = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildThread, 120); };
addEventListener('resize', scheduleBuild);
new ResizeObserver(scheduleBuild).observe(document.querySelector('main'));
/* ---------- Loader: wait until everything is really ready, then hand over to the thread ---------- */
const loader = document.getElementById('loader');
const stage = document.getElementById('loader-stage');
const count = document.getElementById('loader-count');
const loaderStart = performance.now();
const MIN_MS = 900, MAX_MS = 4000; // analytics and other third parties are not waited for

const waitImage = (img) => (img.complete && img.naturalWidth
    ? (img.decode ? img.decode().catch(() => {}) : Promise.resolve())
    : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); })
        .then(() => img.decode?.().catch(() => {})));
const tasks = [
    // fonts: wait, but never more than 2.5 s for a slow font server
    Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]),
    ...[...document.images].filter((img) => img.getAttribute('src')).map(waitImage),
];
let done = 0;
tasks.forEach((t) => t.then(() => { done++; }));
const allReady = Promise.race([Promise.all(tasks), new Promise((r) => setTimeout(r, MAX_MS))]);
let isReady = false;
allReady.then(() => { isReady = true; });

let shownP = 0;
const loaderTick = () => {
    const realP = isReady ? 1 : done / tasks.length;
    const elapsed = performance.now() - loaderStart;
    // never run ahead of the clock, so the fill always takes at least MIN_MS
    const goal = Math.min(realP, elapsed / MIN_MS);
    shownP += (goal - shownP) * 0.12;
    if (goal === 1 && shownP > 0.995) shownP = 1;
    loader.style.setProperty('--p', shownP.toFixed(4));
    count.textContent = `${Math.round(shownP * 100)}%`;
    if (shownP < 1) requestAnimationFrame(loaderTick);
    else requestAnimationFrame(() => requestAnimationFrame(exitLoader));
};

const exitLoader = () => {
    buildThread();
    started = true;
    head.classList.add('ready');
    if (docked) {
        // reduced motion: just a quiet fade
        loader.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => loader.remove());
        startReveals();
        return;
    }
    // Where the portrait will hang once the thread has drawn itself
    const { hx, hy } = headPoint(targetLen);
    const from = stage.getBoundingClientRect();
    const fromX = from.left + 67, fromY = from.top + 10; // the pivot the portrait hangs from
    const dx = hx - scrollX - fromX, dy = hy - scrollY - fromY;

    head.style.visibility = 'hidden';
    stage.style.animation = 'none';
    count.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: 200, fill: 'forwards' });
    document.getElementById('loader-thread').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
    stage.animate([
        { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(${(1 + headScale) / 2 * 1.08}) rotate(${dx > 0 ? 8 : -8}deg)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(${headScale}) rotate(0deg)` },
    ], { duration: INTRO_MS, easing: 'cubic-bezier(.45, 0, .2, 1)', fill: 'forwards' });
    loader.animate([{ backgroundColor: getComputedStyle(loader).backgroundColor }, { backgroundColor: 'transparent' }],
        { duration: 600, delay: 150, easing: 'ease-out', fill: 'forwards' });
    loader.style.pointerEvents = 'none';

    // the page and the thread arrive together
    startReveals();
    intro = true; introStart = performance.now(); introFrom = 0;
    if (!raf) raf = requestAnimationFrame(tick);

    setTimeout(() => {
        head.style.visibility = '';
        loader.remove();
        play(body, [{ transform: 'scale(1.08, .9)' }, { transform: 'scale(.96, 1.04)' }, { transform: 'none' }], { duration: 450, easing: spring });
        if (scrollY < 200) setTimeout(() => say("Hi, that's me! 👋", 2600), 250);
    }, INTRO_MS);
};

// Measure the layout as soon as fonts are in, so nothing moves under the loader later
document.fonts?.ready.then(buildThread);
requestAnimationFrame(loaderTick);

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
