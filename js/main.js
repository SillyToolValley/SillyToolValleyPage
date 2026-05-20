document.addEventListener("DOMContentLoaded", () => {
    initNavigation();
    initScrollTop();
    initFadeIn();
    initEbookLibrary();
    initCatalog();
    initSubnav();
    initTutorialClips();
});

function initNavigation() {
    const nav = document.getElementById("nav");
    const toggle = document.getElementById("navToggle");
    const menu = document.getElementById("navMenu");

    if (nav) {
        const update = () => nav.classList.toggle("is-scrolled", window.scrollY > 12);
        update();
        window.addEventListener("scroll", update, { passive: true });
    }

    if (!toggle || !menu) return;

    const setOpen = (open) => {
        toggle.classList.toggle("is-active", open);
        menu.classList.toggle("is-open", open);
        document.body.classList.toggle("nav-open", open);
        toggle.setAttribute("aria-expanded", String(open));
    };

    toggle.addEventListener("click", () => {
        setOpen(!menu.classList.contains("is-open"));
    });

    menu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => setOpen(false));
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setOpen(false);
    });
}

function initScrollTop() {
    const button = document.getElementById("scrollTop");
    if (!button) return;

    const update = () => button.classList.toggle("is-visible", window.scrollY > 620);
    update();
    window.addEventListener("scroll", update, { passive: true });

    button.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
}

function initFadeIn() {
    const items = document.querySelectorAll(".fade-in");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
        items.forEach((item) => item.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.08, rootMargin: "0px 0px -28px 0px" });

    items.forEach((item) => observer.observe(item));
}

