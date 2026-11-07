# Historias de usuario — versión actual (v9)

Proyecto 3 · MVP de entrenamiento físico · Fuente de verdad: notas nuevas + decisiones del grupo.

## 0. Pautas de calidad aplicadas

**Historia (INVEST):** independiente, negociable, valiosa, estimable, pequeña y testeable.
- Una sola acción y un solo actor por historia.
- Formato «Como `<rol>`, quiero `<acción>`, para `<beneficio>`».
- El «para» expresa el valor de negocio, no repite la acción.
- No describe la interfaz ni la implementación.

**Criterios de aceptación (Gherkin):**
- Un escenario por comportamiento, con nombre que describe el resultado.
- Un solo `Cuando` por escenario.
- Estilo declarativo, en lenguaje de negocio.
- Lo común va en `Antecedentes`.
- Las decisiones sin cerrar van en la sección 11, con el ID de la historia.

Los IDs son estables: las historias nuevas toman el siguiente número libre (US-45, US-46) aunque aparezcan junto a las de su tema.

IDs retirados en la v9 (no se reutilizan): US-11, US-12, US-13 y US-14 (el catálogo lo carga el sistema y es de solo lectura) y US-22 (el entrenador solo acepta o rechaza solicitudes). Se agrega US-49.

## 1. Reglas de negocio vigentes

- **RN-01** El alumno solo registra entrenamientos si está vinculado a un entrenador.
- **RN-02** Un alumno tiene como máximo un entrenador (0/1). Un entrenador tiene varios alumnos.
- **RN-03** El Admin da de alta, modifica y da de baja a alumnos y entrenadores. La baja es siempre lógica y conserva todos los datos.
- **RN-04** Si se da de baja a un entrenador, se finalizan sus vinculaciones y se cancelan sus solicitudes pendientes. Los alumnos conservan todo.
- **RN-05** El entrenador solo accede a los datos de sus alumnos vinculados. El alumno solo accede a los suyos.
- **RN-06** Cualquiera de las dos partes puede finalizar la vinculación. Se conservan el plan y los entrenamientos y el entrenador pierde el acceso. Un nuevo entrenador no hereda el plan anterior.
- **RN-07** Un alumno tiene como máximo un plan vigente, creado y asignado por su entrenador. Un plan es vigente si no fue eliminado ni venció. Un plan vencido o eliminado no impide crear uno nuevo y se conserva como histórico.
- **RN-08** La fecha de inicio del plan la define el alumno. Debe ser la fecha actual o una futura, y puede cambiarla mientras no haya registrado ningún entrenamiento. No se pueden registrar entrenamientos antes de esa fecha. El plan vence 2 meses después de esa fecha.
- **RN-09** El alumno decide la cantidad de días de su rutina semanal, entre 2 y 6. No hay programas.
- **RN-10** Cada ejercicio de la rutina prescribe series (1 a 5), repeticiones (4 a 20) o duración (5 a 60 segundos), RIR (0 a 8) y descanso entre series (30 segundos a 5 minutos). El entrenador elige, para cada ejercicio de la rutina, si se mide por repeticiones o por duración: el catálogo no lo indica. El descanso lo define el plan y no lo carga el alumno. Los ejercicios salen del catálogo, que lo carga el sistema (con nombre, parte del cuerpo, equipamiento, músculo objetivo y una breve descripción) y es de solo lectura: ningún usuario lo modifica desde la aplicación.
- **RN-11** Un entrenamiento registra, por serie, repeticiones o duración, peso (0 a 300 kg) y RIR realizados, para un día de la rutina del plan vigente. Los rangos de series, repeticiones y RIR valen tanto para lo prescrito como para lo realizado. No hay cronómetro.
- **RN-12** El alumno puede registrar, modificar y consultar sus entrenamientos, sin plazo para modificar, pero no eliminarlos. Puede registrar más de un entrenamiento del mismo día de la rutina.
- **RN-13** Un día de entrenamiento se cuenta cuando el alumno asiste, es decir, cuando registra un entrenamiento. Si registra más de un entrenamiento el mismo día calendario, cuenta como un solo día de asistencia.
- **RN-14** Eliminar un plan es una baja lógica. Se conservan los entrenamientos y lo necesario para las métricas.
- **RN-15** Las alertas de vencimiento son avisos dentro de la app, sin mails.
- **RN-16** Una alerta se genera 7 días antes del vencimiento del plan, aunque el usuario no tenga la sesión iniciada, para el alumno y para su entrenador. Se muestra cuando el usuario ingresa a la aplicación y permanece hasta que se renueve el plan, es decir, hasta que el entrenador cree uno nuevo. Cuando el plan vence se genera un nuevo aviso.
- **RN-17** Un usuario dado de baja no puede iniciar sesión. Si se da de alta con un correo que ya perteneció a una cuenta dada de baja, se reactiva esa misma cuenta con su historial.
- **RN-18** El alumno conserva el acceso a su historial y a sus planes anteriores, incluso los de entrenadores anteriores.
- **RN-19** La contraseña inicial de un alumno o entrenador es su DNI y debe cambiarla antes de usar el sistema. Después puede cambiarla cuando quiera y recuperarla por correo si la olvida, con un enlace que vale 1 hora y se usa una sola vez. La contraseña nueva debe tener al menos 8 caracteres.
- **RN-20** Los ejercicios por tiempo se prescriben y registran con duración y RIR, sin peso. Cuentan en series totales, RIR promedio y cumplimiento (duración realizada / prescrita), y no en peso máximo, 1RM, repeticiones totales ni récords personales.

- **RN-21** El horario de un entrenador se elige entre mañana, tarde y noche, uno o varios turnos, y es opcional. Un entrenador sin turnos elegidos se muestra sin horario.
- **RN-22** La baja de una cuenta de alumno o entrenador es lógica: la cuenta no puede iniciar sesión ni operar, y se conservan todos sus datos.
- **RN-23** Un correo pertenece a una sola cuenta: no puede ser alumno y entrenador a la vez. El inicio de sesión y la recuperación de contraseña usan solo el correo, y el sistema identifica el rol de la cuenta.
- **RN-24** Solo el alumno puede cancelar una solicitud pendiente. El entrenador la acepta o la rechaza.

