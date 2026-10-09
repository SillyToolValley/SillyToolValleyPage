/* The full catalog and product links also work without JavaScript. */
const dialog = document.querySelector('#room-dialog');
const roomContent = dialog.querySelector('.room-content');
const motionButton = document.querySelector('#motion-toggle');
const stage = document.querySelector('#feature-stage');
const logo = document.querySelector('.hero-logo');
// Motion starts enabled; the visible control can stop it at any time.
let paused = false;
let worldController;
let returnHash = '#games';
let opener;
let entrance;
let roomTransition;

function setMotion() {
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? '모션 켜기' : '모션 끄기');
    motionButton.querySelector('.motion-label').textContent = paused ? '모션 켜기' : '모션 끄기';
    motionButton.querySelector('span').textContent = paused ? '▷' : 'Ⅱ';
    document.documentElement.classList.toggle('motion-paused', paused);
    document.documentElement.classList.toggle('motion-enabled', !paused);
    if (paused) entrance?.cancel();
    worldController?.setPaused(paused);
}
motionButton.hidden = false;
motionButton.addEventListener('click', () => { paused = !paused; setMotion(); });

if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                reveal.unobserve(entry.target);
            }
        });
    }, {threshold:.08});
    document.querySelectorAll('.game-card, .library-grid article, .milestone').forEach(el => reveal.observe(el));
    document.documentElement.classList.add('reveal-ready');
    const nav = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const link = document.querySelector(`.top-nav a[href="#${entry.target.id}"]`);
            if (entry.isIntersecting) link?.setAttribute('aria-current', 'location');
            else link?.removeAttribute('aria-current');
        });
    }, {rootMargin:'-20% 0px -40% 0px'});
    ['games','studio'].forEach(id => nav.observe(document.getElementById(id)));
}

function openRoom(id, source) {
    const article = document.getElementById(`room-${id}`);
    if (!article || typeof dialog.showModal !== 'function') return;
    if (!dialog.open) {
        opener = source || document.activeElement;
        returnHash = location.hash.startsWith('#room-') ? '#games' : location.hash || '#welcome';
    }
    roomContent.replaceChildren(article.cloneNode(true));
    const clone = roomContent.firstElementChild;
    clone.removeAttribute('id');
    clone.querySelector('h2').id = 'room-title';
    clone.querySelector('.back-link').addEventListener('click', event => { event.preventDefault(); dialog.close(); });
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add('room-open');
    worldController?.setSuspended(true);
    if (location.hash !== `#room-${id}`) history.pushState({room:id}, '', `#room-${id}`);
}
document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#room-"]');
    if (!link || typeof dialog.showModal !== 'function' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const image = link.querySelector('img') || link.closest('.game-card')?.querySelector('.game-art img');
    const id = link.hash.slice(6);
    if (!paused && image && document.startViewTransition && !roomTransition) {
        image.style.viewTransitionName = 'game-cover';
        const transition = document.startViewTransition(() => {
            image.style.viewTransitionName = '';
            openRoom(id, link);
            const cover = roomContent.querySelector('.detail-cover');
            if (cover) cover.style.viewTransitionName = 'game-cover';
        });
        roomTransition = transition;
        transition.finished.catch(() => {}).finally(() => {
            image.style.viewTransitionName = '';
            roomContent.querySelector('.detail-cover')?.style.removeProperty('view-transition-name');
            roomTransition = null;
        });
    } else openRoom(id, link);
});
dialog.querySelector('.room-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
    document.body.classList.remove('room-open');
    roomContent.replaceChildren(); // Removing the iframe stops video playback.
    worldController?.setSuspended(false);
    if (location.hash.startsWith('#room-')) history.replaceState(null, '', returnHash);
    opener?.focus({preventScroll:true});
});
window.addEventListener('popstate', () => {
    if (location.hash.startsWith('#room-')) openRoom(location.hash.slice(6));
    else if (dialog.open) dialog.close();
});
if (typeof dialog.showModal === 'function') document.documentElement.classList.add('rooms-enhanced');
if (location.hash.startsWith('#room-')) openRoom(location.hash.slice(6));
setMotion();

// A finite logo entrance; the art beneath it uses its own camera easing.
if (!paused && typeof logo.animate === 'function') {
    entrance = logo.animate([
        {opacity:0, transform:'translateY(28px)'},
        {opacity:1, transform:'translateY(0)'}
    ], {duration:1050, delay:140, easing:'cubic-bezier(.16,1,.3,1)', fill:'backwards'});
}
const revision = new URL(document.querySelector('script[src*="js/home.js"]').src).search;
import('./world.js' + revision).then(async ({createWorld}) => {
    worldController = await createWorld(document.querySelector('#hero-canvas'), stage, logo);
    worldController.setPaused(paused);
    worldController.setSuspended(dialog.open);
}).catch(error => {
    document.documentElement.classList.remove('world-ready');
    console.warn('Hero rendering unavailable. Official artwork remains visible.', error);
});
