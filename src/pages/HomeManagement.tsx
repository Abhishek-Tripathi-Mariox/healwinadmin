import React, { useEffect, useRef, useState } from "react";
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  Home,
  Zap,
  Smartphone,
  Award,
  MousePointerClick,
  Megaphone,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Upload,
  X,
} from "lucide-react";
import { homeContentApi } from "../services/admin-api";
import {
  PageHeader,
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Select,
  Spinner,
  cn,
} from "../components/ui";

/* ──────────── helper types ──────────── */

interface HeroStat {
  value: string;
  label: string;
  color: string;
}
interface CtaButton {
  label: string;
  icon: string;
  link: string;
  variant: "primary" | "outline";
}
interface FloatingCard {
  icon: string;
  label: string;
  value: string;
}
interface ActionScene {
  icon: string;
  title: string;
  description: string;
  stat: string;
  statLabel: string;
  gradient: string;
  bgColor: string;
}
interface AppFeature {
  icon: string;
  title: string;
  position: "left" | "right";
}
interface WhyReason {
  icon: string;
  title: string;
  description: string;
  stat: string;
  gradient: string;
  bgColor: string;
}
interface TrustIndicator {
  text: string;
  color: string;
}

interface HomeData {
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  heroImage: string;
  heroStats: HeroStat[];
  heroCtaButtons: CtaButton[];
  heroFloatingCards: FloatingCard[];

  servicesBadge: string;
  servicesTitle: string;
  servicesHighlight: string;
  servicesSubtitle: string;
  servicesCount: number;

  actionsBadge: string;
  actionsTitle: string;
  actionsHighlight: string;
  actionsSubtitle: string;
  actionsScenes: ActionScene[];
  actionsBottomText: string;

  appBadge: string;
  appTitle: string;
  appHighlight: string;
  appSubtitle: string;
  appFeatures: AppFeature[];
  appMockupImage: string;
  appStoreUrl: string;
  playStoreUrl: string;

  whyBadge: string;
  whyTitle: string;
  whyHighlight: string;
  whySubtitle: string;
  whyReasons: WhyReason[];

  ctaBadge: string;
  ctaTitle: string;
  ctaHighlight: string;
  ctaSubtitle: string;
  ctaButtons: CtaButton[];
  ctaTrustIndicators: TrustIndicator[];
}

const TABS = [
  { id: "hero", label: "Hero Banner", icon: Home },
  { id: "services", label: "Services", icon: Zap },
  { id: "actions", label: "Actions", icon: MousePointerClick },
  { id: "app", label: "Mobile App", icon: Smartphone },
  { id: "why", label: "Why HealWin", icon: Award },
  { id: "cta", label: "CTA Section", icon: Megaphone },
] as const;

type TabId = (typeof TABS)[number]["id"];

const EMPTY: HomeData = {
  heroBadge: "",
  heroTitle: "",
  heroHighlight: "",
  heroSubtitle: "",
  heroImage: "",
  heroStats: [],
  heroCtaButtons: [],
  heroFloatingCards: [],
  servicesBadge: "",
  servicesTitle: "",
  servicesHighlight: "",
  servicesSubtitle: "",
  servicesCount: 4,
  actionsBadge: "",
  actionsTitle: "",
  actionsHighlight: "",
  actionsSubtitle: "",
  actionsScenes: [],
  actionsBottomText: "",
  appBadge: "",
  appTitle: "",
  appHighlight: "",
  appSubtitle: "",
  appFeatures: [],
  appMockupImage: "",
  appStoreUrl: "",
  playStoreUrl: "",
  whyBadge: "",
  whyTitle: "",
  whyHighlight: "",
  whySubtitle: "",
  whyReasons: [],
  ctaBadge: "",
  ctaTitle: "",
  ctaHighlight: "",
  ctaSubtitle: "",
  ctaButtons: [],
  ctaTrustIndicators: [],
};

/* ──────────── Section panel ──────────── */

const Panel: React.FC<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <div className="p-5 bg-gray-50 rounded-xl">
    <div className="flex items-center justify-between mb-4">
      <h4 className="text-sm font-semibold tracking-wider text-gray-500 uppercase">
        {title}
      </h4>
      {action}
    </div>
    {children}
  </div>
);

/* ──────────── Reusable sub-component (outside main component to avoid re-mount) ──────────── */

