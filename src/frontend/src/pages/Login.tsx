import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Loader2, ShieldCheck, Wrench } from "lucide-react";

export default function Login() {
  const { login, isLoggingIn, isInitializing } = useInternetIdentity();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-8 space-y-6">
          {/* Logo */}
          <div className="flex flex-col items-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-sm">
              <Wrench size={26} className="text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="font-display font-bold text-2xl text-foreground">
                WorkshopOS
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Internal Management System
              </p>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Auth section */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">
                Sign in to continue
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use your Internet Identity to access the workshop management
                portal. Contact your administrator if you need access.
              </p>
            </div>

            <Button
              onClick={login}
              disabled={isLoggingIn || isInitializing}
              data-ocid="login.submit_button"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-10"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Signing in…
                </>
              ) : isInitializing ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Initializing…
                </>
              ) : (
                <>
                  <ShieldCheck size={16} className="mr-2" />
                  Sign in with Internet Identity
                </>
              )}
            </Button>
          </div>

          {/* Info */}
          <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-foreground">
              Access levels
            </p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>Admin — Full system access</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Workshop Manager — Jobs & workers</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span>Sales Manager — Job creation & products</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} WorkshopOS. Powered by{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            className="underline hover:text-foreground"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}
