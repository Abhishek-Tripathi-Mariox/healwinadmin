import { ShieldAlert } from "lucide-react";
import { useAuth } from "../auth/useAuth";

/**
 * Sidebar links already hide modules the current role can't see, but that
 * only hides the nav — typing the URL directly (or an old bookmark) still
 * rendered the page and let it fire API calls, relying entirely on the
 * backend to 403 the data. This blocks the page itself so an unauthorized
 * role sees a clear "not permitted" screen instead of a half-populated,
 * error-riddled one.
 *
 * `moduleId` is derived from the route path the same way Sidebar.tsx node
 * ids are named (see routes.tsx / permissions.ts's SIDEBAR_PERMISSION_MAP)
 * so the two stay in lockstep automatically.
 */
const deriveModuleId = (routePath: string): string => {
  const overrides: Record<string, string> = {
    "article-submissions": "submissions",
  };
  if (overrides[routePath]) return overrides[routePath];
  return routePath
    .split("/")
    .filter((seg) => !seg.startsWith(":"))
    .join("-");
};

export default function ModuleGuard({
  routePath,
  children,
}: {
  routePath: string;
  children: React.ReactNode;
}) {
  const { canAccessModule } = useAuth();
  const moduleId = deriveModuleId(routePath);

  if (!canAccessModule(moduleId)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-800">Access Denied</h2>
        <p className="max-w-sm text-sm text-gray-500">
          Your role doesn't have permission to view this page. Contact an admin if you believe this is a mistake.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