## 2. Sesión

### US-01 — Iniciar sesión
Como usuario registrado, quiero iniciar sesión con mi correo y contraseña, para acceder a las funciones de mi rol.
```gherkin
Escenario: Acceso con credenciales correctas
  Dado un usuario activo registrado
  Cuando inicia sesión con su correo y contraseña correctos
  Entonces el sistema lo identifica con el rol de su cuenta

Escenario: Acceso con credenciales incorrectas
  Dado un usuario registrado
  Cuando inicia sesión con una contraseña incorrecta
  Entonces no se inicia la sesión
  Y se informa "Correo o contraseña incorrectos"

Escenario: Acceso de un usuario dado de baja
  Dado un usuario dado de baja
  Cuando inicia sesión con su correo y contraseña correctos
  Entonces no se inicia la sesión

Escenario: Primer ingreso con la contraseña por defecto
  Dado un usuario que todavía no cambió su contraseña inicial
  Cuando inicia sesión con su correo y su contraseña inicial
  Entonces debe cambiar su contraseña antes de usar el sistema
```

### US-02 — Cerrar sesión
Como usuario con sesión iniciada, quiero cerrar mi sesión, para que nadie más use mi cuenta desde este dispositivo.
```gherkin
Escenario: Cierre de sesión
  Dado un usuario con sesión iniciada
  Cuando cierra su sesión
  Entonces la sesión deja de ser válida
  Y debe identificarse de nuevo para acceder
```

### US-47 — Cambiar mi contraseña
Como usuario con sesión iniciada, quiero cambiar mi contraseña, para mantener segura mi cuenta.
```gherkin
Antecedentes:
  Dado un usuario con sesión iniciada

Escenario: Cambio correcto
  Cuando cambia su contraseña indicando la actual y una nueva válida
  Entonces la contraseña queda actualizada
  Y debe usar la nueva en su próximo inicio de sesión

Esquema del escenario: Largo de la contraseña nueva
  Cuando cambia su contraseña por una de <largo> caracteres
  Entonces el resultado es <resultado>

  Ejemplos:
    | largo | resultado                              |
    | 8     | contraseña actualizada                 |
    | 7     | rechazada: mínimo 8 caracteres         |

Escenario: Contraseña actual incorrecta
  Cuando intenta cambiar su contraseña indicando una actual incorrecta
  Entonces la contraseña no cambia
  Y se informa que la contraseña actual es incorrecta
```

### US-48 — Recuperar mi contraseña
Como usuario que olvidó su contraseña, quiero recuperarla, para volver a acceder a mi cuenta.
```gherkin
Escenario: Solicitud de recuperación
  Dado un usuario activo que olvidó su contraseña
  Cuando solicita recuperarla con su correo
  Entonces recibe por correo un enlace para establecer una nueva contraseña

Escenario: Establecimiento de la nueva contraseña
  Dado un usuario que abrió su enlace de recuperación
  Cuando establece una contraseña nueva válida
  Entonces la contraseña queda actualizada
  Y la anterior deja de ser válida

Escenario: Contraseña nueva demasiado corta
  Dado un usuario que abrió su enlace de recuperación
  Cuando establece una contraseña de menos de 8 caracteres
  Entonces la contraseña no cambia
  Y se informa que debe tener al menos 8 caracteres

Escenario: Enlace ya utilizado
  Dado un enlace de recuperación que ya se usó para cambiar la contraseña
  Cuando el usuario intenta usarlo de nuevo
  Entonces no puede establecer una contraseña nueva

Escenario: Enlace vencido
  Dado un enlace de recuperación generado hace más de una hora
  Cuando el usuario intenta usarlo
  Entonces no puede establecer una contraseña nueva
  Y se informa que debe solicitar un enlace nuevo

Escenario: Usuario inexistente o dado de baja
  Dado un correo que no pertenece a una cuenta activa
  Cuando se solicita recuperar la contraseña
  Entonces no se envía ningún enlace de recuperación
```

## 3. Administración

### US-03 — Dar de alta un alumno
Como administrador, quiero dar de alta a un alumno, para que pueda ingresar al sistema y vincularse con un entrenador.
```gherkin
Antecedentes:
  Dado un administrador con sesión iniciada

Escenario: Alta correcta
  Dado que no existe una cuenta con el correo "ana@mail.com"
  Cuando da de alta un alumno con nombre, apellido, fecha de nacimiento, DNI y correo válidos
  Entonces se crea una cuenta con rol alumno
  Y su contraseña inicial es su DNI

Escenario: Datos inválidos
  Cuando da de alta un alumno con datos obligatorios ausentes
  Entonces no se crea la cuenta
  Y se indican los datos a corregir

Escenario: Correo de una cuenta activa
  Dado que existe una cuenta activa con el correo "ana@mail.com"
  Cuando da de alta un alumno con ese correo
  Entonces no se crea otra cuenta
  Y la cuenta existente no cambia

Escenario: Correo de una cuenta con otro rol
  Dado que existe una cuenta activa de entrenador con el correo "ana@mail.com"
  Cuando da de alta un alumno con ese correo
  Entonces no se crea otra cuenta
  Y se informa que el correo ya pertenece a una cuenta

Escenario: Correo de una cuenta dada de baja
  Dado que existe una cuenta de alumno dada de baja con el correo "ana@mail.com"
  Cuando da de alta un alumno con ese correo
  Entonces se reactiva esa misma cuenta
  Y conserva su historial
```

### US-04 — Consultar alumnos
Como administrador, quiero consultar los alumnos, para conocer quiénes están registrados y su situación.
```gherkin
Escenario: Listado de alumnos
  Dado un administrador con sesión iniciada
  Y alumnos activos y dados de baja
  Cuando consulta los alumnos
  Entonces ve cada alumno con su estado y su entrenador, si lo tiene
```

