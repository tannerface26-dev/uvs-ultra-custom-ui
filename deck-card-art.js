(() => {
    "use strict";

    const cardArt = globalThis.UVSU_CARD_ART;

    if (!cardArt) {
        return;
    }

    function parseActionURL(source) {
        try {
            const url = new URL(source, window.location.href);

            if (
                url.protocol !== "https:" ||
                url.origin !== window.location.origin
            ) {
                return null;
            }

            const cardId =
                url.searchParams.get("id_card") ||
                url.searchParams.get("id");
            const deckId = url.searchParams.get("id_deck");

            if (
                !/^\d+$/.test(cardId || "") ||
                !/^\d+$/.test(deckId || "")
            ) {
                return null;
            }

            return { cardId, deckId };
        } catch (_) {
            return null;
        }
    }

    function getMenuContext(menu) {
        const link = menu.querySelector(
            'a.add-card[href], a.delete-card[href]'
        );

        return link ? parseActionURL(link.getAttribute("href")) : null;
    }

    function getCardContext(card) {
        const link = card.querySelector('a[href*="id_deck="]');
        return link ? parseActionURL(link.getAttribute("href")) : null;
    }

    function setImageSource(image, variant, size) {
        const source = cardArt.getImageURL(variant, size);

        if (!image || !source) {
            return false;
        }

        image.referrerPolicy = "no-referrer";
        image.src = source;
        return true;
    }

    function applySelection(context, variant) {
        if (!context || !variant) {
            return;
        }

        const card = document.querySelector(
            `#deck-card-${context.cardId}`
        );
        const cardImage = card?.querySelector("img.ci-micro_image");
        setImageSource(cardImage, variant, "micro");

        previewVariant(variant);

        document
            .querySelectorAll(
                `.uvsu-card-art-option[data-card-id="${context.cardId}"][data-deck-id="${context.deckId}"]`
            )
            .forEach((button) => {
                const isSelected =
                    button.dataset.artworkId === variant.artworkId;

                button.classList.toggle("uvsu-selected", isSelected);
                button.setAttribute(
                    "aria-pressed",
                    String(isSelected)
                );
            });

        document
            .querySelectorAll(
                `.uvsu-card-art-selector[data-card-id="${context.cardId}"][data-deck-id="${context.deckId}"]`
            )
            .forEach((selector) => {
                const original = cardArt.getVariants(context.cardId)[0];
                const isOriginal =
                    original?.artworkId === variant.artworkId;
                const originalButton = selector.querySelector(
                    ".uvsu-card-art-original"
                );
                const alternateButton = selector.querySelector(
                    ".uvsu-card-art-alternate-toggle"
                );

                originalButton?.classList.toggle("uvsu-selected", isOriginal);
                originalButton?.setAttribute("aria-pressed", String(isOriginal));
                alternateButton?.classList.toggle("uvsu-selected", !isOriginal);
                alternateButton?.setAttribute("aria-pressed", String(!isOriginal));
            });
    }

    function closeActionMenu(menu) {
        menu.style.display = "none";
    }

    function previewVariant(variant) {
        const previewImage = document.querySelector(
            "#preview_listing_deck img"
        );
        const backPreviewImage = document.querySelector(
            "#preview_listing_deckB img"
        );

        if (!previewImage || !variant) {
            return;
        }

        setImageSource(previewImage, variant, "preview");

        if (!backPreviewImage) {
            return;
        }

        if (variant.transformBack) {
            const hasBackPreview = setImageSource(
                backPreviewImage,
                variant.transformBack,
                "preview"
            );
            backPreviewImage.style.display = hasBackPreview ? "" : "none";
        } else {
            backPreviewImage.style.display = "none";
        }
    }

    function addPreviewHover(button, variant) {
        button.addEventListener("mouseenter", () => {
            previewVariant(variant);
        });
    }

    function selectVariant(menu, context, variant) {
        const selected = cardArt.select(
            context.cardId,
            variant.artworkId,
            context.deckId
        );

        applySelection(context, selected);

        if (selected) {
            document.dispatchEvent(new CustomEvent("uvsu:card-art-change"));
            closeActionMenu(menu);
        }
    }

    function enhanceActionMenu() {
        const menu = document.querySelector("#cluetip");

        if (!menu) {
            return;
        }

        const context = getMenuContext(menu);
        const variants = context
            ? cardArt.getVariants(context.cardId)
            : [];

        if (variants.length < 2) {
            menu.querySelector(".uvsu-card-art-selector")?.remove();
            return;
        }

        const existing = menu.querySelector(
            ".uvsu-card-art-selector"
        );

        if (
            existing?.dataset.cardId === context.cardId &&
            existing?.dataset.deckId === context.deckId
        ) {
            return;
        }

        existing?.remove();

        const selector = document.createElement("div");
        selector.className = "uvsu-card-art-selector";
        selector.dataset.cardId = context.cardId;
        selector.dataset.deckId = context.deckId;

        const label = document.createElement("span");
        label.className = "uvsu-card-art-label";
        label.textContent = "Card art:";
        selector.appendChild(label);

        const original = variants[0];
        const alternates = variants.slice(1);

        const originalButton = document.createElement("button");
        originalButton.type = "button";
        originalButton.className =
            "uvsu-card-art-option uvsu-card-art-original";
        originalButton.dataset.cardId = context.cardId;
        originalButton.dataset.deckId = context.deckId;
        originalButton.dataset.artworkId = original.artworkId;
        originalButton.textContent = "Original Art";
        originalButton.title = `${original.setId}/${original.cardNumber}`;
        originalButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            selectVariant(menu, context, original);
        });
        addPreviewHover(originalButton, original);
        selector.appendChild(originalButton);

        const alternateButton = document.createElement("button");
        alternateButton.type = "button";
        alternateButton.className =
            "uvsu-card-art-option uvsu-card-art-alternate-toggle";
        alternateButton.textContent = "Alternate Art";
        selector.appendChild(alternateButton);

        if (alternates.length === 1) {
            const alternate = alternates[0];
            alternateButton.dataset.cardId = context.cardId;
            alternateButton.dataset.deckId = context.deckId;
            alternateButton.dataset.artworkId = alternate.artworkId;
            alternateButton.title = `${alternate.setId}/${alternate.cardNumber}`;
            alternateButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                selectVariant(menu, context, alternate);
            });
            addPreviewHover(alternateButton, alternate);
        } else {
            const list = document.createElement("div");
            list.className = "uvsu-card-art-alternate-list";
            list.hidden = true;
            alternateButton.textContent = `Alternate Arts (${alternates.length})`;
            alternateButton.title =
                `Choose from ${alternates.length} alternate artworks`;
            alternateButton.setAttribute("aria-haspopup", "true");
            alternateButton.setAttribute("aria-expanded", "false");

            alternateButton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                list.hidden = !list.hidden;
                alternateButton.setAttribute(
                    "aria-expanded",
                    String(!list.hidden)
                );
            });
            addPreviewHover(alternateButton, alternates[0]);

            alternates.forEach((variant) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className =
                    "uvsu-card-art-option uvsu-card-art-alternate-option";
                button.dataset.cardId = context.cardId;
                button.dataset.deckId = context.deckId;
                button.dataset.artworkId = variant.artworkId;
                button.textContent = variant.label;
                button.title = `${variant.setId}/${variant.cardNumber}`;

                button.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectVariant(menu, context, variant);
                });
                addPreviewHover(button, variant);

                list.appendChild(button);
            });

            selector.appendChild(list);
        }

        selector.addEventListener("mouseleave", () => {
            previewVariant(
                cardArt.getSelection(context.cardId, context.deckId)
            );
        });

        menu.querySelector(".cluetip-inner")?.appendChild(selector);
        applySelection(
            context,
            cardArt.getSelection(context.cardId, context.deckId)
        );
    }

    document
        .querySelectorAll(".listing_deck .card-list")
        .forEach((card) => {
            const context = getCardContext(card);

            if (!context || cardArt.getVariants(context.cardId).length < 2) {
                return;
            }

            applySelection(
                context,
                cardArt.getSelection(context.cardId, context.deckId)
            );
        });

    const menuObserver = new MutationObserver(enhanceActionMenu);

    menuObserver.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );

    document.addEventListener(
        "mouseover",
        (event) => {
            if (!(event.target instanceof Element)) {
                return;
            }

            const card = event.target.closest(
                ".listing_deck .card-list"
            );
            const context = card ? getCardContext(card) : null;

            if (
                !context ||
                cardArt.getVariants(context.cardId).length < 2
            ) {
                return;
            }

            window.requestAnimationFrame(() => {
                applySelection(
                    context,
                    cardArt.getSelection(
                        context.cardId,
                        context.deckId
                    )
                );
            });
        },
        true
    );

    enhanceActionMenu();
})();