const SectionHeader: React.FC<{
  badgeKey: keyof HomeData;
  titleKey: keyof HomeData;
  highlightKey: keyof HomeData;
  subtitleKey: keyof HomeData;
  label: string;
  data: HomeData;
  setField: <K extends keyof HomeData>(key: K, value: HomeData[K]) => void;
}> = ({
  badgeKey,
  titleKey,
  highlightKey,
  subtitleKey,
  label,
  data,
  setField,
}) => (
  <div className="p-5 mb-6 bg-gray-50 rounded-xl">
    <h4 className="mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
      {label} Header
    </h4>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Badge Text">
        <Input
          value={(data[badgeKey] as string) || ""}
          onChange={(e) =>
            setField(badgeKey, e.target.value as HomeData[keyof HomeData])
          }
        />
      </Field>
      <Field label="Highlight (gradient text)">
        <Input
          value={(data[highlightKey] as string) || ""}
          onChange={(e) =>
            setField(highlightKey, e.target.value as HomeData[keyof HomeData])
          }
        />
      </Field>
      <Field label="Title">
        <Input
          value={(data[titleKey] as string) || ""}
          onChange={(e) =>
            setField(titleKey, e.target.value as HomeData[keyof HomeData])
          }
        />
      </Field>
      <Field label="Subtitle" className="md:col-span-2">
        <Textarea
          rows={2}
          value={(data[subtitleKey] as string) || ""}
          onChange={(e) =>
            setField(subtitleKey, e.target.value as HomeData[keyof HomeData])
          }
        />
      </Field>
    </div>
  </div>
);

/* ──────────── Component ──────────── */

