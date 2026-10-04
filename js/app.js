import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-functions.js";
// 👇 AGREGAMOS ESTA LÍNEA DE NUBE DE FOTOS:
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";
const firebaseConfig = {
  apiKey: "AIzaSyBJs05is5zZ25rteHveq0ubaXtX1Xw1K_8",
  authDomain: "recetario-le-chique.firebaseapp.com",
  projectId: "recetario-le-chique",
  storageBucket: "recetario-le-chique.firebasestorage.app",
  messagingSenderId: "78526035298",
  appId: "1:78526035298:web:5d52c7422190a47f1fe83b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);
// 👇 ACTIVAMOS EL ALMACENAMIENTO DE FOTOS:
const storage = getStorage(app);

window.recetasDB = []; 
window.recetaActual = null;
window.usuarioActual = null;
window.perfilUsuario = null; 
window.sucursalesConfig = [];
window.alergenosConfig = [];
let blockCounter = 0;
const MESES_LISTA = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

window.sanitizarUnidad = (u) => {
  if (!u) return 'Gr';
  const lower = u.toLowerCase().trim();
  if (['px', 'pax', 'pcx', 'pox', 'persona', 'personas'].includes(lower)) return 'Pax';
  if (['porcion', 'porción', 'porciones', 'trago', 'tragos', 'plato', 'platos'].includes(lower)) return 'Porción';
  if (['g', 'gr', 'gramo', 'gramos'].includes(lower)) return 'Gr';
  if (['kg', 'kilo', 'kilos', 'kilogramo'].includes(lower)) return 'Kg';
  if (['ml', 'mililitro', 'mililitros'].includes(lower)) return 'Ml';
  if (['l', 'lt', 'litro', 'litros'].includes(lower)) return 'L';
  if (['pz', 'pieza', 'piezas', 'unidad', 'unidades'].includes(lower)) return 'Pz';
  if (['cda', 'cucharada', 'cucharadas'].includes(lower)) return 'Cda';
  if (['cdta', 'cucharadita', 'cucharaditas'].includes(lower)) return 'Cdta';
  if (['pizca', 'pizcas'].includes(lower)) return 'Pizca';
  if (['manojo', 'manojos'].includes(lower)) return 'Manojo';
  return 'Gr'; 
};

window.onload = async () => { generarCheckboxes('contenedor-temporada', MESES_LISTA, 'mes'); };

onAuthStateChanged(auth, async (user) => {
  if (user) {
    let perfil = { rol: 'No Autorizado', sucursal: 'Ninguna', estado: 'Pendiente' };
    
    if (user.email.toLowerCase() === 'miguellugo@mlcocina.com') {
      perfil = { rol: 'SuperAdmin', sucursal: 'TODAS', estado: 'Activo' };
      try { await setDoc(doc(db, 'usuarios', user.email.toLowerCase()), perfil, {merge: true}); } catch(e){}
    } else {
      try {
        const docRef = doc(db, 'usuarios', user.email.toLowerCase());
        const snap = await getDoc(docRef);
        if (snap.exists()){
          perfil = snap.data();
          if (perfil.estado === 'Pendiente') { await signOut(auth); return; }
        } else { await signOut(auth); return; }
      } catch(e) { console.error(e); await signOut(auth); return; }
    }
    
    window.usuarioActual = user; 
    window.perfilUsuario = perfil;
    
    document.getElementById('vista-login').classList.add('hidden');
    document.getElementById('app-principal').classList.remove('hidden');
    document.getElementById('user-email-display').innerText = user.email;
    document.getElementById('user-ceco-display').innerText = perfil.sucursal;
    document.getElementById('user-role-display').innerText = perfil.rol;
    
    if (perfil.rol === 'SuperAdmin') {
      document.getElementById('tab-editor').classList.remove('hidden');
      document.getElementById('tab-admin').classList.remove('hidden');
      document.getElementById('selector-editor').classList.remove('hidden');
    } else if (perfil.rol === 'Editor') {
      document.getElementById('tab-editor').classList.remove('hidden');
      document.getElementById('tab-admin').classList.add('hidden');
      document.getElementById('selector-editor').classList.add('hidden');
    } else {
      document.getElementById('tab-editor').classList.add('hidden');
      document.getElementById('tab-admin').classList.add('hidden');
    }

    try { await window.cargarConfiguracionBD(); } catch(e) { console.error(e); }
    if (perfil.rol === 'SuperAdmin') { try { await window.cargarUsuariosBD(); } catch(e) { console.error(e); } }
    try {
        await window.obtenerRecetasDeFirebase();
        if (document.getElementById('contenedor-bloques-editor').children.length === 0) window.agregarBloqueSubreceta();
    } catch(e) { console.error(e); }
    
    window.cambiarPestaña('visor');
  } else {
    window.usuarioActual = null; 
    window.perfilUsuario = null;
    document.getElementById('vista-login').classList.remove('hidden');
    document.getElementById('app-principal').classList.add('hidden');
  }
});

window.toggleRegistro = (isRegistro) => {
  document.getElementById('login-error').classList.add('hidden');
  if(isRegistro){
    document.getElementById('login-title').innerText = "Solicitar Acceso";
    document.getElementById('login-subtitle').innerText = "Llena tus datos para revisión corporativa";
    document.getElementById('box-btn-iniciar').classList.add('hidden');
    document.getElementById('box-btn-registrar').classList.remove('hidden');
    document.getElementById('box-campos-registro').classList.remove('hidden');
  }else{
    document.getElementById('login-title').innerText = "Acceso Restringido";
    document.getElementById('login-subtitle').innerText = "Inicia sesión con tu cuenta corporativa";
    document.getElementById('box-btn-iniciar').classList.remove('hidden');
    document.getElementById('box-btn-registrar').classList.add('hidden');
    document.getElementById('box-campos-registro').classList.add('hidden');
  }
};

window.iniciarSesion = async () => {
  const e = document.getElementById('login-email').value;
  const p = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.classList.replace('text-green-600', 'text-rose-600');
  try { 
    await signInWithEmailAndPassword(auth, e, p); 
    err.classList.add('hidden'); 
  } catch (error) { 
    err.innerText = "Credenciales incorrectas."; 
    err.classList.remove('hidden'); 
  }
};

window.registrarCuenta = async () => {
  const e = document.getElementById('login-email').value.trim().toLowerCase();
  const p = document.getElementById('login-password').value;
  const nombreUsuario = document.getElementById('reg-nombre').value.trim();
  const puestoUsuario = document.getElementById('reg-puesto').value.trim();
  const sucursalUsuario = document.getElementById('reg-sucursal').value.trim();
  const err = document.getElementById('login-error');

  if(!nombreUsuario || !puestoUsuario || !sucursalUsuario) { 
    err.innerText = "Llena todos los campos."; 
    err.classList.replace('text-green-600', 'text-rose-600'); 
    err.classList.remove('hidden'); 
    return; 
  }
  if(p.length < 6) { 
    err.innerText = "Contraseña min. 6 caracteres"; 
    err.classList.replace('text-green-600', 'text-rose-600'); 
    err.classList.remove('hidden'); 
    return; 
  }

  err.innerText = "Procesando..."; 
  err.classList.replace('text-rose-600', 'text-zinc-500'); 
  err.classList.remove('hidden');
  
  try { 
    await createUserWithEmailAndPassword(auth, e, p); 
    
    try { 
      await setDoc(doc(db, 'usuarios', e), { 
        email: e, 
        nombre: nombreUsuario, 
        puesto: puestoUsuario, 
        rol: 'Lector', 
        sucursal: sucursalUsuario, 
        estado: 'Pendiente' 
      }); 
    } catch(docError) { console.log("Error creando documento Firestore:", docError); }
    
    const notificarTelegramBackend = httpsCallable(functions, 'notificarTelegram');
    await notificarTelegramBackend({ 
      nombre: nombreUsuario, 
      puesto: puestoUsuario, 
      sucursal: sucursalUsuario, 
      email: e 
    }).catch(err => console.log("Notificación ignorada:", err));

    await signOut(auth);

    err.innerText = "¡Solicitud enviada! Espera aprobación."; 
    err.classList.replace('text-zinc-500', 'text-green-600');
    document.getElementById('login-email').value = ''; 
    document.getElementById('login-password').value = ''; 
    document.getElementById('reg-nombre').value = ''; 
    document.getElementById('reg-puesto').value = ''; 
    document.getElementById('reg-sucursal').value = '';
  } catch (error) { 
    console.error("Error en registro:", error);
    if(error.code === 'auth/email-already-in-use') {
      err.innerText = "Este correo ya fue registrado previamente.";
    } else {
      err.innerText = "Error o correo registrado.";
    }
    err.classList.replace('text-zinc-500', 'text-rose-600'); 
  }
};

window.cerrarSesion = () => { signOut(auth); };

window.cargarConfiguracionBD = async () => {
  const docRefSucursales = doc(db, 'configuracion', 'sucursales');
  const snapSuc = await getDoc(docRefSucursales);
  if(snapSuc.exists()) { window.sucursalesConfig = snapSuc.data().lista || []; } else { window.sucursalesConfig = ['Le Chique', 'Xuna', 'Texas', 'NY']; await setDoc(docRefSucursales, { lista: window.sucursalesConfig }); }
  
  let optionsHtml = '<option value="Global">Global (Compartida)</option>';
  let optionsHtmlFiltro = '<option value="TODAS">Todas</option>';
  window.sucursalesConfig.forEach(s => { 
    optionsHtml += `<option value="${s}">${s}</option>`; 
    optionsHtmlFiltro += `<option value="${s}">${s}</option>`; 
  });
  document.getElementById('edit-sucursal').innerHTML = optionsHtml;
  if(document.getElementById('filtro-sucursal-visor')) document.getElementById('filtro-sucursal-visor').innerHTML = optionsHtmlFiltro;
  window.renderizarListaSucursalesAdmin();

  const docRefAlergenos = doc(db, 'configuracion', 'alergenos');
  const snapAler = await getDoc(docRefAlergenos);
  if(snapAler.exists()) { window.alergenosConfig = snapAler.data().lista || []; } else { window.alergenosConfig = ["Gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Lácteos", "Frutos de cáscara", "Apio", "Mostaza", "Sésamo", "Sulfitos", "Altramuces", "Moluscos"]; await setDoc(docRefAlergenos, { lista: window.alergenosConfig }); }
  generarCheckboxes('contenedor-alergenos', window.alergenosConfig, 'alergeno');
  window.renderizarListaAlergenosAdmin();
};

window.renderizarListaSucursalesAdmin = () => {
  const ul = document.getElementById('lista-sucursales-admin');
  if(!ul) return;
  ul.innerHTML = window.sucursalesConfig.map(s => `<li class="flex justify-between items-center bg-zinc-50 p-2 border border-zinc-100 rounded-sm text-xs font-bold text-zinc-700 uppercase">${s} <button onclick="adminBorrarSucursal('${s}')" class="text-rose-600 hover:bg-rose-100 px-2 py-1 rounded">X</button></li>`).join('');
};

window.adminGuardarSucursal = async () => {
  const n = document.getElementById('admin-new-sucursal').value.trim();
  if(!n || window.sucursalesConfig.includes(n)) return;
  window.sucursalesConfig.push(n); await setDoc(doc(db, 'configuracion', 'sucursales'), { lista: window.sucursalesConfig });
  document.getElementById('admin-new-sucursal').value = ''; await window.cargarConfiguracionBD(); await window.cargarUsuariosBD(); 
};

window.adminBorrarSucursal = async (nombre) => {
  if(!confirm(`¿Borrar sucursal ${nombre}?`)) return;
  window.sucursalesConfig = window.sucursalesConfig.filter(s => s !== nombre); await setDoc(doc(db, 'configuracion', 'sucursales'), { lista: window.sucursalesConfig });
  await window.cargarConfiguracionBD(); await window.cargarUsuariosBD();
};

window.renderizarListaAlergenosAdmin = () => {
  const ul = document.getElementById('lista-alergenos-admin');
  if(!ul) return;
  ul.innerHTML = window.alergenosConfig.map(a => `<li class="flex justify-between items-center bg-zinc-50 p-2 border border-zinc-100 rounded-sm text-[10px] font-bold text-zinc-700 uppercase">${a} <button onclick="adminBorrarAlergeno('${a}')" class="text-rose-600 hover:bg-rose-100 px-2 py-1 rounded">X</button></li>`).join('');
};

window.adminGuardarAlergeno = async () => {
  const n = document.getElementById('admin-new-alergeno').value.trim();
  if(!n) return;
  const nombreAlergeno = n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  if(window.alergenosConfig.includes(nombreAlergeno)) return;
  window.alergenosConfig.push(nombreAlergeno); window.alergenosConfig.sort(); 
  await setDoc(doc(db, 'configuracion', 'alergenos'), { lista: window.alergenosConfig });
  document.getElementById('admin-new-alergeno').value = ''; await window.cargarConfiguracionBD();
};

window.adminBorrarAlergeno = async (nombre) => {
  if(!confirm(`¿Borrar alérgeno: ${nombre}?`)) return;
  window.alergenosConfig = window.alergenosConfig.filter(a => a !== nombre); await setDoc(doc(db, 'configuracion', 'alergenos'), { lista: window.alergenosConfig });
  await window.cargarConfiguracionBD();
};

window.cargarUsuariosBD = async () => {
  try {
    const snap = await getDocs(collection(db, 'usuarios'));
    const ulPendientes = document.getElementById('lista-pendientes-admin');
    const ulAutorizados = document.getElementById('lista-usuarios-admin');
    const msjError = document.getElementById('mensaje-error-admin');
    msjError.classList.add('hidden');
    
    let htmlPendientes = ''; let htmlAutorizados = '';
    let opcionesSucursalAdmin = '<option value="TODAS">TODAS (Global)</option>';
    window.sucursalesConfig.forEach(s => opcionesSucursalAdmin += `<option value="${s}">${s}</option>`);

    snap.forEach(documento => {
      const d = documento.data();
      if (!d || !d.email) return; 
      const idSeguro = String(d.email).replace(/[^a-zA-Z0-9]/g, '');
      
      if(d.estado === 'Pendiente') {
        const infoExtra = d.nombre ? `<div class="text-[10px] font-normal text-zinc-500 mt-1">👤 ${d.nombre} - ${d.puesto} (De: ${d.sucursal})</div>` : '';
        htmlPendientes += `<li class="bg-zinc-50 p-3 border border-zinc-200 rounded-sm shadow-sm"><div class="font-bold text-zinc-800 text-xs mb-3">${d.email}${infoExtra}</div><div class="flex gap-2 mb-3"><select id="rol-${idSeguro}" class="flex-1 p-1 border border-zinc-300 rounded-sm text-[10px] uppercase font-bold text-zinc-700 outline-none bg-white"><option value="Lector">Lector (Solo PDF)</option><option value="Editor">Admin Editor (Crea)</option></select><select id="ceco-${idSeguro}" class="flex-1 p-1 border border-zinc-300 rounded-sm text-[10px] uppercase font-bold text-zinc-700 outline-none bg-white">${opcionesSucursalAdmin}</select></div><div class="flex gap-2"><button onclick="adminAprobarUsuario('${d.email}', '${idSeguro}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-[10px] tracking-widest font-bold uppercase py-2 rounded-sm transition">Aprobar</button><button onclick="adminRechazarUsuario('${d.email}')" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] tracking-widest font-bold uppercase py-2 rounded-sm transition">Rechazar</button></div></li>`;
      } else {
        const infoExtraAuth = d.nombre ? `<span class="block text-[9px] font-normal text-zinc-400 mt-0.5">${d.nombre} - ${d.puesto}</span>` : '';
        let opcionesCecoAuth = `<option value="TODAS" ${d.sucursal === 'TODAS' ? 'selected' : ''}>TODAS (Global)</option>`;
        window.sucursalesConfig.forEach(s => { opcionesCecoAuth += `<option value="${s}" ${d.sucursal === s ? 'selected' : ''}>${s}</option>`; });
        htmlAutorizados += `<li class="bg-zinc-50 p-3 border border-zinc-200 rounded-sm shadow-sm mb-2"><div class="flex justify-between items-start mb-3"><div><strong class="text-zinc-800 text-xs">${d.email}</strong>${infoExtraAuth}</div><button onclick="adminBorrarUsuario('${d.email}')" class="text-rose-600 text-[10px] font-bold hover:underline">Revocar Acceso</button></div><div class="flex gap-2 mb-3"><select id="rol-auth-${idSeguro}" class="flex-1 p-1 border border-zinc-300 rounded-sm text-[10px] uppercase font-bold text-zinc-700 outline-none bg-white"><option value="Lector" ${d.rol === 'Lector' ? 'selected' : ''}>Lector (Solo PDF)</option><option value="Editor" ${d.rol === 'Editor' ? 'selected' : ''}>Admin Editor (Crea)</option></select><select id="ceco-auth-${idSeguro}" class="flex-1 p-1 border border-zinc-300 rounded-sm text-[10px] uppercase font-bold text-zinc-700 outline-none bg-white">${opcionesCecoAuth}</select></div><button onclick="adminActualizarUsuario('${d.email}', '${idSeguro}')" class="w-full bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-[10px] tracking-widest font-bold uppercase py-1.5 rounded-sm transition">Guardar Cambios</button></li>`;
      }
    });
    
    ulPendientes.innerHTML = htmlPendientes || '<li class="text-[10px] text-zinc-400 uppercase tracking-widest p-2 border border-dashed border-zinc-200 text-center rounded-sm">No hay solicitudes pendientes</li>';
    ulAutorizados.innerHTML = htmlAutorizados || '<li class="text-[10px] text-zinc-400 uppercase tracking-widest p-2 border border-dashed border-zinc-200 text-center rounded-sm">Ningún usuario autorizado</li>';
    
  } catch (errorLog) {
    console.error("Fallo Firebase:", errorLog);
    document.getElementById('mensaje-error-admin').innerText = "Error leyendo datos.";
    document.getElementById('mensaje-error-admin').classList.remove('hidden');
  }
};

window.adminAprobarUsuario = async (email, idSeguro) => { await setDoc(doc(db, 'usuarios', email), { email, rol: document.getElementById(`rol-${idSeguro}`).value, sucursal: document.getElementById(`ceco-${idSeguro}`).value, estado: 'Activo' }, { merge: true }); await window.cargarUsuariosBD(); };
window.adminActualizarUsuario = async (email, idSeguro) => { try { await setDoc(doc(db, 'usuarios', email), { email, rol: document.getElementById(`rol-auth-${idSeguro}`).value, sucursal: document.getElementById(`ceco-auth-${idSeguro}`).value, estado: 'Activo' }, { merge: true }); alert(`Permisos actualizados para ${email}`); await window.cargarUsuariosBD(); } catch(e) { alert("Error al actualizar"); } };
window.adminRechazarUsuario = async (email) => { if(!confirm(`¿Rechazar solicitud de ${email}?`)) return; await deleteDoc(doc(db, 'usuarios', email)); await window.cargarUsuariosBD(); };
window.adminBorrarUsuario = async (email) => { if(!confirm(`¿Revocar acceso definitivo a ${email}?`)) return; await deleteDoc(doc(db, 'usuarios', email)); await window.cargarUsuariosBD(); };

window.obtenerRecetasDeFirebase = async () => {
  if(!window.perfilUsuario) return;
  const selectEditor = document.getElementById('selector-editor');
  const selectImportar = document.getElementById('selector-importar-base');
  try {
    const querySnapshot = await getDocs(collection(db, "recetas")); window.recetasDB = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data(); if (!data.nombre) data.nombre = 'Receta sin nombre'; if (!data.id) data.id = doc.id;
      const recSucursal = data.sucursal || 'Le Chique';
      if (window.perfilUsuario.rol === "SuperAdmin" || window.perfilUsuario.sucursal === "TODAS" || recSucursal === "Global" || recSucursal === window.perfilUsuario.sucursal) { window.recetasDB.push(data); }
    });
    
    if(selectEditor) selectEditor.innerHTML = '<option value="">+ CREAR NUEVA RECETA</option>';
    if(selectImportar) selectImportar.innerHTML = '<option value="">-- Selecciona receta base --</option>';
    
    window.recetasDB.sort((a, b) => { return (a.nombre ? String(a.nombre) : '').localeCompare(b.nombre ? String(b.nombre) : ''); });
    
    window.recetasDB.forEach(receta => { 
      if(selectEditor) selectEditor.innerHTML += `<option value="${receta.id}">Editar: ${receta.nombre}</option>`; 
      if(selectImportar) selectImportar.innerHTML += `<option value="${receta.id}">${receta.nombre} (${receta.rendimiento_base} ${receta.unidad_base})</option>`; 
    });
    
    window.aplicarFiltrosVisor();
    window.renderizarListaRecetas();
  } catch (error) { 
    console.error("Error BD:", error);
    document.getElementById('selector-receta').innerHTML = `<option value="">❌ Error al cargar recetas</option>`; 
  }
};