### US-05 — Modificar un alumno
Como administrador, quiero modificar los datos de un alumno, para mantener su información al día.
```gherkin
Antecedentes:
  Dado un administrador con sesión iniciada
  Y un alumno registrado

Escenario: Modificación correcta
  Cuando modifica los datos del alumno con valores válidos
  Entonces los datos quedan actualizados

Escenario: Datos inválidos
  Cuando modifica los datos del alumno con valores inválidos
  Entonces los datos no cambian
  Y se indican los datos a corregir

Escenario: Correo de otra cuenta
  Dado que existe otra cuenta con el correo "ana@mail.com"
  Cuando modifica el correo del alumno por "ana@mail.com"
  Entonces los datos no cambian
  Y se informa que el correo ya pertenece a una cuenta
```

### US-06 — Dar de baja un alumno
Como administrador, quiero dar de baja a un alumno, para que deje de operar sin perder su historial.
```gherkin
Antecedentes:
  Dado un administrador con sesión iniciada

Escenario: Baja lógica conserva los datos
  Dado un alumno activo con entrenamientos registrados
  Cuando da de baja al alumno
  Entonces el alumno queda inactivo
  Y sus datos y entrenamientos se conservan

Escenario: Baja de un alumno vinculado
  Dado un alumno activo vinculado a un entrenador
  Cuando da de baja al alumno
  Entonces la vinculación se finaliza automáticamente
```

### US-07 — Dar de alta un entrenador
Como administrador, quiero dar de alta a un entrenador, para habilitarlo a gestionar los planes de sus alumnos.
```gherkin
Antecedentes:
  Dado un administrador con sesión iniciada

Escenario: Alta correcta
  Dado que no existe una cuenta con el correo "leo@mail.com"
  Cuando da de alta un entrenador con nombre, apellido, fecha de nacimiento, DNI, correo y disponibilidad horaria válidos
  Entonces se crea una cuenta con rol entrenador
  Y su contraseña inicial es su DNI
  Y se conserva su disponibilidad

Escenario: Datos inválidos
  Cuando da de alta un entrenador con datos obligatorios ausentes
  Entonces no se crea la cuenta
  Y se indican los datos a corregir

Escenario: Correo de una cuenta activa
  Dado que existe una cuenta activa con el correo "leo@mail.com"
  Cuando da de alta un entrenador con ese correo
  Entonces no se crea otra cuenta
  Y la cuenta existente no cambia

Escenario: Correo de una cuenta con otro rol
  Dado que existe una cuenta activa de alumno con el correo "leo@mail.com"
  Cuando da de alta un entrenador con ese correo
  Entonces no se crea otra cuenta
  Y se informa que el correo ya pertenece a una cuenta

Escenario: Correo de una cuenta dada de baja
  Dado que existe una cuenta de entrenador dada de baja con el correo "leo@mail.com"
  Cuando da de alta un entrenador con ese correo
  Entonces se reactiva esa misma cuenta
  Y conserva su historial
```

### US-08 — Consultar entrenadores (administrador)
Como administrador, quiero consultar los entrenadores, para conocer quiénes están habilitados y su disponibilidad.
```gherkin
Escenario: Listado de entrenadores
  Dado un administrador con sesión iniciada
  Y entrenadores activos y dados de baja
  Cuando consulta los entrenadores
  Entonces ve cada entrenador con su estado y su disponibilidad
```

### US-09 — Modificar un entrenador
Como administrador, quiero modificar los datos de un entrenador, para mantener actualizada su información y su disponibilidad.
```gherkin
Antecedentes:
  Dado un administrador con sesión iniciada
  Y un entrenador registrado

Escenario: Modificación correcta
  Cuando modifica los datos del entrenador con valores válidos
  Entonces los datos quedan actualizados

Escenario: Datos inválidos
  Cuando modifica los datos del entrenador con valores inválidos
  Entonces los datos no cambian
  Y se indican los datos a corregir

Escenario: Correo de otra cuenta
  Dado que existe otra cuenta con el correo "leo@mail.com"
  Cuando modifica el correo del entrenador por "leo@mail.com"
  Entonces los datos no cambian
  Y se informa que el correo ya pertenece a una cuenta
```

### US-10 — Dar de baja un entrenador
Como administrador, quiero dar de baja a un entrenador, para retirarlo sin afectar a sus alumnos.
```gherkin
Antecedentes:
  Dado un administrador con sesión iniciada
  Y un entrenador activo

Escenario: Baja lógica finaliza vinculaciones y conserva datos
  Dado que el entrenador tiene alumnos vinculados
  Cuando da de baja al entrenador
  Entonces el entrenador queda inactivo
  Y se finalizan sus vinculaciones
  Y los alumnos conservan su plan y sus entrenamientos

Escenario: Baja cancela solicitudes pendientes
  Dado que el entrenador tiene solicitudes pendientes
  Cuando da de baja al entrenador
  Entonces sus solicitudes pendientes quedan canceladas
```

### US-15 — Consultar métricas del gimnasio
Como administrador, quiero consultar las métricas del gimnasio, para conocer su nivel de actividad.
```gherkin
Escenario: Métricas con datos
  Dado un administrador con sesión iniciada
  Y alumnos activos vinculados a distintos entrenadores
  Cuando consulta las métricas del gimnasio
  Entonces ve la cantidad de alumnos activos
  Y la cantidad de vinculaciones activas
  Y los alumnos a cargo de cada entrenador

Escenario: Métricas sin datos
  Dado un administrador con sesión iniciada
  Y ningún alumno ni vinculación
  Cuando consulta las métricas del gimnasio
  Entonces todas las cantidades se muestran en cero
```

## 4. Vinculación alumno–entrenador

### US-16 — Consultar entrenadores disponibles
Como alumno sin entrenador, quiero consultar los entrenadores y sus horarios, para elegir a quién pedirle acompañamiento.
```gherkin
Antecedentes:
  Dado un alumno sin entrenador

Escenario: Hay entrenadores
  Dado entrenadores activos registrados
  Cuando consulta los entrenadores
  Entonces ve el nombre, apellido y disponibilidad de cada uno

Escenario: No hay entrenadores
  Dado que no hay entrenadores activos
  Cuando consulta los entrenadores
  Entonces se informa que no hay entrenadores disponibles
```

