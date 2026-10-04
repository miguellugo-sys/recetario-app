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
    const userCredential = await createUserWithEmailAndPassword(auth, e, p); 
    
    await setDoc(doc(db, 'usuarios', e), { 
      email: e, 
      nombre: nombreUsuario, 
      puesto: puestoUsuario, 
      rol: 'Lector', 
      sucursal: sucursalUsuario, 
      estado: 'Pendiente' 
    });
    
    const notificarTelegramBackend = httpsCallable(functions, 'notificarTelegram');
    await notificarTelegramBackend({ 
      nombre: nombreUsuario, 
      puesto: puestoUsuario, 
      sucursal: sucursalUsuario, 
      email: e 
    }).catch(err => console.log("Notificación ignorada:", err));

    await signOut(auth);

    err.innerText = "¡Solicitud enviada! Espera aprobación del Admin."; 
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
      err.innerText = "Error al enviar solicitud. Revisa la consola.";
    }
    err.classList.replace('text-zinc-500', 'text-rose-600'); 
  }
};
