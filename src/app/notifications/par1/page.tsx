// app/page.tsx - VERSION CORREGIDA
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FaArrowLeft, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa'

// Interfaces y tipos
interface FormData {
  region: string
  numero: string
  nombreRequester: string
  zona: string
  servicio: string
  mensajeUsuario: string
  nombreFixer: string
  trabajaSabado: string
}

interface Solicitud {
  codigoUnico: string
  region: string
  numero: string
  nombreRequester: string
  zona: string
  servicio: string
  descripcion: string
  descripcionTruncada: string
  nombreFixer: string | null
  tieneFixerEspecifico: boolean
  trabajaSabado: boolean
  fechaRegistro: Date
  fechaRegistroStr: string
  fechaEstimada: string
  estado: string
  estadoSolicitud: string
  timestampUnico: string
}

interface FechaHoraRegistro {
  fechaHora: Date
  formato: string
}

interface MensajeAPI {
  number: string
  text: string
}

interface LogReintento {
  intento: number
  timestamp: Date
  tiempoEspera: number
  resultado: string
  tiempoRespuesta?: number
  error?: string
}

interface LogVerificacion {
  timestamp: Date
  tipo: 'verificacion_duplicado' | 'registro_exitoso' | 'error'
  codigoSolicitud: string
  nombreFixer: string
  servicio: string
  mensaje: string
  datosComparados: {
    fixer: string
    servicio: string
    nombreCliente: string
  }
}

interface ErrorCanal {
  tipo: 'sin_whatsapp' | 'opt_out' | 'canal_invalido' | 'numero_invalido'
  mensaje: string
  numero: string
}

// Nueva interfaz para solicitudes inválidas
interface SolicitudInvalida {
  codigoUnico: string
  estado: string
  fechaRegistro: string
  fechaEstimada: string
  motivo: string
  numero: string
  servicio: string
  nombreRequester: string
}

// Constantes
const SOLICITUDES_KEY = 'solicitudes_registradas'
const ULTIMAS_SOLICITUDES_KEY = 'ultimas_solicitudes'
const LOGS_VERIFICACION_KEY = 'logs_verificacion_duplicados'
const SOLICITUDES_INVALIDAS_KEY = 'solicitudes_invalidas'

