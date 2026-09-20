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
    const VIEW_STORAGE_KEY = "uvsu-search-view";

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
        button.lastChild.textContent = isDark ? " Original view" : " Dark view";
        button.title = isDark
            ? "Use the original UVS Ultra view"
            : "Use the dark keyword view";
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

            row.dataset.keywordType = type;
            label.classList.remove(
                "uvsu-keyword-trait",
                "uvsu-keyword-response",
                "uvsu-keyword-enhance",
                "uvsu-keyword-form",
                "uvsu-keyword-blitz"
            );
            label.classList.add(`uvsu-keyword-${type}`);
        });

        const abilities = rows.filter(
            (row) => row.dataset.keywordType !== "trait"
        );
        const traits = rows.filter(
            (row) => row.dataset.keywordType === "trait"
        );
        const byName = (left, right) =>
            left.querySelector("label").textContent.trim().localeCompare(
                right.querySelector("label").textContent.trim(),
                undefined,
                { sensitivity: "base" }
            );
        const abilityColumn = getKeywordGroup(
            container,
            "uvsu-keyword-abilities"
        );
        const traitColumns = getKeywordGroup(
            container,
            "uvsu-keyword-traits"
        );

        traitColumns.style.setProperty(
            "--uvsu-trait-rows",
            Math.ceil(traits.length / 2)
        );
        syncKeywordRows(abilityColumn, abilities.sort(byName));
        syncKeywordRows(traitColumns, traits.sort(byName));
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

    setupViewToggle();

    const search = document.querySelector("#search");

    if (search) {
        colorKeywordLabels();
        setupAdditionalFilters();

        const observer = new MutationObserver(() => {
            colorKeywordLabels();
            setupAdditionalFilters();
        });
        observer.observe(search, {
            childList: true,
            subtree: true
        });
    }
})();
