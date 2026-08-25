import { FileCheck, PlayCircle, Clock } from "lucide-react"

const features = [
  {
    icon: FileCheck,
    title: "امتحانات مستمرة",
    description: "اختبارات دورية بعد كل محاضرة لقياس مستواك وتحسين أدائك باستمرار",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    icon: PlayCircle,
    title: "اتفرج كتير",
    description: "محتوى فيديو غني ومتنوع تقدر تشاهده في أي وقت وأي مكان",
    color: "text-secondary",
    bgColor: "bg-secondary/10",
  },
  {
    icon: Clock,
    title: "وفر وقتك وذاكر",
    description: "محتوى منظم ومرتب يساعدك تذاكر بكفاءة وتوفر وقتك",
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-balance">
            ليه تختار منصة{" "}
            <span className="text-primary">العلومنجي</span>؟
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            منصة متكاملة تقدملك كل اللي محتاجه لتحقيق أعلى الدرجات
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="bg-card rounded-2xl p-6 lg:p-8 shadow-sm border border-border hover:shadow-md transition-shadow"
            >
              <div className={`w-14 h-14 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4`}>
                <feature.icon className={`w-7 h-7 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-bold mb-2 text-card-foreground">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
