"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { FaUserCog, FaPencilAlt, FaCheck, FaHistory, FaArrowLeft } from "react-icons/fa";
import { useRouter } from 'next/navigation';
import { Fixer, ClientData, initialFixerState, initialClientState } from './types';
import { API_CONFIG } from './utils';
import HistoryItem from './components/HistoryItem';

// Interface para los logs locales
interface LocalLog {
  id: string;
  status: string;
  title: string;
  fixer: string;
  date: string;
  timestamp: number;
}

export default function Par3Page() {
  const router = useRouter();
  const [fixer, setFixer] = useState<Fixer>(initialFixerState);
  const [editando, setEditando] = useState<keyof Fixer | null>(null);
  const [clientData, setClientData] = useState<ClientData>(initialClientState);
  const [localLogs, setLocalLogs] = useState<LocalLog[]>([]);
  const [logMessage, setLogMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false); // Nuevo estado para prevenir múltiples envíos

  // Cargar logs locales desde localStorage al iniciar
  useEffect(() => {
    const savedLogs = localStorage.getItem('servineo-par3-local-logs');
    if (savedLogs) {
      setLocalLogs(JSON.parse(savedLogs));
    }
  }, []);

  // Guardar logs en localStorage cuando cambien
  useEffect(() => {
    if (localLogs.length > 0) {
      localStorage.setItem('servineo-par3-local-logs', JSON.stringify(localLogs));
    }
  }, [localLogs]);

  // Validar y formatear número boliviano internacional (591 + 8 dígitos)
  const formatBolivianPhoneInternational = (value: string): string => {
    // Solo permitir números
    const numbersOnly = value.replace(/[^\d]/g, '');
    
    // Si empieza con 591, limitar a 11 dígitos (591 + 8)
    if (numbersOnly.startsWith('591')) {
      return numbersOnly.slice(0, 11);
    }
    // Si no empieza con 591, pero ya tiene más de 3 dígitos, forzar 591 al inicio
    else if (numbersOnly.length > 3) {
      return '591' + numbersOnly.slice(0, 8);
    }
    // Si es menor a 3 dígitos, permitir edición normal
    else {
      return numbersOnly;
    }
  };

  // Validar texto (solo letras, acentos, espacios)
  const formatTextOnly = (value: string): string => {
    // Permitir letras, acentos, espacios, ñ, Ñ y algunos signos de puntuación comunes
    return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.,!?¿¡-]/g, '');
  };

  const handleClientChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    
    let formattedValue = value;
    
    // Aplicar validaciones según el campo
    if (id === 'telefonoCliente') {
      formattedValue = formatBolivianPhoneInternational(value);
    } else if (id === 'nombreCliente') {
      formattedValue = formatTextOnly(value);
    }
    // Descripción permite números y texto
    else if (id === 'descripcion') {
      // Permitir texto normal para descripción
      formattedValue = value;
    }
    
    setClientData((prev) => ({ ...prev, [id]: formattedValue }));
  };

  const habilitarEdicion = (id: keyof Fixer) => setEditando(id);

  const guardarCambio = (id: keyof Fixer) => {
    setEditando(null);
    alert(`Campo actualizado: ${fixer[id]}`);
  };

  const handleFixerChange = (id: keyof Fixer, value: string) => {
    let formattedValue = value;
    
    // Aplicar validaciones según el campo
    if (id === 'fixerTelefono') {
      formattedValue = formatBolivianPhoneInternational(value);
    } else if (id === 'fixerNombre' || id === 'fixerProfesion') {
      formattedValue = formatTextOnly(value);
    }
    
    setFixer({ ...fixer, [id]: formattedValue });
  };

  // Función para agregar un nuevo log local
  const agregarLogLocal = (status: string, titulo: string): string => {
    const logId = Date.now().toString() + Math.random().toString(36).substr(2, 9); // ID único
    
    const nuevoLog: LocalLog = {
      id: logId,
      status,
      title: titulo,
      fixer: fixer.fixerNombre,
      date: new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      timestamp: Date.now()
    };

    setLocalLogs(prev => [nuevoLog, ...prev].slice(0, 10));
    return logId; // Devolvemos el ID para poder actualizarlo después
  };

  // Función para actualizar el estado de un log específico
  const actualizarLogLocal = (logId: string, nuevoEstado: string, titulo?: string) => {
    setLocalLogs(prev => 
      prev.map(log => 
        log.id === logId 
          ? { 
              ...log, 
              status: nuevoEstado,
              ...(titulo && { title: titulo })
            }
          : log
      )
    );
  };

  const enviarNotificacion = async () => {
    // Prevenir múltiples envíos simultáneos
    if (isSending) {
      alert("⏳ Ya se está enviando una solicitud, por favor espera...");
      return;
    }

    const { fixerNombre, fixerProfesion, fixerTelefono } = fixer;
    const { nombreCliente, descripcion, telefonoCliente } = clientData;
    
    const URL_RESPUESTA = "https://tuapp.com/responder-solicitud";

    // Validaciones
    if (!fixerTelefono || fixerTelefono.trim() === "" || fixerTelefono.length !== 11) {
      alert("❌ Error: El campo 'Número Destino' del Fixer es obligatorio y debe tener el formato 591 + 8 dígitos (11 números en total)");
      return;
    }

    if (!telefonoCliente || telefonoCliente.trim() === "" || telefonoCliente.length !== 11) {
      alert("❌ Error: El teléfono del cliente es obligatorio y debe tener el formato 591 + 8 dígitos (11 números en total)");
      return;
    }

    if (!descripcion || descripcion.trim() === "") {
      alert("❌ Error: La descripción del servicio es obligatoria");
      return;
    }

    setIsSending(true); // Bloquear más envíos

    // Agregar log local inmediatamente con ID único
    const logId = agregarLogLocal("Enviando", `Solicitud: ${descripcion.substring(0, 30)}...`);

    const texto = `¡Hola ${fixerNombre}, el ${fixerProfesion}!
Nueva solicitud de servicio.
Cliente: ${nombreCliente || "Cliente sin nombre"}
Teléfono del Cliente: ${telefonoCliente} 
Descripción: "${descripcion}"
Enlace para responder: ${URL_RESPUESTA}
Por favor, revisa y responde lo antes posible.`;

    const cuerpo = {
      number: fixerTelefono,
      text: texto,
      logData: {
        fixer: fixer,
        client: clientData,
      },
    };

    try {
      const respuesta = await fetch(API_CONFIG.URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": API_CONFIG.API_KEY,
          "Authorization": API_CONFIG.AUTH_TOKEN
        },
        body: JSON.stringify(cuerpo),
      });

      if (respuesta.ok) {
        alert("✅ Notificación enviada correctamente al Fixer: " + fixerTelefono);
        
        // Actualizar el log específico usando el ID
        actualizarLogLocal(logId, "Completado", descripcion);
        
        // Limpiar formulario
        setClientData(initialClientState);
        
      } else {
        const errorText = await respuesta.text();
        console.error("Error response:", errorText);
        
        // Actualizar el log específico usando el ID
        actualizarLogLocal(logId, "Fallido");
        
        alert(`❌ Error: El número del Fixer no existe`);
      }
    } catch (error) {
      console.error("Error en la petición:", error);
      
      // Actualizar el log específico usando el ID
      actualizarLogLocal(logId, "Error Conexión");
      
      alert("⚠️ Error de conexión con el servicio");
    } finally {
      setIsSending(false); // Rehabilitar envíos
    }
  };

  // Función para limpiar logs locales
  const limpiarLogsLocales = () => {
    setLocalLogs([]);
    localStorage.removeItem('servineo-par3-local-logs');
    alert("🗑️ Historial local limpiado");
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4 font-roboto">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
      `}</style>
      
      <div className="max-w-6xl w-full mx-auto p-6 bg-white rounded-2xl shadow-lg border border-[#D1D5DB]">
        {/* Botón ATRAS */}
        <button
          onClick={() => router.push('/servineo')}
          className="flex items-center gap-2 px-4 py-2 bg-[#2B31E0] text-white rounded-lg hover:bg-[#2B6AE0] transition duration-300 font-medium mb-6"
        >
          <FaArrowLeft className="h-4 w-4" />
          <span>Volver</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUMNA IZQUIERDA: HISTORIAL */}
          <div className="bg-white p-6 rounded-xl border border-[#E5E7EB]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-[#111827] text-xl font-bold flex items-center gap-2">
                <FaHistory className="text-[#2B31E0]" /> Historial
              </h2>
              {localLogs.length > 0 && (
                <button
                  onClick={limpiarLogsLocales}
                  className="text-xs bg-[#EF4444] text-white px-3 py-1 rounded-lg hover:bg-[#DC2626] transition font-medium"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="max-h-[500px] overflow-y-auto pr-2">
              {localLogs.length === 0 ? (
                <div className="text-center text-[#64748B] py-8">
                  <FaHistory className="mx-auto text-4xl mb-2 opacity-50" />
                  <p>No hay historial de servicios</p>
                  <p className="text-sm mt-1">Los servicios aparecerán aquí después de enviarlos</p>
                </div>
              ) : (
                localLogs.map((item) => (
                  <HistoryItem
                    key={item.id}
                    status={item.status}
                    title={item.title}
                    fixer={item.fixer}
                    date={item.date}
                  />
                ))
              )}
            </div>
            
            <div className="mt-2 text-xs text-[#64748B] text-center">
              {localLogs.length > 0 && `Mostrando ${localLogs.length} servicios locales`}
            </div>
          </div>

          {/* COLUMNA DERECHA: FORMULARIO */}
          <div className="bg-white p-6 rounded-xl border border-[#E5E7EB]">
            <h2 className="text-center text-white bg-[#2B31E0] py-4 rounded-lg text-xl font-bold mb-6">
              Solicitar Servicio
            </h2>

            <h3 className="text-[#2B31E0] font-bold text-lg mb-4 border-b border-[#E5E7EB] pb-2">
              Datos del Cliente
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[#111827] text-sm font-medium mb-2">
                  Número de teléfono <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  id="telefonoCliente"
                  value={clientData.telefonoCliente}
                  onChange={handleClientChange}
                  placeholder="Ej: 59160606060 (11 dígitos)"
                  className="w-full p-3 border border-[#D1D5DB] rounded-lg focus:border-[#2B31E0] focus:ring-2 focus:ring-[#2B31E0]/20 text-[#111827] transition"
                  maxLength={11}
                  inputMode="numeric"
                />
                <div className="text-xs text-[#64748B] mt-1">
                  {clientData.telefonoCliente.length}/11 dígitos (591 + 8 dígitos)
                </div>
              </div>

              <div>
                <label className="block text-[#111827] text-sm font-medium mb-2">Nombre del Cliente</label>
                <input
                  type="text"
                  id="nombreCliente"
                  value={clientData.nombreCliente}
                  onChange={handleClientChange}
                  placeholder="Ej: Juan Pérez (solo letras)"
                  className="w-full p-3 border border-[#D1D5DB] rounded-lg focus:border-[#2B31E0] focus:ring-2 focus:ring-[#2B31E0]/20 text-[#111827] transition"
                />
              </div>

              <div>
                <label className="block text-[#111827] text-sm font-medium mb-2">
                  Descripción del servicio <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  id="descripcion"
                  value={clientData.descripcion}
                  onChange={handleClientChange}
                  placeholder="Ej: Reparación urgente de equipo TV"
                  className="w-full p-3 border border-[#D1D5DB] rounded-lg focus:border-[#2B31E0] focus:ring-2 focus:ring-[#2B31E0]/20 text-[#111827] transition"
                />
              </div>
            </div>

            <div className="mt-6 p-5 bg-[#759AE0]/10 rounded-xl border border-[#759AE0]/30">
              <h3 className="text-center text-[#2B31E0] font-bold text-lg flex items-center justify-center gap-2 mb-4">
                <FaUserCog className="text-[#2B31E0]" /> Datos del Fixer
              </h3>

              <div className="space-y-4">
                {Object.entries(fixer).map(([key, value]) => (
                  <div key={key} className="flex flex-col space-y-2">
                    <label className="text-[#111827] text-sm font-medium capitalize">
                      {key === "fixerTelefono"
                        ? "Número Destino *"
                        : key.replace("fixer", "").replace(/([A-Z])/g, " $1")}
                      {key === "fixerTelefono" && <span className="text-[#EF4444]"> *</span>}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={value}
                        disabled={editando !== key}
                        onChange={(e) => handleFixerChange(key as keyof Fixer, e.target.value)}
                        className={`w-full p-3 rounded-lg border text-[#111827] transition ${
                          editando === key 
                            ? "border-[#2B31E0] bg-white shadow-sm" 
                            : "border-[#D1D5DB] bg-white"
                        }`}
                        onKeyDown={(e) => e.key === "Enter" && guardarCambio(key as keyof Fixer)}
                        placeholder={
                          key === "fixerTelefono" 
                            ? "Ej: 59160606060 (11 dígitos)" 
                            : key === "fixerNombre"
                            ? "Ej: Carlos López (solo letras)"
                            : key === "fixerProfesion"
                            ? "Ej: Técnico en electrónica"
                            : ""
                        }
                        maxLength={key === "fixerTelefono" ? 11 : undefined}
                        inputMode={key === "fixerTelefono" ? "numeric" : "text"}
                      />
                      {editando === key ? (
                        <button
                          onClick={() => guardarCambio(key as keyof Fixer)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#2B31E0] text-white p-2 rounded-lg text-sm hover:bg-[#2B6AE0] transition"
                        >
                          <FaCheck />
                        </button>
                      ) : (
                        <button
                          onClick={() => habilitarEdicion(key as keyof Fixer)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#2B31E0] transition p-2"
                        >
                          <FaPencilAlt />
                        </button>
                      )}
                    </div>
                    {key === "fixerTelefono" && (
                      <div className="text-xs text-[#64748B]">
                        {value.length}/11 dígitos (591 + 8 dígitos)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={enviarNotificacion}
              disabled={isSending}
              className={`w-full mt-6 py-3 rounded-lg font-bold transition duration-300 shadow-sm ${
                isSending 
                  ? "bg-gray-400 text-gray-200 cursor-not-allowed" 
                  : "bg-[#2B31E0] text-white hover:bg-[#2B6AE0]"
              }`}
            >
              {isSending ? "Enviando..." : "Solicitar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