### US-17 — Solicitar un entrenador
Como alumno sin entrenador, quiero solicitar un entrenador, para empezar a recibir un plan de entrenamiento.
```gherkin
Antecedentes:
  Dado un alumno sin entrenador

Escenario: Solicitud correcta
  Dado que no tiene una solicitud pendiente
  Cuando solicita a un entrenador
  Entonces la solicitud queda pendiente
  Y el alumno aún no está vinculado

Escenario: Ya hay una solicitud pendiente
  Dado que tiene una solicitud pendiente
  Cuando solicita a otro entrenador
  Entonces no se crea una nueva solicitud

Escenario: Ya tiene entrenador
  Dado un alumno con entrenador vinculado
  Cuando solicita a otro entrenador
  Entonces no se crea la solicitud
```

### US-18 — Consultar solicitudes recibidas
Como entrenador, quiero consultar las solicitudes pendientes que recibí, para decidir a qué alumnos acompañar.
```gherkin
Escenario: Solo las pendientes dirigidas a mí
  Dado un entrenador con sesión iniciada
  Y solicitudes pendientes dirigidas a él y a otros entrenadores
  Cuando consulta sus solicitudes
  Entonces ve solo las pendientes dirigidas a él

Escenario: Sin solicitudes
  Dado un entrenador sin solicitudes pendientes
  Cuando consulta sus solicitudes
  Entonces se informa que no tiene solicitudes
```

### US-19 — Aceptar una solicitud
Como entrenador, quiero aceptar la solicitud de un alumno, para incorporarlo a mi seguimiento.
```gherkin
Escenario: Aceptación vincula al alumno
  Dado un entrenador con una solicitud pendiente de un alumno sin entrenador
  Cuando acepta la solicitud
  Entonces la solicitud queda aceptada
  Y el alumno queda vinculado al entrenador

Escenario: Solicitud ya resuelta
  Dado una solicitud que no está pendiente
  Cuando el entrenador intenta aceptarla
  Entonces la operación se rechaza
```

### US-20 — Rechazar una solicitud
Como entrenador, quiero rechazar la solicitud de un alumno, para no asumir un alumno que no puedo atender.
```gherkin
Escenario: Rechazo sin vinculación
  Dado un entrenador con una solicitud pendiente
  Cuando la rechaza
  Entonces la solicitud queda rechazada
  Y no se establece la vinculación
  Y el alumno puede solicitar otro entrenador
```

### US-21 — Cancelar mi solicitud (alumno)
Como alumno, quiero cancelar mi solicitud pendiente, para poder elegir a otro entrenador.
```gherkin
Escenario: Cancelación de solicitud pendiente
  Dado un alumno con una solicitud pendiente
  Cuando la cancela
  Entonces la solicitud queda cancelada
  Y no se establece la vinculación
  Y el alumno puede solicitar otro entrenador

Escenario: Solicitud ya resuelta
  Dado una solicitud aceptada o rechazada
  Cuando el alumno intenta cancelarla
  Entonces la operación se rechaza
```

### US-23 — Finalizar la vinculación (alumno)
Como alumno, quiero finalizar la vinculación con mi entrenador, para dejar de ser acompañado por él.
```gherkin
Escenario: Finalización conserva los datos
  Dado un alumno vinculado con plan y entrenamientos
  Cuando finaliza la vinculación
  Entonces la vinculación queda finalizada
  Y el plan y los entrenamientos se conservan
  Y el entrenador pierde el acceso a sus datos
```

### US-24 — Finalizar la vinculación (entrenador)
Como entrenador, quiero finalizar la vinculación con un alumno, para dejar de acompañarlo.
```gherkin
Escenario: Finalización conserva los datos
  Dado un entrenador con un alumno vinculado
  Cuando finaliza la vinculación
  Entonces la vinculación queda finalizada
  Y el plan y los entrenamientos del alumno se conservan
  Y el entrenador pierde el acceso a los datos del alumno

Escenario: El nuevo entrenador no hereda el plan
  Dado un alumno que finalizó su vinculación y se vinculó con otro entrenador
  Cuando el nuevo entrenador consulta al alumno
  Entonces no ve el plan del entrenador anterior
```

### US-25 — Consultar mis alumnos
Como entrenador, quiero consultar mis alumnos vinculados, para organizar su seguimiento.
```gherkin
Escenario: Solo mis alumnos
  Dado un entrenador con alumnos vinculados
  Y alumnos vinculados a otros entrenadores
  Cuando consulta sus alumnos
  Entonces ve solo a sus alumnos vinculados

Escenario: Sin alumnos
  Dado un entrenador sin alumnos vinculados
  Cuando consulta sus alumnos
  Entonces se informa que no tiene alumnos
```

## 5. Plan, rutina y ejercicios

### US-26 — Crear el plan de un alumno
Como entrenador, quiero crear y asignar un plan a un alumno vinculado, para organizar su entrenamiento durante 2 meses.
```gherkin
Antecedentes:
  Dado un entrenador con un alumno vinculado

Escenario: Creación correcta
  Dado que el alumno no tiene un plan vigente
  Cuando crea un plan con nombre y objetivo válidos
  Entonces el plan queda creado y asignado al alumno
  Y queda a la espera de que el alumno defina su fecha de inicio

Escenario: Renovación de un plan vencido
  Dado que el plan del alumno está vencido
  Cuando crea un nuevo plan
  Entonces el nuevo plan queda asignado al alumno
  Y el plan vencido se conserva como histórico

Escenario: Creación tras eliminar un plan
  Dado que el plan del alumno fue eliminado
  Cuando crea un nuevo plan
  Entonces el nuevo plan queda asignado al alumno

Escenario: El alumno ya tiene un plan vigente
  Dado que el alumno tiene un plan vigente
  Cuando crea otro plan
  Entonces no se crea el nuevo plan
  Y se conserva el vigente

Escenario: Alumno de otro entrenador
  Dado un alumno vinculado a otro entrenador
  Cuando intenta crearle un plan
  Entonces la operación se rechaza
```

### US-27 — Consultar el plan de un alumno
Como entrenador, quiero consultar el plan de uno de mis alumnos, para conocer su planificación y su vencimiento.
```gherkin
Escenario: Consulta de un alumno propio
  Dado un entrenador con un alumno vinculado que tiene plan
  Cuando consulta el plan del alumno
  Entonces ve los datos del plan, su vencimiento y su rutina

Escenario: Consulta de un alumno ajeno
  Dado un alumno vinculado a otro entrenador
  Cuando el entrenador intenta consultar su plan
  Entonces se deniega el acceso
```

