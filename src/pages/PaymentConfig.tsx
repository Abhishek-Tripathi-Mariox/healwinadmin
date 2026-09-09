// Payment gateway credentials. The keys live in the database (encrypted), not
// in a .env on the server, so they can be rotated without a redeploy.
import { useCallback, useEffect, useState } from "react";
import {
  CreditCard, Copy, Check, ShieldCheck, Plug, AlertTriangle, Eye, EyeOff,
} from "lucide-react";
import { paymentConfigApi } from "../services/admin-api";
import { useAuth } from "../auth/useAuth";
import { PERMISSIONS } from "../auth/permissions";
import { PageHeader, Button, Card, Input, Field, Alert, Badge } from "../components/ui";

interface Config {
  configured: boolean;
  source: "database" | "env" | "none";
  provider: string;
  keyId: string;
  keySecretMasked: string;
  webhookConfigured: boolean;
  mode: "test" | "live";
  enabled: boolean;
  updatedAt: string | null;
  webhookUrl: string;
  webhookPath: string;
  webhookEvents: string[];
}

export default function PaymentConfig() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.PAYMENT_CONFIG_MANAGE);

  const [cfg, setCfg] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [copied, setCopied] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentConfigApi.get();
      const data: Config = res.data;
      setCfg(data);
      setKeyId(data.keyId || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the payment configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The server builds this from its OWN host. The admin panel and the API are
  // different domains in production, so anything derived from this browser's
  // origin would be pasted into Razorpay as a URL that goes nowhere.
  const webhookUrl = cfg?.webhookUrl || "";

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the URL and copy it manually.");
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await paymentConfigApi.update({
        keyId: keyId.trim(),
        // Blank means "keep the stored secret" — the field is never
        // pre-filled with the real value, so sending "" must not wipe it.
        keySecret: keySecret.trim(),
        webhookSecret: webhookSecret.trim() || undefined,
      });
      setOk(res.data?.warning || "Configuration saved.");
      setKeySecret("");
      setWebhookSecret("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the configuration.");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError("");
    setOk("");
    try {
      const res = await paymentConfigApi.test();
      setOk(res.data?.message || "Connection successful.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Payment Configuration"
        subtitle="Gateway credentials used for wallet top-ups and online payments."
        actions={
          cfg?.configured ? (
            <Badge tone={cfg.mode === "live" ? "success" : "warning"}>
              {cfg.mode === "live" ? "Live mode" : "Test mode"}
            </Badge>
          ) : (
            <Badge tone="danger">Not configured</Badge>
          )
        }
      />

      {error && <Alert className="mb-4">{error}</Alert>}
      {ok && <Alert tone="success" className="mb-4">{ok}</Alert>}

      {/* Credentials saved here override anything in the server environment.
          Saying so avoids the classic "I changed the key and nothing happened"
          confusion when an old env var is still in place. */}
      {cfg?.source === "env" && (
        <Alert tone="info" className="mb-4">
          Payments are currently running on keys set in the server environment.
          Anything you save here will take over from them.
        </Alert>
      )}
      {cfg?.mode === "live" && (
        <Alert tone="warning" className="mb-4">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            These are live keys — customers are charged real money.
          </span>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card padded className="lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <CreditCard className="h-4 w-4 text-blue-600" />
            Gateway credentials
          </h2>

          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <div className="space-y-4">
              <Field label="Provider">
                <Input value="Razorpay" disabled readOnly />
              </Field>

              <Field
                label="Key ID"
                hint="Razorpay Dashboard → Settings → API Keys. Starts with rzp_test_ or rzp_live_."
              >
                <Input
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  placeholder="rzp_live_XXXXXXXXXXXXXX"
                  disabled={!canManage}
                />
              </Field>

              <Field
                label="Key Secret"
                hint={
                  cfg?.keySecretMasked
                    ? `Currently ${cfg.keySecretMasked} — leave blank to keep it.`
                    : "Shown by Razorpay only once, when the key is created."
                }
              >
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={keySecret}
                    onChange={(e) => setKeySecret(e.target.value)}
                    placeholder={cfg?.keySecretMasked ? "•••••••• (unchanged)" : "Enter the key secret"}
                    disabled={!canManage}
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showSecret ? "Hide secret" : "Show secret"}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <Field
                label="Webhook Secret"
                hint={
                  cfg?.webhookConfigured
                    ? "A webhook secret is saved. Leave blank to keep it."
                    : "The secret you set on the webhook in the Razorpay dashboard."
                }
              >
                <Input
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={cfg?.webhookConfigured ? "•••••••• (unchanged)" : "Enter the webhook secret"}
                  disabled={!canManage}
                />
              </Field>

              <div className="flex items-center gap-3 pt-1">
                <Button onClick={save} disabled={!canManage || saving}>
                  {saving ? "Saving…" : "Save Configuration"}
                </Button>
                <Button variant="secondary" onClick={test} disabled={testing || !cfg?.configured}>
                  <Plug className="mr-1.5 h-4 w-4" />
                  {testing ? "Testing…" : "Test connection"}
                </Button>
              </div>

              <p className="flex items-start gap-2 pt-1 text-xs text-gray-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Credentials are encrypted with AES-256 before being stored in the
                database, and are never sent back to this screen in full.
              </p>
            </div>
          )}
        </Card>

        <Card padded>
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Webhook</h2>
          <p className="mb-2 text-xs text-gray-500">
            Add this URL in Razorpay → Settings → Webhooks. It is what credits a
            wallet when a customer's app closes before the payment finishes.
          </p>

          <div className="flex items-stretch gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              {webhookUrl || "—"}
            </code>
            <Button variant="secondary" onClick={copyWebhook} disabled={!webhookUrl}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-gray-600">Events to enable</p>
            <div className="flex flex-wrap gap-1.5">
              {(cfg?.webhookEvents || []).map((e) => (
                <Badge key={e} tone="neutral">{e}</Badge>
              ))}
            </div>
          </div>

          {cfg?.updatedAt && (
            <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
              Last updated {new Date(cfg.updatedAt).toLocaleString("en-IN")}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
