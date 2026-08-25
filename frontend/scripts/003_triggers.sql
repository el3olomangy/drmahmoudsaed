-- العلومنجي Platform - Triggers and Functions
-- 003_triggers.sql

-- ==========================================
-- Auto-create Profile on User Signup
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        phone,
        parent_phone,
        governorate,
        grade,
        role
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
        COALESCE(NEW.raw_user_meta_data ->> 'phone', NULL),
        COALESCE(NEW.raw_user_meta_data ->> 'parent_phone', NULL),
        COALESCE(NEW.raw_user_meta_data ->> 'governorate', NULL),
        COALESCE((NEW.raw_user_meta_data ->> 'grade')::grade_level, NULL),
        COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'student')
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- Updated_at Trigger Function
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS courses_updated_at ON public.courses;
CREATE TRIGGER courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS units_updated_at ON public.units;
CREATE TRIGGER units_updated_at
    BEFORE UPDATE ON public.units
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS lectures_updated_at ON public.lectures;
CREATE TRIGGER lectures_updated_at
    BEFORE UPDATE ON public.lectures
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS exams_updated_at ON public.exams;
CREATE TRIGGER exams_updated_at
    BEFORE UPDATE ON public.exams
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- ==========================================
-- Function to Activate Course Code
-- ==========================================

CREATE OR REPLACE FUNCTION public.activate_course_code(
    p_code TEXT,
    p_student_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code_record RECORD;
    v_enrollment_id UUID;
BEGIN
    -- Find the code
    SELECT * INTO v_code_record
    FROM public.activation_codes
    WHERE code = p_code;
    
    -- Check if code exists
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'الكود غير صحيح');
    END IF;
    
    -- Check if code is already used
    IF v_code_record.is_used THEN
        RETURN json_build_object('success', false, 'error', 'الكود مستخدم بالفعل');
    END IF;
    
    -- Check if code is expired
    IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < NOW() THEN
        RETURN json_build_object('success', false, 'error', 'الكود منتهي الصلاحية');
    END IF;
    
    -- Check if student is already enrolled
    IF EXISTS (
        SELECT 1 FROM public.enrollments
        WHERE student_id = p_student_id AND course_id = v_code_record.course_id AND is_active = true
    ) THEN
        RETURN json_build_object('success', false, 'error', 'أنت مشترك بالفعل في هذا الكورس');
    END IF;
    
    -- Mark code as used
    UPDATE public.activation_codes
    SET is_used = true, used_by = p_student_id, used_at = NOW()
    WHERE id = v_code_record.id;
    
    -- Create enrollment
    INSERT INTO public.enrollments (student_id, course_id, activation_code_id)
    VALUES (p_student_id, v_code_record.course_id, v_code_record.id)
    RETURNING id INTO v_enrollment_id;
    
    -- Create notification
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
        p_student_id,
        'تم تفعيل الكورس',
        'تم تفعيل الكورس بنجاح. يمكنك الآن البدء في المشاهدة.',
        'course',
        '/dashboard/courses/' || v_code_record.course_id
    );
    
    RETURN json_build_object(
        'success', true,
        'enrollment_id', v_enrollment_id,
        'course_id', v_code_record.course_id
    );
END;
$$;

-- ==========================================
-- Function to Calculate Student Progress
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_student_course_progress(
    p_student_id UUID,
    p_course_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_lectures INTEGER;
    v_completed_lectures INTEGER;
    v_total_watch_time INTEGER;
BEGIN
    -- Get total lectures in course
    SELECT COUNT(*)
    INTO v_total_lectures
    FROM public.lectures l
    JOIN public.units u ON u.id = l.unit_id
    WHERE u.course_id = p_course_id AND l.is_active = true;
    
    -- Get completed lectures
    SELECT COUNT(*)
    INTO v_completed_lectures
    FROM public.lecture_progress lp
    JOIN public.lectures l ON l.id = lp.lecture_id
    JOIN public.units u ON u.id = l.unit_id
    WHERE lp.student_id = p_student_id
    AND u.course_id = p_course_id
    AND lp.is_completed = true;
    
    -- Get total watch time
    SELECT COALESCE(SUM(lp.watch_time), 0)
    INTO v_total_watch_time
    FROM public.lecture_progress lp
    JOIN public.lectures l ON l.id = lp.lecture_id
    JOIN public.units u ON u.id = l.unit_id
    WHERE lp.student_id = p_student_id
    AND u.course_id = p_course_id;
    
    RETURN json_build_object(
        'total_lectures', v_total_lectures,
        'completed_lectures', v_completed_lectures,
        'progress_percentage', CASE WHEN v_total_lectures > 0 
            THEN ROUND((v_completed_lectures::DECIMAL / v_total_lectures) * 100)
            ELSE 0 END,
        'total_watch_time_seconds', v_total_watch_time
    );
END;
$$;