### US-28 — Modificar el plan de un alumno
Como entrenador, quiero modificar el nombre y el objetivo del plan de un alumno, para mantenerlo alineado a su objetivo.
```gherkin
Antecedentes:
  Dado un entrenador con un alumno vinculado que tiene plan

Escenario: Modificación correcta
  Cuando modifica los datos del plan con valores válidos
  Entonces el plan queda actualizado
  Y los entrenamientos anteriores no cambian

Escenario: Datos inválidos
  Cuando modifica los datos del plan con valores inválidos
  Entonces el plan no cambia
  Y se indican los datos a corregir
```

### US-29 — Eliminar el plan de un alumno
Como entrenador, quiero eliminar el plan de un alumno, para retirarlo sin perder su historial de entrenamientos.
```gherkin
Escenario: Baja lógica conserva el historial
  Dado un entrenador con un alumno vinculado cuyo plan tiene entrenamientos registrados
  Cuando elimina el plan
  Entonces el plan deja de estar disponible para nuevos entrenamientos
  Y los entrenamientos anteriores y sus métricas se conservan
```

### US-45 — Definir la fecha de inicio de mi plan
Como alumno, quiero definir la fecha de inicio de mi plan, para empezar a entrenar cuando me convenga.
```gherkin
Antecedentes:
  Dado un alumno con un plan

Escenario: Fecha actual o futura
  Dado que el plan no tiene fecha de inicio
  Cuando define como fecha de inicio hoy o una fecha futura
  Entonces la fecha de inicio queda definida
  Y el plan vence 2 meses después de esa fecha

Escenario: Fecha pasada
  Cuando define una fecha de inicio anterior a hoy
  Entonces la fecha no se guarda
  Y se informa que debe ser hoy o una fecha futura

Escenario: Cambio de fecha sin entrenamientos registrados
  Dado que el plan tiene fecha de inicio y no se registró ningún entrenamiento
  Cuando define otra fecha de inicio válida
  Entonces la fecha de inicio queda actualizada
  Y el vencimiento se recalcula

Escenario: Cambio de fecha con entrenamientos registrados
  Dado que ya registró algún entrenamiento
  Cuando intenta cambiar la fecha de inicio
  Entonces la fecha no cambia
```

### US-46 — Elegir los días de entrenamiento de mi rutina
Como alumno, quiero elegir cuántos días por semana entreno, para que mi rutina se ajuste a mi disponibilidad.
```gherkin
Antecedentes:
  Dado un alumno con plan

Esquema del escenario: Cantidad de días elegida
  Cuando elige entrenar <dias> días por semana
  Entonces el resultado es <resultado>

  Ejemplos:
    | dias | resultado                |
    | 1    | rechazada: mínimo 2 días |
    | 2    | elección guardada        |
    | 6    | elección guardada        |
    | 7    | rechazada: máximo 6 días |
```

### US-30 — Crear la rutina semanal
Como entrenador, quiero crear la rutina semanal del plan de un alumno, para definir qué entrena en cada uno de los días que eligió.
```gherkin
Antecedentes:
  Dado un entrenador con un alumno vinculado que tiene plan sin rutina

Escenario: Creación con los días elegidos por el alumno
  Dado que el alumno eligió entrenar 4 días por semana
  Cuando crea la rutina
  Entonces la rutina queda creada con 4 días de entrenamiento

Escenario: El alumno todavía no eligió sus días
  Dado que el alumno no eligió cuántos días entrena
  Cuando crea la rutina
  Entonces no se crea la rutina
  Y se indica que el alumno debe elegir sus días

Escenario: El plan ya tiene rutina
  Dado un plan que ya tiene rutina
  Cuando crea otra rutina
  Entonces no se crea la nueva rutina
```

### US-31 — Modificar la rutina semanal
Como entrenador, quiero modificar la rutina del plan, para adaptarla a los días que eligió el alumno.
```gherkin
Escenario: Ajuste a los días elegidos
  Dado un entrenador con un alumno cuyo plan tiene rutina y entrenamientos registrados
  Y que el alumno cambió su elección a 5 días por semana
  Cuando ajusta la rutina
  Entonces la rutina queda con 5 días de entrenamiento
  Y los entrenamientos registrados no cambian
```

### US-32 — Eliminar la rutina semanal
Como entrenador, quiero eliminar la rutina del plan, para reemplazarla por otra.
```gherkin
Escenario: Eliminación conserva los entrenamientos
  Dado un entrenador con un alumno cuyo plan tiene rutina y entrenamientos registrados
  Cuando elimina la rutina
  Entonces el plan queda sin rutina
  Y los entrenamientos registrados se conservan
```

### US-49 — Buscar un ejercicio del catálogo
Como entrenador, quiero buscar ejercicios del catálogo por nombre, parte del cuerpo o equipamiento, para elegir con rapidez el que voy a prescribir.
```gherkin
Antecedentes:
  Dado un entrenador con sesión iniciada
  Y un catálogo con ejercicios de distintas partes del cuerpo y equipamientos

Escenario: Búsqueda por nombre
  Cuando busca "sentadilla"
  Entonces ve los ejercicios cuyo nombre contiene "sentadilla"
  Y la búsqueda no distingue mayúsculas ni tildes

Escenario: Filtro por parte del cuerpo y equipamiento
  Cuando filtra por la parte del cuerpo "Piernas" y el equipamiento "Barra"
  Entonces ve solo los ejercicios que cumplen ambos filtros

Escenario: Ejercicio con su descripción
  Cuando consulta un ejercicio del catálogo
  Entonces ve su nombre, parte del cuerpo, equipamiento, músculo objetivo y breve descripción

Escenario: Búsqueda sin resultados
  Cuando busca un texto que no coincide con ningún ejercicio
  Entonces no ve ejercicios
  Y se informa que no hay coincidencias
```

