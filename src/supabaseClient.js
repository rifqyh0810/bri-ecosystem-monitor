import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nnjopskeajrnwwslkkfh.supabase.co'
const supabaseAnonKey = 'sb_publishable_pwRidL-cRsxC4DwO23p0WQ_qlI62Ys-'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)