window.aplicarFiltrosVisor = () => {
  const suc = document.getElementById('filtro-sucursal-visor').value;
  const part = document.getElementById('filtro-partida-visor').value;
  const selectVisor = document.getElementById('selector-receta');
  selectVisor.innerHTML = '<option value="">-- Selecciona una receta --</option>';

  let filtradas = window.recetasDB;
  if (suc !== 'TODAS') filtradas = filtradas.filter(r => (r.sucursal || 'Le Chique') === suc);
  if (part !== 'TODAS') filtradas = filtradas.filter(r => (r.partida || '') === part);

  filtradas.forEach(receta => {
    selectVisor.innerHTML += `<option value="${receta.id}">${receta.nombre}</option>`;
  });
  
  document.getElementById('contenido-receta').classList.add('hidden'); 
  document.getElementById('visor-ceco').classList.add('hidden');
  window.recetaActual = null;
};

window.filtrarRecetas = () => { window.renderizarListaRecetas(document.getElementById('input-buscador').value); };

window.guardarReceta = async () => {
  const nombre = document.getElementById('edit-nombre').value.trim();
  const rendimiento_base = parseFloat(document.getElementById('edit-pax-base').value);
  if (!nombre || !rendimiento_base || isNaN(rendimiento_base)) return window.mostrarMensaje("Falta Nombre o Rendimiento.", "text-rose-900");
  
  const bloques = [];
  document.querySelectorAll('.bloque-receta').forEach(b => {
    const ingredientes = [];
    b.querySelectorAll('.fila-ingrediente').forEach(fila => {
      const ingNombre = fila.querySelector('.ing-nombre').value.trim();
      const ingCant = parseFloat(fila.querySelector('.ing-cant').value);
      if (ingNombre && !isNaN(ingCant)) ingredientes.push({ nombre: ingNombre, cantidad: ingCant, unidad: fila.querySelector('.ing-unidad').value.trim() });
    });
    bloques.push({ nombre: b.querySelector('.b-nombre').value.trim() || "Preparación Base", rendimiento: parseFloat(b.querySelector('.b-rend').value) || rendimiento_base, unidad: b.querySelector('.b-uni').value.trim() || document.getElementById('edit-unidad-base').value.trim(), ingredientes, procedimiento: b.querySelector('.b-proc').value.trim() });
  });
  
  let id = document.getElementById('selector-editor').value;
  if (!id || (window.perfilUsuario && window.perfilUsuario.rol === 'Editor')) id = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);
  
  const f = new Date(); const fechaStr = `${f.getDate().toString().padStart(2, '0')}/${(f.getMonth()+1).toString().padStart(2, '0')}/${f.getFullYear()} ${f.getHours().toString().padStart(2, '0')}:${f.getMinutes().toString().padStart(2, '0')}`;
  const datos = { id, nombre, rendimiento_base, unidad_base: document.getElementById('edit-unidad-base').value.trim(), sucursal: document.getElementById('edit-sucursal').value, partida: document.getElementById('edit-partida').value.trim(), tipo: document.getElementById('edit-tipo').value.trim(), alergenos: Array.from(document.querySelectorAll('.chk-alergeno:checked')).map(cb => cb.value), temporada: Array.from(document.querySelectorAll('.chk-mes:checked')).map(cb => cb.value), bloques, auditoria: { modificado_por: (window.usuarioActual && window.usuarioActual.email) ? window.usuarioActual.email : "Admin", fecha: fechaStr }};
  
  document.getElementById('loader-guardar').style.display = 'block';
  try { await setDoc(doc(db, "recetas", id), datos); window.mostrarMensaje("✅ Receta guardada", "text-green-600"); document.getElementById('loader-guardar').style.display = 'none'; await window.obtenerRecetasDeFirebase(); window.limpiarEditor(); } catch (error) { window.mostrarMensaje("❌ Error al guardar.", "text-rose-900"); document.getElementById('loader-guardar').style.display = 'none'; }
};