### US-33 — Agregar un ejercicio a la rutina
Como entrenador, quiero agregar un ejercicio del catálogo a un día de la rutina con su prescripción, para indicar qué debe hacer el alumno.
```gherkin
Antecedentes:
  Dado un entrenador con un alumno cuyo plan tiene rutina

Escenario: Ejercicio por repeticiones
  Cuando agrega un ejercicio a un día con series, repeticiones, RIR y descanso entre series válidos
  Entonces el ejercicio queda prescrito en ese día

Escenario: Ejercicio por tiempo
  Cuando agrega un ejercicio por tiempo con series, duración, RIR y descanso entre series válidos
  Entonces el ejercicio queda prescrito en ese día

Esquema del escenario: Límites de la prescripción
  Cuando agrega un ejercicio por repeticiones con <series> series, <reps> repeticiones y RIR <rir>
  Entonces el resultado es <resultado>

  Ejemplos:
    | series | reps | rir | resultado                         |
    | 1      | 4    | 0   | ejercicio agregado                |
    | 5      | 20   | 8   | ejercicio agregado                |
    | 0      | 10   | 2   | rechazado: series entre 1 y 5     |
    | 6      | 10   | 2   | rechazado: series entre 1 y 5     |
    | 3      | 3    | 2   | rechazado: reps entre 4 y 20      |
    | 3      | 21   | 2   | rechazado: reps entre 4 y 20      |
    | 3      | 10   | 9   | rechazado: RIR entre 0 y 8        |

Esquema del escenario: Límites de la duración de un ejercicio por tiempo
  Cuando agrega un ejercicio por tiempo con una duración de <segundos> segundos por serie
  Entonces el resultado es <resultado>

  Ejemplos:
    | segundos | resultado                           |
    | 5        | ejercicio agregado                  |
    | 60       | ejercicio agregado                  |
    | 4        | rechazado: duración entre 5 y 60 s  |
    | 61       | rechazado: duración entre 5 y 60 s  |

Esquema del escenario: Límites del descanso entre series
  Cuando agrega un ejercicio con un descanso de <segundos> segundos entre series
  Entonces el resultado es <resultado>

  Ejemplos:
    | segundos | resultado                             |
    | 30       | ejercicio agregado                    |
    | 300      | ejercicio agregado                    |
    | 29       | rechazado: descanso entre 30 y 300 s  |
    | 301      | rechazado: descanso entre 30 y 300 s  |
```

### US-34 — Modificar un ejercicio de la rutina
Como entrenador, quiero modificar la prescripción de un ejercicio de la rutina, para ajustar la carga indicada.
```gherkin
Escenario: Modificación sin tocar el catálogo
  Dado un entrenador con un alumno cuya rutina tiene un ejercicio prescrito
  Cuando modifica sus series, repeticiones o duración, RIR o descanso con valores válidos
  Entonces la prescripción queda actualizada
  Y el ejercicio del catálogo no cambia
```

### US-35 — Quitar un ejercicio de la rutina
Como entrenador, quiero quitar un ejercicio de la rutina, para dejar de prescribirlo.
```gherkin
Escenario: Quitar un ejercicio
  Dado un entrenador con un alumno cuya rutina tiene un ejercicio prescrito
  Cuando lo quita de la rutina
  Entonces deja de prescribirse
  Y los entrenamientos pasados que lo incluyen no cambian
```

### US-36 — Consultar mi plan y mi rutina
Como alumno, quiero consultar mi plan y mi rutina, para saber qué debo entrenar cada día.
```gherkin
Escenario: Alumno con plan
  Dado un alumno vinculado con plan y rutina
  Cuando consulta su plan
  Entonces ve el vencimiento del plan, si ya definió su fecha de inicio
  Y los ejercicios de cada día con series, repeticiones o duración, RIR y descanso entre series

Escenario: Alumno sin plan
  Dado un alumno vinculado sin plan
  Cuando consulta su plan
  Entonces se informa que su entrenador todavía no le creó un plan

Escenario: Alumno sin entrenador consulta sus planes anteriores
  Dado un alumno sin entrenador que tuvo planes con entrenadores anteriores
  Cuando consulta sus planes anteriores
  Entonces ve sus planes anteriores con su rutina
```

## 6. Entrenamientos y métricas

### US-37 — Registrar un entrenamiento
Como alumno, quiero registrar las series, repeticiones, peso y RIR que realicé, para llevar el seguimiento de mi progreso.
```gherkin
Antecedentes:
  Dado un alumno vinculado con plan vigente y rutina

Escenario: Registro correcto
  Cuando registra un entrenamiento de un día de su rutina con repeticiones, peso y RIR por serie
  Entonces el entrenamiento queda guardado con su fecha
  Y cuenta como un día de asistencia

Escenario: Ejercicio por tiempo
  Cuando registra la duración y el RIR de cada serie de un ejercicio por tiempo
  Entonces el entrenamiento queda guardado

Esquema del escenario: Límites de la duración realizada
  Cuando registra una serie de un ejercicio por tiempo con <segundos> segundos
  Entonces el resultado es <resultado>

  Ejemplos:
    | segundos | resultado                           |
    | 5        | serie registrada                    |
    | 60       | serie registrada                    |
    | 4        | rechazada: duración entre 5 y 60 s  |
    | 61       | rechazada: duración entre 5 y 60 s  |

Escenario: Dos entrenamientos del mismo día de la rutina
  Dado que ya registró un entrenamiento del día 1 de su rutina
  Cuando registra otro entrenamiento del día 1
  Entonces ambos entrenamientos quedan guardados
  Y el día cuenta como un solo día de asistencia

Esquema del escenario: Límites de los valores realizados
  Cuando registra una serie por repeticiones con <reps> repeticiones, <peso> kg y RIR <rir>
  Entonces el resultado es <resultado>

  Ejemplos:
    | reps | peso | rir | resultado                     |
    | 4    | 0    | 0   | serie registrada              |
    | 20   | 300  | 8   | serie registrada              |
    | 3    | 50   | 2   | rechazada: reps entre 4 y 20  |
    | 21   | 50   | 2   | rechazada: reps entre 4 y 20  |
    | 10   | -1   | 2   | rechazada: peso entre 0 y 300 |
    | 10   | 301  | 2   | rechazada: peso entre 0 y 300 |
    | 10   | 50   | 9   | rechazada: RIR entre 0 y 8    |

Escenario: Antes de la fecha de inicio del plan
  Dado un alumno cuyo plan empieza en una fecha futura
  Cuando intenta registrar un entrenamiento
  Entonces no se guarda
  Y se informa que el plan todavía no empezó

Escenario: Sin plan vigente
  Dado un alumno cuyo plan está vencido
  Cuando intenta registrar un entrenamiento
  Entonces no se guarda
  Y se informa que no tiene un plan vigente
```

