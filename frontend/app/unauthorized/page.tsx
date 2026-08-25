"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function UnauthorizedPage() {
  const { user } = useAuth();

  const homeHref =
    user?.role === "teacher" || user?.role === "assistant"
      ? "/dashboard/admin"
      : "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="text-center max-w-sm space-y-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-extrabold text-foreground">
          مفيش صلاحية للوصول
        </h1>
        <p className="text-muted-foreground">
          الحساب بتاعك مالوش صلاحية يدخل الصفحة دي. لو شايف إن ده غلط، تواصل مع
          المدرّس.
        </p>
        <Button asChild className="w-full">
          <Link href={homeHref}>ارجع للوحة التحكم</Link>
        </Button>
      </div>
    </div>
  );
}