window.rendimientosDeseados = {};

window.cargarRecetaSeleccionada = () => {
  window.recetaActual = window.recetasDB.find(r => r.id === document.getElementById('selector-receta').value);
  window.rendimientosDeseados = {}; 
  if (window.recetaActual) {
    document.getElementById('contenido-receta').classList.remove('hidden');
    document.getElementById('titulo-receta').innerText = window.recetaActual.nombre;
    document.title = window.recetaActual.nombre; 
    const pillCeco = document.getElementById('visor-ceco'); pillCeco.classList.remove('hidden'); pillCeco.innerText = window.recetaActual.sucursal || 'Le Chique';
    document.getElementById('input-pax').value = window.recetaActual.rendimiento_base; document.getElementById('display-pax').innerText = window.recetaActual.rendimiento_base.toLocaleString('en-US'); document.getElementById('display-unidad-input').value = window.sanitizarUnidad(window.recetaActual.unidad_base); document.getElementById('display-unidad').innerText = window.sanitizarUnidad(window.recetaActual.unidad_base);
    document.getElementById('visor-partida').innerText = window.recetaActual.partida || "---"; document.getElementById('visor-tipo').innerText = window.recetaActual.tipo || "---";
    document.getElementById('visor-alergenos').innerHTML = (window.recetaActual.alergenos || []).map(a => `<span class="pill pill-alergeno">${a}</span>`).join('') || "-"; document.getElementById('visor-temporada').innerHTML = (window.recetaActual.temporada || []).map(t => `<span class="pill">${t}</span>`).join('') || "TODO EL AÑO";
    document.getElementById('visor-auditoria').innerText = (window.recetaActual.auditoria && window.recetaActual.auditoria.modificado_por) ? `${window.recetaActual.auditoria.modificado_por} (${window.recetaActual.auditoria.fecha})` : "Sistema Antiguo";
    window.renderizarBloquesVisor(window.recetaActual.rendimiento_base);
  } else { 
    document.getElementById('contenido-receta').classList.add('hidden'); document.getElementById('visor-ceco').classList.add('hidden'); 
    document.title = "Recetario Corporate - Le Chique"; 
  }
};

