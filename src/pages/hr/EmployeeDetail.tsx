import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { hrEmployeeApi, payrollApi } from "../../services/admin-api";
import {
  PageHeader, Button, Card, Table, THead, TBody, TR, Th, Td, TableState, Badge,
} from "../../components/ui";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
