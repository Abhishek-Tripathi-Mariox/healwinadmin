import React, { useEffect, useState } from "react";
import { aboutContentApi } from "../services/admin-api";
import {
  PageHeader,
  Button,
  Card,
  Field,
  Input,
  Textarea,
  Select,
  Alert,
  Spinner,
  cn,
} from "../components/ui";

interface StatItem {
  icon: string;
  value: string;
  label: string;
  useRealCount: boolean;
  countSource: string;
}

interface CoreValueItem {
  icon: string;
  title: string;
  description: string;
}

interface AboutData {
  _id?: string;
  heroBadge: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  stats: StatItem[];
  missionTitle: string;
  missionText: string;
  visionTitle: string;
  visionText: string;
  valuesHeading: string;
  valuesSubheading: string;
  coreValues: CoreValueItem[];
  storyTitle: string;
  storyParagraphs: string[];
  updatedBy?: { name: string; email: string };
  updatedAt?: string;
}

const ICON_OPTIONS = [
  "Heart",
  "MapPin",
  "Users",
  "Shield",
  "Clock",
  "Award",
  "Target",
  "Eye",
  "Star",
  "Zap",
  "Activity",
  "Building2",
  "Stethoscope",
];
const COUNT_SOURCE_OPTIONS = [
  { value: "", label: "Manual (use entered value)" },
  { value: "centres", label: "Health Centres count (from DB)" },
  { value: "states", label: "States count (from DB)" },
];

const emptyForm: AboutData = {
  heroBadge: "About HealWin",
  heroTitle: "Transforming Healthcare in",
  heroHighlight: "Northeast India",
  heroSubtitle: "",
  stats: [
    {
      icon: "Heart",
      value: "50+",
      label: "Ambulances",
      useRealCount: false,
      countSource: "",
    },
    {
      icon: "MapPin",
      value: "100+",
      label: "Health Centres",
      useRealCount: true,
      countSource: "centres",
    },
    {
      icon: "Users",
      value: "50K+",
      label: "Families Served",
      useRealCount: false,
      countSource: "",
    },
    {
      icon: "Shield",
      value: "8",
      label: "States Covered",
      useRealCount: true,
      countSource: "states",
    },
  ],
  missionTitle: "Our Mission",
  missionText: "",
  visionTitle: "Our Vision",
  visionText: "",
  valuesHeading: "Our Core Values",
  valuesSubheading: "",
  coreValues: [{ icon: "Heart", title: "", description: "" }],
  storyTitle: "Our Story",
  storyParagraphs: [""],
};

