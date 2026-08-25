"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Plus, RefreshCw, PlayCircle, Upload, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { coursesAPI, mediaAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getImageUrl } from "@/lib/utils/image";

interface Course {
  id: string;
  title: string;
  description?: string;
  grade?: string;
  course_type?: "free" | "paid";
  price?: number;
  thumbnail?: string;
  lectures_count: number;
  is_active: boolean;
}

const grades = [
  { value: "first_preparatory", label: "أولى إعدادي" },
  { value: "second_preparatory", label: "ثانية إعدادي" },
  { value: "third_preparatory", label: "ثالثة إعدادي" },
  { value: "first_secondary", label: "أولى ثانوي" },
  { value: "second_secondary", label: "ثانية ثانوي" },
  { value: "third_secondary", label: "ثالثة ثانوي" },
];

export default function AdminCoursesPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    grade: "",
    course_type: "paid" as "free" | "paid",
    price: "",
    thumbnail: "",
  });
  const [thumbnailPath, setThumbnailPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCourses = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = (await coursesAPI.getAll()) as Course[];
      setCourses(data);
    } catch (err: any) {
      setError(err.message || "حصل خطأ");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadCourses = async () => {
      setIsLoading(true);
      setError("");

      try {
        const data = (await coursesAPI.getAll()) as Course[];
        if (active) setCourses(data);
      } catch (err: any) {
        if (active) setError(err.message || "حصل خطأ");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadCourses();

    return () => {
      active = false;
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const uploaded = await mediaAPI.uploadImage(file, "course");
      const previousPath = thumbnailPath;
      setForm((p) => ({ ...p, thumbnail: uploaded.url }));
      setThumbnailPath(uploaded.path);
      if (previousPath && previousPath !== uploaded.path) {
        mediaAPI.deleteImage(previousPath).catch(() => {});
      }
    } catch (err: any) {
      setFormError(err.message || "فشل رفع الصورة");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveThumbnail = () => {
    setForm((p) => ({ ...p, thumbnail: "" }));
    if (thumbnailPath) {
      mediaAPI.deleteImage(thumbnailPath).catch(() => {});
      setThumbnailPath(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.grade) {
      setFormError("اسم الكورس والمرحلة مطلوبين");
      return;
    }
    if (
      form.course_type === "paid" &&
      (!form.price || Number(form.price) <= 0)
    ) {
      setFormError("لازم تحدد سعر الكورس بالجنيه المصري لأنه كورس مدفوع");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    try {
      const newCourse: any = await coursesAPI.create({
        title: form.title,
        description: form.description || undefined,
        grade: form.grade,
        course_type: form.course_type,
        price: form.course_type === "paid" ? Number(form.price) : undefined,
        thumbnail: form.thumbnail || undefined,
      });
      setCourses((prev) => [newCourse, ...prev]);
      setIsDialogOpen(false);
      setForm({
        title: "",
        description: "",
        grade: "",
        course_type: "paid",
        price: "",
        thumbnail: "",
      });
      setThumbnailPath(null);
    } catch (err: any) {
      setFormError(err.message || "حصل خطأ في إنشاء الكورس");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">الكورسات</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "..." : `${courses.length} كورس`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCourses} disabled={isLoading}>
            <RefreshCw
              className={`w-4 h-4 ml-2 ${isLoading ? "animate-spin text-loading" : "text-muted-foreground"}`}
            />
            تحديث
          </Button>

          {isTeacher && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="w-4 h-4 ml-2" />
                  كورس جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة كورس جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>اسم الكورس *</Label>
                    <Input
                      placeholder="مثال: الكيمياء العضوية"
                      value={form.title}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, title: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>المرحلة الدراسية *</Label>
                    <Select
                      value={form.grade}
                      onValueChange={(v) =>
                        setForm((p) => ({ ...p, grade: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المرحلة" />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الوصف</Label>
                    <Textarea
                      placeholder="وصف مختصر للكورس..."
                      value={form.description}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, description: e.target.value }))
                      }
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>نوع الكورس *</Label>
                    <Select
                      value={form.course_type}
                      onValueChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          course_type: v as "free" | "paid",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">
                          مدفوع — بكود اشتراك
                        </SelectItem>
                        <SelectItem value="free">
                          مجاني — متاح لكل طلاب المرحلة
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {form.course_type === "paid" && (
                      <div className="space-y-2">
                        <Label>السعر (جنيه) *</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={form.price}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, price: e.target.value }))
                          }
                          min="0"
                          required
                        />
                      </div>
                    )}
                    <div className="space-y-2 col-span-2">
                      <Label>صورة الكورس</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                      {form.thumbnail ? (
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                          <Image
                            src={getImageUrl(form.thumbnail) || form.thumbnail}
                            alt="preview"
                            fill
                            unoptimized
                            className="object-cover"
                          />
                          {isUploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <Loader2 className="w-6 h-6 animate-spin text-white" />
                            </div>
                          )}
                          {!isUploading && (
                            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-2">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 text-xs font-medium hover:bg-white"
                              >
                                <Upload className="w-3.5 h-3.5" /> استبدال
                              </button>
                              <button
                                type="button"
                                onClick={handleRemoveThumbnail}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90"
                              >
                                <X className="w-3.5 h-3.5" /> حذف
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-60"
                        >
                          {isUploading ? (
                            <Loader2 className="w-5 h-5 animate-spin text-loading" />
                          ) : (
                            <Upload className="w-5 h-5" />
                          )}
                          <span className="text-sm font-medium">
                            {isUploading ? "جاري الرفع..." : "اختر صورة"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {formError && (
                    <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                      {formError}
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="submit"
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "جاري الإنشاء..." : "إنشاء الكورس"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      إلغاء
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center justify-between">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchCourses}>
            إعادة المحاولة
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">مفيش كورسات لسه</p>
            {isTeacher && (
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="w-4 h-4 ml-2" />
                أضف أول كورس
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/dashboard/admin/courses/${course.id}`}
            >
              <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                <div className="relative aspect-video bg-muted flex items-center justify-center">
                  {course.thumbnail ? (
                    <Image
                      src={getImageUrl(course.thumbnail) || ""}
                      alt={course.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <BookOpen className="w-10 h-10 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-bold text-foreground mb-1">
                    {course.title}
                  </h3>
                  {course.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {course.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <PlayCircle className="w-4 h-4" />
                      {course.lectures_count} محاضرة
                    </span>
                    <span>
                      {grades.find((g) => g.value === course.grade)?.label ||
                        course.grade}
                    </span>
                  </div>
                  {course.course_type === "free" ? (
                    <span className="inline-block mt-2 text-xs font-bold px-2 py-1 rounded-full bg-chart-3/10 text-chart-3">
                      مجاني
                    </span>
                  ) : course.price ? (
                    <p className="mt-2 text-sm font-bold text-primary">
                      {course.price} جنيه
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
