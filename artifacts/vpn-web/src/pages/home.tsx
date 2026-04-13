import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Shield, Zap, Globe, Lock } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight text-primary">
            KETANTECH
          </div>
          <nav className="flex items-center gap-4">
            {isAuthenticated ? (
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="py-24 lg:py-32 px-4 text-center bg-gradient-to-b from-background to-accent/20">
          <div className="container mx-auto max-w-4xl space-y-8">
            <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium bg-background shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              Premium VPN Services for Indonesia
            </div>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground">
              Unrestricted Access.<br className="hidden sm:block" />
              <span className="text-primary">Zero Compromise.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Experience lightning-fast speeds and enterprise-grade security with our premium SSH, VMess, VLess, and Trojan servers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
              <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8" asChild>
                <Link href="/register">Start Now</Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8" asChild>
                <Link href="/products">View Plans</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-4 bg-background">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="p-6 rounded-2xl bg-card border shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Ultra Fast</h3>
                <p className="text-muted-foreground">High-performance servers optimized for gaming and streaming.</p>
              </div>
              <div className="p-6 rounded-2xl bg-card border shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Secure</h3>
                <p className="text-muted-foreground">Military-grade encryption protects your data from prying eyes.</p>
              </div>
              <div className="p-6 rounded-2xl bg-card border shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Globe className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Global Network</h3>
                <p className="text-muted-foreground">Servers in multiple countries for unrestricted access worldwide.</p>
              </div>
              <div className="p-6 rounded-2xl bg-card border shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">No Logs</h3>
                <p className="text-muted-foreground">Strict no-logs policy. Your browsing history is your business.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t bg-card text-center text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} KETANTECH VPN Store. All rights reserved.</p>
      </footer>
    </div>
  );
}
