(() => {
    "use strict";

    const KEYWORD_TYPES = Object.freeze({
        response: new Set([
            "Breaker",
            "Deflect",
            "Echo",
            "Reversal"
        ]),
        enhance: new Set([
            "EX",
            "Gauge",
            "Multiple",
            "Powerful",
            "Stun"
        ]),
        form: new Set([
            "Combo",
            "Shift"
        ]),
        blitz: new Set([
            "Tension"
        ])
    });
    const FORM_COLOR_TRAITS = new Set([
        "Desperation",
        "Elusive",
        "Flash",
        "Only",
        "Safe",
        "Terrain",
        "Throw",
        "Unique"
    ]);
    const BLITZ_COLOR_TRAITS = new Set([
        "Frenzy"
    ]);
    const VIEW_STORAGE_KEY = "uvsu-search-view";
    const DECK_DRAWER_STORAGE_KEY = "uvsu-deck-drawer";
    const CURRENT_DECK_STORAGE_KEY = "uvsu-current-deck";
    const DECK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
    const DECK_CARD_ID_PATTERN = /^deck-card-(\d+)$/;
    const DECK_TYPES = Object.freeze({
        character: "Character",
        foundation: "Foundation",
        attack: "Attack",
        asset: "Asset",
        action: "Action",
        backup: "Backup",
        arena: "Arena",
        token: "Token",
        side: "Side"
    });
    let activeDeckName = "";
    let activeDeckToken = "";
    let resolvingDeckName = "";

    function readView() {
        try {
            return window.localStorage.getItem(VIEW_STORAGE_KEY) === "original"
                ? "original"
                : "dark";
        } catch (_) {
            return "dark";
        }
    }

    function writeView(view) {
        try {
            window.localStorage.setItem(VIEW_STORAGE_KEY, view);
        } catch (_) {
            // The in-page toggle still works when storage is unavailable.
        }
    }

    function applyView(view, button) {
        const isDark = view === "dark";

        document.documentElement.classList.toggle("uvsu-dark-search", isDark);
        button.setAttribute("aria-pressed", String(isDark));
        button.lastChild.textContent = isDark ? " Light View" : " Dark View";
        button.title = isDark
            ? "Use Light View"
            : "Use Dark View";
    }

    function setupViewToggle() {
        const navigation = document.querySelector(
            "#topbar .navbar-nav.pull-right"
        );

        if (!navigation || document.querySelector("#uvsu-view-toggle")) {
            return;
        }

        const item = document.createElement("li");
        const button = document.createElement("a");
        const icon = document.createElement("i");

        button.id = "uvsu-view-toggle";
        button.href = "#";
        button.setAttribute("role", "button");
        icon.className = "glyphicon glyphicon-adjust glyphicon-white";
        icon.setAttribute("aria-hidden", "true");
        button.append(icon, document.createTextNode(""));
        item.appendChild(button);
        navigation.prepend(item);

        let view = readView();
        applyView(view, button);

        button.addEventListener("click", (event) => {
            event.preventDefault();
            view = view === "dark" ? "original" : "dark";
            writeView(view);
            applyView(view, button);
        });
    }

    function getKeywordType(keyword) {
        for (const [type, keywords] of Object.entries(KEYWORD_TYPES)) {
            if (keywords.has(keyword)) {
                return type;
            }
        }

        return "trait";
    }

    function colorKeywordLabels() {
        const container = document.querySelector("#keyword_div");

        if (!container) {
            return;
        }

        const rows = Array.from(
            container.querySelectorAll(".float_keyword")
        );

        rows.forEach((row) => {
            const label = row.querySelector("label");

            if (!label) {
                return;
            }

            const keyword = label.textContent.trim();
            const type = getKeywordType(keyword);
            const hasFormColor = FORM_COLOR_TRAITS.has(keyword);
            const hasBlitzColor = BLITZ_COLOR_TRAITS.has(keyword);

            row.dataset.keywordType = type;
            row.dataset.keywordGroup =
                type !== "trait" || hasFormColor || hasBlitzColor
                    ? "ability"
                    : "trait";
            label.classList.remove(
                "uvsu-keyword-trait",
                "uvsu-keyword-response",
                "uvsu-keyword-enhance",
                "uvsu-keyword-form",
                "uvsu-keyword-blitz",
                "uvsu-keyword-form-color",
                "uvsu-keyword-blitz-color"
            );
            label.classList.add(`uvsu-keyword-${type}`);
            label.classList.toggle(
                "uvsu-keyword-form-color",
                hasFormColor
            );
            label.classList.toggle(
                "uvsu-keyword-blitz-color",
                hasBlitzColor
            );
        });

        const abilities = rows.filter(
            (row) => row.dataset.keywordGroup === "ability"
        );
        const traits = rows.filter(
            (row) => row.dataset.keywordGroup === "trait"
        );
        const byName = (left, right) =>
            left.querySelector("label").textContent.trim().localeCompare(
                right.querySelector("label").textContent.trim(),
                undefined,
                { sensitivity: "base" }
            );
        const abilityColumns = getKeywordGroup(
            container,
            "uvsu-keyword-abilities"
        );
        const traitColumns = getKeywordGroup(
            container,
            "uvsu-keyword-traits"
        );

        abilityColumns.style.setProperty(
            "--uvsu-keyword-rows",
            Math.ceil(abilities.length / 3)
        );
        traitColumns.style.setProperty(
            "--uvsu-keyword-rows",
            Math.ceil(traits.length / 3)
        );
        syncKeywordRows(abilityColumns, abilities.sort(byName));
        syncKeywordRows(traitColumns, traits.sort(byName));
        container.querySelector(":scope > .uvsu-keywords")?.remove();
    }

    function getKeywordGroup(container, className) {
        let group = container.querySelector(`:scope > .${className}`);

        if (!group) {
            group = document.createElement("div");
            group.className = className;
            container.appendChild(group);
        }

        return group;
    }

    function syncKeywordRows(group, rows) {
        const current = Array.from(group.children);

        if (
            current.length === rows.length &&
            current.every((row, index) => row === rows[index])
        ) {
            return;
        }

        group.append(...rows);
    }

    function setupAdditionalFilters() {
        const searchInputs = document.querySelector("#search_inputs");
        const searchInfo = document.querySelector("#search_infos");
        const firstFilter = document.querySelector("#kaddtext_div");

        if (
            !searchInputs ||
            !searchInfo ||
            !firstFilter ||
            document.querySelector("#uvsu-search-filters")
        ) {
            return;
        }

        const section = document.createElement("section");
        section.id = "uvsu-search-filters";
        section.setAttribute("aria-label", "Additional card filters");

        let node = firstFilter;

        while (node) {
            const next = node.nextSibling;
            section.appendChild(node);
            node = next;
        }

        searchInputs.appendChild(section);

        const advancedFilters = section.querySelector("#search_more");

        if (advancedFilters) {
            advancedFilters.style.removeProperty("display");
        }
    }

    function readDeckDrawerOpen() {
        try {
            return window.localStorage.getItem(DECK_DRAWER_STORAGE_KEY) !==
                "closed";
        } catch (_) {
            return true;
        }
    }

    function writeDeckDrawerOpen(isOpen) {
        try {
            window.localStorage.setItem(
                DECK_DRAWER_STORAGE_KEY,
                isOpen ? "open" : "closed"
            );
        } catch (_) {
            // The drawer still works when storage is unavailable.
        }
    }

    function getCurrentDeckName() {
        const name = document.querySelector("#current_deck span")?.textContent
            .trim();

        return name || "";
    }

    function getDeckURL(token) {
        if (!DECK_TOKEN_PATTERN.test(token)) {
            return "";
        }

        const deckURL = new URL("/deck.php", location.origin);
        deckURL.searchParams.set("deck", token);
        return deckURL.href;
    }

    function readStoredDeckToken(deckName) {
        try {
            const stored = JSON.parse(
                window.localStorage.getItem(CURRENT_DECK_STORAGE_KEY) || "null"
            );

            if (
                stored?.name === deckName &&
                DECK_TOKEN_PATTERN.test(stored.token)
            ) {
                return stored.token;
            }
        } catch (_) {
            // Ignore unavailable or malformed storage.
        }

        return "";
    }

    function writeStoredDeckToken(deckName, token) {
        if (!deckName || !DECK_TOKEN_PATTERN.test(token)) {
            return;
        }

        try {
            window.localStorage.setItem(
                CURRENT_DECK_STORAGE_KEY,
                JSON.stringify({ name: deckName, token })
            );
        } catch (_) {
            // The drawer can rediscover the token when storage is unavailable.
        }
    }

    function applyDeckDrawerState(drawer, isOpen) {
        const content = drawer.querySelector(".uvsu-deck-drawer-content");
        const toggle = drawer.querySelector(".uvsu-deck-drawer-toggle");
        const preview = document.querySelector("#uvsu-deck-preview");

        drawer.classList.toggle("uvsu-deck-drawer-closed", !isOpen);
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.setAttribute(
            "aria-label",
            isOpen ? "Hide current deck" : "Show current deck"
        );
        toggle.title = isOpen ? "Hide current deck" : "Show current deck";
        toggle.textContent = isOpen ? ">" : "<";
        content.setAttribute("aria-hidden", String(!isOpen));
        content.inert = !isOpen;

        if (!isOpen && preview) {
            preview.hidden = true;
        }
    }

    function updateDeckLink(drawer, token) {
        const link = drawer.querySelector(".uvsu-open-deck");
        const deckURL = getDeckURL(token);

        if (!deckURL) {
            link.hidden = true;
            link.removeAttribute("href");
            return;
        }

        link.href = deckURL;
        link.hidden = false;
    }

    function getValidatedDeckToken(href) {
        let candidate;

        try {
            candidate = new URL(href, location.origin);
        } catch (_) {
            return "";
        }

        const token = candidate.searchParams.get("deck") || "";

        return candidate.protocol === "https:" &&
            candidate.origin === location.origin &&
            candidate.pathname === "/deck.php" &&
            DECK_TOKEN_PATTERN.test(token)
            ? token
            : "";
    }

    function getLatestOnTheFlyToken() {
        const entries = performance.getEntriesByType("resource");

        for (let index = entries.length - 1; index >= 0; index -= 1) {
            let url;

            try {
                url = new URL(entries[index].name);
            } catch (_) {
                continue;
            }

            const token = url.searchParams.get("deck") || "";

            if (
                url.protocol === "https:" &&
                url.origin === location.origin &&
                url.pathname === "/onthefly.php" &&
                DECK_TOKEN_PATTERN.test(token)
            ) {
                return token;
            }
        }

        return "";
    }

    function getCardImageURL(sourceImage) {
        let sourceURL;

        try {
            sourceURL = new URL(sourceImage.getAttribute("src"), location.href);
        } catch (_) {
            return null;
        }

        const match = sourceURL.pathname.match(
            /^\/images\/extensions\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)-ci-micro\.jpg$/
        );

        if (
            sourceURL.protocol !== "https:" ||
            sourceURL.origin !== location.origin ||
            !match
        ) {
            return null;
        }

        const previewURL = new URL(
            `/images/extensions/${match[1]}/${match[2]}-preview.jpg`,
            location.origin
        );
        previewURL.search = sourceURL.search;

        return { micro: sourceURL.href, preview: previewURL.href };
    }

    function getSourceCardName(sourceRow) {
        return Array.from(sourceRow.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent.trim())
            .filter(Boolean)
            .join(" ");
    }

    function createQuantityControls(cardId, side) {
        const controls = document.createElement("span");

        controls.className = "uvsu-quantity-controls";
        controls.setAttribute("aria-label", "Set card quantity");

        for (let quantity = 0; quantity <= 4; quantity += 1) {
            const link = document.createElement("a");
            const actionURL = new URL("/deck_card.php", location.origin);

            actionURL.searchParams.set("id_card", cardId);
            actionURL.searchParams.set("number", String(quantity));
            actionURL.searchParams.set(
                "action",
                quantity === 0 ? "del" : "add"
            );
            actionURL.searchParams.set("side", side ? "1" : "0");
            link.href = actionURL.href;
            link.className = quantity === 0 ? "delete-card" : "add-card";
            link.textContent = String(quantity);
            link.setAttribute("aria-label", `Set quantity to ${quantity}`);
            controls.appendChild(link);
        }

        return controls;
    }

    function renderDeckList(source) {
        const drawer = document.querySelector("#uvsu-deck-drawer");

        if (!drawer) {
            return;
        }

        const list = drawer.querySelector(".uvsu-deck-drawer-list");
        const fragment = document.createDocumentFragment();
        let renderedCards = 0;

        for (const [type, label] of Object.entries(DECK_TYPES)) {
            const sourceGroup = source.querySelector(`.type_card_${type}`);

            if (!sourceGroup) {
                continue;
            }

            const cards = [];

            for (const sourceRow of sourceGroup.querySelectorAll(
                ".card-list-onthefly"
            )) {
                const idMatch = sourceRow.id.match(DECK_CARD_ID_PATTERN);
                const sourceQuantity = idMatch
                    ? sourceRow.querySelector(`#number_card_${idMatch[1]}`)
                    : null;
                const quantity = Number.parseInt(
                    sourceQuantity?.textContent || "",
                    10
                );
                const sourceImage = sourceRow.querySelector("img");
                const imageURLs = sourceImage
                    ? getCardImageURL(sourceImage)
                    : null;
                const cardName = getSourceCardName(sourceRow);

                if (
                    !idMatch ||
                    !Number.isInteger(quantity) ||
                    quantity < 0 ||
                    quantity > 99 ||
                    !imageURLs ||
                    !cardName
                ) {
                    continue;
                }

                cards.push({
                    cardId: idMatch[1],
                    cardName,
                    imageURLs,
                    quantity
                });
            }

            if (!cards.length) {
                continue;
            }

            const section = document.createElement("section");
            const heading = document.createElement("h4");
            const cardList = document.createElement("ul");
            const total = cards.reduce((sum, card) => sum + card.quantity, 0);

            section.className = "uvsu-deck-section";
            heading.textContent = `${label} (${total} cards)`;

            for (const card of cards) {
                const row = document.createElement("li");
                const image = document.createElement("img");
                const name = document.createElement("span");
                const badge = document.createElement("span");

                row.className = `card-list-onthefly card-list-${type}`;
                row.dataset.previewUrl = card.imageURLs.preview;
                image.className = "ci-micro_image";
                image.src = card.imageURLs.micro;
                image.alt = "";
                name.className = "uvsu-deck-card-name";
                name.textContent = card.cardName;
                badge.className = "badge badge-success";
                badge.textContent = `x${card.quantity}`;
                row.append(
                    image,
                    name,
                    badge,
                    createQuantityControls(card.cardId, type === "side")
                );
                cardList.appendChild(row);
                renderedCards += 1;
            }

            section.append(heading, cardList);
            fragment.appendChild(section);
        }

        list.replaceChildren(fragment);
        drawer.querySelector(".uvsu-deck-drawer-status").hidden =
            renderedCards > 0;

        const token = getLatestOnTheFlyToken();

        if (token) {
            activeDeckToken = token;
            updateDeckLink(drawer, token);
            writeStoredDeckToken(getCurrentDeckName(), token);
        }
    }

    function createDeckDrawer() {
        const deckName = getCurrentDeckName();

        if (!deckName || document.querySelector("#uvsu-deck-drawer")) {
            return null;
        }

        const shell = document.createElement("aside");
        const toggle = document.createElement("button");
        const content = document.createElement("div");
        const header = document.createElement("header");
        const title = document.createElement("strong");
        const openDeck = document.createElement("a");
        const scroll = document.createElement("div");
        const status = document.createElement("p");
        const list = document.createElement("div");
        const bridge = document.querySelector("#onthefly") ||
            document.createElement("div");
        const preview = document.createElement("div");
        const previewImage = document.createElement("img");

        shell.id = "uvsu-deck-drawer";
        shell.setAttribute("aria-label", "Current deck");
        toggle.type = "button";
        toggle.className = "uvsu-deck-drawer-toggle";
        toggle.setAttribute("aria-controls", "uvsu-deck-drawer-content");
        content.id = "uvsu-deck-drawer-content";
        content.className = "uvsu-deck-drawer-content";
        header.className = "uvsu-deck-drawer-header";
        title.className = "uvsu-deck-drawer-title";
        title.textContent = deckName;
        openDeck.className = "uvsu-open-deck";
        openDeck.textContent = "Open deck";
        openDeck.target = "_blank";
        openDeck.rel = "noopener noreferrer";
        scroll.className = "uvsu-deck-drawer-scroll";
        status.className = "uvsu-deck-drawer-status";
        status.textContent = "Loading current deck\u2026";
        list.className = "uvsu-deck-drawer-list";
        bridge.id = "onthefly";
        bridge.hidden = true;
        bridge.setAttribute("aria-hidden", "true");
        preview.id = "uvsu-deck-preview";
        preview.hidden = true;
        preview.setAttribute("aria-hidden", "true");
        previewImage.alt = "";

        header.append(title, openDeck);
        scroll.append(status, list);
        content.append(header, scroll);
        shell.append(toggle, content);
        preview.appendChild(previewImage);
        document.body.append(shell, bridge, preview);
        updateDeckLink(shell, "");

        let isOpen = readDeckDrawerOpen();
        applyDeckDrawerState(shell, isOpen);

        toggle.addEventListener("click", () => {
            isOpen = !isOpen;
            writeDeckDrawerOpen(isOpen);
            applyDeckDrawerState(shell, isOpen);
        });

        scroll.addEventListener("mouseover", (event) => {
            const row = event.target.closest(".card-list-onthefly");

            if (
                row &&
                scroll.contains(row) &&
                !row.contains(event.relatedTarget)
            ) {
                previewImage.src = row.dataset.previewUrl;
                previewImage.alt = row.querySelector(
                    ".uvsu-deck-card-name"
                )?.textContent || "";
                preview.hidden = false;
            }
        });
        scroll.addEventListener("mouseout", (event) => {
            const row = event.target.closest(".card-list-onthefly");

            if (
                row &&
                scroll.contains(row) &&
                !row.contains(event.relatedTarget)
            ) {
                preview.hidden = true;
            }
        });

        new MutationObserver(() => {
            renderDeckList(bridge);
        }).observe(bridge, { childList: true, subtree: true });

        activeDeckName = deckName;
        return shell;
    }

    async function discoverDeckToken(deckName) {
        const menuURL = new URL("/menu_list_user_deck.php", location.origin);

        menuURL.searchParams.set("mddisplaytype", "flat");
        menuURL.searchParams.set("mdorderby", "name");
        menuURL.searchParams.set("js", "");

        const response = await fetch(menuURL.href, {
            credentials: "same-origin"
        });

        if (
            !response.ok ||
            new URL(response.url).origin !== location.origin
        ) {
            return "";
        }

        const parsed = new DOMParser().parseFromString(
            await response.text(),
            "text/html"
        );
        const tokens = new Set();

        for (const link of parsed.querySelectorAll('a[href*="deck.php?deck="]')) {
            if (link.textContent.trim() !== deckName) {
                continue;
            }

            const token = getValidatedDeckToken(link.getAttribute("href"));

            if (token) {
                tokens.add(token);
            }
        }

        return tokens.size === 1 ? Array.from(tokens)[0] : "";
    }

    async function loadDeckList(token) {
        const response = await fetch(
            `/onthefly.php?deck=${encodeURIComponent(token)}&js&onthefly`,
            { credentials: "same-origin" }
        );

        if (
            !response.ok ||
            new URL(response.url).origin !== location.origin ||
            new URL(response.url).pathname !== "/onthefly.php"
        ) {
            throw new Error("Current deck request failed");
        }

        const parsed = new DOMParser().parseFromString(
            await response.text(),
            "text/html"
        );

        renderDeckList(parsed);
    }

    async function refreshDeckDrawer() {
        const drawer = document.querySelector("#uvsu-deck-drawer") ||
            createDeckDrawer();
        const deckName = getCurrentDeckName();

        if (!drawer || !deckName || resolvingDeckName === deckName) {
            return;
        }

        if (activeDeckName !== deckName) {
            activeDeckName = deckName;
            activeDeckToken = "";
            drawer.querySelector(".uvsu-deck-drawer-title").textContent =
                deckName;
            drawer.querySelector(".uvsu-deck-drawer-list").replaceChildren();
            drawer.querySelector(".uvsu-deck-drawer-status").hidden = false;
            updateDeckLink(drawer, "");
        }

        resolvingDeckName = deckName;

        try {
            const storedToken = readStoredDeckToken(deckName);
            const token = storedToken || await discoverDeckToken(deckName);

            if (!token || getCurrentDeckName() !== deckName) {
                throw new Error("Current deck could not be identified");
            }

            activeDeckToken = token;
            writeStoredDeckToken(deckName, token);
            updateDeckLink(drawer, token);
            await loadDeckList(token);
        } catch (_) {
            const status = drawer.querySelector(".uvsu-deck-drawer-status");

            status.textContent = "Current deck could not be loaded.";
            status.hidden = false;
        } finally {
            if (resolvingDeckName === deckName) {
                resolvingDeckName = "";
            }
        }
    }

    function syncDeckDrawer() {
        const deckName = getCurrentDeckName();

        if (!deckName) {
            return;
        }

        const drawer = document.querySelector("#uvsu-deck-drawer") ||
            createDeckDrawer();

        if (!drawer) {
            return;
        }

        if (activeDeckName !== deckName) {
            void refreshDeckDrawer();
            return;
        }

    }

    setupViewToggle();

    const search = document.querySelector("#search");

    if (search) {
        colorKeywordLabels();
        setupAdditionalFilters();
        syncDeckDrawer();
        void refreshDeckDrawer();

        const observer = new MutationObserver(() => {
            colorKeywordLabels();
            setupAdditionalFilters();
            syncDeckDrawer();
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
})();
