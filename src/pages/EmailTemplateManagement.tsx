import React, { useEffect, useState, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  emailTemplateApi,
  smtpSettingsApi,
  smsSettingsApi,
} from "../services/admin-api";
import Pagination from "../components/Pagination";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Alert,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
} from "../components/ui";

interface EmailTemplateItem {
  _id: string;
  name: string;
  type: string;
  subject: string;
  body: string;
  isActive: boolean;
  placeholders: string[];
  createdAt: string;
  updatedAt: string;
}

interface SmtpStatusEntry {
  configured: boolean;
  host: string;
  port: number;
  fromEmail: string;
  fromName: string;
  hrEmail: string;
  hrEmails?: string[];
  acknowledgementCcEmails?: string[];
}

interface SmtpStatus extends SmtpStatusEntry {
  notifications?: SmtpStatusEntry;
  otp?: SmtpStatusEntry;
}

type SmtpPurpose = "notifications" | "otp";

interface SmtpSettingsForm {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  hrEmails: string;
  acknowledgementCcEmails: string;
  companyName: string;
}

const EMPTY_SMTP: SmtpSettingsForm = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  pass: "",
  fromEmail: "",
  fromName: "",
  hrEmails: "",
  acknowledgementCcEmails: "",
  companyName: "",
};

interface SmsStatus {
  configured: boolean;
  provider: string;
  senderId: string;
  entityId: string;
  contentTemplateId: string;
  templateId: string;
  enabled: boolean;
}

interface SmsSettingsForm {
  provider: string;
  apiKey: string;
  apiSecret: string;
  senderId: string;
  entityId: string;
  contentTemplateId: string;
  templateId: string;
  baseUrl: string;
  enabled: boolean;
}

const EMPTY_SMS: SmsSettingsForm = {
  provider: "msg91",
  apiKey: "",
  apiSecret: "",
  senderId: "",
  entityId: "",
  contentTemplateId: "",
  templateId: "",
  baseUrl: "",
  enabled: true,
};

const SMS_PROVIDERS = [
  { value: "msg91", label: "MSG91" },
  { value: "smartping", label: "SmartPing (DLT)" },
  { value: "textlocal", label: "Textlocal" },
  { value: "fast2sms", label: "Fast2SMS" },
  { value: "twilio", label: "Twilio" },
  { value: "other", label: "Other" },
];

const TEMPLATE_TYPES = [
  {
    value: "APPLICATION_ACKNOWLEDGEMENT",
    label: "Application Acknowledgement",
    description: "Sent to candidates when they submit an application",
  },
  {
    value: "APPLICATION_STATUS_UPDATE",
    label: "Application Status Update",
    description: "Sent to candidates when their application status changes",
  },
  {
    value: "APPLICATION_STATUS_SHORTLISTED",
    label: "Application Shortlisted",
    description: "Sent to candidates when their application is shortlisted",
  },
  {
    value: "APPLICATION_STATUS_HIRED",
    label: "Application Hired",
    description: "Sent to candidates when their application is marked hired",
  },
  {
    value: "APPLICATION_STATUS_REJECTED",
    label: "Application Rejected",
    description: "Sent to candidates when their application is marked rejected",
  },
  {
    value: "APPLICATION_HR_NOTIFICATION",
    label: "HR New Application Notification",
    description: "Sent to HR when a new application is received",
  },
];

const DEFAULT_TEMPLATES: Record<
  string,
  { name: string; subject: string; body: string }
