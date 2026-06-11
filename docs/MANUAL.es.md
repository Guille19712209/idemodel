# IdeModel — Manual de uso

> Versión de referencia: sesión 21 · Claude Opus 4.8

---

## ¿Qué es IdeModel?

IdeModel es una herramienta para generar **modelos integrales de funcionamiento de ideas**. Permite desarrollar, analizar y compartir ideas de manera visual, definiendo relaciones cualicuantitativas entre elementos. El resultado es un sistema representado en un **grafo interactivo** con dimensión temporal.

**Aspiración central:** externalizar un modelo mental individual que, una vez expresado, sirva como punto de partida para construir un modelo mental colectivo.

---

## 1. Acceso

### Login

Ingresá a [idemodel.app](https://idemodel.app). El acceso es por **invitación** — tu cuenta debe ser creada previamente por el administrador.

1. Hacé click en **Continuar con Google**
2. Seleccioná tu cuenta de Gmail
3. Si tu email está autorizado, entrás directo al modelo

> Si ves "No autorizado", tu cuenta todavía no fue habilitada. Contactá al administrador.

### Roles de usuario

Cada usuario tiene un rol dentro de cada modelo:

| Rol | Puede ver | Puede editar | Puede compartir |
|---|---|---|---|
| **Owner** | ✅ | ✅ | ✅ |
| **Writer** | ✅ | ✅ | ❌ |
| **Reader** | ✅ | ❌ | ❌ |

---

## 2. La pantalla principal

Al entrar verás el **grafo** del modelo activo, con controles distribuidos en las esquinas:

```
[💡 Logo]  ← idemodel / Nombre del modelo →  [⏱ Tiempo]
                                                    ↑
           [       Canvas / Grafo          ]   Slider de período
                                                    ↓
[⚙ Settings]                             [+ Agregar nodo]
```

- **Top-left (💡):** panel de archivo, modelo, usuarios
- **Top-right (⏱):** control de períodos temporales
- **Bottom-left (⚙):** configuración visual y de vista
- **Bottom-right (+):** crear nuevo nodo

### Enfoque y atenuación

Cuando activás un elemento, **el resto del modelo se atenúa** (baja a una fracción de su opacidad definida) para que el foco se destaque solo. Pasa en tres situaciones:

- **Seleccionás un nodo** (para editarlo) → quedan a opacidad plena ese nodo, sus links y los chips de esos links; el resto se atenúa.
- **Activás un concept** (click en un chip de concept) → quedan plenos los nodos y links que tienen ese concept; el resto se atenúa.
- **Activás un grupo** (chip de Groups en el panel de relaciones) → quedan plenos los nodos del grupo (a su opacidad definida) y los links entre ellos; el resto se atenúa.

Para apagarlo: click en cualquier zona vacía del grafo, o desactivá lo que activaste (re-click en el mismo concept/grupo). Los nodos **ocultos** (Hidden) no se ven afectados.

---

## 3. Entidades del modelo

IdeModel trabaja con las siguientes entidades:

### Nodos
La unidad fundamental del modelo. Cada nodo representa un **elemento** del sistema (variable, actor, recurso, proceso, etc.).

**Atributos de un nodo:**
- **Label** — nombre visible (editable, debe ser único)
- **Value / Fórmula** — valor numérico o expresión calculada
- **Shape** — forma: elipse, rectángulo redondeado, rectángulo, diamante
- **Color + Alpha** — color de fondo y opacidad
- **Size** — tamaño fijo en px, o automático según unidad
- **Unit** — unidad de medida asociada (ej: $, kg, m²)
- **Hidden** — nodo visible u oculto (transparente + punteado)
- **Comment** — nota libre del nodo
- **Position** — coordenadas x, y en el canvas
- **Parent** — relación jerárquica con otro nodo

### Links (conexiones)
Representan relaciones entre nodos. Existen tres tipos:

| Tipo | Descripción | Cómo se crea |
|---|---|---|
| **Parent** | Jerarquía — "A es hijo de B" | Panel de relaciones → chip Parent |
| **Concept Link** | Conexión semántica manual entre nodos | Panel de relaciones → chip Concept Link |
| **Formula** | Derivado automáticamente de las fórmulas (flecha entrante al nodo que usa a otro) | Automático |

> Los links **no se persisten en la base de datos** directamente. Los de tipo `parent` se derivan del campo `parent` del nodo. Esto garantiza consistencia estructural.

### Concepts
Categorías semánticas que se asignan a los **links** para calificar la naturaleza de la relación.

- Un link puede tener varios concepts
- Los concepts se crean al vuelo desde el panel de concepts
- Se pueden usar para filtrar y colorear links en el grafo
- Tienen nombre y color

### Groups
Agrupaciones transversales de nodos. Un nodo puede pertenecer a varios grupos.

- Los grupos tienen nombre y color
- Al hacer click en un grupo en el panel de relaciones, se **destacan** (outline del color del grupo) todos los nodos del grupo en el grafo y **el resto del modelo se atenúa** (ver [Enfoque y atenuación](#enfoque-y-atenuacion))
- Para apagar el destaque: volvé a clickear el mismo grupo, o hacé click en cualquier otra cosa (nodo, link o zona vacía) — los nodos vuelven a su estado normal y el seleccionado a su borde gris

### Unidades
Definen escalas de medida. Cada unidad tiene:
- Nombre (ej: "$", "kg", "NPS")
- Rango de valor (min_value → max_value)
- Rango de tamaño visual (min_sz → max_sz en px)
- **Formato de número** — cómo se muestran sus valores (ver más abajo)

Los nodos con `size_type: "by unit"` se dimensionan automáticamente según su valor relativo al rango de la unidad.

### Períodos
La dimensión temporal del modelo. Cada modelo tiene:
- **Cantidad de períodos** (1 a N)
- **Unidad de tiempo** (hora, día, semana, mes, trimestre, semestre, año, momento)
- **Fecha de inicio** (desde cuándo cuentan los períodos)

---

## 4. Trabajar con nodos

### Crear un nodo

Hacé click en el botón **+** (esquina inferior derecha). El nuevo nodo aparece cerca del nodo activo, ya en modo edición del título.

- Escribí el nombre y presioná **Enter** para confirmar
- **Escape** cancela y elimina el nodo

### Mover un nodo

Arrastrá el nodo a la posición deseada. La posición se guarda automáticamente.

> **Ctrl+Z** (o Cmd+Z en Mac) deshace el último movimiento.

### Editar el label

Hacé click sobre el **nombre** del nodo. Aparece un campo de texto flotante. Escribí y presioná Enter.

### Editar el valor / fórmula

Hacé click sobre el **valor** del nodo. Se abre el **editor de fórmulas** con resaltado de sintaxis.

- Podés escribir un número simple: `42`
- O una fórmula con referencias a otros nodos: `Ventas[0] - Costos[0]`
- **Enter** guarda, **Escape** cancela

Ver sección [Fórmulas](#9-fórmulas) para la sintaxis completa.

#### Carga rápida (chips del editor)

Arriba del editor hay tres chips para cargar datos más rápido:

- **All times** — toma la fórmula que estás editando y la **replica en todos los períodos** del nodo. Pide confirmación antes. Útil para fórmulas que valen igual en toda la línea de tiempo (los offsets relativos como `[-1]` se evalúan por período). Si la fórmula tiene un `AI("...")`, en vez de copiar el mismo valor la IA **proyecta una serie** (un valor por período).
- **From now** — igual que All times pero replica la fórmula **desde el período activo hasta el último** (no toca los períodos anteriores). Pide confirmación e indica cuántos períodos se afectan.
- **Import** — carga una **serie de valores** desde la posición actual hacia adelante:
  - **Paste** — pegás una serie de números separados por espacios. Se cargan tantos como períodos queden disponibles desde el período actual.
  - **Load CSV** — cargás un archivo CSV; sus números se precargan en el panel de Paste para revisarlos antes de aplicar.
  - Si la serie tiene **más** números que períodos disponibles, se cargan los que entran y se avisa que los sobrantes no se pegan.

### Eliminar un nodo

Hacé click en el badge **✕** (rojo) que aparece al seleccionar el nodo. Confirma en el diálogo.

---

## 5. Badges de nodo

Al seleccionar un nodo aparecen **6 badges** posicionados sobre él:

```
  [✏ Estilo]  [🔗 Relaciones]  [💬 Comments]  [🕐 Timeline]  [⧉ Copy]  [✕ Eliminar]
```

### Badge Estilo (pincel)

Abre el panel de estilo:

| Chip | Opciones |
|---|---|
| **Shape** | Ellipse / Round-rectangle / Rectangle / Diamond |
| **Color** | Paleta de 8 colores + custom. Incluye control de alpha (opacidad) |
| **Size** | Fixed (px manual) / By unit (automático según valor) |
| **Hidden** | On/Off — nodo transparente con borde punteado |
| **Coords** | X e Y — editable, mueve el nodo a esa posición |

### Badge Relaciones (🔗)

Abre el panel de relaciones:

**Parent:** Seleccioná otro nodo como padre jerárquico. Crea una conexión parent en el grafo.

**Concept Link:** Seleccioná uno o más nodos para crear links manuales entre ellos.

**Groups:** Ves los grupos a los que pertenece el nodo. Podés:
- Hacer click en un grupo para destacarlo en el grafo
- Editar el nombre del grupo
- Eliminar el nodo de ese grupo (×)
- Agregar el nodo a grupos existentes o crear uno nuevo (+)

### Badge Comments (💬)

Área de texto libre asociada al nodo. Se guarda automáticamente al perder el foco.

### Badge Timeline (🕐)

Abre la tabla **Values in Time** centrada en ese nodo. Ver sección [Time table](#8-tabla-values-in-time).

### Badge Copy (⧉)

Duplica el nodo. Abre un panel con:
- **Copy childs** (on/off) — si está on, copia también todo el subárbol (los childs y los childs de estos).
- **Copies** (número) + **go!** — genera esa cantidad de copias.

Cada copia se crea con el **nombre + número correlativo** (`Ventas 1`, `Ventas 2`…; si el nombre ya existe, salta al próximo libre) y queda como **hermana** del original (mismo padre). Se copian sus atributos (forma, color, tamaño, unidad, etc.), sus **grupos**, sus **concept links** y las **fórmulas de todos los períodos**. En las fórmulas, las auto-referencias y las referencias a otros nodos dentro del subárbol copiado apuntan a las copias; las referencias a nodos de afuera quedan apuntando al original. Se puede deshacer con Undo.

> Disponible solo para roles con permiso de edición (no reader).

### Badge Eliminar (✕)

Confirma y elimina el nodo junto con todos sus edges y valores.

---

## 6. Panel Settings (⚙)

El botón de configuración (bottom-left) despliega chips hacia arriba agrupados en secciones:

### VIEW

| Chip | Función |
|---|---|
| **Zoom all** | Ajusta el zoom para ver todos los nodos visibles |
| **Center** | Centra el nodo seleccionado en pantalla |
| **Re-arrange** | Reordena el grafo automáticamente. Dos modos: **Compact** (orgánico, agrupa por cercanía al padre) y **Tree** (árbol radial: raíz al centro, cada rama en su sector). Reversible con undo |
| **Filter** | Define qué nodos se ven, por **grupo / unidad / concepto / parentesco / nombre** (ver abajo) |
| **Links** | Toggle individual: Parent link / Concept link / Formula link |
| **View level** | Filtra la jerarquía por profundidad (0 = todos, N = solo raíces) |
| **Show hidden** | Muestra/oculta los nodos marcados como hidden |
| **Concepts** | Modo de visualización de concepts: none / active / all |

**Filter** — abre un panel con 5 categorías (Groups / Units / Concepts / Parentage / Node name).
Tocá una para elegir qué dejar visible: las opciones **all** y **none** vienen primero, y cada ítem
tiene un círculo con su color. El botón **ok** vuelve a la lista de categorías, donde un círculo gris
muestra cuántos seleccionaste en cada una. El grafo deja visibles solo los nodos que cumplen **todas**
las categorías activas (con sus edges y concepts), apagando el resto. Una categoría en **all** no filtra.

**Re-arrange** — *Compact* usa físicas (los hijos se acercan a su padre, los hermanos se reparten);
*Tree* es un árbol radial donde la raíz queda al centro y cada subárbol ocupa una "rama" (cuña) propia,
con los anillos separándose lo necesario para que los nodos no se solapen.

### STYLE

| Chip | Función |
|---|---|
| **Background color** | Color de fondo del canvas |
| **Background image** | Imagen de fondo: subí la tuya (a storage) o usá el preset **Blackboard** (pizarra). *Remove* la quita. |

### UNITS

Abre el gestor de unidades del modelo. Para cada unidad podés definir nombre, rangos de valor y tamaño, y el **formato de número**.

**Formato de número (columna "format"):** define cómo se muestran los valores de los nodos de esa unidad, tanto en el grafo como en la tabla. Hacé click en la columna *format* de la unidad y elegí:

| Formato | Ejemplo (1234.5) |
|---|---|
| **Plain** | 1234.5 (crudo, sin formato) |
| **Integer** | 1,235 (entero, con separador de miles) |
| **2 decimals** | 1,234.50 |
| **Accounting** | 1,234.50 — los negativos se muestran entre paréntesis: (1,234.50) |
| **Percent** | 1,234.5% (agrega el símbolo %) |

> El formato es **solo de presentación**: el valor real y las fórmulas no se modifican. Los exports CSV/PDF usan el número crudo.

---

## 7. Panel Time (⏱)

El botón de tiempo (top-right) despliega chips hacia abajo:

| Chip | Función |
|---|---|
| **Periods** | Cantidad de períodos del modelo |
| **Time unit** | Unidad temporal: hora / día / semana / mes / trimestre / semestre / año / momento |
| **Starting date** | Fecha de inicio del período 1 |

El **slider** debajo del botón permite navegar entre períodos. Las flechas ◀ ▶ van de a un período.

El label junto al slider muestra la fecha del período activo (ej: "Oct '26").

> Al cambiar el período activo, todos los valores del grafo se actualizan para mostrar los datos de ese período.

---

## 8. Tabla Values in Time

Accedé desde el badge de reloj (**🕐**) de cualquier nodo. Se abre un panel deslizante en la parte inferior.

### Estructura

```
Values in time   [values|formulas]   [FILTER]   [EXPORT]
─────────────────────────────────────────────────────────
Node         │  P1      │  P2      │  P3  ...
─────────────────────────────────────────────────────────
Ventas       │   100    │   120    │  140
Costos       │    60    │    70    │   80
Margen       │    40    │    50    │   60
```

- Podés **redimensionar** el panel arrastrando el borde superior hacia arriba
- La **columna activa** (período actual) se resalta en blanco
- Hacer click en una celda de otro período lo activa y actualiza el grafo

### Editar valores / fórmulas

Hacé click en cualquier celda. Se abre el editor de fórmulas con resaltado de sintaxis, igual que en el nodo — incluidos los chips **All times** e **Import** para carga rápida (ver [sección 4](#editar-el-valor--fórmula)). Al importar una serie desde una celda, los valores se cargan desde ese período hacia adelante.

> En modo **values**, los números se muestran con el **formato de la unidad** del nodo (ver [Settings → Units](#units)).

### Toggle Values / Formulas

- **values** — muestra el resultado numérico calculado
- **formulas** — muestra el texto de la fórmula en formato legible (ej: `Ventas[0] - Costos[0]`)

### Filtros

El chip **FILTER** abre un panel compacto con:

| Sección | Descripción |
|---|---|
| **Sort** | Default / A→Z / Z→A |
| **Parent** | Filtra por nodo padre |
| **Group** | Filtra por grupo |
| **Concept** | Filtra por concept asignado a edges |
| **Elements** | Selección directa de nodos a mostrar |

"all" en cualquier filtro = sin filtro aplicado.

### Export

El chip **EXPORT** abre opciones:
- **CSV** — descarga los datos visibles (con filtros y modo values/formulas aplicados) como tabla separada por comas
- **PDF** — genera un PDF con header de IdeModel (logo + nombre del modelo + metadata) y la tabla de datos

---

## 9. Fórmulas

### Principio

Las fórmulas son **instrucciones** que calculan el valor del nodo al que pertenecen. No existe asignación explícita — la fórmula ya pertenece al nodo.

En lugar de escribir `Caja = Ingresos - Egresos`, dentro del nodo **Caja** escribís simplemente:

```
{Ingresos}[0] - {Egresos}[0]
```

### Referencias a nodos

Toda referencia tiene dos componentes: **nodo** y **offset temporal**. El nombre del nodo va entre **llaves** y el offset entre corchetes:

```
{NombreNodo}[offset]
```

Las llaves delimitan el nombre exacto, así no hay ambigüedad cuando una etiqueta tiene espacios o es prefijo de otra (ej. `{Direct}` vs `{Direct unit.}`). En el editor las llaves se ven tenues; el nombre del nodo va resaltado.

| Offset | Significado |
|---|---|
| `[0]` | Período actual |
| `[-1]` | Período anterior |
| `[-2]` | Dos períodos atrás |
| `[+1]` | Próximo período |

**Regla importante:** Un nodo no puede referenciarse a sí mismo en el período actual o futuro. Solo períodos anteriores:
```
✅ {Caja}[-1] + {Ingresos}[0]
❌ {Caja}[0]   (referencia circular)
```

### Autocomplete

Al escribir en el editor:
- Tipear letras → sugiere nombres de nodos y funciones
- Al seleccionar un nodo → inserta `{NombreNodo}[0]` (el `0` queda editable)
- Tipear `[` → sugiere offsets comunes (0, -1, -2, +1)

### Operadores

```
+   suma
-   resta
*   multiplicación
/   división
^   potencia
()  agrupación
=   igual
!=  distinto
>   mayor
<   menor
>=  mayor o igual
<=  menor o igual
```

### Funciones

```
SUM(a, b, c, ...)           suma de los argumentos
AVG(a, b, c, ...)           promedio
MIN(a, b, c, ...)           mínimo
MAX(a, b, c, ...)           máximo
ABS(x)                      valor absoluto
ROUND(x, decimales)         redondeo
RND(a, b)                   número al azar entre a y b (ver nota)
AI("pedido")                la IA estima un número y se sella (ver nota)
IF(condición, sí, no)       condicional
AND(a, b, ...)              1 si todas verdaderas
OR(a, b, ...)               1 si alguna verdadera
NOT(x)                      invierte (0→1, 1→0)
```

#### RND / FRND — valores aleatorios

Hay dos funciones de azar, según quieras que el número quede fijo o que cambie:

- **`RND(a, b)` — aleatorio estable.** Genera un número al azar entre `a` y `b` y lo **fija al guardar**: escribís `RND(10, 20)`, guardás, y la celda queda con un número concreto (ej: `15`) que ya no cambia. Sirve para **poblar una serie de ejemplo** que después se mantiene.
- **`FRND(a, b)` — aleatorio vivo.** Queda en la fórmula y se **re-sortea en cada actualización** (cada vez que el modelo recalcula: al editar nodos, mover el tiempo, recargar la página, etc.). Sirve para que el valor sea distinto cada vez. Ojo: por eso **no es reproducible** — al recargar o exportar sale otro número.

Ambas comparten:
- Si `a` y `b` son enteros → resultado entero. Si alguno tiene decimales → 2 decimales.
- Combinables con todo: `RND(100, 200) + {Ventas}[0]`, `FRND(1, 5)`.
- Con **All times** / **From now**, cada período recibe lo suyo (RND fija un número distinto por período; FRND queda vivo en cada uno).
- Los argumentos deben ser números (no referencias a nodos).

#### AI("...") — estimar un valor con inteligencia artificial

Cuando no tenés el dato a mano, podés **pedirle a la IA que lo estime** desde un pedido en
lenguaje natural. Escribís en la fórmula:

```
AI("costo de flete por tonelada Noruega→Uruguay por barco")
```

o componiéndolo con el resto:

```
{Volumen}[0] * AI("costo de flete por tonelada")
```

`AI` es **una función más**: aparece en el autocomplete (escribís `ai` y la elegís) y se resalta como las demás. Al elegirla inserta `AI("")` con el cursor entre las comillas, listo para escribir.

Cómo se comporta:
- **Se sella al guardar** (igual que `RND`): la IA devuelve un número y `AI("...")` se reemplaza
  por ese literal. El recálculo **no** vuelve a llamar a la IA — el valor queda fijo. Para
  re-estimar, volvés a escribir `AI("...")`.
- **Usa tu propia API key** (la del panel **AI**, que guardás una sola vez). Cada `AI("...")` es
  **una llamada** y consume tokens de **tu** cuenta. Si no cargaste la key, el editor te avisa.
- **No busca en la web**: estima con el conocimiento del modelo de IA. El **sustento** (tu pedido +
  el razonamiento + la fecha) queda guardado en el **comment del nodo**, para que puedas auditarlo.
- Con **All times** / **From now**, en vez de copiar el mismo valor, la IA **proyecta una serie**:
  un valor por período considerando la fecha de cada uno (tendencia/estacionalidad), en **una sola
  llamada**. Cada período queda con su valor sellado. Pide confirmación antes (avisa el costo).

### Ejemplos

```
42
Ventas[0] - Costos[0]
Clientes[-1] * 1.05
Caja[-1] + Ingresos[0] - Egresos[0]
Stock[-1] + Produccion[0] - Ventas[0]
ROUND(AVG(A[0], B[0], C[0]), 2)
IF(Margen[0] > 0, Margen[0] * 0.1, 0)
SUM(Ventas[-1], Ventas[-2], Ventas[-3])
```

### Cálculo automático y propagación

Los valores se recalculan **en cadena**. Si `A = B[0] + 10` y `B = C[0] * 2` y `C = 5`, al cargar el modelo se resuelven en el orden correcto (C → B → A) sin importar cómo estén ordenados los nodos.

Cuando editás una fórmula, **todos los nodos que dependen de ella se actualizan al instante**. Por ejemplo, si cambiás `C`, los valores de `B` y `A` se recalculan solos — no hace falta recargar.

El cálculo respeta la dimensión temporal: las referencias a períodos anteriores (`[-1]`, `[-2]`) siempre leen valores ya resueltos.

### Flechas de dependencia

Cuando la fórmula de un nodo menciona a otro nodo, aparece automáticamente una **flecha de tipo fórmula** en el grafo. La flecha **entra** al nodo que contiene la fórmula (el que "usa" al otro).

Ejemplo: si la fórmula de `Margen` es `Ventas[0] - Costos[0]`, aparecen dos flechas entrantes a `Margen` (desde `Ventas` y desde `Costos`).

Estas flechas se pueden mostrar/ocultar desde **Settings → Links → Formula link**.

### Ciclos de dependencia

Un **ciclo** ocurre cuando dos o más nodos se referencian circularmente en el mismo período (ej: `A = B[0]` y `B = A[0]`). IdeModel lo maneja de dos formas:

- **Al editar:** si la fórmula que estás escribiendo crearía un ciclo, el editor lo bloquea y muestra *"This formula creates a dependency cycle"*. No te deja guardar hasta corregirlo (Escape cancela).
- **Visualmente:** cualquier nodo que quede en un ciclo (por ejemplo, cargado desde un modelo viejo) se marca con **borde rojo** y muestra **⚠** en lugar del valor. El borde y el símbolo desaparecen solos cuando rompés el ciclo.

---

## 10. Concepts

Los concepts son etiquetas semánticas que describen la **naturaleza de una relación** entre dos nodos.

### Cómo asignar concepts

1. Activá el modo de visualización desde Settings → **Concepts** (none / active / all)
2. Hacé click en un link (o en su hub) → su hub pasa a círculo gris con **+** y se despliegan sus chips de concepts
3. Hacé click en el hub **+** → abre el panel de concepts del link
4. Desde el panel podés:
   - Activar/desactivar concepts existentes del modelo
   - Crear un nuevo concept (nombre + color)
   - Eliminar un concept

### Cómo se ven los hubs según el modo

El círculo **+** (gris, tamaño normal) **solo aparece en el link seleccionado** — así se evita la tensión visual de tener todos los **+** a la vez. El resto de los hubs cambian según el modo:

| Modo | Chips de concepts | Hub de cada link (no seleccionado) |
|---|---|---|
| **none** | Ocultos | Círculo del color del link con el **número** de concepts en negro; si es 0, no se ve |
| **active** | Solo los del nodo seleccionado | Igual que `none` (color del link + número; oculto si 0) |
| **all** | Todos desplegados | Punto chico (30%) del color del link, **sin número ni +** |

En cualquier modo, el link seleccionado mantiene el hub gris con **+** y sus chips desplegados.

### Filtrar por concept

Hacé click en un chip de concept desplegado → el grafo **resalta** los links y nodos relacionados con ese concept y **atenúa** el resto (ver [Enfoque y atenuación](#enfoque-y-atenuacion)). Para apagar el filtro: hacé click de nuevo sobre el mismo chip, o click en cualquier zona vacía del grafo.

---

## 11. Panel Logo (💡)

El botón con el logo de IdeModel (top-left) despliega chips hacia abajo:

### FILE

| Chip | Función |
|---|---|
| **New** | Crea un modelo vacío con defaults (8 unidades, nombre "New Model v1") |
| **Open** | Lista todos tus modelos. Doble click para abrir. Incluye búsqueda y ordenamiento |
| **Share** | Gestiona acceso de otros usuarios (roles: owner / writer / reader) |
| **Export** | Exporta a **PDF** (una página por período) o **JSON** (modelo completo, legible para IA) |
| **Import** | Carga un **JSON** y crea un **modelo nuevo** a partir de él (no toca el modelo actual) |

### MODEL

| Chip | Función |
|---|---|
| **Version** | Número de versión editable. El pill "new" crea una copia del modelo con versión incrementada |
| **Started on** | Fecha de inicio del proyecto |
| **Comments** | Notas libres del modelo |

### USERS

| Chip | Función |
|---|---|
| **Owner** | Nombre del creador del modelo (solo lectura) |
| **Last Review** | Fecha de última modificación + avatar del usuario |
| **Me** | Nombre y avatar del usuario actual. Pill "Close session" para cerrar sesión |

---

## 12. Navegación y búsqueda

### Mover el canvas

Arrastrá en cualquier zona vacía del canvas para hacer pan. Usá la rueda del mouse o el gesto de pinch para hacer zoom.

### Zoom all

Settings (⚙) → **Zoom all** — ajusta automáticamente el zoom para ver todos los nodos visibles en pantalla.

### Centrar en nodo

Settings (⚙) → **Center** — centra el nodo actualmente seleccionado en pantalla.

### Buscar nodo

El badge de búsqueda (ícono 🔍 sobre el botón Settings) abre un campo de búsqueda:

1. Hacé click en el ícono lupa
2. Escribí el nombre del nodo
3. Seleccioná de la lista filtrada
4. El grafo centra y selecciona ese nodo

---

## 13. Versionado

Cada modelo tiene un número de versión. El flujo de "nueva versión":

1. Abrí el panel Logo → **Version**
2. Hacé click en el pill **new**
3. Se crea una **copia completa** del modelo (nodos, links, valores, unidades) con versión incrementada
4. El navegador abre el nuevo modelo automáticamente

El modelo original queda intacto.

---

## 14. Compartir

1. Abrí el panel Logo → **Share**
2. Escribí el email del usuario (debe estar registrado en IdeModel)
3. Asigná un rol: **owner** / **writer** / **reader**
4. El usuario verá el modelo en su lista con el badge "new share"

Para **revocar acceso**: hacé click en el ícono × junto al usuario en el panel Share.

---

## 15. Undo (deshacer)

**Ctrl+Z** (o Cmd+Z en Mac) deshace la última acción.

También podés hacer click en el badge ↺ (sobre el botón +).

**Acciones deshaciables:**
- Mover nodo
- Crear nodo
- Editar label
- Editar valor / fórmula
- Cambiar color
- Cambiar forma
- Cambiar tamaño
- Toggle hidden

El historial guarda hasta 30 acciones.

---

## 16. Exportar e importar

### Desde el panel Logo

**Export → PDF** — genera un PDF con **una página por período** (selector de rango: From / To). Cada página encuadra todo el modelo centrado y muestra el círculo de período + la fecha del momento; quedan ocultos los botones de Settings y (+). Visto en secuencia, el PDF "cuenta la historia" del modelo en el tiempo.

**Export → JSON** — descarga el modelo **completo** en formato `idemodel.model.v1`: todas las tablas (nodos, unidades, grupos, conceptos, links) con referencias legibles y fórmulas en forma `{Nodo}[offset]`, más una `_spec` que explica la estructura y la sintaxis. Pensado para que una **IA** entienda, evolucione o cree modelos. (Reemplaza al viejo export CSV a nivel modelo.)

**Import** — levanta un JSON `idemodel.model.v1` y crea un **modelo nuevo** (genera identificadores frescos y resuelve todas las referencias). Nunca modifica el modelo abierto. Permite el ciclo: exportar → una IA evoluciona/crea → reimportar.

### Desde la tabla Values in Time

**EXPORT → CSV** — descarga solo los nodos visibles (con filtros aplicados) en el modo de visualización activo (valores o fórmulas).

**EXPORT → PDF** — genera un PDF con:
- Header: logo de IdeModel + nombre del modelo + metadata (autor, períodos, unidad, fechas)
- Tabla de datos visible

---

## 17. Asistente de IA (BYO key)

IdeModel incluye un **asistente de IA** que corre en tu navegador con **tu propia API key** (BYO = *bring your own key*). Se abre con el botón circular **AI**; tiene un chat para pedirle que cree o modifique el modelo (lee el modelo primero y te pide aprobación de cada cambio, salvo que actives auto-apply).

### Configuración (⚙ dentro del panel AI)

1. Elegí el **proveedor**.
2. Pegá tu **API key** (se guarda **solo en este navegador**, una por proveedor).
3. Elegí el **modelo**.

Proveedores soportados:

| Proveedor | Key | Notas |
|---|---|---|
| **Claude (Anthropic)** | `sk-ant-...` | Modelos Sonnet / Opus / Haiku |
| **Gemini (Google)** | `AIza...` | Tiene **free tier** (probar sin pagar) |
| **ChatGPT (OpenAI)** | `sk-...` | Modelos GPT-4o / GPT-4.1 |

> **Sobre el costo:** la key es de la **API** (pago por uso, con créditos), **no** del abono de chat (Claude.ai / ChatGPT Plus): el abono **no** cubre estas llamadas. Tus tokens pagan el uso. Si querés probar gratis, Gemini tiene free tier.

### Relación con la función `AI("...")` de las fórmulas

La función [`AI("...")`](#9-formulas) usa **el mismo proveedor y key** que tengas activos en este panel. Si no cargaste la key, el editor de fórmulas te avisa. Cambiar de proveedor acá cambia con qué IA se resuelven los `AI("...")`.

---

## Ayuda en la app (Help!)

Arriba al centro de la pantalla hay un chip **Help!**. Al hacer click se despliegan dos opciones en la misma línea:

- **Go to user manual** — abre este manual completo en una página nueva, con índice navegable a la izquierda (buscá una sección o usá el filtro del índice).
- **About?** — escribí una palabra o tema y presioná Enter. Busca en el manual y muestra los fragmentos más relevantes en un panel flotante, sin salir de tu modelo. Cada resultado enlaza a la sección completa del manual.

---

## Glosario rápido

| Término | Definición |
|---|---|
| **Nodo** | Elemento del sistema (variable, actor, proceso) |
| **Link** | Relación entre nodos (parent, concept link) |
| **Concept** | Etiqueta semántica asignada a un link |
| **Group** | Agrupación transversal de nodos |
| **Unit** | Unidad de medida con escala visual y formato de número |
| **Formato de número** | Cómo se presentan los valores de una unidad (entero, 2 decimales, contable, %) — solo visual |
| **Período** | Unidad de tiempo del modelo |
| **Fórmula** | Expresión que calcula el valor de un nodo |
| **Offset** | Desplazamiento temporal en una referencia `[0]`, `[-1]`, etc. |
| **Hub** | Nodo pequeño en el centro de un link que da acceso a sus concepts |
| **Hidden** | Nodo transparente con borde punteado (presente pero no prominente) |
| **Parent** | Relación de jerarquía: un nodo es "hijo" de otro |
| **View level** | Profundidad máxima de jerarquía visible |
| **Atenuación (dimming)** | Al activar un nodo/concept/grupo, el resto del modelo baja su opacidad para destacar el foco |
| **`AI("...")`** | Función de fórmula: la IA estima un número y se sella como literal (usa tu API key) |
| **Asistente de IA (BYO key)** | Agente que corre en el navegador con tu propia API key (Claude / Gemini / OpenAI) |

---

*IdeModel — idemodel.app*
