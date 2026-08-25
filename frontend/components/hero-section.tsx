import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FloatingChemIcons } from "@/components/FloatingChemIcons"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/patern_website-kCRJnMHs9J03d09F0Vap3SdWoZTV5E.png")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '600px',
        }}
      />

      {/* الأيقونات الكيميائية الطائرة */}
      <FloatingChemIcons />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          {/* Content */}
          <div className="flex-1 text-center lg:text-right">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-balance">
              <span className="text-primary">العلومنجي</span>
              {" "}
              <span className="text-secondary">دايمًا في ضهرك</span>
              <br />
              <span className="text-foreground">خطوة بخطوة</span>
            </h1>
            
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
              منصة تعليمية متكاملة مع الدكتور{" "}
              <span className="font-bold text-foreground">محمود سعيد</span>
              {" "}لطلاب الثانوية العامة و البكالوريا و المرحلة الاعدادية
            </p>

            <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-4 justify-center lg:justify-start">
              <Button 
                size="lg" 
                asChild 
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6"
              >
                <Link href="/register">استر نفسك بأكونت</Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                asChild 
                className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground text-lg px-8 py-6"
              >
                <Link href="/parent">متابعة ولي الأمر</Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                asChild 
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground text-lg px-8 py-6"
              >
                <Link href="/login">تسجيل الدخول</Link>
              </Button>
            </div>
          </div>

          {/* Teacher Image */}
          <div className="flex-1 relative">
            <div className="relative w-full max-w-md mx-auto">
              {/* Background Shape */}
              <Image 
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/back_ground_teacher-aW1VvT7C4aJ8q9UzQPkekVkNmaXgnZ.png"
                alt=""
                width={500}
                height={500}
                className="w-full h-auto"
                loading="eager"
              />
              {/* Teacher Photo */}
              <Image 
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/teacher_pic-mGYVNXqSPGIcSjUAjZ1jmoFlCHW4n6.png"
                alt="د. محمود سعيد"
                width={450}
                height={450}
                className="absolute inset-0 w-full h-auto object-contain"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}