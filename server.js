const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno (.env.local)
try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) {
    console.warn('⚠️ dotenv no instalado, usando variables de entorno del sistema');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Supabase - Usar SECRET KEY en el servidor (más seguro)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error('❌ ERROR: Faltan credenciales de Supabase. Revisa .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Rutas de autenticación
app.post('/api/register', async (req, res) => {
    console.log('\n📨 SOLICITUD DE REGISTRO RECIBIDA');
    console.log('Body:', req.body);
    
    try {
        const { fullname, email, password, confirmPassword } = req.body;
        
        console.log('✓ Datos recibidos:', { fullname, email, password: password ? '***' : 'no', confirmPassword: confirmPassword ? '***' : 'no' });

        // Validaciones
        if (!fullname || !email || !password || !confirmPassword) {
            console.log('❌ Validación 1 fallida: campos requeridos');
            return res.status(400).json({ error: 'Todos los campos son requeridos' });
        }

        if (password !== confirmPassword) {
            console.log('❌ Validación 2 fallida: contraseñas no coinciden');
            return res.status(400).json({ error: 'Las contraseñas no coinciden' });
        }

        if (password.length < 6) {
            console.log('❌ Validación 3 fallida: contraseña muy corta');
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        console.log('✅ Validaciones pasadas, intentando crear usuario en Supabase Auth...');

        // Registrar usuario con Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullname
                },
                emailRedirectTo: `${req.headers.origin ||'http://localhost:3000'}/pages/login.html`
            }
        });

        if (authError) {
            console.log('❌ ERROR en Supabase Auth:', authError.message);
            return res.status(400).json({ error: authError.message });
        }

        console.log('✅ Usuario creado en Supabase Auth:', authData.user.id);
        console.log('📝 Intentando crear perfil...');

        // Crear perfil - Intentar con función RPC o INSERT directo
        let profileCreated = false;
        
        // Intento 1: Usar función RPC (si existe)
        try {
            console.log('  1️⃣  Intentando con RPC create_user_profile...');
            const { data: profileData, error: rpcError } = await supabase
                .rpc('create_user_profile', {
                    user_id: authData.user.id,
                    user_email: email,
                    user_full_name: fullname
                });

            if (rpcError) {
                console.log('  ⚠️  RPC error:', rpcError.message);
            } else {
                console.log('  ✅ Perfil creado con RPC:', profileData);
                profileCreated = true;
            }
        } catch (rpcError) {
            console.log('  ⚠️  RPC excepción:', rpcError.message);
        }

        // Intento 2: Insertar directo en la tabla (usando SECRET KEY del servidor)
        if (!profileCreated) {
            try {
                console.log('  2️⃣  Intentando INSERT directo en profiles...');
                const { data: insertData, error: insertError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: authData.user.id,
                            email: email,
                            full_name: fullname,
                            created_at: new Date().toISOString()
                        }
                    ])
                    .select();

                if (insertError) {
                    console.log('  ❌ INSERT error:', insertError.message);
                    console.log('     Código:', insertError.code);
                    console.log('     Detalles:', insertError.details);
                } else {
                    console.log('  ✅ Perfil creado con INSERT:', insertData);
                    profileCreated = true;
                }
            } catch (insertError) {
                console.log('  ❌ INSERT excepción:', insertError.message);
            }
        }

        console.log('✅ REGISTRO COMPLETADO - Perfil creado:', profileCreated);
        res.json({
            success: true,
            message: 'Usuario registrado exitosamente. Por favor verifica tu email.',
            user: {
                id: authData.user.id,
                email: authData.user.email
            },
            profileCreated: profileCreated
        });

    } catch (error) {
        console.error('❌ ERROR NO CAPTURADO EN REGISTRO:', error.message);
        console.error('   Stack:', error.stack);
        res.status(500).json({ error: 'Error en el servidor: ' + error.message });
    }
});

