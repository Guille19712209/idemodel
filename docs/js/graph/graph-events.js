export function setupGraphEvents(cy, deps) {
    const {
        NODE_LABELS,
        expandEdge,
        collapseEdge,
        saveWorkspace,
        createNodeBadges,
        removeNodeBadges
    } = deps;

    function setupEdgeInteraction(cy) {

    // chip click → filter concept
    cy.on('tap', 'node[isChip]', (e) => {
        const chip = e.target;
        const conceptName = chip.data('label');
        toggleConceptFilter(conceptName, chip);
    });

    // edge click → expand + open panel
    cy.on('tap', 'edge', (e) => {

        const edge = e.target;

        if (window.ACTIVE_EDGE && window.ACTIVE_EDGE.id() !== edge.id()) {
        collapseEdge(window.ACTIVE_EDGE);
        }

        window.ACTIVE_EDGE = edge;

        const expanded = edge.data('expanded');

        if (!expanded) {
        expandEdge(edge);
        saveWorkspace();
        }

        openEdgePanel(edge);
    });

    // empty space click → create concept
   cy.on("tap", (e) => {

    if (e.target !== cy) return;

    removeNodeBadges(cy);

    removeNodeUI();

    window.NODE_EDIT_MODE = false;
    window.ACTIVE_NODE_ID = null;

    Object.values(NODE_LABELS).forEach((el) => {

        const title = el.querySelector('.title');
        const value = el.querySelector('.value');

        if (title) title.disabled = true;
        if (value) value.disabled = true;

        el.style.zIndex = "1";
    });

    renderNodeLabels(cy);

    if (window.ACTIVE_EDGE) {
        collapseEdge(window.ACTIVE_EDGE);
        window.ACTIVE_EDGE = null;
        return;
    }

    openCreateConceptPanel();

});

    cy.on("tap", "node", (e) => {

    const node = e.target;
    const id = node.id();

    const el = NODE_LABELS[id];
    if (!el) return;

    const titleEl = el.querySelector('.title');
    const valueEl = el.querySelector('.value');
    const unitEl = el.querySelector('.unit');

    Object.entries(NODE_LABELS).forEach(([nid, l]) => {
    const isActive = nid === id;

    l.querySelector('.title').disabled = !isActive;
    l.querySelector('.value').disabled = !isActive;
    });

    el.style.zIndex = "100000";

    window.ACTIVE_NODE_ID = id;

    if (window.UI_MODE === "v3") {
        createNodeBadges(cy, node);
    }

    });


    }

    setupEdgeInteraction(cy);
}