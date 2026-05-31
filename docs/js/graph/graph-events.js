export function setupGraphEvents(cy, deps) {
    const {
        NODE_LABELS,
        expandEdge,
        collapseEdge,
        saveWorkspace,
        createNodeBadges,
        removeNodeBadges,
        openFieldEditor,
        openUnitSelector,
        removeNodeUI,
        renderNodeLabels
    } = deps;

    function setupEdgeInteraction(cy) {

    // hub tap → si sin concepts abre panel directo; si tiene, expande primero y al segundo tap abre panel
    cy.on('tap', 'node[isConceptHub]', (e) => {
        e.stopPropagation();
        const hub      = e.target;
        const edge     = cy.getElementById(hub.data('parentEdge'));
        if (!edge.length) return;

        const hasConceptS = (edge.data('concepts') || []).length > 0;

        if (!hasConceptS || edge.data('expanded')) {
            if (typeof window.openConceptPanel === 'function') {
                window.openConceptPanel(edge, cy, hub);
            }
        } else {
            if (window.ACTIVE_EDGE && window.ACTIVE_EDGE.id() !== edge.id()) {
                collapseEdge(window.ACTIVE_EDGE);
            }
            window.ACTIVE_EDGE = edge;
            expandEdge(edge);
            saveWorkspace();
        }
    });

    // chip double-click → highlight all affected nodes/edges
    cy.on('dbltap', 'node[isChip]', (e) => {
        const chip = e.target;
        const conceptName = chip.data('label');
        toggleConceptFilter(conceptName, chip);
    });

    // edge tap — colapsa el anterior, no abre panel
    cy.on('tap', 'edge', (e) => {
        const edge = e.target;
        if (window.ACTIVE_EDGE && window.ACTIVE_EDGE.id() !== edge.id()) {
            collapseEdge(window.ACTIVE_EDGE);
        }
        window.ACTIVE_EDGE = edge;
    });

    // canvas tap → cierra badges, labels, edges expandidos
    cy.on("tap", (e) => {

        if (e.target !== cy) return;

        removeNodeBadges(cy);
        removeNodeUI();

        window.NODE_EDIT_MODE = false;
        window.ACTIVE_NODE_ID = null;
        if (typeof window._clearPendingNode === 'function') window._clearPendingNode();
        if (typeof window.closeConceptPanel === 'function') window.closeConceptPanel();

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
        }
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
        const id   = node.id();

        const el = NODE_LABELS[id];
        if (!el) return;

        Object.entries(NODE_LABELS).forEach(([nid, l]) => {
            const isActive = nid === id;
            l.querySelector('.title').disabled = !isActive;
            l.querySelector('.value').disabled = !isActive;
        });

        el.style.zIndex = "100000";

        if (window.ACTIVE_NODE_ID === id) {
            window.NODE_EDIT_MODE = true;
        } else {
            if (typeof window._clearPendingNode === 'function') window._clearPendingNode();
            window.ACTIVE_NODE_ID = id;
            window.NODE_EDIT_MODE = false;
        }

        renderNodeLabels(cy);

        // Expandir edges conectados si hay modo concepts activo
        if (window.CONCEPTS_MODE !== 'none') {
            cy.edges().filter(edge =>
                (edge.source().id() === id || edge.target().id() === id) &&
                (edge.data('concepts') || []).length > 0 &&
                !edge.data('expanded')
            ).forEach(edge => {
                if (window.ACTIVE_EDGE && window.ACTIVE_EDGE.id() !== edge.id()) {
                    collapseEdge(window.ACTIVE_EDGE);
                }
                expandEdge(edge);
                window.ACTIVE_EDGE = edge;
            });
            saveWorkspace();
        }

        if (window.NODE_EDIT_MODE) {

            const clickY = e.renderedPosition.y;
            const nodeY  = node.renderedPosition().y;
            const dy     = clickY - nodeY;

            if (dy < -18) {
                openFieldEditor(cy, node, 'title');
                return;
            }

            if (dy > -10 && dy < 20) {
                openFieldEditor(cy, node, 'value');
                return;
            }

            if (dy > 26) {
                openUnitSelector(cy, node);
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
