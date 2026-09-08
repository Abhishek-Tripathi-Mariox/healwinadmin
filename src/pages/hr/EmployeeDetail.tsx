import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { hrEmployeeApi, payrollApi } from "../../services/admin-api";
import {
  PageHeader, Button, Card, Table, THead, TBody, TR, Th, Td, TableState, Badge, Alert,
} from "../../components/ui";
import { useAuth } from "../../auth/useAuth";
import { PERMISSIONS } from "../../auth/permissions";

interface EmployeeDoc {
  _id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.EMPLOYEES_UPDATE);
  const [uploading, setUploading] = useState(false);
  const [docError, setDocError] = useState("");

  const addDocument = async (file: File) => {
    if (!id) return;
    // The name is what HR will look for later, so ask rather than defaulting
    // to whatever the file happened to be called on someone's laptop.
    const name = window.prompt("Document name", file.name.replace(/\.[^.]+$/, ""));
    if (!name) return;
    setUploading(true);
    setDocError("");
    try {
      const res = await hrEmployeeApi.addDocument(id, file, name);
      setData((d) => ({
        ...d,
        employee: { ...d.employee, documents: res.data?.documents || [] },
      }));
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (docId: string) => {
    if (!id) return;
    if (!window.confirm("Remove this document from the employee record?")) return;
    try {
      const res = await hrEmployeeApi.removeDocument(id, docId);
      setData((d) => ({
        ...d,
        employee: { ...d.employee, documents: res.data?.documents || [] },
      }));
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  useEffect(() => {
    if (!id) return;
    hrEmployeeApi.detail(id).then((res) => setData(res.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading…</div>;
  if (!data?.employee) return <div className="p-6 text-sm text-gray-400">Employee not found.</div>;

  const e = data.employee;
  const s = e.salaryStructure || {};

  const meta: [string, string][] = [
    ["Employee Code", e.employeeCode],
    ["Phone", e.phone || "—"],
    ["Email", e.email || "—"],
    ["Category", e.category ? e.category.charAt(0).toUpperCase() + e.category.slice(1) : "—"],
    ["Department", e.departmentId?.name || "—"],
    ["Designation", e.designationId?.name || "—"],
    ["Employment", e.employmentTypeId?.name || "—"],
    ["Joining Date", e.joiningDate ? new Date(e.joiningDate).toLocaleDateString("en-IN") : "—"],
    ["PAN", e.pan || "—"],
    ["UAN", e.uan || "—"],
    ["Bank A/C", e.accountNumber || "—"],
  ];

  return (
    <div className="p-6">
      <button onClick={() => navigate("/admin/employees")} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Back to Employees
      </button>
      <PageHeader
        title={e.fullName}
        subtitle={`${e.employeeCode} · `}
        actions={<Badge tone={e.status === "active" ? "success" : "neutral"}>{e.status}</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Profile</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            {meta.map(([k, v]) => (
              <div key={k}>
                <span className="text-gray-400">{k}: </span>
                <span className="text-gray-800">{v}</span>
              </div>
            ))}
          </div>
        </Card>
        {/* Employee documents (§2). Candidate paperwork is handled in
            recruitment; once someone is hired their ID proof, certificates and
            contract need a home on the employee record. */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Documents</h3>
            {canEdit && (
              <label className="cursor-pointer text-sm text-cyan-700 hover:underline">
                {uploading ? "Uploading…" : "+ Add document"}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={(ev) => {
                    const file = ev.target.files?.[0];
                    ev.target.value = "";
                    if (file) addDocument(file);
                  }}
                />
              </label>
            )}
          </div>
          {docError && <Alert tone="danger">{docError}</Alert>}
          {(e.documents || []).length === 0 ? (
            <p className="text-sm text-gray-400">No documents on file.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {(e.documents || []).map((d: EmployeeDoc) => (
                <li key={d._id} className="flex items-center gap-3 py-2">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 truncate text-cyan-700 hover:underline"
                  >
                    {d.name}
                  </a>
                  <span className="text-xs text-gray-400">
                    {new Date(d.uploadedAt).toLocaleDateString("en-IN")}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => removeDocument(d._id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Salary Structure</h3>
          <div className="space-y-1 text-sm">
            {[
              ["Basic", s.basic], ["HRA", s.hra], ["Conveyance", s.conveyance],
              ["Medical", s.medical], ["Special", s.specialAllowance],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between">
                <span className="text-gray-500">{k}</span>
                <span className="text-gray-800">{inr(Number(v) || 0)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-gray-100 pt-1 font-semibold">
              <span>CTC (annual)</span><span>{inr(s.ctcAnnual || 0)}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <div className="px-5 pt-5 pb-2 text-sm font-semibold text-gray-700">Recent Leaves</div>
          <Table>
            <THead><Th>Type</Th><Th>From</Th><Th>Days</Th><Th>Status</Th></THead>
            <TBody>
              {!data.leaves?.length ? (
                <TableState colSpan={4}>No leaves.</TableState>
              ) : (
                data.leaves.map((l: any) => (
                  <TR key={l._id}>
                    <Td>{l.leaveTypeId?.code || "—"}</Td>
                    <Td>{new Date(l.fromDate).toLocaleDateString("en-IN")}</Td>
                    <Td>{l.days}</Td>
                    <Td><Badge tone={l.status === "approved" ? "success" : l.status === "pending" ? "warning" : "neutral"}>{l.status}</Badge></Td>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </Card>

        <Card>
          <div className="px-5 pt-5 pb-2 text-sm font-semibold text-gray-700">Payslips</div>
          <Table>
            <THead><Th>Month</Th><Th className="text-right">Net Pay</Th><Th></Th></THead>
            <TBody>
              {!data.payslips?.length ? (
                <TableState colSpan={3}>No payslips.</TableState>
              ) : (
                data.payslips.map((p: any) => (
                  <TR key={p._id}>
                    <Td>{MONTHS[p.month - 1]} {p.year}</Td>
                    <Td className="text-right font-medium">{inr(p.netPay)}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant="ghost" className="px-2" aria-label="Download"
                        onClick={() => payrollApi.downloadPayslip(p._id, `payslip-${p.employeeCode}-${p.month}-${p.year}.pdf`)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </Td>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
