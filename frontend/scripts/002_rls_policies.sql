-- العلومنجي Platform - Row Level Security Policies
-- 002_rls_policies.sql

-- ==========================================
-- Enable RLS on all tables
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Profiles Policies
-- ==========================================

-- Users can view their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Allow insert for new users (triggered by auth)
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Parents can view their linked students' profiles
CREATE POLICY "profiles_select_linked_students" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parent_students
            WHERE parent_id = auth.uid() AND student_id = profiles.id
        )
    );

-- ==========================================
-- Courses Policies
-- ==========================================

-- Anyone can view active courses
CREATE POLICY "courses_select_active" ON public.courses
    FOR SELECT USING (is_active = true);

-- ==========================================
-- Units Policies
-- ==========================================

-- Anyone can view units of active courses
CREATE POLICY "units_select_active" ON public.units
    FOR SELECT USING (
        is_active = true AND
        EXISTS (SELECT 1 FROM public.courses WHERE id = units.course_id AND is_active = true)
    );

-- ==========================================
-- Lectures Policies
-- ==========================================

-- Users can view lectures if enrolled in the course or lecture is free
CREATE POLICY "lectures_select_enrolled" ON public.lectures
    FOR SELECT USING (
        is_active = true AND (
            is_free = true OR
            EXISTS (
                SELECT 1 FROM public.enrollments e
                JOIN public.units u ON u.course_id = e.course_id
                WHERE e.student_id = auth.uid()
                AND e.is_active = true
                AND u.id = lectures.unit_id
            )
        )
    );

-- ==========================================
-- Activation Codes Policies
-- ==========================================

-- Students can only view their own used codes
CREATE POLICY "activation_codes_select_own" ON public.activation_codes
    FOR SELECT USING (used_by = auth.uid());

-- Allow students to use (update) unused codes
CREATE POLICY "activation_codes_update_use" ON public.activation_codes
    FOR UPDATE USING (is_used = false)
    WITH CHECK (used_by = auth.uid());

-- ==========================================
-- Enrollments Policies
-- ==========================================

-- Students can view their own enrollments
CREATE POLICY "enrollments_select_own" ON public.enrollments
    FOR SELECT USING (student_id = auth.uid());

-- Students can insert their own enrollments
CREATE POLICY "enrollments_insert_own" ON public.enrollments
    FOR INSERT WITH CHECK (student_id = auth.uid());

-- Parents can view their students' enrollments
CREATE POLICY "enrollments_select_parent" ON public.enrollments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parent_students
            WHERE parent_id = auth.uid() AND student_id = enrollments.student_id
        )
    );

-- ==========================================
-- Lecture Progress Policies
-- ==========================================

-- Students can view their own progress
CREATE POLICY "lecture_progress_select_own" ON public.lecture_progress
    FOR SELECT USING (student_id = auth.uid());

-- Students can insert their own progress
CREATE POLICY "lecture_progress_insert_own" ON public.lecture_progress
    FOR INSERT WITH CHECK (student_id = auth.uid());

-- Students can update their own progress
CREATE POLICY "lecture_progress_update_own" ON public.lecture_progress
    FOR UPDATE USING (student_id = auth.uid());

-- Parents can view their students' progress
CREATE POLICY "lecture_progress_select_parent" ON public.lecture_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parent_students
            WHERE parent_id = auth.uid() AND student_id = lecture_progress.student_id
        )
    );

-- ==========================================
-- Exams Policies
-- ==========================================

-- Students can view exams for courses they're enrolled in
CREATE POLICY "exams_select_enrolled" ON public.exams
    FOR SELECT USING (
        is_active = true AND (
            EXISTS (
                SELECT 1 FROM public.enrollments e
                WHERE e.student_id = auth.uid()
                AND e.is_active = true
                AND e.course_id = exams.course_id
            )
            OR
            EXISTS (
                SELECT 1 FROM public.enrollments e
                JOIN public.lectures l ON l.id = exams.lecture_id
                JOIN public.units u ON u.id = l.unit_id
                WHERE e.student_id = auth.uid()
                AND e.is_active = true
                AND e.course_id = u.course_id
            )
        )
    );

-- ==========================================
-- Questions Policies
-- ==========================================

-- Students can view questions for exams they can access
CREATE POLICY "questions_select_exam" ON public.questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.exams e
            WHERE e.id = questions.exam_id
            AND e.is_active = true
        )
    );

-- ==========================================
-- Exam Attempts Policies
-- ==========================================

-- Students can view their own attempts
CREATE POLICY "exam_attempts_select_own" ON public.exam_attempts
    FOR SELECT USING (student_id = auth.uid());

-- Students can insert their own attempts
CREATE POLICY "exam_attempts_insert_own" ON public.exam_attempts
    FOR INSERT WITH CHECK (student_id = auth.uid());

-- Students can update their own attempts
CREATE POLICY "exam_attempts_update_own" ON public.exam_attempts
    FOR UPDATE USING (student_id = auth.uid());

-- Parents can view their students' attempts
CREATE POLICY "exam_attempts_select_parent" ON public.exam_attempts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parent_students
            WHERE parent_id = auth.uid() AND student_id = exam_attempts.student_id
        )
    );

-- ==========================================
-- Student Answers Policies
-- ==========================================

-- Students can view their own answers
CREATE POLICY "student_answers_select_own" ON public.student_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.exam_attempts
            WHERE id = student_answers.attempt_id AND student_id = auth.uid()
        )
    );

-- Students can insert their own answers
CREATE POLICY "student_answers_insert_own" ON public.student_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.exam_attempts
            WHERE id = student_answers.attempt_id AND student_id = auth.uid()
        )
    );

-- ==========================================
-- Notifications Policies
-- ==========================================

-- Users can view their own notifications
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can update (mark as read) their own notifications
CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- ==========================================
-- Parent-Students Policies
-- ==========================================

-- Parents can view their own relationships
CREATE POLICY "parent_students_select_own" ON public.parent_students
    FOR SELECT USING (parent_id = auth.uid() OR student_id = auth.uid());

-- Parents can insert relationships (link students)
CREATE POLICY "parent_students_insert_own" ON public.parent_students
    FOR INSERT WITH CHECK (parent_id = auth.uid());
