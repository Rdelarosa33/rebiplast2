import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'

// Admin client con service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentUser()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { nombre, apellido, email, password, role } = await request.json()
    if (!nombre || !email || !password || !role) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Crear usuario en auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    // Crear profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: authData.user.id, nombre, apellido, email, role, activo: true })
      .select()
      .single()

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

    return NextResponse.json({ usuario: profileData })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const profile = await getCurrentUser()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { userId, password, nombre, apellido, role } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

    // Cambiar contraseña si se envió
    if (password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Actualizar profile
    const updates: any = {}
    if (nombre) updates.nombre = nombre
    if (apellido !== undefined) updates.apellido = apellido
    if (role) updates.role = role

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
