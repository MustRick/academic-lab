import { supabase } from '../services/supabase.service.js'

export const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ error: 'Token bulunamadi' })
  }

  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return res.status(401).json({ error: 'Gecersiz token' })
  }

  req.user = data.user
  next()
}