window.recalcularPax = () => { 
  if (!window.recetaActual) return; 
  const pax = parseFloat(document.getElementById('input-pax').value) || 0.1; 
  document.getElementById('display-pax').innerText = pax.toLocaleString('en-US'); 
  window.rendimientosDeseados = {}; 
  window.renderizarBloquesVisor(pax); 
};

window.modificarRendimientoBloque = (index, valor) => {
  let val = parseFloat(valor);
  if (isNaN(val) || val <= 0) val = 1;
  window.rendimientosDeseados[index] = val; 
  const paxGlobal = parseFloat(document.getElementById('input-pax').value) || window.recetaActual.rendimiento_base;
  window.renderizarBloquesVisor(paxGlobal); 
};

window.renderizarBloquesVisor = (paxDeseado) => {
  const contenedor = document.getElementById('contenedor-bloques-visor'); 
  contenedor.innerHTML = '';
  
  const rendGlobal = parseFloat(window.recetaActual.rendimiento_base) || 1;
  const factorGlobal = paxDeseado / rendGlobal;

  (window.recetaActual.bloques || []).forEach((bloque, index) => {
    const rendBloqueOriginal = parseFloat(bloque.rendimiento) || 1;
    
    let rendCalculado = rendBloqueOriginal * factorGlobal;

    if (window.rendimientosDeseados[index] !== undefined) {
        rendCalculado = window.rendimientosDeseados[index];
    }

    const factorBloque = rendCalculado / rendBloqueOriginal;
    let rendInputVal = Number(rendCalculado.toFixed(3)); 

    let sumaTotal = 0; let liq = 0; let sol = 0;
    
    let tablaIng = (bloque.ingredientes || []).map(ing => {
      const ingU = window.sanitizarUnidad(ing.unidad).toLowerCase(); 
      let c = ing.cantidad * factorBloque;
      if (ingU === 'kg' || ingU === 'l') sumaTotal += c * 1000; else sumaTotal += c;
      if (ingU === 'ml' || ingU === 'l') liq++; else if (ingU === 'gr' || ingU === 'kg') sol++;
      const fmt = window.formatearCantidadInteligente(c, window.sanitizarUnidad(ing.unidad));
      return `<tr class="border-b border-zinc-100 break-inside-avoid"><td class="py-1 text-zinc-900 tabular-nums font-semibold text-xs w-[35%] align-top">${fmt.cantidad} <span class="text-[9px] text-zinc-400 font-normal uppercase">${fmt.unidad}</span></td><td class="py-1 text-zinc-700 uppercase tracking-wide text-[10px] font-semibold w-[65%] align-top">${ing.nombre}</td></tr>`;
    }).join('');
    
    const totFmt = window.formatearCantidadInteligente(sumaTotal, (liq > sol) ? 'ml' : 'gr');
    tablaIng += `<tr class="border-t-2 border-zinc-300 bg-zinc-50/50 break-inside-avoid"><td class="py-1.5 text-rose-900 tabular-nums font-bold text-xs w-[35%] align-top">${totFmt.cantidad} <span class="text-[9px] text-rose-900/60 uppercase">${totFmt.unidad}</span></td><td class="py-1.5 text-zinc-900 uppercase tracking-widest text-[9px] font-black w-[65%] align-top">PESO ESTIMADO</td></tr>`;
    
    contenedor.innerHTML += `
    <div class="mb-6 break-inside-avoid border border-zinc-200 bg-white rounded-sm shadow-sm overflow-hidden">
        <div class="flex flex-wrap justify-between items-center bg-zinc-50 border-b border-zinc-200 px-4 py-3 gap-2">
            <h3 class="text-zinc-900 text-xs font-black uppercase tracking-widest flex-1">${bloque.nombre}</h3>
            
            <div class="ocultar-en-pdf flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-sm border border-zinc-300 shadow-sm">
                <label class="text-[9px] uppercase tracking-widest text-rose-900 font-bold">Preparar:</label>
                <input type="number" value="${rendInputVal}" step="any" onchange="modificarRendimientoBloque(${index}, this.value)" class="w-16 p-1 text-sm text-center border-b-2 border-zinc-200 font-black tabular-nums text-zinc-800 outline-none focus:border-rose-900 transition bg-transparent">
                <span class="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">${window.sanitizarUnidad(bloque.unidad)}</span>
            </div>

            <div class="solo-pdf text-[10px] font-black text-rose-900 uppercase tracking-widest hidden">
                Rendimiento: ${rendInputVal} ${window.sanitizarUnidad(bloque.unidad)}
            </div>
        </div>
        
        <div class="flex flex-col md:flex-row p-4 gap-6">
            <div class="md:w-[45%]"><table class="w-full text-left table-fixed"><tbody>${tablaIng}</tbody></table></div>
            <div class="md:w-[55%] bg-zinc-50/50 p-4 rounded-sm border border-zinc-100 text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed shadow-inner">${bloque.procedimiento}</div>
        </div>
    </div>`;
  });
};

