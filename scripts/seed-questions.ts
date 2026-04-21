import { createClient } from '@supabase/supabase-js'
import { fallbackQuestions, type RawQuestion } from '../lib/questions'

const SUPABASE_URL = process.env.SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function seedQuestions(): Promise<void> {
  if (fallbackQuestions.length === 0) {
    console.log('No fallback questions found to seed.')
    return
  }

  let inserted = 0

  for (const q of fallbackQuestions) {
    // Idempotent: skip if a question with the same text already exists
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('question_text', q.question_text)
      .maybeSingle()

    if (existing && (existing as Record<string, unknown>).id) {
      continue
    }

    const payload: Omit<RawQuestion, 'id'> = {
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      option_e: q.option_e,
      correct_answer: q.correct_answer,
      category: q.category,
    }

    const { error } = await supabase.from('questions').insert([payload])
    if (error) {
      console.error('Failed to insert question:', { text: q.question_text, error: error.message })
    } else {
      inserted++
    }
  }

  console.log(`Seeding complete. Inserted ${inserted} of ${fallbackQuestions.length} questions.`)
}

seedQuestions().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
