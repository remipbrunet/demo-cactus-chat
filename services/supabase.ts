import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://bjfsoausahocrqjzujjy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZnNvYXVzYWhvY3Jxanp1amp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4OTI5MDYsImV4cCI6MjA2MDQ2ODkwNn0.1mVZa4GTGi_orBJoPoOpgu6wPkyGFx1R0OWOnc0Nf2k'
)