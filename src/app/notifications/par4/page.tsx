// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
interface FormData {
  idCita: string;
  nombreFixer: string;
  regionTelefono: string;
  numeroTelefono: string;
  nombreRequester: string;
  titulo: string;
  descripcion: string;
  enlace: string;
}

// Configuración Evolution API
const EVOLUTION_API_URL = 'https://n8n-evolution-api.oumu0g.easypanel.host';
const EVOLUTION_INSTANCE_NAME = 'pruebas';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const ENDPOINT = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;

async function sendWhatsAppMessage(formData: FormData) {
  const required = ['nombreFixer','regionTelefono','numeroTelefono','nombreRequester','titulo','descripcion'];
  for (const f of required) {
    const val = (formData as any)[f];
    if (!val || String(val).trim() === '') return { success:false, message:`Falta el campo: ${f}` };
  }

  const destinationNumber = (formData.regionTelefono + formData.numeroTelefono).replace('+','');
  if (!destinationNumber) return { success:false, message:'Número inválido' };

  const fechaHora = new Date().toLocaleString();
  const whatsappMessage = `
CANCELACIÓN DE SOLICITUD

Hola ${formData.nombreFixer}👋
Lamentamos infomarte que ${formData.nombreRequester} canceló su cita con ID: ${formData.idCita}
🔧Título: ${formData.titulo}
Descripción: ${formData.descripcion}
Estado: Cancelada
Fecha y hora: ${fechaHora}
Enlace: ${formData.enlace || 'N/A'}
  `.trim();

  try {
    const response = await fetch(ENDPOINT,{
      method:'POST',
      headers:{ 'Content-Type':'application/json', apikey: EVOLUTION_API_KEY },
      body:JSON.stringify({number:destinationNumber, text:whatsappMessage})
    });
    if (!response.ok) return { success:false, message:`Error ${response.status}` };
    const data = await response.json();
    return { success:true, message:'✅ Mensaje enviado.', data };
  } catch(err) { return { success:false, message:'❌ Error de conexión.', details:String(err) }; }
}

