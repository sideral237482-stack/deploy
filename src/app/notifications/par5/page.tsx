'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Interfaces (sin cambios)
interface Fixer {
  nombre: string;
  codigoPais: string;
  numero: string;
}

interface Solicitud {
  id: string;
  nombreRequester: string;
  codigoPais: string;
  numero: string;
  servicio: string;
  urlSolicitud: string;
  fecha: string;
  fixer: Fixer; 
}

interface LogEntry {
  id: string;
  timestamp: Date;
  tipo: 'envio' | 'error' | 'aceptada' | 'rechazada' | 'edicion' | 'notificacion_administrador' | 'notificacion_fixer';
  solicitudId: string;
  cliente: string;
  servicio: string;
  estado?: 'aceptada' | 'rechazada';
  mensaje: string;
  detalles?: string;
  exito?: boolean;
}

// Constante con información del administrador
const ADMIN_INFO = {
  nombre: 'Administrador ServiNeo',
  codigoPais: '+591',
  numero: '69542509'
};

export default function SimulationHU3() {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([
    {
      id: '001',
      nombreRequester: 'Juan Pérez',
      codigoPais: '+591',
      numero: '77777777',
      servicio: 'Reparación de plomería',
      urlSolicitud: 'https://servineo.com/solicitud/001',
      fecha: '2025-10-15',
      fixer: {
        nombre: 'Carlos Mendoza',
        codigoPais: '+591',
        numero: '78888888'
      }
    },
    // ... resto de solicitudes
  ]);

  // Estados principales
  const [modalVisible, setModalVisible] = useState(false);
  const [solicitudActual, setSolicitudActual] = useState<Solicitud | null>(null);
  const [estadoActual, setEstadoActual] = useState<'aceptada' | 'rechazada' | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [alerta, setAlerta] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  // Estados para edición
  const [editandoSolicitud, setEditandoSolicitud] = useState<Solicitud | null>(null);
  const [modalEdicionVisible, setModalEdicionVisible] = useState(false);
  const [formEdicion, setFormEdicion] = useState({
    id: '',
    codigoPais: '+591',
    numero: '',
    urlSolicitud: '',
    fixerCodigoPais: '+591',
    fixerNumero: ''
  });

  // Estados para validación en tiempo real
  const [erroresEdicion, setErroresEdicion] = useState<{
    numero: string;
    fixerNumero: string;
    urlSolicitud: string;
  }>({
    numero: '',
    fixerNumero: '',
    urlSolicitud: ''
  });

  const [errorMotivoRechazo, setErrorMotivoRechazo] = useState('');

  // Estados para logs y reintentos
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [modalLogsVisible, setModalLogsVisible] = useState(false);
  const [reintentoPendiente, setReintentoPendiente] = useState<{solicitud: Solicitud, estado: 'aceptada' | 'rechazada', motivo: string} | null>(null);
  const [reintentosCount, setReintentosCount] = useState<{[key: string]: number}>({});
  const [reintentoAutomatico, setReintentoAutomatico] = useState<boolean>(false);

  // Validaciones
  const validarMotivo = (texto: string): boolean => {
    const regex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,!?¿¡()\-]*$/;
    return regex.test(texto) && texto.length <= 70;
  };

  const validarNumero = (numero: string): boolean => {
    const regex = /^\d{7,8}$/;
    return regex.test(numero);
  };

  const _validarCodigoPais = (codigo: string): boolean => {
    return codigo === '+591';
  };

  // Función para validación en tiempo real (sin cambios)
  const validarCampoEnTiempoReal = (campo: string, valor: string) => {
    // ... (código sin cambios)
  };

  // Función para agregar logs (sin cambios)
  const agregarLog = (log: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const nuevoLog: LogEntry = {
      ...log,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setLogs(prev => [nuevoLog, ...prev].slice(0, 50));
  };

  // Función para mostrar alertas temporales (sin cambios)
  const mostrarAlerta = (tipo: 'success' | 'error', mensaje: string) => {
    setAlerta({ tipo, mensaje });
    setTimeout(() => setAlerta(null), 5000);
  };

  // Función para enviar mensaje al administrador después de 3 reintentos
  const enviarMensajeAlAdministrador = async (solicitud: Solicitud, errorCount: number, estado: 'aceptada' | 'rechazada') => {
    // ... (código sin cambios hasta el catch)
    
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error al notificar al administrador:', error);
      
      agregarLog({
        tipo: 'notificacion_administrador',
        solicitudId: solicitud.id,
        cliente: solicitud.nombreRequester,
        servicio: solicitud.servicio,
        mensaje: `Error al enviar notificación al administrador`,
        detalles: errorMessage,
        exito: false
      });
    }
  };

  // Función para enviar mensaje al fixer informando el fallo
  const enviarMensajeAlFixer = async (solicitud: Solicitud, estado: 'aceptada' | 'rechazada') => {
    // ... (código sin cambios hasta el catch)
    
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error al notificar al fixer:', error);
      
      agregarLog({
        tipo: 'notificacion_fixer',
        solicitudId: solicitud.id,
        cliente: solicitud.nombreRequester,
        servicio: solicitud.servicio,
        mensaje: `Error al enviar notificación de fallo al fixer`,
        detalles: errorMessage,
        exito: false
      });
    }
  };

  // Función para reintentar envío - usar useCallback para evitar dependencia circular
  const reintentarEnvio = useCallback(() => {
    if (reintentoPendiente) {
      console.log(`🔄 Reintentando envío para SOL-${reintentoPendiente.solicitud.id}...`);
      enviarMensaje(
        reintentoPendiente.estado,
        reintentoPendiente.solicitud,
        reintentoPendiente.motivo
      );
    }
  }, [reintentoPendiente]);

  // Función para reintento automático - ahora con dependencia correcta
  useEffect(() => {
    if (reintentoAutomatico && reintentoPendiente) {
      const timer = setTimeout(() => {
        console.log('🔄 Reintento automático iniciado...');
        reintentarEnvio();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [reintentoAutomatico, reintentoPendiente, reintentarEnvio]);

  // Función para enviar el mensaje con manejo de errores mejorado
  const enviarMensaje = async (
    estado: 'aceptada' | 'rechazada',
    solicitud: Solicitud,
    motivoRechazo: string
  ) => {
    // ... (código sin cambios hasta el catch)
    
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error con PAR5:', error);
      
      const mensajeError = error instanceof Error && error.name === 'AbortError' 
        ? '⏰ Tiempo de espera agotado. Verifica tu conexión a internet.'
        : `🌐 Error de conexión: ${errorMessage}`;

      // ... (resto del código sin cambios)
    } finally {
      setModalLoading(false);
    }
  };

  // ... resto del código (abrirEdicion, guardarEdicion, etc.) sin cambios

  return (
    // ... JSX sin cambios
  );
}
