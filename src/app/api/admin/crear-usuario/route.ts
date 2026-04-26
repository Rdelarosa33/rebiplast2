import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'

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

    const supabase = await createClient()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    const { data: profileData, error: profileError } = await supabase
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
