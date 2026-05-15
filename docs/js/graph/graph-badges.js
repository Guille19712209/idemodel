export function createNodeBadges(cy, node) {

  removeNodeBadges(cy);

  const pos = node.position();

  const zoom = cy.zoom();

    const badges = [

        {
            type: "style",
            iconPath: "assets/icon-style.svg",
            angle: 30
        },

        {
            type: "relations",
            iconPath: "assets/icon_relations.svg",
            angle: 55
        },

        {
            type: "comments",
            iconPath: "assets/icon_comments.svg",
            angle: 80
        },

        {
            type: "timeline",
            iconPath: "assets/icon_timeline.svg",
            angle: 105
        }

    ];

  badges.forEach((b) => {

    const radians = (b.angle * Math.PI) / 180;

    const nodeRadius = 40 / zoom;

    const badgeRadius = 25 / zoom;

    const spacing = 30 / zoom;

    const distance =
    nodeRadius +
    badgeRadius +
    spacing;

    const dx = Math.cos(radians) * distance;

    const dy = -Math.sin(radians) * distance;

    const badge = cy.add({
      group: "nodes",

      data: {
        id: `badge_${b.type}`,
        isBadge: true,
        badgeType: b.type,
        iconPath: b.iconPath,
        icon: b.icon,
        parentNodeId: node.id(),
        angle: b.angle
      },

      position: {
        x: pos.x,
        y: pos.y
      }
    });

    badge.ungrabify();
    badge.unselectify();

  });

  updateBadgePositions(cy);
  updateBadgeVisuals(cy);

}

export function removeNodeBadges(cy) {

  cy.nodes('[isBadge]').remove();

}

export function updateBadgePositions(cy) {

  cy.nodes('[isBadge]').forEach((badge) => {

    const parentId = badge.data('parentNodeId');

    const parent = cy.getElementById(parentId);

    if (!parent || parent.empty()) return;

    const pos = parent.position();

    const zoom = cy.zoom();

    const nodeRadius = 40;

    const badgeRadius = 6;

    const spacing = 12;

    const distance =
    nodeRadius +
    badgeRadius +
    spacing;

    const angleFromVertical = badge.data('angle');

    const radians =
    (angleFromVertical * Math.PI) / 180;

    const dx =
    Math.sin(radians) * distance;

    const dy =
    -Math.cos(radians) * distance;

    badge.position({
        x: pos.x + dx,
        y: pos.y + dy
    });

  });

}

export function updateBadgeVisuals(cy) {

  const zoom = cy.zoom();

  cy.nodes('[isBadge]').forEach((badge) => {

    let opacity = 1;

    if (zoom < 1.3) {
      opacity = (zoom - 0.8) / 0.5;
    }

    opacity = Math.max(0, Math.min(1, opacity));

    badge.style({
      opacity: opacity
    });

  });

}