// Update: getScheduledExamRecapAction is deprecated in favour of direct fetch from scheduled_exam_attempts
// But we should keep the API structure consistent for performance.

// To improve performance, we can fetch recap + attempt details in one go, 
// or simply use the updated fetchAttemptAnswersAction which is now faster.