const AboutManagement: React.FC = () => {
  const [form, setForm] = useState<AboutData>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      setLoading(true);
      const res = await aboutContentApi.get();
      if (res.data) {
        setForm(res.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load about content");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await aboutContentApi.update(form);
      setSuccess("About page content updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
      loadContent();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Stats helpers
  const updateStat = (index: number, field: keyof StatItem, value: any) => {
    const newStats = [...form.stats];
    newStats[index] = { ...newStats[index], [field]: value };
    setForm({ ...form, stats: newStats });
  };
  const addStat = () => {
    setForm({
      ...form,
      stats: [
        ...form.stats,
        {
          icon: "Heart",
          value: "0",
          label: "",
          useRealCount: false,
          countSource: "",
        },
      ],
    });
  };
  const removeStat = (index: number) => {
    setForm({ ...form, stats: form.stats.filter((_, i) => i !== index) });
  };

  // Core values helpers
  const updateValue = (
    index: number,
    field: keyof CoreValueItem,
    value: string,
  ) => {
    const newValues = [...form.coreValues];
    newValues[index] = { ...newValues[index], [field]: value };
    setForm({ ...form, coreValues: newValues });
  };
  const addValue = () => {
    setForm({
      ...form,
      coreValues: [
        ...form.coreValues,
        { icon: "Heart", title: "", description: "" },
      ],
    });
  };
  const removeValue = (index: number) => {
    setForm({
      ...form,
      coreValues: form.coreValues.filter((_, i) => i !== index),
    });
  };

  // Story paragraphs helpers
  const updateParagraph = (index: number, value: string) => {
    const newParagraphs = [...form.storyParagraphs];
    newParagraphs[index] = value;
    setForm({ ...form, storyParagraphs: newParagraphs });
  };
  const addParagraph = () => {
    setForm({ ...form, storyParagraphs: [...form.storyParagraphs, ""] });
  };
  const removeParagraph = (index: number) => {
    setForm({
      ...form,
      storyParagraphs: form.storyParagraphs.filter((_, i) => i !== index),
    });
  };

  const sections = [
    { id: "hero", label: "Hero Section" },
    { id: "stats", label: "Stats" },
    { id: "mission", label: "Mission & Vision" },
    { id: "values", label: "Core Values" },
    { id: "story", label: "Our Story" },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Spinner className="mx-auto mb-4 h-10 w-10" />
          <p className="text-gray-500">Loading about content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="About Page Management"
        subtitle={
          form.updatedBy
            ? `Manage the content displayed on the public About page · Last updated by ${form.updatedBy.name}${
                form.updatedAt
                  ? ` on ${new Date(form.updatedAt).toLocaleDateString()}`
                  : ""
              }`
            : "Manage the content displayed on the public About page"
        }
      />

      {error && (
        <Alert className="mb-4" tone="danger">
          <span className="flex items-center justify-between gap-4">
            {error}
            <button onClick={() => setError("")} className="font-bold">
              ✕
            </button>
          </span>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4" tone="success">
          {success}
        </Alert>
      )}

      {/* Section Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              activeSection === s.id
                ? "bg-white text-healwin-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Hero Section */}
      {activeSection === "hero" && (
        <Card padded className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Hero Section
          </h2>
          <Field label="Badge Text">
            <Input
              type="text"
              value={form.heroBadge}
              onChange={(e) => setForm({ ...form, heroBadge: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Title (before highlight)">
              <Input
                type="text"
                value={form.heroTitle}
                onChange={(e) =>
                  setForm({ ...form, heroTitle: e.target.value })
                }
              />
            </Field>
            <Field label="Highlighted Text (gradient color)">
              <Input
                type="text"
                value={form.heroHighlight}
                onChange={(e) =>
                  setForm({ ...form, heroHighlight: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Subtitle">
            <Textarea
              value={form.heroSubtitle}
              onChange={(e) =>
                setForm({ ...form, heroSubtitle: e.target.value })
              }
              rows={3}
            />
          </Field>
        </Card>
      )}

      {/* Stats Section */}
      {activeSection === "stats" && (
        <Card padded>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Stats Cards</h2>
            <Button variant="subtle" size="sm" onClick={addStat}>
              + Add Stat
            </Button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Enable "Use Real Count" to automatically pull live data from the
            database. When disabled, the manually entered value will be
            displayed.
          </p>
          <div className="space-y-4">
            {form.stats.map((stat, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 relative">
                <button
                  onClick={() => removeStat(i)}
                  className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-sm"
                >
                  ✕
                </button>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Icon">
                    <Select
                      value={stat.icon}
                      onChange={(e) => updateStat(i, "icon", e.target.value)}
                    >
                      {ICON_OPTIONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label={stat.useRealCount ? "Display Value (auto)" : "Display Value"}
                  >
                    <Input
                      type="text"
                      value={stat.value}
                      onChange={(e) => updateStat(i, "value", e.target.value)}
                      disabled={stat.useRealCount}
                      placeholder="e.g., 50+"
                    />
                  </Field>
                  <Field label="Label">
                    <Input
                      type="text"
                      value={stat.label}
                      onChange={(e) => updateStat(i, "label", e.target.value)}
                      placeholder="e.g., Ambulances"
                    />
                  </Field>
                  <Field label="Data Source">
                    <Select
                      value={stat.countSource}
                      onChange={(e) => {
                        updateStat(i, "countSource", e.target.value);
                        updateStat(i, "useRealCount", !!e.target.value);
                      }}
                    >
                      {COUNT_SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Mission & Vision */}
      {activeSection === "mission" && (
        <Card padded className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-800">
            Mission & Vision
          </h2>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
              <Field label="Mission Title">
                <Input
                  type="text"
                  value={form.missionTitle}
                  onChange={(e) =>
                    setForm({ ...form, missionTitle: e.target.value })
                  }
                />
              </Field>
              <Field label="Mission Text">
                <Textarea
                  value={form.missionText}
                  onChange={(e) =>
                    setForm({ ...form, missionText: e.target.value })
                  }
                  rows={5}
                />
              </Field>
            </div>
            <div className="space-y-3 p-4 bg-cyan-50 rounded-lg">
              <Field label="Vision Title">
                <Input
                  type="text"
                  value={form.visionTitle}
                  onChange={(e) =>
                    setForm({ ...form, visionTitle: e.target.value })
                  }
                />
              </Field>
              <Field label="Vision Text">
                <Textarea
                  value={form.visionText}
                  onChange={(e) =>
                    setForm({ ...form, visionText: e.target.value })
                  }
                  rows={5}
                />
              </Field>
            </div>
          </div>
        </Card>
      )}

      {/* Core Values */}
      {activeSection === "values" && (
        <Card padded>
          <div className="space-y-4 mb-6">
            <Field label="Section Heading">
              <Input
                type="text"
                value={form.valuesHeading}
                onChange={(e) =>
                  setForm({ ...form, valuesHeading: e.target.value })
                }
              />
            </Field>
            <Field label="Section Subheading">
              <Input
                type="text"
                value={form.valuesSubheading}
                onChange={(e) =>
                  setForm({ ...form, valuesSubheading: e.target.value })
                }
              />
            </Field>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Values</h3>
            <Button variant="subtle" size="sm" onClick={addValue}>
              + Add Value
            </Button>
          </div>

          <div className="space-y-4">
            {form.coreValues.map((val, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 relative">
                <button
                  onClick={() => removeValue(i)}
                  className="absolute top-2 right-2 text-red-400 hover:text-red-600 text-sm"
                >
                  ✕
                </button>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Field label="Icon">
                    <Select
                      value={val.icon}
                      onChange={(e) => updateValue(i, "icon", e.target.value)}
                    >
                      {ICON_OPTIONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Title">
                    <Input
                      type="text"
                      value={val.title}
                      onChange={(e) => updateValue(i, "title", e.target.value)}
                    />
                  </Field>
                  <Field label="Description">
                    <Input
                      type="text"
                      value={val.description}
                      onChange={(e) =>
                        updateValue(i, "description", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Our Story */}
      {activeSection === "story" && (
        <Card padded>
          <div className="mb-4">
            <Field label="Story Title">
              <Input
                type="text"
                value={form.storyTitle}
                onChange={(e) => setForm({ ...form, storyTitle: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Paragraphs</h3>
            <Button variant="subtle" size="sm" onClick={addParagraph}>
              + Add Paragraph
            </Button>
          </div>

          <div className="space-y-4">
            {form.storyParagraphs.map((para, i) => (
              <div key={i} className="relative">
                <div className="flex gap-2">
                  <Field label={`Paragraph ${i + 1}`} className="flex-1">
                    <Textarea
                      value={para}
                      onChange={(e) => updateParagraph(i, e.target.value)}
                      rows={4}
                      placeholder="Enter paragraph text..."
                    />
                  </Field>
                  {form.storyParagraphs.length > 1 && (
                    <button
                      onClick={() => removeParagraph(i)}
                      className="px-2 text-red-400 hover:text-red-600 self-start mt-6"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Save Button (bottom) */}
      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default AboutManagement;
