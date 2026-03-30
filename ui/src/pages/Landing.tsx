import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: (
      <svg className="size-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    title: "Instant API Access",
    description: "Get your API key in seconds. No credit card required, no lengthy setup processes.",
  },
  {
    icon: (
      <svg className="size-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "No Rate Limit Headaches",
    description: "Your quota is your quota. Use Claude Code, Cursor, and Codex without hitting walls.",
  },
  {
    icon: (
      <svg className="size-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "5-Hour Rolling Window",
    description: "Request quotas reset on a rolling 5-hour basis. No monthly reset anxiety.",
  },
];

const steps = [
  {
    number: "01",
    title: "Sign up",
    description: "Choose your plan in 30 seconds. No credit card needed for the waitlist.",
  },
  {
    number: "02",
    title: "Get your API key",
    description: "Instant access to your dashboard. Copy your key and start building.",
  },
  {
    number: "03",
    title: "Start building",
    description: "Use Claude Code, Cursor, and Codex with your quota. Ship faster.",
  },
];

const plans = [
  {
    name: "Starter",
    requests: "300",
    price: "20",
    description: "For indie devs and hobby projects",
    features: [
      "300 AI agent requests / 5 hours",
      "Claude Code access",
      "Cursor access",
      "Codex access",
      "Email support",
    ],
    cta: "Join Waitlist",
    popular: false,
  },
  {
    name: "Pro",
    requests: "1,000",
    price: "60",
    description: "For professional developers",
    features: [
      "1,000 AI agent requests / 5 hours",
      "Claude Code access",
      "Cursor access",
      "Codex access",
      "Priority support",
      "Advanced analytics",
    ],
    cta: "Join Waitlist",
    popular: true,
  },
  {
    name: "Team",
    requests: "3,000",
    price: "150",
    description: "For growing teams",
    features: [
      "3,000 AI agent requests / 5 hours",
      "Claude Code access",
      "Cursor access",
      "Codex access",
      "Dedicated support",
      "Team analytics",
      "SSOcoming soon",
    ],
    cta: "Join Waitlist",
    popular: false,
  },
];

const faqs = [
  {
    question: "What exactly is an AI agent request?",
    answer: "An AI agent request is counted each time you send a task to Claude Code, Cursor, or Codex through our API. A single coding task — like generating a file, explaining code, or running a fix — typically consumes one request. Streaming responses and context updates are included.",
  },
  {
    question: "What happens if I exceed my quota?",
    answer: "Your requests will queue briefly while your 5-hour rolling window refreshes. We won't charge overages. For teams, quotas are shared — each member draws from the same pool.",
  },
  {
    question: "Can I upgrade or downgrade anytime?",
    answer: "Yes. Upgrades take effect immediately. Downgrades take effect at the start of your next billing cycle. No lock-in, no cancellation fees.",
  },
  {
    question: "Is my data handled securely?",
    answer: "Absolutely. All data is encrypted in transit (TLS 1.3) and at rest. We never train on your code. API keys are hashed. Access logs are retained for 90 days.",
  },
  {
    question: "Do you offer a free trial?",
    answer: "The Starter plan includes a free tier for early users. You'll get a small ongoing request allowance — enough to keep developing on personal projects without a credit card.",
  },
];

const testimonials = [
  {
    quote: "Finally, no more rate limit nightmares. I shipped my side project in half the time.",
    author: "Marcus T.",
    role: "Indie Developer",
  },
  {
    quote: "The 5-hour window is a game changer. I stop worrying about quotas and start shipping.",
    author: "Priya S.",
    role: "Freelance Engineer",
  },
  {
    quote: "Cursor plus Aidevelo is my new default setup. It's just... effortless.",
    author: "Jordan K.",
    role: "CTO, Series A Startup",
  },
];

export function Landing() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
              AI
            </div>
            <span className="text-lg font-semibold tracking-tight">AIDEVELO</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
            <Button variant="outline" size="sm" asChild>
              <a href="/auth">Sign in</a>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 md:py-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-indigo-500/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-6xl px-4 text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-1 text-xs font-medium">
            Now in private beta — Join the waitlist
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] max-w-4xl mx-auto">
            AI Agent Requests,{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
              Simplified
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Get instant access to Claude Code, Cursor, and Codex — no setup, no rate limit
            headaches. Starting at{" "}
            <span className="font-semibold text-foreground">$20/month</span>.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  required
                />
                <Button type="submit" size="lg">
                  Start Free Trial
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                You're on the list! We'll be in touch soon.
              </div>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-y border-border/50 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
            <div className="text-center">
              <div className="text-3xl font-bold">1,000+</div>
              <div className="text-sm text-muted-foreground">Developers on waitlist</div>
            </div>
            <Separator orientation="vertical" className="hidden md:block h-10" />
            <div className="text-center">
              <div className="text-3xl font-bold">50M+</div>
              <div className="text-sm text-muted-foreground">Requests served</div>
            </div>
            <Separator orientation="vertical" className="hidden md:block h-10" />
            <div className="text-center">
              <div className="text-3xl font-bold">99.9%</div>
              <div className="text-sm text-muted-foreground">Uptime SLA</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <svg className="size-6 text-indigo-500 mb-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t.quote}</p>
                  <div className="mt-4">
                    <div className="text-sm font-medium">{t.author}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need to ship faster
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              One subscription. All the major AI coding agents. No juggling multiple accounts or
              hitting rate limits mid-sprint.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((f, i) => (
              <div key={i} className="flex flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">How it works</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              From signup to your first API call in under 60 seconds.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={i} className="relative flex flex-col gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
                  {s.number}
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute -top-4 left-7 hidden md:block w-[calc(100%-56px)] border-t border-dashed border-border" />
                )}
                <h3 className="text-xl font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              All plans include access to Claude Code, Cursor, and Codex. No hidden fees.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <Card
                key={i}
                className={`relative flex flex-col ${
                  plan.popular
                    ? "border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                    : "border-border/50"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-indigo-500 text-white hover:bg-indigo-600 px-3 py-1 text-xs font-medium">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-6 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    <span className="font-semibold text-foreground">{plan.requests}</span> requests / 5 hours
                  </div>
                  <Separator className="mb-4" />
                  <ul className="space-y-2.5">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2 text-sm">
                        <svg
                          className="size-4 text-indigo-500 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    variant={plan.popular ? "default" : "outline"}
                    className="w-full"
                    size="lg"
                    onClick={() => {
                      const el = document.querySelector('input[type="email"]') as HTMLInputElement;
                      el?.focus();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Frequently asked</h2>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {faqs.map((faq, i) => (
              <details key={i} className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 font-medium hover:bg-muted/50 transition-colors list-none">
                  {faq.question}
                  <svg className="size-4 shrink-0 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 border-t border-border/50">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ready to ship faster?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Join thousands of developers who've already signed up for the waitlist.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {!submitted ? (
              <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                  required
                />
                <Button type="submit" size="lg">
                  Get Early Access
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                You're on the list! We'll be in touch soon.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                AI
              </div>
              <span className="text-sm font-semibold">AIDEVELO</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Still have questions?{" "}
              <a href="mailto:hello@aidevelo.ai" className="underline hover:text-foreground">
                Talk to us
              </a>
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground">Privacy</a>
              <a href="#" className="hover:text-foreground">Terms</a>
              <a href="https://github.com/keokukzh/aidevelo" className="hover:text-foreground">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
