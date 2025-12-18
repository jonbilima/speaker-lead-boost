import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Zap, Mail, Award, Target, Mic } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";

const Landing = () => {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      toast.success("You're on the list! We'll be in touch soon.");
      setEmail("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm fixed w-full z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Logo size="md" />
            <span className="text-xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              nextmic
            </span>
          </div>
          <Button onClick={() => navigate("/auth")} variant="outline" size="sm">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-8">
            <div className="inline-block">
              <div className="bg-accent/10 border border-accent/20 rounded-full px-4 py-2 text-sm font-medium text-accent mb-6">
                ✨ AI-Powered Lead Generation for Speakers
              </div>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              Get Booked Before{" "}
              <span className="bg-gradient-to-r from-accent via-primary to-accent bg-clip-text text-transparent">
                They Post the Call
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Stop chasing speaking gigs. Let AI find perfect opportunities, rank them by fit, 
              and generate winning pitches—all before your competitors even know they exist.
            </p>

            <form onSubmit={handleWaitlist} className="max-w-md mx-auto flex gap-3">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 text-base"
              />
              <Button type="submit" size="lg" className="bg-gradient-to-r from-accent to-primary hover:opacity-90 transition-opacity shadow-lg">
                Join Waitlist
              </Button>
            </form>

            <p className="text-sm text-muted-foreground">
              Join 500+ speakers already on the list
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: TrendingUp,
                title: "AI-Ranked Opportunities",
                description: "Every lead scored 1-100 based on your topics, fee range, and speaking history.",
              },
              {
                icon: Zap,
                title: "Auto-Discovery Engine",
                description: "We scan Twitter, Eventbrite, Sessionize, and more—daily—so you never miss a CFP.",
              },
              {
                icon: Mail,
                title: "Instant Pitch Generator",
                description: "GPT-4o crafts personalized cold emails using your bio and the event details.",
              },
              {
                icon: Target,
                title: "Booking Radar",
                description: "See when rivals get booked for similar events—proof there's budget to tap.",
              },
              {
                icon: Award,
                title: "Daily Top 10 Digest",
                description: "Wake up to your hottest gigs in your inbox, ranked and ready to pitch.",
              },
              {
                icon: Mic,
                title: "Speaker-First Design",
                description: "Built by speakers, for speakers. Clean, fast, and focused on getting you booked.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-card border border-border hover:border-accent/50 hover:shadow-xl transition-all duration-300"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/10 to-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-gradient-to-r from-accent to-primary rounded-3xl p-12 text-center shadow-2xl" style={{ boxShadow: "var(--shadow-glow)" }}>
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Ready to Get Fully Booked?
            </h2>
            <p className="text-primary-foreground/90 text-lg mb-8">
              Join the waitlist and be first to access nextmic when we launch.
            </p>
            <form onSubmit={handleWaitlist} className="max-w-md mx-auto flex gap-3">
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-background text-foreground"
              />
              <Button type="submit" size="lg" variant="secondary" className="shadow-lg">
                Get Early Access
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 mt-20">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; 2025 nextmic. Get booked faster.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
