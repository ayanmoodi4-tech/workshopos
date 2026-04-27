import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
      data-ocid="not_found.page"
    >
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <SearchX size={28} className="text-muted-foreground" />
      </div>
      <h1 className="font-display font-bold text-3xl text-foreground mb-2">
        Page Not Found
      </h1>
      <p className="text-muted-foreground text-sm max-w-xs mb-6">
        The page you're looking for doesn't exist or you don't have access to
        it.
      </p>
      <Button asChild variant="outline" data-ocid="not_found.back_button">
        <Link to="/">
          <ArrowLeft size={16} className="mr-2" />
          Back to Dashboard
        </Link>
      </Button>
    </div>
  );
}
