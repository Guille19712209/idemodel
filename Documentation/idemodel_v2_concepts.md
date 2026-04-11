# Idemodel V2 – Concept Layer

## 🎯 Objetivo

Evolucionar el modelo actual (elemento-céntrico) hacia un modelo semántico donde las relaciones tienen significado explícito mediante "conceptos".

---

## 🧠 Modelo Mental

* Elementos (nodes) → representan entidades
* Relaciones (edges) → conectan elementos
* Conceptos → etiquetan relaciones y les dan significado

👉 Los conceptos NO son nodos
👉 Los conceptos NO crean relaciones
👉 Los conceptos enriquecen relaciones existentes

---

## 🧩 Decisiones Clave

* Los conceptos viven en el edge
* Un edge puede tener múltiples conceptos
* Los conceptos son reutilizables globalmente
* No existen "concept-edges"
* Las relaciones siguen siendo únicas por (source, target, type)

---

## 🔗 Tipos de Relaciones

### Automáticas

* formula
* parental

### Manuales

* manual (cuando no existe relación automática)

---

## 🏗️ Modelo de Datos

```json
```
