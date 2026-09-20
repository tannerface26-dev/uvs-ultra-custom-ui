(() => {
    "use strict";

    function createElement(tagName, className, text) {
        const element = document.createElement(tagName);

        if (className) {
            element.className = className;
        }

        if (text) {
            element.textContent = text;
        }

        return element;
    }

    function findForumCodeTrigger(container) {
        return Array.from(
            container.querySelectorAll("a, button")
        ).find((element) =>
            element.textContent.trim() === "Forum Code"
        );
    }

    function getCardName(card) {
        return Array.from(card.childNodes)
            .filter((node) => node.nodeType === 3)
            .map((node) => node.textContent)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function getCardIdentity(card) {
        const cardId = card.id.match(/^deck-card-(\d+)$/)?.[1];
        const deckId = getDeckId(card);
        const selectedArt = globalThis.UVSU_CARD_ART?.getSelection(
            cardId,
            deckId
        );

        if (selectedArt) {
            return {
                setId: selectedArt.setId,
                cardNumber: selectedArt.cardNumber
            };
        }

        const image = card.querySelector("img.ci-micro_image");

        if (!image) {
            return null;
        }

        try {
            const url = new URL(
                image.getAttribute("src"),
                window.location.href
            );

            if (
                url.protocol !== "https:" ||
                url.origin !== window.location.origin
            ) {
                return null;
            }

            const match = url.pathname.match(
                /^\/images\/extensions\/([a-z0-9_-]+)\/([a-z0-9_-]+?)(?:-(?:preview|mini|ci-micro))?\.jpg$/i
            );

            if (!match) {
                return null;
            }

            return {
                setId: match[1],
                cardNumber: match[2]
            };
        } catch (_) {
            return null;
        }
    }

    function getDeckId(card) {
        const actionLink = card.querySelector(
            'a[href*="id_deck="]'
        );

        if (!actionLink) {
            return null;
        }

        try {
            const url = new URL(
                actionLink.getAttribute("href"),
                window.location.href
            );

            if (
                url.protocol !== "https:" ||
                url.origin !== window.location.origin
            ) {
                return null;
            }

            const deckId = url.searchParams.get("id_deck");
            return /^\d+$/.test(deckId || "") ? deckId : null;
        } catch (_) {
            return null;
        }
    }

    function getDeckCards() {
        return Array.from(
            document.querySelectorAll(".listing_deck .card-list")
        ).map((card) => {
            const name = getCardName(card);
            const identity = getCardIdentity(card);
            const quantity = card.querySelector(
                '[id^="number_card_"]'
            )?.textContent.trim();

            if (!name || !identity || !/^\d+$/.test(quantity || "")) {
                return null;
            }

            return {
                name,
                quantity,
                setId: identity.setId,
                cardNumber: identity.cardNumber
            };
        }).filter(Boolean);
    }

    function setupAlphabeticalSort() {
        const sortBar = document.querySelector(".deck-sort-by");

        if (!sortBar) {
            return;
        }

        const links = Array.from(sortBar.querySelectorAll("a[href]"));
        const alphabetical = links.find((link) => {
            try {
                const url = new URL(link.getAttribute("href"), location.href);
                return !url.searchParams.has("tri");
            } catch (_) {
                return false;
            }
        });

        if (!alphabetical) {
            return;
        }

        let mode = "alphabetical";
        alphabetical.textContent = "Alphabetical";

        function cardName(card) {
            return getCardName(card).toLocaleLowerCase();
        }

        function sortCards() {
            document.querySelectorAll(".listing_deck ul").forEach((list) => {
                const cards = Array.from(list.children).filter((child) =>
                    child.matches("li.card-list")
                );

                if (cards.length < 2) {
                    return;
                }

                const sorted = [...cards].sort((left, right) =>
                    cardName(left).localeCompare(
                        cardName(right),
                        undefined,
                        { numeric: true, sensitivity: "base" }
                    )
                );

                if (cards.some((card, index) => card !== sorted[index])) {
                    list.append(...sorted);
                }
            });
        }

        function showSelection(selected) {
            links.forEach((link) =>
                link.classList.toggle("label-info", link === selected)
            );
        }

        alphabetical.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            mode = "alphabetical";
            showSelection(alphabetical);
            sortCards();
        }, true);

        links.filter((link) => link !== alphabetical).forEach((link) => {
            link.addEventListener("click", () => {
                mode = "site";
                showSelection(link);
            }, true);
        });

        const observer = new MutationObserver(() => {
            if (mode === "alphabetical") {
                sortCards();
                showSelection(alphabetical);
            }
        });
        const deck = document.querySelector(".listing_deck");

        if (deck) {
            observer.observe(deck, { childList: true, subtree: true });
        }

        showSelection(alphabetical);
        sortCards();
    }

    function addImageIdsToForumCode(source) {
        const cardsByName = new Map();

        getDeckCards().forEach((card) => {
            const key = card.name.toLocaleLowerCase();
            const matches = cardsByName.get(key) || [];

            matches.push(card);
            cardsByName.set(key, matches);
        });

        return source
            .split(/\r?\n/)
            .map((line) => {
                const match = line.match(/^(\s*)(\d+)\s+(.+?)\s*$/);

                if (!match) {
                    return line;
                }

                const key = match[3].toLocaleLowerCase();
                const cards = cardsByName.get(key);

                if (!cards?.length) {
                    return line;
                }

                const card = cards.shift();

                return `${match[1]}${card.quantity} -${card.setId}/${card.cardNumber} ${card.name}`;
            })
            .join("\n");
    }

    function setupForumCodePanel() {
        const codeField = document.querySelector("#code_forum");
        const deckSort = document.querySelector(".deck-sort");

        if (!codeField || !deckSort || document.querySelector("#uvsu-forum-code-panel")) {
            return;
        }

        const trigger = findForumCodeTrigger(deckSort);

        if (!trigger) {
            return;
        }

        document.body.classList.add("uvsu-deck-page");

        const panel = createElement("section", "uvsu-forum-code-panel");
        panel.id = "uvsu-forum-code-panel";
        panel.hidden = true;
        panel.setAttribute("aria-label", "Forum Code");

        codeField.style.removeProperty("display");
        codeField.classList.add("uvsu-forum-code-field");
        codeField.readOnly = true;
        codeField.setAttribute("aria-label", "Forum code for this deck");

        const originalForumCode = codeField.value;

        panel.append(codeField);
        deckSort.insertAdjacentElement("afterend", panel);

        trigger.removeAttribute("onclick");
        trigger.setAttribute("aria-controls", panel.id);
        trigger.setAttribute("aria-expanded", "false");

        try {
            codeField.value = addImageIdsToForumCode(originalForumCode);
        } catch (error) {
            console.error(
                "[UVS Ultra Custom] Set IDs could not be added to forum code:",
                error
            );
        }

        document.addEventListener(
            "uvsu:card-art-change",
            () => {
                codeField.value = addImageIdsToForumCode(
                    originalForumCode
                );
            }
        );

        function setOpen(isOpen) {
            panel.hidden = !isOpen;
            trigger.setAttribute("aria-expanded", String(isOpen));

            if (isOpen) {
                codeField.focus();
                codeField.select();
            }
        }

        trigger.addEventListener("click", (event) => {
            event.preventDefault();
            setOpen(panel.hidden);
        });

        panel.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                setOpen(false);
                trigger.focus();
            }
        });
    }

    try {
        setupAlphabeticalSort();
        setupForumCodePanel();
    } catch (error) {
        console.error("[UVS Ultra Custom] Forum code setup failed:", error);
    }
})();