app.post('/api/login', async (req, res) => {
    console.log('\n📨 SOLICITUD DE LOGIN RECIBIDA');
    console.log('Body:', req.body);
    
    try {
        const { email, password } = req.body;

        console.log('✓ Email:', email, 'Password:', password ? '***' : 'no');

        // Validaciones
        if (!email || !password) {
            console.log('❌ Validación fallida: campos requeridos');
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        console.log('✅ Validaciones pasadas, intentando login en Supabase Auth...');

        // Iniciar sesión con Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            console.log('❌ ERROR en Supabase Auth:', authError.message);
            return res.status(400).json({ error: 'Email o contraseña incorrectos' });
        }

        console.log('✅ Login exitoso en Auth, ID:', authData.user.id);
        console.log('📝 Obteniendo perfil del usuario...');

        // Intentar obtener perfil del usuario
        let profileData = null;
        const { data: existingProfile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (existingProfile) {
            console.log('✅ Perfil encontrado:', existingProfile.email);
            profileData = existingProfile;
        } else {
            console.log('⚠️  No se encontró perfil, creando uno...');
            // Si no existe perfil, crear uno con datos por defecto
            const { data: createResult, error: createError } = await supabase
                .rpc('create_user_profile', {
                    user_id: authData.user.id,
                    user_email: email,
                    user_full_name: email.split('@')[0]
                });

            if (!createError && createResult?.success) {
                console.log('✅ Perfil creado exitosamente');
                profileData = {
                    id: authData.user.id,
                    email: email,
                    full_name: email.split('@')[0],
                    role: 'student'
                };
            } else {
                console.log('⚠️  No se pudo crear perfil, usando datos por defecto');
                // Usar datos por defecto si la función falla
                profileData = {
                    id: authData.user.id,
                    email: email,
                    full_name: email.split('@')[0],
                    role: 'student'
                };
            }
        }

        console.log('✅ LOGIN COMPLETADO - Enviando respuesta...');
        res.json({
            success: true,
            message: 'Sesión iniciada',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                name: profileData.full_name || email.split('@')[0],
                role: profileData.role || 'student'
            },
            accessToken: authData.session.access_token
        });

    } catch (error) {
        console.error('❌ ERROR NO CAPTURADO EN LOGIN:', error.message);
        console.error('   Stack:', error.stack);
        res.status(500).json({ error: 'Error en el servidor: ' + error.message });
    }
});

// ========================================
// UPDATE PROFILE ENDPOINT
// ========================================

app.post('/api/update-profile', async (req, res) => {
    console.log('\n📨 UPDATE PROFILE SOLICITUD RECIBIDA');
    
    try {
        const { userId, fullName, bio, avatarUrl } = req.body;

        if (!userId || !fullName) {
            return res.status(400).json({ error: 'userId y fullName son requeridos' });
        }

        console.log('✅ Datos válidos, actualizando perfil en Supabase...');

        const { data: updatedProfile, error } = await supabase
            .from('profiles')
            .update({
                full_name: fullName,
                bio: bio || null,
                avatar_url: avatarUrl || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select();

        if (error) {
            console.log('❌ Error updating profile:', error.message);
            return res.status(400).json({ error: error.message });
        }

        console.log('✅ Perfil actualizado correctamente');
        res.json({
            success: true,
            message: 'Perfil actualizado correctamente',
            profile: updatedProfile[0]
        });

    } catch (error) {
        console.error('❌ ERROR en update-profile:', error.message);
        res.status(500).json({ error: 'Error en el servidor: ' + error.message });
    }
});

// ========================================
// UPLOAD PROFILE PHOTO ENDPOINT
// ========================================

app.post('/api/upload-profile-photo', async (req, res) => {
    console.log('\n📨 UPLOAD PHOTO SOLICITUD RECIBIDA');
    
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }

        // For now, we'll use a placeholder service. 
        // In production, you might want to use Supabase Storage or Cloudinary
        
        // Example: Using a data URL or external URL
        // You can implement actual file upload using multer and Supabase Storage
        
        console.log('⚠️  Photo upload endpoint: Implementar Supabase Storage o Cloudinary');
        
        // For now, return a sample photo URL
        const photoUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
        
        res.json({
            success: true,
            message: 'Foto subida correctamente',
            photoUrl: photoUrl
        });

    } catch (error) {
        console.error('❌ ERROR en upload-profile-photo:', error.message);
        res.status(500).json({ error: 'Error en el servidor: ' + error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   🚀 Servidor corriendo correctamente      ║
║   📍 http://localhost:${PORT}
║   🔗 Supabase: ${SUPABASE_URL.split('/')[2]}
║   ✅ Sistema de autenticación activo       ║
╚════════════════════════════════════════════╝
    `);
});