> = {
  APPLICATION_ACKNOWLEDGEMENT: {
    name: "Application Acknowledgement",
    subject: "Application Received - {{position}} | {{companyName}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Application Received</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; color: #374151;">Dear <strong>{{candidateName}}</strong>,</p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      Thank you for applying for the position of <strong>{{position}}</strong> in the <strong>{{department}}</strong> department at <strong>{{companyName}}</strong>.
    </p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      We have successfully received your application. Our HR team will review your profile and get back to you soon.
    </p>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Application ID:</strong> {{applicationId}}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Position:</strong> {{position}}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Department:</strong> {{department}}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Applied On:</strong> {{appliedDate}}</p>
    </div>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      If you have any questions, feel free to reach out to us at <a href="mailto:{{companyEmail}}" style="color: #2563eb;">{{companyEmail}}</a>.
    </p>
    <p style="font-size: 14px; color: #374151; margin-top: 24px;">
      Best regards,<br/>
      <strong>{{companyName}} HR Team</strong>
    </p>
  </div>
  <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
    This is an automated email. Please do not reply directly to this email.
  </div>
</div>`,
  },
  APPLICATION_STATUS_UPDATE: {
    name: "Application Status Update",
    subject: "Application Update - {{position}} | {{companyName}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Application Status Update</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; color: #374151;">Dear <strong>{{candidateName}}</strong>,</p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      We would like to inform you that the status of your application for <strong>{{position}}</strong> in the <strong>{{department}}</strong> department has been updated.
    </p>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
      <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">Previous Status</p>
      <p style="margin: 4px 0; font-size: 18px; color: #374151; font-weight: bold;">{{oldStatus}}</p>
      <p style="margin: 12px 0 4px; font-size: 20px; color: #2563eb;">&#8595;</p>
      <p style="margin: 4px 0; font-size: 13px; color: #6b7280;">Current Status</p>
      <p style="margin: 4px 0; font-size: 18px; color: #2563eb; font-weight: bold;">{{newStatus}}</p>
    </div>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      If you have any questions regarding this update, please contact us at <a href="mailto:{{companyEmail}}" style="color: #2563eb;">{{companyEmail}}</a>.
    </p>
    <p style="font-size: 14px; color: #374151; margin-top: 24px;">
      Best regards,<br/>
      <strong>{{companyName}} HR Team</strong>
    </p>
  </div>
  <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
    This is an automated email. Please do not reply directly to this email.
  </div>
</div>`,
  },
  APPLICATION_STATUS_SHORTLISTED: {
    name: "Application Shortlisted",
    subject: "You are shortlisted - {{position}} | {{companyName}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #059669, #047857); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">You are Shortlisted</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; color: #374151;">Dear <strong>{{candidateName}}</strong>,</p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      Great news. Your application for <strong>{{position}}</strong> in <strong>{{department}}</strong> has been shortlisted.
    </p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      Our HR team will contact you soon with the next steps.
    </p>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Application ID:</strong> {{applicationId}}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Previous Status:</strong> {{oldStatus}}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Current Status:</strong> {{newStatus}}</p>
    </div>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      For any questions, please contact us at <a href="mailto:{{companyEmail}}" style="color: #2563eb;">{{companyEmail}}</a>.
    </p>
    <p style="font-size: 14px; color: #374151; margin-top: 24px;">
      Best regards,<br/>
      <strong>{{companyName}} HR Team</strong>
    </p>
  </div>
</div>`,
  },
  APPLICATION_STATUS_HIRED: {
    name: "Application Hired",
    subject: "Congratulations - Selected for {{position}} | {{companyName}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Congratulations</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; color: #374151;">Dear <strong>{{candidateName}}</strong>,</p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      We are pleased to inform you that your application for <strong>{{position}}</strong> in <strong>{{department}}</strong> has been marked as hired.
    </p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      Our team will reach out to you shortly with onboarding details.
    </p>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Application ID:</strong> {{applicationId}}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Current Status:</strong> {{newStatus}}</p>
    </div>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      For any questions, please contact us at <a href="mailto:{{companyEmail}}" style="color: #2563eb;">{{companyEmail}}</a>.
    </p>
    <p style="font-size: 14px; color: #374151; margin-top: 24px;">
      Best regards,<br/>
      <strong>{{companyName}} HR Team</strong>
    </p>
  </div>
</div>`,
  },
  APPLICATION_STATUS_REJECTED: {
    name: "Application Rejected",
    subject: "Application Update - {{position}} | {{companyName}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #9ca3af, #6b7280); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Application Update</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; color: #374151;">Dear <strong>{{candidateName}}</strong>,</p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      Thank you for your interest in <strong>{{position}}</strong> at <strong>{{companyName}}</strong>.
      After careful review, we are unable to proceed with your application at this time.
    </p>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      We appreciate your time and encourage you to apply for suitable openings in the future.
    </p>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Application ID:</strong> {{applicationId}}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #374151;"><strong>Current Status:</strong> {{newStatus}}</p>
    </div>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
      For any questions, please contact us at <a href="mailto:{{companyEmail}}" style="color: #2563eb;">{{companyEmail}}</a>.
    </p>
    <p style="font-size: 14px; color: #374151; margin-top: 24px;">
      Best regards,<br/>
      <strong>{{companyName}} HR Team</strong>
    </p>
  </div>
</div>`,
  },
  APPLICATION_HR_NOTIFICATION: {
    name: "HR New Application Notification",
    subject: "New Application - {{position}} | {{candidateName}}",
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #059669, #047857); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">New Job Application</h1>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; color: #374151;">A new application has been submitted.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151; width: 40%;">Candidate Name</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">{{candidateName}}</td></tr>
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Email</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">{{candidateEmail}}</td></tr>
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Phone</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">{{candidatePhone}}</td></tr>
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Position</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">{{position}}</td></tr>
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Department</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">{{department}}</td></tr>
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Applied On</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">{{appliedDate}}</td></tr>
      <tr><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151;">Application ID</td><td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">{{applicationId}}</td></tr>
    </table>
    <p style="font-size: 14px; color: #6b7280;">Please review this application in the admin panel.</p>
  </div>
</div>`,
  },
};

const emptyTemplate = {
  name: "",
  type: "APPLICATION_ACKNOWLEDGEMENT" as string,
  subject: "",
  body: "",
  isActive: true,
};

interface SimpleTemplateBuilderForm {
  title: string;
  greeting: string;
  intro: string;
  summaryTitle: string;
  summaryBody: string;
  imageUrl: string;
  ctaText: string;
  ctaUrl: string;
  footer: string;
  headerColor: string;
  accentColor: string;
}

