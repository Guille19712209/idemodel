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
        renderNodeLabels,
        toggleConceptFilter
    } = deps;

    function setupEdgeInteraction(cy) {

    // Hub tap: si el edge no tiene concepts o ya está expandido → abre panel directo.
    // Si tiene concepts y está colapsado → expande primero.
    cy.on('tap', 'node[isConceptHub]', (e) => {
        e.stopPropagation();
        const hub  = e.target;
        const edge = cy.getElementById(hub.data('parentEdge'));
        if (!edge.length) return;

        const hasConcepts = (edge.data('concepts') || []).length > 0;

        if (!hasConcepts || edge.data('expanded')) {
            if (typeof window.openConceptPanel === 'function') {
                window.openConceptPanel(edge, cy, hub);
            }
        } else {
            if (window.ACTIVE_EDGE && window.ACTIVE_EDGE.id() !== edge.id()) {
                collapseEdge(window.ACTIVE_EDGE);
            }
            window.ACTIVE_EDGE = edge;
            expandEdge(edge);
            if (typeof window.updateLinkVisibility === 'function') window.updateLinkVisibility();
            saveWorkspace();
        }
    });

    // Chip tap: filtra nodos y edges por concept
    cy.on('tap', 'node[isChip]', (e) => {
        e.stopPropagation();
        const chip = e.target;
        toggleConceptFilter(chip.data('conceptId'), chip);
    });

    // Edge tap: muestra hub siempre, independiente del concept mode
    cy.on('tap', 'edge', (e) => {
        const edge   = e.target;
        const edgeId = edge.id();

        if (typeof window.clearGroupHighlights === 'function') window.clearGroupHighlights();

        if (window.ACTIVE_EDGE && window.ACTIVE_EDGE.id() !== edgeId) {
            const oldHub = cy.getElementById(`hub_${window.ACTIVE_EDGE.id()}`);
            if (oldHub.length) oldHub.css('display', '');
            if (window.CONCEPTS_MODE !== 'all') collapseEdge(window.ACTIVE_EDGE);
        }

        window.ACTIVE_EDGE = edge;

        const hub = cy.getElementById(`hub_${edgeId}`);
        if (hub.length) hub.css('display', 'element');

        if (typeof window.showConceptHubsForSelection === 'function') {
            window.showConceptHubsForSelection(edge);
        }
    });

    // Canvas tap: cierra todo y limpia selección
    cy.on("tap", (e) => {
        if (e.target !== cy) return;

        removeNodeBadges(cy);

        window.NODE_EDIT_MODE = false;
        window.ACTIVE_NODE_ID = null;
        if (typeof window._clearPendingNode === 'function') window._clearPendingNode();
        if (typeof window.closeConceptPanel === 'function') window.closeConceptPanel();
        if (typeof window.closeNodeTimelinePanel === 'function') window.closeNodeTimelinePanel();
        if (typeof window.clearConceptFilter === 'function') window.clearConceptFilter();
        if (typeof window.clearGroupHighlights === 'function') window.clearGroupHighlights();

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
            const prevHub = cy.getElementById(`hub_${window.ACTIVE_EDGE.id()}`);
            if (prevHub.length) prevHub.css('display', '');
            if (window.CONCEPTS_MODE !== 'all') collapseEdge(window.ACTIVE_EDGE);
            window.ACTIVE_EDGE = null;
            cy.style().update();
        }
        if (typeof window.showConceptHubsForSelection === 'function') {
            window.showConceptHubsForSelection(null);
        }
    });

    cy.on("tap", "node", (e) => {
        // Chips y hubs no abren el panel de nodo
        if (e.target.data('isChip') || e.target.data('isConceptHub')) return;

        // Click originado desde un badge DOM — lo maneja el badge
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

        // Tap en cualquier nodo apaga el highlight de grupo activo (vuelve a selección gris)
        if (typeof window.clearGroupHighlights === 'function') window.clearGroupHighlights();

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

        if (typeof window.showConceptHubsForSelection === 'function') {
            window.showConceptHubsForSelection(node);
        }

        // Segundo tap en el mismo nodo abre el editor inline según la zona clickeada
        if (window.NODE_EDIT_MODE) {
            const clickY = e.renderedPosition.y;
            const nodeY  = node.renderedPosition().y;
            const dy     = clickY - nodeY;

            if (dy < -18) { openFieldEditor(cy, node, 'title'); return; }
            if (dy > -10 && dy < 20) { openFieldEditor(cy, node, 'value'); return; }
            if (dy > 26) { openUnitSelector(cy, node); return; }
        }

        if (window.UI_MODE === "v3") {
            createNodeBadges(cy, node);
        }
    });

    }

    setupEdgeInteraction(cy);
}
