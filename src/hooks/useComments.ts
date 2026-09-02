import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Comment } from '../lib/database.types'

export function useComments(entityType: 'task' | 'client' | 'lead', entityId: string) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchComments = useCallback(async () => {
    if (!entityId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (error) console.error('Failed to fetch comments:', error.message)
    setComments(data ?? [])
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => { fetchComments() }, [fetchComments])

  async function addComment(content: string, authorId: string) {
    const { data, error } = await supabase
      .from('comments')
      .insert({ entity_type: entityType, entity_id: entityId, author_id: authorId, content })
      .select()
      .single()
    if (error) return { error: error.message }
    setComments((prev) => [...prev, data])
    return { data }
  }

  async function deleteComment(id: string) {
    const { error } = await supabase
      .from('comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { error: error.message }
    setComments((prev) => prev.filter((c) => c.id !== id))
    return {}
  }

  return { comments, loading, addComment, deleteComment }
}
