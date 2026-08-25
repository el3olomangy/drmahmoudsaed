"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gradeImagesAPI, mediaAPI } from "@/lib/api";
import { getImageUrl } from "@/lib/utils/image";
import { ImageIcon, Upload, Loader2, Trash2 } from "lucide-react";

const GRADES = [
  { id: "first_preparatory", title: "الصف الأول الإعدادي" },
  { id: "second_preparatory", title: "الصف الثاني الإعدادي" },
  { id: "third_preparatory", title: "الصف الثالث الإعدادي" },
  { id: "first_secondary", title: "الصف الأول الثانوي" },
  { id: "second_secondary", title: "الصف الثاني الثانوي" },
  { id: "third_secondary", title: "الصف الثالث الثانوي" },
];

export default function GradeImagesPage() {
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gradeImagesAPI
      .getAll()
      .then(setImages)
      .catch(() => alert("فشل تحميل الصور"))
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (grade: string, url: string) => {
    setImages((prev) => ({ ...prev, [grade]: url }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-loading" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">صور السنوات الدراسية</h1>
        <p className="text-muted-foreground mt-1">
          اختر صورة لكل صف دراسي تظهر في الصفحة الرئيسية — بيتم رفعها وتخزينها
          على Bunny.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {GRADES.map((grade) => (
          <GradeImageCard
            key={grade.id}
            gradeId={grade.id}
            title={grade.title}
            currentUrl={images[grade.id] || ""}
            onSaved={(url) => handleSaved(grade.id, url)}
          />
        ))}
      </div>
    </div>
  );
}

function GradeImageCard({
  gradeId,
  title,
  currentUrl,
  onSaved,
}: {
  gradeId: string;
  title: string;
  currentUrl: string;
  onSaved: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // مسار الصورة على Bunny — بيتحدد بس لما المدرس يرفع صورة جديدة في نفس الجلسة
  // (عشان نقدر نحذفها من Bunny لو استُبدلت أو اتشالت)
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preview = getImageUrl(currentUrl);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await mediaAPI.uploadImage(file, "education_stage");
      const previousPath = currentPath;
      await gradeImagesAPI.update(gradeId, uploaded.url);
      onSaved(uploaded.url);
      setCurrentPath(uploaded.path);

      // نحذف الصورة القديمة من Bunny فقط بعد نجاح رفع وحفظ الجديدة
      if (previousPath && previousPath !== uploaded.path) {
        mediaAPI.deleteImage(previousPath).catch(() => {});
      }
    } catch (err: any) {
      alert(err.message || "فشل رفع الصورة");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setDeleting(true);
    try {
      await gradeImagesAPI.update(gradeId, "");
      onSaved("");
      if (currentPath) {
        mediaAPI.deleteImage(currentPath).catch(() => {});
        setCurrentPath(null);
      }
    } catch (err: any) {
      alert(err.message || "فشل حذف الصورة");
    } finally {
      setDeleting(false);
    }
  };

  const isBusy = uploading || deleting;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* معاينة الصورة الحالية */}
      <div className="h-36 bg-muted relative flex items-center justify-center">
        {preview ? (
          <Image
            src={preview}
            alt={title}
            fill
            unoptimized
            className="object-cover"
          />
        ) : (
          <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
        )}
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
          {title}
        </div>
      </div>

      <div className="p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={isBusy}
          className="hidden"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-loading" />
            ) : (
              <Upload className="w-4 h-4 text-primary" />
            )}
            {uploading ? "جاري الرفع..." : preview ? "اختر صورة تانية" : "اختر صورة"}
          </button>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isBusy}
              className="shrink-0 p-2 rounded-lg border border-border hover:bg-destructive/10 transition-colors disabled:opacity-50"
              title="حذف الصورة"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin text-loading" />
              ) : (
                <Trash2 className="w-4 h-4 text-destructive" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