export default function Page() {
  const router = useRouter();
  const [formData,setFormData] = useState<FormData>({
    idCita:'', nombreFixer:'', regionTelefono:'', numeroTelefono:'',
    nombreRequester:'', titulo:'', descripcion:'', enlace:''
  });
  const [isSubmitting,setIsSubmitting] = useState(false);

  const [citas,setCitas] = useState<Array<{id:string; titulo:string; cancelada:boolean}>>([
    { id:'26580', titulo:'Revisión eléctrica', cancelada:false },
    { id:'26581', titulo:'Instalación de router', cancelada:false },
    { id:'26582', titulo:'Mantenimiento de aire', cancelada:false },
    { id:'26583', titulo:'Revisión de gas', cancelada:false },
    { id:'26584', titulo:'Cambio de lámparas', cancelada:false },
    { id:'26585', titulo:'Prueba adicional', cancelada:false }
  ]);

  useEffect(()=>{
    if(typeof window!=='undefined'){
      const saved = localStorage.getItem('citas_canceladas');
      if(saved){
        const idsCanceladas: string[] = JSON.parse(saved);
        setCitas(prev => prev.map(c=>idsCanceladas.includes(c.id)?{...c, cancelada:true}:c));
      }
    }
  },[]);

  const marcarCancelada = (idCita:string)=>{
    setCitas(prev=>{
      const nuevas = prev.map(c=>c.id===idCita?{...c,cancelada:true}:c);
      if(typeof window!=='undefined'){
        const canceladasPrev = localStorage.getItem('citas_canceladas');
        const canceladas: string[] = canceladasPrev ? JSON.parse(canceladasPrev) : [];
        if(!canceladas.includes(idCita)) canceladas.push(idCita);
        localStorage.setItem('citas_canceladas', JSON.stringify(canceladas));
      }
      return nuevas;
    });
  };

  const handleChange = (e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>{
    const {name,value} = e.target;
    // --- 🔒 Bloquear números en los nombres ---
    if ((name === 'nombreFixer' || name === 'nombreRequester') && /\d/.test(value)) return;
    setFormData(prev=>({...prev,[name]:value}));
  };

  const handleCancelarDesdeLista = (idCita:string)=>{
    const cita = citas.find(c=>c.id===idCita);
    if(!cita) return;
    if(cita.cancelada){ 
      alert('⚠️ Se canceló recientemente'); 
      return; 
    }
    setFormData(prev=>({...prev,idCita}));
  };

  const handleSubmit = async (e:React.FormEvent)=>{
    e.preventDefault();
    const camposObligatorios = ['nombreFixer','regionTelefono','numeroTelefono','nombreRequester','titulo','descripcion'];
    for(const c of camposObligatorios){
      if(!formData[c as keyof FormData]?.trim()){ alert('⚠️ Completa todos los campos'); return; }
    }
    if(!formData.idCita){ alert('⚠️ Selecciona una cita'); return; }
    if(citas.find(c=>c.id===formData.idCita)?.cancelada){ alert('🚫 Esta cita ya fue cancelada'); return; }

    const now = Date.now();
    const sendTimes = JSON.parse(localStorage.getItem('citas_tiempos') || '{}');
    const tiemposFixer: number[] = sendTimes[formData.numeroTelefono] || [];
    const recientes = tiemposFixer.filter(t => now - t < 60*1000);
    if(recientes.length >= 3){
      alert('⏳ Límite de 3 notificaciones por minuto alcanzado. Espera 30 segundos.');
      return;
    }
    tiemposFixer.push(now);
    sendTimes[formData.numeroTelefono] = tiemposFixer;
    localStorage.setItem('citas_tiempos', JSON.stringify(sendTimes));

    setIsSubmitting(true);
    const result = await sendWhatsAppMessage(formData);
    setIsSubmitting(false);

    if(result.success){
      alert(result.message);
      marcarCancelada(formData.idCita);
      setFormData({idCita:'', nombreFixer:'', regionTelefono:'', numeroTelefono:'', nombreRequester:'', titulo:'', descripcion:'', enlace:''});
    }else{
      alert(`Fallo: ${result.message}`);
    }
  };

  const handleGoHome = ()=> router.push('/');

  const resetCitas = ()=>{
    setCitas(prev=>prev.map(c=>({...c, cancelada:false})));
    localStorage.removeItem('citas_canceladas');
    localStorage.removeItem('citas_tiempos');
  };

  return(
    <main className="flex min-h-screen p-4 sm:p-8 bg-gray-50">
      <div className="flex w-full max-w-6xl gap-8">
        <aside className="w-72 bg-white shadow rounded-xl p-4 border border-gray-100">
          <h3 className="text-lg font-bold text-indigo-700 mb-3 text-center">Citas disponibles</h3>
          <div className="space-y-3">
            {citas.map(cita=>(
              <div key={cita.id} className="border rounded-lg p-3 flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-800">{cita.titulo}</p>
                  <p className="text-sm text-gray-500">ID: {cita.id}</p>
                </div>
                <button
                  onClick={()=>handleCancelarDesdeLista(cita.id)}
                  disabled={cita.cancelada || isSubmitting}
                  title={cita.cancelada ? 'Se canceló recientemente' : ''}
                  className={`text-sm font-bold py-1 px-3 rounded-lg text-white ${
                    cita.cancelada ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {cita.cancelada?'Cancelada':'Cancelar'}
                </button>
              </div>
            ))}
          </div>
          <button onClick={resetCitas} className="mt-4 w-full py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600">Reactivar Todas (testing)</button>
        </aside>

        <section className="flex-1 bg-white shadow-2xl rounded-xl p-6 border border-gray-100">
          <h2 className="text-3xl font-bold text-center text-indigo-700 mb-6 border-b pb-3">Cancelación de Solicitud</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex gap-2 items-center">
              <label className="font-medium text-gray-700 w-28">ID de Cita:</label>
              <input type="text" name="idCita" value={formData.idCita} readOnly className="flex-1 px-4 py-2 border rounded-lg bg-gray-100 cursor-not-allowed"/>
            </div>
            <fieldset className="border border-indigo-200 p-4 rounded-lg space-y-4">
              <legend className="px-2 text-indigo-600 font-semibold text-lg">Datos del Fixer</legend>
              <input placeholder="Nombre Fixer" name="nombreFixer" value={formData.nombreFixer} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" required/>
              <div className="flex space-x-4">
                <input placeholder="Región +XX" name="regionTelefono" value={formData.regionTelefono} onChange={handleChange} className="w-1/4 px-3 py-2 border rounded-lg text-center" required/>
                <input placeholder="Número" name="numeroTelefono" value={formData.numeroTelefono} onChange={handleChange} className="w-3/4 px-4 py-2 border rounded-lg" required/>
              </div>
            </fieldset>
            <fieldset className="border border-purple-200 p-4 rounded-lg space-y-4">
              <legend className="px-2 text-purple-600 font-semibold text-lg">Datos del Requester y Solicitud</legend>
              <input placeholder="Nombre Requester" name="nombreRequester" value={formData.nombreRequester} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" required/>
              <input placeholder="Título" name="titulo" value={formData.titulo} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg" required/>
              <textarea placeholder="Descripción" name="descripcion" value={formData.descripcion} onChange={handleChange} rows={4} className="w-full px-4 py-2 border rounded-lg" required/>
              <input placeholder="Enlace (URL)" name="enlace" value={formData.enlace} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg"/>
            </fieldset>
            <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-lg">{isSubmitting?'Enviando...':'Enviar Solicitud'}</button>
          </form>
        </section>
      </div>

      <button onClick={handleGoHome} className="fixed bottom-6 right-6 bg-indigo-600 text-white font-bold py-3 px-5 rounded-full shadow-lg hover:bg-indigo-700">Volver a Principal</button>
    </main>
  );
  
}