const EMPTY_SIMPLE_TEMPLATE: SimpleTemplateBuilderForm = {
  title: "Application Received",
  greeting: "Dear {{candidateName}},",
  intro:
    "Thank you for applying for the position of {{position}} in the {{department}} department at {{companyName}}.",
  summaryTitle: "Application Details",
  summaryBody:
    "Application ID: {{applicationId}}\nPosition: {{position}}\nDepartment: {{department}}\nApplied On: {{appliedDate}}",
  imageUrl: "",
  ctaText: "",
  ctaUrl: "",
  footer:
    "If you have any questions, please contact us at {{companyEmail}}.\n\nBest regards,\n{{companyName}} HR Team",
  headerColor: "#2563eb",
  accentColor: "#1d4ed8",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toHtmlParagraph = (value: string) =>
  escapeHtml(value).replace(/\n/g, "<br/>");

const buildSimpleTemplateHtml = (data: SimpleTemplateBuilderForm) => {
  const safeImageUrl = data.imageUrl.replace(/"/g, "&quot;");
  const safeCtaUrl = data.ctaUrl.replace(/"/g, "&quot;");

  return `<div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 20px; background: #f8fafc;">
  <div style="background: linear-gradient(135deg, ${data.headerColor}, ${data.accentColor}); border-radius: 12px 12px 0 0; padding: 28px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 28px; line-height: 1.3;">${toHtmlParagraph(data.title)}</h1>
  </div>
  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 28px;">
    <p style="font-size: 16px; color: #111827; margin: 0 0 16px;">${toHtmlParagraph(data.greeting)}</p>
    <p style="font-size: 15px; color: #4b5563; line-height: 1.7; margin: 0 0 18px;">${toHtmlParagraph(data.intro)}</p>
    ${
      safeImageUrl
        ? `<div style="margin: 18px 0;"><img src="${safeImageUrl}" alt="Template visual" style="width: 100%; max-height: 280px; object-fit: cover; border-radius: 10px; border: 1px solid #e5e7eb;" /></div>`
        : ""
    }
    <div style="background: #f3f4f6; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px; color: #111827; font-size: 14px; font-weight: 700;">${toHtmlParagraph(data.summaryTitle)}</p>
      <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6;">${toHtmlParagraph(data.summaryBody)}</p>
    </div>
    ${
      data.ctaText && safeCtaUrl
        ? `<div style="text-align: center; margin: 20px 0 16px;"><a href="${safeCtaUrl}" style="display: inline-block; background: ${data.headerColor}; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600;">${toHtmlParagraph(data.ctaText)}</a></div>`
        : ""
    }
    <p style="font-size: 14px; color: #4b5563; line-height: 1.7; margin: 16px 0 0;">${toHtmlParagraph(data.footer)}</p>
  </div>
  <div style="text-align:center; color:#9ca3af; font-size:12px; margin-top: 10px;">This is an automated email from {{companyName}}.</div>
</div>`;
};

const EmailTemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyTemplate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [availablePlaceholders, setAvailablePlaceholders] = useState<string[]>(
    [],
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // SMTP Settings state
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [smtpForm, setSmtpForm] = useState<SmtpSettingsForm>(EMPTY_SMTP);
  const [smtpPurpose, setSmtpPurpose] = useState<SmtpPurpose>("notifications");
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // SMS Settings state
  const [smsStatus, setSmsStatus] = useState<SmsStatus | null>(null);
  const [showSmsSettings, setShowSmsSettings] = useState(false);
  const [smsForm, setSmsForm] = useState<SmsSettingsForm>(EMPTY_SMS);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsTesting, setSmsTesting] = useState(false);
  const [showSmsKey, setShowSmsKey] = useState(false);
  const [showSmsSecret, setShowSmsSecret] = useState(false);
  const [editorMode, setEditorMode] = useState<"simple" | "html">("simple");
  const [simpleTemplate, setSimpleTemplate] =
    useState<SimpleTemplateBuilderForm>(EMPTY_SIMPLE_TEMPLATE);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (filterType) params.type = filterType;
      params.page = String(page);
      params.limit = "20";
      const res = await emailTemplateApi.getAll(params);
      const d = res.data;
      if (d?.items) {
        setTemplates(d.items);
        setTotalPages(d.pagination?.pages || 1);
        setTotal(d.pagination?.total || 0);
      } else {
        setTemplates(d || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSmtpStatus = async () => {
    try {
      const res = await emailTemplateApi.getSmtpStatus();
      setSmtpStatus(res.data);
    } catch {
      // Ignore
    }
  };

  const loadSmtpSettings = async (purpose: SmtpPurpose = smtpPurpose) => {
    try {
      const res = await smtpSettingsApi.get(purpose);
      if (res.data) {
        setSmtpForm({
          host: res.data.host || "",
          port: res.data.port || 587,
          secure: res.data.secure || false,
          user: res.data.user || "",
          pass: res.data.pass || "",
          fromEmail: res.data.fromEmail || "",
          fromName: res.data.fromName || "",
          hrEmails: Array.isArray(res.data.hrEmails)
            ? res.data.hrEmails.join(", ")
            : res.data.hrEmail || "",
          acknowledgementCcEmails: Array.isArray(
            res.data.acknowledgementCcEmails,
          )
            ? res.data.acknowledgementCcEmails.join(", ")
            : "",
          companyName: res.data.companyName || "",
        });
      } else {
        setSmtpForm(EMPTY_SMTP);
      }
    } catch {
      // Ignore â€” no settings saved yet
    }
  };

  const handleSmtpSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpSaving(true);
    setError("");
    setSuccess("");
    try {
      await smtpSettingsApi.update(smtpForm, smtpPurpose);
      setSuccess(
        `${
          smtpPurpose === "otp" ? "OTP" : "Notification"
        } SMTP settings saved successfully`,
      );
      loadSmtpStatus();
      loadSmtpSettings(smtpPurpose);
    } catch (err: any) {
      setError(err.message || "Failed to save SMTP settings");
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleSmtpTest = async () => {
    setSmtpTesting(true);
    setError("");
    setSuccess("");
    try {
      const res = await smtpSettingsApi.testConnection(smtpPurpose);
      setSuccess(res.data?.message || "SMTP connection successful!");
    } catch (err: any) {
      setError(err.message || "SMTP connection test failed");
    } finally {
      setSmtpTesting(false);
    }
  };

  // ---- SMS Settings handlers ----
  const loadSmsStatus = async () => {
    try {
      const res = await smsSettingsApi.getStatus();
      setSmsStatus(res.data);
    } catch {
      // Ignore
    }
  };

  const loadSmsSettings = async () => {
    try {
      const res = await smsSettingsApi.get();
      if (res.data) {
        setSmsForm({
          provider: res.data.provider || "smartping",
          apiKey: res.data.apiKey || "",
          apiSecret: res.data.apiSecret || "",
          senderId: res.data.senderId || "",
          entityId: res.data.entityId || "",
          contentTemplateId: res.data.contentTemplateId || "",
          templateId: res.data.templateId || "",
          baseUrl: res.data.baseUrl || "",
          enabled: res.data.enabled ?? true,
        });
      }
    } catch {
      // Ignore â€” no settings saved yet
    }
  };

  const handleSmsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsSaving(true);
    setError("");
    setSuccess("");
    try {
      await smsSettingsApi.update(smsForm);
      setSuccess("SMS settings saved successfully");
      loadSmsStatus();
    } catch (err: any) {
      setError(err.message || "Failed to save SMS settings");
    } finally {
      setSmsSaving(false);
    }
  };

  const handleSmsTest = async () => {
    setSmsTesting(true);
    setError("");
    setSuccess("");
    try {
      const res = await smsSettingsApi.testConnection();
      setSuccess(res.data?.message || "SMS connection successful!");
    } catch (err: any) {
      setError(err.message || "SMS connection test failed");
    } finally {
      setSmsTesting(false);
    }
  };

  const loadPlaceholders = async (type: string) => {
    try {
      const res = await emailTemplateApi.getPlaceholders(type);
      setAvailablePlaceholders(res.data || []);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    loadTemplates();
    loadSmtpStatus();
    loadSmtpSettings();
    loadSmsStatus();
    loadSmsSettings();
  }, [filterType, page]);

  useEffect(() => {
    setPage(1);
  }, [filterType]);

  useEffect(() => {
    if (showForm) {
      loadPlaceholders(form.type);
    }
  }, [form.type, showForm]);

  // Update iframe preview when body changes
  useEffect(() => {
    if (iframeRef.current && showForm) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        const previewHtml =
          editorMode === "simple"
            ? buildSimpleTemplateHtml(simpleTemplate)
            : form.body;
        doc.open();
        doc.write(
          previewHtml ||
            "<p style='color:#999;text-align:center;padding:40px;'>Email preview will appear here...</p>",
        );
        doc.close();
      }
    }
  }, [form.body, showForm, editorMode, simpleTemplate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const bodyToSave =
      editorMode === "simple"
        ? buildSimpleTemplateHtml(simpleTemplate)
        : form.body;

    const payload = {
      ...form,
      body: bodyToSave,
    };

    if (
      !payload.name.trim() ||
      !payload.type.trim() ||
      !payload.subject.trim() ||
      !payload.body.trim()
    ) {
      setError("Template Name, Type, Subject, and Body are all required");
      return;
    }

    try {
      if (editingId) {
        await emailTemplateApi.update(editingId, payload);
        setSuccess("Template updated successfully");
      } else {
        await emailTemplateApi.create(payload);
        setSuccess("Template created successfully");
      }
      setForm(emptyTemplate);
      setSimpleTemplate(EMPTY_SIMPLE_TEMPLATE);
      setEditorMode("simple");
      setEditingId(null);
      setShowForm(false);
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEdit = (template: EmailTemplateItem) => {
    setForm({
      name: template.name,
      type: template.type,
      subject: template.subject,
      body: template.body,
      isActive: template.isActive,
    });
    setEditingId(template._id);
    setEditorMode("html");
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this email template?")) return;
    try {
      await emailTemplateApi.remove(id);
      setSuccess("Template deleted");
      loadTemplates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUseDefault = () => {
    const def = DEFAULT_TEMPLATES[form.type];
    if (def) {
      setEditorMode("html");
      setForm((prev) => ({
        ...prev,
        name: def.name,
        subject: def.subject,
        body: def.body,
      }));
    }
  };

  const handleSendTest = async (templateId: string) => {
    if (!testEmail) {
      setError("Please enter a test email address");
      return;
    }
    setSendingTest(true);
    setError("");
    try {
      await emailTemplateApi.sendTestEmail(templateId, testEmail);
      setSuccess(`Test email sent to ${testEmail}`);
      setTestEmail("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSendingTest(false);
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "APPLICATION_ACKNOWLEDGEMENT":
        return "bg-blue-100 text-blue-800";
      case "APPLICATION_STATUS_UPDATE":
        return "bg-purple-100 text-purple-800";
      case "APPLICATION_STATUS_SHORTLISTED":
        return "bg-emerald-100 text-emerald-800";
      case "APPLICATION_STATUS_HIRED":
        return "bg-indigo-100 text-indigo-800";
      case "APPLICATION_STATUS_REJECTED":
        return "bg-rose-100 text-rose-800";
      case "APPLICATION_HR_NOTIFICATION":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeLabel = (type: string) => {
    return TEMPLATE_TYPES.find((t) => t.value === type)?.label || type;
  };

  const insertPlaceholder = (placeholder: string) => {
    const tag = `{{${placeholder}}}`;
    if (editorMode === "simple") {
      setSimpleTemplate((prev) => ({
        ...prev,
        intro: `${prev.intro} ${tag}`.trim(),
      }));
      return;
    }

    setForm((prev) => ({ ...prev, body: prev.body + tag }));
  };

  const handleApplySimpleBuilder = () => {
    setForm((prev) => ({
      ...prev,
      body: buildSimpleTemplateHtml(simpleTemplate),
    }));
    setEditorMode("html");
  };

  const handleUploadTemplateImage = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const imageData = reader.result;
      if (typeof imageData !== "string") return;

      setSimpleTemplate((prev) => ({ ...prev, imageUrl: imageData }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const notificationSmtpStatus: SmtpStatusEntry | null = smtpStatus
    ? smtpStatus.notifications || smtpStatus
    : null;

  const otpSmtpStatus: SmtpStatusEntry | null = smtpStatus?.otp || null;

  const selectedSmtpStatus: SmtpStatusEntry | null =
    smtpPurpose === "otp" ? otpSmtpStatus : notificationSmtpStatus;

  return (
    <div className="p-6 space-y-6">
      {/* Header & SMTP Status */}
      <PageHeader
        title="Email Templates"
        subtitle="Manage email templates for application acknowledgements and notifications"
        actions={
          <Button
            onClick={() => {
              setForm(emptyTemplate);
              setSimpleTemplate(EMPTY_SIMPLE_TEMPLATE);
              setEditingId(null);
              setEditorMode("simple");
              setShowForm(true);
              setError("");
              setSuccess("");
            }}
          >
            + New Template
          </Button>
        }
      />
      {/* SMTP Settings Card */}
      {smtpStatus && selectedSmtpStatus && (
        <div
          className={`rounded-lg border ${selectedSmtpStatus.configured ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
        >
          <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                onClick={() => {
                  setSmtpPurpose("notifications");
                  if (showSmtpSettings) loadSmtpSettings("notifications");
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  smtpPurpose === "notifications"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Acknowledgements & Updates SMTP
              </button>
              <button
                type="button"
                onClick={() => {
                  setSmtpPurpose("otp");
                  if (showSmtpSettings) loadSmtpSettings("otp");
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  smtpPurpose === "otp"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                OTP SMTP
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    selectedSmtpStatus.configured
                      ? "bg-green-500"
                      : "bg-red-500"
                  }`}
                />
                <span className="font-semibold text-sm">
                  {smtpPurpose === "otp" ? "OTP SMTP" : "Notification SMTP"}{" "}
                  {selectedSmtpStatus.configured
                    ? "Configured"
                    : "Not Configured"}
                </span>
                {selectedSmtpStatus.configured && (
                  <span className="text-xs text-gray-500 ml-2">
                    {selectedSmtpStatus.host}:{selectedSmtpStatus.port} —{" "}
                    {selectedSmtpStatus.fromName} &lt;
                    {selectedSmtpStatus.fromEmail}&gt;
                    {smtpPurpose === "notifications" &&
                    Array.isArray(selectedSmtpStatus.hrEmails) &&
                    selectedSmtpStatus.hrEmails.length > 0
                      ? ` — HR: ${selectedSmtpStatus.hrEmails.length}`
                      : ""}
                    {smtpPurpose === "notifications" &&
                    Array.isArray(selectedSmtpStatus.acknowledgementCcEmails) &&
                    selectedSmtpStatus.acknowledgementCcEmails.length > 0
                      ? ` — Ack CC: ${selectedSmtpStatus.acknowledgementCcEmails.length}`
                      : ""}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-blue-600 hover:text-blue-800"
                onClick={() => {
                  setShowSmtpSettings(!showSmtpSettings);
                  if (!showSmtpSettings) loadSmtpSettings(smtpPurpose);
                }}
              >
                {showSmtpSettings ? "Hide Settings ▲" : "Configure SMTP ▼"}
              </Button>
            </div>
          </div>

          {showSmtpSettings && (
            <div className="p-5 space-y-4 bg-white rounded-b-lg">
              <form onSubmit={handleSmtpSave} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="SMTP Host *">
                    <Input
                      value={smtpForm.host}
                      onChange={(e) =>
                        setSmtpForm({ ...smtpForm, host: e.target.value })
                      }
                      placeholder="smtp.gmail.com"
                      required
                    />
                  </Field>
                  <Field label="Port *">
                    <Input
                      type="number"
                      value={smtpForm.port}
                      onChange={(e) =>
                        setSmtpForm({
                          ...smtpForm,
                          port: parseInt(e.target.value) || 587,
                        })
                      }
                      placeholder="587"
                      required
                    />
                  </Field>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 pb-2 text-sm">
                      <input
                        type="checkbox"
                        checked={smtpForm.secure}
                        onChange={(e) =>
                          setSmtpForm({
                            ...smtpForm,
                            secure: e.target.checked,
                          })
                        }
                        className="text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-gray-700">
                        Use SSL/TLS (port 465)
                      </span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="SMTP Username / Email *">
                    <Input
                      value={smtpForm.user}
                      onChange={(e) =>
                        setSmtpForm({ ...smtpForm, user: e.target.value })
                      }
                      placeholder="hr@healwin.in"
                      required
                    />
                  </Field>
                  <Field label="SMTP Password / App Password *">
                    <div className="relative">
                      <Input
                        type={showSmtpPass ? "text" : "password"}
                        className="pr-10"
                        value={smtpForm.pass}
                        onChange={(e) =>
                          setSmtpForm({ ...smtpForm, pass: e.target.value })
                        }
                        placeholder="Enter app password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showSmtpPass ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                            />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="From Email *">
                    <Input
                      type="email"
                      value={smtpForm.fromEmail}
                      onChange={(e) =>
                        setSmtpForm({ ...smtpForm, fromEmail: e.target.value })
                      }
                      placeholder={
                        smtpPurpose === "otp"
                          ? "otp@healwin.in"
                          : "hr@healwin.in"
                      }
                      required
                    />
                  </Field>
                  <Field label="From Name *">
                    <Input
                      value={smtpForm.fromName}
                      onChange={(e) =>
                        setSmtpForm({ ...smtpForm, fromName: e.target.value })
                      }
                      placeholder={
                        smtpPurpose === "otp" ? "Healwin OTP" : "Healwin HR"
                      }
                      required
                    />
                  </Field>
                </div>

                {smtpPurpose === "notifications" && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field
                      label="HR Notification Emails *"
                      hint="New application alerts are sent to these emails."
                    >
                      <Input
                        value={smtpForm.hrEmails}
                        onChange={(e) =>
                          setSmtpForm({ ...smtpForm, hrEmails: e.target.value })
                        }
                        placeholder="hr@healwin.in, hiring@healwin.in"
                        required
                      />
                    </Field>
                    <Field label="Acknowledgement CC Emails">
                      <Input
                        value={smtpForm.acknowledgementCcEmails}
                        onChange={(e) =>
                          setSmtpForm({
                            ...smtpForm,
                            acknowledgementCcEmails: e.target.value,
                          })
                        }
                        placeholder="manager@healwin.in, ops@healwin.in"
                      />
                    </Field>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Company Name *">
                    <Input
                      value={smtpForm.companyName}
                      onChange={(e) =>
                        setSmtpForm({
                          ...smtpForm,
                          companyName: e.target.value,
                        })
                      }
                      placeholder="Healwin"
                      required
                    />
                  </Field>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={smtpSaving}>
                    {smtpSaving
                      ? "Saving..."
                      : `Save ${
                          smtpPurpose === "otp" ? "OTP" : "Notification"
                        } SMTP`}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={smtpTesting}
                    onClick={handleSmtpTest}
                  >
                    {smtpTesting ? "Testing..." : "Test Connection"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* SMS Settings Card */}
      {smsStatus && (
        <div
          className={`rounded-lg border ${smsStatus.configured && smsStatus.enabled ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"}`}
        >
          <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => {
              setShowSmsSettings(!showSmsSettings);
              if (!showSmsSettings) loadSmsSettings();
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${smsStatus.configured && smsStatus.enabled ? "bg-green-500" : "bg-orange-500"}`}
              />
              <span className="font-semibold text-sm">
                SMS{" "}
                {smsStatus.configured && smsStatus.enabled
                  ? "Configured"
                  : "Not Configured"}
              </span>
              {smsStatus.configured && (
                <span className="text-xs text-gray-500 ml-2">
                  {smsStatus.provider} â€” Sender: {smsStatus.senderId}
                  {smsStatus.entityId && smsStatus.entityId !== "Not set"
                    ? ` â€” Entity: ${smsStatus.entityId}`
                    : ""}
                </span>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-blue-600 hover:text-blue-800"
            >
              {showSmsSettings ? "Hide Settings ▲" : "Configure SMS ▼"}
            </Button>
          </div>

          {showSmsSettings && (
            <div className="border-t border-gray-200 p-5 bg-white rounded-b-lg">
              {smsForm.provider === "msg91" && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>MSG91 Setup:</strong> Get your Auth Key and Template
                    ID from{" "}
                    <a
                      href="https://msg91.com/help/MSG91/how-to-get-your-authentication-key"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium hover:text-blue-900"
                    >
                      MSG91 Dashboard
                    </a>
                    . Create OTP templates at{" "}
                    <a
                      href="https://control.msg91.com/app/sms-templates"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium hover:text-blue-900"
                    >
                      MSG91 SMS Templates
                    </a>
                    .
                  </p>
                </div>
              )}
              {smsForm.provider === "smartping" && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>SmartPing DLT Registration:</strong> Register your
                    Entity ID and Content Templates at{" "}
                    <a
                      href="https://smartping.live/entity/content-form"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium hover:text-blue-900"
                    >
                      smartping.live/entity/content-form
                    </a>{" "}
                    for TRAI DLT compliance.
                  </p>
                </div>
              )}
              <form onSubmit={handleSmsSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="SMS Provider *">
                    <Select
                      value={smsForm.provider}
                      onChange={(e) =>
                        setSmsForm({ ...smsForm, provider: e.target.value })
                      }
                      required
                    >
                      {SMS_PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Sender ID (Header) *"
                    hint="6-character DLT approved sender ID"
                  >
                    <Input
                      value={smsForm.senderId}
                      onChange={(e) =>
                        setSmsForm({ ...smsForm, senderId: e.target.value })
                      }
                      placeholder="HEALWN"
                      required
                    />
                  </Field>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm pb-2">
                      <input
                        type="checkbox"
                        checked={smsForm.enabled}
                        onChange={(e) =>
                          setSmsForm({
                            ...smsForm,
                            enabled: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">Enable SMS Service</span>
                    </label>
                  </div>
                </div>

                {/* SmartPing DLT Fields — only for SmartPing provider */}
                {smsForm.provider === "smartping" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                      label="SmartPing Entity ID (PE ID) *"
                      hint="Principal Entity ID from SmartPing DLT registration"
                    >
                      <Input
                        value={smsForm.entityId}
                        onChange={(e) =>
                          setSmsForm({ ...smsForm, entityId: e.target.value })
                        }
                        placeholder="e.g., 1101234567890123456"
                        required
                      />
                    </Field>
                    <Field label="SmartPing Content Template ID *">
                      <Input
                        value={smsForm.contentTemplateId}
                        onChange={(e) =>
                          setSmsForm({
                            ...smsForm,
                            contentTemplateId: e.target.value,
                          })
                        }
                        placeholder="e.g., 1107161234567890123"
                        required
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Content Template ID registered at{" "}
                        <a
                          href="https://smartping.live/entity/content-form"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          smartping.live/entity/content-form
                        </a>
                      </p>
                    </Field>
                  </div>
                )}

                {/* API Credentials */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="API Key *">
                    <div className="relative">
                      <Input
                        type={showSmsKey ? "text" : "password"}
                        className="pr-10"
                        value={smsForm.apiKey}
                        onChange={(e) =>
                          setSmsForm({ ...smsForm, apiKey: e.target.value })
                        }
                        placeholder="Enter SMS gateway API key"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmsKey(!showSmsKey)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showSmsKey ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                            />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </Field>
                  <Field label="API Secret / Auth Token">
                    <div className="relative">
                      <Input
                        type={showSmsSecret ? "text" : "password"}
                        className="pr-10"
                        value={smsForm.apiSecret}
                        onChange={(e) =>
                          setSmsForm({ ...smsForm, apiSecret: e.target.value })
                        }
                        placeholder="Enter API secret (if required)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmsSecret(!showSmsSecret)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showSmsSecret ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                            />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      API secret or auth token (if required by SMS gateway)
                    </p>
                  </Field>
                </div>

                {/* Optional Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field
                    label={
                      smsForm.provider === "msg91"
                        ? "MSG91 Template ID *"
                        : "Provider Template ID"
                    }
                    hint={
                      smsForm.provider === "msg91"
                        ? "Copy from MSG91 dashboard → SMS → Templates"
                        : "Template ID from SMS gateway provider (optional)"
                    }
                  >
                    <Input
                      value={smsForm.templateId}
                      onChange={(e) =>
                        setSmsForm({ ...smsForm, templateId: e.target.value })
                      }
                      placeholder={
                        smsForm.provider === "msg91"
                          ? "e.g., 69baeb2ed1e4338d8107a242"
                          : "SMS gateway template ID (if different from DLT)"
                      }
                      required={smsForm.provider === "msg91"}
                    />
                  </Field>
                  <Field
                    label="API Base URL"
                    hint="Custom API base URL (optional, uses provider default if empty)"
                  >
                    <Input
                      value={smsForm.baseUrl}
                      onChange={(e) =>
                        setSmsForm({ ...smsForm, baseUrl: e.target.value })
                      }
                      placeholder="https://api.provider.com"
                    />
                  </Field>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={smsSaving}>
                    {smsSaving ? "Saving..." : "Save SMS Settings"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={smsTesting}
                    onClick={handleSmsTest}
                  >
                    {smsTesting ? "Testing..." : "Test Connection"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {error && (
        <Alert tone="danger">
          <span className="flex items-center justify-between gap-4">
            {error}
            <button onClick={() => setError("")} className="font-bold">
              ×
            </button>
          </span>
        </Alert>
      )}
      {success && (
        <Alert tone="success">
          <span className="flex items-center justify-between gap-4">
            {success}
            <button onClick={() => setSuccess("")} className="font-bold">
              ×
            </button>
          </span>
        </Alert>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-sm font-medium text-gray-600">
          Filter by type:
        </label>
        <Select
          className="w-auto"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          {TEMPLATE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Form */}
      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingId(null);
          setForm(emptyTemplate);
          setSimpleTemplate(EMPTY_SIMPLE_TEMPLATE);
          setEditorMode("simple");
        }}
        title={editingId ? "Edit Template" : "Create New Template"}
        size="xl"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(emptyTemplate);
                setSimpleTemplate(EMPTY_SIMPLE_TEMPLATE);
                setEditorMode("simple");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingId ? "Update Template" : "Create Template"}
            </Button>
          </>
        }
      >
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Template Name *">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Application Acknowledgement"
                  required
                />
              </Field>
              <Field
                label="Template Type *"
                hint={
                  TEMPLATE_TYPES.find((t) => t.value === form.type)?.description
                }
              >
                <Select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {TEMPLATE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Email Subject *">
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g., Application Received - {{position}} | {{companyName}}"
                required
              />
            </Field>

            {/* Placeholders */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Placeholders{" "}
                <span className="text-xs text-gray-400">
                  (click to insert into body)
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {availablePlaceholders.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => insertPlaceholder(p)}
                    className="bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700 px-2.5 py-1 rounded text-xs font-mono cursor-pointer border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    {`{{${p}}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Body Editor & Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={editorMode === "simple" ? "primary" : "secondary"}
                      onClick={() => setEditorMode("simple")}
                    >
                      Simple Builder
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={editorMode === "html" ? "primary" : "secondary"}
                      onClick={() => setEditorMode("html")}
                    >
                      HTML Editor
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-blue-600 hover:text-blue-800"
                    onClick={handleUseDefault}
                  >
                    Load Default Template
                  </Button>
                </div>

                {editorMode === "simple" ? (
                  <div className="border border-gray-300 rounded-lg p-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Heading">
                        <Input
                          value={simpleTemplate.title}
                          onChange={(e) =>
                            setSimpleTemplate({
                              ...simpleTemplate,
                              title: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Greeting">
                        <Input
                          value={simpleTemplate.greeting}
                          onChange={(e) =>
                            setSimpleTemplate({
                              ...simpleTemplate,
                              greeting: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>

                    <Field label="Main Message">
                      <Textarea
                        rows={3}
                        value={simpleTemplate.intro}
                        onChange={(e) =>
                          setSimpleTemplate({
                            ...simpleTemplate,
                            intro: e.target.value,
                          })
                        }
                      />
                    </Field>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Summary Title">
                        <Input
                          value={simpleTemplate.summaryTitle}
                          onChange={(e) =>
                            setSimpleTemplate({
                              ...simpleTemplate,
                              summaryTitle: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Summary Details (multi-line)">
                        <Textarea
                          rows={3}
                          value={simpleTemplate.summaryBody}
                          onChange={(e) =>
                            setSimpleTemplate({
                              ...simpleTemplate,
                              summaryBody: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Image URL">
                        <Input
                          value={simpleTemplate.imageUrl}
                          onChange={(e) =>
                            setSimpleTemplate({
                              ...simpleTemplate,
                              imageUrl: e.target.value,
                            })
                          }
                          placeholder="https://example.com/banner.png"
                        />
                      </Field>
                      <div className="flex items-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => imageUploadRef.current?.click()}
                        >
                          Upload Image
                        </Button>
                        <input
                          ref={imageUploadRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadTemplateImage}
                        />
                        {simpleTemplate.imageUrl ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() =>
                              setSimpleTemplate({
                                ...simpleTemplate,
                                imageUrl: "",
                              })
                            }
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Button Text (optional)">
                        <Input
                          value={simpleTemplate.ctaText}
                          onChange={(e) =>
                            setSimpleTemplate({
                              ...simpleTemplate,
                              ctaText: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Button Link (optional)">
                        <Input
                          value={simpleTemplate.ctaUrl}
                          onChange={(e) =>
                            setSimpleTemplate({
                              ...simpleTemplate,
                              ctaUrl: e.target.value,
                            })
                          }
                          placeholder="https://..."
                        />
                      </Field>
                    </div>

                    <Field label="Footer">
                      <Textarea
                        rows={3}
                        value={simpleTemplate.footer}
                        onChange={(e) =>
                          setSimpleTemplate({
                            ...simpleTemplate,
                            footer: e.target.value,
                          })
                        }
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Header Color">
                        <input
                          type="color"
                          className="w-full h-10 border border-gray-300 rounded-lg bg-white"
                          value={simpleTemplate.headerColor}
                          onChange={(e) =>
                            setSimpleTemplate({
                              ...simpleTemplate,
                              headerColor: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Accent Color">
                        <input
                          type="color"
                          className="w-full h-10 border border-gray-300 rounded-lg bg-white"
                          value={simpleTemplate.accentColor}
                          onChange={(e) =>
                            setSimpleTemplate({
                              ...simpleTemplate,
                              accentColor: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>

                    <div className="pt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleApplySimpleBuilder}
                      >
                        Convert Builder to HTML
                      </Button>
                      <p className="text-xs text-gray-400 mt-2">
                        Tip: use placeholders like {"{{candidateName}}"} in any
                        text field.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Textarea
                    className="font-mono"
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    rows={20}
                    placeholder="<div>Your HTML email template...</div>"
                    required
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Live Preview
                </label>
                <div
                  className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50"
                  style={{ height: "calc(20 * 1.5rem + 1rem)" }}
                >
                  <iframe
                    ref={iframeRef}
                    title="Email Preview"
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">
                  Set as active template for this type
                </span>
              </label>
              <span className="text-xs text-gray-400">
                (Only one template per type can be active)
              </span>
            </div>
          </form>
        )}
      </Modal>

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500">No email templates found.</p>
          <p className="text-sm text-gray-400 mt-1">
            Create your first template to start sending automated emails.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template._id} padded>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {template.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(template.type)}`}
                    >
                      {getTypeLabel(template.type)}
                    </span>
                    {template.isActive ? (
                      <Badge tone="success" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge tone="neutral" dot>
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Subject:</span>{" "}
                    {template.subject}
                  </p>
                  <p className="text-xs text-gray-400">
                    Last updated:{" "}
                    {new Date(template.updatedAt).toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Preview */}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setPreviewHtml(
                        previewHtml === template._id ? null : template._id,
                      )
                    }
                  >
                    {previewHtml === template._id ? "Hide" : "Preview"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2"
                    title="Edit"
                    aria-label="Edit"
                    onClick={() => handleEdit(template)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    title="Delete"
                    aria-label="Delete"
                    onClick={() => handleDelete(template._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Preview & Test Area */}
              {previewHtml === template._id && (
                <div className="mt-4 space-y-3">
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <iframe
                      title={`Preview - ${template.name}`}
                      srcDoc={template.body}
                      className="w-full border-0"
                      style={{ minHeight: "300px" }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                  {/* Send Test Email */}
                  <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                    <Input
                      type="email"
                      placeholder="Enter test email address"
                      className="flex-1"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={sendingTest || !testEmail}
                      onClick={() => handleSendTest(template._id)}
                    >
                      {sendingTest ? "Sending..." : "Send Test Email"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        label="templates"
        onPageChange={setPage}
      />
    </div>
  );
};

export default EmailTemplateManagement;
