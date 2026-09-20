(() => {
    "use strict";

    if (globalThis.UVSU_CARD_ART) {
        return;
    }

    const STORAGE_KEY = "uvsu-card-art-v1";
    const IMAGE_VERSION = "20240802";
    const REMOTE_IMAGE_ORIGIN = "https://raw.githubusercontent.com";
    const SAFE_PATH_SEGMENT = /^[a-z0-9_-]+$/i;
    const remoteRevision = globalThis.UVSU_REMOTE_CARD_ART_REVISION;
    const REMOTE_IMAGE_PREFIX = new RegExp("^[0-9a-f]{40}$").test(
        remoteRevision
    )
        ? `/tannerface26-dev/uvs-tts-assets/${remoteRevision}/alternate-art/`
        : null;
    const remoteVariantsByCardId = globalThis.UVSU_REMOTE_CARD_ART || {};
    const variantsByCardId = Object.freeze(
        Object.fromEntries(
            Object.keys(remoteVariantsByCardId).map((cardId) => [
                cardId,
                Object.freeze(
                    remoteVariantsByCardId[cardId].map((variant) => Object.freeze({
                        ...variant,
                        transformBack: variant.transformBack
                            ? Object.freeze({ ...variant.transformBack })
                            : undefined
                    }))
                )
            ])
        )
    );

    function getVariants(cardId) {
        return variantsByCardId[String(cardId)] || [];
    }

    function readSelections() {
        try {
            const stored = JSON.parse(
                window.localStorage.getItem(STORAGE_KEY) || "{}"
            );

            return stored && typeof stored === "object" ? stored : {};
        } catch (_) {
            return {};
        }
    }

    function getStorageId(cardId, deckId) {
        return deckId ? `${deckId}:${cardId}` : String(cardId);
    }

    function getSelection(cardId, deckId) {
        const variants = getVariants(cardId);

        if (!variants.length) {
            return null;
        }

        const selections = readSelections();
        const storageId = getStorageId(cardId, deckId);
        const selectedKey = selections[storageId];
        const exactSelection = variants.find(
            (variant) => variant.artworkId === selectedKey
        );

        if (exactSelection) {
            return exactSelection;
        }

        if (
            typeof selectedKey === "string" &&
            selectedKey !== "original"
        ) {
            const legacyMatches = variants.filter(
                (variant) =>
                    `${variant.setId}/${variant.cardNumber}` === selectedKey ||
                    variant.legacyQualifiers?.includes(selectedKey) ||
                    variant.setId === selectedKey
            );

            if (legacyMatches.length === 1) {
                const migrated = legacyMatches[0];
                selections[storageId] = migrated.artworkId;

                try {
                    window.localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify(selections)
                    );
                } catch (_) {
                    // The validated in-memory selection is still safe to use.
                }

                return migrated;
            }
        }

        return variants[0];
    }

    function select(cardId, artworkId, deckId) {
        const variants = getVariants(cardId);
        const selected = variants.find(
            (variant) => variant.artworkId === artworkId
        );

        if (!selected) {
            return null;
        }

        const selections = readSelections();
        selections[getStorageId(cardId, deckId)] = selected.artworkId;

        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(selections)
            );
        } catch (_) {
            return null;
        }

        return selected;
    }

    function getImageURL(variant, size) {
        const suffixes = {
            preview: "-preview",
            micro: "-ci-micro"
        };

        if (!variant || !(size in suffixes)) {
            return null;
        }

        const remoteImageUrl = variant.imageUrls?.[size];

        if (remoteImageUrl) {
            try {
                const url = new URL(remoteImageUrl);
                const isAllowed =
                    url.origin === REMOTE_IMAGE_ORIGIN &&
                    REMOTE_IMAGE_PREFIX &&
                    url.pathname.startsWith(REMOTE_IMAGE_PREFIX) &&
                    !url.username &&
                    !url.password &&
                    !url.search &&
                    !url.hash;

                return isAllowed ? url.href : null;
            } catch (_) {
                return null;
            }
        }

        if (
            !SAFE_PATH_SEGMENT.test(variant.setId || "") ||
            !SAFE_PATH_SEGMENT.test(variant.cardNumber || "")
        ) {
            return null;
        }

        return `/images/extensions/${variant.setId}/${variant.cardNumber}${suffixes[size]}.jpg?${IMAGE_VERSION}`;
    }

    globalThis.UVSU_CARD_ART = Object.freeze({
        getImageURL,
        getSelection,
        getVariants,
        select
    });
})();