function initEbookLibrary() {
    const stage = document.getElementById("bookshelfStage");
    const ring = document.getElementById("bookshelfRing");
    const template = document.getElementById("ebookTemplates");
    if (!stage || !ring || !template) return;

    const sourceBooks = Array.from(template.content.querySelectorAll(".library-book"));
    if (!sourceBooks.length) return;

    const title = document.getElementById("selectedBookTitle");
    const subtitle = document.getElementById("selectedBookSubtitle");
    const summary = document.getElementById("selectedBookSummary");
    const meta = document.getElementById("selectedBookMeta");
    const tags = document.getElementById("selectedBookTags");
    const readerLink = document.getElementById("selectedBookReader");

    const SLOT_COUNT = Math.max(12, sourceBooks.length * 8);
    const STEP = 360 / SLOT_COUNT;
    const RADIUS = window.matchMedia("(max-width: 720px)").matches ? 200 : 260;

    ring.style.setProperty("--ring-radius", `${RADIUS}px`);

    const slots = [];
    for (let i = 0; i < SLOT_COUNT; i += 1) {
        const source = sourceBooks[i % sourceBooks.length];
        const clone = source.cloneNode(true);
        const angle = i * STEP;
        clone.style.setProperty("--slot-angle", `${angle}deg`);
        clone.style.setProperty("--ring-radius", `${RADIUS}px`);
        const gradient = clone.dataset.spineGradient;
        if (gradient) {
            const spine = clone.querySelector(".book-spine");
            if (spine) spine.style.setProperty("--spine-gradient", gradient);
        }
        const tint = clone.dataset.coverTint;
        if (tint) {
            clone.style.setProperty("--cover-tint", tint);
        }
        clone.dataset.slotIndex = String(i);
        clone.querySelectorAll("img").forEach((img) => { img.draggable = false; });
        ring.appendChild(clone);
        slots.push({ el: clone, angle });
    }

    ring.addEventListener("dragstart", (event) => event.preventDefault());

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let ringAngle = 0;
    let activeSlot = null;
    let idleTimer = null;
    let pointerId = null;
    let dragStartX = 0;
    let dragStartAngle = 0;
    let dragMoved = false;
    let suppressClickUntil = 0;
    let momentum = 0;
    let momentumRaf = null;
    let lastMoveTime = 0;
    let lastMoveAngle = 0;
    let trackedVelocity = 0;
    let recentSpeed = 0;

    const FRONT_HALF_WINDOW = STEP * 0.55;
    const SLOW_SPEED_LIMIT = 0.9;

    const applyRingAngle = (animated = false) => {
        ring.classList.toggle("is-snapping", animated && !reduceMotion);
        ring.style.setProperty("--ring-angle", `${-ringAngle}deg`);
    };

    const setSelected = (slot) => {
        if (!slot) return;
        if (activeSlot && activeSlot !== slot) {
            activeSlot.el.classList.remove("is-active");
            activeSlot.el.setAttribute("aria-pressed", "false");
        }
        activeSlot = slot;
        slot.el.classList.add("is-active");
        slot.el.setAttribute("aria-pressed", "true");

        const data = slot.el.dataset;
        if (title) title.textContent = data.title || "";
        if (subtitle) subtitle.textContent = data.subtitle || "";
        if (summary) summary.textContent = data.summary || "";
        if (meta) meta.textContent = data.meta || "";
        if (readerLink && data.reader) readerLink.href = data.reader;

        if (tags) {
            tags.replaceChildren(...(data.tags || "")
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
                .map((tag) => {
                    const item = document.createElement("span");
                    item.textContent = tag;
                    return item;
                }));
        }
    };

    const clearActive = () => {
        if (!activeSlot) return;
        activeSlot.el.classList.remove("is-active");
        activeSlot.el.setAttribute("aria-pressed", "false");
        activeSlot = null;
    };

    const findFrontSlot = (targetAngle) => {
        const normalized = ((targetAngle % 360) + 360) % 360;
        let bestSlot = slots[0];
        let bestDist = 360;
        for (const slot of slots) {
            const diff = Math.abs(((slot.angle - normalized + 540) % 360) - 180);
            if (diff < bestDist) {
                bestDist = diff;
                bestSlot = slot;
            }
        }
        return bestSlot;
    };

    const glideTo = (target, opts) => {
        if (momentumRaf) cancelAnimationFrame(momentumRaf);
        const start = ringAngle;
        const distance = target - start;
        if (Math.abs(distance) < 0.3) {
            ringAngle = target;
            applyRingAngle(false);
            momentumRaf = null;
            recentSpeed = 0;
            return;
        }
        let duration;
        if (opts && opts.matchVelocity && Math.abs(opts.matchVelocity) > 0.001) {
            duration = Math.abs(distance) * 3 / Math.abs(opts.matchVelocity);
        } else {
            duration = Math.sqrt(Math.abs(distance)) * 60;
        }
        duration = Math.max(Math.min(duration, 1400), 320);

        const startTime = performance.now();
        const step = (now) => {
            const t = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            ringAngle = start + distance * eased;
            recentSpeed = Math.abs(3 * Math.pow(1 - t, 2) * distance / duration) * 16;
            applyRingAngle(false);
            if (t < 1) {
                momentumRaf = requestAnimationFrame(step);
            } else {
                ringAngle = target;
                recentSpeed = 0;
                momentum = 0;
                momentumRaf = null;
                applyRingAngle(false);
            }
        };
        momentumRaf = requestAnimationFrame(step);
    };

    const glideToNearestSlot = () => {
        const target = findFrontSlot(ringAngle);
        const current = ((ringAngle % 360) + 360) % 360;
        let delta = target.angle - current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        glideTo(ringAngle + delta);
    };

    const scheduleIdleSnap = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            if (momentumRaf) {
                scheduleIdleSnap();
                return;
            }
            glideToNearestSlot();
        }, 180);
    };

    const noteActivity = () => {
        clearActive();
        ring.classList.remove("is-snapping");
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
        }
    };

    const startMomentum = (initial) => {
        if (reduceMotion) {
            glideToNearestSlot();
            return;
        }
        const cappedVel = Math.max(Math.min(initial, 18), -18);
        const decay = 0.955;
        const projected = ringAngle + cappedVel * (decay / (1 - decay));
        const projectedNorm = ((projected % 360) + 360) % 360;
        const target = findFrontSlot(projected);
        let delta = target.angle - projectedNorm;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        glideTo(projected + delta, { matchVelocity: cappedVel / 16 });
    };

    const cancelMomentum = () => {
        if (momentumRaf) {
            cancelAnimationFrame(momentumRaf);
            momentumRaf = null;
        }
        momentum = 0;
    };

    const consumeSuppressedClick = (event) => {
        if (!suppressClickUntil) return false;
        const shouldSuppress = performance.now() <= suppressClickUntil;
        suppressClickUntil = 0;
        if (!shouldSuppress) return false;
        event.preventDefault();
        event.stopPropagation();
        return true;
    };

    const wheelZone = stage.querySelector(".bookshelf-row") || stage;
    wheelZone.addEventListener("wheel", (event) => {
        event.preventDefault();
        noteActivity();
        cancelMomentum();
        const delta = (event.deltaY || event.deltaX) * 0.18;
        ringAngle += delta;
        recentSpeed = Math.max(recentSpeed, Math.abs(delta));
        applyRingAngle(false);
        scheduleIdleSnap();
    }, { passive: false });

    wheelZone.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        pointerId = event.pointerId;
        dragStartX = event.clientX;
        dragStartAngle = ringAngle;
        dragMoved = false;
        suppressClickUntil = 0;
        lastMoveTime = event.timeStamp;
        lastMoveAngle = ringAngle;
        trackedVelocity = 0;
        wheelZone.classList.add("is-grabbing");
        cancelMomentum();
        noteActivity();
        wheelZone.setPointerCapture(event.pointerId);
    });

    wheelZone.addEventListener("pointermove", (event) => {
        if (pointerId !== event.pointerId) return;
        const dx = event.clientX - dragStartX;
        if (Math.abs(dx) > 3) dragMoved = true;
        const sensitivity = 0.4;
        const newAngle = dragStartAngle - dx * sensitivity;
        const dt = event.timeStamp - lastMoveTime;
        if (dt > 0) {
            const instantVelocity = (newAngle - lastMoveAngle) / dt * 16;
            trackedVelocity = trackedVelocity * 0.5 + instantVelocity * 0.5;
            recentSpeed = Math.max(recentSpeed * 0.7, Math.abs(instantVelocity));
        }
        ringAngle = newAngle;
        applyRingAngle(false);
        lastMoveTime = event.timeStamp;
        lastMoveAngle = newAngle;
    });

    const rotateToSlot = (slot) => {
        if (!slot) return;
        cancelMomentum();
        const current = ((ringAngle % 360) + 360) % 360;
        let delta = slot.angle - current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        glideTo(ringAngle + delta);
    };

    const openSlotReader = (slot) => {
        const url = slot && slot.el && slot.el.dataset.reader;
        if (url) window.location.href = url;
    };

    const endDrag = (event) => {
        if (pointerId !== event.pointerId) return;
        pointerId = null;
        wheelZone.classList.remove("is-grabbing");
        if (wheelZone.hasPointerCapture(event.pointerId)) {
            wheelZone.releasePointerCapture(event.pointerId);
        }
        const movedDuringDrag = dragMoved;
        dragMoved = false;
        if (!movedDuringDrag) {
            const elem = document.elementFromPoint(event.clientX, event.clientY);
            const bookEl = elem && elem.closest(".library-book");
            if (bookEl) {
                const idx = Number(bookEl.dataset.slotIndex);
                const slot = slots[idx];
                if (slot === activeSlot) {
                    openSlotReader(slot);
                } else {
                    rotateToSlot(slot);
                }
                return;
            }
            scheduleIdleSnap();
            return;
        }
        suppressClickUntil = performance.now() + 250;
        const idleGap = event.timeStamp - lastMoveTime;
        const velocity = idleGap > 120 ? 0 : trackedVelocity;
        if (Math.abs(velocity) > 0.25) {
            startMomentum(velocity);
        } else {
            scheduleIdleSnap();
        }
    };
    wheelZone.addEventListener("pointerup", endDrag);
    wheelZone.addEventListener("pointercancel", endDrag);

    stage.addEventListener("click", (event) => {
        if (consumeSuppressedClick(event)) return;
        const target = event.target.closest(".library-book");
        if (!target) return;
        event.preventDefault();
        const idx = Number(target.dataset.slotIndex);
        const slot = slots[idx];
        if (!slot) return;
        const wasActive = slot === activeSlot;
        noteActivity();
        if (wasActive) {
            openSlotReader(slot);
        } else {
            rotateToSlot(slot);
        }
    });

    stage.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        noteActivity();
        cancelMomentum();
        if (pointerId !== null) {
            const capturedId = pointerId;
            pointerId = null;
            wheelZone.classList.remove("is-grabbing");
            if (wheelZone.hasPointerCapture(capturedId)) {
                wheelZone.releasePointerCapture(capturedId);
            }
            dragMoved = false;
            trackedVelocity = 0;
        }
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const snap = findFrontSlot(ringAngle);
        const current = ((ringAngle % 360) + 360) % 360;
        let delta = snap.angle - current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        glideTo(ringAngle + delta + direction * STEP);
    });

    const monitorActiveBook = () => {
        if (pointerId === null && momentumRaf === null) {
            recentSpeed *= 0.82;
            if (recentSpeed < 0.001) recentSpeed = 0;
        }
        const target = findFrontSlot(ringAngle);
        const current = ((ringAngle % 360) + 360) % 360;
        let diff = target.angle - current;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        const inWindow = Math.abs(diff) <= FRONT_HALF_WINDOW;
        const slowEnough = recentSpeed < SLOW_SPEED_LIMIT;
        if (inWindow && slowEnough) {
            if (activeSlot !== target) setSelected(target);
        } else if (activeSlot) {
            activeSlot.el.classList.remove("is-active");
            activeSlot.el.setAttribute("aria-pressed", "false");
            activeSlot = null;
        }
        requestAnimationFrame(monitorActiveBook);
    };

    applyRingAngle(false);
    setSelected(findFrontSlot(ringAngle));
    requestAnimationFrame(monitorActiveBook);
}

