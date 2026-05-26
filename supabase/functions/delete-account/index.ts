import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), { status: 401, headers: corsHeaders })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const userId = user.id

  try {
    // 1. Récupérer les spaces de l'utilisateur
    const { data: memberships } = await admin
      .from('space_members')
      .select('space_id')
      .eq('user_id', userId)

    const spaceIds = (memberships ?? []).map((m: { space_id: string }) => m.space_id)

    // 2. Supprimer les fichiers d'emploi du temps
    for (const spaceId of spaceIds) {
      const { data: files } = await admin.storage
        .from('schedules')
        .list(`${spaceId}/${userId}`)
      if (files && files.length > 0) {
        const paths = files.map((f: { name: string }) => `${spaceId}/${userId}/${f.name}`)
        await admin.storage.from('schedules').remove(paths)
      }
      await admin.from('member_schedules')
        .delete()
        .eq('space_id', spaceId)
        .eq('user_id', userId)
    }

    // 3. Supprimer les tokens push
    await admin.from('push_tokens').delete().eq('user_id', userId)

    // 4. Anonymiser les messages (conserver l'historique du space)
    await admin.from('chat_messages')
      .update({ sender_name: 'Utilisateur supprimé' })
      .eq('user_id', userId)

    // 5. Supprimer les appartenances aux spaces
    await admin.from('space_members').delete().eq('user_id', userId)

    // 6. Supprimer les spaces devenus orphelins (0 membres restants)
    for (const spaceId of spaceIds) {
      const { count } = await admin
        .from('space_members')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId)
      if (count === 0) {
        await admin.from('spaces').delete().eq('id', spaceId)
      }
    }

    // 7. Supprimer le compte auth
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Une erreur est survenue' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
