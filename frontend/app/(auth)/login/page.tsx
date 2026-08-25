"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Phone,
  Lock,
  ArrowLeft,
  HeadphonesIcon,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function LoginForm() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const successMsg =
    searchParams.get("registered") === "true"
      ? "تم إنشاء الحساب بنجاح! سجل دخول دلوقتي"
      : "";

  const generateUUID = () => {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
    // fallback لو المتصفح مش شغال في سياق آمن (HTTPS/localhost)
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const getDeviceId = () => {
    let deviceId = localStorage.getItem("device_id");
    if (!deviceId) {
      deviceId = generateUUID();
      localStorage.setItem("device_id", deviceId);
    }
    return deviceId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!phone.trim()) errors.phone = "رقم الهاتف مطلوب";
    if (!password) errors.password = "كلمة المرور مطلوبة";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const data: any = await authAPI.login({
        phone,
        password,
        device_id: getDeviceId(),
      });
      login(data.access_token, data.user, data.refresh_token);
      const redirect = searchParams.get("redirect");
      const isAdmin =
        data.user.role === "teacher" || data.user.role === "assistant";
      const destination =
        redirect || (isAdmin ? "/dashboard/admin" : "/dashboard");
      router.replace(destination);
    } catch (err: any) {
      const msg = err.message || "حصل خطأ — حاول تاني";
      if (msg.includes("رقم الهاتف أو كلمة المرور")) {
        setFieldErrors({ phone: msg, password: msg });
      } else if (msg.includes("موقوف")) {
        setFieldErrors({ phone: msg });
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ====== Support Dialog ====== */}
      {showSupportDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowSupportDialog(false)}
        >
          <div
            className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <HeadphonesIcon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-extrabold text-lg text-foreground">
                  نسيت كلمة المرور؟
                </h2>
              </div>
              <button
                onClick={() => setShowSupportDialog(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                لإعادة تعيين كلمة المرور، تواصل مع الدعم الفني للمنصة وهيساعدوك
                في أقرب وقت.
              </p>
              <div className="p-3 bg-muted/50 rounded-xl text-sm text-foreground text-center font-medium">
                📞 تواصل مع الدعم الفني للمنصة
              </div>
              <a
                href="https://drive.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-green-500 hover:bg-green-600 transition-colors text-white font-bold text-sm"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.126 1.535 5.858L.057 23.428a.75.75 0 0 0 .921.921l5.57-1.478A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.75 9.75 0 0 1-4.964-1.355l-.356-.212-3.695.98.993-3.617-.232-.373A9.75 9.75 0 1 1 12 21.75z" />
                </svg>
                تواصل عبر واتساب
              </a>
            </div>

            <Button
              className="w-full mt-4"
              onClick={() => setShowSupportDialog(false)}
            >
              حسناً، فهمت
            </Button>
          </div>
        </div>
      )}

      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mb-8">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-BuyHgoZLI0SWgDwWIvZe8lSxWIu1dX.png"
              alt="العلومنجي"
              width={120}
              height={40}
              className="h-8 w-auto"
            />
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-foreground">
              تسجيل الدخول
            </h1>
            <p className="mt-2 text-muted-foreground">
              أدخل بياناتك للوصول لحسابك
            </p>
          </div>

          {/* Success */}
          {successMsg && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 text-sm text-center">
              {successMsg}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="phone"
                  name="username"
                  type="tel"
                  autoComplete="username"
                  placeholder="01xxxxxxxxx"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  className="pr-10 text-left"
                  dir="ltr"
                />
              </div>
              {fieldErrors.phone && (
                <p className="text-xs text-destructive">{fieldErrors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">كلمة المرور</Label>
                <button
                  type="button"
                  onClick={() => setShowSupportDialog(true)}
                  className="text-xs text-primary hover:underline transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="current-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  className="pr-10 pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-destructive">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-6"
              disabled={isLoading}
            >
              {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>

          {/* Register Link */}
          <p className="mt-8 text-center text-muted-foreground">
            مش عندك حساب؟{" "}
            <Link
              href="/register"
              className="text-primary font-bold hover:underline"
            >
              اعمل حساب جديد
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className="hidden lg:flex flex-1 bg-linear-to-br from-primary to-primary/80 items-center justify-center p-12">
        <div className="text-center">
          <div className="relative w-80 h-80 mx-auto mb-8">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/back_ground_teacher-aW1VvT7C4aJ8q9UzQPkekVkNmaXgnZ.png"
              alt=""
              fill
              className="object-contain opacity-30"
            />
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/teacher_pic-mGYVNXqSPGIcSjUAjZ1jmoFlCHW4n6.png"
              alt="د. محمود سعيد"
              fill
              className="object-contain"
            />
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4">
            أهلاً بيك في في منصة العلومنجي
          </h2>
          <p className="text-white/80 text-lg max-w-sm mx-auto">
            منصتك التعليمية المتكاملة مع د. محمود سعيد
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-loading border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