function initCatalog() {
    const grid = document.getElementById("catalogGrid");
    const cards = grid ? Array.from(grid.querySelectorAll(".tool-card")) : [];
    const categoryButtons = Array.from(document.querySelectorAll(".sidebar-item[data-category]"));
    const engineButtons = Array.from(document.querySelectorAll("[data-engine]"));
    const searchInput = document.getElementById("catalogSearch");
    const clearButton = document.getElementById("catalogSearchClear");
    const count = document.getElementById("catalogCount");
    const empty = document.getElementById("catalogEmpty");
    const reset = document.getElementById("resetFilters");
    const viewButtons = Array.from(document.querySelectorAll("[data-view]"));

    if (!grid || !cards.length) return;

    const itemLabel = grid.dataset.itemLabel || "tool";
    const itemLabelPlural = grid.dataset.itemLabelPlural || `${itemLabel}s`;
    const params = new URLSearchParams(window.location.search);
    let activeCategory = normalize(params.get("cat")) || "all";
    let activeEngine = normalize(params.get("eng")) || null;

    if (!categoryButtons.some((button) => button.dataset.category === activeCategory)) {
        activeCategory = "all";
    }

    const setActiveButtons = () => {
        categoryButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.category === activeCategory);
        });
        engineButtons.forEach((button) => {
            button.classList.toggle("is-active", button.dataset.engine === activeEngine);
        });
    };

    const updateUrl = () => {
        const next = new URLSearchParams();
        if (activeCategory !== "all") next.set("cat", activeCategory);
        if (activeEngine) next.set("eng", activeEngine);
        const nextString = next.toString();
        const nextUrl = nextString ? `${window.location.pathname}?${nextString}` : window.location.pathname;
        window.history.replaceState(null, "", nextUrl);
    };

    const apply = () => {
        const query = normalize(searchInput ? searchInput.value : "");
        let visible = 0;

        cards.forEach((card) => {
            const categoryMatch = activeCategory === "all" || card.dataset.category === activeCategory;
            const engineMatch = !activeEngine || card.dataset.engine === activeEngine;
            const searchText = normalize(card.dataset.search || card.textContent);
            const searchMatch = !query || searchText.includes(query);
            const show = categoryMatch && engineMatch && searchMatch;
            card.classList.toggle("is-hidden", !show);
            if (show) visible += 1;
        });

        if (count) {
            const label = cards.length === 1 ? itemLabel : itemLabelPlural;
            count.textContent = `Showing ${visible} of ${cards.length} ${label}`;
        }
        if (empty) empty.hidden = visible !== 0;
        if (clearButton && searchInput) {
            clearButton.classList.toggle("is-visible", searchInput.value.length > 0);
        }
        setActiveButtons();
        updateUrl();
    };

    categoryButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeCategory = button.dataset.category;
            if (activeCategory !== "gameengine") activeEngine = null;
            apply();
        });
    });

    engineButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeCategory = "gameengine";
            activeEngine = activeEngine === button.dataset.engine ? null : button.dataset.engine;
            apply();
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", apply);
    }

    if (clearButton && searchInput) {
        clearButton.addEventListener("click", () => {
            searchInput.value = "";
            searchInput.focus();
            apply();
        });
    }

    if (reset) {
        reset.addEventListener("click", () => {
            activeCategory = "all";
            activeEngine = null;
            if (searchInput) searchInput.value = "";
            apply();
        });
    }

    viewButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const view = button.dataset.view;
            viewButtons.forEach((item) => item.classList.toggle("is-active", item === button));
            grid.classList.toggle("is-list", view === "list");
        });
    });

    apply();
}