export default function SistemaSolicitudes() {
  const router = useRouter()
  const [codigoUnico, setCodigoUnico] = useState('-')
  const [estadoSolicitud, setEstadoSolicitud] = useState('-')
  const [estadoSolicitudPendiente, setEstadoSolicitudPendiente] = useState('')
  const [fechaRegistro, setFechaRegistro] = useState('-')
  const [fechaEstimada, setFechaEstimada] = useState('-')
  const [mensajeSistema, setMensajeSistema] = useState('')
  const [tipoMensaje, setTipoMensaje] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [jsonEnviado, setJsonEnviado] = useState('')
  const [respuestaServidor, setRespuestaServidor] = useState('')
  const [logsReintentos, setLogsReintentos] = useState<LogReintento[]>([])
  const [duplicadoDetectado, setDuplicadoDetectado] = useState<{encontrado: boolean, codigo: string, datos: Solicitud | null} | null>(null)
  const [solicitudCreada, setSolicitudCreada] = useState(false)
  const [ultimaSolicitudInvalida, setUltimaSolicitudInvalida] = useState<SolicitudInvalida | null>(null)
  const [mostrarSolicitudesInvalidas, setMostrarSolicitudesInvalidas] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    region: '591',
    numero: '69542509',
    nombreRequester: 'Juan Pérez',
    zona: 'La Paz',
    servicio: 'Reparación de laptop',
    mensajeUsuario: 'Necesito reparar la pantalla de mi laptop Dell que se rompió ayer cuando se cayó de la mesa',
    nombreFixer: '',
    trabajaSabado: 'false'
  })

  const [contadorServicio, setContadorServicio] = useState(0)

  useEffect(() => {
    setContadorServicio(formData.servicio.length)
  }, [formData.servicio])

  useEffect(() => {
    inicializarAlmacenamiento()
  }, [])

  const inicializarAlmacenamiento = () => {
    if (typeof window === 'undefined') return;
    
    if (!localStorage.getItem(SOLICITUDES_KEY)) {
      localStorage.setItem(SOLICITUDES_KEY, JSON.stringify([]))
    }
    if (!localStorage.getItem(ULTIMAS_SOLICITUDES_KEY)) {
      localStorage.setItem(ULTIMAS_SOLICITUDES_KEY, JSON.stringify([]))
    }
    if (!localStorage.getItem(LOGS_VERIFICACION_KEY)) {
      localStorage.setItem(LOGS_VERIFICACION_KEY, JSON.stringify([]))
    }
    if (!localStorage.getItem(SOLICITUDES_INVALIDAS_KEY)) {
      localStorage.setItem(SOLICITUDES_INVALIDAS_KEY, JSON.stringify([]))
    }
  }

  const guardarSolicitudInvalida = (solicitud: SolicitudInvalida) => {
    if (typeof window === 'undefined') return;
    
    try {
      const solicitudesExistentes: SolicitudInvalida[] = JSON.parse(localStorage.getItem(SOLICITUDES_INVALIDAS_KEY) || '[]')
      solicitudesExistentes.push(solicitud)
      
      if (solicitudesExistentes.length > 100) {
        solicitudesExistentes.splice(0, solicitudesExistentes.length - 100)
      }
      
      localStorage.setItem(SOLICITUDES_INVALIDAS_KEY, JSON.stringify(solicitudesExistentes))
      setUltimaSolicitudInvalida(solicitud)
      setMostrarSolicitudesInvalidas(true)
    } catch (error) {
      console.error('Error al guardar solicitud inválida:', error)
    }
  }

  const guardarLogVerificacion = (log: LogVerificacion) => {
    if (typeof window === 'undefined') return;
    
    try {
      const logsExistentes: LogVerificacion[] = JSON.parse(localStorage.getItem(LOGS_VERIFICACION_KEY) || '[]')
      logsExistentes.push(log)
      
      if (logsExistentes.length > 500) {
        logsExistentes.splice(0, logsExistentes.length - 500)
      }
      
      localStorage.setItem(LOGS_VERIFICACION_KEY, JSON.stringify(logsExistentes))
    } catch (error) {
      console.error('Error al guardar log de verificación:', error)
    }
  }

  const verificarDuplicadoFixerServicio = (nombreFixer: string, servicio: string): {encontrado: boolean, codigo: string, solicitud: Solicitud | null} => {
    if (typeof window === 'undefined') {
      return { encontrado: false, codigo: '', solicitud: null }
    }

    if (!nombreFixer || nombreFixer.trim() === '') {
      return { encontrado: false, codigo: '', solicitud: null }
    }

    const solicitudesExistentes: Solicitud[] = JSON.parse(localStorage.getItem(SOLICITUDES_KEY) || '[]')
    const ultimas24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const duplicado = solicitudesExistentes.find((solicitud: Solicitud) => {
      const mismaFecha = new Date(solicitud.fechaRegistro) > ultimas24Horas
      const mismoFixer = solicitud.nombreFixer?.toLowerCase().trim() === nombreFixer.toLowerCase().trim()
      const mismoServicio = solicitud.servicio.toLowerCase().trim() === servicio.toLowerCase().trim()
      
      return mismaFecha && mismoFixer && mismoServicio
    })

    guardarLogVerificacion({
      timestamp: new Date(),
      tipo: duplicado ? 'verificacion_duplicado' : 'registro_exitoso',
      codigoSolicitud: duplicado?.codigoUnico || 'N/A',
      nombreFixer: nombreFixer,
      servicio: servicio,
      mensaje: duplicado 
        ? `Se detectó duplicado con código: ${duplicado.codigoUnico}`
        : 'No se encontraron duplicados',
      datosComparados: {
        fixer: nombreFixer,
        servicio: servicio,
        nombreCliente: formData.nombreRequester
      }
    })

    return {
      encontrado: !!duplicado,
      codigo: duplicado?.codigoUnico || '',
      solicitud: duplicado || null
    }
  }

  const generarCodigoUnico = (): string => {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 11)
    return `SOL-${timestamp}-${random}`.toUpperCase()
  }

  const obtenerFechaHoraRegistro = (): FechaHoraRegistro => {
    const ahora = new Date()
    const dia = String(ahora.getDate()).padStart(2, '0')
    const mes = String(ahora.getMonth() + 1).padStart(2, '0')
    const anio = ahora.getFullYear()
    const horas = String(ahora.getHours()).padStart(2, '0')
    const minutos = String(ahora.getMinutes()).padStart(2, '0')
    
    return {
      fechaHora: ahora,
      formato: `${dia}/${mes}/${anio} ${horas}:${minutos}`
    }
  }

  const calcularFechaEstimadaRespuesta = (fechaRegistro: Date, trabajaSabado: boolean = false): string => {
    const fecha = new Date(fechaRegistro)
    let diasHabiles = 0
    
    while (diasHabiles < 2) {
      fecha.setDate(fecha.getDate() + 1)
      const diaSemana = fecha.getDay()
      
      if (diaSemana === 0) continue
      if (diaSemana === 6 && !trabajaSabado) continue
      
      diasHabiles++
    }
    
    const dia = String(fecha.getDate()).padStart(2, '0')
    const mes = String(fecha.getMonth() + 1).padStart(2, '0')
    const anio = fecha.getFullYear()
    
    return `${dia}/${mes}/${anio}`
  }

  const truncarDescripcion = (descripcion: string, maxLength: number = 20): string => {
    if (!descripcion || descripcion.trim() === '') {
      return '(sin descripción)'
    }
    
    if (descripcion.length <= maxLength) {
      return descripcion
    }
    
    return descripcion.substring(0, maxLength) + '...'
  }

  const validarCanal = (numero: string): {valido: boolean, error?: ErrorCanal, requiereReintentos?: boolean} => {
    const numeroLimpio = numero.replace(/\D/g, '')
    
    if (!numeroLimpio || numeroLimpio.trim() === '') {
      return {
        valido: false,
        error: {
          tipo: 'numero_invalido',
          mensaje: 'Número no puede estar vacío',
          numero: numero
        },
        requiereReintentos: true
      }
    }
    
    if (numeroLimpio.length < 8) {
      return {
        valido: false,
        error: {
          tipo: 'numero_invalido',
          mensaje: 'Número debe tener al menos 8 dígitos',
          numero: numero
        },
        requiereReintentos: true
      }
    }
    
    if (numeroLimpio.length > 8) {
      return {
        valido: false,
        error: {
          tipo: 'numero_invalido', 
          mensaje: 'Número no puede tener más de 8 dígitos',
          numero: numero
        },
        requiereReintentos: true
      }
    }
    
    if (numeroLimpio.length === 8) {
      const numerosSinWhatsApp = ['77480958', '77400598', '77400998', '77400508']
      
      if (numerosSinWhatsApp.includes(numeroLimpio)) {
        return {
          valido: false,
          error: {
            tipo: 'sin_whatsapp',
            mensaje: 'El contacto no permite este canal',
            numero: numeroLimpio
          },
          requiereReintentos: false
        }
      }
      
      const numerosInvalidos = ['123456789', '000000000']
      if (numerosInvalidos.includes(numeroLimpio)) {
        return {
          valido: false,
          error: {
            tipo: 'canal_invalido',
            mensaje: 'Número sin WhatsApp',
            numero: numeroLimpio
          },
          requiereReintentos: false
        }
      }
    }
    
    return { 
      valido: true,
      requiereReintentos: true
    }
  }

  const detectarErrorCanalDesdeRespuesta = (respuestaError: string): {mensaje: string, requiereReintentos: boolean} => {
    if (respuestaError.includes('exists') && respuestaError.includes('false')) {
      return {
        mensaje: 'El contacto no permite este canal',
        requiereReintentos: false
      }
    }
    
    if (respuestaError.includes('sin WhatsApp') || respuestaError.includes('no tiene WhatsApp')) {
      return {
        mensaje: 'Número sin WhatsApp',
        requiereReintentos: false
      }
    }
    
    if (respuestaError.includes('opt-out') || respuestaError.includes('opt out')) {
      return {
        mensaje: 'Usuario ha optado por no recibir mensajes',
        requiereReintentos: false
      }
    }
    
    return {
      mensaje: 'Error en el envío del mensaje',
      requiereReintentos: true
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    
    if (id === 'servicio') {
      if (value.length <= 30) {
        setFormData(prev => ({
          ...prev,
          [id]: value
        }))
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [id]: value
      }))
    }

    if ((id === 'nombreFixer' || id === 'servicio') && value.trim() !== '') {
      const nombreFixer = id === 'nombreFixer' ? value : formData.nombreFixer
      const servicio = id === 'servicio' ? value : formData.servicio
      
      if (nombreFixer.trim() !== '' && servicio.trim() !== '') {
        const resultado = verificarDuplicadoFixerServicio(nombreFixer, servicio)
        if (resultado.encontrado) {
          setDuplicadoDetectado({
            encontrado: true,
            codigo: resultado.codigo,
            datos: resultado.solicitud
          })
        } else {
          setDuplicadoDetectado(null)
        }
      }
    }
  }

  const mostrarMensaje = (mensaje: string, tipo: string = 'error', tiempoVisible: number = 0) => {
    setMensajeSistema(mensaje)
    setTipoMensaje(tipo)
    
    if (tiempoVisible > 0) {
      setTimeout(() => {
        setMensajeSistema('')
        setTipoMensaje('')
      }, tiempoVisible)
    }
  }

  const limpiarMensajes = () => {
    setMensajeSistema('')
    setTipoMensaje('')
    setDuplicadoDetectado(null)
  }

  const limpiarEstadoSolicitud = () => {
    setCodigoUnico('-')
    setEstadoSolicitud('-')
    setEstadoSolicitudPendiente('')
    setFechaRegistro('-')
    setFechaEstimada('-')
    setSolicitudCreada(false)
    setDuplicadoDetectado(null)
    setJsonEnviado('')
    setRespuestaServidor('')
    setLogsReintentos([])
    setMostrarSolicitudesInvalidas(false)
    setUltimaSolicitudInvalida(null)
  }

  const calcularSimilitud = (str1: string, str2: string): number => {
    if (str1.length === 0 && str2.length === 0) return 1.0;
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    const distance = distanciaLevenshtein(longer, shorter);
    return (longer.length - distance) / longer.length;
  };

  const distanciaLevenshtein = (s1: string, s2: string): number => {
    const s1Len = s1.length;
    const s2Len = s2.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= s1Len; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s2Len; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s1Len; i++) {
      for (let j = 1; j <= s2Len; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[s1Len][s2Len];
  };

  const verificarDuplicados = (solicitud: Solicitud): Solicitud | null => {
    if (typeof window === 'undefined') return null;
    
    const ultimas24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const solicitudesRecientes = JSON.parse(localStorage.getItem(ULTIMAS_SOLICITUDES_KEY) || '[]')
    
    if (solicitud.nombreFixer && solicitud.nombreFixer.trim() !== '') {
      const resultado = verificarDuplicadoFixerServicio(solicitud.nombreFixer, solicitud.servicio)
      if (resultado.encontrado) {
        return resultado.solicitud
      }
      return null
    }
    
    return solicitudesRecientes.find((s: Solicitud) => 
      s.nombreRequester === solicitud.nombreRequester &&
      s.servicio === solicitud.servicio &&
      s.zona === solicitud.zona &&
      (!s.nombreFixer || s.nombreFixer.trim() === '') &&
      new Date(s.fechaRegistro) > ultimas24Horas &&
      calcularSimilitud(s.descripcion, solicitud.descripcion) > 0.9
    ) || null
  }

  const validarDatos = (): boolean => {
    const camposRequeridos = ['nombreRequester', 'servicio', 'mensajeUsuario']
    return camposRequeridos.every(campo => {
      const valor = formData[campo as keyof FormData]?.toString().trim()
      return valor && valor !== ''
    })
  }

  const prepararSolicitud = (): Solicitud => {
    const fechaRegistroInfo = obtenerFechaHoraRegistro()
    const trabajaSabado = formData.trabajaSabado === 'true'
    const nombreFixer = formData.nombreFixer.trim()
    
    const codigoGenerado = generarCodigoUnico()
    
    return {
      codigoUnico: codigoGenerado,
      region: formData.region,
      numero: formData.numero,
      nombreRequester: formData.nombreRequester,
      zona: formData.zona,
      servicio: formData.servicio,
      descripcion: formData.mensajeUsuario,
      descripcionTruncada: truncarDescripcion(formData.mensajeUsuario),
      nombreFixer: nombreFixer || null,
      tieneFixerEspecifico: !!nombreFixer,
      trabajaSabado: trabajaSabado,
      fechaRegistro: fechaRegistroInfo.fechaHora,
      fechaRegistroStr: fechaRegistroInfo.formato,
      fechaEstimada: calcularFechaEstimadaRespuesta(fechaRegistroInfo.fechaHora, trabajaSabado),
      estado: 'Creada',
      estadoSolicitud: 'Pendiente',
      timestampUnico: Date.now() + Math.random().toString(36).substring(2, 11)
    }
  }

  const registrarSolicitud = async (solicitud: Solicitud): Promise<Solicitud> => {
    if (typeof window === 'undefined') return solicitud;
    
    const solicitudesExistentes: Solicitud[] = JSON.parse(localStorage.getItem(SOLICITUDES_KEY) || '[]')
    const codigoExiste = solicitudesExistentes.some(s => s.codigoUnico === solicitud.codigoUnico)
    
    if (codigoExiste) {
      const nuevoCodigo = generarCodigoUnico()
      solicitud.codigoUnico = nuevoCodigo
    }

    solicitudesExistentes.push(solicitud)
    localStorage.setItem(SOLICITUDES_KEY, JSON.stringify(solicitudesExistentes))
    
    const ultimasSolicitudes: Solicitud[] = JSON.parse(localStorage.getItem(ULTIMAS_SOLICITUDES_KEY) || '[]')
    ultimasSolicitudes.push(solicitud)
    
    if (ultimasSolicitudes.length > 100) {
      ultimasSolicitudes.splice(0, ultimasSolicitudes.length - 100)
    }
    
    localStorage.setItem(ULTIMAS_SOLICITUDES_KEY, JSON.stringify(ultimasSolicitudes))
    
    guardarLogVerificacion({
      timestamp: new Date(),
      tipo: 'registro_exitoso',
      codigoSolicitud: solicitud.codigoUnico,
      nombreFixer: solicitud.nombreFixer || 'Sin fixer específico',
      servicio: solicitud.servicio,
      mensaje: `Solicitud registrada exitosamente - ${solicitud.codigoUnico}`,
      datosComparados: {
        fixer: solicitud.nombreFixer || 'Sin fixer específico',
        servicio: solicitud.servicio,
        nombreCliente: solicitud.nombreRequester
      }
    })
    
    if (solicitud.tieneFixerEspecifico) {
      mostrarMensaje(`Solicitud creada con fixer específico: ${solicitud.nombreFixer}`, 'success', 3000)
    }
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return solicitud
  }

  const actualizarUI = (solicitud: Solicitud): void => {
    setEstadoSolicitud(solicitud.estado)
    setEstadoSolicitudPendiente(solicitud.estadoSolicitud)
    setFechaRegistro(solicitud.fechaRegistroStr)
    setFechaEstimada(solicitud.fechaEstimada)
    setCodigoUnico(solicitud.codigoUnico)
    setSolicitudCreada(true)
    
    if (solicitud.tieneFixerEspecifico) {
      setEstadoSolicitud(`${solicitud.estado} (Fixer: ${solicitud.nombreFixer})`)
    }
  }

  const generarMensajeConfirmacion = (solicitud: Solicitud): MensajeAPI => {
    let mensajeBase = `¡Hola ${solicitud.nombreRequester}!\n✅ Tu solicitud ha sido registrada con éxito.\nCódigo: ${solicitud.codigoUnico}\nEstado: ${solicitud.estado}\nTipo de servicio: ${solicitud.servicio}\nDescripción: ${solicitud.descripcionTruncada}\nFecha y hora de registro: ${solicitud.fechaRegistroStr}\nFecha estimada de respuesta: ${solicitud.fechaEstimada}\nSolicitud: ${solicitud.estadoSolicitud}`
    
    if (solicitud.tieneFixerEspecifico) {
      mensajeBase += `\nFixer asignado: ${solicitud.nombreFixer}`
    }
    
    return {
      number: solicitud.region + solicitud.numero,
      text: mensajeBase
    }
  }

  const agregarLogReintento = (intento: number, tiempoEspera: number, resultado: string, tiempoRespuesta?: number, error?: string) => {
    const nuevoLog: LogReintento = {
      intento,
      timestamp: new Date(),
      tiempoEspera,
      resultado,
      tiempoRespuesta,
      error
    }
    
    setLogsReintentos(prev => [...prev, nuevoLog])
    
    const tiempoFormateado = new Date().toLocaleTimeString()
    const logEntry = `[${tiempoFormateado}] Intento ${intento}: ${resultado} (Espera: ${tiempoEspera}ms${tiempoRespuesta ? `, Respuesta: ${tiempoRespuesta}ms` : ''}${error ? `, Error: ${error}` : ''})`
    
    setRespuestaServidor(prev => prev ? prev + '\n' + logEntry : logEntry)
  }

  const enviarMensajeAPI = async (mensaje: MensajeAPI, idempotencyKey: string): Promise<{respuesta: string, tiempoRespuesta: number}> => {
    const inicio = Date.now()
    
    try {
      setJsonEnviado(JSON.stringify(mensaje, null, 2))
      
      const res = await fetch("https://n8n-evolution-api.oumu0g.easypanel.host/message/sendText/pruebas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": "429683C4C977415CAAFCCE10F7D57E11",
          "Authorization": "Bearer B1719736AF1B-4E77-83D0-DC78E7D578A8",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(mensaje)
      })

      const tiempoRespuesta = Date.now() - inicio
      const _respuesta = await res.text()
      
      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${_respuesta}`)
      }

      return { respuesta: _respuesta, tiempoRespuesta }
    } catch (err: unknown) {
      const tiempoRespuesta = Date.now() - inicio
      const errorMessage = err instanceof Error ? err.message : String(err)
      throw new Error(`Error al enviar: ${errorMessage} (Tiempo: ${tiempoRespuesta}ms)`)
    }
  }

  const enviarMensajes = async (solicitud: Solicitud): Promise<void> => {
    const inicioEnvio = Date.now()
    
    try {
      const validacionCanal = validarCanal(solicitud.numero)
      
      if (!validacionCanal.valido) {
        const mensajeError = validacionCanal.error?.mensaje || 'Error de validación del número'
        
        agregarLogReintento(1, 0, `❌ VALIDACIÓN FALLIDA: ${mensajeError}`)
        
        if (validacionCanal.requiereReintentos) {
          agregarLogReintento(1, 0, `⚠️ Número inválido pero se activarán reintentos`)
          throw new Error(`Validación fallida: ${mensajeError}`)
        } else {
          const solicitudInvalida: SolicitudInvalida = {
            codigoUnico: solicitud.codigoUnico,
            estado: 'solicitud:invalida',
            fechaRegistro: solicitud.fechaRegistroStr,
            fechaEstimada: solicitud.fechaEstimada,
            motivo: mensajeError,
            numero: solicitud.numero,
            servicio: solicitud.servicio,
            nombreRequester: solicitud.nombreRequester
          }
          guardarSolicitudInvalida(solicitudInvalida)
          
          mostrarMensaje(`✅ Solicitud registrada (${solicitud.codigoUnico}), pero ${mensajeError.toLowerCase()}`, 'advertencia')
          
          guardarLogVerificacion({
            timestamp: new Date(),
            tipo: 'error',
            codigoSolicitud: solicitud.codigoUnico,
            nombreFixer: solicitud.nombreFixer || 'Sin fixer específico',
            servicio: solicitud.servicio,
            mensaje: `Error de canal: ${mensajeError} - Número: ${solicitud.numero}`,
            datosComparados: {
              fixer: solicitud.nombreFixer || 'Sin fixer específico',
              servicio: solicitud.servicio,
              nombreCliente: solicitud.nombreRequester
            }
          })
          return
        }
      }

      const mensajeConfirmacion = generarMensajeConfirmacion(solicitud)
      
      agregarLogReintento(1, 0, 'Iniciando envío...')
      const { tiempoRespuesta } = await enviarMensajeAPI(mensajeConfirmacion, solicitud.codigoUnico)
      
      agregarLogReintento(1, 0, '✅ ENVÍO EXITOSO', tiempoRespuesta)
      
      const tiempoEnvio = Date.now() - inicioEnvio
      console.log(`Tiempo de envío: ${tiempoEnvio}ms`)
      
      actualizarUI(solicitud)
      mostrarMensaje('✅ Solicitud registrada y mensaje enviado exitosamente!', 'success')
      return
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Validación fallida:')) {
        agregarLogReintento(1, 0, `❌ ERROR VALIDACIÓN: ${errorMessage}`)
      }
      else if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
        const deteccionError = detectarErrorCanalDesdeRespuesta(errorMessage)
        
        agregarLogReintento(1, 0, `❌ ERROR 400: ${deteccionError.mensaje}`)
        
        if (!deteccionError.requiereReintentos) {
          const solicitudInvalida: SolicitudInvalida = {
            codigoUnico: solicitud.codigoUnico,
            estado: 'solicitud:invalida',
            fechaRegistro: solicitud.fechaRegistroStr,
            fechaEstimada: solicitud.fechaEstimada,
            motivo: deteccionError.mensaje,
            numero: solicitud.numero,
            servicio: solicitud.servicio,
            nombreRequester: solicitud.nombreRequester
          }
          guardarSolicitudInvalida(solicitudInvalida)
          
          mostrarMensaje(`✅ Solicitud registrada (${solicitud.codigoUnico}), pero ${deteccionError.mensaje.toLowerCase()}`, 'advertencia')
          return
        }
        
        agregarLogReintento(1, 0, `⚠️ Error 400 pero se reintentará`)
      } else {
        agregarLogReintento(1, 0, '❌ FALLÓ', undefined, errorMessage)
      }
      
      let intento = 2
      const tiemposEspera = [5000, 15000, 30000]
      
      while (intento <= 4) {
        const tiempoEspera = tiemposEspera[intento - 2]
        
        try {
          agregarLogReintento(intento, tiempoEspera, `⏳ Esperando ${tiempoEspera}ms para reintento...`)
          
          await new Promise(resolve => setTimeout(resolve, tiempoEspera))
          
          agregarLogReintento(intento, tiempoEspera, '🔄 Realizando reintento...')
          
          if (intento === 2) {
            const validacionReintento = validarCanal(solicitud.numero)
            if (!validacionReintento.valido && !validacionReintento.requiereReintentos) {
              const solicitudInvalida: SolicitudInvalida = {
                codigoUnico: solicitud.codigoUnico,
                estado: 'solicitud:invalida',
                fechaRegistro: solicitud.fechaRegistroStr,
                fechaEstimada: solicitud.fechaEstimada,
                motivo: validacionReintento.error?.mensaje || 'Error de canal',
                numero: solicitud.numero,
                servicio: solicitud.servicio,
                nombreRequester: solicitud.nombreRequester
              }
              guardarSolicitudInvalida(solicitudInvalida)
              
              agregarLogReintento(intento, tiempoEspera, `❌ CANAL INVÁLIDO EN REINTENTO: ${validacionReintento.error?.mensaje}`)
              mostrarMensaje(`✅ Solicitud registrada (${solicitud.codigoUnico}), pero ${validacionReintento.error?.mensaje?.toLowerCase()}`, 'advertencia')
              return
            }
          }
          
          const mensajeConfirmacion = generarMensajeConfirmacion(solicitud)
          const { tiempoRespuesta: tiempoReintento } = await enviarMensajeAPI(mensajeConfirmacion, solicitud.codigoUnico + '-reintento-' + (intento - 1))
          
          agregarLogReintento(intento, tiempoEspera, '✅ REINTENTO EXITOSO', tiempoReintento)
          
          actualizarUI(solicitud)
          mostrarMensaje('✅ Solicitud registrada y mensaje enviado exitosamente!', 'success')
          return
          
        } catch (errorRetry: unknown) {
          const errorRetryMessage = errorRetry instanceof Error ? errorRetry.message : String(errorRetry)
          agregarLogReintento(intento, tiempoEspera, `❌ REINTENTO FALLIDO`, undefined, errorRetryMessage)
          intento++
        }
      }
      
      const tiempoTotal = Date.now() - inicioEnvio
      const mensajeError = `Solicitud creada (Código ${solicitud.codigoUnico}), pero no pudimos enviar la confirmación después de 3 reintentos. Tiempo total: ${tiempoTotal}ms. Intenta revisar el estado en la app.`
      
      agregarLogReintento(0, tiempoTotal, `💥 TODOS LOS REINTENTOS FALLARON`, undefined, mensajeError)
      
      mostrarMensaje(mensajeError, 'advertencia')
      throw new Error(mensajeError)
    }
  }

  const procesarSolicitud = async () => {
    setProcesando(true)
    limpiarMensajes()
    limpiarEstadoSolicitud()

    try {
      if (!validarDatos()) {
        throw new Error('Por favor complete todos los campos requeridos')
      }

      if (formData.nombreFixer.trim() !== '') {
        const resultadoDuplicado = verificarDuplicadoFixerServicio(formData.nombreFixer, formData.servicio)
        if (resultadoDuplicado.encontrado) {
          throw new Error(`🚫 Ya existe un registro con el mismo Fixer y Servicio. Código del registro existente: ${resultadoDuplicado.codigo}`)
        }
      }

      const solicitud = prepararSolicitud()
      
      const duplicado = verificarDuplicados(solicitud)
      if (duplicado) {
        mostrarMensaje(
          `Ya tienes una solicitud similar en curso (Código: ${duplicado.codigoUnico}).`,
          'advertencia'
        )
        setProcesando(false)
        return
      }

      const solicitudRegistrada = await registrarSolicitud(solicitud)
      
      await enviarMensajes(solicitudRegistrada)
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      mostrarMensaje(errorMessage, 'error')
    } finally {
      setProcesando(false)
    }
  }

  const formatearLogsReintentos = (): string => {
    if (logsReintentos.length === 0) return ''
    
    return logsReintentos.map(log => {
      const tiempo = log.timestamp.toLocaleTimeString()
      const base = `[${tiempo}] Intento ${log.intento}: ${log.resultado}`
      const detalles = []
      
      if (log.tiempoEspera > 0) {
        detalles.push(`Espera: ${log.tiempoEspera}ms`)
      }
      if (log.tiempoRespuesta) {
        detalles.push(`Respuesta: ${log.tiempoRespuesta}ms`)
      }
      if (log.error) {
        detalles.push(`Error: ${log.error}`)
      }
      
      return detalles.length > 0 ? `${base} (${detalles.join(', ')})` : base
    }).join('\n')
  }

  const goBack = () => {
    router.push('/servineo');
  }

  return (
    <div className="container" style={{position: 'relative'}}>
      <button
        onClick={goBack}
        className="absolute top-4 left-4 p-4 bg-[#2B3FE0] text-[#2BD0F0] rounded-xl hover:bg-[#1AA7ED] hover:text-white transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 z-10 min-w-[120px]"
        title="Atrás"
        style={{minWidth: '120px', whiteSpace: 'nowrap'}}
      >
        <FaArrowLeft className="h-5 w-5 flex-shrink-0" />
        <span className="font-semibold text-base">Atrás</span>
      </button>

      <div className="header" style={{marginTop: '70px'}}>
        <h1 className="main-title">Sistema de Solicitudes</h1>
        <p className="subtitle">Gestiona solicitudes y comunica con los Fixers fácilmente</p>
      </div>

      {duplicadoDetectado && duplicadoDetectado.encontrado && (
        <div className="system-message message-advertencia" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          color: '#92400e'
        }}>
          <FaExclamationTriangle className="h-5 w-5" />
          <div>
            <strong>⚠️ Duplicado detectado:</strong> Ya existe un registro con el mismo Fixer y Servicio. 
            <br />
            <strong>Código del registro existente:</strong> {duplicadoDetectado.codigo}
          </div>
        </div>
      )}

      <div className="status-section">
        {solicitudCreada ? (
          <div className="status-item">
            <div className="status-label">Código Único</div>
            <div className="status-value">{codigoUnico}</div>
          </div>
        ) : (
          <div className="status-item">
            <div className="status-label">Código Único</div>
            <div className="status-value">-</div>
          </div>
        )}
        
        {solicitudCreada ? (
          <div className="status-item">
            <div className="status-label">Estado</div>
            <div className="status-value">{estadoSolicitud}</div>
          </div>
        ) : (
          <div className="status-item">
            <div className="status-label">Estado</div>
            <div className="status-value">-</div>
          </div>
        )}
        
        {solicitudCreada ? (
          <div className="status-item">
            <div className="status-label">Solicitud</div>
            <div className="status-value" style={{color: '#fbbf24', fontWeight: 'bold'}}>
              {estadoSolicitudPendiente}
            </div>
          </div>
        ) : (
          <div className="status-item">
            <div className="status-label">Solicitud</div>
            <div className="status-value">-</div>
          </div>
        )}
        
        {solicitudCreada ? (
          <div className="status-item">
            <div className="status-label">Fecha Registro</div>
            <div className="status-value">{fechaRegistro}</div>
          </div>
        ) : (
          <div className="status-item">
            <div className="status-label">Fecha Registro</div>
            <div className="status-value">-</div>
          </div>
        )}
        
        {solicitudCreada ? (
          <div className="status-item">
            <div className="status-label">Fecha Estimada</div>
            <div className="status-value">{fechaEstimada}</div>
          </div>
        ) : (
          <div className="status-item">
            <div className="status-label">Fecha Estimada</div>
            <div className="status-value">-</div>
          </div>
        )}
      </div>

      {mensajeSistema && (
        <div className={`system-message message-${tipoMensaje}`}>
          {mensajeSistema}
        </div>
      )}

      {mostrarSolicitudesInvalidas && ultimaSolicitudInvalida && (
        <div className="glass-card" style={{border: '2px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)', marginTop: '2rem'}}>
          <h2 className="card-title" style={{color: '#ef4444', display: 'flex', alignItems: 'center', gap: '10px'}}>
            <FaTimesCircle className="h-6 w-6" />
            Última Solicitud Inválida
          </h2>
          <p style={{color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem'}}>
            La siguiente solicitud no pudo ser enviada debido a problemas con el canal de comunicación:
          </p>
          <div style={{overflowX: 'auto'}}>
            <table style={{width: '100%', borderCollapse: 'collapse', marginTop: '1rem'}}>
              <thead>
                <tr style={{backgroundColor: 'rgba(239, 68, 68, 0.1)'}}>
                  <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ef4444', color: '#ef4444'}}>Código</th>
                  <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ef4444', color: '#ef4444'}}>Estado</th>
                  <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ef4444', color: '#ef4444'}}>Fecha Registro</th>
                  <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ef4444', color: '#ef4444'}}>Fecha Estimada</th>
                  <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ef4444', color: '#ef4444'}}>Motivo</th>
                  <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ef4444', color: '#ef4444'}}>Número</th>
                  <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ef4444', color: '#ef4444'}}>Servicio</th>
                  <th style={{padding: '12px', textAlign: 'left', borderBottom: '1px solid #ef4444', color: '#ef4444'}}>Cliente</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{borderBottom: '1px solid rgba(239, 68, 68, 0.3)'}}>
                  <td style={{padding: '12px', color: '#ef4444', fontWeight: 'bold'}}>{ultimaSolicitudInvalida.codigoUnico}</td>
                  <td style={{padding: '12px', color: '#ef4444'}}>{ultimaSolicitudInvalida.estado}</td>
                  <td style={{padding: '12px', color: '#ef4444'}}>{ultimaSolicitudInvalida.fechaRegistro}</td>
                  <td style={{padding: '12px', color: '#ef4444'}}>{ultimaSolicitudInvalida.fechaEstimada}</td>
                  <td style={{padding: '12px', color: '#ef4444'}}>{ultimaSolicitudInvalida.motivo}</td>
                  <td style={{padding: '12px', color: '#ef4444'}}>{ultimaSolicitudInvalida.numero}</td>
                  <td style={{padding: '12px', color: '#ef4444'}}>{ultimaSolicitudInvalida.servicio}</td>
                  <td style={{padding: '12px', color: '#ef4444'}}>{ultimaSolicitudInvalida.nombreRequester}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{marginTop: '1rem', fontSize: '0.9rem', color: '#ef4444', textAlign: 'center'}}>
            Mostrando 1 solicitud inválida
          </div>
        </div>
      )}

      <div className="glass-card">
        <h2 className="card-title">📋 Datos del Requester</h2>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Región</label>
            <input
              type="text"
              id="region"
              value={formData.region}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Ej: 591"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Número *</label>
            <input
              type="text"
              id="numero"
              value={formData.numero}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Ej: 69542509 (8 dígitos)"
              required
            />
            <small style={{color: '#94a3b8', fontSize: '0.8rem', marginTop: '5px'}}> 
              ⚠️ Debe tener exactamente 8 dígitos
            </small>
          </div>
          <div className="form-group" style={{gridColumn: '1 / -1'}}>
            <label className="form-label">Nombre del Cliente *</label>
            <input
              type="text"
              id="nombreRequester"
              value={formData.nombreRequester}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Nombre completo del cliente"
              required
            />
          </div>
          <div className="form-group" style={{gridColumn: '1 / -1'}}>
            <label className="form-label">Zona/Ciudad</label>
            <input
              type="text"
              id="zona"
              value={formData.zona}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Ej: La Paz, Zona Sur"
            />
          </div>
          <div className="form-group" style={{gridColumn: '1 / -1'}}>
            <label className="form-label">Servicio Solicitado *</label>
            <input
              type="text"
              id="servicio"
              value={formData.servicio}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Descripción del servicio requerido (máx. 30 caracteres)"
              maxLength={30}
              required
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '5px',
              fontSize: '0.8rem'
            }}>
              <span style={{
                color: contadorServicio >= 30 ? '#ef4444' : '#94a3b8'
              }}>
               
              </span>
              {contadorServicio >= 30 && (
                <span style={{color: '#ef4444', fontWeight: 'bold'}}>
                  ⚠️ Límite alcanzado
                </span>
              )}
            </div>
          </div>
          <div className="form-group" style={{gridColumn: '1 / -1'}}>
            <label className="form-label">Mensaje Adicional *</label>
            <textarea
              id="mensajeUsuario"
              value={formData.mensajeUsuario}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Describe tu problema o requerimiento..."
              rows={4}
              style={{resize: 'vertical', minHeight: '100px'}}
              required
            />
          </div>
        </div>
      </div>

      <div className="glass-card">
        <h2 className="card-title">👨‍💼 Datos del Fixer</h2>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nombre del Fixer (opcional)</label>
            <input
              type="text"
              id="nombreFixer"
              value={formData.nombreFixer}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Dejar vacío para asignación automática"
            />
            <small style={{color: '#94a3b8', fontSize: '0.8rem', marginTop: '5px'}}>
              
            </small>
          </div>
          <div className="form-group">
            <label className="form-label">¿Trabaja Sábado?</label>
            <select
              id="trabajaSabado"
              value={formData.trabajaSabado}
              onChange={handleInputChange}
              className="form-input"
            >
              <option value="false">No</option>
              <option value="true">Sí</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{textAlign: 'center', marginTop: '2rem'}}>
        <button 
          onClick={procesarSolicitud}
          disabled={procesando || (duplicadoDetectado ? duplicadoDetectado.encontrado : false)}
          className="button"
          style={{minWidth: '200px'}}
        >
          {procesando ? '⏳ Procesando...' : '🚀 Registrar Solicitud'}
        </button>
      </div>

      {(jsonEnviado || respuestaServidor) && (
        <div className="glass-card">
          <h2 className="card-title">🔧 Información de Debug</h2>
          <div className="form-grid">
            {jsonEnviado && (
              <div className="form-group" style={{gridColumn: '1 / -1'}}>
                <label className="form-label">JSON Enviado:</label>
                <pre style={{
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  overflow: 'auto',
                  fontSize: '0.9rem',
                  color: '#e2e8f0'
                }}>
                  {jsonEnviado}
                </pre>
              </div>
            )}
            
            {logsReintentos.length > 0 && (
              <div className="form-group" style={{gridColumn: '1 / -1'}}>
                <label className="form-label">📊 Logs de Reintentos:</label>
                <div style={{
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  overflow: 'auto',
                  fontSize: '0.85rem',
                  color: '#e2e8f0',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px'
                }}>
                  {formatearLogsReintentos()}
                </div>
              </div>
            )}

            {respuestaServidor && (
              <div className="form-group" style={{gridColumn: '1 / -1'}}>
                <label className="form-label">Respuesta del Servidor:</label>
                <pre style={{
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  overflow: 'auto',
                  fontSize: '0.9rem',
                  color: '#e2e8f0',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px'
                }}>
                  {respuestaServidor}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
