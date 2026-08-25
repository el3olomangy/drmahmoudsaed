import type { MetadataRoute } from "next";

// يخلي الموقع "قابل للتثبيت" على الموبايل (إضافة للشاشة الرئيسية) زي أبليكشن.
// مفيد لصفحة اسكان الحضور في السنتر.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "منصة العلومنجي",
    short_name: "العلومنجي",
    description: "منصة العلومنجي التعليمية — د. محمود سعيد",
    start_url: "/dashboard/admin/center/scan",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#fe2c55",
    dir: "rtl",
    lang: "ar",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
