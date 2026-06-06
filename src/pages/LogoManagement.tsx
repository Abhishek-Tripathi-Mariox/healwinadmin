import React, { useEffect, useState } from "react";
import { logoSettingsApi } from "../services/admin-api";
import { PageHeader, Card, Button, Alert, Spinner } from "../components/ui";

const LogoManagement: React.FC = () => {
  const [titleLogo, setTitleLogo] = useState<string>("");
  const [mainLogo, setMainLogo] = useState<string>("");
  const [titleLogoFile, setTitleLogoFile] = useState<File | null>(null);
  const [mainLogoFile, setMainLogoFile] = useState<File | null>(null);
  const [titlePreview, setTitlePreview] = useState<string>("");
  const [mainPreview, setMainPreview] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await logoSettingsApi.get();
      const data = res.data || {};
      setTitleLogo(data.titleLogo || "");
      setMainLogo(data.mainLogo || "");
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load logo settings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFileChange = (
    type: "title" | "main",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    if (type === "title") {
      setTitleLogoFile(file);
      setTitlePreview(previewUrl);
    } else {
      setMainLogoFile(file);
      setMainPreview(previewUrl);
    }
    setError(null);
  };

  const handleSave = async () => {
    if (!titleLogoFile && !mainLogoFile) {
      setError("Select at least one logo file to update");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      if (titleLogoFile) formData.append("titleLogo", titleLogoFile);
      if (mainLogoFile) formData.append("mainLogo", mainLogoFile);
      await logoSettingsApi.update(formData);
      setTitleLogoFile(null);
      setMainLogoFile(null);
      setTitlePreview("");
      setMainPreview("");
      setSuccess("Logo settings updated successfully");
      await load();
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to update logos");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card padded className="flex items-center justify-center gap-3 text-sm text-gray-500">
          <Spinner />
          Loading logo settings...
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Logo Management"
        subtitle="Manage the title logo and main logo shown on the website"
      />

      {error && (
        <Alert className="mb-4" tone="danger">
          <span className="flex items-center justify-between gap-4">
            {error}
            <button onClick={() => setError(null)} className="font-bold">
              ×
            </button>
          </span>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4" tone="success">
          <span className="flex items-center justify-between gap-4">
            {success}
            <button onClick={() => setSuccess(null)} className="font-bold">
              ×
            </button>
          </span>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Title Logo */}
        <Card padded className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Title Logo</h2>
          <p className="text-sm text-gray-500">
            Small logo shown in browser tab / title bar
          </p>
          <div className="flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed p-8 min-h-[120px]">
            {titlePreview ? (
              <img
                src={titlePreview}
                alt="Title Logo Preview"
                className="max-h-24 object-contain"
              />
            ) : titleLogo ? (
              <img
                src={titleLogo}
                alt="Title Logo"
                className="max-h-24 object-contain"
              />
            ) : (
              <span className="text-gray-400 text-sm">No title logo set</span>
            )}
          </div>
          <label className="block">
            <span className="sr-only">Choose title logo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange("title", e)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-healwin-50 file:text-healwin-600 hover:file:bg-healwin-100"
            />
          </label>
        </Card>

        {/* Main Logo */}
        <Card padded className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Main Logo</h2>
          <p className="text-sm text-gray-500">
            Primary logo shown on the website header/navbar
          </p>
          <div className="flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed p-8 min-h-[120px]">
            {mainPreview ? (
              <img
                src={mainPreview}
                alt="Main Logo Preview"
                className="max-h-24 object-contain"
              />
            ) : mainLogo ? (
              <img
                src={mainLogo}
                alt="Main Logo"
                className="max-h-24 object-contain"
              />
            ) : (
              <span className="text-gray-400 text-sm">No main logo set</span>
            )}
          </div>
          <label className="block">
            <span className="sr-only">Choose main logo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange("main", e)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-healwin-50 file:text-healwin-600 hover:file:bg-healwin-100"
            />
          </label>
        </Card>
      </div>

      <div className="flex justify-end mt-6">
        <Button
          onClick={handleSave}
          disabled={saving || (!titleLogoFile && !mainLogoFile)}
        >
          {saving ? "Saving..." : "Save Logo Settings"}
        </Button>
      </div>
    </div>
  );
};

export default LogoManagement;
