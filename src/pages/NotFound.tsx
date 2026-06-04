import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="text-xl text-muted-foreground">Page Not Found</p>
        <p className="text-sm text-muted-foreground mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <p className="text-xs text-muted-foreground font-mono mb-6 break-all max-w-sm">
          {location.pathname}
        </p>
        <Button
          onClick={() => navigate("/")}
          className="gap-2"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