window.descargarPDF = () => {
  if (!window.recetaActual) return alert("Selecciona una receta.");
  const tituloOriginal = document.title;
  document.title = window.recetaActual.nombre.replace(/\s+/g, '_');
  window.print();
  setTimeout(() => { document.title = tituloOriginal; }, 1000);
};

window.renderizarListaRecetas = (textoFiltro = '') => {
  const t = document.getElementById('tabla-todas-recetas'); const filtro = textoFiltro.toLowerCase();
  const filtradas = window.recetasDB.filter(r => (r.nombre ? String(r.nombre).toLowerCase() : '').includes(filtro) || (r.partida ? String(r.partida).toLowerCase() : '').includes(filtro) || (r.sucursal ? String(r.sucursal).toLowerCase() : '').includes(filtro));
  if(window.perfilUsuario && window.perfilUsuario.rol === 'SuperAdmin') { document.getElementById('col-acciones').classList.remove('hidden'); } else { document.getElementById('col-acciones').classList.add('hidden'); }
  
  t.innerHTML = filtradas.map(r => {
    let accionesHtml = (window.perfilUsuario && window.perfilUsuario.rol === 'SuperAdmin') ? `<td class="p-4 text-center space-x-2 whitespace-nowrap"><button onclick="event.stopPropagation(); editarReceta('${r.id}')" class="border border-zinc-300 text-zinc-600 hover:bg-zinc-100 font-bold px-3 py-1.5 rounded-sm text-[10px] uppercase tracking-widest transition">Editar</button><button onclick="event.stopPropagation(); eliminarReceta('${r.id}')" class="border border-rose-200 text-rose-900 hover:bg-rose-50 font-bold px-3 py-1.5 rounded-sm text-[10px] uppercase tracking-widest transition">Borrar</button></td>` : '';
    let fechaStr = (r.auditoria && r.auditoria.fecha) ? String(r.auditoria.fecha).split(' ')[0] : '---';
    return `<tr class="border-b border-zinc-100 hover:bg-zinc-50 transition cursor-pointer" onclick="document.getElementById('selector-receta').value = '${r.id}'; cargarRecetaSeleccionada(); cambiarPestaña('visor');"><td class="p-4 font-bold text-zinc-800">${r.nombre}</td><td class="p-4"><span class="pill pill-ceco">${r.sucursal || 'Le Chique'}</span></td><td class="p-4 text-zinc-500 uppercase tracking-wider text-[10px] font-bold">${r.partida || '---'}</td><td class="p-4 text-zinc-600 uppercase tracking-wider text-[10px] font-semibold">${fechaStr}</td>${accionesHtml}</tr>`
  }).join('') || `<tr><td colspan="${(window.perfilUsuario && window.perfilUsuario.rol === 'SuperAdmin') ? 5 : 4}" class="p-8 text-center text-zinc-400 text-sm tracking-wide uppercase">No hay recetas</td></tr>`;
};

