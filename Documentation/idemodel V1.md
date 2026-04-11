# IDEMODEL v1

## Definición

IdeModel v1 es un sistema de modelado basado en nodos donde:

- Cada nodo representa una entidad
- Las relaciones se derivan (no se almacenan)

---

## Entidades

### Nodes

Campos:

- id (único, clave técnica)
- label (único, visual)
- parent (id de otro nodo)
- concept (id de otro nodo)
- x, y (posición)
- otros atributos visuales

---

## Relaciones

### 1. Parent
Relación jerárquica:
parent → child

### 2. Concept
Relación semántica dirigida:
concept → node

---

## Principios

- ID ≠ Label
- No duplicación de datos derivados
- Edges se construyen en runtime
- El modelo es independiente de la visualización

---

## Estado

✔ estructura implementada  
✔ visualización funcional  
✔ relaciones derivadas (parent, concept)  
❌ lógica (formulas) no implementada aún