### US-38 — Modificar un entrenamiento
Como alumno, quiero modificar un entrenamiento que registré, para corregir errores de carga.
```gherkin
Escenario: Modificación correcta
  Dado un alumno con un entrenamiento registrado
  Cuando modifica sus valores con datos válidos
  Entonces el entrenamiento queda actualizado
  Y las métricas reflejan los nuevos valores

Escenario: Modificación de un entrenamiento antiguo
  Dado un alumno con un entrenamiento registrado hace varios meses
  Cuando modifica sus valores con datos válidos
  Entonces el entrenamiento queda actualizado

Escenario: Entrenamiento de otro alumno
  Dado un entrenamiento registrado por otro alumno
  Cuando el alumno intenta modificarlo
  Entonces se deniega el acceso
```

### US-39 — Consultar mi historial de entrenamientos
Como alumno, quiero consultar mis entrenamientos anteriores, para ver cómo evolucioné.
```gherkin
Escenario: Historial con entrenamientos
  Dado un alumno con entrenamientos registrados
  Cuando consulta su historial
  Entonces ve sus entrenamientos por fecha con series, repeticiones, peso y RIR

Escenario: Historial sin entrenamientos
  Dado un alumno sin entrenamientos registrados
  Cuando consulta su historial
  Entonces se informa que aún no registró entrenamientos

Escenario: Historial tras eliminar el plan
  Dado un alumno cuyo plan fue eliminado
  Cuando consulta su historial
  Entonces ve sus entrenamientos anteriores

Escenario: Historial de un alumno sin entrenador
  Dado un alumno sin entrenador que entrenó con entrenadores anteriores
  Cuando consulta su historial
  Entonces ve los entrenamientos hechos con sus entrenadores anteriores
```

### US-40 — Consultar mis métricas
Como alumno, quiero consultar mis métricas de entrenamiento, para medir mi progreso con datos.
```gherkin
Escenario: Métricas con datos
  Dado un alumno con entrenamientos registrados
  Cuando consulta sus métricas
  Entonces ve las métricas definidas calculadas con sus entrenamientos

Escenario: Métricas sin datos
  Dado un alumno sin entrenamientos registrados
  Cuando consulta sus métricas
  Entonces se informa que aún no hay métricas
```

### US-41 — Consultar los entrenamientos de un alumno
Como entrenador, quiero consultar los entrenamientos de mis alumnos, para hacer su seguimiento.
```gherkin
Escenario: Alumno vinculado
  Dado un entrenador con un alumno vinculado con entrenamientos registrados
  Cuando consulta los entrenamientos del alumno
  Entonces ve su historial

Escenario: Alumno no vinculado
  Dado un alumno que no está vinculado al entrenador
  Cuando el entrenador intenta consultar sus entrenamientos
  Entonces se deniega el acceso
```

### US-42 — Consultar las métricas de un alumno
Como entrenador, quiero consultar las métricas de mis alumnos, para evaluar su cumplimiento y ajustar el plan.
```gherkin
Escenario: Alumno vinculado
  Dado un entrenador con un alumno vinculado con entrenamientos registrados
  Cuando consulta las métricas del alumno
  Entonces ve las mismas métricas que ve el alumno

Escenario: Alumno no vinculado
  Dado un alumno que no está vinculado al entrenador
  Cuando el entrenador intenta consultar sus métricas
  Entonces se deniega el acceso
```

## 7. Alertas

### US-43 — Recibir el aviso de vencimiento de mi plan
Como alumno, quiero recibir un aviso 7 días antes de que venza mi plan, para pedirle a mi entrenador que lo renueve a tiempo.
```gherkin
Escenario: Aviso generado 7 días antes
  Dado un alumno con un plan que vence en 7 días
  Cuando llega la fecha de aviso
  Entonces se genera una alerta de vencimiento para el alumno
  Y la genera aunque el alumno no tenga la sesión iniciada

Escenario: Aviso visible al ingresar
  Dado una alerta de vencimiento generada para el alumno
  Cuando el alumno ingresa a la aplicación
  Entonces ve la alerta

Escenario: La alerta permanece hasta renovar el plan
  Dado una alerta de vencimiento generada para el alumno
  Cuando pasan los días sin que el entrenador cree un plan nuevo
  Entonces la alerta sigue visible

Escenario: Nuevo aviso al vencer
  Dado un alumno con una alerta de vencimiento previa
  Cuando el plan vence
  Entonces se genera una nueva alerta de plan vencido

Escenario: Renovación del plan
  Dado una alerta de vencimiento del alumno
  Cuando el entrenador crea un nuevo plan para el alumno
  Entonces la alerta deja de mostrarse

Escenario: Sin aviso
  Dado un alumno cuyo plan vence en más de 7 días
  Cuando ingresa a la aplicación
  Entonces no ve ninguna alerta de vencimiento
```