window.editarReceta = (id) => { document.getElementById('selector-editor').value = id; window.cargarEnEditor(); window.cambiarPestaña('editor'); };

window.cargarEnEditor = () => {
  const id = document.getElementById('selector-editor').value; window.limpiarFormularioBase();
  if (id) {
    const r = window.recetasDB.find(x => x.id === id);
    document.getElementById('edit-nombre').value = r.nombre; 
    document.getElementById('edit-pax-base').value = r.rendimiento_base; 
    document.getElementById('edit-unidad-base').value = window.sanitizarUnidad(r.unidad_base); 
    document.getElementById('edit-partida').value = r.partida || ''; 
    document.getElementById('edit-tipo').value = r.tipo || ''; 
    document.getElementById('edit-sucursal').value = r.sucursal || 'Le Chique';
    
    document.querySelectorAll('.chk-alergeno').forEach(cb => cb.checked = (r.alergenos || []).includes(cb.value)); 
    document.querySelectorAll('.chk-mes').forEach(cb => cb.checked = (r.temporada || []).includes(cb.value));
    
    if(r.bloques && r.bloques.length > 0) { r.bloques.forEach(b => window.agregarBloqueSubreceta(b.nombre, b.rendimiento, b.unidad, b.procedimiento, b.ingredientes)); } else { window.agregarBloqueSubreceta('Base', r.rendimiento_base, r.unidad_base, r.procedimiento, r.ingredientes); }
  } else { window.agregarBloqueSubreceta(); }
};

