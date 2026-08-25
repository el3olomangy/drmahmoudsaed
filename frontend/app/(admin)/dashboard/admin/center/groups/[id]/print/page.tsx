"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { centerAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Printer, ArrowRight, AlertCircle } from "lucide-react";

interface Student {
  id: string;
  name: string;
  student_number: string;
  qr_token: string;
}

export default function PrintQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = use(params);
  const [students, setStudents] = useState<Student[]>([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = (await centerAPI.listStudents(groupId)) as Student[];
        setStudents(list);
        // نولّد صورة QR لكل طالب من التوكن بتاعه
        const entries = await Promise.all(
          list.map(async (s) => {
            const url = await QRCode.toDataURL(s.qr_token, {
              margin: 1,
              width: 320,
              errorCorrectionLevel: "M",
            });
            return [s.id, url] as [string, string];
          }),
        );
        setQrMap(Object.fromEntries(entries));
      } catch (err: any) {
        setError(err.message || "حصل خطأ في التحميل");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* أدوات (بتختفي عند الطباعة) */}
      <div className="no-print space-y-4">
        <Link
          href={`/dashboard/admin/center/groups/${groupId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع للمجموعة
        </Link>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">كروت الـ QR</h1>
            <p className="text-sm text-muted-foreground">
              اضغط طباعة، وفي نافذة الطباعة اختار "حفظ كـ PDF" عشان تطبعها بعدين.
            </p>
          </div>
          <Button
            onClick={() => window.print()}
            className="gap-2"
            disabled={loading || students.length === 0}
          >
            <Printer className="w-4 h-4" />
            طباعة / حفظ PDF
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && <p className="text-muted-foreground">جاري تجهيز الكروت...</p>}
        {!loading && students.length === 0 && (
          <p className="text-muted-foreground">مفيش طلاب في المجموعة دي.</p>
        )}
      </div>

      {/* شبكة الكروت */}
      <div className="qr-grid">
        {students.map((s) => (
          <div key={s.id} className="qr-card">
            {qrMap[s.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrMap[s.id]} alt={`QR ${s.name}`} className="qr-img" />
            ) : (
              <div className="qr-img qr-placeholder" />
            )}
            <p className="qr-name">{s.name}</p>
            <p className="qr-num">رقم: {s.student_number}</p>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .qr-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (min-width: 640px) {
          .qr-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .qr-card {
          border: 1px dashed #999;
          border-radius: 10px;
          padding: 12px;
          text-align: center;
          background: #fff;
          color: #000;
          break-inside: avoid;
        }
        .qr-img {
          width: 100%;
          max-width: 180px;
          height: auto;
          margin: 0 auto;
          display: block;
          aspect-ratio: 1 / 1;
        }
        .qr-placeholder {
          background: #eee;
          border-radius: 6px;
        }
        .qr-name {
          font-weight: 700;
          margin-top: 8px;
          font-size: 14px;
          color: #000;
        }
        .qr-num {
          font-size: 12px;
          color: #444;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          /* نخلي الخلفية بيضا والكروت تتوزع على الصفحة */
          body {
            background: #fff !important;
          }
          .qr-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
          }
          .qr-card {
            border: 1px dashed #666;
          }
        }
      `}</style>
    </div>
  );
}
