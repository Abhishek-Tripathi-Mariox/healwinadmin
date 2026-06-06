import React, { useCallback, useEffect, useState } from "react";
import { contactContentApi, contactMessagesApi } from "../services/admin-api";
import {
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Clock,
  Building,
  MessageSquare,
  Eye,
  Archive,
  MailCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  PageHeader,
  Button,
  SearchInput,
  Select,
  Input,
  Textarea,
  Field,
  Card,
  Badge,
  EmptyState,
  cn,
} from "../components/ui";

// ==================== INTERFACES ====================

interface ContactDirectory {
  icon: string;
  title: string;
  name: string;
  email: string;
  phone: string;
  description: string;
  gradient: string;
}

interface ContactContent {
  companyName: string;
  companyTagline: string;
  officeAddress: string;
  emergencyHelpline: string;
  supportEmail: string;
  workingHoursEmergency: string;
  workingHoursOffice: string;
  contactDirectories: ContactDirectory[];
  footerDescription: string;
  footerOfficeLabel: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
}

interface ContactMessage {
  _id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  adminNotes: string;
  repliedBy?: { name: string; email: string };
  repliedAt?: string;
  createdAt: string;
}

interface MessageStats {
  total: number;
  new: number;
  read: number;
  replied: number;
  archived: number;
}

const defaultDirectory: ContactDirectory = {
  icon: "MessageSquare",
  title: "",
  name: "",
  email: "",
  phone: "",
  description: "",
  gradient: "from-hw-primary to-hw-primary-dark",
};

const gradientOptions = [
  { label: "Red (Grievance)", value: "from-hw-sos to-red-600" },
  { label: "Blue (Primary)", value: "from-hw-primary to-hw-primary-dark" },
  { label: "Cyan (Accent)", value: "from-hw-accent to-cyan-600" },
  { label: "Green", value: "from-green-500 to-emerald-600" },
  { label: "Purple", value: "from-purple-500 to-indigo-600" },
  { label: "Orange", value: "from-orange-500 to-amber-600" },
];

const iconOptions = [
  "AlertCircle",
  "MessageSquare",
  "Briefcase",
  "Phone",
  "Mail",
  "Heart",
  "Shield",
  "Headphones",
  "Globe",
  "Building",
];

// ==================== COMPONENT ====================

const ContactManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"content" | "messages">("content");

  // Content state
  const [content, setContent] = useState<ContactContent>({
    companyName: "",
    companyTagline: "",
    officeAddress: "",
    emergencyHelpline: "",
    supportEmail: "",
    workingHoursEmergency: "",
    workingHoursOffice: "",
    contactDirectories: [],
    footerDescription: "",
    footerOfficeLabel: "",
    heroTitle: "",
    heroHighlight: "",
    heroSubtitle: "",
  });
  const [saving, setSaving] = useState(false);
  const [loadingContent, setLoadingContent] = useState(true);

  // Messages state
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [stats, setStats] = useState<MessageStats>({
    total: 0,
    new: 0,
    read: 0,
    replied: 0,
    archived: 0,
  });
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageFilter, setMessageFilter] = useState("all");
  const [messageSearch, setMessageSearch] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(
    null,
  );
  const [adminNotes, setAdminNotes] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ==================== LOAD DATA ====================

  const loadContent = useCallback(async () => {
    setLoadingContent(true);
    try {
      const res = await contactContentApi.get();
      if (res.data) {
        setContent({
          companyName: res.data.companyName || "",
          companyTagline: res.data.companyTagline || "",
          officeAddress: res.data.officeAddress || "",
          emergencyHelpline: res.data.emergencyHelpline || "",
          supportEmail: res.data.supportEmail || "",
          workingHoursEmergency: res.data.workingHoursEmergency || "",
          workingHoursOffice: res.data.workingHoursOffice || "",
          contactDirectories: res.data.contactDirectories || [],
          footerDescription: res.data.footerDescription || "",
          footerOfficeLabel: res.data.footerOfficeLabel || "",
          heroTitle: res.data.heroTitle || "",
          heroHighlight: res.data.heroHighlight || "",
          heroSubtitle: res.data.heroSubtitle || "",
        });
      }
    } catch (err: unknown) {
      console.error("Failed to load contact content:", err);
    } finally {
      setLoadingContent(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    setLoadingMessages(true);
    try {
      const [msgRes, statsRes] = await Promise.all([
        contactMessagesApi.getAll({
          status: messageFilter,
          q: messageSearch,
          page: String(page),
          limit: "15",
        }),
        contactMessagesApi.getStats(),
      ]);
      setMessages(msgRes.data?.messages || []);
      setTotalPages(msgRes.data?.pagination?.pages || 1);
      setStats(
        statsRes.data || { total: 0, new: 0, read: 0, replied: 0, archived: 0 },
      );
    } catch (err: unknown) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, [messageFilter, messageSearch, page]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  useEffect(() => {
    if (activeTab === "messages") loadMessages();
  }, [activeTab, loadMessages]);

  // ==================== CONTENT HANDLERS ====================

  const handleSave = async () => {
    setSaving(true);
    try {
      await contactContentApi.update(content);
      alert("Contact information saved successfully!");
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to save contact content",
      );
    } finally {
      setSaving(false);
    }
  };

  const addDirectory = () => {
    setContent({
      ...content,
      contactDirectories: [
        ...content.contactDirectories,
        { ...defaultDirectory },
      ],
    });
  };

  const removeDirectory = (index: number) => {
    setContent({
      ...content,
      contactDirectories: content.contactDirectories.filter(
        (_, i) => i !== index,
      ),
    });
  };

  const updateDirectory = (
    index: number,
    field: keyof ContactDirectory,
    value: string,
  ) => {
    const updated = [...content.contactDirectories];
    updated[index] = { ...updated[index], [field]: value };
    setContent({ ...content, contactDirectories: updated });
  };

  // ==================== MESSAGE HANDLERS ====================

  const handleUpdateMessageStatus = async (id: string, status: string) => {
    try {
      await contactMessagesApi.update(id, { status, adminNotes });
      loadMessages();
      if (selectedMessage?._id === id) {
        setSelectedMessage({
          ...selectedMessage,
          status: status as ContactMessage["status"],
          adminNotes,
        });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update message");
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm("Delete this message permanently?")) return;
    try {
      await contactMessagesApi.remove(id);
      loadMessages();
      if (selectedMessage?._id === id) setSelectedMessage(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete message");
    }
  };

  const openMessage = async (msg: ContactMessage) => {
    setSelectedMessage(msg);
    setAdminNotes(msg.adminNotes || "");
    // If new, it will auto-mark as read on the backend
    if (msg.status === "new") {
      try {
        await contactMessagesApi.getById(msg._id);
        loadMessages();
      } catch {
        // silently fail
      }
    }
  };

  // ==================== RENDER ====================

  const statusTones: Record<
    ContactMessage["status"],
    "info" | "warning" | "success" | "neutral"
  > = {
    new: "info",
    read: "warning",
    replied: "success",
    archived: "neutral",
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Contact Us Management"
        subtitle="Manage contact page info, directories & messages"
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("content")}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition",
            activeTab === "content"
              ? "bg-white shadow text-healwin-600"
              : "text-gray-500 hover:text-gray-700",
          )}
        >
          <Building className="w-4 h-4 inline mr-1" />
          Contact Info
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition",
            activeTab === "messages"
              ? "bg-white shadow text-healwin-600"
              : "text-gray-500 hover:text-gray-700",
          )}
        >
          <MessageSquare className="w-4 h-4 inline mr-1" />
          Messages
          {stats.new > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {stats.new}
            </span>
          )}
        </button>
      </div>

      {/* ==================== CONTENT TAB ==================== */}
      {activeTab === "content" && (
        <div className="space-y-6">
          {loadingContent ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : (
            <>
              {/* Hero Section */}
              <Card padded>
                <h2 className="text-lg font-semibold mb-4 text-gray-800">
                  Page Hero
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Hero Title">
                    <Input
                      value={content.heroTitle}
                      onChange={(e) =>
                        setContent({ ...content, heroTitle: e.target.value })
                      }
                      placeholder="Contact"
                    />
                  </Field>
                  <Field label="Highlighted Text">
                    <Input
                      value={content.heroHighlight}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          heroHighlight: e.target.value,
                        })
                      }
                      placeholder="Us"
                    />
                  </Field>
                  <Field label="Subtitle" className="md:col-span-2">
                    <Textarea
                      value={content.heroSubtitle}
                      onChange={(e) =>
                        setContent({ ...content, heroSubtitle: e.target.value })
                      }
                      rows={2}
                    />
                  </Field>
                </div>
              </Card>

              {/* Company Info */}
              <Card padded>
                <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Company Information
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Company Name">
                    <Input
                      value={content.companyName}
                      onChange={(e) =>
                        setContent({ ...content, companyName: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Tagline">
                    <Input
                      value={content.companyTagline}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          companyTagline: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </Card>

              {/* Contact Details */}
              <Card padded>
                <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Contact Details
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field>
                    <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
                      <MapPin className="w-4 h-4" /> Office Address
                    </span>
                    <Textarea
                      value={content.officeAddress}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          officeAddress: e.target.value,
                        })
                      }
                      rows={2}
                    />
                  </Field>
                  <Field>
                    <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
                      <Phone className="w-4 h-4" /> Emergency Helpline
                    </span>
                    <Input
                      value={content.emergencyHelpline}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          emergencyHelpline: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
                      <Mail className="w-4 h-4" /> Support Email
                    </span>
                    <Input
                      value={content.supportEmail}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          supportEmail: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
                      <Clock className="w-4 h-4" /> Working Hours (Emergency)
                    </span>
                    <Input
                      value={content.workingHoursEmergency}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          workingHoursEmergency: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <span className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600">
                      <Clock className="w-4 h-4" /> Working Hours (Office)
                    </span>
                    <Input
                      value={content.workingHoursOffice}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          workingHoursOffice: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </Card>

              {/* Contact Directories */}
              <Card padded>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Contact Directories
                  </h2>
                  <Button
                    size="sm"
                    onClick={addDirectory}
                    icon={<Plus className="w-4 h-4" />}
                  >
                    Add Directory
                  </Button>
                </div>
                <div className="space-y-4">
                  {content.contactDirectories.map((dir, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 bg-gray-50 relative"
                    >
                      <button
                        onClick={() => removeDirectory(index)}
                        className="absolute top-3 right-3 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="grid md:grid-cols-3 gap-3">
                        <Field label="Title">
                          <Input
                            value={dir.title}
                            onChange={(e) =>
                              updateDirectory(index, "title", e.target.value)
                            }
                            placeholder="e.g. Grievance Officer"
                          />
                        </Field>
                        <Field label="Contact Name">
                          <Input
                            value={dir.name}
                            onChange={(e) =>
                              updateDirectory(index, "name", e.target.value)
                            }
                            placeholder="e.g. Mr. Rajiv Das"
                          />
                        </Field>
                        <Field label="Description">
                          <Input
                            value={dir.description}
                            onChange={(e) =>
                              updateDirectory(
                                index,
                                "description",
                                e.target.value,
                              )
                            }
                            placeholder="For complaints and grievances"
                          />
                        </Field>
                        <Field label="Email">
                          <Input
                            value={dir.email}
                            onChange={(e) =>
                              updateDirectory(index, "email", e.target.value)
                            }
                            placeholder="grievance@healwin.in"
                          />
                        </Field>
                        <Field label="Phone">
                          <Input
                            value={dir.phone}
                            onChange={(e) =>
                              updateDirectory(index, "phone", e.target.value)
                            }
                            placeholder="+91 9876543290"
                          />
                        </Field>
                        <Field label="Icon">
                          <Select
                            value={dir.icon}
                            onChange={(e) =>
                              updateDirectory(index, "icon", e.target.value)
                            }
                          >
                            {iconOptions.map((ic) => (
                              <option key={ic} value={ic}>
                                {ic}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Color Theme" className="md:col-span-3">
                          <Select
                            value={dir.gradient}
                            onChange={(e) =>
                              updateDirectory(index, "gradient", e.target.value)
                            }
                          >
                            {gradientOptions.map((g) => (
                              <option key={g.value} value={g.value}>
                                {g.label}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>
                    </div>
                  ))}
                  {content.contactDirectories.length === 0 && (
                    <p className="text-gray-400 text-sm text-center py-4">
                      No contact directories yet. Click "Add Directory" to
                      create one.
                    </p>
                  )}
                </div>
              </Card>

              {/* Footer Section */}
              <Card padded>
                <h2 className="text-lg font-semibold mb-4 text-gray-800">
                  Footer Section
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Footer Description" className="md:col-span-2">
                    <Textarea
                      value={content.footerDescription}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          footerDescription: e.target.value,
                        })
                      }
                      rows={3}
                    />
                  </Field>
                  <Field label="Office Label">
                    <Input
                      value={content.footerOfficeLabel}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          footerOfficeLabel: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
              </Card>

              {/* Save Button */}
              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={loadContent}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  icon={<Save className="w-4 h-4" />}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================== MESSAGES TAB ==================== */}
      {activeTab === "messages" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              {
                label: "Total",
                value: stats.total,
                tone: "neutral" as const,
              },
              {
                label: "New",
                value: stats.new,
                tone: "info" as const,
              },
              {
                label: "Read",
                value: stats.read,
                tone: "warning" as const,
              },
              {
                label: "Replied",
                value: stats.replied,
                tone: "success" as const,
              },
              {
                label: "Archived",
                value: stats.archived,
                tone: "neutral" as const,
              },
            ].map((s) => (
              <Card key={s.label} padded className="text-center">
                <p className="text-2xl font-bold text-gray-800">{s.value}</p>
                <Badge tone={s.tone}>{s.label}</Badge>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <SearchInput
              value={messageSearch}
              onChange={(e) => {
                setMessageSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search messages…"
              className="flex-1 min-w-[200px]"
            />
            <Select
              value={messageFilter}
              onChange={(e) => {
                setMessageFilter(e.target.value);
                setPage(1);
              }}
              className="w-auto"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="replied">Replied</option>
              <option value="archived">Archived</option>
            </Select>
            <Button
              variant="secondary"
              onClick={loadMessages}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Message List */}
            <Card className="lg:col-span-2 overflow-hidden">
              {loadingMessages ? (
                <div className="text-center py-12 text-gray-400">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  No messages found
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                  {messages.map((msg) => (
                    <button
                      key={msg._id}
                      onClick={() => openMessage(msg)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-gray-50 transition",
                        selectedMessage?._id === msg._id &&
                          "bg-healwin-50 border-l-4 border-healwin-500",
                        msg.status === "new" && "font-semibold",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-800 truncate max-w-[60%]">
                          {msg.name}
                        </span>
                        <Badge tone={statusTones[msg.status]}>
                          {msg.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {msg.subject}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(msg.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-gray-100">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="p-1 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="p-1 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </Card>

            {/* Message Detail */}
            <Card padded className="lg:col-span-3">
              {selectedMessage ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {selectedMessage.subject}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        From: {selectedMessage.name}
                      </p>
                    </div>
                    <Badge tone={statusTones[selectedMessage.status]}>
                      {selectedMessage.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      <a
                        href={`mailto:${selectedMessage.email}`}
                        className="text-healwin-600 hover:underline"
                      >
                        {selectedMessage.email}
                      </a>
                    </span>
                    {selectedMessage.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        <a
                          href={`tel:${selectedMessage.phone}`}
                          className="text-healwin-600 hover:underline"
                        >
                          {selectedMessage.phone}
                        </a>
                      </span>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedMessage.message}
                    </p>
                  </div>

                  <div className="text-xs text-gray-400">
                    Received:{" "}
                    {new Date(selectedMessage.createdAt).toLocaleString(
                      "en-IN",
                    )}
                    {selectedMessage.repliedBy && (
                      <>
                        {" "}
                        &bull; Replied by {
                          selectedMessage.repliedBy.name
                        } on{" "}
                        {selectedMessage.repliedAt
                          ? new Date(selectedMessage.repliedAt).toLocaleString(
                              "en-IN",
                            )
                          : ""}
                      </>
                    )}
                  </div>

                  {/* Admin Notes */}
                  <Field label="Admin Notes">
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      placeholder="Add internal notes about this message..."
                    />
                  </Field>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="px-2 bg-green-600 text-white hover:bg-green-700"
                      title="Mark Replied"
                      aria-label="Mark Replied"
                      onClick={() =>
                        handleUpdateMessageStatus(
                          selectedMessage._id,
                          "replied",
                        )
                      }
                    >
                      <MailCheck className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      className="px-2 bg-gray-500 text-white hover:bg-gray-600"
                      title="Archive"
                      aria-label="Archive"
                      onClick={() =>
                        handleUpdateMessageStatus(
                          selectedMessage._id,
                          "archived",
                        )
                      }
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="px-2"
                      title="Mark Read"
                      aria-label="Mark Read"
                      onClick={() =>
                        handleUpdateMessageStatus(selectedMessage._id, "read")
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="ml-auto px-2"
                      title="Delete"
                      aria-label="Delete"
                      onClick={() => handleDeleteMessage(selectedMessage._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<MessageSquare className="w-6 h-6" />}
                  title="Select a message to view details"
                />
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactManagement;
