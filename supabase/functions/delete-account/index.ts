import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = request.headers.get('Authorization')

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Supabase function secrets are not configured.' })
  }

  if (!authHeader) {
    return jsonResponse(401, { error: 'Authorization header is missing.' })
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse(401, { error: '로그인한 사용자 정보를 확인하지 못했어요.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const deleteResults = await Promise.all([
    adminClient.from('reviews').delete().eq('user_id', user.id),
    adminClient.from('medical_records').delete().eq('user_id', user.id),
    adminClient.from('pets').delete().eq('user_id', user.id),
    adminClient.from('user_profiles').delete().eq('id', user.id),
  ])

  const dataDeleteError = deleteResults.find((result) => result.error)?.error
  if (dataDeleteError) {
    return jsonResponse(500, { error: dataDeleteError.message })
  }

  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id)

  if (deleteUserError) {
    return jsonResponse(500, { error: deleteUserError.message })
  }

  return jsonResponse(200, { success: true })
})
