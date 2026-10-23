# Matriz Viral Inmoescala

**Publicas y no sabes por qué unos videos funcionan y otros no.** Este agente lo averigua por ti.

Le das de 3 a 5 cuentas de referencia (o le pegas el link de un perfil o de un video) y te devuelve:

1. **Tu matriz viral**: los patrones que se repiten en los videos que mejor funcionan, explicados en simple. Qué gancho usan, cuánto duran, cómo están armados, de qué hablan y cómo cierran.
2. **Guiones listos para grabar** con ese patrón, en tu voz y para tu ciudad, en tres direcciones: alcance, posicionamiento y captación, y venta.
3. **Un calendario** de 4 semanas según lo que de verdad puedes publicar.

Todo pasa conversando en español. No tienes que programar. En `ejemplos/resultado-simulado` puedes ver cómo se ve el resultado.

Es un recurso del Club de Inmoescala, creado por Billie Probst para profesionales inmobiliarios.

## Cómo decide qué videos "funcionaron"

No mira las vistas totales, porque una cuenta grande siempre gana. Compara cada video con lo normal **de su propia cuenta**. Si una cuenta suele tener 3.000 vistas y un video hizo 12.000, ese video rindió 4 veces lo normal: es un ganador. Después busca qué tienen en común los ganadores y qué no tienen los demás.

## Qué necesitas

- **Claude Code con un plan pagado** de Claude (Pro o superior). Lo descargas en claude.com/code.
- **Una cuenta gratis de Apify** en apify.com. Es el servicio que lee los datos públicos de Instagram y TikTok. El plan gratis trae US$5 de crédito al mes, que alcanza para varias lecturas.
- **Node.js** (versión LTS) desde nodejs.org. Si no lo tienes, el agente te avisa.

## Instalación

1. Crea una carpeta vacía en tu computador, por ejemplo `Matriz Viral`.
2. Abre Claude Code en esa carpeta.
3. Pega este mensaje y presiona Enter:

```
Clona el repositorio https://github.com/billieprobst/matriz-viral-inmoescala en esta carpeta. Después lee su CLAUDE.md y sigue "El flujo" conmigo desde el Paso 0.
```

La próxima vez, abre Claude Code dentro de la carpeta `matriz-viral-inmoescala` y escribe `/empezar`.

### Comandos

| Escribe | Qué hace |
|---|---|
| `/empezar` | Entrevista, lectura, matriz, guiones y calendario, en orden. Si ya empezaste, retoma. |
| `/analizar-link <link>` | Analiza un perfil o video de Instagram o TikTok. |
| `/matriz` | Arma o actualiza tu matriz con lo que ya se leyó. |
| `/guiones` | Escribe guiones nuevos con tu patrón. Puedes agregar un tema. |
| `/calendario` | Arma tu calendario de 4 semanas. |

También puedes simplemente pegar un link en el chat.

## Tu llave de Apify

1. Entra a console.apify.com.
2. Ve a **Settings > API & Integrations** y copia tu **Personal API token**.
3. En la carpeta del proyecto, el agente crea un archivo llamado `.env`. Ábrelo con cualquier editor de texto y pega tu llave así:

```
APIFY_TOKEN=pega_aquí_tu_llave
```

4. Guarda el archivo.

Ese archivo queda solo en tu computador: está en `.gitignore`, así que nunca se sube a ningún repositorio. Es mejor no pegar la llave en el chat.

¿Quieres probar antes de crear la cuenta? Pídele al agente el **modo simulado**: usa datos inventados y no cobra nada.

## Si ya tienes tu Cerebro de negocio

Si descargaste el recurso "Cerebro de negocio" de entreinmobiliarios.si, copia el archivo `cerebro-de-negocio.md` en la carpeta del proyecto. El agente lo lee y no te repite preguntas sobre tu nicho, tu ciudad o tu voz.

## Costos aproximados

Se cobran en tu propia cuenta de Apify. Precios del plan gratis a octubre de 2026:

| Lectura | Videos | Costo aproximado |
|---|---|---|
| Un video suelto | 1 | US$0,02 |
| Un perfil | 20 | US$0,05 a US$0,07 |
| 4 cuentas de referencia | 80 | US$0,15 a US$0,25 |
| 5 cuentas a 50 videos | 250 | US$0,45 a US$0,70 |

- El agente te muestra el costo estimado **antes** de cada lectura y espera tu sí.
- Hay un tope de US$1 por lectura. Si una lectura lo supera, no corre. Puedes pedirle al agente que lo cambie.
- Apify también recibe ese tope, así que no puede cobrarte más aunque algo falle.
- Escribir la matriz, los guiones y el calendario usa tu plan de Claude, sin costo extra.

Los precios de Apify pueden cambiar. Los de referencia están en `config.json`.

## Lo honesto

- **No hace milagros.** Te muestra patrones; grabar, publicar con constancia y atender a quien te escribe sigue siendo tu trabajo.
- **Lee texto y números, no ve el video.** El gancho sale de la primera frase del texto de la publicación, que casi siempre coincide con lo que se dice al inicio, pero no siempre. El formato (a cámara, recorrido, voz sobre imágenes) es una deducción y el agente lo marca como "inferido". Mira los 3 mejores videos tú mismo antes de grabar.
- **Pocos datos, poca certeza.** Con menos de 8 videos por cuenta, el agente te avisa que el resultado es débil. Con 3 a 5 cuentas parecidas a ti funciona mucho mejor que con cuentas gigantes de otro rubro.
- **Lo que funcionó no garantiza lo que funcionará.** Los algoritmos cambian. Repite la lectura cada mes con tu propia cuenta.
- **Por ahora solo Instagram y TikTok.** YouTube Shorts no está incluido.
- **Depende de Apify.** Si Instagram o TikTok cambian algo, una lectura puede fallar hasta que Apify lo arregle.
- **Los guiones no inventan datos.** Si un guion necesita un precio, una tasa o una ley local, queda marcado como `[dato de tu zona]` para que lo completes tú.

## Privacidad y aspectos legales

- La herramienta lee **solo datos públicos de cuentas públicas**: métricas agregadas de cada video (vistas, me gusta, comentarios, compartidos, duración, fecha) y el texto de la publicación.
- **No guarda datos personales.** No lee seguidores, comentarios ni mensajes. El texto de cada publicación se limpia antes de guardarse: se quitan menciones a otras cuentas, correos y teléfonos.
- Todo queda en tu computador, en la carpeta `mi-matriz/`, que tampoco se sube a ningún repositorio. Nada se envía a Inmoescala.
- Eres responsable de usarla conforme a los términos de uso de Instagram, TikTok y Apify, y a las leyes de protección de datos de tu país. Úsala para estudiar contenido de cuentas profesionales, no para seguir a personas.
- Este proyecto no está afiliado a Meta, TikTok, Apify ni Anthropic. No es asesoría legal.

## Créditos

Inspirado en la idea de [matriz-viralidad](https://github.com/Hainrixz/matriz-viralidad) de Tododeia. Este repositorio es una versión propia, escrita desde cero con el método de Inmoescala para el rubro inmobiliario.

## Licencia

MIT. Mira el archivo `LICENSE`.