### US-44 — Recibir los avisos de vencimiento de los planes de mis alumnos
Como entrenador, quiero recibir un aviso 7 días antes de que venza el plan de cada uno de mis alumnos, para renovarlo a tiempo.
```gherkin
Escenario: Aviso generado 7 días antes
  Dado un entrenador con un alumno cuyo plan vence en 7 días
  Cuando llega la fecha de aviso
  Entonces se genera una alerta de vencimiento para el entrenador con el nombre del alumno
  Y la genera aunque el entrenador no tenga la sesión iniciada

Escenario: Aviso visible al ingresar
  Dado una alerta de vencimiento generada para el entrenador
  Cuando el entrenador ingresa a la aplicación
  Entonces ve la alerta

Escenario: La alerta permanece hasta renovar el plan
  Dado una alerta de vencimiento generada para el entrenador
  Cuando pasan los días sin que cree un plan nuevo para ese alumno
  Entonces la alerta sigue visible

Escenario: Nuevo aviso al vencer
  Dado un entrenador con una alerta de vencimiento previa de un alumno
  Cuando el plan del alumno vence
  Entonces se genera una nueva alerta de plan vencido

Escenario: Renovación del plan
  Dado una alerta de vencimiento de un alumno
  Cuando crea un nuevo plan para ese alumno
  Entonces la alerta deja de mostrarse

Escenario: Sin aviso
  Dado un entrenador sin planes que venzan en 7 días
  Cuando ingresa a la aplicación
  Entonces no ve ninguna alerta de vencimiento
```
Nota de diseño: la generación de alertas puede implementarse con el patrón Strategy, como sugirió el profe, para que agregar tipos nuevos no modifique lo existente (principio abierto/cerrado).

## 8. Métricas confirmadas

| # | Métrica | Cálculo | Quién la ve |
|---|---|---|---|
| 1 | Peso máximo por ejercicio | Máximo peso registrado | Alumno, entrenador |
| 2 | 1RM estimada por ejercicio | Epley: peso × (1 + reps / 30) | Alumno, entrenador |
| 3 | Evolución del peso por ejercicio | Peso máximo por fecha | Alumno, entrenador |
| 4 | Repeticiones totales | Σ repeticiones realizadas | Alumno, entrenador |
| 5 | Series totales | Cantidad de series realizadas | Alumno, entrenador |
| 6 | RIR promedio | Promedio por ejercicio y por entrenamiento | Alumno, entrenador |
| 7 | Cumplimiento del plan | Series y reps realizadas / prescritas × 100 | Alumno, entrenador |
| 8 | Asistencia semanal | Días con al menos un entrenamiento por semana vs. días de la rutina | Alumno, entrenador |
| 9 | Récords personales (PRs) | Nuevo máximo de peso o de 1RM estimada | Alumno, entrenador |
| 10 | Alumnos activos | Cantidad de alumnos con cuenta activa | Admin |
| 11 | Vinculaciones activas | Cantidad de vinculaciones vigentes | Admin |
| 12 | Alumnos por entrenador | Cantidad por cada entrenador | Admin |

Los ejercicios por tiempo solo cuentan en las métricas 5 (series totales), 6 (RIR promedio) y 7 (cumplimiento, con la duración realizada / prescrita). No cuentan en 1, 2, 3, 4 ni 9 (RN-20).

## 9. Trazabilidad: caso de uso → historias

| Caso de uso (diagrama) | Actor | Historias |
|---|---|---|
| Iniciar sesión | Usuario | US-01 |
| Cerrar sesión | Usuario | US-02 |
| Cambiar contraseña | Usuario | US-47 |
| Recuperar contraseña | Usuario | US-48 |
| Gestionar alumnos | Admin | US-03, US-04, US-05, US-06 |
| Gestionar entrenadores | Admin | US-07, US-08, US-09, US-10 |
| Consultar métricas del gimnasio | Admin | US-15 |
| Consultar entrenadores | Alumno | US-16 |
| Solicitar entrenador | Alumno | US-17 |
| Consultar solicitudes | Entrenador | US-18 |
| Aceptar solicitud | Entrenador | US-19 |
| Rechazar solicitud | Entrenador | US-20 |
| Cancelar solicitud pendiente | Alumno | US-21 |
| Finalizar vinculación | Alumno, Entrenador | US-23, US-24 |
| Consultar mis alumnos | Entrenador | US-25 |
| Gestionar plan de un alumno | Entrenador | US-26, US-27, US-28, US-29 |
| Definir fecha de inicio del plan | Alumno | US-45 |
| Elegir días de entrenamiento | Alumno | US-46 |
| Gestionar rutina semanal del plan | Entrenador | US-30, US-31, US-32 |
| Buscar ejercicios del catálogo | Entrenador | US-49 |
| Configurar ejercicio de la rutina | Entrenador | US-33, US-34, US-35 |
| Consultar mi plan y mi rutina | Alumno | US-36 |
| Registrar y modificar entrenamiento | Alumno | US-37, US-38 |
| Consultar historial de entrenamientos | Alumno | US-39 |
| Consultar mis métricas | Alumno | US-40 |
| Consultar entrenamientos de un alumno | Entrenador | US-41 |
| Consultar métricas de un alumno | Entrenador | US-42 |
| Ver alertas de vencimiento del plan | Alumno, Entrenador | US-43, US-44 |

## 10. Trazabilidad: historias → reglas de negocio

| Historia | Reglas |
|---|---|
| US-01 | RN-17, RN-19 |
| US-02 | — (sesión) |
| US-47, US-48 | RN-19 |
| US-01, US-48 | RN-23 |
| US-03, US-07 | RN-03, RN-17, RN-19 |
| US-04, US-05, US-08, US-09 | RN-03 |
| US-03, US-05, US-07, US-09 | RN-23 |
| US-06 | RN-03, RN-06 |
| US-10 | RN-03, RN-04 |
| US-49 | RN-10 |
| US-15 | RN-02, RN-03 |
| US-16, US-17, US-18, US-19, US-20, US-21 | RN-01, RN-02 |
| US-21 | RN-24 |
| US-23, US-24 | RN-05, RN-06 |
| US-25 | RN-05 |
| US-26 | RN-05, RN-07 |
| US-27 | RN-05 |
| US-28 | RN-07 |
| US-29 | RN-14 |
| US-45 | RN-08 |
| US-46 | RN-09 |
| US-30, US-31, US-32 | RN-09 |
| US-33, US-34, US-35 | RN-10, RN-20 |
| US-36 | RN-05, RN-09, RN-10, RN-18 |
| US-37 | RN-01, RN-11, RN-12, RN-13, RN-20 |
| US-38 | RN-12 |
| US-39 | RN-14, RN-18 |
| US-40, US-41, US-42 | RN-05, RN-11, RN-20 |
| US-43, US-44 | RN-08, RN-15, RN-16 |

## 11. Decisiones pendientes

Ninguna. El enlace de recuperación de contraseña dura 1 hora y se usa una sola vez (RN-19, US-48).
