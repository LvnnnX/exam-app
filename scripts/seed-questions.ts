import { createClient } from '@supabase/supabase-js'
import { type RawQuestion } from '../lib/questions'

const staticSeedPool: RawQuestion[] = [
  { id: 1, question_text: 'What is the time complexity of binary search?', option_a: 'O(n)', option_b: 'O(log n)', option_c: 'O(n log n)', option_d: 'O(1)', option_e: 'O(n²)', correct_answer: 'B', question_type: 'multiple_choice', short_answer: '', is_hidden: false, mapels: ['Informatika'], babs: ['Informasi'], sub_babs: ['Coding'] },
  { id: 2, question_text: 'Which data structure uses LIFO?', option_a: 'Queue', option_b: 'Stack', option_c: 'Array', option_d: 'Linked List', option_e: 'Tree', correct_answer: 'B', question_type: 'multiple_choice', short_answer: '', is_hidden: false, mapels: ['Informatika'], babs: ['Informasi'], sub_babs: ['Coding'] },
  { id: 3, question_text: 'ACID in databases stands for?', option_a: 'Atomicity, Consistency, Isolation, Durability', option_b: 'Atomic, Consistency, Instant, Durability', option_c: 'Asynchronous, Consistent, Isolated, Durable', option_d: 'Atomicity, Concurrency, Isolation, Durability', option_e: 'Atomic, Consistency, Isolation, Durability', correct_answer: 'A', question_type: 'multiple_choice', short_answer: '', is_hidden: false, mapels: ['Informatika'], babs: ['General'], sub_babs: ['Informatics'] },
  { id: 4, question_text: 'Which SQL join returns left table all records?', option_a: 'INNER JOIN', option_b: 'LEFT OUTER JOIN', option_c: 'RIGHT OUTER JOIN', option_d: 'FULL OUTER JOIN', option_e: 'CROSS JOIN', correct_answer: 'B', question_type: 'multiple_choice', short_answer: '', is_hidden: false, mapels: ['Informatika'], babs: ['General'], sub_babs: ['Informatics'] },
  { id: 5, question_text: 'Which property does a primary key enforce?', option_a: 'Nullable', option_b: 'Duplicates Allowed', option_c: 'Not Null Only', option_d: 'Not Null and Unique', option_e: 'Indexed Only', correct_answer: 'D', question_type: 'multiple_choice', short_answer: '', is_hidden: false, mapels: ['Informatika'], babs: ['General'], sub_babs: ['Informatics'] }
];

const SUPABASE_URL = process.env.SUPABASE_URL as string
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function seedQuestions(): Promise<void> {
  if (staticSeedPool.length === 0) {
    console.log('No fallback questions found to seed.')
    return
  }

  let inserted = 0

  for (const q of staticSeedPool) {
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
      question_type: q.question_type,
      short_answer: q.short_answer,
      is_hidden: q.is_hidden,
      mapels: q.mapels,
      babs: q.babs,
      sub_babs: q.sub_babs,
    }

    const { error } = await supabase.from('questions').insert([payload])
    if (error) {
      console.error('Failed to insert question:', { text: q.question_text, error: error.message })
    } else {
      inserted++
    }
  }

  console.log(`Seeding complete. Inserted ${inserted} of ${staticSeedPool.length} questions.`)
}

seedQuestions().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