function initSubnav() {
    const subnav = document.getElementById("subnav");
    if (!subnav) return;

    const links = Array.from(subnav.querySelectorAll("a[href^='#']"));
    const sections = links
        .map((link) => document.getElementById(link.getAttribute("href").slice(1)))
        .filter(Boolean);

    links.forEach((link) => {
        link.addEventListener("click", (event) => {
            const target = document.getElementById(link.getAttribute("href").slice(1));
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
            window.history.replaceState(null, "", link.getAttribute("href"));
            activateSubnav(link.getAttribute("href").slice(1), links);
        });
    });

    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) activateSubnav(entry.target.id, links);
        });
    }, { rootMargin: "-32% 0px -56% 0px", threshold: 0.01 });

    sections.forEach((section) => observer.observe(section));
}

function initTutorialClips() {
    const player = document.getElementById("tutorialPlayer");
    const clips = Array.from(document.querySelectorAll("[data-seek]"));
    if (!player || !clips.length) return;

    clips.forEach((clip) => {
        clip.addEventListener("click", () => {
            const seconds = Number(clip.dataset.seek || 0);
            clips.forEach((item) => item.classList.toggle("is-active", item === clip));
            if (!player.contentWindow) return;
            player.contentWindow.postMessage(JSON.stringify({
                event: "command",
                func: "seekTo",
                args: [seconds, true]
            }), "*");
            player.contentWindow.postMessage(JSON.stringify({
                event: "command",
                func: "playVideo",
                args: []
            }), "*");
            player.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
        });
    });
}

function activateSubnav(id, links) {
    links.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
    });
}

function normalize(value) {
    return String(value || "").trim().toLowerCase();
}

function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
