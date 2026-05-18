export function setupGraphEvents(cy, deps) {
    const {
        NODE_LABELS,
        expandEdge,
        collapseEdge,
        saveWorkspace,
        createNodeBadges,
        removeNodeBadges,
        openFieldEditor,
        removeNodeUI,
        renderNodeLabels
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
    window.NODE_EDIT_MODE = false;

    cy.nodes().unselect();

    renderNodeLabels(cy);

    Object.values(NODE_LABELS).forEach((el) => {

        const title = el.querySelector('.title');
        const value = el.querySelector('.value');

        if (title) title.disabled = true;
        if (value) value.disabled = true;

        el.style.zIndex = "1";
    });


    if (window.ACTIVE_EDGE) {
        collapseEdge(window.ACTIVE_EDGE);
        window.ACTIVE_EDGE = null;
        return;
    }

    openCreateConceptPanel();

});

    cy.on("tap", "node", (e) => {


    if (
    e.originalEvent &&
    e.originalEvent.target &&
    e.originalEvent.target.closest &&
    e.originalEvent.target.closest('.graph-badge')
    ) {
    return;
    }

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

    if (window.ACTIVE_NODE_ID === id) {

    window.NODE_EDIT_MODE = true;

    } else {

    window.ACTIVE_NODE_ID = id;

    window.NODE_EDIT_MODE = false;

    }


    const now = Date.now();
    renderNodeLabels(cy);

    if (window.NODE_EDIT_MODE) {

    const node = e.target;

    const clickY = e.renderedPosition.y;
    const nodeY = node.renderedPosition().y;

    const dy = clickY - nodeY;

    if (dy < -18) {

    openFieldEditor(cy, node, 'title');

    return;
    }
    
    // VALUE ZONE
    if (dy > -10 && dy < 20) {

        openFieldEditor(cy, node, 'value');

        return;
    }

    if (dy > 26) {

    openFieldEditor(cy, node, 'unit');

    return;
    }

    }

    if (window.UI_MODE === "v3") {
        createNodeBadges(cy, node);
    }

    });




    }

    setupEdgeInteraction(cy);
}