window.limpiarFormularioBase = () => { 
  document.getElementById('edit-nombre').value = ''; 
  document.getElementById('edit-pax-base').value = '1'; 
  document.getElementById('edit-unidad-base').value = 'Kg'; 
  document.getElementById('edit-partida').value = ''; 
  document.getElementById('edit-tipo').value = ''; 
  document.getElementById('edit-sucursal').value = (window.perfilUsuario && window.perfilUsuario.sucursal === 'TODAS') ? 'Global' : ((window.perfilUsuario && window.perfilUsuario.sucursal) || 'Le Chique'); 
  document.querySelectorAll('.chk-alergeno, .chk-mes').forEach(cb => cb.checked = false); 
  document.getElementById('contenedor-bloques-editor').innerHTML = ''; 
};

window.limpiarEditor = () => { if(document.getElementById('selector-editor')) document.getElementById('selector-editor').value = ''; window.limpiarFormularioBase(); window.agregarBloqueSubreceta(); };

window.eliminarReceta = async (id) => { event.stopPropagation(); if (!confirm("¿Eliminar receta permanentemente?")) return; try { await deleteDoc(doc(db, "recetas", id)); await window.obtenerRecetasDeFirebase(); window.limpiarEditor(); } catch (e) { alert("Error al borrar."); } };

window.mostrarMensaje = (texto, claseColor) => { const span = document.getElementById('mensaje-estado'); span.innerText = texto; span.className = `text-sm font-bold ${claseColor}`; setTimeout(() => span.innerText = "", 5000); };

function generarCheckboxes(containerId, items, namePrefix) {
  const container = document.getElementById(containerId); if(!container) return;
  container.innerHTML = items.map(item => `<label class="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-sm border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition"><input type="checkbox" value="${item}" class="chk-${namePrefix} w-3.5 h-3.5 accent-rose-900"><span class="text-[11px] uppercase tracking-wide font-semibold text-zinc-600">${item}</span></label>`).join('');
}

window.formatearCantidadInteligente = (cantidad, unidad) => {
  let cant = parseFloat(cantidad); let uni = (unidad || '').trim().toLowerCase();
  if ((uni === 'gr' || uni === 'g') && cant >= 1000) { cant = cant / 1000; uni = 'kg'; } else if (uni === 'ml' && cant >= 1000) { cant = cant / 1000; uni = 'l'; }
  return { cantidad: cant.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 }), unidad: uni.toUpperCase() };
};

window.abrirModalImportarBase = () => { document.getElementById('modal-importar').classList.remove('hidden'); };
window.cerrarModalImportar = () => { document.getElementById('modal-importar').classList.add('hidden'); document.getElementById('selector-importar-base').value = ''; };

window.confirmarImportacionBase = () => {
  const id = document.getElementById('selector-importar-base').value; if (!id) return alert("Selecciona una receta.");
  const rb = window.recetasDB.find(r => r.id === id);
  if (rb && rb.bloques) { rb.bloques.forEach(b => window.agregarBloqueSubreceta(b.nombre === 'Preparación Base' ? rb.nombre : b.nombre, b.rendimiento, window.sanitizarUnidad(b.unidad), b.procedimiento, b.ingredientes)); window.mostrarMensaje("✅ Base importada", "text-green-600"); }
  window.cerrarModalImportar();
};