const HomeManagement: React.FC = () => {
  const [data, setData] = useState<HomeData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("hero");
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const heroImageInputRef = useRef<HTMLInputElement>(null);
  const [appMockupImageFile, setAppMockupImageFile] = useState<File | null>(null);
  const [appMockupImagePreview, setAppMockupImagePreview] = useState<string | null>(null);
  const appMockupImageInputRef = useRef<HTMLInputElement>(null);

  /* ── Load ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await homeContentApi.get();
        if (res.data) {
          setData({ ...EMPTY, ...res.data });
        }
      } catch {
        showToast("Failed to load home content", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ── Save ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      await homeContentApi.update(data, heroImageFile || undefined, appMockupImageFile || undefined);
      setHeroImageFile(null);
      setAppMockupImageFile(null);
      showToast("Home page content saved successfully!", "success");
    } catch {
      showToast("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ── Field helpers ── */
  const setField = <K extends keyof HomeData>(key: K, value: HomeData[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  /* ── Array helpers ── */
  const addItem = <K extends keyof HomeData>(
    key: K,
    item: HomeData[K] extends (infer U)[] ? U : never,
  ) =>
    setData((prev) => ({
      ...prev,
      [key]: [...(prev[key] as unknown[]), item],
    }));

  const removeItem = (key: keyof HomeData, idx: number) =>
    setData((prev) => ({
      ...prev,
      [key]: (prev[key] as unknown[]).filter(
        (_: unknown, i: number) => i !== idx,
      ),
    }));

  const updateItem = <K extends keyof HomeData>(
    key: K,
    idx: number,
    patch: Partial<HomeData[K] extends (infer U)[] ? U : never>,
  ) =>
    setData((prev) => ({
      ...prev,
      [key]: (prev[key] as unknown as Record<string, unknown>[]).map(
        (item: Record<string, unknown>, i: number) =>
          i === idx ? { ...item, ...patch } : item,
      ),
    }));

  /* ── Tab content ── */

  const renderHero = () => (
    <div className="space-y-6">
      <SectionHeader
        badgeKey="heroBadge"
        titleKey="heroTitle"
        highlightKey="heroHighlight"
        subtitleKey="heroSubtitle"
        label="Hero"
        data={data}
        setField={setField}
      />

      {/* Hero Image */}
      <Panel title="Hero Image">
        <input
          ref={heroImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setHeroImageFile(file);
              setHeroImagePreview(URL.createObjectURL(file));
            }
          }}
        />
        <button
          type="button"
          onClick={() => heroImageInputRef.current?.click()}
          className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm text-gray-600 transition-colors border-2 border-gray-300 border-dashed rounded-lg hover:border-healwin-400 hover:text-healwin-600"
        >
          <Upload size={16} />
          {heroImageFile ? heroImageFile.name : "Choose hero image"}
        </button>
        {heroImageFile && (
          <button
            type="button"
            onClick={() => {
              setHeroImageFile(null);
              setHeroImagePreview(null);
              if (heroImageInputRef.current)
                heroImageInputRef.current.value = "";
            }}
            className="flex items-center gap-1 mt-2 text-xs text-red-500 hover:text-red-700"
          >
            <X size={14} /> Remove selected file
          </button>
        )}
        {(heroImagePreview || data.heroImage) && (
          <img
            src={heroImagePreview || data.heroImage}
            alt="Hero preview"
            className="object-cover w-full h-40 mt-3 rounded-lg"
          />
        )}
      </Panel>

      {/* Stats */}
      <Panel
        title="Stats (shown below hero text)"
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<Plus className="w-4 h-4" />}
            onClick={() =>
              addItem("heroStats", {
                value: "",
                label: "",
                color: "text-hw-primary",
              })
            }
          >
            Add
          </Button>
        }
      >
        {data.heroStats.map((s, i) => (
          <div key={i} className="flex items-end gap-3 mb-3">
            <Field label="Value" className="flex-1">
              <Input
                value={s.value}
                onChange={(e) =>
                  updateItem("heroStats", i, { value: e.target.value })
                }
              />
            </Field>
            <Field label="Label" className="flex-1">
              <Input
                value={s.label}
                onChange={(e) =>
                  updateItem("heroStats", i, { label: e.target.value })
                }
              />
            </Field>
            <Field label="Color Class" className="w-40">
              <Input
                value={s.color}
                onChange={(e) =>
                  updateItem("heroStats", i, { color: e.target.value })
                }
              />
            </Field>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => removeItem("heroStats", i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </Panel>

      {/* CTA Buttons */}
      <Panel
        title="CTA Buttons"
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<Plus className="w-4 h-4" />}
            onClick={() =>
              addItem("heroCtaButtons", {
                label: "",
                icon: "",
                link: "",
                variant: "primary",
              })
            }
          >
            Add
          </Button>
        }
      >
        {data.heroCtaButtons.map((b, i) => (
          <div key={i} className="flex items-end gap-3 mb-3">
            <Field label="Label" className="flex-1">
              <Input
                value={b.label}
                onChange={(e) =>
                  updateItem("heroCtaButtons", i, { label: e.target.value })
                }
              />
            </Field>
            <Field label="Icon" className="w-28">
              <Input
                value={b.icon}
                onChange={(e) =>
                  updateItem("heroCtaButtons", i, { icon: e.target.value })
                }
              />
            </Field>
            <Field label="Link" className="flex-1">
              <Input
                value={b.link}
                onChange={(e) =>
                  updateItem("heroCtaButtons", i, { link: e.target.value })
                }
              />
            </Field>
            <Field label="Variant" className="w-28">
              <Select
                value={b.variant}
                onChange={(e) =>
                  updateItem("heroCtaButtons", i, {
                    variant: e.target.value as "primary" | "outline",
                  })
                }
              >
                <option value="primary">Primary</option>
                <option value="outline">Outline</option>
              </Select>
            </Field>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => removeItem("heroCtaButtons", i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </Panel>

      {/* Floating Cards */}
      <Panel
        title="Floating Cards (on hero image)"
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<Plus className="w-4 h-4" />}
            onClick={() =>
              addItem("heroFloatingCards", {
                icon: "",
                label: "",
                value: "",
              })
            }
          >
            Add
          </Button>
        }
      >
        {data.heroFloatingCards.map((c, i) => (
          <div key={i} className="flex items-end gap-3 mb-3">
            <Field label="Icon" className="w-28">
              <Input
                value={c.icon}
                onChange={(e) =>
                  updateItem("heroFloatingCards", i, { icon: e.target.value })
                }
              />
            </Field>
            <Field label="Label" className="flex-1">
              <Input
                value={c.label}
                onChange={(e) =>
                  updateItem("heroFloatingCards", i, { label: e.target.value })
                }
              />
            </Field>
            <Field label="Value" className="flex-1">
              <Input
                value={c.value}
                onChange={(e) =>
                  updateItem("heroFloatingCards", i, { value: e.target.value })
                }
              />
            </Field>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => removeItem("heroFloatingCards", i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </Panel>
    </div>
  );

  const renderServices = () => (
    <div className="space-y-6">
      <SectionHeader
        badgeKey="servicesBadge"
        titleKey="servicesTitle"
        highlightKey="servicesHighlight"
        subtitleKey="servicesSubtitle"
        label="Services"
        data={data}
        setField={setField}
      />

      <Panel title="Display Settings">
        <div className="max-w-xs">
          <Field label="Number of top services to show">
            <Input
              type="number"
              min={1}
              max={12}
              value={data.servicesCount}
              onChange={(e) =>
                setField("servicesCount", parseInt(e.target.value) || 4)
              }
            />
          </Field>
          <p className="mt-1 text-xs text-gray-400">
            Services are pulled from the Services module, sorted by priority and
            sort order. Manage services in{" "}
            <a href="/admin/services" className="text-healwin-600 hover:underline">
              Services Management
            </a>
            .
          </p>
        </div>
      </Panel>
    </div>
  );

  const renderActions = () => (
    <div className="space-y-6">
      <SectionHeader
        badgeKey="actionsBadge"
        titleKey="actionsTitle"
        highlightKey="actionsHighlight"
        subtitleKey="actionsSubtitle"
        label="Actions"
        data={data}
        setField={setField}
      />

      {/* Scenes */}
      <Panel
        title="Action Scenes"
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<Plus className="w-4 h-4" />}
            onClick={() =>
              addItem("actionsScenes", {
                icon: "Heart",
                title: "",
                description: "",
                stat: "",
                statLabel: "",
                gradient: "from-hw-primary to-hw-primary-dark",
                bgColor: "bg-blue-50",
              })
            }
          >
            Add Scene
          </Button>
        }
      >
        {data.actionsScenes.map((s, i) => (
          <CollapsibleCard
            key={i}
            title={s.title || `Scene ${i + 1}`}
            onRemove={() => removeItem("actionsScenes", i)}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Icon">
                <Input
                  value={s.icon}
                  onChange={(e) =>
                    updateItem("actionsScenes", i, { icon: e.target.value })
                  }
                />
              </Field>
              <Field label="Title">
                <Input
                  value={s.title}
                  onChange={(e) =>
                    updateItem("actionsScenes", i, { title: e.target.value })
                  }
                />
              </Field>
              <Field label="Description" className="col-span-2">
                <Textarea
                  rows={2}
                  value={s.description}
                  onChange={(e) =>
                    updateItem("actionsScenes", i, {
                      description: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Stat Value">
                <Input
                  value={s.stat}
                  onChange={(e) =>
                    updateItem("actionsScenes", i, { stat: e.target.value })
                  }
                />
              </Field>
              <Field label="Stat Label">
                <Input
                  value={s.statLabel}
                  onChange={(e) =>
                    updateItem("actionsScenes", i, {
                      statLabel: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Gradient (e.g. from-hw-sos to-red-600)">
                <Input
                  value={s.gradient}
                  onChange={(e) =>
                    updateItem("actionsScenes", i, { gradient: e.target.value })
                  }
                />
              </Field>
              <Field label="Bg Color (e.g. bg-red-50)">
                <Input
                  value={s.bgColor}
                  onChange={(e) =>
                    updateItem("actionsScenes", i, { bgColor: e.target.value })
                  }
                />
              </Field>
            </div>
          </CollapsibleCard>
        ))}
      </Panel>

      {/* Bottom Text */}
      <Panel title="Bottom Paragraph">
        <Field label="Bottom Paragraph (optional HTML)">
          <Textarea
            rows={3}
            value={data.actionsBottomText}
            onChange={(e) => setField("actionsBottomText", e.target.value)}
          />
        </Field>
      </Panel>
    </div>
  );

  const renderApp = () => (
    <div className="space-y-6">
      <SectionHeader
        badgeKey="appBadge"
        titleKey="appTitle"
        highlightKey="appHighlight"
        subtitleKey="appSubtitle"
        label="Mobile App"
        data={data}
        setField={setField}
      />

      {/* Features */}
      <Panel
        title="App Features"
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<Plus className="w-4 h-4" />}
            onClick={() =>
              addItem("appFeatures", {
                icon: "Heart",
                title: "",
                position: "left",
              })
            }
          >
            Add
          </Button>
        }
      >
        {data.appFeatures.map((f, i) => (
          <div key={i} className="flex items-end gap-3 mb-3">
            <Field label="Icon" className="w-28">
              <Input
                value={f.icon}
                onChange={(e) =>
                  updateItem("appFeatures", i, { icon: e.target.value })
                }
              />
            </Field>
            <Field label="Title" className="flex-1">
              <Input
                value={f.title}
                onChange={(e) =>
                  updateItem("appFeatures", i, { title: e.target.value })
                }
              />
            </Field>
            <Field label="Position" className="w-28">
              <Select
                value={f.position}
                onChange={(e) =>
                  updateItem("appFeatures", i, {
                    position: e.target.value as "left" | "right",
                  })
                }
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </Select>
            </Field>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => removeItem("appFeatures", i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </Panel>

      {/* App Mockup Image */}
      <Panel title="Phone Mockup Screenshot">
        <p className="mb-3 text-xs text-gray-500">
          Upload a screenshot to replace the default phone UI. Use a 9:19 aspect ratio image for best results.
        </p>
        <input
          ref={appMockupImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setAppMockupImageFile(file);
              setAppMockupImagePreview(URL.createObjectURL(file));
            }
          }}
        />
        <button
          type="button"
          onClick={() => appMockupImageInputRef.current?.click()}
          className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm text-gray-600 transition-colors border-2 border-gray-300 border-dashed rounded-lg hover:border-healwin-400 hover:text-healwin-600"
        >
          <Upload size={16} />
          {appMockupImageFile ? appMockupImageFile.name : "Choose mockup image"}
        </button>
        {appMockupImageFile && (
          <button
            type="button"
            onClick={() => {
              setAppMockupImageFile(null);
              setAppMockupImagePreview(null);
              if (appMockupImageInputRef.current)
                appMockupImageInputRef.current.value = "";
            }}
            className="flex items-center gap-1 mt-2 text-xs text-red-500 hover:text-red-700"
          >
            <X size={14} /> Remove selected file
          </button>
        )}
        {(appMockupImagePreview || data.appMockupImage) && (
          <img
            src={appMockupImagePreview || data.appMockupImage}
            alt="Mockup preview"
            className="object-contain w-48 mx-auto mt-3 rounded-lg border"
          />
        )}
      </Panel>

      {/* Store Links */}
      <Panel title="Store Links">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="App Store URL">
            <Input
              value={data.appStoreUrl}
              onChange={(e) => setField("appStoreUrl", e.target.value)}
              placeholder="https://apps.apple.com/..."
            />
          </Field>
          <Field label="Play Store URL">
            <Input
              value={data.playStoreUrl}
              onChange={(e) => setField("playStoreUrl", e.target.value)}
              placeholder="https://play.google.com/store/apps/..."
            />
          </Field>
        </div>
      </Panel>
    </div>
  );

  const renderWhy = () => (
    <div className="space-y-6">
      <SectionHeader
        badgeKey="whyBadge"
        titleKey="whyTitle"
        highlightKey="whyHighlight"
        subtitleKey="whySubtitle"
        label="Why HealWin"
        data={data}
        setField={setField}
      />

      <Panel
        title="Reasons / Trust Cards"
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<Plus className="w-4 h-4" />}
            onClick={() =>
              addItem("whyReasons", {
                icon: "Heart",
                title: "",
                description: "",
                stat: "",
                gradient: "from-hw-primary to-hw-primary-dark",
                bgColor: "bg-blue-50",
              })
            }
          >
            Add Card
          </Button>
        }
      >
        {data.whyReasons.map((r, i) => (
          <CollapsibleCard
            key={i}
            title={r.title || `Reason ${i + 1}`}
            onRemove={() => removeItem("whyReasons", i)}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Icon">
                <Input
                  value={r.icon}
                  onChange={(e) =>
                    updateItem("whyReasons", i, { icon: e.target.value })
                  }
                />
              </Field>
              <Field label="Title">
                <Input
                  value={r.title}
                  onChange={(e) =>
                    updateItem("whyReasons", i, { title: e.target.value })
                  }
                />
              </Field>
              <Field label="Description" className="col-span-2">
                <Textarea
                  rows={2}
                  value={r.description}
                  onChange={(e) =>
                    updateItem("whyReasons", i, {
                      description: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Stat Value">
                <Input
                  value={r.stat}
                  onChange={(e) =>
                    updateItem("whyReasons", i, { stat: e.target.value })
                  }
                />
              </Field>
              <Field label="Gradient">
                <Input
                  value={r.gradient}
                  onChange={(e) =>
                    updateItem("whyReasons", i, { gradient: e.target.value })
                  }
                />
              </Field>
              <Field label="Bg Color">
                <Input
                  value={r.bgColor}
                  onChange={(e) =>
                    updateItem("whyReasons", i, { bgColor: e.target.value })
                  }
                />
              </Field>
            </div>
          </CollapsibleCard>
        ))}
      </Panel>
    </div>
  );

  const renderCta = () => (
    <div className="space-y-6">
      <SectionHeader
        badgeKey="ctaBadge"
        titleKey="ctaTitle"
        highlightKey="ctaHighlight"
        subtitleKey="ctaSubtitle"
        label="CTA"
        data={data}
        setField={setField}
      />

      {/* CTA Buttons */}
      <Panel
        title="CTA Buttons"
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<Plus className="w-4 h-4" />}
            onClick={() =>
              addItem("ctaButtons", {
                label: "",
                icon: "",
                link: "",
                variant: "primary",
              })
            }
          >
            Add
          </Button>
        }
      >
        {data.ctaButtons.map((b, i) => (
          <div key={i} className="flex items-end gap-3 mb-3">
            <Field label="Label" className="flex-1">
              <Input
                value={b.label}
                onChange={(e) =>
                  updateItem("ctaButtons", i, { label: e.target.value })
                }
              />
            </Field>
            <Field label="Icon" className="w-28">
              <Input
                value={b.icon}
                onChange={(e) =>
                  updateItem("ctaButtons", i, { icon: e.target.value })
                }
              />
            </Field>
            <Field label="Link" className="flex-1">
              <Input
                value={b.link}
                onChange={(e) =>
                  updateItem("ctaButtons", i, { link: e.target.value })
                }
              />
            </Field>
            <Field label="Variant" className="w-28">
              <Select
                value={b.variant}
                onChange={(e) =>
                  updateItem("ctaButtons", i, {
                    variant: e.target.value as "primary" | "outline",
                  })
                }
              >
                <option value="primary">Primary</option>
                <option value="outline">Outline</option>
              </Select>
            </Field>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => removeItem("ctaButtons", i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </Panel>

      {/* Trust Indicators */}
      <Panel
        title="Trust Indicators"
        action={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={<Plus className="w-4 h-4" />}
            onClick={() =>
              addItem("ctaTrustIndicators", {
                text: "",
                color: "bg-green-500",
              })
            }
          >
            Add
          </Button>
        }
      >
        {data.ctaTrustIndicators.map((t, i) => (
          <div key={i} className="flex items-end gap-3 mb-3">
            <Field label="Text" className="flex-1">
              <Input
                value={t.text}
                onChange={(e) =>
                  updateItem("ctaTrustIndicators", i, { text: e.target.value })
                }
              />
            </Field>
            <Field label="Dot Color (e.g. bg-green-500)" className="w-40">
              <Input
                value={t.color}
                onChange={(e) =>
                  updateItem("ctaTrustIndicators", i, { color: e.target.value })
                }
              />
            </Field>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={() => removeItem("ctaTrustIndicators", i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </Panel>
    </div>
  );

  const TAB_RENDER: Record<TabId, () => React.ReactNode> = {
    hero: renderHero,
    services: renderServices,
    actions: renderActions,
    app: renderApp,
    why: renderWhy,
    cta: renderCta,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium",
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600",
          )}
        >
          {toast.msg}
        </div>
      )}

      <PageHeader
        title="Home Page Management"
        subtitle="Manage all sections of the homepage from here"
        actions={
          <Button
            onClick={handleSave}
            disabled={saving}
            icon={
              saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )
            }
          >
            {saving ? "Saving..." : "Save All Changes"}
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 mb-6 overflow-x-auto bg-gray-100 rounded-xl">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                isActive
                  ? "bg-white text-healwin-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <Card className="p-6">{TAB_RENDER[activeTab]()}</Card>
    </div>
  );
};

/* ──────────── Collapsible Card ──────────── */

const CollapsibleCard: React.FC<{
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
}> = ({ title, onRemove, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 overflow-hidden bg-white border rounded-xl">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-300" />
          <span className="text-sm font-medium text-gray-700">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 text-red-400 rounded hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {open ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

export default HomeManagement;
