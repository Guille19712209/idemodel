IDEMODEL v1 — Sistema de Fórmulas
Filosofía

Las fórmulas son instrucciones que calculan el valor del nodo al que pertenecen.

El usuario nunca escribe asignaciones.

No existe:

Caja = Ingresos - Egresos

Se escribe simplemente:

Ingresos[0] - Egresos[0]

porque la fórmula ya pertenece al nodo Caja.

Principio fundamental

Toda referencia tiene dos componentes:

Nodo + OffsetTemporal

No existen referencias sin período.

Sintaxis de referencias

Formato:

NombreNodo[Offset]

Ejemplos:

Ventas[0]
Ventas[-1]
Ventas[-12]
Ventas[+1]
Significado de offsets
[0]

Período actual.

[-1]

Período anterior.

[-2]

Dos períodos atrás.

[+1]

Próximo período.

Regla de consistencia

Esto fue un cambio importante.

Ya no existe:

Ventas

solo.

Es inválido.

Porque genera ambigüedad.

Toda referencia debe indicar explícitamente el período.

Ejemplos
Margen

Nodo:

Margen

Fórmula:

Ventas[0] - Costos[0]
Crecimiento

Nodo:

Clientes

Fórmula:

Clientes[-1] * 1.05
Caja acumulada

Nodo:

Caja

Fórmula:

Caja[-1] + Ingresos[0] - Egresos[0]
Stock

Nodo:

Stock

Fórmula:

Stock[-1] + Produccion[0] - Ventas[0]
Restricciones sobre el propio nodo

Si la fórmula pertenece al nodo:

Caja

entonces:

Permitido:

Caja[-1]
Caja[-2]
Caja[-12]

No permitido:

Caja[0]
Caja[+1]
Caja[+2]

Porque generan dependencia sobre un valor que todavía no está resuelto.

Operadores

Aritméticos:

+
-
*
/
^

Agrupación:

(
)

Comparación:

=
!=
>
<
>=
<=

Lógicos:

AND
OR
NOT
Funciones básicas v1

Matemáticas:

SUM()
AVG()
MIN()
MAX()
ABS()
ROUND()

Aleatorias:

RND(a, b)   número al azar entre a y b; se FIJA al guardar (estable)
FRND(a, b)  número al azar entre a y b; queda VIVO y se re-sortea en cada recálculo

En ambas: args enteros → resultado entero; con decimales → 2 decimales. Los argumentos
deben ser números literales (no referencias a nodos).

Estimación con IA:

AI("pedido en lenguaje natural")  la IA estima un número y se SELLA en la fórmula.

Ejemplo:

  AI("costo de flete por tonelada Noruega→Uruguay por barco")

o componiendo con el resto de la fórmula:

  Volumen[0] * AI("costo de flete por tonelada")

Cómo funciona:
- Se resuelve UNA sola vez al guardar (igual que RND): la IA devuelve un número y AI("...")
  se reemplaza por ese literal. El recálculo NO vuelve a llamar a la IA (no es función viva).
- Usa tu propia API key (la del panel AI, BYO). Cada AI("...") = una llamada; cuesta tokens de tu cuenta.
- No busca en la web: estima con el conocimiento del modelo. El sustento (pedido + razonamiento +
  fecha) queda guardado en el comment del nodo.
- Con "All times" / "From now": en vez de copiar el mismo valor, la IA PROYECTA una serie
  (un valor por período, considerando la fecha de cada uno) en UNA sola llamada, y cada período
  queda con su valor sellado.

Lógicas:

IF()
AND()
OR()
NOT()
Gramática de entrada
Referencias

El usuario empieza a escribir:

ven

Autocomplete:

Ventas
Ventas Netas
Ventas Exterior

Al seleccionar:

Ventas[

queda automáticamente abierto el offset.

Cursor:

Ventas[|

El usuario puede escribir:

0

Resultado:

Ventas[0]

o:

-1

Resultado:

Ventas[-1]
Ayuda visual de offsets

Al abrir el corchete:

Ventas[

pueden aparecer sugerencias:

0   Actual
-1  Anterior
-2  Dos períodos atrás
+1  Próximo
Personalizado...
Funciones

El usuario escribe:

av

Autocomplete:

AVG()

Al aceptar:

AVG()

con el cursor dentro de los paréntesis.

Almacenamiento interno

Aunque visualmente parezca texto:

Ventas[-1] + Costos[0]

las referencias se almacenan estructuradas.

Conceptualmente:

{
  "type": "reference",
  "nodeId": "ventas",
  "offset": -1
}

Esto permite:

renombrar nodos sin romper fórmulas
detectar dependencias
trazabilidad
validaciones
asistentes IA
Validaciones

Mientras se escribe.

Ejemplos:

Paréntesis sin cerrar:

AVG(

↓

Falta cerrar paréntesis

Función incompleta:

IF(

↓

IF(condicion, verdadero, falso)

Offset inválido:

Caja[+1]

dentro de la fórmula de Caja.

↓

No se puede referenciar un período futuro del mismo nodo

Nodo inexistente:

No debería poder insertarse.

Toda referencia debe provenir del autocompletado.

Principios finales acordados
Las fórmulas son instrucciones.
La asignación es implícita.
Toda referencia tiene período explícito.
No existen referencias sin offset.
El propio nodo sólo puede referenciar períodos anteriores.
Los nodos se insertan mediante autocompletado.
Las referencias se almacenan estructuradamente.
El usuario siente que escribe texto, pero en realidad edita una estructura.