window.agregarBloqueSubreceta = (nombre = '', rend = '', uni = '', proc = '', ingredientes = []) => {
  const bId = `bloque-${blockCounter++}`; const div = document.createElement('div'); div.className = 'bloque-receta bg-white border border-zinc-200 rounded-sm p-5 relative shadow-sm'; div.id = bId;
  
  const unidadLimpia = uni ? window.sanitizarUnidad(uni) : 'Kg';
  const opcionesUni = ['Kg', 'Gr', 'L', 'Ml', 'Pax', 'Porción', 'Pz'].map(u => `<option value="${u}" ${u === unidadLimpia ? 'selected' : ''}>${u}</option>`).join('');

  div.innerHTML = `<button onclick="this.parentElement.remove()" class="absolute top-3 right-3 text-zinc-400 hover:text-rose-900 text-xs font-bold tracking-widest uppercase transition">✕ Quitar</button><div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pr-16"><div><label class="text-[9px] uppercase tracking-widest font-bold text-zinc-400 block mb-1">Nombre Sub-receta</label><input type="text" value="${nombre}" class="b-nombre w-full border-b border-zinc-300 p-1.5 outline-none text-sm font-semibold text-zinc-800"></div><div><label class="text-[9px] uppercase tracking-widest font-bold text-zinc-400 block mb-1">Rendimiento Base</label><input type="number" step="any" value="${rend}" class="b-rend w-full border-b border-zinc-300 p-1.5 outline-none text-sm tabular-nums"></div><div><label class="text-[9px] uppercase tracking-widest font-bold text-zinc-400 block mb-1">Unidad</label><select class="b-uni w-full border-b border-zinc-300 p-1.5 outline-none text-sm font-semibold uppercase bg-white cursor-pointer">${opcionesUni}</select></div></div><div class="flex flex-col md:flex-row gap-6"><div class="md:w-1/2 md:border-r border-zinc-200 md:pr-6"><div class="flex justify-between items-center mb-3"><label class="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Ingredientes</label><button onclick="agregarIngrediente('${bId}')" class="text-[9px] bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 px-2 py-1 uppercase tracking-widest font-bold rounded-sm text-zinc-600 transition">+ Fila</button></div><div class="c-ingredientes space-y-2"></div></div><div class="md:w-1/2 flex flex-col"><div class="flex justify-between items-center mb-3"><label class="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">Procedimiento Técnico</label></div><textarea class="b-proc w-full flex-1 border border-zinc-200 rounded-sm p-3 text-xs outline-none bg-zinc-50 focus:bg-white transition min-h-[7rem] leading-relaxed">${proc}</textarea></div></div>`;
  document.getElementById('contenedor-bloques-editor').appendChild(div);
  if(ingredientes.length === 0) { window.agregarIngrediente(bId); } else { ingredientes.forEach(ing => window.agregarIngrediente(bId, ing.nombre, ing.cantidad, ing.unidad)); }
};

window.agregarIngrediente = (bloqueId, nombre = '', cant = '', unidad = '') => {
  const b = document.getElementById(bloqueId).querySelector('.c-ingredientes'); const div = document.createElement('div'); div.className = 'fila-ingrediente flex gap-2 items-center';
  
  const uniLimpia = unidad ? window.sanitizarUnidad(unidad) : 'Gr';
  const opcionesIng = ['Gr', 'Kg', 'Ml', 'L', 'Pz', 'Cda', 'Cdta', 'Pizca', 'Manojo'].map(u => `<option value="${u}" ${u === uniLimpia ? 'selected' : ''}>${u}</option>`).join('');

  div.innerHTML = `<input type="text" placeholder="Ingrediente" value="${nombre}" class="ing-nombre flex-1 border border-zinc-200 p-2 text-xs outline-none rounded-sm"><input type="number" placeholder="0.00" value="${cant}" step="any" class="ing-cant w-20 border border-zinc-200 p-2 text-xs outline-none rounded-sm tabular-nums text-center"><select class="ing-unidad w-16 border border-zinc-200 p-2 text-xs outline-none rounded-sm text-center uppercase bg-white cursor-pointer">${opcionesIng}</select><button onclick="this.parentElement.remove()" class="text-zinc-300 hover:text-rose-900 font-bold px-1 transition text-sm">✕</button>`;
  b.appendChild(div);
};

window.cambiarPestaña = (p) => {
  ['visor', 'lista', 'editor', 'admin'].forEach(id => { document.getElementById(`vista-${id}`).classList.add('hidden'); document.getElementById(`tab-${id}`).className = "flex-1 py-4 text-center tab-inactive transition uppercase tracking-wide text-xs hidden"; });
  document.getElementById(`vista-${p}`).classList.remove('hidden'); document.getElementById('tab-visor').classList.remove('hidden'); document.getElementById('tab-lista').classList.remove('hidden');
  if(window.perfilUsuario && window.perfilUsuario.rol === 'SuperAdmin') { document.getElementById('tab-editor').classList.remove('hidden'); document.getElementById('tab-admin').classList.remove('hidden'); } else if (window.perfilUsuario && window.perfilUsuario.rol === 'Editor') { document.getElementById('tab-editor').classList.remove('hidden'); }
  document.getElementById(`tab-${p}`).className = "flex-1 py-4 text-center tab-active transition uppercase tracking-wide text-xs"; if(p === 'admin') document.getElementById(`tab-admin`).classList.add('bg-zinc-100', 'text-rose-900', 'font-black');
};
